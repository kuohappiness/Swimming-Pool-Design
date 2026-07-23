import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveActiveGeometry, resolveGeometryEntity, sitePointToThree } from '../scripts/active-geometry.mjs';
import { deriveReferenceGeometry } from '../scripts/reference-geometry.mjs';
import { validateModel, validateSourceFiles } from '../scripts/reference-validation.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(resolve(repoRoot, path), 'utf8'));
const model = await readJson('model/project-model.json');

test('v0.6.6 authoritative model and source bytes pass the current contract', async () => {
  assert.deepEqual(validateModel(model), []);
  assert.deepEqual(await validateSourceFiles(model, repoRoot), []);
});

test('package, lockfile, model, and README release versions stay synchronized', async () => {
  const packageJson = await readJson('package.json');
  const lockfile = await readJson('package-lock.json');
  const readme = await readFile(resolve(repoRoot, 'README.md'), 'utf8');
  assert.equal(packageJson.version, '0.6.6');
  assert.equal(lockfile.version, packageJson.version);
  assert.equal(lockfile.packages[''].version, packageJson.version);
  assert.equal(model.modelVersion, packageJson.version);
  assert.match(readme, /套件版本：`0\.6\.6`/);
  assert.match(readme, /模型版本：`0\.6\.6`/);
});

test('active revision is the only geometry source and uses SITE-XY', () => {
  const active = resolveActiveGeometry(model);
  assert.equal(active.id, 'GEO-0.6.6');
  assert.equal(active.modelVersion, model.modelVersion);
  assert.equal(active.coordinateSystemId, 'SITE-XY');
  assert.deepEqual(resolveGeometryEntity(active, 'ST-01').bounds, { x1: 20.5, x2: 29, y1: 0.5, y2: 2 });
  assert.deepEqual(sitePointToThree([20.5, 0.5, 0.3]), [20.5, 0.3, -0.5]);
});

test('active resolver fails closed when the selector is missing, unknown, duplicated, or version-drifted', () => {
  const missing = structuredClone(model);
  delete missing.activeGeometryRevisionId;
  assert.throws(() => resolveActiveGeometry(missing), /activeGeometryRevisionId is required/);

  const unknown = structuredClone(model);
  unknown.activeGeometryRevisionId = 'GEO-9.9.9';
  assert.throws(() => resolveActiveGeometry(unknown), /must resolve exactly once; found 0/);

  const duplicate = structuredClone(model);
  duplicate.geometryRevisions.push(structuredClone(resolveActiveGeometry(duplicate)));
  assert.throws(() => resolveActiveGeometry(duplicate), /must resolve exactly once; found 2/);

  const drifted = structuredClone(model);
  drifted.geometryRevisions.find(({ id }) => id === drifted.activeGeometryRevisionId).modelVersion = '0.6.1';
  assert.throws(() => resolveActiveGeometry(drifted), /revision and modelVersion must match/);
});

test('active resolver rejects missing frames, duplicate entity IDs, and unframed bounds', () => {
  const noFrame = structuredClone(model);
  noFrame.referenceSystem.coordinateSystems = [];
  assert.throws(() => resolveActiveGeometry(noFrame), /SITE-XY must be declared exactly once/);

  const duplicateEntity = structuredClone(model);
  const activeDuplicate = duplicateEntity.geometryRevisions.find(({ id }) => id === duplicateEntity.activeGeometryRevisionId);
  activeDuplicate.l1.pool.entityId = activeDuplicate.stair.entityId;
  assert.throws(() => resolveActiveGeometry(duplicateEntity), /duplicate entityId ST-01/);

  const missingFrame = structuredClone(model);
  const activeMissingFrame = missingFrame.geometryRevisions.find(({ id }) => id === missingFrame.activeGeometryRevisionId);
  delete activeMissingFrame.l1.pool.coordinateSystemId;
  assert.throws(() => resolveActiveGeometry(missingFrame), /must declare coordinateSystemId SITE-XY/);
});

