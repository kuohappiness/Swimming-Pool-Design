import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
test.after(async () => vite.close());
const { FrameGovernor, HEADROOM_WORK_RATIO, OVER_BUDGET_TOLERANCE } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/performance/frame-governor.ts',
);
const { REALISM_TIERS } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/performance/realism-tiers.ts',
);

const SLOW = { intervalP95Milliseconds: 25, workP95Milliseconds: 22 };
const STEADY = { intervalP95Milliseconds: 16.8, workP95Milliseconds: 12 };
const IDLE = { intervalP95Milliseconds: 16.8, workP95Milliseconds: 5 };

/** Feeds one observation every 0.25 s and collects the changes the governor makes. */
function drive(governor, clock, seconds, frame, samples = 120) {
  const changes = [];
  const end = clock.time + seconds;
  while (clock.time < end - 1e-9) {
    clock.time += 0.25;
    const change = governor.observe({ timeSeconds: clock.time, samples, ...frame });
    if (change) changes.push({ at: clock.time, ...change });
  }
  return changes;
}

const desktop = (tier) => new FrameGovernor({ tier: REALISM_TIERS[tier], deviceClass: 'desktop' });

test('governor reads its frame budget from the device class', () => {
  const governor = desktop('high');
  assert.ok(Math.abs(governor.floorMilliseconds - 1000 / 60) < 1e-9);
  const mobile = new FrameGovernor({ tier: REALISM_TIERS.medium, deviceClass: 'mobile' });
  assert.ok(Math.abs(mobile.floorMilliseconds - 1000 / 30) < 1e-9);
  assert.ok(Math.abs(mobile.targetMilliseconds - 1000 / 45) < 1e-9);
  assert.deepEqual(governor.state, { resolutionScale: 1, shed: [] });
  assert.equal(OVER_BUDGET_TOLERANCE, 1.08);
  assert.equal(HEADROOM_WORK_RATIO, 0.5);
});

test('a short hitch or a steady frame rate changes nothing', () => {
  const governor = desktop('high');
  const clock = { time: 0 };
  assert.deepEqual(drive(governor, clock, 1.25, SLOW), []);
  assert.deepEqual(drive(governor, clock, 30, STEADY), []);
  assert.deepEqual(drive(governor, clock, 1.25, SLOW), []);
  assert.deepEqual(governor.state, { resolutionScale: 1, shed: [] });
});

test('sustained slow frames lower resolution to 70% first, then shed effects in the fixed order', () => {
  const governor = desktop('high');
  const clock = { time: 0 };
  const changes = drive(governor, clock, 40, SLOW);
  assert.deepEqual(
    changes.map(({ action, step, resolutionScale }) => [action, step, resolutionScale]),
    [
      ['lower-resolution', null, 0.9],
      ['lower-resolution', null, 0.8],
      ['lower-resolution', null, 0.7],
      ['shed', 'bloom', 0.7],
      ['shed', 'water-refraction', 0.7],
      ['shed', 'mirror-reflection', 0.7],
      ['shed', 'water-reflection-resolution', 0.7],
      ['shed', 'shadow-cascades', 0.7],
      ['shed', 'people-animation', 0.7],
      ['lower-tier', null, 0.7],
    ],
  );
  // 1.5 s over budget before the first step, then 1 s settling plus 1.5 s over budget per step.
  assert.equal(changes[0].at, 1.75);
  assert.equal(changes[1].at - changes[0].at, 2.5);
  assert.equal(changes.at(-1).tier, 'medium');
  assert.deepEqual(governor.state.shed, [
    'bloom',
    'water-refraction',
    'mirror-reflection',
    'water-reflection-resolution',
    'shadow-cascades',
    'people-animation',
  ]);
});

test('the lowest tier has nothing left to suggest once everything is shed', () => {
  const governor = desktop('saver');
  const clock = { time: 0 };
  const changes = drive(governor, clock, 60, SLOW);
  assert.deepEqual(changes.map(({ action }) => action), [
    'lower-resolution',
    'lower-resolution',
    'lower-resolution',
  ]);
});

