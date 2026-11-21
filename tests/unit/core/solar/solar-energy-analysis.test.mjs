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
} from '../../../../core/solar/solar-energy-analysis.mjs';
import { deriveSolarPlanOrientation, reflectSolarRay } from '../../../../core/solar/solar-reflection.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const model = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const pvgis = JSON.parse(await readFile(resolve(repoRoot, 'source-materials/site/SRC-SITE-003_pvgis-5-3-tmy.json'), 'utf8'));
const weather = buildPvgisWeatherSamples(model, pvgis);

test('loads one coordinate-matched PVGIS typical meteorological year', () => {
  assert.equal(weather.length, 8760);
  assert.equal(weather.filter(({ season }) => season === 'warm').length, 3672);
  assert.equal(weather.filter(({ season }) => season === 'cool').length, 5088);
  assert.equal(Number((weather.reduce((sum, sample) => sum + sample.ghi, 0) / 1000).toFixed(3)), 1584.747);
});

// SOLAR-METHOD-1.1.0 values (right-handed SITE-XY, L3 turned clockwise). The data
// accuracy review reproduced every number below independently by mirroring the
// pool and roof receivers under the old method; see DEC-150.
test('X35 working angles: corrected energy shows a small warm-season gain', () => {
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
  assert.equal(result.warm.baselinePoolKWh, 90622.62);
  assert.equal(result.warm.poolAddedKWh, 0.002);
  assert.equal(result.warm.poolAddedHours, 1);
  assert.equal(result.warm.roofRedirectedKWh, 290.401);
  assert.equal(result.cool.baselinePoolKWh, 108345.758);
  assert.equal(result.cool.poolAddedKWh, 1224.692);
  assert.equal(result.cool.poolAddedHours, 890);
  assert.equal(result.cool.poolIncreasePercent, 1.13);
  assert.equal(result.cool.roofRedirectedKWh, 4883.779);
  // 0.002 kWh exceeds the 0.001 kWh strict-zero threshold; the threshold stays.
  assert.equal(result.selectivity.strictWarmZero, false);
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
  assert.equal(result.warm.poolAddedKWh, 313.569);
  assert.equal(result.cool.poolAddedKWh, 2973.223);
  assert.equal(result.selectivity.strictWarmZero, false);
});

test('pivot sensitivity matches the corrected registered energy results', () => {
  const sensitivity = evaluateEnergySensitivity(model, weather);
  const compact = sensitivity.results.map((result) => ({
    pivotX: result.input.pivotX,
    warm: result.warm.poolAddedKWh,
    cool: result.cool.poolAddedKWh,
  }));
  assert.deepEqual(compact, [
    { pivotX: 33, warm: 0.206, cool: 1328.094 },
    { pivotX: 35, warm: 0.002, cool: 1224.692 },
    { pivotX: 37, warm: 0, cool: 1103.37 },
    { pivotX: 39, warm: 0, cool: 970.156 },
    { pivotX: 41, warm: 0, cool: 835.171 },
  ]);
  assert.deepEqual(
    model.geometryRevisions.find(({ id }) => id === model.activeGeometryRevisionId).solar.pivotSensitivity
      .map(({ pivotX, warmPoolAddedKWh, coolPoolAddedKWh }) => ({ pivotX, warm: warmPoolAddedKWh, cool: coolPoolAddedKWh })),
    compact,
    'the model must register the values the analysis computes',
  );
});
