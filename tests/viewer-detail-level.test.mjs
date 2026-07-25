import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const vite = await createServer({
  root: resolve(import.meta.dirname, '..', 'reference'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const [
  { EnhancedDetailLevelAdapter, getEnhancedQualityProfile, markVisualDetail },
] = await Promise.all([
  vite.ssrLoadModule('/src/3d-viewer/rendering/enhanced/index.ts'),
]);
test.after(async () => vite.close());

function createContext() {
  const scene = new THREE.Scene();
  const worldRoot = new THREE.Group();
  const siteRoot = new THREE.Group();
  worldRoot.add(siteRoot);
  scene.add(worldRoot);
  const essential = markVisualDetail(new THREE.Group(), 'essential');
  essential.userData.castVisualShadow = true;
  const reduced = markVisualDetail(new THREE.Group(), 'reduced');
  const full = markVisualDetail(new THREE.Group(), 'full');
  const essentialMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial(),
  );
  const translucentMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 }),
  );
  essential.add(essentialMesh, translucentMesh);
  siteRoot.add(essential, reduced, full);
  return {
    context: { scene, worldRoot, siteRoot, layerGroups: new Map() },
    essential,
    essentialMesh,
    translucentMesh,
    reduced,
    full,
  };
}

test('quality-controlled details preserve essential silhouettes and degrade monotonically', () => {
  const {
    context,
    essential,
    essentialMesh,
    translucentMesh,
    reduced,
    full,
  } = createContext();
  const adapter = new EnhancedDetailLevelAdapter(getEnhancedQualityProfile('high'));
  adapter.attach(context);
  adapter.attach(context);
  assert.equal(adapter.detailCount, 3);
  assert.deepEqual([essential.visible, reduced.visible, full.visible], [true, true, true]);
  assert.equal(essentialMesh.castShadow, true);
  assert.equal(essentialMesh.receiveShadow, true);
  assert.equal(translucentMesh.castShadow, false);
  assert.equal(translucentMesh.receiveShadow, true);

  adapter.setQuality(getEnhancedQualityProfile('medium'));
  assert.deepEqual([essential.visible, reduced.visible, full.visible], [true, true, false]);

  adapter.setQuality(getEnhancedQualityProfile('low'));
  assert.deepEqual([essential.visible, reduced.visible, full.visible], [true, false, false]);
  assert.equal(essentialMesh.castShadow, false);
  assert.equal(essentialMesh.receiveShadow, false);

  adapter.setQuality(getEnhancedQualityProfile('high'));
  assert.deepEqual([essential.visible, reduced.visible, full.visible], [true, true, true]);

  adapter.dispose();
  adapter.dispose();
  assert.equal(adapter.detailCount, 0);
  assert.deepEqual([essential.visible, reduced.visible, full.visible], [true, false, false]);
  assert.equal(essentialMesh.castShadow, false);
  assert.equal(essentialMesh.receiveShadow, false);
});

test('detail adapter rejects unmarked collision-affecting quality geometry', () => {
  const { context, reduced } = createContext();
  reduced.userData.collisionExcluded = false;
  const adapter = new EnhancedDetailLevelAdapter(getEnhancedQualityProfile('high'));
  assert.throws(() => adapter.attach(context), /visual-only and collision-excluded/);
  adapter.dispose();
});