test('derived geometry exposes the confirmed v0.6.6 pool, floors, roof, and stair', () => {
  const geometry = deriveReferenceGeometry(model);
  assert.equal(geometry.activeGeometryRevisionId, 'GEO-0.6.6');
  assert.equal(geometry.siteLength, 41);
  assert.equal(geometry.siteWidth, 14);
  assert.equal(geometry.poolLength, 25);
  assert.equal(geometry.poolWidth, 8.5);
  assert.equal(geometry.l2StartX, 29);
  assert.equal(geometry.l2EndX, 41);
  assert.equal(geometry.l3PlanRotation, 25.5);
  assert.equal(geometry.roofPlanRun, 29);
  assert.equal(geometry.stairStartX, 20.5);
  assert.equal(geometry.stairEndX, 29);
  assert.equal(geometry.stairTotalRun, 8.5);
});

test('L1 keeps four independent toilets, equipment rooms, and separated entrances', () => {
  const active = resolveActiveGeometry(model);
  const zones = active.l1.zones;
  assert.equal(active.l1.y0ExteriorFacade.entityId, 'F-L1-Y0-01');
  assert.equal(active.l1.y0ExteriorFacade.materialIntent, 'segmented-safety-glass-and-fair-faced-concrete');
  assert.equal(active.l1.y0ExteriorFacade.mainEntranceEntityId, 'EN-01');
  assert.equal(active.l1.y0ExteriorFacade.poolHallMaterialIntent, 'safety-glass');
  assert.equal(active.l1.y0ExteriorFacade.serviceWingMaterialIntent, 'fair-faced-exposed-concrete');
  assert.deepEqual(active.l1.mainEntrance.bounds, { x1: 1, x2: 3, y1: 0, y2: 0.2 });
  assert.deepEqual(active.l1.westSetback.bounds, { x1: 0, x2: 0.5, y1: 0, y2: 14 });
  assert.deepEqual(active.l1.westGlassEave.bounds, { x1: 0, x2: 0.5, y1: 0, y2: 14 });
  assert.equal(active.l1.westGlassEave.rainwaterRecoveryEntityId, 'RW-WEST-01');
  assert.deepEqual(active.l1.rearGlassCanopy.bounds, { x1: 31, x2: 39, y1: 13.5, y2: 14.5 });
  assert.equal(active.l1.rearGlassCanopy.siteBoundsUnchanged, true);
  assert.equal(Object.values(zones).filter(({ fixtures }) => fixtures).length, 4);
  assert.equal(zones.poolMaleToilet.entrySide, 'x31-only');
  assert.equal(zones.poolFemaleToilet.entrySide, 'x31-only');
  assert.equal(zones.playgroundMaleToilet.entrySide, 'x39-only');
  assert.equal(zones.playgroundFemaleToilet.entrySide, 'x39-only');
  assert.equal(zones.poolMaleToilet.layout.washbasinWall, 'y0');
  assert.equal(zones.playgroundMaleToilet.layout.washbasinWall, 'y0');
  assert.equal(zones.poolFemaleToilet.layout.washbasinWall, 'y7.5');
  assert.equal(zones.playgroundFemaleToilet.layout.washbasinWall, 'y7.5');
  assert.ok(Object.values(zones).filter(({ layout }) => layout).every(({ layout }) => layout.toiletCubicles.every(({ doorLeaf }) => doorLeaf)));
  assert.ok(Object.values(zones).filter(({ layout }) => layout).every(({ layout, privacyScreen }) => privacyScreen === false && layout.privacyScreen === undefined));
  assert.ok(Object.values(zones).filter(({ layout }) => layout).every(({ layout }) => layout.toiletCubicles.every(({ wallContact }) => wallContact === 'y3.5')));
  assert.ok(zones.poolMaleToilet.layout.urinals.some(({ center, wallContact }) => center[0] === 31.18 && wallContact === 'x31'));
  assert.deepEqual(zones.playgroundMaleToilet.fixtures, { toilets: 1, urinals: 2, washbasins: 2 });
  assert.deepEqual(zones.playgroundFemaleToilet.fixtures, { toilets: 2, urinals: 0, washbasins: 2 });
  assert.equal(zones.playgroundMaleToilet.layout.washbasins.filter(({ addedIn }) => addedIn === '0.6.3').length, 1);
  assert.equal(zones.playgroundMaleToilet.layout.urinals.filter(({ addedIn }) => addedIn === '0.6.3').length, 1);
  assert.equal(zones.playgroundFemaleToilet.layout.washbasins.filter(({ addedIn }) => addedIn === '0.6.3').length, 1);
  assert.equal(active.l1.toiletEntrances.length, 4);
  assert.ok(active.l1.toiletEntrances.every(({ clearWidth, doorLeaf, openingType }) => clearWidth === 1 && doorLeaf === false && openingType === 'doorless-opening'));
  assert.equal(active.l1.serviceWing.architecturalStyle.materialIntent, 'fair-faced-exposed-concrete');
  assert.equal(zones.chemicalRoom.publicAccess, false);
  assert.equal(zones.chemicalRoom.separateVentilation, true);
  assert.equal(active.l1.structuralStrategy.isolatedColumnsAllowed, false);
  assert.equal(active.l1.structuralStrategy.glassCarriesGravityLoad, false);
});

