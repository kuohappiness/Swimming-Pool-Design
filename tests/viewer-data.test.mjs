import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildViewerModel } from '../scripts/viewer-data.mjs';
import { compilePublicContent, injectModelTokens } from '../scripts/build-public-content.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [modelText, registryText, markdown, manifestText, generatedModelText, generatedContentText, sceneFactorySource, baselineMaterialsSource, interactionsSource, viewerHtml, solarHtml] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8'),
  readFile(resolve(repoRoot, 'docs/public/swimming-pool-renovation-design-concept.md'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/scene-manifest.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/generated/viewer-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/generated/concept-content.json'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/scene-factory.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/rendering/baseline-material-registry.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/3d-viewer/interactions.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/views/3d-viewer/viewer-template.html'), 'utf8'),
  readFile(resolve(repoRoot, 'reference/src/views/solar-study/legacy-template.html'), 'utf8'),
]);
const sourceModel = JSON.parse(modelText);
const registry = JSON.parse(registryText);
const manifest = JSON.parse(manifestText);
const clone = () => structuredClone(sourceModel);

test('Viewer package derives all major geometry from the active revision', () => {
  const viewer = buildViewerModel(clone(), registry);
  assert.equal(viewer.schemaVersion, '1.5.0');
  assert.equal(viewer.modelVersion, sourceModel.modelVersion);
  assert.equal(viewer.activeGeometryRevisionId, sourceModel.activeGeometryRevisionId);
  assert.equal(viewer.activeGeometryRevisionId, `GEO-${viewer.geometryRevision}`);
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
  assert.deepEqual(
    viewer.referenceSystem.siteOrientation,
    sourceModel.referenceSystem.siteOrientation,
  );
  assert.equal(
    viewer.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
    307,
  );
  assert.equal('worldTransform' in viewer.referenceSystem, false);
  assert.equal('northArrowPlanDirection' in viewer.referenceSystem, false);
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
  const l1Cubicles = [
    viewer.geometry.l1.zones.poolMaleToilet,
    viewer.geometry.l1.zones.poolFemaleToilet,
    viewer.geometry.l1.zones.playgroundMaleToilet,
    viewer.geometry.l1.zones.playgroundFemaleToilet,
  ].flatMap(({ layout }) => layout.toiletCubicles);
  assert.equal(l1Cubicles.filter(({ fixtureType }) => fixtureType === 'seated').length, 4);
  assert.equal(l1Cubicles.filter(({ fixtureType }) => fixtureType === 'squat').length, 4);
  assert.deepEqual(
    viewer.geometry.l1.zones.poolMaleToilet.layout.toiletCubicles.map(({ fixtureType }) => fixtureType),
    ['seated', 'squat'],
  );
  assert.deepEqual(
    viewer.geometry.l1.zones.poolFemaleToilet.layout.toiletCubicles.map(({ fixtureType }) => fixtureType),
    ['seated', 'squat', 'squat'],
  );
  assert.deepEqual(
    viewer.geometry.l1.zones.playgroundMaleToilet.layout.toiletCubicles.map(({ fixtureType }) => fixtureType),
    ['seated'],
  );
  assert.deepEqual(
    viewer.geometry.l1.zones.playgroundFemaleToilet.layout.toiletCubicles.map(({ fixtureType }) => fixtureType),
    ['squat', 'seated'],
  );
  assert.ok(l1Cubicles.every(({ fixtureCenter, planBounds }) =>
    fixtureCenter[0] > planBounds.x1
    && fixtureCenter[0] < planBounds.x2
    && fixtureCenter[1] > planBounds.y1
    && fixtureCenter[1] < planBounds.y2));
  assert.equal(viewer.viewerPresentation.occupancyAppearance, 'newly-completed-in-use');
  assert.equal(viewer.viewerPresentation.campusEnvironmentPhase, 'deferred');
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

  const methodChange = clone();
  const methodActive = methodChange.geometryRevisions.find(({ id }) => id === methodChange.activeGeometryRevisionId);
  methodActive.solar.analysisMethodRevision = 'SOLAR-METHOD-1.0.1';
  const methodViewer = buildViewerModel(methodChange, registry);
  assert.notEqual(methodViewer.analysis.solar.currentAnalysisInputHash, baseline.analysis.solar.currentAnalysisInputHash);
  assert.equal(methodViewer.analysis.solar.status, 'stale');

  const assumptionChange = clone();
  const assumptionActive = assumptionChange.geometryRevisions.find(({ id }) => id === assumptionChange.activeGeometryRevisionId);
  assumptionActive.solar.energyAssumptions.mirrorReflectance = 0.74;
  const assumptionViewer = buildViewerModel(assumptionChange, registry);
  assert.notEqual(assumptionViewer.analysis.solar.currentAnalysisInputHash, baseline.analysis.solar.currentAnalysisInputHash);
  assert.equal(assumptionViewer.analysis.solar.status, 'stale');
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

test('Viewer accepts only canonical site orientation and rejects parallel sources', () => {
  const legacyReference = clone();
  legacyReference.referenceSystem.localLongAxisBearingFromTrueNorth = 306;
  assert.throws(
    () => buildViewerModel(legacyReference, registry),
    /localLongAxisBearingFromTrueNorth is forbidden/,
  );

  const legacySite = clone();
  const active = legacySite.geometryRevisions.find(({ id }) => id === legacySite.activeGeometryRevisionId);
  active.site.rightwardBearingFromTrueNorth = 308;
  assert.throws(
    () => buildViewerModel(legacySite, registry),
    /must not duplicate canonical orientation data/,
  );

  const changedCanonical = clone();
  changedCanonical.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth = 308;
  const viewer = buildViewerModel(changedCanonical, registry);
  assert.equal(
    viewer.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
    308,
  );
});

test('public content compiler resolves current active geometry tokens for all five scenes', () => {
  const content = compilePublicContent(markdown, clone(), manifest);
  assert.deepEqual(content.scenes.map(({ id }) => id), ['overview', 'light', 'rain', 'people', 'time']);
  assert.doesNotMatch(JSON.stringify(content), /\{\{/);
  assert.match(content.scenes.find(({ id }) => id === 'light').html, /25\.5°/);
  assert.match(content.scenes.find(({ id }) => id === 'light').html, /23°/);
  assert.match(content.scenes.find(({ id }) => id === 'rain').html, /5°/);
  assert.match(content.scenes.find(({ id }) => id === 'people').html, /服務中心1F\/3F/);
  const overview = content.scenes.find(({ id }) => id === 'overview');
  assert.match(overview.html, /向人，<br>再次打開/);
  assert.match(overview.html, /href="#concept-light"/);
  assert.match(overview.html, /href="#concept-rain"/);
  assert.match(overview.html, /href="#concept-people"/);
  assert.match(overview.html, /href="#concept-time"/);
  assert.equal(overview.title, '重新定向');
  assert.ok(manifest.scenes.every(({ context }) =>
    context.title
    && context.summary
    && context.observations.length === 3
    && context.conceptAnchor));
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

test('Viewer, solar study, and atlas navigation expose current owners and only v0.6.7 drawing anchors', () => {
  assert.match(viewerHtml, /#V067-L1/);
  assert.match(solarHtml, /#V067-L1/);
  assert.doesNotMatch(`${viewerHtml}\n${solarHtml}`, /#V23-|最新 V2\.3/);
  assert.match(solarHtml, /id="research-conclusion-title"/);
  assert.match(solarHtml, /id="conclusion-plan-rotation"/);
  assert.match(solarHtml, /id="conclusion-wall-lean"/);
  assert.match(solarHtml, /id="conclusion-cool-gain"/);
  assert.match(solarHtml, /id="conclusion-warm-gain"/);
  assert.doesNotMatch(solarHtml, /id="(?:date|time|planRotation|lean)"[^>]*\svalue=/);
  assert.match(solarHtml, /id="azimuthToleranceFan"/);
  assert.match(solarHtml, /id="minimumDownwardLine"/);
  assert.match(solarHtml, /id="plan-arrow-incoming"/);
  assert.match(solarHtml, /id="plan-arrow-reflected"/);
  assert.match(solarHtml, /id="planIncidentPoint"/);
  assert.doesNotMatch(solarHtml, /角度示意中心/);
  assert.match(solarHtml, /平面虛線只顯示向下 3D 反射光的水平投影，不代表光線穿透鏡牆/);
  assert.match(solarHtml, /3D 反射光水平投影（虛線）/);
  assert.match(solarHtml, /<h2>平面：L3 旋轉改變鏡牆法線方位<\/h2>/);
  assert.doesNotMatch(solarHtml, /<h2>平面方位投影/);
  assert.match(solarHtml, /未命中池面時仍維持完整對比、末端箭頭與文字標示/);
  assert.match(solarHtml, /id="reflected"[^>]*aria-label="反射光"/);
  assert.match(solarHtml, /id="desktopPlanPreviewViewport"/);
  assert.match(solarHtml, /id="desktopSectionPreviewViewport"/);
  assert.match(solarHtml, /桌面版平面與剖面即時預覽/);
  assert.match(solarHtml, /鏡牆法線方位/);
  assert.match(solarHtml, /方向診斷可選 07:00–18:00/);
  assert.match(viewerHtml, /data-orientation-cue/);
  assert.match(viewerHtml, /data-orientation-arrow/);
  assert.doesNotMatch(viewerHtml, /data-north-direction="lower-right"|↘/);
  assert.match(viewerHtml, /data-view="pool-cutaway">泳池剖視/);
  assert.match(viewerHtml, /X3 淺端 1\.20 m/);
  assert.doesNotMatch(viewerHtml, /data-scene-context/);
  assert.doesNotMatch(viewerHtml, /data-concept-content|<html|<body|<script/);
});

test('world, L3, and coplanar mirror transforms remain separated in the scene factory', () => {
  assert.equal((sceneFactorySource.match(/worldRoot\.rotation\.y\s*=/g) ?? []).length, 1);
  assert.match(sceneFactorySource, /deriveViewerOrientation/);
  assert.doesNotMatch(sceneFactorySource, /rotationFromTrueNorth|localLongAxisBearingFromTrueNorth/);
  assert.match(sceneFactorySource, /TRUE-NORTH-LABEL-N/);
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
  assert.match(sceneFactorySource, /materials\.get\('safety-glass'\)/);
  assert.match(baselineMaterialsSource, /SHARED-SAFETY-GLASS-FACADE-MATERIAL/);
  assert.match(sceneFactorySource, /F-L2-Y0-01:GLASS/);
  assert.match(sceneFactorySource, /W-L2-GENDER-DIVIDER:Y/);
  assert.match(baselineMaterialsSource, /safetyGlass\.color\.set\(0x8fd7e5\)/);
  assert.match(baselineMaterialsSource, /safetyGlass\.opacity = 0\.34/);
  assert.match(baselineMaterialsSource, /safetyGlass\.transmission = 0\.16/);
  assert.doesNotMatch(baselineMaterialsSource, /safetyGlass\.(clearcoat|emissive|reflectivity)/);
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
