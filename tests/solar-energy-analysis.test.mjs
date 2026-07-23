import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPvgisWeatherSamples, evaluateEnergySensitivity, evaluateMirrorEnergy } from '../scripts/solar-energy-analysis.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const pvgis = JSON.parse(await readFile(resolve(repoRoot, 'source-materials/site/SRC-SITE-003_pvgis-5-3-tmy.json'), 'utf8'));
const weather = buildPvgisWeatherSamples(model, pvgis);

test('loads one coordinate-matched PVGIS typical meteorological year', () => {
  assert.equal(weather.length, 8760);
  assert.equal(weather.filter(({ season }) => season === 'warm').length, 3672);
  assert.equal(weather.filter(({ season }) => season === 'cool').length, 5088);
  assert.equal(Number((weather.reduce((sum, sample) => sum + sample.ghi, 0) / 1000).toFixed(3)), 1584.747);
});

test('v0.6.2 working optimum keeps X35 warm-season pool gain at zero', () => {
  const result = evaluateMirrorEnergy(model, weather);
  assert.equal(result.input.planRotation, 25.5);
  assert.equal(result.input.mirrorLeanFromVertical, 23);
  assert.equal(result.input.mirrorHeight, 3.6);
  assert.equal(result.input.pivotX, 35);
  assert.equal(result.mirrorSurfaceArea, 52.797);
  assert.equal(result.warm.baselinePoolKWh, 89032.14);
  assert.equal(result.warm.poolAddedKWh, 0);
  assert.equal(result.warm.roofRedirectedKWh, 289.797);
  assert.equal(result.cool.baselinePoolKWh, 107731.929);
  assert.equal(result.cool.poolAddedKWh, 1036.829);
  assert.equal(result.cool.poolIncreasePercent, 0.962);
  assert.equal(result.cool.roofRedirectedKWh, 4857.203);
  assert.equal(result.selectivity.strictWarmZero, true);
});

test('superseded v0.5.0 angles are rejected on the v0.6.2 pool', () => {
  const result = evaluateMirrorEnergy(model, weather, {
    planRotation: 26.5,
    mirrorLeanFromVertical: 3.1,
  });
  assert.equal(result.warm.poolAddedKWh, 200.722);
  assert.equal(result.cool.poolAddedKWh, 2116.651);
  assert.equal(result.selectivity.strictWarmZero, false);
});

test('pivot sensitivity matches the registered v0.6.2 energy results', () => {
  const sensitivity = evaluateEnergySensitivity(model, weather);
  const compact = sensitivity.results.map((result) => ({
    pivotX: result.input.pivotX,
    warm: result.warm.poolAddedKWh,
    cool: result.cool.poolAddedKWh,
  }));
  assert.deepEqual(compact, [
    { pivotX: 33, warm: 0.125, cool: 1199.844 },
    { pivotX: 35, warm: 0, cool: 1036.829 },
    { pivotX: 37, warm: 0, cool: 876.599 },
    { pivotX: 39, warm: 0, cool: 732.206 },
    { pivotX: 41, warm: 0, cool: 596.158 },
  ]);
});
