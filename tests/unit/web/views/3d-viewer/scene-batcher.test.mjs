import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createWebModuleServer } from '../../../../support/web-modules.mjs';
import { buildViewerModel } from '../../../../../core/viewer/viewer-data.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../..');
const vite = await createWebModuleServer();
const [
  { batchStaticMeshes, renderCategoryOf, RENDER_CATEGORY_LAYERS },
  { owningSelectableIndex },
  { createViewerScene },
  { createBaselineSceneRenderingDependencies },
] = await Promise.all([
  vite.ssrLoadModule('/src/views/3d-viewer/scene-batcher.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/interactions.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts'),
]);
test.after(async () => vite.close());

const [sourceModel, registry] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
]);
const viewerModel = buildViewerModel(sourceModel, registry);
const buildScene = (batchStaticGeometry) =>
  createViewerScene(viewerModel, createBaselineSceneRenderingDependencies(), {
    batchStaticGeometry,
  });

const DETAIL_RANK = { essential: 0, reduced: 1, full: 2 };

const TOLERANCE = 1e-4;
const compareCorner = (a, b) => {
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(a[axis] - b[axis]) > TOLERANCE) return a[axis] - b[axis];
  }
  return 0;
};

/**
 * Every triangle in world space, labelled with everything that decides when it
 * is drawn and what it selects: owner, model layer, cutaway object, detail
 * level and material name. Corners keep their order (rotated so the smallest
 * corner comes first), so a flipped winding shows up as a different triangle.
 */
function triangles(graph) {
  graph.scene.updateMatrixWorld(true);
  const index = new Map(graph.selectables.map(({ object }, position) => [object, position]));
  const cutaway = new Map(
    graph.cutaway.hiddenObjects.map((object, position) => [object, position]),
  );
  const result = new Map();
  const corner = new THREE.Vector3();
  graph.siteRoot.traverse((object) => {
    if (!object.isMesh) return;
    let layerId = '';
    let cutawayIndex = -1;
    let detailRank = -1;
    for (let current = object; current; current = current.parent) {
      if (!layerId && current.userData.layerId) layerId = current.userData.layerId;
      if (cutawayIndex < 0 && cutaway.has(current)) cutawayIndex = cutaway.get(current);
      const level = current.userData.minimumVisualDetail;
      if (level) detailRank = Math.max(detailRank, DETAIL_RANK[level]);
    }
    const geometry = object.geometry;
    const position = geometry.getAttribute('position');
    const vertexAt = (i) => (geometry.index ? geometry.index.getX(i) : i);
    const count = geometry.index ? geometry.index.count : position.count;
    const faceOwners = object.userData.faceOwners;
    const material = object.material.name || object.material.type;
    for (let triangle = 0; triangle * 3 + 2 < count; triangle += 1) {
      const owner = faceOwners ? faceOwners[triangle] : owningSelectableIndex(object, index);
      const corners = [0, 1, 2].map((offset) => {
        corner
          .fromBufferAttribute(position, vertexAt(triangle * 3 + offset))
          .applyMatrix4(object.matrixWorld);
        return [corner.x, corner.y, corner.z];
      });
      let start = 0;
      for (let candidate = 1; candidate < 3; candidate += 1) {
        if (compareCorner(corners[candidate], corners[start]) < 0) start = candidate;
      }
      const ordered = [0, 1, 2].map((offset) => corners[(start + offset) % 3]);
      const meta = [owner, layerId, cutawayIndex, detailRank, material].join('|');
      if (!result.has(meta)) result.set(meta, []);
      result.get(meta).push(ordered);
    }
  });
  return result;
}

const sameTriangle = (a, b) =>
  a.every((corner, position) => compareCorner(corner, b[position]) === 0);

/** Greedy tolerant multiset comparison; returns a few unmatched triangles per side. */
function unmatchedTriangles(before, after) {
  const problems = [];
  for (const meta of new Set([...before.keys(), ...after.keys()])) {
    const left = [...(before.get(meta) ?? [])].sort((a, b) => a[0][0] - b[0][0]);
    const right = [...(after.get(meta) ?? [])].sort((a, b) => a[0][0] - b[0][0]);
    const used = new Uint8Array(right.length);
    let windowStart = 0;
    for (const triangle of left) {
      while (windowStart < right.length && right[windowStart][0][0] < triangle[0][0] - TOLERANCE)
        windowStart += 1;
      let match = -1;
      for (let candidate = windowStart; candidate < right.length; candidate += 1) {
        if (right[candidate][0][0] > triangle[0][0] + TOLERANCE) break;
        if (!used[candidate] && sameTriangle(triangle, right[candidate])) {
          match = candidate;
          break;
        }
      }
      if (match < 0) problems.push(`missing ${meta} ${JSON.stringify(triangle)}`);
      else used[match] = 1;
    }
    right.forEach((triangle, position) => {
      if (!used[position]) problems.push(`extra ${meta} ${JSON.stringify(triangle)}`);
    });
    if (problems.length > 8) break;
  }
  return problems.slice(0, 8);
}

