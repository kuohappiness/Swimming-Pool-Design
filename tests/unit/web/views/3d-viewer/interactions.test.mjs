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
  { isRendered, owningSelectableIndex },
  { createViewerScene },
  { createBaselineSceneRenderingDependencies },
] = await Promise.all([
  vite.ssrLoadModule('/src/views/3d-viewer/interactions.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts'),
]);
test.after(async () => vite.close());

test('a hit on a detail mesh added after tagging still selects its building element', () => {
  const pool = new THREE.Group();
  const tagged = new THREE.Mesh();
  tagged.userData.selectionOwner = pool;
  const ladder = new THREE.Group();
  const rung = new THREE.Mesh();
  ladder.add(rung);
  pool.add(tagged, ladder);
  const stair = new THREE.Group();
  const tread = new THREE.Mesh();
  stair.add(tread);
  pool.add(stair);
  const unrelated = new THREE.Mesh();
  const index = new Map([
    [pool, 0],
    [stair, 1],
  ]);

  assert.equal(owningSelectableIndex(tagged, index), 0);
  assert.equal(
    owningSelectableIndex(rung, index),
    0,
    'untagged child resolves through its parents',
  );
  assert.equal(owningSelectableIndex(tread, index), 1, 'the innermost selectable wins');
  assert.equal(owningSelectableIndex(unrelated, index), -1);
});

test('objects inside a hidden layer are not considered rendered', () => {
  const layer = new THREE.Group();
  const wall = new THREE.Mesh();
  layer.add(wall);
  assert.equal(isRendered(wall), true);
  layer.visible = false;
  assert.equal(isRendered(wall), false);
  layer.visible = true;
  wall.visible = false;
  assert.equal(isRendered(wall), false);
});

test('every mesh and edge line of every selectable in the real scene resolves to a selectable', async () => {
  const [sourceModel, registry] = await Promise.all([
    readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
  ]);
  const graph = createViewerScene(
    buildViewerModel(sourceModel, registry),
    createBaselineSceneRenderingDependencies(),
  );
  const index = new Map(graph.selectables.map(({ object }, position) => [object, position]));
  const unresolved = [];
  for (const { object, entityId } of graph.selectables) {
    object.traverse((child) => {
      if ((child.isMesh || child.isLine) && owningSelectableIndex(child, index) < 0) {
        unresolved.push(`${entityId}/${child.name || child.type}`);
      }
    });
  }
  assert.deepEqual(unresolved, []);
});
