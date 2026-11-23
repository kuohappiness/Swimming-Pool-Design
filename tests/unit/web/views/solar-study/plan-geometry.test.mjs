import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebModuleServer } from '../../../../support/web-modules.mjs';

const vite = await createWebModuleServer();
test.after(async () => vite.close());
const geometry = await vite.ssrLoadModule('/src/views/solar-study/plan-geometry.ts');

const close = (actual, expected) =>
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9));

test('azimuths are clockwise from north with SVG y pointing down', () => {
  const [cx, cy] = geometry.PLAN_CENTER;
  close(geometry.polar(0, 10), [cx, cy - 10]);
  close(geometry.polar(90, 10), [cx + 10, cy]);
  close(geometry.polar(180, 10), [cx, cy + 10]);
  close(geometry.polar(270, 10), [cx - 10, cy]);
});

test('the sky plot puts the zenith near the centre and the horizon at the rim', () => {
  const [cx, cy] = geometry.PLAN_CENTER;
  close(geometry.skyPoint({ altitude: 90, azimuth: 0 }), [cx, cy - 42]);
  close(geometry.skyPoint({ altitude: 0, azimuth: 0 }), [cx, cy - 178]);
  // Below the horizon is drawn on the rim, never outside it.
  close(geometry.skyPoint({ altitude: -5, azimuth: 0 }), [cx, cy - 178]);
});

test('rays stop short of their target and rotation keeps the distance', () => {
  close(geometry.pointFromOriginToward([0, 0], [10, 0], 3), [3, 0]);
  assert.deepEqual(geometry.pointFromOriginToward([1, 1], [1, 1], 3), [1, 1]);
  close(geometry.rotateSvgPoint([10, 0], [0, 0], 90), [0, 10]);
});

test('angles are written with an explicit plus sign and one decimal', () => {
  assert.equal(geometry.signed(25.5), '+25.5°');
  assert.equal(geometry.signed(-3), '-3.0°');
  assert.equal(geometry.signed(0), '0.0°');
});
