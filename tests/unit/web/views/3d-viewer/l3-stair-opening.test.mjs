// DEC-174：ST-02 穿過 3F 處開樓梯口，切開 2F 天花、旋轉的 3F 樓板與到達翼，教室側邊緣設防墜欄杆。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createWebModuleServer } from '../../../../support/web-modules.mjs';
import { buildViewerModel } from '../../../../../core/viewer/viewer-data.mjs';
import { deriveStairNosings } from '../../../../../core/geometry/stair-geometry.mjs';

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
  opening,
] = await Promise.all([
  vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/model-adapter.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/l3-stair-opening.ts'),
]);

const l3 = viewerModel.geometry.l3;
const stair = viewerModel.geometry.l2.stairToL3;
const ceiling = viewerModel.geometry.l2.ceiling;
const hole = l3.stairOpening.bounds;
const halfLength = l3.length / 2;
const halfWidth = l3.width / 2;
const sum = (pieces) => pieces.reduce((total, piece) => total + opening.polygonArea(piece), 0);
const plateRect = { x1: -halfLength, x2: halfLength, z1: -halfWidth, z2: halfWidth };

test('the cut floors keep the areas the model states', () => {
  const plate = opening.l3RectMinusStairOpening(l3, plateRect);
  assert.ok(
    Math.abs(sum(plate) - (l3.length * l3.width - l3.stairOpening.learningRoomOverlapArea)) < 0.002,
    `rotated 3F plate ${sum(plate).toFixed(3)} m²`,
  );
  const arrival = opening.subtractBounds(l3.arrivalWing.polygon, hole);
  assert.ok(Math.abs(sum(arrival) - l3.arrivalWing.walkableArea) < 0.002, 'arrival wing');
  const extension = opening.subtractBounds(l3.orthogonalExtension.polygon, hole);
  assert.ok(
    Math.abs(
      sum(extension) - (l3.orthogonalExtension.grossArea - l3.stairOpening.arrivalWingOverlapArea),
    ) < 0.002,
    'fixed extension',
  );
  const room = opening.l3RectMinusStairOpening(l3, {
    x1: -halfLength,
    x2: halfLength,
    z1: l3.learningRoom.bounds.y1 - l3.planPivot.y,
    z2: l3.learningRoom.bounds.y2 - l3.planPivot.y,
  });
  assert.ok(Math.abs(sum(room) - l3.learningRoom.netArea) < 0.002, 'learning room net area');
});

test('the slab around the opening is one closed solid without seams', () => {
  const geometry = opening.slabGeometry(opening.l3RectMinusStairOpening(l3, plateRect), -0.24, 0);
  // 每條邊都剛好被兩個三角形共用：拼接處沒有裂縫，也沒有藏在板裡的側面。
  const position = geometry.getAttribute('position');
  const key = (index) =>
    [position.getX(index), position.getY(index), position.getZ(index)]
      .map((value) => value.toFixed(5))
      .join(',');
  const edges = new Map();
  for (let index = 0; index < position.count; index += 3) {
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ]) {
      const edge = [key(index + a), key(index + b)].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.deepEqual(
    [...edges.values()].filter((count) => count !== 2),
    [],
    'every edge is shared by exactly two triangles',
  );
  // 混凝土的稜線（36°）只會出現在外緣：樓板的外框或樓梯口的邊，不會在拼接處多畫一條。
  const lines = new THREE.EdgesGeometry(geometry, 36).getAttribute('position');
  const onHoleEdge = ([x, y]) =>
    ((Math.abs(y - hole.y1) < 1e-6 || Math.abs(y - hole.y2) < 1e-6) &&
      x > hole.x1 - 1e-6 &&
      x < hole.x2 + 1e-6) ||
    (Math.abs(x - hole.x1) < 1e-6 && y > hole.y1 - 1e-6 && y < hole.y2 + 1e-6);
  for (let index = 0; index < lines.count; index += 2) {
    const x = (lines.getX(index) + lines.getX(index + 1)) / 2;
    const z = (lines.getZ(index) + lines.getZ(index + 1)) / 2;
    const onOutline =
      Math.abs(Math.abs(x) - halfLength) < 1e-6 || Math.abs(Math.abs(z) - halfWidth) < 1e-6;
    assert.ok(
      onOutline || onHoleEdge(opening.l3PlanToSite(l3, [x, z])),
      `edge line at x ${x.toFixed(3)}, z ${z.toFixed(3)} is a seam`,
    );
  }
});

