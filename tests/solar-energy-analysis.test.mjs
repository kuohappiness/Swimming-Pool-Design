import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPvgisWeatherSamples,
  evaluateEnergySensitivity,
  evaluateMirrorEnergy,
} from '../scripts/solar-energy-analysis.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const pvgis = JSON.parse(await readFile(
  resolve(repoRoot, 'source-materials/site/SRC-SITE-003_pvgis-5-3-tmy.json'),
  'utf8',
));
const weather = buildPvgisWeatherSamples(model, pvgis);

test('loads one coordinate-matched PVGIS typical meteorological year', () => {
  assert.equal(weather.length, 8760);
  assert.equal(weather.filter((sample) => sample.season === 'warm').length, 3672);
  assert.equal(weather.filter((sample) => sample.season === 'cool').length, 5088);
  assert.equal(Number((weather.reduce((sum, sample) => sum + sample.ghi, 0) / 1000).toFixed(3)), 1584.747);
});

test('v0.5.0 working optimum keeps warm-season pool gain at zero without a solar mask', () => {
  const result = evaluateMirrorEnergy(model, weather);
  assert.equal(result.input.planRotation, 26.5);
  assert.equal(result.input.mirrorLeanFromVertical, 3.1);
  assert.equal(result.input.mirrorHeight, 3.6);
  assert.equal(result.input.pivotX, 35);
  assert.equal(result.mirrorSurfaceArea, 48.671);
  assert.equal(result.warm.baselinePoolKWh, 66930.724);
  assert.equal(result.warm.poolAddedKWh, 0);
  assert.equal(result.warm.roofRedirectedKWh, 1332.85);
  assert.equal(result.cool.baselinePoolKWh, 78661.558);
  assert.equal(result.cool.poolAddedKWh, 1022.903);
  assert.equal(result.cool.poolIncreasePercent, 1.3);
  assert.equal(result.cool.roofRedirectedKWh, 9055.633);
  assert.equal(result.selectivity.strictWarmZero, true);
});

test('the former angles are not silently reused after moving the mirror to L3', () => {
  const result = evaluateMirrorEnergy(model, weather, {
    planRotation: 9.5,
    mirrorLeanFromVertical: 8.5,
  });
  assert.equal(result.warm.poolAddedKWh, 9.283);
  assert.equal(result.cool.poolAddedKWh, 1286.897);
  assert.equal(result.selectivity.strictWarmZero, false);
});

test('working optimum remains warm-zero across the structural-core pivot range', () => {
  const sensitivity = evaluateEnergySensitivity(model, weather);
  assert.deepEqual(sensitivity.pivotScenarios, [33, 35, 37, 39, 41]);
  assert.deepEqual(sensitivity.heightScenarios, [3.6]);
  assert.equal(sensitivity.results.length, 5);
  assert.ok(sensitivity.results.every((result) => result.warm.poolAddedKWh === 0));
  assert.equal(Math.min(...sensitivity.results.map((result) => result.cool.poolAddedKWh)), 673.31);
  assert.equal(Math.max(...sensitivity.results.map((result) => result.cool.poolAddedKWh)), 1151.973);
});
