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
  FRAME_TARGETS,
  REALISM_TIERS,
  REALISM_TIER_ORDER,
  SHED_ORDER,
  assertRealismTiers,
  higherRealismTier,
  lowerRealismTier,
  sheddableSteps,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/performance/realism-tiers.ts');
const { RENDER_BUDGETS } = await import('../../../../../../../core/viewer/render-budgets.mjs');
const { VISUAL_ASSET_MANIFEST } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/enhanced/asset-manifest.ts',
);

test('four realism tiers descend in cost and take their limits from the shared budgets', () => {
  assert.deepEqual(REALISM_TIER_ORDER, ['ultra', 'high', 'medium', 'saver']);
  assert.equal(assertRealismTiers(), REALISM_TIERS);
  assert.deepEqual(
    REALISM_TIER_ORDER.map((id) => REALISM_TIERS[id].label),
    ['極致', '高', '中', '省電'],
  );
  for (const id of REALISM_TIER_ORDER) {
    const tier = REALISM_TIERS[id];
    assert.equal(Object.isFrozen(tier), true);
    assert.equal(tier.drawCallBudget, RENDER_BUDGETS[id].drawCalls);
    assert.equal(tier.triangleBudget, RENDER_BUDGETS[id].triangles);
    assert.equal(tier.downloadBudgetBytes, RENDER_BUDGETS[id].downloadBytes);
    assert.equal(tier.minimumResolutionScale, 0.7);
  }
  assert.equal(REALISM_TIERS.saver.shadowCascades, 0);
  assert.equal(REALISM_TIERS.saver.pixelRatioCap, 1);
  assert.equal(REALISM_TIERS.medium.relativeCost, 1);
});

test('frame targets keep 60 fps on desktop and a 30 fps floor with a 45 fps target on mobile', () => {
  assert.deepEqual(FRAME_TARGETS, {
    desktop: { floorFps: 60, targetFps: 60 },
    mobile: { floorFps: 30, targetFps: 45 },
  });
});

test('tier validation rejects a lower tier that costs more or turns an effect back on', () => {
  assert.throws(
    () =>
      assertRealismTiers({
        ...REALISM_TIERS,
        medium: { ...REALISM_TIERS.medium, shadowMapSize: 4096 },
      }),
    /shadowMapSize must not grow from high to medium/,
  );
  assert.throws(
    () => assertRealismTiers({ ...REALISM_TIERS, saver: { ...REALISM_TIERS.saver, bloom: true } }),
    /bloom must not turn on below medium/,
  );
  assert.throws(
    () =>
      assertRealismTiers({
        ...REALISM_TIERS,
        saver: { ...REALISM_TIERS.saver, exposureAdaptation: true },
      }),
    /exposureAdaptation must not turn on below medium/,
  );
  assert.throws(
    () =>
      assertRealismTiers({
        ...REALISM_TIERS,
        saver: { ...REALISM_TIERS.saver, shadowMapSize: 512 },
      }),
    /shadow cascades and map size must agree/,
  );
});

test('shed order is fixed and each tier only sheds what it has switched on', () => {
  assert.deepEqual(SHED_ORDER, [
    'bloom',
    'ambient-occlusion',
    'water-refraction',
    'mirror-reflection',
    'water-reflection-resolution',
    'shadow-cascades',
    'people-animation',
  ]);
  assert.deepEqual(sheddableSteps(REALISM_TIERS.ultra), SHED_ORDER);
  assert.deepEqual(
    sheddableSteps(REALISM_TIERS.high),
    SHED_ORDER.filter((step) => step !== 'ambient-occlusion'),
  );
  assert.deepEqual(sheddableSteps(REALISM_TIERS.medium), ['people-animation']);
  assert.deepEqual(sheddableSteps(REALISM_TIERS.saver), []);
});

test('tier stepping stops at both ends', () => {
  assert.equal(lowerRealismTier('ultra'), 'high');
  assert.equal(lowerRealismTier('saver'), null);
  assert.equal(higherRealismTier('saver'), 'medium');
  assert.equal(higherRealismTier('ultra'), null);
});

test('the assets each tier downloads today fit its download budget', () => {
  const legacyToRealism = { high: ['ultra', 'high'], medium: ['medium'], low: ['saver'] };
  const totals = Object.fromEntries(REALISM_TIER_ORDER.map((id) => [id, 0]));
  for (const asset of VISUAL_ASSET_MANIFEST) {
    for (const legacy of asset.qualityTiers) {
      for (const id of legacyToRealism[legacy]) totals[id] += asset.byteSize;
    }
  }
  for (const id of REALISM_TIER_ORDER) {
    assert.ok(totals[id] > 0, `${id} must load at least the required assets`);
    assert.ok(
      totals[id] <= REALISM_TIERS[id].downloadBudgetBytes,
      `${id} exceeds its download budget`,
    );
  }
});
