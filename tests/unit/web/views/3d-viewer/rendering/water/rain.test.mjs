import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { buildViewerModel } from '../../../../../../../core/viewer/viewer-data.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
test.after(async () => vite.close());

const THREE = await vite.ssrLoadModule('three');
const rainModule = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/water/rain.ts');
const { RAIN_CURTAIN_NAME, RAIN_CURTAIN_SCHEMATIC_NAME } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/contracts.ts');
const { createGlossyFilmMaterial } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/glossy-film-material.ts');
const { computeSunLighting } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/sun-lighting.ts');
const { createViewerScene } = await vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts');
const { createBaselineSceneRenderingDependencies } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts');

const sourceModel = JSON.parse(readFileSync(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const registry = JSON.parse(readFileSync(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8'));
const viewerModel = buildViewerModel(sourceModel, registry);
const site = sourceModel.referenceSystem.siteLocation;
const at = (time, weather) => {
  const [hour, minute] = time.split(':').map(Number);
  return computeSunLighting({
    moment: { year: 2026, month: 6, day: 10, minutes: hour * 60 + minute },
    location: { latitude: site.latitude.value, longitude: site.longitude.value, utcOffsetHours: site.utcOffsetHours },
    positiveXAxisBearingFromTrueNorth: viewerModel.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
    weather,
  });
};

function createGraph() {
  const { materials, visualAssets } = createBaselineSceneRenderingDependencies();
  return createViewerScene(viewerModel, { materials, visualAssets });
}

/** 標準材質的著色器原始碼，像 three.js 編譯前交給 onBeforeCompile 的那份。 */
const standardShader = () => ({
  uniforms: {},
  vertexShader: THREE.ShaderLib.standard.vertexShader,
  fragmentShader: THREE.ShaderLib.standard.fragmentShader,
});

test('the rain curtain hangs from the low end of the roof into the catch trench, hidden until it rains', () => {
  const graph = createGraph();
  const { roof } = viewerModel.geometry;
  const curtain = graph.siteRoot.getObjectByName(RAIN_CURTAIN_NAME);
  const schematic = graph.siteRoot.getObjectByName(RAIN_CURTAIN_SCHEMATIC_NAME);
  assert.ok(curtain?.isMesh, 'curtain mesh');
  assert.equal(curtain.visible, false, 'the baseline path never shows the curtain');
  assert.equal(curtain.castShadow, false);
  assert.equal(curtain.userData.batchExclude, true, 'the curtain keeps its own material');
  curtain.geometry.computeBoundingBox();
  const box = curtain.geometry.boundingBox;
  assert.equal(box.min.x, roof.startX);
  assert.equal(box.max.x, roof.startX);
  assert.equal(box.max.y, roof.lowElevation);
  assert.ok(box.min.y > 0 && box.min.y < 0.3, `trench top ${box.min.y}`);
  assert.equal(box.min.z, 0);
  assert.equal(box.max.z, roof.width);
  // 示意線自成一組（批次合併後仍能整組藏起來），和雨簾在同一個可點選的物件底下。
  assert.ok(schematic, 'schematic lines');
  assert.equal(schematic.parent, curtain.parent);
  assert.equal(curtain.parent.userData.entityId, 'RC-RF-01');
  let lines = 0;
  schematic.traverse((object) => { if (object.isLine) lines += 1; });
  assert.ok(lines > 0, 'the schematic group still holds its lines after batching');
});

test('rain shows from the medium tier up and only when it rains; the saver tier keeps the schematic lines', () => {
  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.86).rotateY(Math.PI / 2).translate(0, 2.07, 7),
    new THREE.MeshBasicMaterial(),
  );
  const schematic = new THREE.Group();
  const rain = new rainModule.RainEffects({ curtain, schematic });
  const glass = createGlossyFilmMaterial({ color: 0xffffff, roughness: 0.1, opacity: 0.1 });
  assert.equal(rain.install(glass), true);
  assert.equal(rain.install(glass), true, 'installing twice is harmless');
  const placeholder = curtain.material;
  const sharedKey = createGlossyFilmMaterial({ color: 0xffffff, roughness: 0.1, opacity: 0.1 }).customProgramCacheKey();

  // 還沒設畫質之前當作省電級：不編進雨，屋頂玻璃和其他玻璃共用同一支程式，雨簾也還沒換材質。
  assert.equal(rain.state, 'none');
  assert.equal(glass.customProgramCacheKey(), sharedKey);
  assert.equal(curtain.material, placeholder);

  rain.setLighting(at('14:00', 'rain'));
  assert.equal(rain.state, 'none', 'no tier yet');
  for (const tier of ['high', 'medium']) {
    glass.needsUpdate = false;
    rain.setQuality(tier);
    assert.equal(rain.state, 'glass curtain', tier);
    assert.equal(curtain.visible, true);
    assert.equal(schematic.visible, false);
    assert.equal(rain.uniforms.uRainAmount.value, 1);
    assert.equal(glass.customProgramCacheKey(), `${sharedKey}|rain`);
  }
  assert.equal(curtain.material.name, 'realistic:rain-curtain');
  assert.ok(Math.abs(curtain.material.uniforms.uCurtainTop.value - 4) < 1e-6);
  assert.ok(Math.abs(curtain.material.uniforms.uCurtainBottom.value - 0.14) < 1e-6);
  const radiance = curtain.material.uniforms.uCurtainRadiance.value;
  assert.ok(radiance.r > 0 && radiance.g > 0 && radiance.b > 0);

  rain.setLighting(at('14:00', 'overcast'));
  assert.equal(rain.state, 'none');
  assert.equal(curtain.visible, false);
  assert.equal(schematic.visible, true);
  assert.equal(rain.uniforms.uRainAmount.value, 0);
  assert.match(glass.customProgramCacheKey(), /\|rain$/, 'weather does not recompile the glass');

  rain.setLighting(at('14:00', 'rain'));
  glass.needsUpdate = false;
  const version = glass.version;
  rain.setQuality('low');
  assert.equal(rain.state, 'none');
  assert.equal(curtain.visible, false);
  assert.equal(schematic.visible, true);
  assert.equal(glass.customProgramCacheKey(), sharedKey);
  assert.ok(glass.version > version, 'changing tiers recompiles the glass');
  assert.throws(() => rain.setQuality('ultra'), /Unknown rain quality tier/);

  rain.update(12.5, false);
  assert.equal(rain.uniforms.uRainTime.value, 12.5);
  rain.update(12.5, true);
  assert.equal(rain.uniforms.uRainTime.value, 0, 'reduced motion holds still');
  rain.dispose();
  assert.equal(curtain.material, placeholder, 'dispose hands the scene its own material back');
});

test('rain on glass patches the standard shader after the glossy film, and the uniforms ride along off or on', () => {
  const uniforms = rainModule.createRainUniforms();
  const program = { compiled: true };
  const glass = createGlossyFilmMaterial({ color: 0xffffff, roughness: 0.1, opacity: 0.1 });
  rainModule.installRainOnGlass(glass, uniforms, program);
  const shader = standardShader();
  glass.onBeforeCompile(shader, null);
  assert.equal(shader.uniforms.uRainAmount, uniforms.uRainAmount);
  assert.equal(shader.uniforms.uRainTime, uniforms.uRainTime);
  // 玻璃的薄膜混合還在；水的法線接在法線貼圖之後、光照之前，菲涅耳倒影才會被水珠打碎。
  assert.ok(!shader.fragmentShader.includes('#include <opaque_fragment>'), 'glossy film still patched');
  const normalAt = shader.fragmentShader.indexOf('#include <normal_fragment_maps>');
  const rainAt = shader.fragmentShader.indexOf('rainHeight( rainPoint');
  const lightsAt = shader.fragmentShader.indexOf('#include <lights_fragment_begin>');
  assert.ok(normalAt >= 0 && rainAt > normalAt && lightsAt > rainAt);
  assert.match(shader.fragmentShader, /float rainHeight\( vec2 p, float t, float slope \)/);
  assert.match(shader.vertexShader, /vRainWorld = \( modelMatrix \* vec4\( transformed, 1\.0 \) \)\.xyz;/);
  assert.ok(shader.vertexShader.indexOf('vRainNormal = ') > shader.vertexShader.indexOf('#include <project_vertex>'));

  program.compiled = false;
  const off = standardShader();
  glass.onBeforeCompile(off, null);
  assert.equal(off.uniforms.uRainAmount, uniforms.uRainAmount, 'both versions carry the uniforms');
  assert.ok(!off.fragmentShader.includes('rainHeight'));
  assert.ok(!off.vertexShader.includes('vRainWorld'));

  assert.equal(rainModule.installRainOnGlass(new THREE.MeshBasicMaterial(), uniforms, program), false);
  assert.equal(rainModule.patchRainOnGlassShader({ vertexShader: 'void main() {}', fragmentShader: 'void main() {}' }), false);
});

test('the rain curtain catches the cloudy sky by day and dims at night', () => {
  const day = rainModule.rainCurtainRadiance(at('14:00', 'rain'));
  const night = rainModule.rainCurtainRadiance(at('23:00', 'rain'));
  const luminance = (colour) => 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b;
  assert.ok(luminance(day) > 0);
  assert.ok(luminance(night) < luminance(day) * 0.2, `${luminance(night)} vs ${luminance(day)}`);
  assert.deepEqual(rainModule.RAIN_AMOUNT, { clear: 0, overcast: 0, rain: 1 });
});
