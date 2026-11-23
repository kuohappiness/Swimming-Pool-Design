// DEC-173：3F 以隔音玻璃分成觀課與環境教育室和設備區，三者隨 3F 樓板旋轉；
// DEC-174：ST-02 的樓梯口切過教室靠端牆那一角。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createWebModuleServer } from '../../../../support/web-modules.mjs';
import { buildViewerModel } from '../../../../../core/viewer/viewer-data.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../..');
const [sourceModel, registry, content] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, 'web/src/generated/concept-content.json'), 'utf8').then(JSON.parse),
]);
const viewerModel = buildViewerModel(sourceModel, registry);
const vite = await createWebModuleServer();
test.after(async () => vite.close());
const [
  { createViewerScene },
  { createBaselineSceneRenderingDependencies },
  { adaptViewerData },
  { L3_LEARNING_ROOM_FURNITURE_NAME, arrivalContactOnEndWall },
  { l3RectWithinStairOpening, siteToL3Plan },
] = await Promise.all([
  vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/model-adapter.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/l3-learning-room.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/l3-stair-opening.ts'),
]);

const l3 = viewerModel.geometry.l3;
const halfLength = l3.length / 2;
const lean = Math.tan((l3.mirror.leanFromVertical.value * Math.PI) / 180);
const partitionZ = (l3.glassPartition.bounds.y1 + l3.glassPartition.bounds.y2) / 2 - l3.planPivot.y;
const local = (x, y) => [x - l3.planPivot.x, y - l3.planPivot.y];

function buildScene(batchStaticGeometry) {
  const rendering = createBaselineSceneRenderingDependencies();
  const graph = createViewerScene(viewerModel, rendering, { batchStaticGeometry });
  graph.scene.updateMatrixWorld(true);
  const frame = graph.siteRoot.getObjectByName('L3-PLAN-ROTATION');
  assert.ok(frame, 'the 3F rotation group');
  const raycaster = new THREE.Raycaster();
  raycaster.camera = new THREE.PerspectiveCamera();
  /** 在 3F 旋轉群組的座標裡打一條射線，回傳打到的東西（點也換回群組座標）。 */
  const cast = (origin, direction) => {
    const worldOrigin = new THREE.Vector3(...origin).applyMatrix4(frame.matrixWorld);
    const worldDirection = new THREE.Vector3(...direction).transformDirection(frame.matrixWorld);
    raycaster.set(worldOrigin, worldDirection);
    return raycaster.intersectObject(graph.siteRoot, true).map((hit) => ({
      material: Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material,
      point: frame.worldToLocal(hit.point.clone()),
      object: hit.object,
    }));
  };
  return { graph, frame, cast, material: (id) => rendering.materials.get(id) };
}

