import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
import { buildViewerModel } from '../../../../../core/viewer/viewer-data.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../..');

test('L2 Y0 ray reaches glass first and the changing-room divider stays at Y8', async () => {
  const [sourceModel, registry, content] = await Promise.all([
    readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'web/src/generated/concept-content.json'), 'utf8').then(JSON.parse),
  ]);
  const vite = await createServer({
    root: resolve(repoRoot, 'web'),
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: { port: 0 } },
  });

  try {
    const [{ createViewerScene }, { adaptViewerData }, { createBaselineSceneRenderingDependencies }] = await Promise.all([
      vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts'),
      vite.ssrLoadModule('/src/views/3d-viewer/model-adapter.ts'),
      vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts'),
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

    const missingSiteLocation = structuredClone(viewerModel);
    delete missingSiteLocation.referenceSystem.siteLocation;
    assert.throws(
      () => adaptViewerData(missingSiteLocation, content),
      /siteLocation/,
      'a missing site location must fail instead of placing the sun at a made-up latitude',
    );

    const graph = createViewerScene(viewerModel, createBaselineSceneRenderingDependencies());
    graph.scene.updateMatrixWorld(true);
    const genderDivider = graph.scene.getObjectByName('W-L2-GENDER-DIVIDER:Y8');
    assert.ok(genderDivider instanceof THREE.Mesh);
    assert.equal(genderDivider.position.z, 8);
    assert.equal(genderDivider.geometry.parameters.width, 9);

    const raycaster = new THREE.Raycaster();
    const facade = graph.scene.getObjectByName('F-L2-Y0-01:GLASS');
    assert.ok(facade);
    const facadePosition = facade.getWorldPosition(new THREE.Vector3());
    const dividerPosition = genderDivider.getWorldPosition(new THREE.Vector3());
    const facadeToDivider = dividerPosition.sub(facadePosition).normalize();
    const rayOrigin = facadePosition.clone().addScaledVector(facadeToDivider, -10);
    raycaster.set(rayOrigin, facadeToDivider);
    const firstBuildingHit = raycaster.intersectObjects([facade, genderDivider], true)
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

test('307 degree compass bearing rotates local +X to northwest and derives true north at lower-right with an N label', async () => {
  const [sourceModel, registry, content] = await Promise.all([
    readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'web/src/generated/concept-content.json'), 'utf8').then(JSON.parse),
  ]);
  const vite = await createServer({
    root: resolve(repoRoot, 'web'),
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: { port: 0 } },
  });

  try {
    const [
      { createViewerScene },
      { adaptViewerData },
      { createBaselineSceneRenderingDependencies },
      { deriveViewerOrientation },
    ] = await Promise.all([
      vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts'),
      vite.ssrLoadModule('/src/views/3d-viewer/model-adapter.ts'),
      vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts'),
      vite.ssrLoadModule('/src/views/3d-viewer/orientation.ts'),
    ]);
    const viewerModel = buildViewerModel(sourceModel, registry);
    const model = adaptViewerData(viewerModel, content).model;
    const orientation = deriveViewerOrientation(model.referenceSystem);
    assert.equal(orientation.threeWorldRotationDegrees, 143);
    assert.equal(orientation.northPlanDirection, 'lower-right');
    assert.ok(orientation.northInSite.x > 0);
    assert.ok(orientation.northInSite.y < 0);

    const graph = createViewerScene(model, createBaselineSceneRenderingDependencies());
    graph.scene.updateMatrixWorld(true);
    assert.ok(Math.abs(THREE.MathUtils.radToDeg(graph.worldRoot.rotation.y) - 143) < 1e-9);

    const localAxis = graph.scene.getObjectByName('LOCAL-X-BEARING-307');
    const trueNorth = graph.scene.getObjectByName('TRUE-NORTH');
    const northLabel = graph.scene.getObjectByName('TRUE-NORTH-LABEL-N');
    assert.ok(localAxis);
    assert.ok(trueNorth);
    assert.ok(northLabel);
    assert.equal(northLabel.userData.label, 'N');
    assert.equal(trueNorth.userData.northPlanDirection, 'lower-right');
    // 方位標示留著，地面的參考格線已經移除（TASK-152 步驟 2）。
    graph.scene.traverse((object) => {
      assert.equal(object instanceof THREE.GridHelper, false, object.name);
    });

    const localAxisWorldDirection = new THREE.Vector3(0, 1, 0)
      .transformDirection(localAxis.matrixWorld);
    assert.ok(Math.abs(localAxisWorldDirection.x - Math.sin(THREE.MathUtils.degToRad(307))) < 1e-9);
    assert.ok(Math.abs(localAxisWorldDirection.z + Math.cos(THREE.MathUtils.degToRad(307))) < 1e-9);

    const northWorldDirection = new THREE.Vector3(0, 1, 0)
      .transformDirection(trueNorth.matrixWorld);
    assert.ok(Math.abs(northWorldDirection.x) < 1e-9);
    assert.ok(Math.abs(northWorldDirection.z + 1) < 1e-9);

    const brokenDirection = structuredClone(viewerModel);
    brokenDirection.referenceSystem.northArrowPlanDirection = 'upper-right';
    assert.throws(
      () => adaptViewerData(brokenDirection, content),
      /northArrowPlanDirection is forbidden/,
    );
  } finally {
    await vite.close();
  }
});

