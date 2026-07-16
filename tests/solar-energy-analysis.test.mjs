import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPvgisWeatherSamples,
  evaluateEnergySensitivity,
  evaluateMirrorEnergy,
  RECOMMENDED_SOLAR_MASK,
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

test('full exposure proves that the current mirror adds energy in both seasons', () => {
  const result = evaluateMirrorEnergy(model, weather);
  assert.equal(result.warm.baselinePoolKWh, 61101.385);
  assert.equal(result.warm.poolAddedKWh, 786.673);
  assert.equal(result.warm.poolIncreasePercent, 1.287);
  assert.equal(result.cool.baselinePoolKWh, 75512.949);
  assert.equal(result.cool.poolAddedKWh, 3445.526);
  assert.equal(result.cool.poolIncreasePercent, 4.563);
  assert.equal(result.selectivity.warmToCoolPoolEnergyRatio, 0.2283);
  assert.equal(result.selectivity.strictWarmZero, false);
});

test('the recommended architectural solar mask keeps the confirmed angles and removes warm-season gain', () => {
  const result = evaluateMirrorEnergy(model, weather, RECOMMENDED_SOLAR_MASK);
  assert.equal(result.input.planRotation, 9.5);
  assert.equal(result.input.mirrorLeanFromVertical, 8.5);
  assert.equal(result.warm.poolAddedKWh, 0);
  assert.equal(result.warm.roofRedirectedKWh, 0);
  assert.equal(result.cool.poolAddedKWh, 597.502);
  assert.equal(result.cool.poolIncreasePercent, 0.791);
  assert.equal(result.cool.roofRedirectedKWh, 2124.036);
  assert.equal(result.cool.occupiedRoofRedirectedHours, 178);
  assert.equal(result.selectivity.strictWarmZero, true);
});

test('the solar mask remains warm-zero across all working pivots and heights', () => {
  const sensitivity = evaluateEnergySensitivity(model, weather, RECOMMENDED_SOLAR_MASK);
  assert.equal(sensitivity.results.length, 9);
  assert.ok(sensitivity.results.every((result) => result.warm.poolAddedKWh === 0));
  assert.equal(Math.min(...sensitivity.results.map((result) => result.cool.poolAddedKWh)), 279.83);
  assert.equal(Math.max(...sensitivity.results.map((result) => result.cool.poolAddedKWh)), 683.747);
});
