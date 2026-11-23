import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../../../../..');
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const { FrameStatistics } = await vite.ssrLoadModule('/src/views/3d-viewer/frame-statistics.ts');
test.after(async () => vite.close());

test('interval and work percentiles are tracked separately', () => {
  const statistics = new FrameStatistics(100);
  // A display-locked page: every interval is 16.7 ms, but five frames did heavy work.
  for (let frame = 0; frame < 100; frame += 1) {
    statistics.observe(frame / 60, 16.7, frame % 20 === 0 ? 14 : 4);
  }
  const observation = statistics.snapshot();
  assert.equal(observation.samples, 100);
  assert.equal(observation.intervalP95Milliseconds, 16.7);
  assert.equal(
    observation.workP95Milliseconds,
    4,
    'five slow frames out of 100 sit just above p95',
  );
  // The first new frame pushes out slow frame 0, the second pushes out a fast one.
  statistics.observe(100 / 60, 16.7, 14);
  assert.equal(statistics.snapshot().workP95Milliseconds, 4);
  statistics.observe(101 / 60, 16.7, 14);
  assert.equal(
    statistics.snapshot().workP95Milliseconds,
    14,
    'a sixth slow frame in the window lifts p95',
  );
  assert.equal(statistics.snapshot().timeSeconds, 101 / 60);
});

test('the window only keeps the most recent frames and ignores invalid samples', () => {
  const statistics = new FrameStatistics(10);
  for (let frame = 0; frame < 10; frame += 1) statistics.observe(frame, 50, 40);
  for (let frame = 10; frame < 20; frame += 1) statistics.observe(frame, 16, 5);
  statistics.observe(21, Number.NaN, 5);
  statistics.observe(22, 16, -1);
  const observation = statistics.snapshot();
  assert.equal(observation.samples, 10);
  assert.equal(observation.intervalP95Milliseconds, 16);
  assert.equal(observation.workP95Milliseconds, 5);
  assert.equal(observation.timeSeconds, 19);
  statistics.reset();
  assert.equal(statistics.snapshot().samples, 0);
  assert.equal(statistics.snapshot().workP95Milliseconds, 0);
  assert.throws(() => new FrameStatistics(0), RangeError);
});