function buildScene(batchStaticGeometry) {
  const rendering = createBaselineSceneRenderingDependencies();
  const graph = createViewerScene(viewerModel, rendering, { batchStaticGeometry });
  graph.scene.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  raycaster.camera = new THREE.PerspectiveCamera();
  /** 在 SITE 座標（X、高程、Y）打一條射線，回傳打到的點（也換回 SITE 座標）。 */
  const cast = (origin, direction) => {
    raycaster.set(
      new THREE.Vector3(...origin).applyMatrix4(graph.siteRoot.matrixWorld),
      new THREE.Vector3(...direction).transformDirection(graph.siteRoot.matrixWorld),
    );
    return raycaster
      .intersectObject(graph.siteRoot, true)
      .filter((hit) => hit.object.isMesh)
      .map((hit) => ({
        material: Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material,
        point: graph.siteRoot.worldToLocal(hit.point.clone()),
        object: hit.object,
      }));
  };
  return { graph, cast, material: (id) => rendering.materials.get(id) };
}

for (const batchStaticGeometry of [false, true]) {
  test(`every nosing of ST-02 keeps the required headroom (batched: ${batchStaticGeometry})`, () => {
    const { cast } = buildScene(batchStaticGeometry);
    const centreY = (stair.bounds.y1 + stair.bounds.y2) / 2;
    const nosings = deriveStairNosings(stair);
    assert.equal(nosings.length, stair.treadsPerRun.reduce((a, b) => a + b, 0) + 2);
    // 平台末端和下一跑的第一級在同一個 X，量較高的那一點（較低的那點淨高只會更多）。
    const measured = nosings.filter(
      (point) => !nosings.some((other) => other.x === point.x && other.z > point.z),
    );
    // 兩道梯梁在樓梯兩側，量梯梁內側的走行範圍。
    for (const { x, z } of measured) {
      for (const y of [centreY - 0.45, centreY, centreY + 0.45]) {
        const [above] = cast([x + 0.01, z + 0.05, y], [0, 1, 0]);
        const clear = above ? above.point.y - z : Infinity;
        assert.ok(
          clear >= l3.stairOpening.requiredHeadroom - 1e-3,
          `nosing at X${x.toFixed(3)} (+${z.toFixed(3)}), Y${y}: ${clear.toFixed(3)} m clear`,
        );
      }
    }
    // 樓梯口外（X34.85 以西）的淨高由 2F 天花板底決定，和模型的規則一致。
    const underside = ceiling.elevation - ceiling.thickness;
    const outside = measured.filter(({ x }) => x < hole.x1 - 0.05);
    assert.ok(outside.length > 0);
    for (const { x, z } of outside) {
      const [above] = cast([x + 0.01, z + 0.05, centreY], [0, 1, 0]);
      assert.ok(
        Math.abs(above.point.y - underside) < 1e-3,
        `X${x.toFixed(3)} under the 2F ceiling`,
      );
    }
  });

  test(`the opening cuts the 2F ceiling, the 3F slab and the arrival wing (batched: ${batchStaticGeometry})`, () => {
    const { graph, cast, material } = buildScene(batchStaticGeometry);
    const l2Material = material('exposed-concrete-l2');
    const l3Material = material('exposed-concrete-l3');
    // 從到達翼屋頂下方往下看：樓梯口裡第一個碰到的是樓梯，中間沒有天花、樓板或到達翼的地面。
    const deck = l3.baseElevation;
    const cutSurfaces = [
      l2Material,
      l3Material,
      material('l3-arrival'),
      material('l3-extension'),
      material('terrace'),
    ];
    for (const x of [hole.x1 + 0.3, (hole.x1 + hole.x2) / 2, hole.x2 - 0.3]) {
      for (const y of [hole.y1 + 0.2, (hole.y1 + hole.y2) / 2, hole.y2 - 0.2]) {
        const [first] = cast([x, deck + 2.6, y], [0, -1, 0]);
        assert.ok(
          !cutSurfaces.includes(first.material) && first.point.y <= deck,
          `X${x} Y${y}: first hit ${first.material.name} at +${first.point.y.toFixed(3)}`,
        );
      }
    }
    // 樓梯口外的旋轉樓板（教室的地面範圍鋪在上面）與到達翼地面還在。
    const plate = cast([hole.x1 - 0.5, deck + 1, 1.25], [0, -1, 0]);
    assert.equal(plate[0].material, material('program-zone'));
    assert.ok(
      plate.some(
        ({ material: hit, point }) => hit === l3Material && Math.abs(point.y - deck) < 1e-3,
      ),
    );
    const [landing] = cast([hole.x2 + 0.5, deck + 1, 1.25], [0, -1, 0]);
    assert.equal(landing.material, material('l3-arrival'));

    assert.equal(
      graph.selectables.filter(({ entityId }) => entityId === l3.stairOpening.entityId).length,
      1,
      'the opening is selectable once',
    );
  });

  test(`guardrails close the learning-room edges of the opening (batched: ${batchStaticGeometry})`, () => {
    const { cast, material } = buildScene(batchStaticGeometry);
    const glass = material('safety-glass');
    const deck = l3.baseElevation;
    // 從教室這一側往樓梯口走：Y2.0、X34.85、Y0.5 三邊都先碰到欄杆的玻璃。
    for (const [origin, direction] of [
      [
        [36.5, deck + 0.8, 2.8],
        [0, 0, -1],
      ],
      [
        [34.2, deck + 0.8, 1.25],
        [1, 0, 0],
      ],
      [
        [36.5, deck + 0.8, -0.3],
        [0, 0, 1],
      ],
    ]) {
      const [first] = cast(origin, direction);
      assert.equal(first.material, glass, `from ${origin} toward the opening`);
      const edge = direction[0] !== 0 ? first.point.x : first.point.z;
      const expected = direction[0] !== 0 ? hole.x1 : direction[2] < 0 ? hole.y2 : hole.y1;
      assert.ok(Math.abs(edge - expected) < 0.06, `guardrail at ${edge.toFixed(3)}`);
      // 欄杆上方是空的（示意高度），玻璃頂端加扶手。
      const over = cast(
        [origin[0], deck + opening.STAIR_OPENING_GUARDRAIL_HEIGHT + 0.1, origin[2]],
        direction,
      )[0];
      assert.ok(
        !over || Math.abs((direction[0] !== 0 ? over.point.x : over.point.z) - expected) > 0.5,
      );
    }
    // 樓梯頂端接到達翼的那一邊（X39.5）不設欄杆。
    const [top] = cast([hole.x2 + 0.6, deck + 0.8, 1.25], [-1, 0, 0]);
    assert.ok(!top || top.point.x < hole.x2 - 0.3, 'nothing at the stair top');
  });
}

