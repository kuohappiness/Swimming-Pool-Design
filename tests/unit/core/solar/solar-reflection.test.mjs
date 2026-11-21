import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSolarPosition,
  circularAngleDelta,
  deriveSolarPlanOrientation,
  evaluatePoolReflection,
  intersectConvexPolygons,
  normalizeAzimuth,
  polygonArea,
  polygonIntersectsRectangle,
  projectShadowFootprint,
  reflectSolarRay,
  rotatePlanPoint,
} from '../scripts/solar-reflection.mjs';

test('azimuth helpers normalize wraparound without changing angular distance', () => {
  assert.equal(normalizeAzimuth(-10), 350);
  assert.equal(normalizeAzimuth(370), 10);
  assert.equal(circularAngleDelta(355, 5), 10);
  assert.equal(circularAngleDelta(10, 190), 180);
});

test('solar plan orientation derives from the canonical SITE-XY orientation', () => {
  const reference = {
    siteOrientation: {
      coordinateSystemId: 'SITE-XY',
      positiveXAxisBearingFromTrueNorth: 307,
      positiveXAxisDirection: 'pool-remote-to-service-core',
    },
  };
  assert.deepEqual(deriveSolarPlanOrientation(reference), {
    buildingAzimuth: 307,
    poolFacingAzimuth: 127,
    svgRotationFromLocalX: 217,
  });
  assert.throws(
    () => deriveSolarPlanOrientation({ ...reference, localLongAxisBearingFromTrueNorth: 308 }),
    /localLongAxisBearingFromTrueNorth is forbidden/,
  );
});

test('Taiwan summer-noon solar position is finite and above the horizon', () => {
  const solar = calculateSolarPosition({
    year: 2026, month: 6, day: 21, hour: 12, minute: 0,
    latitude: 24.145, longitude: 120.683, utcOffsetHours: 8,
  });
  assert.ok(solar.altitude > 80 && solar.altitude < 90);
  assert.ok(solar.azimuth >= 0 && solar.azimuth < 360);
  assert.throws(() => calculateSolarPosition({
    year: 2026, month: 2, day: 30, hour: 12, latitude: 24, longitude: 120, utcOffsetHours: 8,
  }), /solar date must be valid/);
});

test('solar position stays within the published NREL SPA benchmark tolerance', () => {
  // NREL SPA report example: 2003-10-17 12:30:30, zenith 50.11162°, azimuth 194.34024°.
  // This implementation is the documented NOAA approximation, so the tolerance includes
  // the benchmark pressure, temperature, refraction, and 30-second input differences.
  const solar = calculateSolarPosition({
    year: 2003,
    month: 10,
    day: 17,
    hour: 12,
    minute: 30,
    latitude: 39.742476,
    longitude: -105.1786,
    utcOffsetHours: -7,
  });
  assert.ok(Math.abs((90 - solar.altitude) - 50.11162) <= 0.4);
  assert.ok(Math.abs(solar.azimuth - 194.34024) <= 0.2);
});

test('vertical mirror obeys the analytic equal-incidence reflection case', () => {
  const reflection = reflectSolarRay({
    solarAltitude: 30,
    solarAzimuth: 180,
    wallNormalAzimuth: 180,
    wallLeanFromVertical: 0,
  });
  assert.equal(reflection.frontLit, true);
  assert.equal(reflection.reflectedFrontSide, true);
  assert.ok(reflection.frontHalfSpaceDot > 0);
  assert.ok(Math.abs(reflection.incidenceAngle - 30) < 1e-9);
  assert.ok(Math.abs(reflection.reflectedAzimuth - 180) < 1e-9);
  assert.ok(Math.abs(reflection.reflectedDownwardAngle - 30) < 1e-9);
});

test('ray reflection classifies front lighting, plan tolerance, and downward angle', () => {
  const reflection = reflectSolarRay({
    solarAltitude: 30,
    solarAzimuth: 150,
    wallNormalAzimuth: 150,
    wallLeanFromVertical: 23,
  });
  assert.equal(reflection.frontLit, true);
  assert.equal(reflection.reflectedFrontSide, true);
  assert.ok(reflection.reflectedDownwardAngle > 0);
  const target = evaluatePoolReflection(reflection, {
    poolTargetAzimuth: reflection.reflectedAzimuth,
    azimuthTolerance: 1,
    minimumDownwardAngle: 0,
  });
  assert.equal(target.hitsPool, true);
  assert.throws(
    () => evaluatePoolReflection(reflection, { poolTargetAzimuth: 150 }),
    /azimuthTolerance must be finite/,
  );
});

test('tilted mirror keeps a plan-backward downward ray in the 3D front half-space', () => {
  const reflection = reflectSolarRay({
    solarAltitude: 20.166866045343966,
    solarAzimuth: 77.05256883331447,
    wallNormalAzimuth: 152.5,
    wallLeanFromVertical: 23,
  });

  assert.equal(reflection.frontLit, true);
  assert.equal(reflection.reflectedFrontSide, true);
  assert.ok(reflection.frontHalfSpaceDot > 0);
  assert.ok(reflection.reflectedDownwardAngle > 0);
});

test('pool evaluation fails closed when an outgoing ray is not on the mirror front side', () => {
  const reflection = {
    ...reflectSolarRay({
      solarAltitude: 30,
      solarAzimuth: 150,
      wallNormalAzimuth: 150,
      wallLeanFromVertical: 23,
    }),
    reflectedFrontSide: false,
  };

  const target = evaluatePoolReflection(reflection, {
    poolTargetAzimuth: reflection.reflectedAzimuth,
    azimuthTolerance: 1,
    minimumDownwardAngle: 0,
  });
  assert.equal(target.hitsPool, false);
});

test('plan rotation preserves distance to the pivot', () => {
  const point = rotatePlanPoint({ x: 36, y: 6.75 }, { x: 35, y: 6.75 }, 90);
  assert.ok(Math.abs(point.x - 35) < 1e-9);
  assert.ok(Math.abs(point.y - 7.75) < 1e-9);
});

test('convex clipping returns the exact overlap area', () => {
  const squareA = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
  const squareB = [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 6 }, { x: 2, y: 6 }];
  assert.equal(polygonArea(squareA), 16);
  assert.equal(polygonArea(intersectConvexPolygons(squareA, squareB)), 4);
  assert.equal(polygonIntersectsRectangle(squareA, { x1: 3, x2: 5, y1: 3, y2: 5 }), true);
  assert.equal(polygonIntersectsRectangle(squareA, { x1: 5, x2: 6, y1: 5, y2: 6 }), false);
});

test('shadow projection reaches a named horizontal plane only from an upward sun vector', () => {
  const points = [
    { x: 0, y: 0, z: 2 },
    { x: 2, y: 0, z: 2 },
    { x: 2, y: 2, z: 2 },
    { x: 0, y: 2, z: 2 },
  ];
  const projected = projectShadowFootprint(points, { x: 0, y: 0, z: 1 }, 0);
  assert.equal(polygonArea(projected), 4);
  assert.deepEqual(projectShadowFootprint(points, { x: 0, y: 0, z: -1 }, 0), []);
});
