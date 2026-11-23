import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebModuleServer } from '../../../../../../support/web-modules.mjs';

const vite = await createWebModuleServer();
test.after(async () => vite.close());
const THREE = await vite.ssrLoadModule('three');
const {
  PLAIN_SHADOW_RADIUS_TEXELS,
  SOFT_SHADOW_PROBE_METRES,
  createSoftShadowChunk,
  installSoftShadows,
  shadowFilterRadius,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/soft-shadows.ts');

const CHUNK = 'shadowmap_pars_fragment';
const PCF_SIGNATURE = 'float getShadow( sampler2DShadow shadowMap,';
const occurrences = (text, needle) => text.split(needle).length - 1;

test('the distance-softening filter replaces only the PCF getShadow of the installed three.js', () => {
  const original = THREE.ShaderChunk[CHUNK];
  // three.js 改版後若這個函式不見了，這個測試會先失敗，提醒要重新對照著色器。
  assert.equal(occurrences(original, PCF_SIGNATURE), 1, 'three.js still ships one PCF getShadow');
  const chunk = createSoftShadowChunk(original, { depthRangeMetres: 60 });
  assert.equal(typeof chunk, 'string');
  assert.equal(occurrences(chunk, PCF_SIGNATURE), 1);
  assert.ok(chunk.includes('softShadowDisk5') && chunk.includes('softShadowDisk8'));
  // 其他過濾方式（VSM、不過濾）與點光源的陰影原封不動。
  const before = original.slice(0, original.indexOf(PCF_SIGNATURE));
  assert.ok(chunk.startsWith(before));
  for (const untouched of ['float getPointShadow(', 'float VSMShadow(']) {
    assert.equal(occurrences(chunk, untouched), occurrences(original, untouched), untouched);
  }
  const braces = (text) => occurrences(text, '{') - occurrences(text, '}');
  assert.equal(braces(chunk), braces(original), 'braces stay balanced');
  assert.equal(
    occurrences(chunk, '#if'),
    occurrences(chunk, '#endif'),
    'preprocessor blocks stay balanced',
  );

  // 探測深度是「公尺 ÷ 陰影相機的深度範圍」。
  for (const metres of SOFT_SHADOW_PROBE_METRES) {
    assert.ok(chunk.includes((metres / 60).toPrecision(8)), `probe ${metres} m`);
  }
  const wider = createSoftShadowChunk(original, { depthRangeMetres: 120 });
  assert.ok(wider.includes((SOFT_SHADOW_PROBE_METRES[2] / 120).toPrecision(8)));
  assert.notEqual(wider, chunk);
  // 固定半徑的分支仍在：shadow.radius 不是負值時行為和 three.js 原本相同。
  assert.match(chunk, /if \( shadowRadius >= 0\.0 \)/);
});

test('an unfamiliar shader chunk is left alone instead of being patched blindly', () => {
  assert.equal(
    createSoftShadowChunk('float somethingElse() { return 1.0; }', { depthRangeMetres: 60 }),
    null,
  );
  const original = THREE.ShaderChunk[CHUNK];
  assert.equal(
    createSoftShadowChunk(`${original}\n${original}`, { depthRangeMetres: 60 }),
    null,
    'ambiguous match',
  );
  assert.equal(
    createSoftShadowChunk(original.replaceAll('vogelDiskSample', 'otherSample'), {
      depthRangeMetres: 60,
    }),
    null,
    'helpers the replacement relies on are missing',
  );
  assert.throws(
    () => createSoftShadowChunk(original, { depthRangeMetres: 0 }),
    /positive shadow camera depth range/,
  );
  assert.throws(
    () => createSoftShadowChunk(original, { depthRangeMetres: Number.NaN }),
    /positive/,
  );
});

test('installing is shared between viewers and the last one to leave restores three.js', () => {
  const original = THREE.ShaderChunk[CHUNK];
  // 用一份副本當作 three.js 的著色器片段表，測試之間互不影響。
  const chunks = { [CHUNK]: original };
  const first = installSoftShadows({ depthRangeMetres: 60 }, chunks);
  assert.equal(typeof first, 'function');
  const patched = chunks[CHUNK];
  assert.equal(patched, createSoftShadowChunk(original, { depthRangeMetres: 60 }));
  const second = installSoftShadows({ depthRangeMetres: 60 }, chunks);
  assert.equal(chunks[CHUNK], patched, 'a second viewer does not patch the patched chunk again');
  first();
  first();
  assert.equal(chunks[CHUNK], patched, 'still in use by the second viewer');
  second();
  assert.equal(chunks[CHUNK], original);
  // 還原之後可以再裝一次。
  const again = installSoftShadows({ depthRangeMetres: 60 }, chunks);
  assert.equal(chunks[CHUNK], patched);
  again();
  assert.equal(chunks[CHUNK], original);

  // 著色器片段對不上時不安裝，呼叫端維持固定半徑。
  const unfamiliar = { [CHUNK]: 'float somethingElse() { return 1.0; }' };
  assert.equal(installSoftShadows({ depthRangeMetres: 60 }, unfamiliar), null);
  assert.equal(unfamiliar[CHUNK], 'float somethingElse() { return 1.0; }');
  assert.equal(installSoftShadows({ depthRangeMetres: 60 }, {}), null);

  // 不給表時裝進 three.js 自己的那一份，還原後不留痕跡。
  const restore = installSoftShadows({ depthRangeMetres: 60 });
  assert.equal(typeof restore, 'function');
  restore();
});

test('shadow.radius carries either a fixed radius or the penumbra growth per metre', () => {
  const input = {
    angularRadius: (0.4 * Math.PI) / 180,
    coverageMetres: 60,
    mapSize: 2048,
    distanceSoftening: true,
  };
  assert.equal(
    shadowFilterRadius({ ...input, distanceSoftening: false }),
    PLAIN_SHADOW_RADIUS_TEXELS,
  );
  assert.ok(PLAIN_SHADOW_RADIUS_TEXELS > 0);

  const clear = shadowFilterRadius(input);
  assert.ok(clear < 0, 'negative means distance softening');
  // 半影半徑 = 遮蔽距離 × tan(光源半徑)；一格是 60 m ÷ 2048。
  assert.ok(Math.abs(-clear - Math.tan(input.angularRadius) / (60 / 2048)) < 1e-12);
  // 晴天：10 公尺高的屋簷落到地上，半影半徑約 7 公分，貼地的欄杆腳不到 1 公分。
  assert.ok(-clear * (60 / 2048) * 10 > 0.05 && -clear * (60 / 2048) * 10 < 0.1);

  const overcast = shadowFilterRadius({ ...input, angularRadius: (3 * Math.PI) / 180 });
  assert.ok(overcast < clear * 5, 'a clouded sun is a much larger source');
  // 陰影貼圖越粗，同樣的半影佔的格數越少。
  assert.ok(Math.abs(shadowFilterRadius({ ...input, mapSize: 1024 }) - clear / 2) < 1e-12);
  // 點光源也不會變成 0：0 會被當成固定半徑 0。
  assert.ok(shadowFilterRadius({ ...input, angularRadius: 0 }) < 0);

  for (const broken of [
    { coverageMetres: 0 },
    { mapSize: 0 },
    { angularRadius: -1 },
    { angularRadius: Number.NaN },
  ]) {
    assert.throws(() => shadowFilterRadius({ ...input, ...broken }), /positive coverage/);
  }
});
