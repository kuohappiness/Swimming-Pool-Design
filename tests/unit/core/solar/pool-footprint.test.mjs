import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveActiveGeometry } from '../../../../core/geometry/active-geometry.mjs';
import { deriveMirrorNormalAzimuth } from '../../../../core/geometry/site-orientation.mjs';
import { projectPoolFootprint } from '../../../../core/solar/pool-footprint.mjs';
import { mirrorReceiverFractions } from '../../../../core/solar/solar-energy-analysis.mjs';
import {
  calculateSolarPosition,
  deriveSolarPlanOrientation,
  evaluatePoolReflection,
  reflectSolarRay,
} from '../../../../core/solar/solar-reflection.mjs';

const model = JSON.parse(
  await readFile(new URL('../../../../model/project-model.json', import.meta.url), 'utf8'),
);
const active = resolveActiveGeometry(model);
const solar = active.solar;
const location = model.referenceSystem.siteLocation;
const planRotation = solar.planRotation.value;
const lean = solar.mirrorLeanFromVertical.value;
const wallNormalAzimuth = deriveMirrorNormalAzimuth(model.referenceSystem, planRotation);

// The solar study page offers the 1st of every month plus both solstices, 07–18 h.
const pageDates = [
  [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [6, 21],
  [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [12, 21],
];
const pageMoments = pageDates.flatMap(([month, day]) => (
  Array.from({ length: 12 }, (_, index) => ({ month, day, hour: 7 + index }))
));

const reflectionAt = ({ month, day, hour }) => {
  const position = calculateSolarPosition({
    year: 2026,
    month,
    day,
    hour,
    latitude: location.latitude.value,
    longitude: location.longitude.value,
    utcOffsetHours: location.utcOffsetHours,
  });
  return {
    position,
    reflection: reflectSolarRay({
      solarAltitude: position.altitude,
      solarAzimuth: position.azimuth,
      wallNormalAzimuth,
      wallLeanFromVertical: lean,
    }),
  };
};

test('page hit verdict agrees with the energy analysis at every selectable moment', () => {
  const input = {
    planRotation,
    mirrorLeanFromVertical: lean,
    mirrorHeight: active.l3.mirror.height,
    pivotX: active.l3.planPivot.x,
  };
  let footprintHits = 0;
  let proxyHits = 0;
  for (const moment of pageMoments) {
    const { position, reflection } = reflectionAt(moment);
    if (position.altitude <= 0) continue;
    const hits = projectPoolFootprint(model, reflection).hitsPool;
    const energyLands = mirrorReceiverFractions(model, input, reflection).rawPoolFraction > 0;
    assert.equal(hits, energyLands, `${moment.month}/${moment.day} ${moment.hour}:00`);
    if (hits) footprintHits += 1;
    const proxy = evaluatePoolReflection(reflection, {
      poolTargetAzimuth: deriveSolarPlanOrientation(model.referenceSystem).poolFacingAzimuth,
      azimuthTolerance: solar.azimuthTolerance.value,
      minimumDownwardAngle: solar.minimumDownwardAngle.value,
    });
    if (proxy.hitsPool) proxyHits += 1;
  }
  // The retired direction proxy never reported a hit; the footprint test does.
  assert.equal(proxyHits, 0);
  assert.ok(footprintHits > 0);
});

test('winter solstice mornings land on the pool, summer solstice noon does not', () => {
  assert.equal(projectPoolFootprint(model, reflectionAt({ month: 12, day: 21, hour: 10 }).reflection).hitsPool, true);
  assert.equal(projectPoolFootprint(model, reflectionAt({ month: 6, day: 21, hour: 12 }).reflection).hitsPool, false);
});