test('ten seconds of headroom restores one step at a time in reverse order', () => {
  const governor = desktop('medium');
  const clock = { time: 0 };
  drive(governor, clock, 14, SLOW);
  assert.deepEqual(governor.state, {
    resolutionScale: 0.7,
    shed: ['water-reflection-resolution', 'people-animation'],
  });

  assert.deepEqual(drive(governor, clock, 60, STEADY), [], 'no dropped frames but no spare work time either');

  const changes = drive(governor, clock, 60, IDLE);
  assert.deepEqual(
    changes.map(({ action, step, resolutionScale }) => [action, step, resolutionScale]),
    [
      ['restore', 'people-animation', 0.7],
      ['restore', 'water-reflection-resolution', 0.7],
      ['raise-resolution', null, 0.8],
      ['raise-resolution', null, 0.9],
      ['raise-resolution', null, 1],
    ],
  );
  // 1 s settling after each change plus 10 s of headroom.
  assert.equal(changes[1].at - changes[0].at, 11);
  assert.deepEqual(governor.state, { resolutionScale: 1, shed: [] });
});

test('a restore that immediately drops frames doubles the wait before the next attempt', () => {
  const governor = desktop('medium');
  const clock = { time: 0 };
  drive(governor, clock, 2, SLOW);
  assert.equal(governor.state.resolutionScale, 0.9);
  assert.equal(governor.requiredHeadroomSeconds, 10);

  assert.equal(drive(governor, clock, 12, IDLE).at(-1).action, 'raise-resolution');
  assert.equal(drive(governor, clock, 3, SLOW).at(-1).action, 'lower-resolution');
  assert.equal(governor.requiredHeadroomSeconds, 20);

  assert.deepEqual(drive(governor, clock, 15, IDLE), [], 'ten seconds is no longer enough');
  assert.equal(drive(governor, clock, 8, IDLE).at(-1).action, 'raise-resolution');

  // Surviving the probation window keeps the longer wait but does not lengthen it again.
  drive(governor, clock, 60, STEADY);
  drive(governor, clock, 2, SLOW);
  assert.equal(governor.requiredHeadroomSeconds, 20);
});

test('thin statistics, a background tab and the settling window all restart the timers', () => {
  const governor = desktop('high');
  const clock = { time: 0 };
  assert.deepEqual(drive(governor, clock, 10, SLOW, 10), [], 'too few samples');

  drive(governor, clock, 1.25, SLOW);
  clock.time += 30;
  assert.deepEqual(drive(governor, clock, 1.25, SLOW), [], 'the gap must not count as slow time');
  assert.equal(drive(governor, clock, 0.75, SLOW).length, 1);

  assert.equal(
    governor.observe({ timeSeconds: Number.NaN, samples: 120, ...SLOW }),
    null,
  );
  assert.equal(
    governor.observe({ timeSeconds: clock.time + 0.25, samples: 120, intervalP95Milliseconds: Number.NaN, workP95Milliseconds: 1 }),
    null,
  );
});

test('mobile keeps everything on at 30 fps and only reacts below the floor', () => {
  const governor = new FrameGovernor({ tier: REALISM_TIERS.medium, deviceClass: 'mobile' });
  const clock = { time: 0 };
  assert.deepEqual(drive(governor, clock, 20, { intervalP95Milliseconds: 34, workP95Milliseconds: 28 }), []);
  const changes = drive(governor, clock, 3, { intervalP95Milliseconds: 45, workP95Milliseconds: 40 });
  assert.deepEqual(changes.map(({ action }) => action), ['lower-resolution']);
});

test('options are validated', () => {
  assert.throws(
    () => new FrameGovernor({ tier: REALISM_TIERS.high, deviceClass: 'desktop', resolutionStep: 0 }),
    RangeError,
  );
});
