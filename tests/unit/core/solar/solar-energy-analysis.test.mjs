import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPvgisWeatherSamples,
  evaluateEnergySensitivity,
  evaluateMirrorEnergy,
  mirrorReceiverFractions,
} from '../scripts/solar-energy-analysis.mjs';
import { deriveSolarPlanOrientation, reflectSolarRay } from '../scripts/solar-reflection.mjs';

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

test('v0.6.7 carried-forward working optimum keeps X35 warm-season pool gain at zero', () => {
  const result = evaluateMirrorEnergy(model, weather);
  assert.equal(result.input.planRotation, 25.5);
  assert.equal(result.input.mirrorLeanFromVertical, 23);
  assert.equal(result.input.mirrorReflectance, 0.75);
  assert.equal(result.input.glazingSolarTransmittance, 0.6);
  assert.equal(result.input.daylightStartHour, 7);
  assert.equal(result.input.daylightEndHour, 17);
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

test('receiver geometry and optical factors stay within physical energy bounds', () => {
  const result = evaluateMirrorEnergy(model, weather);
  for (const season of [result.warm, result.cool]) {
    assert.ok(
      season.roofRedirectedKWh
        <= season.mirrorInterceptedKWh * result.input.mirrorReflectance + 0.002,
    );
    assert.ok(
      season.poolAddedKWh
        <= season.mirrorInterceptedKWh
          * result.input.mirrorReflectance
          * result.input.glazingSolarTransmittance
          + 0.002,
    );
  }

  const orientation = deriveSolarPlanOrientation(model.referenceSystem);
  const wallNormalAzimuth = (
    orientation.poolFacingAzimuth + result.input.planRotation
  ) % 360;
  let checkedReflections = 0;
  for (const sample of weather) {
    if (sample.dni <= 0 || sample.solar.altitude <= 0) continue;
    const reflection = reflectSolarRay({
      solarAltitude: sample.solar.altitude,
      solarAzimuth: sample.solar.azimuth,
      wallNormalAzimuth,
      wallLeanFromVertical: result.input.mirrorLeanFromVertical,
    });
    if (
      !reflection.frontLit
      || !reflection.reflectedFrontSide
      || reflection.reflectedDownwardAngle <= 0
    ) continue;
    const fractions = mirrorReceiverFractions(model, result.input, reflection);
    checkedReflections += 1;
    for (const fraction of Object.values(fractions)) {
      assert.ok(fraction >= 0 && fraction <= 1);
    }
    assert.ok(
      fractions.rawPoolFraction <= fractions.roofFraction + 1e-9,
      'Every ray bundle reaching the pool plane must first lie within the fixed glass-roof receiver.',
    );
  }
  assert.equal(checkedReflections, 1791);
});

test('superseded v0.5.0 angles are rejected on the v0.6.7 pool', () => {
  const result = evaluateMirrorEnergy(model, weather, {
    planRotation: 26.5,
    mirrorLeanFromVertical: 3.1,
  });
  assert.equal(result.warm.poolAddedKWh, 200.722);
  assert.equal(result.cool.poolAddedKWh, 2116.651);
  assert.equal(result.selectivity.strictWarmZero, false);
});

test('pivot sensitivity matches the registered v0.6.7 carried-forward energy results', () => {
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
