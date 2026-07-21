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

test('v0.6.0 authoritative model and source bytes pass the current contract', async () => {
  assert.deepEqual(validateModel(model), []);
  assert.deepEqual(await validateSourceFiles(model, repoRoot), []);
});

test('package, lockfile, model, and README release versions stay synchronized', async () => {
  const packageJson = await readJson('package.json');
  const lockfile = await readJson('package-lock.json');
  const readme = await readFile(resolve(repoRoot, 'README.md'), 'utf8');
  assert.equal(packageJson.version, '0.6.0');
  assert.equal(lockfile.version, packageJson.version);
  assert.equal(lockfile.packages[''].version, packageJson.version);
  assert.equal(model.modelVersion, packageJson.version);
  assert.match(readme, /套件版本：`0\.6\.0`/);
  assert.match(readme, /模型版本：`0\.6\.0`/);
});

test('active revision is the only geometry source and uses SITE-XY', () => {
  const active = resolveActiveGeometry(model);
  assert.equal(active.id, 'GEO-0.6.0');
  assert.equal(active.modelVersion, model.modelVersion);
  assert.equal(active.coordinateSystemId, 'SITE-XY');
  assert.deepEqual(resolveGeometryEntity(active, 'ST-01').bounds, { x1: 20.5, x2: 29, y1: 0.5, y2: 2 });
  assert.deepEqual(sitePointToThree([20.5, 0.5, 0.3]), [20.5, 0.3, 0.5]);
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

test('derived geometry exposes the confirmed v0.6.0 pool, floors, roof, and stair', () => {
  const geometry = deriveReferenceGeometry(model);
  assert.equal(geometry.activeGeometryRevisionId, 'GEO-0.6.0');
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
  assert.equal(Object.values(zones).filter(({ fixtures }) => fixtures).length, 4);
  assert.equal(zones.poolMaleToilet.entrySide, 'x31-only');
  assert.equal(zones.poolFemaleToilet.entrySide, 'x31-only');
  assert.equal(zones.playgroundMaleToilet.entrySide, 'x39-only');
  assert.equal(zones.playgroundFemaleToilet.entrySide, 'x39-only');
  assert.equal(zones.chemicalRoom.publicAccess, false);
  assert.equal(zones.chemicalRoom.separateVentilation, true);
  assert.equal(active.l1.structuralStrategy.isolatedColumnsAllowed, false);
  assert.equal(active.l1.structuralStrategy.glassCarriesGravityLoad, false);
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
});

test('current sheet registry and atlas source contain only latest v0.6.0 drawings', async () => {
  assert.deepEqual(model.sheets.map(({ id }) => id), ['REF-001', 'V060-L1', 'V060-L2', 'V060-L3', 'V060-SECTION']);
  const sheetsSource = await readFile(resolve(repoRoot, 'reference/src/sheets.ts'), 'utf8');
  for (const id of ['V060-L1', 'V060-L2', 'V060-L3', 'V060-SECTION']) assert.match(sheetsSource, new RegExp(id));
  assert.doesNotMatch(sheetsSource, /V23-|v0\.5\.0\/DRAW/);
});

test('all four reproducible drawings carry active revision and SITE-XY metadata', async () => {
  const names = ['DRAW-L1-PLAN', 'DRAW-L2-PLAN', 'DRAW-L3-PLAN', 'DRAW-LONGITUDINAL-SECTION'];
  for (const name of names) {
    const base = resolve(repoRoot, 'reference/drafts/v0.6.0', `${name}-v0.6.0`);
    const svg = await readFile(`${base}.svg`, 'utf8');
    await access(`${base}.png`);
    assert.match(svg, /data-model-version="0\.6\.0"/);
    assert.match(svg, /data-active-geometry="GEO-0\.6\.0"/);
    assert.match(svg, /data-coordinate-system="SITE-XY"/);
    assert.match(svg, /非施工圖/);
  }
});

test('active geometry consumers do not hardcode a legacy study selector', async () => {
  const paths = [
    'scripts/reference-geometry.mjs',
    'scripts/viewer-data.mjs',
    'scripts/solar-angle-analysis.mjs',
    'scripts/solar-energy-analysis.mjs',
    'scripts/generate-v060-drawings.mjs',
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
