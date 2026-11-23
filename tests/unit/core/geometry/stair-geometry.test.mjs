import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundsOverlapArea,
  deriveStairFlights,
  deriveStairNosings,
  firstHeadroomShortfallX,
  rotatedBoundsPolygon,
} from '../../../../core/geometry/stair-geometry.mjs';

const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} ≠ ${expected}`);
const stair = (overrides = {}) => ({
  lowerStartX: 10,
  lowerElevation: 0,
  riserHeight: 0.15,
  treadDepth: 0.3,
  midLandingLength: 1.5,
  risersPerRun: 10,
  ...overrides,
});

test('equal flights: each flight has one tread fewer than risers and the landing takes the last riser', () => {
  const { flights, midLanding, topX, upperElevation, riserCount, treadCount } =
    deriveStairFlights(stair());
  close(flights[0].run, 2.7, 'first run');
  close(midLanding.x1, 12.7, 'landing start');
  close(midLanding.elevation, 1.5, 'landing elevation');
  close(flights[1].x1, 14.2, 'second flight start');
  close(topX, 16.9, 'top');
  close(upperElevation, 3, 'upper elevation');
  assert.equal(riserCount, 20);
  assert.equal(treadCount, 18);
});

test('unequal flights keep their own riser counts and the landing sits at the first flight height', () => {
  const { flights, midLanding, topX, upperElevation, riserCount, treadCount } = deriveStairFlights(
    stair({ risersPerRun: [12, 11] }),
  );
  close(flights[0].run, 3.3, 'first run');
  close(flights[1].run, 3, 'second run');
  close(midLanding.elevation, 1.8, 'landing elevation');
  close(topX, 10 + 3.3 + 1.5 + 3, 'top');
  close(upperElevation, 23 * 0.15, 'upper elevation');
  assert.equal(riserCount, 23);
  assert.equal(treadCount, 21);
  assert.throws(() => deriveStairFlights(stair({ risersPerRun: [12] })), /two whole riser counts/);
  assert.throws(() => deriveStairFlights(stair({ risersPerRun: 1.5 })), /two whole riser counts/);
});

test('nosings rise one riser per tread and include both landing edges', () => {
  const nosings = deriveStairNosings(stair({ risersPerRun: 3 }));
  assert.deepEqual(
    nosings.map(({ x }) => Number(x.toFixed(3))),
    [10, 10.3, 10.6, 12.1, 12.1, 12.4],
  );
  assert.deepEqual(
    nosings.map(({ z }) => Number(z.toFixed(3))),
    [0.15, 0.3, 0.45, 0.45, 0.6, 0.75],
  );
});

test('headroom shortfall starts at the first nosing closer than the required height to the slab', () => {
  // Slab underside at 2.5: nosing z must stay at or below 0.6 for 1.9 m headroom.
  close(firstHeadroomShortfallX(stair(), 2.5, 1.9), 10 + 4 * 0.3, 'first shortfall');
  assert.equal(firstHeadroomShortfallX(stair(), 10, 1.9), null);
});

test('rectangle overlap with a rotated convex polygon matches hand-computed areas', () => {
  const square = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ];
  close(boundsOverlapArea({ x1: 1, x2: 3, y1: 1, y2: 3 }, square), 1, 'quarter overlap');
  close(boundsOverlapArea({ x1: 5, x2: 6, y1: 5, y2: 6 }, square), 0, 'disjoint');
  close(
    boundsOverlapArea({ x1: 0, x2: 2, y1: 0, y2: 2 }, [...square].reverse()),
    4,
    'clockwise clip polygon',
  );
  const diamond = rotatedBoundsPolygon({ x1: -1, x2: 1, y1: -1, y2: 1 }, { x: 0, y: 0 }, 45);
  close(boundsOverlapArea({ x1: 0, x2: 5, y1: -5, y2: 5 }, diamond), 2, 'half of a rotated square');
});