test('DEC-157 entry sits at ±0.00, its Y0-band pieces hide with the pool cutaway, and DEC-158 platform stays under water', async () => {
  const [sourceModel, registry] = await Promise.all([
    readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
  ]);
  const vite = await createServer({
    root: resolve(repoRoot, 'web'),
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: { port: 0 } },
  });
  try {
    const [{ createViewerScene }, { createBaselineSceneRenderingDependencies }] = await Promise.all([
      vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts'),
      vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts'),
    ]);
    const viewerModel = buildViewerModel(sourceModel, registry);
    const graph = createViewerScene(viewerModel, createBaselineSceneRenderingDependencies());
    graph.scene.updateMatrixWorld(true);
    const selected = new Set(graph.selectables.map(({ entityId }) => entityId));
    for (const entityId of [
      'Z-L1-ENTRY-01', 'RMP-L1-ENTRY-01', 'Z-L1-DRY-01', 'Z-L1-RINSE-01', 'Z-L1-ASSEMBLY-01',
      'FX-L1-LIFEGUARD-01', 'Z-L1-ACC-01', 'Z-L1-STAFF-01', 'Z-L1-EQUIP-01', 'FX-L1-LIFT-01', 'POOL-PLAT-01',
    ]) assert.ok(selected.has(entityId), `${entityId} must be selectable`);
    assert.equal(selected.has('Z-STOR-01'), false);

    const entryFloor = graph.siteRoot.getObjectByName('POOL-USE-ENTRY-FLOOR');
    const floorBox = new THREE.Box3().setFromObject(entryFloor);
    const floorTop = graph.siteRoot.worldToLocal(floorBox.max.clone()).y;
    assert.ok(Math.abs(floorTop - 0.005) < 1e-6, `vestibule floor top was ${floorTop}`);

    const hidden = new Set(graph.cutaway.hiddenObjects.map(({ name }) => name));
    assert.ok(hidden.has('CUTAWAY-HIDE-Y0-POOL-DECK'));
    assert.ok(hidden.has('CUTAWAY-HIDE-Y0-POOL-USE'));

    const platform = graph.siteRoot.getObjectByName('POOL-PLAT-01');
    const platformBox = new THREE.Box3().setFromObject(platform);
    const top = graph.siteRoot.worldToLocal(platformBox.max.clone()).y;
    const expectedTop = graph.water.surfaceElevation - viewerModel.geometry.pool.teachingPlatform.topWaterDepth;
    assert.ok(Math.abs(top - expectedTop) < 1e-6, `platform top was ${top}, expected ${expectedTop}`);
    assert.ok(top < graph.water.surfaceElevation);
  } finally {
    await vite.close();
  }
});
