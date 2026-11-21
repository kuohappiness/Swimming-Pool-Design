import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { buildViewerModel } from '../scripts/viewer-data.mjs';
import { adaptWalkthroughSource } from '../reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts';

const repoRoot = resolve(import.meta.dirname, '..');
const [projectModel, analysisRegistry] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
]);
const viewerModel = buildViewerModel(projectModel, analysisRegistry);
const vite = await createServer({
  root: resolve(repoRoot, 'reference'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const [
  { createViewerScene },
  { createBaselineSceneRenderingDependencies },
  { EnhancedVisualAssetAdapter, getEnhancedQualityProfile },
] = await Promise.all([
  vite.ssrLoadModule('/src/3d-viewer/scene-factory.ts'),
  vite.ssrLoadModule('/src/3d-viewer/rendering/index.ts'),
  vite.ssrLoadModule('/src/3d-viewer/rendering/enhanced/index.ts'),
]);
test.after(async () => vite.close());

function collect(root, predicate) {
  const found = [];
  root.traverse((object) => {
    if (predicate(object)) found.push(object);
  });
  return found;
}

test('L1 sanitary model builds the approved 4 seated and 4 squat fixtures from canonical data', () => {
  const rendering = createBaselineSceneRenderingDependencies();
  try {
    const graph = createViewerScene(viewerModel, rendering);
    const sanitaryRoot = graph.siteRoot.getObjectByName('SANITARY-DETAILS-L1');
    assert.ok(sanitaryRoot);
    assert.equal(sanitaryRoot.userData.occupancyAppearance, 'newly-completed-in-use');
    const toilets = collect(sanitaryRoot, ({ userData }) =>
      userData.fixtureType === 'seated' || userData.fixtureType === 'squat');
    assert.equal(toilets.length, 8);
    assert.equal(toilets.filter(({ userData }) => userData.fixtureType === 'seated').length, 4);
    assert.equal(toilets.filter(({ userData }) => userData.fixtureType === 'squat').length, 4);
    assert.equal(collect(sanitaryRoot, ({ userData }) => userData.fixtureKind === 'washbasin').length, 8);
    assert.equal(collect(sanitaryRoot, ({ userData }) => userData.fixtureKind === 'urinal').length, 4);
    assert.ok(
      collect(sanitaryRoot, ({ isMesh }) => isMesh === true).length <= 180,
      'sanitary visual details must retain the batched draw-object budget',
    );
    assert.equal(collect(sanitaryRoot, ({ userData }) => userData.visualOnly === true)
      .every(({ userData }) => userData.collisionExcluded === true), true);

    const essential = collect(sanitaryRoot, ({ userData }) => userData.minimumVisualDetail === 'essential');
    const reduced = collect(sanitaryRoot, ({ userData }) => userData.minimumVisualDetail === 'reduced');
    const full = collect(sanitaryRoot, ({ userData }) => userData.minimumVisualDetail === 'full');
    assert.ok(essential.length > 20);
    assert.ok(reduced.length > 20);
    assert.ok(full.length > 20);
    assert.equal(essential.every(({ visible }) => visible), true);
    assert.equal(reduced.every(({ visible }) => !visible), true);
    assert.equal(full.every(({ visible }) => !visible), true);
  } finally {
    rendering.materials.dispose();
    rendering.visualAssets.dispose();
  }
});

test('sanitary quality detail switches are reversible and never mutate walkthrough collision data', () => {
  const baseline = createBaselineSceneRenderingDependencies();
  const adapter = new EnhancedVisualAssetAdapter(getEnhancedQualityProfile('high'));
  const sourceBefore = JSON.stringify(adaptWalkthroughSource(viewerModel));
  try {
    const graph = createViewerScene(viewerModel, {
      materials: baseline.materials,
      visualAssets: adapter,
    });
    const sanitaryRoot = graph.siteRoot.getObjectByName('SANITARY-DETAILS-L1');
    const essential = collect(sanitaryRoot, ({ userData }) => userData.minimumVisualDetail === 'essential');
    const reduced = collect(sanitaryRoot, ({ userData }) => userData.minimumVisualDetail === 'reduced');
    const full = collect(sanitaryRoot, ({ userData }) => userData.minimumVisualDetail === 'full');
    assert.equal([...essential, ...reduced, ...full].every(({ visible }) => visible), true);

    adapter.setQuality(getEnhancedQualityProfile('medium'));
    assert.equal(essential.every(({ visible }) => visible), true);
    assert.equal(reduced.every(({ visible }) => visible), true);
    assert.equal(full.every(({ visible }) => !visible), true);

    adapter.setQuality(getEnhancedQualityProfile('low'));
    assert.equal(essential.every(({ visible }) => visible), true);
    assert.equal([...reduced, ...full].every(({ visible }) => !visible), true);

    adapter.setQuality(getEnhancedQualityProfile('high'));
    assert.equal([...essential, ...reduced, ...full].every(({ visible }) => visible), true);
    assert.equal(JSON.stringify(adaptWalkthroughSource(viewerModel)), sourceBefore);
  } finally {
    adapter.dispose();
    baseline.materials.dispose();
    baseline.visualAssets.dispose();
  }
});
