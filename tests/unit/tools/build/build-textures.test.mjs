import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  TEXTURE_ENCODER,
  conversionSettings,
  findStaleTextures,
  sourceHash,
} from '../../../../tools/build/build-textures.mjs';
import { TEXTURE_RECIPES } from '../../../../tools/build/textures/index.mjs';
import { CAUSTIC_MAXIMUM_GAIN, causticIrradiance, waterCaustics } from '../../../../tools/build/textures/water-caustics.mjs';
import { waterRippleNormal } from '../../../../tools/build/textures/water-ripple-normal.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const viewerRoot = resolve(repoRoot, 'web/src/views/3d-viewer');
const packageJson = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));

test('committed KTX2 textures are up to date with their generators and settings', async () => {
  const stale = await findStaleTextures();
  assert.deepEqual(
    stale.map(({ localPath, reason }) => `${localPath}：${reason}`),
    [],
    '貼圖已過期，請執行 npm run build:textures 並把結果一起提交',
  );
});

test('the recorded encoder is the pinned dev dependency', () => {
  assert.equal(TEXTURE_ENCODER, `ktx2-encoder@${packageJson.devDependencies['ktx2-encoder']}`);
  assert.equal('ktx2-encoder' in (packageJson.dependencies ?? {}), false, 'the encoder must not ship with the site');
});

test('every recipe writes a .ktx2 file that carries the KTX2 identifier and its licence', async () => {
  const ids = new Set();
  for (const recipe of TEXTURE_RECIPES) {
    const { id, localPath, license, source } = recipe.manifest;
    assert.equal(ids.has(id), false, `${id} is listed twice`);
    ids.add(id);
    assert.match(localPath, /^assets\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/[a-z0-9-]+\.ktx2$/);
    assert.match(source, /^project-authored:tools\/build\/textures\/[a-z0-9-]+\.mjs$/);
    await readFile(resolve(repoRoot, source.slice('project-authored:'.length)));
    const bytes = await readFile(resolve(viewerRoot, localPath));
    assert.deepEqual(
      [...bytes.subarray(0, 12)],
      [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a],
    );
    assert.ok(bytes.includes(`SPDX-License-Identifier: ${license}`));
    assert.equal(bytes.readUInt32LE(20), recipe.width);
    assert.equal(bytes.readUInt32LE(24), recipe.height);
    assert.equal(bytes.readUInt32LE(40), Math.log2(recipe.width) + 1, 'full mip chain');
  }
});

test('source hash covers both the pixels and the conversion settings', () => {
  const pixels = waterRippleNormal.generate();
  const hash = sourceHash(waterRippleNormal, pixels);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(sourceHash(waterRippleNormal, waterRippleNormal.generate()), hash, 'generation must be repeatable');

  const changedPixels = Uint8Array.from(pixels);
  changedPixels[0] ^= 1;
  assert.notEqual(sourceHash(waterRippleNormal, changedPixels), hash);
  assert.notEqual(sourceHash({ ...waterRippleNormal, normalMap: false }, pixels), hash);
  assert.throws(() => sourceHash(waterRippleNormal, pixels.subarray(4)), RangeError);
  assert.deepEqual(conversionSettings(waterRippleNormal), {
    encoder: TEXTURE_ENCODER,
    format: 'uastc',
    width: 512,
    height: 512,
    mipmaps: true,
    colorSpace: 'linear',
    normalMap: true,
  });
});

test('water ripple normal map is a seamless field of unit normals with no directional bias', () => {
  const { width, height } = waterRippleNormal;
  const pixels = waterRippleNormal.generate();
  const component = (x, y, channel) => pixels[(y * width + x) * 4 + channel] / 255 * 2 - 1;
  let sumX = 0;
  let sumY = 0;
  let minimumZ = 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = component(x, y, 0);
      const ny = component(x, y, 1);
      const nz = component(x, y, 2);
      assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 0.02, `normal at ${x},${y} is not unit length`);
      assert.equal(pixels[(y * width + x) * 4 + 3], 255);
      sumX += nx;
      sumY += ny;
      minimumZ = Math.min(minimumZ, nz);
    }
  }
  assert.ok(Math.abs(sumX / (width * height)) < 0.01, 'mean X tilt must be zero');
  assert.ok(Math.abs(sumY / (width * height)) < 0.01, 'mean Y tilt must be zero');
  assert.ok(minimumZ > 0.7, 'ripples must stay shallow enough to shade without artefacts');

  // Tiling: the step across the wrap-around edge is no larger than a step inside the image.
  const meanStep = (from, to, vertical) => {
    let total = 0;
    for (let index = 0; index < width; index += 1) {
      for (const channel of [0, 1]) {
        total += vertical
          ? Math.abs(component(index, from, channel) - component(index, to, channel))
          : Math.abs(component(from, index, channel) - component(to, index, channel));
      }
    }
    return total / (width * 2);
  };
  assert.ok(meanStep(width - 1, 0, false) < meanStep(255, 256, false) * 1.5, 'left and right edges must join');
  assert.ok(meanStep(height - 1, 0, true) < meanStep(255, 256, true) * 1.5, 'top and bottom edges must join');
});

test('caustic pattern conserves light and stores brightness up to four times the mean', () => {
  const { size, irradiance } = causticIrradiance();
  assert.equal(size, waterCaustics.width);
  let total = 0;
  let brightest = 0;
  let aboveRange = 0;
  for (const value of irradiance) {
    total += value;
    brightest = Math.max(brightest, value);
    if (value > CAUSTIC_MAXIMUM_GAIN) aboveRange += 1;
  }
  assert.ok(Math.abs(total / irradiance.length - 1) < 1e-9, 'every ray lands somewhere: mean irradiance is 1');
  assert.ok(brightest > 2, 'ripples must focus light into bright lines');
  assert.ok(aboveRange / irradiance.length < 0.005, 'almost nothing is clipped by the stored range');

  const pixels = waterCaustics.generate();
  assert.equal(pixels.length, size * size * 4);
  const index = irradiance.findIndex((value) => value > 0.9 && value < 1.1);
  assert.equal(pixels[index * 4], Math.round((irradiance[index] / CAUSTIC_MAXIMUM_GAIN) * 255));
  assert.equal(pixels[index * 4], pixels[index * 4 + 1]);
  assert.equal(pixels[index * 4 + 3], 255);
  assert.equal(waterCaustics.normalMap, false);
  assert.equal(waterCaustics.colorSpace, 'linear');
});