test('L2 Review A provides 30 inclusive 1.2 m showers, support fixtures, corridor, and floating ST-02', () => {
  const l2 = resolveActiveGeometry(model).l2;
  assert.deepEqual(l2.y0ExteriorFacade.bounds, { x1: 29, x2: 41, y1: 0, y2: 0.14 });
  assert.equal(l2.y0ExteriorFacade.materialIntent, 'full-width-safety-glass');
  assert.equal(l2.y0ExteriorFacade.viewerMaterialSystem, 'shared-safety-glass-facade');
  assert.equal(l2.y0ExteriorFacade.opaqueSegments, false);
  assert.equal(resolveActiveGeometry(model).viewerPresentation.selectionOutline, 'none');
  assert.deepEqual(l2.stairChangingDivider.spanX, [32, 41]);
  assert.equal(l2.stairChangingDivider.continuous, true);
  assert.deepEqual(l2.stairChangingDivider.openings, []);
  assert.deepEqual(l2.ceiling.bounds, { x1: 29, x2: 41, y1: 0, y2: 13.5 });
  assert.equal(l2.ceiling.continuous, true);
  for (const zone of Object.values(l2.zones)) {
    assert.equal(zone.showerCount, 15);
    assert.equal(zone.showerCubicles.length, 15);
    assert.deepEqual(zone.showerModuleSize, [1.2, 1.2]);
    assert.equal(zone.showerDimensionBasis, 'inclusive-of-partitions');
    assert.ok(zone.showerCubicles.every(({ planBounds }) => Math.abs(planBounds.x2 - planBounds.x1 - 1.2) < 1e-9 && Math.abs(planBounds.y2 - planBounds.y1 - 1.2) < 1e-9));
    assert.deepEqual(zone.supportFixtures.fixtures, { toilets: 1, washbasins: 2 });
  }
  assert.equal(l2.circulationZone.area, 41.75);
  assert.equal(l2.circulationZone.standingOnly, true);
  assert.equal(l2.circulationZone.seatingAllowed, false);
  assert.deepEqual(l2.changingRoomEntries.map(({ rangeY }) => rangeY), [[6.7, 7.7], [12.2, 13.2]]);
  assert.deepEqual(l2.stairToL3.bounds, { x1: 32.5, x2: 41, y1: 0.5, y2: 2 });
  assert.equal(l2.stairToL3.axis, '+x');
  assert.equal(l2.stairToL3.riserCount, 22);
  assert.deepEqual(l2.stairToL3.yBandLocked, [0.5, 2]);
  assert.equal(l2.stairToL3.designIntent, 'suspended-floating-stair');
  assert.equal(l2.stairToL3.stringerCount, 2);
  assert.equal(l2.stairToL3.underStairEnclosure, false);
  assert.equal(l2.stairToL3.underStairLandscape.planterCount, 3);
});

