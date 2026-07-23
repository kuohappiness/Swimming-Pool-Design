import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildViewerModel } from '../scripts/viewer-data.mjs';
import { compilePublicContent, injectModelTokens } from '../scripts/build-public-content.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [modelText, registryText, markdown, manifestText, generatedModelText, generatedContentText, sceneFactorySource, viewerHtml, solarHtml] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8'),
  readFile(resolve(repoRoot, 'docs/public/swimming-pool-renovation-design-concept.md'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/scene-manifest.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/generated/viewer-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/generated/concept-content.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/scene-factory.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/3d-viewer/index.html'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/solar-study/index.html'), 'utf8'),
]);
const sourceModel = JSON.parse(modelText);
const registry = JSON.parse(registryText);
const manifest = JSON.parse(manifestText);
const clone = () => structuredClone(sourceModel);

test('Viewer package derives all major geometry from GEO-0.6.3', () => {
  const viewer = buildViewerModel(clone(), registry);
  assert.equal(viewer.schemaVersion, '1.3.0');
  assert.equal(viewer.modelVersion, '0.6.3');
  assert.equal(viewer.activeGeometryRevisionId, 'GEO-0.6.3');
  assert.equal(viewer.coordinateSystemId, 'SITE-XY');
  assert.equal(viewer.geometry.site.length, 41);
  assert.equal(viewer.geometry.site.width, 14);
  assert.deepEqual(viewer.geometry.pool.bounds, { x1: 3, x2: 28, y1: 4, y2: 12.5 });
  assert.equal(viewer.geometry.pool.length.value, 25);
  assert.equal(viewer.geometry.pool.width.value, 8.5);
  assert.equal(viewer.geometry.l2.startX, 29);
  assert.equal(viewer.geometry.l3.planRotation.value, 25.5);
  assert.equal(viewer.geometry.l3.mirror.leanFromVertical.value, 23);
  assert.deepEqual(viewer.geometry.stair.bounds, { x1: 20.5, x2: 29, y1: 0.5, y2: 2 });
  assert.equal(viewer.referenceSystem.coordinateAdapter.siteY, 'negativeThreeZ');
  assert.equal(viewer.referenceSystem.coordinateAdapter.adapterId, 'SITE-XYZ-TO-THREE-RH');
  assert.equal('originY' in viewer.geometry.stair, false);
  assert.equal('startX' in viewer.geometry.stair, false);
  assert.equal(viewer.geometry.stair.midLandingLength, 3.1);
  assert.equal(viewer.geometry.stair.designIntent, 'suspended-floating-stair');
  assert.equal(viewer.geometry.stair.stringerCount, 2);
  assert.equal(viewer.geometry.stair.underStairEnclosure, false);
  assert.equal(viewer.geometry.l1.toiletEntrances.length, 4);
  assert.ok(viewer.geometry.l1.toiletEntrances.every(({ clearWidth, doorLeaf }) => clearWidth === 1 && doorLeaf === false));
  assert.equal(viewer.geometry.l1.zones.poolFemaleToilet.layout.washbasinWall, 'y7.5');
  assert.ok(Object.values(viewer.geometry.l1.zones).filter(({ layout }) => layout).every(({ privacyScreen, layout }) => privacyScreen === false && layout.privacyScreen === undefined));
  assert.equal(viewer.geometry.l2.zones.maleChangingShower.showerCubicles.length, 15);
  assert.equal(viewer.geometry.l2.zones.femaleChangingShower.showerCubicles.length, 15);
  assert.deepEqual(viewer.geometry.l2.zones.maleChangingShower.showerModuleSize, [1.2, 1.2]);
  assert.deepEqual(viewer.geometry.l2.zones.maleChangingShower.supportFixtures.fixtures, { toilets: 1, washbasins: 2 });
  assert.equal(viewer.geometry.l2.circulationZone.area, 41.75);
  assert.deepEqual(viewer.geometry.l2.stairToL3.bounds, { x1: 32.5, x2: 41, y1: 0.5, y2: 2 });
  assert.equal(viewer.geometry.l2.stairToL3.axis, '+x');
  assert.equal(viewer.geometry.l2.stairToL3.designIntent, 'suspended-floating-stair');
  assert.equal(viewer.geometry.l2.stairToL3.underStairLandscape.planterCount, 3);
  assert.equal(viewer.geometry.l3.arrivalWing.covered, true);
  assert.equal(viewer.geometry.l3.landscapeTerrace.access, 'teachers-and-maintenance-only');
  assert.equal(viewer.geometry.l3.pvRoofReserve.area, 13.5);
  assert.equal(viewer.geometry.l3.energyStorageStrategy.batteryObjectsOnGeneralL3Interior, false);
  assert.equal(viewer.geometry.l1.zones.playgroundMaleToilet.fixtures.urinals, 2);
  assert.equal(viewer.geometry.l1.zones.playgroundMaleToilet.fixtures.washbasins, 2);
  assert.equal(viewer.geometry.l1.zones.playgroundFemaleToilet.fixtures.washbasins, 2);
  assert.equal(viewer.geometry.l1.serviceWingStyle.materialIntent, 'fair-faced-exposed-concrete');
  assert.equal(viewer.geometry.roof.highElevation, 6.537);
  assert.equal(viewer.analysis.solar.status, 'current');
});

