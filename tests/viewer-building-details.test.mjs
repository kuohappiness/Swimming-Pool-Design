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

function marked(root, level) {
  const found = [];
  root.traverse((object) => {
    if (object.userData.minimumVisualDetail === level) found.push(object);
  });
  return found;
}

test('phase-one building detail roots cover envelope, pool hall, and L2 interiors', () => {
  const rendering = createBaselineSceneRenderingDependencies();
  try {
    const graph = createViewerScene(viewerModel, rendering);
    const architecture = graph.siteRoot.getObjectByName('ARCHITECTURAL-DETAILS-PHASE-1');
    const poolHall = graph.siteRoot.getObjectByName('POOL-HALL-DETAILS-PHASE-1');
    const l2Interior = graph.siteRoot.getObjectByName('L2-INTERIOR-DETAILS-PHASE-1');
    assert.ok(architecture);
    assert.ok(poolHall);
    assert.ok(l2Interior);
    assert.equal(architecture.userData.realismPriority, 'building-exterior-and-interior-first');
    assert.equal(poolHall.userData.occupancyAppearance, 'newly-completed-in-use');
    assert.equal(l2Interior.userData.occupancyAppearance, 'newly-completed-in-use');
    assert.ok(graph.siteRoot.getObjectByName('visual-only:POOL-01-deck-drains:12'));
    assert.ok(graph.siteRoot.getObjectByName('visual-only:POOL-HALL-ceiling-lights:12'));
    assert.ok(graph.siteRoot.getObjectByName('visual-only:L2-shower-heads:30'));
    assert.ok(graph.siteRoot.getObjectByName('visual-only:L2-shower-drains:30'));
    assert.equal(Array.from({ length: 10 }, (_, index) =>
      graph.siteRoot.getObjectByName(`visual-only:POOL-01-caustic:${index + 1}`))
      .every(Boolean), true);
    assert.equal(marked(poolHall, 'essential').every(({ visible }) => visible), true);
    assert.equal([
      ...marked(architecture, 'reduced'),
      ...marked(poolHall, 'reduced'),
      ...marked(poolHall, 'full'),
      ...marked(l2Interior, 'reduced'),
      ...marked(l2Interior, 'full'),
    ].every(({ visible }) => !visible), true);
  } finally {
    rendering.materials.dispose();
    rendering.visualAssets.dispose();
  }
});

test('building detail tiers degrade without altering canonical movement data or water state', () => {
  const baseline = createBaselineSceneRenderingDependencies();
  const adapter = new EnhancedVisualAssetAdapter(getEnhancedQualityProfile('high'));
  const collisionBefore = JSON.stringify(adaptWalkthroughSource(viewerModel));
  try {
    const graph = createViewerScene(viewerModel, {
      materials: baseline.materials,
      visualAssets: adapter,
    });
    const architecture = graph.siteRoot.getObjectByName('ARCHITECTURAL-DETAILS-PHASE-1');
    const poolHall = graph.siteRoot.getObjectByName('POOL-HALL-DETAILS-PHASE-1');
    const l2Interior = graph.siteRoot.getObjectByName('L2-INTERIOR-DETAILS-PHASE-1');
    assert.equal([
      ...marked(architecture, 'reduced'),
      ...marked(architecture, 'full'),
      ...marked(poolHall, 'essential'),
      ...marked(poolHall, 'reduced'),
      ...marked(poolHall, 'full'),
      ...marked(l2Interior, 'reduced'),
      ...marked(l2Interior, 'full'),
    ].every(({ visible }) => visible), true);

    adapter.setQuality(getEnhancedQualityProfile('low'));
    assert.equal(marked(poolHall, 'essential').every(({ visible }) => visible), true);
    assert.equal([
      ...marked(architecture, 'reduced'),
      ...marked(architecture, 'full'),
      ...marked(poolHall, 'reduced'),
      ...marked(poolHall, 'full'),
      ...marked(l2Interior, 'reduced'),
      ...marked(l2Interior, 'full'),
    ].every(({ visible }) => !visible), true);
    assert.equal(JSON.stringify(adaptWalkthroughSource(viewerModel)), collisionBefore);
    assert.equal(graph.water.surface.userData.waterStateSource, 'walkthrough-main-pool-water');
  } finally {
    adapter.dispose();
    baseline.materials.dispose();
    baseline.visualAssets.dispose();
  }
});
