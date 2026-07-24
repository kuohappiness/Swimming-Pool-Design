import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
import { buildViewerModel } from '../scripts/viewer-data.mjs';

const repoRoot = resolve(import.meta.dirname, '..');

test('L2 Y0 ray reaches glass first and the changing-room divider stays at Y8', async () => {
  const [sourceModel, registry, content] = await Promise.all([
    readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'reference/generated/concept-content.json'), 'utf8').then(JSON.parse),
  ]);
  const vite = await createServer({
    root: resolve(repoRoot, 'reference'),
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: { port: 0 } },
  });

  try {
    const [{ createViewerScene }, { adaptViewerData }, { createBaselineSceneRenderingDependencies }] = await Promise.all([
      vite.ssrLoadModule('/src/3d-viewer/scene-factory.ts'),
      vite.ssrLoadModule('/src/3d-viewer/model-adapter.ts'),
      vite.ssrLoadModule('/src/3d-viewer/rendering/index.ts'),
    ]);
    const viewerModel = buildViewerModel(sourceModel, registry);
    assert.equal(adaptViewerData(viewerModel, content).model.geometry.l2.splitAxisY, 8);

    const missingSplitAxis = structuredClone(viewerModel);
    delete missingSplitAxis.geometry.l2.splitAxisY;
    assert.throws(
      () => adaptViewerData(missingSplitAxis, content),
      /l2\.splitAxisY/,
      'missing L2 splitAxisY must fail instead of falling back to Y0',
    );

    const graph = createViewerScene(viewerModel, createBaselineSceneRenderingDependencies());
    graph.scene.updateMatrixWorld(true);
    const genderDivider = graph.scene.getObjectByName('W-L2-GENDER-DIVIDER:Y8');
    assert.ok(genderDivider instanceof THREE.Mesh);
    assert.equal(genderDivider.position.z, 8);
    assert.equal(genderDivider.geometry.parameters.width, 9);

    const camera = new THREE.PerspectiveCamera(40, 676 / 622, 0.1, 500);
    camera.position.set(39, 29, 34);
    camera.lookAt(0, 3.3, 0);
    camera.updateMatrixWorld();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(
      ((850 - 258) / 676) * 2 - 1,
      -((390 - 66) / 622) * 2 + 1,
    ), camera);
    const firstBuildingHit = raycaster.intersectObject(graph.scene, true)
      .find(({ object }) => object.userData.entityId === 'F-L2-Y0-01'
        || object.name === 'W-L2-GENDER-DIVIDER:Y8');

    assert.ok(firstBuildingHit);
    assert.equal(firstBuildingHit.object.name, 'F-L2-Y0-01:GLASS');
    assert.equal(firstBuildingHit.object.material.name, 'SHARED-SAFETY-GLASS-FACADE-MATERIAL');
    assert.equal(firstBuildingHit.object.material.transparent, true);
    assert.equal(firstBuildingHit.object.material.opacity, 0.34);
    assert.equal(firstBuildingHit.object.userData.selectionOwner.userData.entityId, 'F-L2-Y0-01');
  } finally {
    await vite.close();
  }
});
