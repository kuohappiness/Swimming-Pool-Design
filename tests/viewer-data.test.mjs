import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildViewerModel } from '../scripts/viewer-data.mjs';
import { compilePublicContent, injectModelTokens } from '../scripts/build-public-content.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [modelText, registryText, markdown, manifestText, generatedModelText, generatedContentText, sceneFactorySource, interactionsSource, viewerHtml, solarHtml] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8'),
  readFile(resolve(repoRoot, 'docs/public/swimming-pool-renovation-design-concept.md'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/scene-manifest.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/generated/viewer-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/generated/concept-content.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/scene-factory.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/interactions.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/3d-viewer/index.html'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/solar-study/index.html'), 'utf8'),
]);
const sourceModel = JSON.parse(modelText);
const registry = JSON.parse(registryText);
const manifest = JSON.parse(manifestText);
const clone = () => structuredClone(sourceModel);

test('Viewer package derives all major geometry from GEO-0.6.7', () => {
  const viewer = buildViewerModel(clone(), registry);
  assert.equal(viewer.schemaVersion, '1.3.0');
  assert.equal(viewer.modelVersion, '0.6.7');
  assert.equal(viewer.activeGeometryRevisionId, 'GEO-0.6.7');
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
  assert.equal(viewer.geometry.l1.y0ExteriorFacade.materialIntent, 'segmented-safety-glass-and-fair-faced-concrete');
  assert.equal(viewer.geometry.l1.y0ExteriorFacade.mainEntranceEntityId, 'EN-01');
  assert.deepEqual(viewer.geometry.l1.mainEntranceBounds, { x1: 1, x2: 3, y1: 0, y2: 0.2 });
  assert.deepEqual(viewer.geometry.l1.westSetbackBounds, { x1: 0, x2: 0.5, y1: 0, y2: 14 });
  assert.deepEqual(viewer.geometry.l1.rearGlassCanopy.bounds, { x1: 31, x2: 39, y1: 13.5, y2: 14.5 });
  assert.equal(viewer.geometry.l2.y0ExteriorFacade.materialIntent, 'full-width-safety-glass');
  assert.equal(viewer.geometry.l2.y0ExteriorFacade.viewerMaterialSystem, 'shared-safety-glass-facade');
  assert.equal(viewer.geometry.l2.splitAxisY, 8);
  assert.equal(viewer.geometry.l2.splitAxisY, viewer.geometry.l2.zones.maleChangingShower.bounds.y2);
  assert.equal(viewer.geometry.l2.splitAxisY, viewer.geometry.l2.zones.femaleChangingShower.bounds.y1);
  assert.equal(viewer.viewerPresentation.selectionOutline, 'none');
  assert.deepEqual(viewer.geometry.l2.stairChangingDivider.spanX, [32, 41]);
  assert.deepEqual(viewer.geometry.l2.stairChangingDivider.openings, []);
  assert.equal(viewer.geometry.l2.ceiling.continuous, true);
  assert.deepEqual(viewer.geometry.l2.stairToL3.bounds, { x1: 32.5, x2: 41, y1: 0.5, y2: 2 });
  assert.equal(viewer.geometry.l2.stairToL3.axis, '+x');
  assert.equal(viewer.geometry.l2.stairToL3.designIntent, 'suspended-floating-stair');
  assert.equal(viewer.geometry.l2.stairToL3.underStairLandscape.planterCount, 3);
  assert.equal(viewer.geometry.l3.arrivalWing.covered, true);
  assert.equal(viewer.geometry.l3.landscapeTerrace.access, 'teachers-and-maintenance-only');
  assert.equal(viewer.geometry.l3.roof.area, 182.628);
  assert.equal(viewer.geometry.l3.roof.continuous, true);
  assert.equal(viewer.geometry.l3.mirror.sideWallEndGapsFilled, true);
  assert.equal(viewer.geometry.l3.pvRoofReserve.area, 169.364);
  assert.equal(viewer.geometry.l3.pvRoofReserve.coveragePercent, 92.74);
  assert.equal(viewer.geometry.l3.energyStorageStrategy.batteryObjectsOnGeneralL3Interior, false);
  assert.equal(viewer.geometry.l1.zones.playgroundMaleToilet.fixtures.urinals, 2);
  assert.equal(viewer.geometry.l1.zones.playgroundMaleToilet.fixtures.washbasins, 2);
  assert.equal(viewer.geometry.l1.zones.playgroundFemaleToilet.fixtures.washbasins, 2);
  assert.equal(viewer.geometry.l1.serviceWingStyle.materialIntent, 'fair-faced-exposed-concrete');
  assert.equal(viewer.geometry.roof.highElevation, 6.537);
  assert.equal(viewer.analysis.solar.status, 'current');
});

