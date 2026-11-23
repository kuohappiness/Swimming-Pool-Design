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
  DISPLAY_INTERVAL_MINIMUM_SAMPLES,
  QUALITY_CHOICES,
  QUALITY_STORAGE_KEY,
  QualityController,
  QualitySession,
  REALISM_TIERS,
  effectivePixelRatio,
  estimateDisplayIntervalMilliseconds,
  renderQualityProfileForTier,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/performance/index.ts');
const { ENHANCED_QUALITY_PROFILES } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/enhanced/quality-profiles.ts',
);

const SLOW = { intervalP95Milliseconds: 25, workP95Milliseconds: 22 };
const CAPPED = { intervalP95Milliseconds: 33.4, workP95Milliseconds: 3 };
const benchmark = (medianMilliseconds) => ({ frames: 15, medianMilliseconds, p95Milliseconds: medianMilliseconds * 1.2 });

/** Feeds one observation every 0.25 s and collects what the target reports. */
function drive(target, clock, seconds, frame) {
  const events = [];
  const end = clock.time + seconds;
  while (clock.time < end - 1e-9) {
    clock.time += 0.25;
    const event = target.observe({ timeSeconds: clock.time, samples: 120, ...frame });
    if (event) events.push(event);
  }
  return events;
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function createHost(benchmarkResult = null) {
  const log = [];
  return {
    log,
    published: [],
    benchmarks: 0,
    applyTier(tier, shed) { log.push(shed.length ? `tier:${tier.id}:${shed.join('+')}` : `tier:${tier.id}`); },
    applyResolution() { log.push('resolution'); },
    runBenchmark() { this.benchmarks += 1; log.push('benchmark'); return benchmarkResult; },
    publish(snapshot) { this.published.push(snapshot); },
    announce(message) { log.push(`announce:${message}`); },
  };
}

const sessionOptions = (overrides = {}) => ({
  requested: null,
  softwareRenderer: false,
  deviceClass: 'desktop',
  adaptive: true,
  storage: memoryStorage(),
  availableShedSteps: [],
  ...overrides,
});

test('display interval comes from the low end of the load-time frame gaps', () => {
  const sixty = Array.from({ length: 30 }, (_, index) => (index % 5 === 0 ? 48 : 16.7));
  assert.equal(estimateDisplayIntervalMilliseconds(sixty), 16.7);
  // Background-tab gaps and timer noise are ignored; too few samples give no answer.
  assert.equal(
    estimateDisplayIntervalMilliseconds([...Array.from({ length: 25 }, () => 20), 4000, 0.3, Number.NaN]),
    20,
  );
  assert.equal(
    estimateDisplayIntervalMilliseconds(Array.from({ length: DISPLAY_INTERVAL_MINIMUM_SAMPLES - 1 }, () => 16.7)),
    null,
  );
});

test('a realism tier overrides only what the pipeline profile already exposes', () => {
  const ultra = renderQualityProfileForTier(ENHANCED_QUALITY_PROFILES.high, REALISM_TIERS.ultra);
  const high = renderQualityProfileForTier(ENHANCED_QUALITY_PROFILES.high, REALISM_TIERS.high);
  const saver = renderQualityProfileForTier(ENHANCED_QUALITY_PROFILES.low, REALISM_TIERS.saver);
  assert.deepEqual(
    [ultra, high, saver].map(({ id, pixelRatioCap, shadows, shadowMapSize }) => ({ id, pixelRatioCap, shadows, shadowMapSize })),
    [
      { id: 'high', pixelRatioCap: 2, shadows: true, shadowMapSize: 2048 },
      { id: 'high', pixelRatioCap: 1.5, shadows: true, shadowMapSize: 2048 },
      { id: 'low', pixelRatioCap: 1, shadows: false, shadowMapSize: 0 },
    ],
  );
  assert.equal(high.surfaceDetail, ENHANCED_QUALITY_PROFILES.high.surfaceDetail);
  // Planar water reflection: half resolution on the two upper tiers, probe only below; when the
  // governor sheds it, the resolution halves again instead of the reflection disappearing.
  assert.deepEqual(
    [ultra, high, saver].map((profile) => profile.waterReflectionScale),
    [0.5, 0.5, 0],
  );
  assert.equal(
    renderQualityProfileForTier(ENHANCED_QUALITY_PROFILES.medium, REALISM_TIERS.medium).waterReflectionScale,
    0,
  );
  assert.equal(
    renderQualityProfileForTier(ENHANCED_QUALITY_PROFILES.high, REALISM_TIERS.high, ['water-reflection-resolution'])
      .waterReflectionScale,
    0.25,
  );
  assert.throws(
    () => renderQualityProfileForTier(ENHANCED_QUALITY_PROFILES.low, REALISM_TIERS.high),
    /expects the high pipeline profile/,
  );
  // Frame effects (TASK-152 step 6): the two upper tiers post-process, medium and saver draw
  // straight to the screen. Shedding bloom or ambient occlusion keeps the post-processing itself,
  // so the exposure does not jump when the governor steps in.
  const medium = renderQualityProfileForTier(ENHANCED_QUALITY_PROFILES.medium, REALISM_TIERS.medium);
  const frameEffects = ({ postProcessing, exposureAdaptation, bloom, ambientOcclusion }) => ({
    postProcessing, exposureAdaptation, bloom, ambientOcclusion,
  });
  assert.deepEqual([ultra, high, medium, saver].map(frameEffects), [
    { postProcessing: true, exposureAdaptation: true, bloom: true, ambientOcclusion: true },
    { postProcessing: true, exposureAdaptation: true, bloom: true, ambientOcclusion: false },
    { postProcessing: false, exposureAdaptation: false, bloom: false, ambientOcclusion: false },
    { postProcessing: false, exposureAdaptation: false, bloom: false, ambientOcclusion: false },
  ]);
  assert.deepEqual(
    frameEffects(renderQualityProfileForTier(
      ENHANCED_QUALITY_PROFILES.high,
      REALISM_TIERS.ultra,
      ['bloom', 'ambient-occlusion'],
    )),
    { postProcessing: true, exposureAdaptation: true, bloom: false, ambientOcclusion: false },
  );

  assert.equal(effectivePixelRatio(3, REALISM_TIERS.ultra, 1), 2);
  assert.equal(effectivePixelRatio(1, REALISM_TIERS.high, 0.8), 0.8);
  // The governor never goes below the tier's minimum; a bad value falls back to full scale.
  assert.equal(effectivePixelRatio(2, REALISM_TIERS.medium, 0.2), 1.5 * 0.7);
  assert.equal(effectivePixelRatio(Number.NaN, REALISM_TIERS.saver, Number.NaN), 1);
});

test('controller lowers the tier by itself and never raises it again', () => {
  const controller = new QualityController({
    selection: { tier: 'high', source: 'benchmark' },
    deviceClass: 'desktop',
    adaptive: true,
    availableShedSteps: [],
  });
  const clock = { time: 0 };
  const events = drive(controller, clock, 40, SLOW);
  assert.deepEqual(events.map(({ kind, state }) => [kind, state.tier, state.resolutionScale]), [
    ['resolution', 'high', 0.9],
    ['resolution', 'high', 0.8],
    ['resolution', 'high', 0.7],
    ['tier', 'medium', 1],
    ['resolution', 'medium', 0.9],
    ['resolution', 'medium', 0.8],
    ['resolution', 'medium', 0.7],
    ['tier', 'saver', 1],
    ['resolution', 'saver', 0.9],
    ['resolution', 'saver', 0.8],
    ['resolution', 'saver', 0.7],
  ]);
  assert.equal(events[3].reason, 'frame-rate');
  assert.equal(controller.state.source, 'frame-rate');

  // Plenty of headroom brings the resolution back, but the tier stays where it is.
  const recovered = drive(controller, clock, 60, { intervalP95Milliseconds: 16.8, workP95Milliseconds: 3 });
  assert.deepEqual(recovered.map(({ kind, state }) => [kind, state.tier]), [
    ['resolution', 'saver'],
    ['resolution', 'saver'],
    ['resolution', 'saver'],
  ]);
  assert.deepEqual(controller.state, {
    tier: 'saver',
    source: 'frame-rate',
    resolutionScale: 1,
    shed: [],
    displayIntervalMilliseconds: null,
  });
});

test('controller undoes an automatic lowering that turns out to be a display limit', () => {
  const controller = new QualityController({
    selection: { tier: 'medium', source: 'manual' },
    deviceClass: 'desktop',
    adaptive: true,
    availableShedSteps: [],
  });
  const clock = { time: 0 };
  const events = drive(controller, clock, 40, CAPPED);
  assert.deepEqual(events.map(({ kind, state, reason }) => [kind, state.tier, reason ?? null]), [
    ['resolution', 'medium', null],
    ['resolution', 'medium', null],
    ['resolution', 'medium', null],
    ['tier', 'saver', 'frame-rate'],
    ['resolution', 'saver', null],
    ['resolution', 'saver', null],
    ['resolution', 'saver', null],
    ['tier', 'medium', 'display-limited'],
  ]);
  assert.deepEqual(controller.state, {
    tier: 'medium',
    source: 'manual',
    resolutionScale: 1,
    shed: [],
    displayIntervalMilliseconds: 33.4,
  });
  // The same 30 fps is now accepted.
  assert.deepEqual(drive(controller, clock, 60, CAPPED), []);
});

test('controller does nothing automatic when adaptation is off, and rejects unknown tiers', () => {
  const controller = new QualityController({
    selection: { tier: 'high', source: 'url' },
    deviceClass: 'desktop',
    adaptive: false,
  });
  assert.deepEqual(drive(controller, { time: 0 }, 60, SLOW), []);
  assert.equal(controller.select({ tier: 'high', source: 'manual' }), null);
  assert.equal(controller.state.source, 'manual');
  const event = controller.select({ tier: 'ultra', source: 'manual' });
  assert.deepEqual([event.kind, event.previous, event.state.tier, event.reason], ['tier', 'high', 'ultra', 'selected']);
  assert.throws(() => controller.select({ tier: 'extreme', source: 'manual' }), /Unknown realism tier/);
});

test('session honours the link, then the stored choice, then the software renderer', () => {
  const storage = memoryStorage({ [QUALITY_STORAGE_KEY]: 'ultra' });
  const linked = new QualitySession(sessionOptions({ requested: 'low', storage }));
  assert.equal(linked.tier.id, 'saver');
  const host = createHost();
  linked.start(host);
  assert.deepEqual(host.log, []);
  assert.deepEqual(
    (({ tier, source, choice, description }) => ({ tier, source, choice, description }))(host.published[0]),
    { tier: 'saver', source: 'url', choice: 'saver', description: '目前：省電（由網址指定）' },
  );

  const stored = new QualitySession(sessionOptions({ storage }));
  assert.equal(stored.tier.id, 'ultra');
  assert.equal(stored.snapshot.choice, 'ultra');
  assert.equal(stored.snapshot.description, '目前：極致');

  const software = new QualitySession(sessionOptions({ softwareRenderer: true }));
  const softwareHost = createHost();
  software.start(softwareHost);
  assert.equal(softwareHost.benchmarks, 0);
  assert.equal(software.snapshot.adaptive, false);
  assert.equal(software.snapshot.choice, 'auto');
  assert.equal(software.snapshot.description, '目前：省電（這台裝置使用軟體繪圖）');
});

test('session benchmarks at the reference tier before choosing automatically', () => {
  const session = new QualitySession(sessionOptions());
  // The pipeline is built at the benchmark reference tier first.
  assert.equal(session.tier.id, 'medium');
  const host = createHost(benchmark(4));
  session.start(host, 20);
  assert.deepEqual(host.log, ['benchmark', 'tier:ultra', 'resolution']);
  const snapshot = host.published.at(-1);
  assert.equal(snapshot.tier, 'ultra');
  assert.equal(snapshot.source, 'benchmark');
  assert.equal(snapshot.choice, 'auto');
  assert.equal(snapshot.description, '目前：極致（依這台裝置的檢測結果）');
  assert.equal(snapshot.displayIntervalMilliseconds, 20);
  assert.equal(snapshot.benchmark.medianMilliseconds, 4);

  // A device for which medium is the right answer needs no tier change at all.
  const same = new QualitySession(sessionOptions());
  const sameHost = createHost(benchmark(12));
  same.start(sameHost);
  assert.deepEqual(sameHost.log, ['benchmark']);
  assert.equal(same.snapshot.tier, 'medium');

  // Phones never go above medium automatically; no measurement falls back to the default.
  const phone = new QualitySession(sessionOptions({ deviceClass: 'mobile' }));
  phone.start(createHost(benchmark(2)));
  assert.equal(phone.snapshot.tier, 'medium');
  const unmeasured = new QualitySession(sessionOptions());
  unmeasured.start(createHost(null));
  assert.deepEqual([unmeasured.snapshot.tier, unmeasured.snapshot.source], ['high', 'default']);
});

test('menu choices are applied, remembered, and auto measures only when it has to', () => {
  const storage = memoryStorage({ [QUALITY_STORAGE_KEY]: 'high' });
  const session = new QualitySession(sessionOptions({ storage }));
  const host = createHost(benchmark(30));
  assert.throws(() => session.choose('medium'), /has not been started/);
  session.start(host);
  assert.equal(host.benchmarks, 0);

  session.choose('saver');
  assert.deepEqual(host.log, ['tier:saver', 'resolution']);
  assert.equal(storage.values.get(QUALITY_STORAGE_KEY), 'saver');
  assert.equal(host.published.at(-1).choice, 'saver');

  // An unknown value is ignored.
  const publishedBefore = host.published.length;
  session.choose('cinematic');
  assert.equal(host.published.length, publishedBefore);

  // Back to automatic: nothing was measured yet, so measure at the reference tier first.
  host.log.length = 0;
  session.choose('auto');
  assert.deepEqual(host.log, ['tier:medium', 'resolution', 'benchmark', 'tier:saver', 'resolution']);
  assert.equal(storage.values.has(QUALITY_STORAGE_KEY), false);
  assert.deepEqual(
    [host.published.at(-1).choice, host.published.at(-1).tier, host.published.at(-1).source],
    ['auto', 'saver', 'benchmark'],
  );

  // The second time the earlier measurement is reused.
  session.choose('ultra');
  host.log.length = 0;
  session.choose('auto');
  assert.deepEqual(host.log, ['tier:saver', 'resolution']);
  assert.equal(host.benchmarks, 1);

  assert.deepEqual(QUALITY_CHOICES.map(({ value, label }) => `${value}:${label}`), [
    'auto:自動', 'ultra:極致', 'high:高', 'medium:中', 'saver:省電',
  ]);
});

test('session applies the governor and tells the user when the tier changes', () => {
  const session = new QualitySession(sessionOptions({ requested: 'high' }));
  const host = createHost();
  const clock = { time: 0 };
  // Observations before start are ignored.
  session.observe({ timeSeconds: 0, samples: 120, ...SLOW });
  session.start(host);
  drive({ observe: (observation) => { session.observe(observation); return null; } }, clock, 14, SLOW);
  assert.deepEqual(host.log, [
    'resolution',
    'resolution',
    'resolution',
    'tier:medium',
    'resolution',
    'announce:為維持流暢，畫質已調整為「中」；移動與碰撞維持不變',
  ]);
  const snapshot = host.published.at(-1);
  assert.equal(snapshot.choice, 'high', 'the menu keeps showing what the user asked for');
  assert.equal(snapshot.description, '目前：中（為維持流暢自動調降）');
  assert.match(host.published[2].description, /^目前：高（由網址指定，解析度 80%）$/);
});

test('a storage that throws never breaks the page', () => {
  const broken = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  const session = new QualitySession(sessionOptions({ storage: broken, softwareRenderer: true }));
  const host = createHost();
  session.start(host);
  session.choose('medium');
  session.choose('auto');
  assert.equal(session.snapshot.tier, 'saver');

  const none = new QualitySession(sessionOptions({ storage: null, requested: 'medium' }));
  none.start(createHost());
  none.choose('high');
  assert.equal(none.snapshot.tier, 'high');
});
