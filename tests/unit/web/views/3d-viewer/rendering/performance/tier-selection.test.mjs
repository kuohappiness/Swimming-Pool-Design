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
const {
  BENCHMARK_REFERENCE_TIER,
  chooseTierFromBenchmark,
  estimateFrameMilliseconds,
  parseRealismTierId,
  selectRealismTier,
  summarizeBenchmark,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/performance/tier-selection.ts');

const benchmark = (medianMilliseconds) => ({ frames: 60, medianMilliseconds, p95Milliseconds: medianMilliseconds * 1.2 });
const base = { requested: null, stored: null, softwareRenderer: false, deviceClass: 'desktop', benchmark: null };

test('tier IDs parse case-insensitively and keep the old low link working', () => {
  assert.equal(parseRealismTierId('ultra'), 'ultra');
  assert.equal(parseRealismTierId(' High '), 'high');
  assert.equal(parseRealismTierId('low'), 'saver');
  assert.equal(parseRealismTierId('saver'), 'saver');
  assert.equal(parseRealismTierId('max'), null);
  assert.equal(parseRealismTierId(''), null);
  assert.equal(parseRealismTierId(null), null);
});

test('benchmark summary drops warm-up frames and needs ten valid samples', () => {
  assert.equal(summarizeBenchmark([90, 80, 70, 60, 50, 8, 8, 8]), null);
  const summary = summarizeBenchmark([
    90, 80, 70, 60, 50,
    8, 9, 10, 11, 12, 13, 14, 15, 16, 40, Number.NaN, 0,
  ]);
  assert.deepEqual(summary, { frames: 10, medianMilliseconds: 12.5, p95Milliseconds: 40 });
  assert.equal(summarizeBenchmark([4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], 0).medianMilliseconds, 14);
});

test('benchmark picks the highest tier whose estimated cost leaves 20% headroom', () => {
  assert.equal(BENCHMARK_REFERENCE_TIER, 'medium');
  assert.equal(estimateFrameMilliseconds(benchmark(4), 'medium'), 4);
  assert.ok(Math.abs(estimateFrameMilliseconds(benchmark(4), 'ultra') - 12.8) < 1e-9);
  // Desktop budget: 16.67 ms × 0.8 = 13.33 ms.
  assert.equal(chooseTierFromBenchmark(benchmark(4), 'desktop'), 'ultra');
  assert.equal(chooseTierFromBenchmark(benchmark(6), 'desktop'), 'high');
  assert.equal(chooseTierFromBenchmark(benchmark(12), 'desktop'), 'medium');
  assert.equal(chooseTierFromBenchmark(benchmark(20), 'desktop'), 'saver');
  assert.equal(chooseTierFromBenchmark(benchmark(80), 'desktop'), 'saver');
});

test('automatic selection on mobile never goes above medium', () => {
  // Mobile budget: 22.22 ms × 0.8 = 17.78 ms.
  assert.equal(chooseTierFromBenchmark(benchmark(2), 'mobile'), 'medium');
  assert.equal(chooseTierFromBenchmark(benchmark(17), 'mobile'), 'medium');
  assert.equal(chooseTierFromBenchmark(benchmark(25), 'mobile'), 'saver');
  assert.equal(chooseTierFromBenchmark(benchmark(60), 'mobile'), 'saver');
});

test('selection order is URL, manual choice, software renderer, benchmark, default', () => {
  assert.deepEqual(
    selectRealismTier({ ...base, requested: 'ultra', stored: 'saver', softwareRenderer: true, benchmark: benchmark(80) }),
    { tier: 'ultra', source: 'url' },
  );
  assert.deepEqual(
    selectRealismTier({ ...base, requested: 'bogus', stored: 'high', softwareRenderer: true }),
    { tier: 'high', source: 'manual' },
  );
  assert.deepEqual(
    selectRealismTier({ ...base, softwareRenderer: true, benchmark: benchmark(2) }),
    { tier: 'saver', source: 'software-renderer' },
  );
  assert.deepEqual(selectRealismTier({ ...base, benchmark: benchmark(6) }), { tier: 'high', source: 'benchmark' });
  assert.deepEqual(selectRealismTier(base), { tier: 'high', source: 'default' });
  assert.deepEqual(selectRealismTier({ ...base, deviceClass: 'mobile' }), { tier: 'medium', source: 'default' });
});
