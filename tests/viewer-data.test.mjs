import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildViewerModel } from '../scripts/viewer-data.mjs';
import { compilePublicContent, injectModelTokens } from '../scripts/build-public-content.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [modelText, markdown, manifestText, generatedModelText, generatedContentText, sceneFactorySource] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'docs/public/swimming-pool-renovation-design-concept.md'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/scene-manifest.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/generated/viewer-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/generated/concept-content.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/scene-factory.ts'), 'utf8'),
]);
const sourceModel = JSON.parse(modelText);
const manifest = JSON.parse(manifestText);
const clone = () => structuredClone(sourceModel);

test('Viewer package derives all major geometry from the canonical project model', () => {
  const viewer = buildViewerModel(clone());
  const study = sourceModel.geometry.solarReflection.v050Study;
  assert.equal(viewer.modelVersion, '0.5.0');
  assert.equal(viewer.geometry.building.length.value, study.site.totalLength);
  assert.equal(viewer.geometry.building.width.value, study.site.l1Width);
  assert.equal(viewer.geometry.pool.deckElevation.value, study.levels.poolDeckElevation);
  assert.equal(viewer.geometry.l2.startX, study.floorPlate.poolSideX);
  assert.equal(viewer.geometry.l2.baseElevation, study.levels.l2Elevation);
  assert.equal(viewer.geometry.l3.baseElevation, study.levels.l3Elevation);
  assert.equal(viewer.geometry.l3.planRotation.value, study.optimization.planRotation.value);
  assert.equal(viewer.geometry.stair.totalRise, study.stairFromRaisedPoolDeck.totalRise);
  assert.equal(viewer.geometry.roof.highElevation, study.roofInterface.highElevation);
  assert.equal(viewer.geometry.roof.lowElevation, study.roofInterface.lowElevation);
  assert.deepEqual(viewer.geometry.l2.planPivot, {
    x: 35,
    y: 6.75,
    z: 3.3,
    status: 'working',
    strategy: 'fixed-floor-plate-centroid',
    openItemId: 'OPEN-016',
  });
  assert.equal(viewer.geometry.l3.mirror.wallAndMirrorCoplanar, true);
  assert.equal(viewer.geometry.l3.mirror.leanFromVertical.value, 3.1);
});

test('one active 0.5.0 elevation change updates Viewer geometry and stales analysis', () => {
  const baseline = buildViewerModel(clone());
  const analysisRegistry = { solar: { modelHash: baseline.modelHash, sourceIds: ['SRC-SITE-003'] } };
  assert.equal(buildViewerModel(clone(), analysisRegistry).analysis.solar.status, 'current');

  const model = clone();
  model.geometry.solarReflection.v050Study.levels.l2Elevation = 3.4;
  model.geometry.solarReflection.v050Study.levels.l1FloorToFloor = 3.4;
  const viewer = buildViewerModel(model, analysisRegistry);
  assert.equal(viewer.geometry.l2.baseElevation, 3.4);
  assert.equal(viewer.geometry.l3.baseElevation, baseline.geometry.l3.baseElevation);
  assert.equal(viewer.analysis.solar.status, 'stale');
});

test('public content compiler validates all five stable scene IDs and resolves every token', () => {
  const content = compilePublicContent(markdown, clone(), manifest);
  assert.deepEqual(content.scenes.map((scene) => scene.id), ['overview', 'light', 'rain', 'people', 'time']);
  assert.doesNotMatch(JSON.stringify(content), /\{\{/);
  assert.match(content.scenes.find((scene) => scene.id === 'light').html, /26\.5°/);
  assert.match(content.scenes.find((scene) => scene.id === 'rain').html, /5°/);
  assert.match(content.scenes.find((scene) => scene.id === 'people').html, /\+0\.300 m/);
});

test('public content compiler rejects unknown scenes and unresolved model paths', () => {
  assert.throws(
    () => compilePublicContent(markdown.replace('scene:light', 'scene:glare'), clone(), manifest),
    /unknown scene ID: glare/,
  );
  assert.throws(
    () => injectModelTokens('{{model:geometry.roof.missing|metre}}', clone()),
    /token path does not exist/,
  );
});

test('generated Viewer and public content artifacts share the current model hash', () => {
  const generatedModel = JSON.parse(generatedModelText);
  const generatedContent = JSON.parse(generatedContentText);
  const rebuilt = buildViewerModel(clone());
  assert.equal(generatedModel.modelHash, rebuilt.modelHash);
  assert.equal(generatedContent.modelHash, rebuilt.modelHash);
  assert.equal(generatedModel.modelVersion, sourceModel.modelVersion);
  assert.equal(generatedModel.analysis.solar.status, 'current');
});

test('world, L3, and coplanar mirror transforms remain separated in the scene factory', () => {
  assert.equal((sceneFactorySource.match(/worldRoot\.rotation\.y\s*=/g) ?? []).length, 1);
  assert.equal((sceneFactorySource.match(/l3RotationGroup\.rotation\.y\s*=/g) ?? []).length, 1);
  assert.equal((sceneFactorySource.match(/mirrorMesh\.rotation/g) ?? []).length, 0);
  assert.match(sceneFactorySource, /leanOffset/);
  assert.match(sceneFactorySource, /wallAndMirrorCoplanar|0\.012/);
});
