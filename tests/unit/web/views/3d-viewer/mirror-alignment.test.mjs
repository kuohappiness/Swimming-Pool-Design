// The 3D viewer builds the L3 mirror with Three.js transforms; solar analysis uses
// core/geometry/mirror-geometry. Both must put the mirror in the same SITE-XY place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
import { buildViewerModel } from '../../../../../core/viewer/viewer-data.mjs';
import { deriveMirrorGeometry } from '../../../../../core/geometry/mirror-geometry.mjs';
import { activeSolarStudyGeometry } from '../../../../../core/solar/solar-angle-analysis.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../..');

test('3D mirror wall sits where the solar analysis puts it', async () => {
  const [sourceModel, registry] = await Promise.all([
    readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
  ]);
  const vite = await createServer({
    root: resolve(repoRoot, 'web'),
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const [{ createViewerScene }, { createBaselineSceneRenderingDependencies }] = await Promise.all([
      vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts'),
      vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts'),
    ]);
    const graph = createViewerScene(buildViewerModel(sourceModel, registry), createBaselineSceneRenderingDependencies());
    graph.scene.updateMatrixWorld(true);
    const siteRoot = graph.scene.getObjectByName('SITE-XYZ-TO-THREE-RH');
    const rotation = graph.scene.getObjectByName('L3-PLAN-ROTATION');
    assert.ok(siteRoot && rotation);

    const study = activeSolarStudyGeometry(sourceModel);
    const halfLength = (study.endX - study.startX) / 2;
    const halfWidth = study.width / 2;
    const lean = study.mirrorHeight * Math.tan(study.mirrorLeanFromVertical * Math.PI / 180);
    // Mirror backing corners in the rotation group's local frame (see scene-factory).
    const local = {
      lower: [new THREE.Vector3(-halfLength, 0, -halfWidth), new THREE.Vector3(-halfLength, 0, halfWidth)],
      upper: [
        new THREE.Vector3(-halfLength - lean, study.mirrorHeight, -halfWidth),
        new THREE.Vector3(-halfLength - lean, study.mirrorHeight, halfWidth),
      ],
    };
    const worldToSite = siteRoot.matrixWorld.clone().invert();
    const toSite = (point) => {
      const site = point.clone().applyMatrix4(rotation.matrixWorld).applyMatrix4(worldToSite);
      return { x: site.x, y: site.z, z: site.y };
    };
    const expected = deriveMirrorGeometry({
      startX: study.startX,
      width: study.width,
      pivot: { x: study.pivotX, y: study.pivotY },
      planRotation: study.planRotation,
      leanFromVertical: study.mirrorLeanFromVertical,
      height: study.mirrorHeight,
      baseElevation: study.baseElevation,
      positiveXAxisBearingFromTrueNorth: sourceModel.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
    });
    for (const edge of ['lower', 'upper']) {
      local[edge].forEach((corner, index) => {
        const actual = toSite(corner);
        for (const axis of ['x', 'y', 'z']) {
          assert.ok(
            Math.abs(actual[axis] - expected[edge][index][axis]) < 1e-6,
            `${edge}[${index}].${axis}: 3D ${actual[axis]} vs analysis ${expected[edge][index][axis]}`,
          );
        }
      });
    }

    // 鏡面網格（rendering 換上倒影時找它）記錄的反光正面，和日照研究的鏡面法線同一個方向。
    const { MIRROR_FRONT_NORMAL_KEY, MIRROR_SURFACE_NAME } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/contracts.ts');
    const surface = siteRoot.getObjectByName(MIRROR_SURFACE_NAME);
    assert.ok(surface, 'the mirror surface can be found by name');
    assert.equal(surface.userData.batchExclude, true, 'kept out of static batching so its material can be changed');
    const front = new THREE.Vector3(...surface.userData[MIRROR_FRONT_NORMAL_KEY])
      .transformDirection(surface.matrixWorld)
      .transformDirection(worldToSite);
    const siteFront = { x: front.x, y: front.z, z: front.y };
    // 日照研究的鏡面：水平法線 normal 朝泳池，往下傾 lean（外傾牆的反光面朝下）。
    const leanRadians = study.mirrorLeanFromVertical * Math.PI / 180;
    const analysisFront = {
      x: expected.normal.x * Math.cos(leanRadians),
      y: expected.normal.y * Math.cos(leanRadians),
      z: -Math.sin(leanRadians),
    };
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(
        Math.abs(siteFront[axis] - analysisFront[axis]) < 1e-6,
        `front.${axis}: 3D ${siteFront[axis]} vs analysis ${analysisFront[axis]}`,
      );
    }
  } finally {
    await vite.close();
  }
});