test('L3 keeps future flexibility and adds a complete roof with dense PV and ground-level outdoor ESS strategy', () => {
  const l3 = resolveActiveGeometry(model).l3;
  assert.equal(l3.planRotation, 25.5);
  assert.deepEqual(l3.planPivot, { x: 35, y: 6.75, strategy: 'floor-plate-centroid-and-fixed-core-proxy', status: 'working' });
  assert.equal(l3.orthogonalExtension.grossArea, 6.935);
  assert.equal(l3.arrivalWing.covered, true);
  assert.equal(l3.arrivalWing.connectsStairToIndoorL3, true);
  assert.equal(l3.landscapeTerrace.access, 'teachers-and-maintenance-only');
  assert.equal(l3.landscapeTerrace.studentsAllowed, false);
  assert.equal(l3.landscapeTerrace.visitorsAllowed, false);
  assert.equal(l3.landscapeTerrace.primaryEgress, false);
  assert.equal(l3.programStrategy.teacherObservationRoom, 'future-flexibility-only');
  assert.equal(l3.programStrategy.environmentalEducationDisplay, 'future-flexibility-only');
  assert.equal(l3.programStrategy.dryMaintenanceStorage, 'under-consideration-not-built');
  assert.deepEqual(l3.roof.bounds, { x1: 27.472, x2: 41, y1: 0, y2: 13.5 });
  assert.equal(l3.roof.area, 182.628);
  assert.equal(l3.roof.continuous, true);
  assert.equal(l3.roof.extendsToMirrorTopEdge, true);
  assert.equal(l3.mirror.sideWallEndGapsFilled, true);
  assert.equal(l3.mirror.roofEdgeContinuous, true);
  assert.equal(l3.pvRoofReserve.area, 169.364);
  assert.equal(l3.pvRoofReserve.roofArea, 182.628);
  assert.equal(l3.pvRoofReserve.coveragePercent, 92.74);
  assert.equal(l3.pvRoofReserve.perimeterSetback, 0.25);
  assert.equal(l3.pvRoofReserve.capacityStatus, 'deferred');
  assert.equal(l3.energyStorageStrategy.preferredLocation, 'ground-level-independent-outdoor-enclosure');
  assert.equal(l3.energyStorageStrategy.batteryObjectsOnGeneralL3Interior, false);
});

test('ST-01 scheme E connects the +0.30 m deck directly to L2', () => {
  const stair = resolveActiveGeometry(model).stair;
  assert.equal(stair.lowerElevation, 0.3);
  assert.equal(stair.upperElevation, 3.3);
  assert.equal(stair.riserCount, 20);
  assert.equal(stair.treadsPerRun * stair.runs, 18);
  assert.equal(stair.runLengthPerFlight, 2.7);
  assert.equal(stair.midLandingLength, 3.1);
  assert.equal(stair.upperConnection, 'direct-to-l2-at-x29');
  assert.equal(stair.designIntent, 'suspended-floating-stair');
  assert.equal(stair.stringerCount, 2);
  assert.equal(stair.underStairEnclosure, false);
});

test('current sheet registry and atlas source contain only latest v0.6.6 inline SVG drawings', async () => {
  assert.deepEqual(model.sheets.map(({ id }) => id), ['REF-001', 'V066-L1', 'V066-L2', 'V066-L3', 'V066-SECTION']);
  const sheetsSource = await readFile(resolve(repoRoot, 'reference/src/sheets.ts'), 'utf8');
  for (const id of ['V066-L1', 'V066-L2', 'V066-L3', 'V066-SECTION']) assert.match(sheetsSource, new RegExp(id));
  assert.doesNotMatch(sheetsSource, /V23-|v0\.5\.0\/DRAW/);
  assert.match(sheetsSource, /\.svg\?raw/);
  assert.doesNotMatch(sheetsSource, /DRAW-L[123].*\.png/);
});