test('a model mutation changes the Viewer hash and marks registered analysis stale', () => {
  const baseline = buildViewerModel(clone(), registry);
  const changed = clone();
  const active = changed.geometryRevisions.find(({ id }) => id === changed.activeGeometryRevisionId);
  active.levels.l2Elevation = 3.4;
  const viewer = buildViewerModel(changed, registry);
  assert.notEqual(viewer.modelHash, baseline.modelHash);
  assert.equal(viewer.geometry.l2.baseElevation, 3.4);
  assert.equal(viewer.analysis.solar.status, 'stale');
});

test('Viewer follows the selected active ST-01 Y bounds without a legacy originY fallback', () => {
  const changed = clone();
  const active = changed.geometryRevisions.find(({ id }) => id === changed.activeGeometryRevisionId);
  active.stair.bounds = { x1: 20.5, x2: 29, y1: 1, y2: 2.5 };
  const viewer = buildViewerModel(changed, registry);
  assert.deepEqual(viewer.geometry.stair.bounds, active.stair.bounds);
  assert.deepEqual(viewer.entityBounds['ST-01'].bounds, active.stair.bounds);
  assert.equal('originY' in viewer.geometry.stair, false);
});

test('public content compiler resolves current active geometry tokens for all five scenes', () => {
  const content = compilePublicContent(markdown, clone(), manifest);
  assert.deepEqual(content.scenes.map(({ id }) => id), ['overview', 'light', 'rain', 'people', 'time']);
  assert.doesNotMatch(JSON.stringify(content), /\{\{/);
  assert.match(content.scenes.find(({ id }) => id === 'light').html, /25\.5°/);
  assert.match(content.scenes.find(({ id }) => id === 'light').html, /23°/);
  assert.match(content.scenes.find(({ id }) => id === 'rain').html, /5°/);
  assert.match(content.scenes.find(({ id }) => id === 'people').html, /\+0\.300 m/);
});

test('public content compiler rejects unknown scenes and unresolved active paths', () => {
  assert.throws(
    () => compilePublicContent(markdown.replace('scene:light', 'scene:glare'), clone(), manifest),
    /unknown scene ID: glare/,
  );
  assert.throws(
    () => injectModelTokens('{{active:l3.missing|metre}}', clone()),
    /token path does not exist/,
  );
});

test('generated Viewer and public content artifacts share the current model hash', () => {
  const generatedModel = JSON.parse(generatedModelText);
  const generatedContent = JSON.parse(generatedContentText);
  const rebuilt = buildViewerModel(clone(), registry);
  assert.equal(generatedModel.modelHash, rebuilt.modelHash);
  assert.equal(generatedContent.modelHash, rebuilt.modelHash);
  assert.equal(generatedModel.modelVersion, sourceModel.modelVersion);
  assert.equal(generatedModel.analysis.solar.status, 'current');
});

test('Viewer, solar study, and atlas navigation expose only v0.6.3 drawing anchors', () => {
  assert.match(viewerHtml, /#V063-L1/);
  assert.match(solarHtml, /#V063-L1/);
  assert.doesNotMatch(`${viewerHtml}\n${solarHtml}`, /#V23-|最新 V2\.3/);
  assert.match(solarHtml, /V0\.6\.3 CURRENT SOLAR BASE/);
  assert.match(solarHtml, /太陽能預留區尚未納入/);
  assert.match(solarHtml, /\+25\.5°/);
  assert.match(solarHtml, /\+23\.0°/);
  assert.match(viewerHtml, /data-orientation-cue/);
  assert.match(viewerHtml, /data-north-direction="lower-right"/);
});

test('world, L3, and coplanar mirror transforms remain separated in the scene factory', () => {
  assert.equal((sceneFactorySource.match(/worldRoot\.rotation\.y\s*=/g) ?? []).length, 1);
  assert.equal((sceneFactorySource.match(/l3RotationGroup\.rotation\.y\s*=/g) ?? []).length, 1);
  assert.match(sceneFactorySource, /siteRoot\.scale\.set\(1, 1, -1\)/);
  assert.doesNotMatch(sceneFactorySource, /stair\.originY|stair\.startX|stair\.width/);
  assert.match(sceneFactorySource, /addFacadeWallWithOpenings/);
  assert.match(sceneFactorySource, /beamBetween/);
  assert.match(sceneFactorySource, /thin-closed-riser|懸空式雙梯梁/);
  assert.doesNotMatch(sceneFactorySource, /\[stair\.treadDepth, stepHeight, stairWidth\]/);
  assert.equal((sceneFactorySource.match(/mirrorMesh\.rotation/g) ?? []).length, 0);
  assert.match(sceneFactorySource, /leanOffset/);
  assert.match(sceneFactorySource, /wallAndMirrorCoplanar|0\.012/);
  assert.match(sceneFactorySource, /ST-02 懸空式正交樓梯/);
  assert.match(sceneFactorySource, /ST-02 梯下輕量造景植栽/);
  assert.match(sceneFactorySource, /3F 屋頂太陽能預留區/);
  assert.match(sceneFactorySource, /教師／維修專用景觀區/);
  assert.doesNotMatch(sceneFactorySource, /錯位隱私屏風|設錯位隱私屏風/);
  assert.doesNotMatch(sceneFactorySource, /v050Study|v060Study/);
});
