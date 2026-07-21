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

test('solar plan orientation requires one consistent world bearing', () => {
  const reference = {
    localLongAxisBearingFromTrueNorth: 307,
    worldTransform: { rotationFromTrueNorth: 307 },
  };
  assert.deepEqual(deriveSolarPlanOrientation(reference), {
    buildingAzimuth: 307,
    poolFacingAzimuth: 127,
    svgRotationFromLocalX: 217,
  });
  assert.throws(
    () => deriveSolarPlanOrientation({ ...reference, worldTransform: { rotationFromTrueNorth: 308 } }),
    /orientation fields must match/,
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

test('ray reflection classifies front lighting, plan tolerance, and downward angle', () => {
  const reflection = reflectSolarRay({
    solarAltitude: 30,
    solarAzimuth: 150,
    wallNormalAzimuth: 150,
    wallLeanFromVertical: 23,
  });
  assert.equal(reflection.frontLit, true);
  assert.ok(reflection.reflectedDownwardAngle > 0);
  const target = evaluatePoolReflection(reflection, {
    poolTargetAzimuth: reflection.reflectedAzimuth,
    azimuthTolerance: 1,
    minimumDownwardAngle: 0,
  });
  assert.equal(target.hitsPool, true);
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