test('all four reproducible drawings carry active revision and SITE-XY metadata', async () => {
  const names = ['DRAW-L1-PLAN', 'DRAW-L2-PLAN', 'DRAW-L3-PLAN', 'DRAW-LONGITUDINAL-SECTION'];
  for (const name of names) {
    const base = resolve(repoRoot, 'reference/drafts/v0.6.6', `${name}-v0.6.6`);
    const svg = await readFile(`${base}.svg`, 'utf8');
    await access(`${base}.png`);
    assert.match(svg, /data-model-version="0\.6\.6"/);
    assert.match(svg, /data-active-geometry="GEO-0\.6\.6"/);
    assert.match(svg, /data-coordinate-system="SITE-XY"/);
    assert.match(svg, /非施工圖/);
    if (name !== 'DRAW-LONGITUDINAL-SECTION') {
      assert.match(svg, /data-north-plan-direction="lower-right"/);
      assert.match(svg, /data-north-rotation="127"/);
    }
    if (name === 'DRAW-L1-PLAN') {
      assert.doesNotMatch(svg, /data-privacy-screen="true"/);
      assert.match(svg, /data-entity="F-L1-Y0-01"/);
      assert.match(svg, /data-material-intent="segmented-safety-glass-and-fair-faced-concrete"/);
      assert.match(svg, /data-entity="RF-L1-WEST-EAVE-01"/);
      assert.match(svg, /data-entity="RF-L1-REAR-CANOPY-01"/);
      assert.match(svg, /Y14～Y14\.5 突出屋簷/);
    }
    if (name === 'DRAW-L2-PLAN') {
      assert.match(svg, /data-grid-visible="true"/);
      assert.equal((svg.match(/data-shower-cubicle=/g) ?? []).length, 30);
      assert.match(svg, /data-entity="ST-02"/);
      assert.match(svg, /data-inclusive-size="1\.2x1\.2"/);
      assert.match(svg, /data-entity="Z-ST-02-PLANT-01"/);
      assert.match(svg, /data-entity="W-L2-ST-CH-01" data-openings="0"/);
      assert.match(svg, /Y2\.5 清水模連續分隔牆 X32～X41／無開口/);
    }
    if (name === 'DRAW-L3-PLAN') {
      assert.match(svg, /data-grid-visible="true"/);
      assert.match(svg, /教師／維修專用景觀區/);
      assert.match(svg, /data-entity="RF-L3-01" data-area="182\.628" data-complete-roof="true"/);
      assert.match(svg, /data-entity="RF-PV-RES-01"/);
      assert.match(svg, /data-coverage-percent="92\.74"/);
      assert.match(svg, /data-entity="L3-ROTATED-ASSEMBLY" data-shared-plan-rotation="25\.5" transform="rotate\(25\.5 /);
      assert.doesNotMatch(svg, /transform="rotate\(-25\.5 /);
    }
    if (name === 'DRAW-LONGITUDINAL-SECTION') {
      assert.match(svg, /data-coordinate-system="SITE-XZ"/);
      assert.match(svg, /data-grid-visible="true"/);
      assert.match(svg, /data-entity="CLG-L2-01" data-continuous="true"/);
      assert.match(svg, /data-entity="RF-L3-01" data-complete-roof="true"/);
      assert.match(svg, /data-entity="W-L1-X0\.5-01"/);
      assert.match(svg, /data-entity="W-L2-X29-01"/);
      assert.match(svg, /data-entity="W-L2-X41-01"/);
      assert.match(svg, /data-entity="W-L3-X41-01"/);
      assert.match(svg, /data-entity="EN-01" data-projection="elevation-not-cut"/);
    }
  }
});

test('active geometry consumers do not hardcode a legacy study selector', async () => {
  const paths = [
    'scripts/reference-geometry.mjs',
    'scripts/viewer-data.mjs',
    'scripts/solar-angle-analysis.mjs',
    'scripts/solar-energy-analysis.mjs',
    'scripts/generate-current-drawings.mjs',
  ];
  for (const path of paths) {
    const source = await readFile(resolve(repoRoot, path), 'utf8');
    assert.doesNotMatch(source, /v050Study|v060Study/);
    assert.match(source, /resolveActiveGeometry/);
  }
});

test('conceptual coordination never implies professional approval', () => {
  const review = resolveActiveGeometry(model).integrationReview;
  assert.equal(review.status, 'conceptual-coordination-complete-professional-approvals-outstanding');
  assert.ok(Object.values(review.professionalApprovals).every((value) => value === false));
  assert.ok(review.openItemIds.includes('OPEN-011'));
  assert.ok(review.openItemIds.includes('OPEN-018'));
});