test('only a solar-input mutation marks registered analysis stale', () => {
  const baseline = buildViewerModel(clone(), registry);
  const nonSolarChange = clone();
  const nonSolarActive = nonSolarChange.geometryRevisions.find(({ id }) => id === nonSolarChange.activeGeometryRevisionId);
  nonSolarActive.l2.ceiling.thickness = 0.25;
  const nonSolarViewer = buildViewerModel(nonSolarChange, registry);
  assert.notEqual(nonSolarViewer.modelHash, baseline.modelHash);
  assert.equal(nonSolarViewer.analysis.solar.status, 'current');

  const solarChange = clone();
  const solarActive = solarChange.geometryRevisions.find(({ id }) => id === solarChange.activeGeometryRevisionId);
  solarActive.solar.mirrorLeanFromVertical.value = 22.9;
  const solarViewer = buildViewerModel(solarChange, registry);
  assert.notEqual(solarViewer.analysis.solar.currentAnalysisInputHash, baseline.analysis.solar.currentAnalysisInputHash);
  assert.equal(solarViewer.analysis.solar.status, 'stale');
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

test('Viewer, solar study, and atlas navigation expose only v0.6.7 drawing anchors', () => {
  assert.match(viewerHtml, /#V067-L1/);
  assert.match(solarHtml, /#V067-L1/);
  assert.doesNotMatch(`${viewerHtml}\n${solarHtml}`, /#V23-|最新 V2\.3/);
  assert.match(solarHtml, /V0\.6\.7 CURRENT SOLAR BASE/);
  assert.match(solarHtml, /完整 3F 屋頂與高覆蓋率太陽能排布尚未納入/);
  assert.match(solarHtml, /solar inputHash 與 v0\.6\.6／v0\.6\.5／v0\.6\.4／v0\.6\.3 相同/);
  assert.match(solarHtml, /不重新執行完整最佳化/);
  assert.match(solarHtml, /\+25\.5°/);
  assert.match(solarHtml, /\+23\.0°/);
  assert.match(viewerHtml, /data-orientation-cue/);
  assert.match(viewerHtml, /data-north-direction="lower-right"/);
  assert.match(viewerHtml, /data-view="pool-cutaway">泳池剖視/);
  assert.match(viewerHtml, /X3 淺端 1\.20 m/);
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
  assert.match(sceneFactorySource, /L1 Y0 玻璃／清水模分段外牆/);
  assert.match(sceneFactorySource, /L2 Y0 全寬安全玻璃外牆/);
  assert.match(sceneFactorySource, /SHARED-SAFETY-GLASS-FACADE-MATERIAL/);
  assert.match(sceneFactorySource, /F-L2-Y0-01:GLASS/);
  assert.match(sceneFactorySource, /W-L2-GENDER-DIVIDER:Y/);
  assert.match(sceneFactorySource, /wallGlass\.color\.set\(0x8fd7e5\)/);
  assert.match(sceneFactorySource, /wallGlass\.opacity = 0\.34/);
  assert.match(sceneFactorySource, /wallGlass\.transmission = 0\.16/);
  assert.doesNotMatch(sceneFactorySource, /wallGlass\.(clearcoat|emissive|reflectivity)/);
  assert.doesNotMatch(sceneFactorySource, /l2FacadeGlass/);
  assert.doesNotMatch(interactionsSource, /BoxHelper|0xffd16b|selection outline/i);
  assert.match(sceneFactorySource, /L2 完整天花板/);
  assert.match(sceneFactorySource, /L3 鏡牆端部三角收邊/);
  assert.match(sceneFactorySource, /3F 完整旋轉屋頂／天花板/);
  assert.match(sceneFactorySource, /3F 屋頂高覆蓋率太陽能排布/);
  assert.match(sceneFactorySource, /CUTAWAY-HIDE-Y0-POOL-WALL/);
  assert.match(sceneFactorySource, /POOL-LONGITUDINAL-CUTAWAY-ANNOTATIONS/);
  assert.match(sceneFactorySource, /服務中心後側透明玻璃突出屋簷/);
  assert.match(sceneFactorySource, /教師／維修專用景觀區/);
  assert.doesNotMatch(sceneFactorySource, /錯位隱私屏風|設錯位隱私屏風/);
  assert.doesNotMatch(sceneFactorySource, /v050Study|v060Study/);
});