test('the guardrail segments follow the model rule on the learning-room edges', () => {
  const roomRect = {
    x1: -halfLength,
    x2: halfLength - 0.18,
    z1: -halfWidth + 0.16,
    z2: l3.glassPartition.bounds.y1 - l3.planPivot.y,
  };
  const segments = opening.stairOpeningGuardrailSegments(l3, roomRect);
  assert.equal(segments.length, 3);
  const site = segments.map(({ from, to }) => [
    opening.l3PlanToSite(l3, from),
    opening.l3PlanToSite(l3, to),
  ]);
  const along = (axis, value) =>
    site.filter(([a, b]) => Math.abs(a[axis] - value) < 1e-6 && Math.abs(b[axis] - value) < 1e-6);
  assert.equal(along(1, hole.y1 - 0.025).length, 1, 'Y0.5 edge');
  assert.equal(along(1, hole.y2 + 0.025).length, 1, 'Y2.0 edge');
  assert.equal(along(0, hole.x1 - 0.025).length, 1, 'X34.85 edge');
});

test('the viewer refuses a stair opening that no longer follows DEC-174', () => {
  assert.doesNotThrow(() => adaptViewerData(viewerModel, content));
  for (const mutate of [
    (model) => {
      delete model.geometry.l3.stairOpening;
    },
    (model) => {
      model.geometry.l3.stairOpening.bounds.x2 = 38;
    },
    (model) => {
      model.geometry.l3.stairOpening.cutsEntityIds = ['L3-PLATE-01'];
    },
    (model) => {
      model.geometry.l3.stairOpening.edgeProtection = 'none';
    },
  ]) {
    const model = structuredClone(viewerModel);
    mutate(model);
    assert.throws(() => adaptViewerData(model, content), /DEC-174/);
  }
});
