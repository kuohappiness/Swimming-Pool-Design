import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildViewerModel, hashData } from '../scripts/viewer-data.mjs';
import { adaptWalkthroughSource } from '../reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts';
import { WALKTHROUGH_CONFIG } from '../reference/src/3d-viewer/walkthrough/walkthrough-config.ts';

const modelUrl = new URL('../model/project-model.json', import.meta.url);
const registryUrl = new URL('../model/analysis-registry.json', import.meta.url);

async function loadCanonicalInputs() {
  const [modelBytes, registryText] = await Promise.all([
    readFile(modelUrl),
    readFile(registryUrl, 'utf8'),
  ]);
  return {
    modelBytes,
    model: JSON.parse(modelBytes.toString('utf8')),
    registry: JSON.parse(registryText),
  };
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const clone = (value) => structuredClone(value);

test('walkthrough adaptation is read-only and leaves canonical source bytes unchanged', async () => {
  const before = await loadCanonicalInputs();
  const viewerModel = buildViewerModel(before.model, before.registry);
  const walkthrough = adaptWalkthroughSource(viewerModel);
  const afterBytes = await readFile(modelUrl);

  assert.equal(sha256(afterBytes), sha256(before.modelBytes));
  assert.equal(viewerModel.modelHash, hashData(before.model));
  assert.equal(walkthrough.identity.sourceModelHash, viewerModel.modelHash);
  assert.equal(walkthrough.identity.modelVersion, viewerModel.modelVersion);
  assert.equal(walkthrough.identity.activeGeometryRevisionId, viewerModel.activeGeometryRevisionId);

  assert.notStrictEqual(walkthrough.entities['POOL-01'].bounds, viewerModel.entityBounds['POOL-01'].bounds);
  assert.notStrictEqual(walkthrough.waterVolumes[0].bounds, viewerModel.geometry.pool.bounds);
  assert.ok(Object.isFrozen(walkthrough));
  assert.ok(Object.isFrozen(walkthrough.entities['POOL-01'].bounds));
  assert.throws(() => {
    walkthrough.entities['POOL-01'].bounds.x1 = 999;
  }, TypeError);
  assert.equal(viewerModel.entityBounds['POOL-01'].bounds.x1, 3);
});

test('walkthrough adapter exposes the complete MVP semantic descriptors', async () => {
  const { model, registry } = await loadCanonicalInputs();
  const viewerModel = buildViewerModel(model, registry);
  const walkthrough = adaptWalkthroughSource(viewerModel);

  assert.deepEqual(walkthrough.referenceFrame, {
    coordinateSystemId: 'SITE-XY',
    adapterId: 'SITE-XYZ-TO-THREE-RH',
    siteX: 'threeX',
    siteY: 'negativeThreeZ',
    siteZ: 'threeY',
    worldBearingDegrees: 307,
  });
  assert.deepEqual(Object.keys(walkthrough.entities).sort(), [
    'BLDG-01',
    'EN-01',
    'L2-PLATE-01',
    'L3-EXT-01',
    'L3-PLATE-01',
    'POOL-01',
    'RF-L3-01',
    'RF-PV-RES-01',
    'SITE-01',
    'ST-01',
    'ST-02',
    'Z-L3-ARRIVAL-01',
    'Z-L3-TERRACE-01',
  ]);

  assert.deepEqual(walkthrough.surfaces.map(({ id }) => id), [
    'site-ground',
    'l1-pool-deck',
    'l2-floor',
    'l3-rotated-floor',
    'l3-fixed-extension',
    'l3-arrival',
    'l3-terrace',
    'roof-inspection',
  ]);
  assert.deepEqual(walkthrough.stairs.map(({ entityId, lowerElevation, upperElevation }) => ({
    entityId,
    lowerElevation,
    upperElevation,
  })), [
    { entityId: 'ST-01', lowerElevation: 0.3, upperElevation: 3.3 },
    { entityId: 'ST-02', lowerElevation: 3.3, upperElevation: 6.88 },
  ]);
  assert.deepEqual(walkthrough.waterVolumes[0], {
    id: 'main-pool-water',
    kind: 'water-volume',
    entityId: 'POOL-01',
    coordinateSystemId: 'SITE-XY',
    bounds: { x1: 3, x2: 28, y1: 4, y2: 12.5 },
    surfaceElevation: 0.3,
    shallowEndX: 3,
    deepEndX: 28,
    shallowDepth: 1.2,
    deepDepth: 1.5,
    bottomProfile: 'linear-x-slope',
  });
  assert.equal(walkthrough.poolShells.length, 1);
  assert.equal(walkthrough.poolShells[0].entityId, 'POOL-01');
  assert.equal(walkthrough.openings.length, 7);
  assert.deepEqual(
    walkthrough.openings.map(({ entityId, clearHeight, heightStatus }) => ({
      entityId,
      clearHeight,
      heightStatus,
    })),
    [
      { entityId: 'EN-01', clearHeight: null, heightStatus: 'unresolved' },
      { entityId: 'OP-WC-POOL-M-01', clearHeight: 2.1, heightStatus: 'canonical-working' },
      { entityId: 'OP-WC-POOL-F-01', clearHeight: 2.1, heightStatus: 'canonical-working' },
      { entityId: 'OP-WC-PLAY-M-01', clearHeight: 2.1, heightStatus: 'canonical-working' },
      { entityId: 'OP-WC-PLAY-F-01', clearHeight: 2.1, heightStatus: 'canonical-working' },
      { entityId: 'OP-L2-CS-M-01', clearHeight: null, heightStatus: 'unresolved' },
      { entityId: 'OP-L2-CS-F-01', clearHeight: null, heightStatus: 'unresolved' },
    ],
  );
  assert.deepEqual(walkthrough.spawns.map(({ id, entityId }) => ({ id, entityId })), [
    { id: 'entrance', entityId: 'EN-01' },
    { id: 'l1-pool-deck', entityId: 'POOL-01' },
    { id: 'l2-arrival', entityId: 'ST-01' },
    { id: 'l3-arrival', entityId: 'Z-L3-ARRIVAL-01' },
    { id: 'l3-terrace', entityId: 'Z-L3-TERRACE-01' },
    { id: 'roof-inspection', entityId: 'RF-PV-RES-01' },
  ]);
  assert.deepEqual(walkthrough.capabilities, {
    inspectModePreserved: true,
    desktopInput: true,
    touchInput: true,
    walking: true,
    stairTraversal: true,
    areaJump: true,
    surfaceSwimming: true,
    underwaterSwimming: true,
    futureVisualAssetAdapter: true,
  });
});

test('walkthrough adapter fails closed for invalid identity, coordinate, entity, and geometry data', async () => {
  const { model, registry } = await loadCanonicalInputs();
  const valid = buildViewerModel(model, registry);

  const corruptions = [
    {
      label: 'active geometry version mismatch',
      mutate: (value) => { value.activeGeometryRevisionId = 'GEO-0.0.0'; },
      error: /activeGeometryRevisionId must match modelVersion/,
    },
    {
      label: 'missing revision',
      mutate: (value) => { value.revision = ''; },
      error: /revision is required/,
    },
    {
      label: 'invalid model hash',
      mutate: (value) => { value.modelHash = 'not-a-sha256'; },
      error: /modelHash must be a canonical SHA-256/,
    },
    {
      label: 'wrong coordinate system',
      mutate: (value) => { value.coordinateSystemId = 'LEGACY-XY'; },
      error: /coordinateSystemId must be SITE-XY/,
    },
    {
      label: 'wrong Three adapter',
      mutate: (value) => { value.referenceSystem.coordinateAdapter.adapterId = 'LEGACY-ADAPTER'; },
      error: /SITE-XYZ-TO-THREE-RH/,
    },
    {
      label: 'missing required entity',
      mutate: (value) => { delete value.entityBounds['Z-L3-ARRIVAL-01']; },
      error: /required entity Z-L3-ARRIVAL-01/,
    },
    {
      label: 'non-positive entity bounds',
      mutate: (value) => { value.entityBounds['POOL-01'].bounds.x2 = 3; },
      error: /POOL-01 bounds must have positive area/,
    },
    {
      label: 'geometry drift from canonical bounds',
      mutate: (value) => { value.geometry.stair.bounds.y2 = 5; },
      error: /ST-01 geometry must match canonical entity bounds/,
    },
    {
      label: 'non-finite pool depth',
      mutate: (value) => { value.geometry.pool.deepDepth.value = Number.NaN; },
      error: /pool.deepDepth must be finite/,
    },
    {
      label: 'stair overlaps pool',
      mutate: (value) => {
        value.geometry.stair.bounds.y2 = 4.5;
        value.entityBounds['ST-01'].bounds.y2 = 4.5;
      },
      error: /ST-01 must remain outside POOL-01/,
    },
  ];

  for (const { label, mutate, error } of corruptions) {
    const broken = clone(valid);
    mutate(broken);
    assert.throws(() => adaptWalkthroughSource(broken), error, label);
  }
});

test('walkthrough experience configuration is isolated from the canonical model', async () => {
  const { modelBytes } = await loadCanonicalInputs();
  const modelText = modelBytes.toString('utf8');

  assert.equal(WALKTHROUGH_CONFIG.player.eyeHeight, 1.65);
  assert.equal(WALKTHROUGH_CONFIG.player.capsuleRadius, 0.28);
  assert.equal(WALKTHROUGH_CONFIG.player.walkSpeed, 1.4);
  assert.equal(WALKTHROUGH_CONFIG.player.fastWalkSpeed, 2.8);
  assert.equal(WALKTHROUGH_CONFIG.physics.gravity, 9.81);
  assert.ok(Object.isFrozen(WALKTHROUGH_CONFIG));
  assert.ok(Object.isFrozen(WALKTHROUGH_CONFIG.player));

  for (const forbiddenKey of [
    'walkthrough',
    'eyeHeight',
    'capsuleRadius',
    'fastWalkSpeed',
    'surfaceSwimSpeed',
    'underwaterSwimSpeed',
  ]) {
    assert.doesNotMatch(modelText, new RegExp(`"${forbiddenKey}"\\s*:`));
  }
});
