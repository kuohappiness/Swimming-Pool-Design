import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { geometryEntities, resolveActiveGeometry, resolveGeometryEntity } from './active-geometry.mjs';

const TOLERANCE = 0.002;
const closeTo = (actual, expected, tolerance = TOLERANCE) => Number.isFinite(actual)
  && Math.abs(actual - expected) <= tolerance;
const sameBounds = (actual, expected) => ['x1', 'x2', 'y1', 'y2']
  .every((key) => closeTo(actual?.[key], expected[key]));
const positiveOverlap = (a, b) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > TOLERANCE
  && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > TOLERANCE;
const containedBy = (inner, outer) => inner.x1 >= outer.x1 - TOLERANCE
  && inner.x2 <= outer.x2 + TOLERANCE
  && inner.y1 >= outer.y1 - TOLERANCE
  && inner.y2 <= outer.y2 + TOLERANCE;

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function check(errors, condition, message) {
  if (!condition) errors.push(message);
}

export function validateModel(model) {
  const errors = [];
  let active;
  try {
    active = resolveActiveGeometry(model);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  check(errors, model.schemaVersion === '1.3.0', 'schemaVersion must be 1.3.0.');
  check(errors, model.modelVersion === '0.6.1', 'modelVersion must be 0.6.1.');
  check(errors, model.designTargetVersion === model.modelVersion, 'designTargetVersion must equal modelVersion.');
  check(errors, active.id === 'GEO-0.6.1', 'GEO-0.6.1 must be the active geometry revision.');
  check(errors, active.coordinateSystemId === 'SITE-XY', 'Active geometry must use SITE-XY.');

  const coordinateSystem = model.referenceSystem?.coordinateSystems?.find(({ id }) => id === 'SITE-XY');
  check(errors, Boolean(coordinateSystem), 'SITE-XY must be declared once in referenceSystem.coordinateSystems.');
  check(errors, model.referenceSystem?.coordinateSystems?.filter(({ id }) => id === 'SITE-XY').length === 1, 'SITE-XY must not be duplicated.');
  check(errors, sameBounds(coordinateSystem?.bounds, { x1: 0, x2: 41, y1: 0, y2: 14 }), 'SITE-XY bounds must be X0–41/Y0–14.');
  check(
    errors,
    coordinateSystem?.renderAdapters?.three === 'x-to-x-y-to-negative-z-z-to-y-right-handed',
    'Three.js adapter must preserve handedness: SITE X->Three X, SITE Y->Three -Z, SITE Z->Three Y.',
  );

  const requiredBounds = {
    'SITE-01': { x1: 0, x2: 41, y1: 0, y2: 14 },
    'BLDG-01': { x1: 0, x2: 39, y1: 0, y2: 14 },
    'Z-PH-01': { x1: 0, x2: 31, y1: 0, y2: 14 },
    'POOL-01': { x1: 3, x2: 28, y1: 4, y2: 12.5 },
    'CORE-01': { x1: 31, x2: 39, y1: 0, y2: 14 },
    'L2-PLATE-01': { x1: 29, x2: 41, y1: 0, y2: 13.5 },
    'L3-PLATE-01': { x1: 29, x2: 41, y1: 0, y2: 13.5 },
    'RF-GL-01': { x1: 0, x2: 29, y1: 0, y2: 14 },
    'ST-01': { x1: 20.5, x2: 29, y1: 0.5, y2: 2 },
    'Z-WC-POOL-M-01': { x1: 31, x2: 35.5, y1: 0, y2: 3.5 },
    'Z-WC-POOL-F-01': { x1: 31, x2: 35.5, y1: 3.5, y2: 7.5 },
    'Z-WC-PLAY-M-01': { x1: 35.5, x2: 39, y1: 0, y2: 3.5 },
    'Z-WC-PLAY-F-01': { x1: 35.5, x2: 39, y1: 3.5, y2: 7.5 },
    'Z-STOR-01': { x1: 31, x2: 32.5, y1: 7.5, y2: 14 },
    'Z-WTP-01': { x1: 32.5, x2: 39, y1: 7.5, y2: 14 },
    'Z-CHEM-01': { x1: 37.5, x2: 39, y1: 11, y2: 14 },
  };
  for (const [entityId, expected] of Object.entries(requiredBounds)) {
    let entity;
    try {
      entity = resolveGeometryEntity(active, entityId);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    check(errors, sameBounds(entity.bounds, expected), `${entityId} bounds must match the v0.6.1 SITE-XY contract.`);
  }

  const pool = resolveGeometryEntity(active, 'POOL-01');
  const poolHall = resolveGeometryEntity(active, 'Z-PH-01');
  const serviceWing = resolveGeometryEntity(active, 'CORE-01');
  const stair = resolveGeometryEntity(active, 'ST-01');
  check(errors, containedBy(pool.bounds, poolHall.bounds), 'POOL-01 must remain inside the pool hall.');
  check(errors, !positiveOverlap(pool.bounds, stair.bounds), 'ST-01 must not intrude into POOL-01.');
  check(errors, !positiveOverlap(pool.bounds, serviceWing.bounds), 'POOL-01 must not intrude into the service wing.');
  check(errors, closeTo(active.l1.pool.shallowDepth, 1.2) && closeTo(active.l1.pool.deepDepth, 1.5), 'POOL-01 depths must remain 1.2–1.5 m.');
  check(errors, active.l1.pool.laneBands?.length === 4, 'POOL-01 must preserve the four confirmed width bands.');

  const zones = Object.values(active.l1.zones);
  const toilets = zones.filter((zone) => zone.fixtures);
  check(errors, toilets.length === 4, 'L1 must contain four independent toilet zones.');
  check(errors, toilets.every((zone) => containedBy(zone.bounds, serviceWing.bounds)), 'All toilet zones must stay within CORE-01.');
  for (let i = 0; i < toilets.length; i += 1) {
    for (let j = i + 1; j < toilets.length; j += 1) {
      check(errors, !positiveOverlap(toilets[i].bounds, toilets[j].bounds), `${toilets[i].entityId} and ${toilets[j].entityId} must not overlap.`);
    }
  }
  const entrances = active.l1.toiletEntrances ?? [];
  check(errors, entrances.length === 4, 'Exactly four independent toilet entrance openings are required.');
  check(errors, entrances.filter(({ side }) => side === 'x31').length === 2, 'Pool-side toilets require exactly two X31 entrances.');
  check(errors, entrances.filter(({ side }) => side === 'x39').length === 2, 'Playground-side toilets require exactly two X39 entrances.');
  check(errors, entrances.every(({ clearWidth }) => closeTo(clearWidth, 1)), 'All toilet entrances must have 1.00 m clear width.');
  check(errors, entrances.every(({ openingType, doorLeaf }) => openingType === 'doorless-opening' && doorLeaf === false), 'All toilet entrances must be doorless openings.');
  const entranceById = Object.fromEntries(entrances.map((entrance) => [entrance.entityId, entrance]));
  check(errors, entranceById['OP-WC-POOL-M-01']?.facadePosition === 'right' && closeTo(entranceById['OP-WC-POOL-M-01']?.center?.[1], 1), 'Pool male entrance must be on the right when viewed from the pool hall.');
  check(errors, entranceById['OP-WC-POOL-F-01']?.facadePosition === 'left' && closeTo(entranceById['OP-WC-POOL-F-01']?.center?.[1], 6.5), 'Pool female entrance must be on the left at Y6.0–7.0.');
  check(errors, entranceById['OP-WC-PLAY-M-01']?.facadePosition === 'left' && closeTo(entranceById['OP-WC-PLAY-M-01']?.center?.[1], 1), 'Playground male entrance must be on the left when viewed from the playground.');
  check(errors, entranceById['OP-WC-PLAY-F-01']?.facadePosition === 'right' && closeTo(entranceById['OP-WC-PLAY-F-01']?.center?.[1], 6.5), 'Playground female entrance must be on the right at Y6.0–7.0.');
  check(errors, active.l1.zones.poolMaleToilet?.layout?.washbasinWall === 'y0' && active.l1.zones.playgroundMaleToilet?.layout?.washbasinWall === 'y0', 'Both male toilet washbasins must line the Y0 wall after entry.');
  check(errors, active.l1.zones.poolFemaleToilet?.layout?.washbasinWall === 'y7.5' && active.l1.zones.playgroundFemaleToilet?.layout?.washbasinWall === 'y7.5', 'Both female toilet washbasins must line the Y7.5 wall after entry.');
  check(errors, toilets.every((zone) => zone.layout?.toiletCubicles?.every(({ doorLeaf }) => doorLeaf === true)), 'Every internal WC cubicle must retain a door leaf.');
  check(errors, active.l1.serviceWing?.architecturalStyle?.scope === 'all-opaque-l1-l2-l3-service-volumes', 'All opaque service volumes must use the confirmed fair-faced concrete style.');
  check(errors, active.l1.zones.chemicalRoom?.publicAccess === false, 'The chemical room must remain independent from public circulation.');
  check(errors, active.l1.structuralStrategy?.glassCarriesGravityLoad === false, 'Glass must not be a gravity-support element.');
  check(errors, active.l1.structuralStrategy?.isolatedColumnsAllowed === false, 'The integrated structure strategy must avoid isolated columns.');

  check(errors, closeTo(active.levels.poolDeckElevation, 0.3), 'Pool deck elevation must be +0.30 m.');
  check(errors, closeTo(active.levels.l2Elevation, 3.3) && closeTo(active.levels.l3Elevation, 6.88), 'L2/L3 elevations must be +3.30/+6.88 m.');
  check(errors, active.stair.riserCount === 20 && active.stair.treadsPerRun === 9, 'ST-01 must contain 20 risers and 18 treads.');
  check(errors, closeTo(active.stair.runLengthPerFlight, 2.7) && closeTo(active.stair.midLandingLength, 3.1), 'ST-01 must use 2.70 + 3.10 + 2.70 m plan geometry.');
  check(errors, closeTo(active.stair.upperElevation, active.levels.l2Elevation), 'ST-01 must connect directly to L2.');
  check(errors, active.stair.upperConnection === 'direct-to-l2-at-x29', 'ST-01 must not use a short bridge to L2.');
  check(errors, active.stair.designIntent === 'suspended-floating-stair' && active.stair.stringerCount === 2 && active.stair.underStairEnclosure === false, 'ST-01 must remain a suspended floating stair on two continuous stringers with an open underside.');

  check(errors, closeTo(active.l2.poolAtriumOverlap, 2) && closeTo(active.l2.rightSetbackOverhang, 2), 'L2 must preserve the two 2 m overhang relationships.');
  check(errors, closeTo(active.l3.planRotation, 25.5), 'L3 plan rotation must be +25.5°.');
  check(errors, closeTo(active.l3.mirror.leanFromVertical, 23), 'L3 mirror wall lean must be +23.0°.');
  check(errors, active.l3.mirror.wallAndMirrorCoplanar === true, 'The mirror and loadbearing wall must remain coplanar.');
  check(errors, closeTo(active.l3.planPivot.x, 35) && closeTo(active.l3.planPivot.y, 6.75), 'L3 plan pivot must remain X35/Y6.75.');
  check(errors, closeTo(active.roof.pitch, 5) && closeTo(active.roof.lowElevation, 4) && closeTo(active.roof.highElevation, 6.537), 'The fixed glass roof must remain 29 m at 5° from +4.00 to +6.537 m.');

  check(errors, closeTo(active.solar.planRotation.value, active.l3.planRotation), 'Solar and L3 plan rotations must share one value.');
  check(errors, closeTo(active.solar.mirrorLeanFromVertical.value, active.l3.mirror.leanFromVertical), 'Solar and mirror-wall lean values must share one value.');
  check(errors, active.solar.workingResult?.warmPoolAddedKWh === 0, 'The X35 working result must keep warm-season added pool energy at zero.');
  check(errors, closeTo(active.solar.workingResult?.coolPoolAddedKWh, 1036.829), 'The X35 cool-season pool result must be +1,036.829 kWh.');
  check(errors, active.solar.analysisStatus === 'working-optimized-requires-professional-validation', 'Solar status must require professional validation.');
  check(errors, active.integrationReview?.status === 'conceptual-coordination-complete-professional-approvals-outstanding', 'Integration review must not claim professional approval.');
  check(errors, Object.values(active.integrationReview?.professionalApprovals ?? {}).every((value) => value === false), 'No professional approval may be implied by the conceptual model.');

  const idsByRegistry = [
    ['entity', model.entities ?? []],
    ['sheet', model.sheets ?? []],
    ['source', model.sources ?? []],
  ];
  for (const [label, records] of idsByRegistry) {
    for (const id of duplicates(records.map(({ id }) => id))) errors.push(`${label} ID is duplicated: ${id}`);
  }
  const sheetIds = (model.sheets ?? []).map(({ id }) => id);
  check(errors, JSON.stringify(sheetIds) === JSON.stringify(['REF-001', 'V061-L1', 'V061-L2', 'V061-L3', 'V061-SECTION']), 'Current sheet registry must contain only REF-001 and the four v0.6.1 sheets.');

  const boundedEntities = geometryEntities(active);
  check(errors, boundedEntities.size >= Object.keys(requiredBounds).length, 'Active geometry entity index is incomplete.');
  return errors;
}

export async function validateSourceFiles(model, repoRoot) {
  const errors = [];
  for (const source of model.sources ?? []) {
    if (!source.path || !source.sha256) {
      errors.push(`${source.id} must declare path and sha256.`);
      continue;
    }
    try {
      const bytes = await readFile(resolve(repoRoot, source.path));
      const actualHash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
      if (actualHash !== source.sha256.toUpperCase()) errors.push(`${source.id} SHA-256 does not match ${source.path}.`);
      if (Number.isFinite(source.byteSize) && source.byteSize !== bytes.byteLength) errors.push(`${source.id} byteSize does not match ${source.path}.`);
    } catch (error) {
      errors.push(`${source.id} cannot be read at ${source.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}