test('static batching keeps every triangle, its owner, layer, cutaway group, detail level and winding', () => {
  const plain = buildScene(false);
  const batched = buildScene(true);
  assert.equal(plain.staticBatch, null);
  const before = triangles(plain);
  const after = triangles(batched);
  const total = (map) => [...map.values()].reduce((sum, list) => sum + list.length, 0);
  assert.equal(total(after), total(before), 'triangle count changed');
  assert.deepEqual(unmatchedTriangles(before, after), []);
});

test('static batching cuts the mesh count and leaves looked-up objects alone', () => {
  const graph = buildScene(true);
  const { sourceMeshes, meshesAfter, batches } = graph.staticBatch;
  assert.ok(batches > 0);
  assert.ok(
    meshesAfter * 4 < sourceMeshes,
    `expected at least 4× fewer meshes, got ${sourceMeshes} → ${meshesAfter}`,
  );
  assert.equal(graph.siteRoot.getObjectByName('POOL-01-WATER-SURFACE'), graph.water.surface);
  assert.ok(graph.siteRoot.getObjectByName('CUTAWAY-HIDE-SITE-GROUND')?.isMesh);
  const caustics = [];
  graph.siteRoot.traverse((object) => {
    if (object.name.startsWith('visual-only:POOL-01-caustic:')) caustics.push(object);
  });
  assert.ok(
    caustics.length > 0 && caustics.every((object) => object.isMesh && !object.userData.batched),
  );
  for (const object of graph.cutaway.hiddenObjects) {
    assert.ok(object.parent, `${object.name} must stay in the scene for the cutaway toggle`);
  }
});

test('every selectable can still be picked and framed after batching', () => {
  const graph = buildScene(true);
  const owned = new Set();
  graph.siteRoot.traverse((object) => {
    if (!object.isMesh) return;
    if (object.userData.faceOwners) {
      for (const owner of object.userData.faceOwners) owned.add(owner);
    }
  });
  const index = new Map(graph.selectables.map(({ object }, position) => [object, position]));
  graph.siteRoot.traverse((object) => {
    if (object.isMesh && !object.userData.faceOwners)
      owned.add(owningSelectableIndex(object, index));
  });
  const plain = buildScene(false);
  const expected = new Set();
  const plainIndex = new Map(plain.selectables.map(({ object }, position) => [object, position]));
  plain.siteRoot.traverse((object) => {
    if (object.isMesh) expected.add(owningSelectableIndex(object, plainIndex));
  });
  assert.deepEqual(
    [...owned].sort((a, b) => a - b),
    [...expected].sort((a, b) => a - b),
  );
  for (const selectable of graph.selectables) {
    assert.ok(
      selectable.bounds instanceof THREE.Box3,
      `${selectable.entityId} has no frame bounds`,
    );
  }
  const plainBounds = plain.selectables.map(({ bounds }) => bounds);
  graph.selectables.forEach(({ bounds, entityId }, position) => {
    assert.ok(bounds.equals(plainBounds[position]), `${entityId} frame bounds changed`);
  });
});

test('a merged triangle resolves to its own owner, not to the batch', () => {
  const owners = new Int32Array([2, 2, 5, -1]);
  const batch = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  batch.userData.faceOwners = owners;
  assert.equal(owningSelectableIndex(batch, new Map(), 0), 2);
  assert.equal(owningSelectableIndex(batch, new Map(), 2), 5);
  assert.equal(owningSelectableIndex(batch, new Map(), 3), -1);
  assert.equal(owningSelectableIndex(batch, new Map(), undefined), -1);
  assert.equal(owningSelectableIndex(batch, new Map(), 9), -1);
});

