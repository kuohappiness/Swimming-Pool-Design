import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
import { buildViewerModel } from '../scripts/viewer-data.mjs';
import { adaptWalkthroughSource } from '../reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts';

const repoRoot = resolve(import.meta.dirname, '..');
const vite = await createServer({
  root: resolve(repoRoot, 'reference'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const [
  {
    EnhancedPbrMaterialRegistry,
    EnhancedSurfaceDetailAdapter,
    ENHANCED_QUALITY_PROFILES,
  },
  { createViewerScene },
  { BaselineVisualAssetAdapter },
] = await Promise.all([
  vite.ssrLoadModule('/src/3d-viewer/rendering/enhanced/index.ts'),
  vite.ssrLoadModule('/src/3d-viewer/scene-factory.ts'),
  vite.ssrLoadModule('/src/3d-viewer/rendering/baseline-visual-assets.ts'),
]);
test.after(async () => vite.close());

function createTextureFixture() {
  const calls = [];
  return {
    calls,
    loader: {
      async loadTexture(url, id) {
        calls.push({ url, id });
        const texture = new THREE.DataTexture(
          new Uint8Array([128, 128, 255, 255]),
          1,
          1,
          THREE.RGBAFormat,
        );
        texture.needsUpdate = true;
        return texture;
      },
    },
  };
}

async function createRegistry(quality = ENHANCED_QUALITY_PROFILES.high) {
  const fixture = createTextureFixture();
  const registry = await EnhancedPbrMaterialRegistry.create({
    quality,
    textureSourceLoader: fixture.loader,
  });
  return { ...fixture, registry };
}

test('enhanced PBR registry shares semantic material and texture instances with correct channels', async () => {
  const { registry, calls } = await createRegistry();
  try {
    assert.equal(registry.id, 'enhanced-pbr-material-registry');
    assert.equal(new Set(registry.semanticIds).size, registry.semanticIds.length);
    assert.equal(calls.length, 8);
    assert.equal(new Set(calls.map(({ id }) => id)).size, calls.length);
    assert.equal(calls.every(({ url }) => !/^https?:\/\//i.test(url)), true);

    for (const id of [
      'exposed-concrete-l1',
      'exposed-concrete-l2',
      'exposed-concrete-l3',
      'safety-glass',
      'structural-steel',
      'pool-basin',
      'pool-deck',
      'mirror',
      'photovoltaic',
      'water',
    ]) {
      const first = registry.get(id);
      assert.equal(first, registry.get(id), `${id} must reuse one material instance`);
      assert.equal(first.name, `enhanced:${id}`);
      assert.equal(first.userData.visualOnly, true);
    }

    const concreteL1 = registry.get('exposed-concrete-l1');
    const concreteL2 = registry.get('exposed-concrete-l2');
    assert.ok(concreteL1 instanceof THREE.MeshStandardMaterial);
    assert.equal(concreteL1.map, concreteL2.map);
    assert.equal(concreteL1.normalMap, concreteL2.normalMap);
    assert.equal(concreteL1.roughnessMap, concreteL2.roughnessMap);
    assert.equal(concreteL1.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(concreteL1.normalMap.colorSpace, THREE.NoColorSpace);
    assert.equal(concreteL1.roughnessMap.colorSpace, THREE.NoColorSpace);
    assert.equal(concreteL1.map.userData.metresPerRepeat, 1.2);
    assert.equal(concreteL1.map.repeat.x, 1 / 1.2);

    const basin = registry.get('pool-basin');
    assert.ok(basin instanceof THREE.MeshStandardMaterial);
    assert.equal(basin.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(basin.normalMap.colorSpace, THREE.NoColorSpace);
    assert.equal(basin.map.userData.metresPerRepeat, 0.25);
    assert.equal(basin.map.repeat.x, 4);

    const glass = registry.get('safety-glass');
    assert.ok(glass instanceof THREE.MeshPhysicalMaterial);
    assert.equal(glass.depthWrite, false);
    assert.equal(glass.transparent, true);
    assert.equal(glass.transmission, 0.74);
    assert.ok(glass.thickness > 0);

    const steel = registry.get('structural-steel');
    assert.ok(steel instanceof THREE.MeshStandardMaterial);
    assert.ok(steel.metalness > 0.5);
    const mirror = registry.get('mirror');
    assert.equal(mirror.metalness, 1);
    const photovoltaic = registry.get('photovoltaic');
    assert.ok(photovoltaic.clearcoat > 0.5);
  } finally {
    registry.dispose();
    registry.dispose();
  }
});

test('quality fallback changes only visual channels and restores the high tier', async () => {
  const { registry } = await createRegistry();
  try {
    const water = registry.get('water');
    const glass = registry.get('safety-glass');
    const concrete = registry.get('exposed-concrete-l1');
    assert.ok(water.normalMap);
    assert.equal(concrete.map.anisotropy, 8);

    registry.setQuality(ENHANCED_QUALITY_PROFILES.low);
    assert.equal(water.normalMap, null);
    assert.equal(glass.transmission, 0);
    assert.equal(concrete.map.anisotropy, 1);
    assert.equal(registry.get('exposed-concrete-l1'), concrete);

    registry.setQuality(ENHANCED_QUALITY_PROFILES.high);
    assert.ok(water.normalMap);
    assert.equal(glass.transmission, 0.74);
    assert.equal(concrete.map.anisotropy, 8);
  } finally {
    registry.dispose();
  }
});

test('required texture failure rejects enhanced mode while optional water safely degrades', async () => {
  const requiredFailure = createTextureFixture();
  requiredFailure.loader.loadTexture = async (_url, id) => {
    if (id === 'material-concrete-normal-v1') throw new Error('fixture required failure');
    return new THREE.Texture();
  };
  await assert.rejects(
    EnhancedPbrMaterialRegistry.create({
      quality: ENHANCED_QUALITY_PROFILES.high,
      textureSourceLoader: requiredFailure.loader,
    }),
    /fixture required failure/,
  );

  const optionalFailure = createTextureFixture();
  optionalFailure.loader.loadTexture = async (_url, id) => {
    if (id === 'material-water-normal-v1') throw new Error('fixture optional failure');
    return new THREE.Texture();
  };
  const registry = await EnhancedPbrMaterialRegistry.create({
    quality: ENHANCED_QUALITY_PROFILES.high,
    textureSourceLoader: optionalFailure.loader,
  });
  try {
    assert.equal(registry.get('water').normalMap, null);
    assert.ok(registry.get('exposed-concrete-l1').map);
  } finally {
    registry.dispose();
  }
});

test('surface details add only disposable visual edges and leave walkthrough data unchanged', async () => {
  const [projectModel, analysisRegistry] = await Promise.all([
    readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
  ]);
  const viewerModel = buildViewerModel(projectModel, analysisRegistry);
  const sourceBefore = adaptWalkthroughSource(viewerModel);
  const sourceJson = JSON.stringify(sourceBefore);
  const { registry } = await createRegistry();
  const baselineAssets = new BaselineVisualAssetAdapter();
  const details = new EnhancedSurfaceDetailAdapter(ENHANCED_QUALITY_PROFILES.high);
  try {
    const graph = createViewerScene(viewerModel, {
      materials: registry,
      visualAssets: baselineAssets,
    });
    graph.scene.updateMatrixWorld(true);
    const beforeBounds = new THREE.Box3().setFromObject(graph.siteRoot);
    const beforeMeshes = [];
    graph.siteRoot.traverse((object) => {
      if (object instanceof THREE.Mesh) beforeMeshes.push(object.uuid);
    });
    const selectableIds = graph.selectables.map(({ entityId }) => entityId);

    details.attach({
      scene: graph.scene,
      worldRoot: graph.worldRoot,
      siteRoot: graph.siteRoot,
      layerGroups: graph.layerGroups,
    });
    details.attach({
      scene: graph.scene,
      worldRoot: graph.worldRoot,
      siteRoot: graph.siteRoot,
      layerGroups: graph.layerGroups,
    });
    graph.scene.updateMatrixWorld(true);
    const afterBounds = new THREE.Box3().setFromObject(graph.siteRoot);
    const afterMeshes = [];
    const visualEdges = [];
    graph.siteRoot.traverse((object) => {
      if (object instanceof THREE.Mesh) afterMeshes.push(object.uuid);
      if (object.userData.visualOnly && object instanceof THREE.LineSegments) visualEdges.push(object);
    });

    assert.ok(details.detailCount > 0);
    assert.equal(visualEdges.length, details.detailCount);
    assert.equal(visualEdges.every(({ userData }) => userData.collisionExcluded === true), true);
    assert.deepEqual(afterMeshes, beforeMeshes);
    assert.deepEqual(graph.selectables.map(({ entityId }) => entityId), selectableIds);
    assert.ok(beforeBounds.min.distanceTo(afterBounds.min) < 1e-9);
    assert.ok(beforeBounds.max.distanceTo(afterBounds.max) < 1e-9);
    assert.equal(JSON.stringify(adaptWalkthroughSource(viewerModel)), sourceJson);

    details.setQuality(ENHANCED_QUALITY_PROFILES.low);
    assert.equal(visualEdges.every(({ visible }) => visible === false), true);
    details.setQuality(ENHANCED_QUALITY_PROFILES.high);
    assert.equal(visualEdges.every(({ visible }) => visible === true), true);
    details.dispose();
    details.dispose();
    assert.equal(details.detailCount, 0);
    assert.equal(visualEdges.every(({ parent }) => parent === null), true);
  } finally {
    details.dispose();
    registry.dispose();
    baselineAssets.dispose();
  }
});
