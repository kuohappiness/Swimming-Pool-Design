import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveReferenceGeometry } from '../scripts/reference-geometry.mjs';
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
  const derived = deriveReferenceGeometry(sourceModel);
  assert.equal(viewer.geometry.l2.startX, derived.l2StartX);
  assert.equal(viewer.geometry.l2.baseElevation, derived.l2Elevation);
  assert.equal(viewer.geometry.stair.totalRise, derived.stairTotalRise);
  assert.equal(viewer.geometry.roof.highElevation, derived.roofHighElevation);
  assert.equal(viewer.geometry.roof.lowElevation, derived.roofLowElevation);
  assert.deepEqual(viewer.geometry.l2.planPivot, {
    x: 19,
    y: 6.75,
    z: 4.5,
    status: 'working',
    strategy: 'l2-start-width-center',
    openItemId: 'OPEN-011',
  });
  assert.equal(viewer.geometry.mirror.performanceSurface, 'separate-analysis-assumption');
});

test('one canonical elevation change updates geometry, Viewer labels, content tokens, and stales analysis', () => {
  const baseline = buildViewerModel(clone());
  const analysisRegistry = { solar: { modelHash: baseline.modelHash, sourceIds: ['SRC-SITE-003'] } };
  assert.equal(buildViewerModel(clone(), analysisRegistry).analysis.solar.status, 'current');

  const model = clone();
  model.referenceSystem.levels.find((level) => level.id === 'L2').elevation = 4.8;
  const viewer = buildViewerModel(model, analysisRegistry);
  const content = compilePublicContent(markdown, model, manifest);
  assert.equal(viewer.geometry.l2.baseElevation, 4.8);
  assert.equal(viewer.geometry.stair.totalRise, 4.8);
  assert.equal(viewer.geometry.roof.highElevation, 4.8);
  assert.notEqual(viewer.geometry.roof.lowElevation, baseline.geometry.roof.lowElevation);
  assert.match(content.scenes.find((scene) => scene.id === 'rain').html, /\+4\.800 m/);
  assert.equal(viewer.analysis.solar.status, 'stale');
});

test('public content compiler validates all five stable scene IDs and resolves every token', () => {
  const content = compilePublicContent(markdown, clone(), manifest);
  assert.deepEqual(content.scenes.map((scene) => scene.id), ['overview', 'light', 'rain', 'people', 'time']);
  assert.doesNotMatch(JSON.stringify(content), /\{\{/);
  assert.match(content.scenes.find((scene) => scene.id === 'light').html, /9\.5°/);
  assert.match(content.scenes.find((scene) => scene.id === 'rain').html, /4\.5°/);
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

test('world, L2, and mirror transforms remain separated in the scene factory', () => {
  assert.equal((sceneFactorySource.match(/worldRoot\.rotation\.y\s*=/g) ?? []).length, 1);
  assert.equal((sceneFactorySource.match(/l2RotationGroup\.rotation\.y\s*=/g) ?? []).length, 1);
  assert.equal((sceneFactorySource.match(/mirrorMesh\.rotation/g) ?? []).length, 0);
  assert.match(sceneFactorySource, /leanOffset/);
});