test('a mirrored transform keeps front faces facing outwards', () => {
  const root = new THREE.Group();
  const unit = new THREE.Group();
  const mirrored = new THREE.Group();
  mirrored.scale.set(1, 1, -1);
  const material = new THREE.MeshStandardMaterial({ name: 'test:concrete' });
  const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const second = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  second.position.set(3, 0, 2);
  mirrored.add(first, second);
  unit.add(mirrored);
  root.add(unit);
  batchStaticMeshes(root, { toggleUnits: [unit], exclude: [], selectionOwners: [] });
  const [batch] = unit.children.filter((child) => child.userData.batched);
  assert.ok(batch, 'the two boxes must merge');
  const position = batch.geometry.getAttribute('position');
  const normal = batch.geometry.getAttribute('normal');
  const [a, b, c, n] = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    a.fromBufferAttribute(position, vertex);
    b.fromBufferAttribute(position, vertex + 1);
    c.fromBufferAttribute(position, vertex + 2);
    n.fromBufferAttribute(normal, vertex);
    const faceNormal = b.sub(a).cross(c.sub(a)).normalize();
    assert.ok(faceNormal.dot(n) > 0.99, `triangle ${vertex / 3} winding disagrees with its normal`);
  }
});

test('merging never crosses a toggle unit, a material or a detail level', () => {
  const root = new THREE.Group();
  const layerA = new THREE.Group();
  const layerB = new THREE.Group();
  root.add(layerA, layerB);
  const concrete = new THREE.MeshStandardMaterial({ name: 'test:concrete' });
  const steel = new THREE.MeshStandardMaterial({ name: 'test:steel' });
  const add = (parent, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    parent.add(mesh);
    return mesh;
  };
  add(layerA, concrete);
  add(layerA, concrete);
  add(layerA, steel);
  add(layerB, concrete);
  add(layerB, concrete);
  const fixture = new THREE.Group();
  fixture.userData = { visualOnly: true, collisionExcluded: true, minimumVisualDetail: 'full' };
  fixture.visible = false;
  layerB.add(fixture);
  add(fixture, concrete);
  add(fixture, concrete);
  const report = batchStaticMeshes(root, {
    toggleUnits: [layerA, layerB],
    exclude: [],
    selectionOwners: [],
  });
  assert.equal(report.batches, 3);
  const batchesIn = (parent) => parent.children.filter((child) => child.userData.batched);
  assert.equal(batchesIn(layerA).length, 1);
  assert.equal(batchesIn(layerB).length, 1);
  const container = layerB.children.find((child) => child.userData.batchContainer);
  assert.equal(container.userData.minimumVisualDetail, 'full');
  assert.equal(container.visible, false, 'a full-detail container starts hidden like its source');
  assert.equal(batchesIn(container).length, 1);
  assert.equal(
    layerA.children.filter((child) => child.isMesh && child.material === steel).length,
    1,
  );
});

test('render categories come from the material unless set explicitly', () => {
  const mesh = (name, options = {}) =>
    new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ name, ...options }),
    );
  assert.equal(renderCategoryOf(mesh('enhanced:roof-glass')), 'glass');
  assert.equal(renderCategoryOf(mesh('SHARED-SAFETY-GLASS-FACADE-MATERIAL')), 'glass');
  assert.equal(renderCategoryOf(mesh('baseline:mirror')), 'mirror');
  assert.equal(renderCategoryOf(mesh('baseline:water')), 'water-surface');
  assert.equal(
    renderCategoryOf(mesh('baseline:interior-light', { emissive: 0xffe9bd })),
    'emissive-fixture',
  );
  assert.equal(renderCategoryOf(mesh('baseline:exposed-concrete-l1')), 'structure');
  const tree = mesh('baseline:exposed-concrete-l1');
  const group = new THREE.Group();
  group.userData.renderCategory = 'vegetation';
  group.add(tree);
  assert.equal(renderCategoryOf(tree), 'vegetation');
  group.userData.renderCategory = 'shrubbery';
  assert.throws(() => renderCategoryOf(tree), /Unknown render category/);
});

test('every mesh keeps layer 0 and gains exactly its category layer', () => {
  const graph = buildScene(true);
  graph.siteRoot.traverse((object) => {
    if (!object.isMesh) return;
    const category = object.userData.renderCategory;
    assert.ok(category in RENDER_CATEGORY_LAYERS, `${object.name} has no render category`);
    const expected = (1 | (1 << RENDER_CATEGORY_LAYERS[category])) >>> 0;
    assert.equal(object.layers.mask >>> 0, expected, `${object.name} layer mask`);
  });
  assert.equal(graph.water.surface.userData.renderCategory, 'water-surface');
});