for (const batchStaticGeometry of [false, true]) {
  test(`the learning room has no fixed partition and the glass sits at Y5.5 (batched: ${batchStaticGeometry})`, () => {
    const { graph, cast, material } = buildScene(batchStaticGeometry);
    const concrete = material('exposed-concrete-l3');
    const glass = material('safety-glass');
    const equipment = material('equipment');

    for (const id of [
      l3.learningRoom.entityId,
      l3.equipmentZone.entityId,
      l3.glassPartition.entityId,
    ]) {
      assert.equal(
        graph.selectables.filter(({ entityId }) => entityId === id).length,
        1,
        `${id} is selectable once`,
      );
    }

    // 從端牆往鏡牆橫掃整間教室：一路上沒有清水模，第一道就是外傾鏡牆的內面。
    for (const z of [-6.3, -5, -3.5, -2, -1.45]) {
      const wall = cast([halfLength - 0.3, 1.5, z], [-1, 0, 0]).find(
        (hit) => hit.material === concrete,
      );
      assert.ok(wall, `ray at z ${z} reaches the mirror wall`);
      assert.ok(
        Math.abs(wall.point.x - (-halfLength - 1.5 * lean)) < 0.02,
        `first concrete at x ${wall.point.x.toFixed(3)} (z ${z})`,
      );
    }
    // 教室裡沒有設備：貼著玻璃（教室那一側）在設備高度橫掃，打不到設備。
    assert.equal(
      cast([halfLength - 0.3, 0.9, partitionZ - 0.12], [-1, 0, 0]).some(
        (hit) => hit.material === equipment,
      ),
      false,
    );

    // 從教室往設備區看：先穿過隔音玻璃（Y5.5），水塔在玻璃後面。
    const [tankX] = local(34, 6.8);
    const towardEquipment = cast([tankX, 0.9, -3], [0, 0, 1]);
    const pane = towardEquipment.find((hit) => hit.material === glass);
    const tank = towardEquipment.find((hit) => hit.material === equipment);
    assert.ok(pane && tank);
    assert.ok(
      Math.abs(pane.point.z - (partitionZ - 0.015)) < 0.005,
      `glass at z ${pane.point.z.toFixed(3)}`,
    );
    assert.ok(
      tank.point.z > l3.glassPartition.bounds.y2 - l3.planPivot.y,
      `tank behind the glass at z ${tank.point.z.toFixed(3)}`,
    );
    assert.ok(towardEquipment.indexOf(pane) < towardEquipment.indexOf(tank));
  });

  test(`the room is entered from the arrival wing beside the stair opening; the maintenance door matches the 3F plan (batched: ${batchStaticGeometry})`, () => {
    const { cast, material } = buildScene(batchStaticGeometry);
    const concrete = material('exposed-concrete-l3');
    // 樓梯口斜斜跨過端牆：那一段下面沒有樓板，牆只留到達翼屋頂以上，門也拿掉了。
    const endWall = l3RectWithinStairOpening(l3, {
      x1: halfLength - 0.18,
      x2: halfLength,
      z1: -l3.width / 2,
      z2: l3.width / 2,
    });
    const gapZ = endWall.map(([, z]) => z);
    const [gapZ1, gapZ2] = [Math.min(...gapZ), Math.max(...gapZ)];
    assert.ok(
      gapZ2 - gapZ1 > 1.5,
      `the opening crosses the end wall over ${(gapZ2 - gapZ1).toFixed(3)} m`,
    );
    const endWallHit = (z, y) =>
      cast([halfLength + 0.5, y, z], [-1, 0, 0]).find((hit) => hit.point.x < halfLength + 0.05);
    const middle = (gapZ1 + gapZ2) / 2;
    const below = endWallHit(middle, 1);
    assert.ok(below.point.x < halfLength - 0.5, 'no wall and no door where the opening crosses it');
    assert.notEqual(below.material, material('opening-marker'));
    const lintel = endWallHit(middle, 3.2);
    assert.equal(lintel.material, concrete, 'the wall continues above the arrival-wing roof');
    assert.ok(Math.abs(lintel.point.x - halfLength) < 0.005);
    // 教室門在模型 entryDoor 那一段端牆的中間（樓梯口外、玻璃隔間前，DEC-175）。
    const door = material('opening-marker');
    const [contactZ1, contactZ2] = arrivalContactOnEndWall(l3);
    assert.ok(contactZ1 >= gapZ2 - 0.1 && contactZ2 <= partitionZ, 'door beside the opening');
    const entry = endWallHit((contactZ1 + contactZ2) / 2, 1);
    assert.equal(entry.material, door);
    assert.ok(Math.abs(entry.point.x - (halfLength + 0.02)) < 0.005);
    for (const z of [gapZ1 - 0.5, contactZ2 + 0.5]) {
      const solid = endWallHit(z, 1);
      assert.equal(solid.material, concrete, `the rest of the end wall stays solid (z ${z})`);
      assert.ok(Math.abs(solid.point.x - halfLength) < 0.005);
    }

    // 維修門在旋轉前 X39.5～X40.5（3F 平面圖），其餘是玻璃；從樓梯口和玻璃之間的教室地面看過去。
    const [doorX] = local(40, 0);
    const besideGlass = partitionZ - 0.9;
    assert.equal(cast([doorX, 1, besideGlass], [0, 0, 1])[0].material, door);
    assert.equal(
      cast([doorX, 2.6, besideGlass], [0, 0, 1])[0].material,
      material('safety-glass'),
      'glass above the door',
    );
    assert.equal(
      cast([local(38.5, 0)[0], 1, besideGlass], [0, 0, 1])[0].material,
      material('safety-glass'),
    );
  });
}

test('the learning-room furniture is movable, visual only, and stays inside the room', () => {
  const { graph, frame } = buildScene(false);
  const furniture = graph.siteRoot.getObjectByName(L3_LEARNING_ROOM_FURNITURE_NAME);
  assert.ok(furniture);
  assert.equal(furniture.parent, frame, 'furniture rotates with the 3F floor');
  assert.equal(furniture.userData.visualOnly, true);
  assert.equal(furniture.userData.collisionExcluded, true);
  assert.equal(furniture.userData.minimumVisualDetail, 'reduced');
  const stools = furniture.children.find(({ name }) =>
    name.startsWith('visual-only:L3-learning-room-stools:'),
  );
  assert.equal(stools.count, 16, 'about half a class (15 seats) and the teacher');
  // 桌椅都在樓梯口西側，離洞口邊（欄杆）至少 0.6 m。
  const holeWestX = Math.min(
    ...[
      [l3.stairOpening.bounds.x1, l3.stairOpening.bounds.y1],
      [l3.stairOpening.bounds.x1, l3.stairOpening.bounds.y2],
    ].map((point) => siteToL3Plan(l3, point)[0]),
  );
  const box = new THREE.Box3();
  const roomBox = new THREE.Box3(
    new THREE.Vector3(-halfLength, -0.001, l3.learningRoom.bounds.y1 - l3.planPivot.y),
    new THREE.Vector3(halfLength, 3, l3.glassPartition.bounds.y1 - l3.planPivot.y),
  );
  for (const mesh of furniture.children) {
    mesh.computeBoundingBox();
    box.copy(mesh.boundingBox).applyMatrix4(mesh.matrix);
    assert.ok(
      roomBox.containsBox(box),
      `${mesh.name} stays in the learning room: ${JSON.stringify(box)}`,
    );
    assert.ok(box.max.x < holeWestX - 0.6, `${mesh.name} keeps clear of the stair opening`);
  }
});

test('the viewer refuses a 3F split that no longer follows DEC-173', () => {
  assert.doesNotThrow(() => adaptViewerData(viewerModel, content));
  for (const mutate of [
    (model) => {
      model.geometry.l3.learningRoom.entryFrom = model.geometry.l3.equipmentZone.entityId;
    },
    (model) => {
      model.geometry.l3.glassPartition.rotation = 0;
    },
    (model) => {
      model.geometry.l3.programStrategy.wholeClassUse = true;
    },
    (model) => {
      delete model.geometry.l3.glassPartition;
    },
  ]) {
    const model = structuredClone(viewerModel);
    mutate(model);
    assert.throws(() => adaptViewerData(model, content), /DEC-173/);
  }
});
