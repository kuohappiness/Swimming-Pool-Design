import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { buildViewerModel } from '../scripts/viewer-data.mjs';

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
  {
    BASELINE_QUALITY_PROFILE,
    createBaselineSceneRenderingDependencies,
  },
  {
    EnhancedVisualAssetAdapter,
    getEnhancedQualityProfile,
  },
] = await Promise.all([
  vite.ssrLoadModule('/src/3d-viewer/scene-factory.ts'),
  vite.ssrLoadModule('/src/3d-viewer/rendering/index.ts'),
  vite.ssrLoadModule('/src/3d-viewer/rendering/enhanced/index.ts'),
]);
test.after(async () => vite.close());

function createGraph(adapter) {
  const baseline = createBaselineSceneRenderingDependencies();
  const materials = baseline.materials;
  const graph = createViewerScene(viewerModel, {
    materials,
    visualAssets: adapter,
  });
  return { graph, materials };
}

test('enhanced water and scale assets share the canonical visual water hook only', () => {
  const adapter = new EnhancedVisualAssetAdapter(getEnhancedQualityProfile('high'));
  const { graph, materials } = createGraph(adapter);
  assert.equal(adapter.assetStatus, 'attached');
  const scaleAssets = graph.siteRoot.getObjectByName('visual-only:SITE-01-scale-assets');
  assert.ok(scaleAssets);
  assert.equal(scaleAssets.userData.visualOnly, true);
  assert.equal(scaleAssets.userData.collisionExcluded, true);
  assert.equal(scaleAssets.userData.anchorEntityId, 'SITE-01');
  scaleAssets.traverse((object) => {
    assert.equal(object.userData.visualOnly, true);
    assert.equal(object.userData.collisionExcluded, true);
  });

  const waterline = graph.water.surface.getObjectByName('visual-only:POOL-01-waterline');
  assert.ok(waterline);
  assert.equal(waterline.userData.waterStateSource, 'walkthrough-main-pool-water');
  adapter.setWalkthroughState({
    movementMode: 'swimming-underwater',
    waterSurfaceElevation: graph.water.surfaceElevation,
    poolCutaway: false,
  });
  assert.equal(waterline.visible, false);
  adapter.setWalkthroughState({
    movementMode: 'walking',
    waterSurfaceElevation: graph.water.surfaceElevation,
    poolCutaway: false,
  });
  assert.equal(waterline.visible, true);
  adapter.setWalkthroughState({
    movementMode: 'walking',
    waterSurfaceElevation: graph.water.surfaceElevation,
    poolCutaway: true,
  });
  assert.equal(waterline.visible, false);
  assert.throws(() => adapter.setWalkthroughState({
    movementMode: 'walking',
    waterSurfaceElevation: graph.water.surfaceElevation + 0.1,
    poolCutaway: false,
  }), /second water surface state/);

  adapter.setQuality(getEnhancedQualityProfile('low'));
  assert.equal(scaleAssets.visible, false);
  const presentationMaterial = graph.water.surface.material;
  adapter.dispose();
  assert.equal(adapter.assetStatus, 'disposed');
  assert.equal(scaleAssets.parent, null);
  assert.equal(graph.water.surface.getObjectByName('visual-only:POOL-01-waterline'), undefined);
  assert.notEqual(graph.water.surface.material, presentationMaterial);
  materials.dispose();
});

test('optional visual asset failure degrades without removing water or baseline geometry', () => {
  const adapter = new EnhancedVisualAssetAdapter(BASELINE_QUALITY_PROFILE, {
    createOptionalAssets() {
      throw new Error('optional procedural asset fixture failed');
    },
  });
  const { graph, materials } = createGraph(adapter);
  assert.equal(adapter.assetStatus, 'degraded');
  assert.ok(graph.siteRoot.getObjectByName('POOL-01-WATER-SURFACE'));
  assert.ok(graph.siteRoot.getObjectByName('CUTAWAY-HIDE-SITE-GROUND'));
  assert.equal(graph.siteRoot.getObjectByName('visual-only:SITE-01-scale-assets'), undefined);
  adapter.dispose();
  materials.dispose();
});
