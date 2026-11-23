import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  geometryEntities,
  resolveActiveGeometry,
  resolveGeometryEntity,
} from '../geometry/active-geometry.mjs';
import { deriveSiteOrientation, rotateSitePointClockwise } from '../geometry/site-orientation.mjs';
import {
  boundsOverlapArea,
  deriveStairFlights,
  polygonArea,
  firstHeadroomShortfallX,
  rotatedBoundsPolygon,
} from '../geometry/stair-geometry.mjs';

const TOLERANCE = 0.002;
const closeTo = (actual, expected, tolerance = TOLERANCE) =>
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
const sameBounds = (actual, expected) =>
  ['x1', 'x2', 'y1', 'y2'].every((key) => closeTo(actual?.[key], expected[key]));
const positiveOverlap = (a, b) =>
  Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > TOLERANCE &&
  Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > TOLERANCE;
const containedBy = (inner, outer) =>
  inner.x1 >= outer.x1 - TOLERANCE &&
  inner.x2 <= outer.x2 + TOLERANCE &&
  inner.y1 >= outer.y1 - TOLERANCE &&
  inner.y2 <= outer.y2 + TOLERANCE;

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function check(errors, condition, message) {
  if (!condition) errors.push(message);
}

function pathsContainingKey(value, targetKey, path = 'model') {
  if (!value || typeof value !== 'object') return [];
  const matches = [];
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (key === targetKey) matches.push(nextPath);
    matches.push(...pathsContainingKey(entry, targetKey, nextPath));
  }
  return matches;
}

export function validateModel(model) {
  const errors = [];
  let active;
  try {
    active = resolveActiveGeometry(model);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  check(errors, model.schemaVersion === '1.5.0', 'schemaVersion must be 1.5.0.');
  check(errors, /^\d+\.\d+\.\d+$/.test(model.modelVersion), 'modelVersion must be semantic x.y.z.');
  check(
    errors,
    model.designTargetVersion === model.modelVersion,
    'designTargetVersion must equal modelVersion.',
  );
  check(
    errors,
    active.id === `GEO-${active.revision}`,
    'Active geometry revision ID must match its immutable geometry revision.',
  );
  check(errors, active.coordinateSystemId === 'SITE-XY', 'Active geometry must use SITE-XY.');

  const coordinateSystem = model.referenceSystem?.coordinateSystems?.find(
    ({ id }) => id === 'SITE-XY',
  );
  check(
    errors,
    Boolean(coordinateSystem),
    'SITE-XY must be declared once in referenceSystem.coordinateSystems.',
  );
  check(
    errors,
    model.referenceSystem?.coordinateSystems?.filter(({ id }) => id === 'SITE-XY').length === 1,
    'SITE-XY must not be duplicated.',
  );
  check(
    errors,
    sameBounds(coordinateSystem?.bounds, { x1: 0, x2: 41, y1: 0, y2: 14 }),
    'SITE-XY bounds must be X0–41/Y0–14.',
  );
  check(
    errors,
    coordinateSystem?.renderAdapters?.three === 'x-to-x-y-to-negative-z-z-to-y-right-handed',
    'Three.js adapter must preserve handedness: SITE X->Three X, SITE Y->Three -Z, SITE Z->Three Y.',
  );
  for (const forbiddenKey of [
    'localLongAxisBearingFromTrueNorth',
    'rotationFromTrueNorth',
    'rightwardBearingFromTrueNorth',
    'northArrowPlanDirection',
  ]) {
    check(
      errors,
      pathsContainingKey(model, forbiddenKey).length === 0,
      `${forbiddenKey} must not duplicate referenceSystem.siteOrientation.`,
    );
  }
  let siteOrientation;
  try {
    siteOrientation = deriveSiteOrientation(model.referenceSystem);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  check(
    errors,
    siteOrientation?.positiveXAxisBearingFromTrueNorth === 307 &&
      siteOrientation?.negativeXAxisBearingFromTrueNorth === 127,
    'Canonical SITE-XY long axis must remain +X 307 degrees and -X 127 degrees.',
  );
  check(
    errors,
    model.referenceSystem?.siteOrientation?.status === 'confirmed' &&
      model.referenceSystem?.siteOrientation?.positiveXAxisDirection ===
        'pool-remote-to-service-core' &&
      JSON.stringify(model.referenceSystem?.siteOrientation?.sourceIds) ===
        JSON.stringify(['SRC-SITE-001', 'SRC-SITE-002']),
    'Canonical site orientation must be confirmed from pool remote end to service core and cite both site sources.',
  );
  const latitude = model.referenceSystem?.siteLocation?.latitude;
  const longitude = model.referenceSystem?.siteLocation?.longitude;
  check(
    errors,
    closeTo(latitude?.value, 24.14434, 1e-6) && closeTo(longitude?.value, 120.67341, 1e-6),
    'Site coordinates must match the preserved PVGIS source location.',
  );
  check(
    errors,
    latitude?.sourceIds?.includes('SRC-SITE-001') &&
      latitude?.sourceIds?.includes('SRC-SITE-003') &&
      longitude?.sourceIds?.includes('SRC-SITE-001') &&
      longitude?.sourceIds?.includes('SRC-SITE-003'),
    'Site coordinates must cite both the site-location source and the preserved PVGIS machine source.',
  );

  const requiredBounds = {
    'SITE-01': { x1: 0, x2: 41, y1: 0, y2: 14 },
    'BLDG-01': { x1: 0.5, x2: 39, y1: 0, y2: 14 },
    'Z-PH-01': { x1: 0.5, x2: 31, y1: 0, y2: 14 },
    'POOL-01': { x1: 3, x2: 28, y1: 4, y2: 12.5 },
    'CORE-01': { x1: 31, x2: 39, y1: 0, y2: 14 },
    'F-L1-Y0-01': { x1: 0.5, x2: 39, y1: 0, y2: 0.14 },
    'EN-01': { x1: 1, x2: 3, y1: 0, y2: 0.2 },
    'Z-L1-WEST-SETBACK-01': { x1: 0, x2: 0.5, y1: 0, y2: 14 },
    'RF-L1-WEST-EAVE-01': { x1: 0, x2: 0.5, y1: 0, y2: 14 },
    'RF-L1-REAR-CANOPY-01': { x1: 31, x2: 39, y1: 13.5, y2: 14.5 },
    'RW-WEST-01': { x1: 0, x2: 0.5, y1: 0, y2: 14 },
    'L2-PLATE-01': { x1: 29, x2: 41, y1: 0, y2: 13.5 },
    'CLG-L2-01': { x1: 29, x2: 41, y1: 0, y2: 13.5 },
    'F-L2-Y0-01': { x1: 29, x2: 41, y1: 0, y2: 0.14 },
    'W-L2-ST-CH-01': { x1: 32, x2: 41, y1: 2.43, y2: 2.57 },
    'L3-PLATE-01': { x1: 29, x2: 41, y1: 0, y2: 13.5 },
    'RF-L3-01': { x1: 27.472, x2: 41, y1: 0, y2: 13.5 },
    'RF-GL-01': { x1: 0, x2: 29, y1: 0, y2: 14 },
    'ST-01': { x1: 20.5, x2: 29, y1: 0.5, y2: 2 },
    'ST-02': { x1: 32.5, x2: 41, y1: 0.5, y2: 2 },
    'Z-ST-02-01': { x1: 32.5, x2: 41, y1: 0, y2: 2.5 },
    'Z-ST-02-PLANT-01': { x1: 33.2, x2: 34.6, y1: 0.72, y2: 1.78 },
    'Z-L2-CORRIDOR-01': { x1: 29, x2: 32.5, y1: 0, y2: 13.5 },
    'Z-CS-M-01': { x1: 32, x2: 41, y1: 2.5, y2: 8 },
    'Z-CS-F-01': { x1: 32, x2: 41, y1: 8, y2: 13.5 },
    'L3-EXT-01': { x1: 38.428, x2: 41, y1: 0, y2: 5.392 },
    'Z-L3-ARRIVAL-01': { x1: 38.666, x2: 41, y1: 0.5, y2: 3.039 },
    'Z-L3-TERRACE-01': { x1: 38.428, x2: 41, y1: 0, y2: 5.392 },
    'Z-L3-LEARN-01': { x1: 29, x2: 41, y1: 0, y2: 5.5 },
    'Z-L3-MEP-01': { x1: 29, x2: 41, y1: 5.5, y2: 13.5 },
    'W-L3-GLASS-01': { x1: 29, x2: 41, y1: 5.43, y2: 5.57 },
    'OP-L3-ST-02-01': { x1: 34.85, x2: 39.5, y1: 0.5, y2: 2 },
    'Z-WC-POOL-M-01': { x1: 31, x2: 35.5, y1: 0, y2: 3.5 },
    'Z-WC-POOL-F-01': { x1: 31, x2: 35.5, y1: 3.5, y2: 7.5 },
    'Z-WC-PLAY-M-01': { x1: 35.5, x2: 39, y1: 0, y2: 3.5 },
    'Z-WC-PLAY-F-01': { x1: 35.5, x2: 39, y1: 3.5, y2: 7.5 },
    'Z-WTP-01': { x1: 34, x2: 39, y1: 7.5, y2: 14 },
    'Z-CHEM-01': { x1: 37.5, x2: 39, y1: 11, y2: 14 },
    'Z-L1-ENTRY-01': { x1: 0.5, x2: 4.5, y1: 0, y2: 2 },
    'RMP-L1-ENTRY-01': { x1: 4.5, x2: 8.1, y1: 0, y2: 1.2 },
    'STP-L1-ENTRY-01': { x1: 4.5, x2: 5.1, y1: 1.2, y2: 2 },
    'Z-L1-DRY-01': { x1: 4.5, x2: 20.5, y1: 0, y2: 2 },
    'W-L1-DRY-01': { x1: 4.5, x2: 17.5, y1: 1.95, y2: 2.05 },
    'Z-L1-RINSE-01': { x1: 17.5, x2: 20.5, y1: 2, y2: 4 },
    'Z-L1-ASSEMBLY-01': { x1: 3, x2: 17.5, y1: 2, y2: 4 },
    'FX-L1-LIFEGUARD-01': { x1: 14.6, x2: 15.4, y1: 2.4, y2: 3.6 },
    'Z-L1-ACC-01': { x1: 31, x2: 34, y1: 7.5, y2: 10.5 },
    'Z-L1-STAFF-01': { x1: 31, x2: 34, y1: 10.5, y2: 14 },
    'Z-L1-EQUIP-01': { x1: 28, x2: 31, y1: 12.5, y2: 14 },
    'FX-L1-LIFT-01': { x1: 29.1, x2: 29.9, y1: 8.6, y2: 9.4 },
    'POOL-PLAT-01': { x1: 3, x2: 9, y1: 9.5, y2: 12.5 },
    'RF-PV-RES-01': { x1: 27.722, x2: 40.75, y1: 0.25, y2: 13.25 },
  };
  for (const [entityId, expected] of Object.entries(requiredBounds)) {
    let entity;
    try {
      entity = resolveGeometryEntity(active, entityId);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    check(
      errors,
      sameBounds(entity.bounds, expected),
      `${entityId} bounds must match the active SITE-XY contract.`,
    );
  }

  const pool = resolveGeometryEntity(active, 'POOL-01');
  const poolHall = resolveGeometryEntity(active, 'Z-PH-01');
  const serviceWing = resolveGeometryEntity(active, 'CORE-01');
  const stair = resolveGeometryEntity(active, 'ST-01');
  check(
    errors,
    containedBy(pool.bounds, poolHall.bounds),
    'POOL-01 must remain inside the pool hall.',
  );
  check(
    errors,
    !positiveOverlap(pool.bounds, stair.bounds),
    'ST-01 must not intrude into POOL-01.',
  );
  check(
    errors,
    !positiveOverlap(pool.bounds, serviceWing.bounds),
    'POOL-01 must not intrude into the service wing.',
  );
  check(
    errors,
    closeTo(active.l1.pool.shallowDepth, 1.2) && closeTo(active.l1.pool.deepDepth, 1.5),
    'POOL-01 depths must remain 1.2–1.5 m.',
  );
  check(
    errors,
    active.l1.pool.laneBands?.length === 4,
    'POOL-01 must preserve the four confirmed width bands.',
  );

  const zones = Object.values(active.l1.zones);
  const toilets = zones.filter((zone) => zone.fixtures);
  check(errors, toilets.length === 4, 'L1 must contain four independent toilet zones.');
  check(
    errors,
    toilets.every((zone) => containedBy(zone.bounds, serviceWing.bounds)),
    'All toilet zones must stay within CORE-01.',
  );
  for (let i = 0; i < toilets.length; i += 1) {
    for (let j = i + 1; j < toilets.length; j += 1) {
      check(
        errors,
        !positiveOverlap(toilets[i].bounds, toilets[j].bounds),
        `${toilets[i].entityId} and ${toilets[j].entityId} must not overlap.`,
      );
    }
  }
  const entrances = active.l1.toiletEntrances ?? [];
  check(
    errors,
    entrances.length === 4,
    'Exactly four independent toilet entrance openings are required.',
  );
  check(
    errors,
    entrances.filter(({ side }) => side === 'x31').length === 2,
    'Pool-side toilets require exactly two X31 entrances.',
  );
  check(
    errors,
    entrances.filter(({ side }) => side === 'x39').length === 2,
    'Playground-side toilets require exactly two X39 entrances.',
  );
  check(
    errors,
    entrances.every(({ clearWidth }) => closeTo(clearWidth, 1)),
    'All toilet entrances must have 1.00 m clear width.',
  );
  check(
    errors,
    entrances.every(
      ({ openingType, doorLeaf }) => openingType === 'doorless-opening' && doorLeaf === false,
    ),
    'All toilet entrances must be doorless openings.',
  );
  const entranceById = Object.fromEntries(
    entrances.map((entrance) => [entrance.entityId, entrance]),
  );
  check(
    errors,
    entranceById['OP-WC-POOL-M-01']?.facadePosition === 'right' &&
      closeTo(entranceById['OP-WC-POOL-M-01']?.center?.[1], 1),
    'Pool male entrance must be on the right when viewed from the pool hall.',
  );
  check(
    errors,
    entranceById['OP-WC-POOL-F-01']?.facadePosition === 'left' &&
      closeTo(entranceById['OP-WC-POOL-F-01']?.center?.[1], 6.5),
    'Pool female entrance must be on the left at Y6.0–7.0.',
  );
  check(
    errors,
    entranceById['OP-WC-PLAY-M-01']?.facadePosition === 'left' &&
      closeTo(entranceById['OP-WC-PLAY-M-01']?.center?.[1], 1),
    'Playground male entrance must be on the left when viewed from the playground.',
  );
  check(
    errors,
    entranceById['OP-WC-PLAY-F-01']?.facadePosition === 'right' &&
      closeTo(entranceById['OP-WC-PLAY-F-01']?.center?.[1], 6.5),
    'Playground female entrance must be on the right at Y6.0–7.0.',
  );
  check(
    errors,
    active.l1.zones.poolMaleToilet?.layout?.washbasinWall === 'y0' &&
      active.l1.zones.playgroundMaleToilet?.layout?.washbasinWall === 'y0',
    'Both male toilet washbasins must line the Y0 wall after entry.',
  );
  check(
    errors,
    active.l1.zones.poolFemaleToilet?.layout?.washbasinWall === 'y7.5' &&
      active.l1.zones.playgroundFemaleToilet?.layout?.washbasinWall === 'y7.5',
    'Both female toilet washbasins must line the Y7.5 wall after entry.',
  );
  check(
    errors,
    toilets.every((zone) =>
      zone.layout?.toiletCubicles?.every(({ doorLeaf }) => doorLeaf === true),
    ),
    'Every internal WC cubicle must retain a door leaf.',
  );
  check(
    errors,
    toilets.every(
      (zone) => zone.privacyScreen === false && zone.layout?.privacyScreen === undefined,
    ),
    'All toilet entrance privacy screens must remain removed in v0.6.3.',
  );
  check(
    errors,
    toilets.every((zone) =>
      zone.layout?.toiletCubicles?.every(({ wallContact }) => wallContact === 'y3.5'),
    ),
    'Every WC cubicle must contact the Y3.5 wall.',
  );
  check(
    errors,
    active.l1.zones.poolFemaleToilet.layout.toiletCubicles.length === 3,
    'Pool female toilet must have three WCs on Y3.5.',
  );
  check(
    errors,
    active.l1.zones.poolMaleToilet.layout.toiletCubicles.length === 2,
    'Pool male toilet must have two WCs on Y3.5.',
  );
  check(
    errors,
    active.l1.zones.playgroundFemaleToilet.layout.toiletCubicles.length === 2,
    'Playground female toilet must have two WCs on Y3.5.',
  );
  check(
    errors,
    active.l1.zones.playgroundMaleToilet.layout.toiletCubicles.length === 1,
    'Playground male toilet must have one WC on Y3.5.',
  );
  check(
    errors,
    active.l1.zones.poolMaleToilet.layout.urinals.some(
      ({ center, wallContact }) => closeTo(center[0], 31.18) && wallContact === 'x31',
    ),
    'One pool male urinal must move to the X31 wall.',
  );
  check(
    errors,
    active.l1.zones.playgroundMaleToilet.fixtures.urinals === 2 &&
      active.l1.zones.playgroundMaleToilet.layout.urinals.length === 2,
    'Playground male toilet must have two adjacent urinals in v0.6.3.',
  );
  check(
    errors,
    active.l1.zones.playgroundMaleToilet.fixtures.washbasins === 2 &&
      active.l1.zones.playgroundMaleToilet.layout.washbasins.length === 2,
    'Playground male toilet must have two adjacent washbasins in v0.6.3.',
  );
  check(
    errors,
    active.l1.zones.playgroundFemaleToilet.fixtures.washbasins === 2 &&
      active.l1.zones.playgroundFemaleToilet.layout.washbasins.length === 2,
    'Playground female toilet must have two adjacent washbasins in v0.6.3.',
  );
  check(
    errors,
    active.l1.zones.playgroundMaleToilet.layout.washbasins.some(
      ({ center, existing }) => closeTo(center[0], 37.7) && existing === true,
    ),
    'The existing playground male washbasin must remain at X37.7.',
  );
  check(
    errors,
    active.l1.zones.playgroundFemaleToilet.layout.washbasins.some(
      ({ center, existing }) => closeTo(center[0], 37.7) && existing === true,
    ),
    'The existing playground female washbasin must remain at X37.7.',
  );
  check(
    errors,
    active.l1.zones.playgroundMaleToilet.layout.urinals.some(
      ({ center, existing }) => closeTo(center[0], 37.3) && existing === true,
    ),
    'The existing playground male urinal must remain at X37.3.',
  );
  const l1Cubicles = toilets.flatMap((zone) => zone.layout?.toiletCubicles ?? []);
  const seatedCubicles = l1Cubicles.filter(({ fixtureType }) => fixtureType === 'seated');
  const squatCubicles = l1Cubicles.filter(({ fixtureType }) => fixtureType === 'squat');
  check(errors, l1Cubicles.length === 8, 'L1 must preserve exactly eight WC cubicles.');
  check(
    errors,
    seatedCubicles.length === 4 && squatCubicles.length === 4,
    'L1 WC fixtures must be divided into four seated and four squat pans.',
  );
  check(
    errors,
    toilets.every((zone) =>
      zone.layout?.toiletCubicles?.some(({ fixtureType }) => fixtureType === 'seated'),
    ),
    'Every L1 toilet room must contain at least one seated WC.',
  );
  const expectedFixtureTypes = {
    'Z-WC-POOL-M-01': ['seated', 'squat'],
    'Z-WC-POOL-F-01': ['seated', 'squat', 'squat'],
    'Z-WC-PLAY-M-01': ['seated'],
    'Z-WC-PLAY-F-01': ['squat', 'seated'],
  };
  check(
    errors,
    toilets.every(
      (zone) =>
        zone.fixtures.toilets === zone.layout?.toiletCubicles?.length &&
        JSON.stringify(zone.layout.toiletCubicles.map(({ fixtureType }) => fixtureType)) ===
          JSON.stringify(expectedFixtureTypes[zone.entityId]),
    ),
    'Each L1 toilet room must preserve the approved ordered seated/squat distribution and fixture count.',
  );
  check(
    errors,
    l1Cubicles.every(
      ({ fixtureCenter, fixtureFacing, planBounds }) =>
        Array.isArray(fixtureCenter) &&
        fixtureCenter.length === 2 &&
        fixtureCenter.every(Number.isFinite) &&
        fixtureCenter[0] > planBounds.x1 &&
        fixtureCenter[0] < planBounds.x2 &&
        fixtureCenter[1] > planBounds.y1 &&
        fixtureCenter[1] < planBounds.y2 &&
        ['positive-y', 'negative-y'].includes(fixtureFacing),
    ),
    'Every L1 WC fixture must have a finite in-cubicle center and a supported facing.',
  );
  check(
    errors,
    active.l1.serviceWing?.architecturalStyle?.scope === 'all-opaque-l1-l2-l3-service-volumes',
    'All opaque service volumes must use the confirmed fair-faced concrete style.',
  );
  check(
    errors,
    active.l1.y0ExteriorFacade?.materialIntent ===
      'segmented-safety-glass-and-fair-faced-concrete' &&
      active.l1.y0ExteriorFacade?.poolHallMaterialIntent === 'safety-glass' &&
      active.l1.y0ExteriorFacade?.serviceWingMaterialIntent === 'fair-faced-exposed-concrete' &&
      active.l1.y0ExteriorFacade?.segments?.length === 4 &&
      active.l1.y0ExteriorFacade?.segments?.at(-1)?.x1 === 31 &&
      active.l1.y0ExteriorFacade?.segments?.at(-1)?.x2 === 39 &&
      active.l1.y0ExteriorFacade?.mainEntranceEntityId === 'EN-01',
    'L1 Y0 must keep pool-hall glass at X0.5–31 and fair-faced concrete only at service body X31–39.',
  );
  check(
    errors,
    sameBounds(active.l1.mainEntrance?.bounds, { x1: 1, x2: 3, y1: 0, y2: 0.2 }),
    'EN-01 must shift +0.5 m to X1–3/Y0.',
  );
  check(
    errors,
    sameBounds(active.l1.westSetback?.bounds, { x1: 0, x2: 0.5, y1: 0, y2: 14 }) &&
      sameBounds(active.l1.westGlassEave?.bounds, { x1: 0, x2: 0.5, y1: 0, y2: 14 }) &&
      active.l1.westGlassEave?.rainwaterRecoveryEntityId === 'RW-WEST-01',
    'The west wall setback must create the X0–0.5 glass eave and rainwater recovery zone.',
  );
  check(
    errors,
    sameBounds(active.l1.rearGlassCanopy?.bounds, { x1: 31, x2: 39, y1: 13.5, y2: 14.5 }) &&
      active.l1.rearGlassCanopy?.buildingLineY === 14 &&
      active.l1.rearGlassCanopy?.siteBoundsUnchanged === true,
    'The service rear glass canopy must project from Y13.5 to Y14.5 while SITE-XY remains Y0–14.',
  );
  check(
    errors,
    active.l1.zones.chemicalRoom?.publicAccess === false,
    'The chemical room must remain independent from public circulation.',
  );

  // DEC-157: shoes stay at the entry and the foot of ST-01 is the dry/wet boundary.
  const use = active.l1.poolUse ?? {};
  const useBounds = (key) => use[key]?.bounds;
  const deckInPoolHall = [
    'entryVestibule',
    'entryRamp',
    'entrySteps',
    'dryCorridor',
    'dryCorridorParapet',
    'rinseGate',
    'assemblyArea',
    'lifeguardChair',
    'equipmentParking',
    'poolLift',
  ];
  check(errors, use.decisionId === 'DEC-157', 'L1 pool-use program must cite DEC-157.');
  check(
    errors,
    deckInPoolHall.every((key) => useBounds(key) && containedBy(useBounds(key), poolHall.bounds)),
    'DEC-157 entry, corridor, rinse, assembly and equipment zones must stay inside the pool hall.',
  );
  check(
    errors,
    deckInPoolHall.every((key) => useBounds(key) && !positiveOverlap(useBounds(key), pool.bounds)),
    'DEC-157 deck zones must not intrude into POOL-01.',
  );
  check(
    errors,
    [
      'dryCorridor',
      'dryCorridorParapet',
      'entryVestibule',
      'entryRamp',
      'entrySteps',
      'rinseGate',
      'assemblyArea',
    ].every((key) => useBounds(key) && !positiveOverlap(useBounds(key), stair.bounds)),
    'DEC-157 zones must leave the ST-01 footprint clear.',
  );
  check(
    errors,
    useBounds('entryVestibule') &&
      useBounds('entryVestibule').x1 <= active.l1.mainEntrance.bounds.x1 + TOLERANCE &&
      useBounds('entryVestibule').x2 >= active.l1.mainEntrance.bounds.x2 - TOLERANCE &&
      closeTo(useBounds('entryVestibule').y1, 0),
    'The shoe-change vestibule must sit directly inside EN-01.',
  );
  check(
    errors,
    closeTo(use.entryVestibule?.floorElevation, active.levels.l1BaseElevation) &&
      use.entryVestibule?.shoeCubbyPairs >= 60,
    'The vestibule must stay at the L1 base elevation with at least 60 shoe cubbies for two overlapping classes.',
  );
  const ramp = use.entryRamp;
  check(
    errors,
    ramp &&
      closeTo(
        ramp.toElevation - ramp.fromElevation,
        active.levels.poolDeckElevation - active.levels.l1BaseElevation,
      ) &&
      ramp.slopeRatio >= 12 &&
      ramp.bounds.x2 - ramp.bounds.x1 + TOLERANCE >=
        (ramp.toElevation - ramp.fromElevation) * ramp.slopeRatio,
    'The entry ramp must rise the full 0.30 m at 1:12 or gentler.',
  );
  const steps = use.entrySteps;
  check(
    errors,
    steps &&
      closeTo(
        steps.risers * steps.riserHeight,
        active.levels.poolDeckElevation - active.levels.l1BaseElevation,
      ),
    'The entry steps must rise exactly from the L1 base to the pool deck.',
  );
  check(
    errors,
    closeTo(use.dryCorridor?.floorElevation, active.levels.poolDeckElevation) &&
      closeTo(useBounds('dryCorridor')?.x2, stair.bounds.x1) &&
      closeTo(useBounds('dryCorridor')?.x1, useBounds('entryVestibule')?.x2),
    'The dry corridor must run at deck level from the vestibule to the foot of ST-01.',
  );
  check(
    errors,
    closeTo(use.dryCorridorParapet?.height, 1.1) &&
      use.dryCorridorParapet?.curbHeight > 0 &&
      closeTo(useBounds('dryCorridorParapet')?.x2, useBounds('rinseGate')?.x1),
    'The dry corridor must be separated by a 1.1 m low wall with a splash curb that ends at the rinse gate.',
  );
  check(
    errors,
    use.rinseGate?.footBath === true &&
      use.rinseGate?.showerHeads === 3 &&
      use.rinseGate?.onlyRouteFromStairToDeck === true &&
      closeTo(useBounds('rinseGate')?.x2, stair.bounds.x1),
    'The foot of ST-01 must open to the deck only through the foot bath and three showers.',
  );
  check(
    errors,
    useBounds('lifeguardChair') &&
      containedBy(useBounds('lifeguardChair'), useBounds('assemblyArea')),
    'The lifeguard chair must stand on the assembly deck.',
  );
  const serviceRooms = [use.accessibleChanging, use.staffFirstAid, active.l1.zones.waterTreatment];
  check(
    errors,
    serviceRooms.every((zone) => zone?.bounds && containedBy(zone.bounds, serviceWing.bounds)),
    'The accessible room, staff/first-aid room and water treatment must stay within CORE-01.',
  );
  check(
    errors,
    serviceRooms.every((zone, index) =>
      serviceRooms.slice(index + 1).every((other) => !positiveOverlap(zone.bounds, other.bounds)),
    ) &&
      serviceRooms.every((zone) =>
        toilets.every((toilet) => !positiveOverlap(zone.bounds, toilet.bounds)),
      ),
    'Service rooms must not overlap each other or the four toilets.',
  );
  check(
    errors,
    use.accessibleChanging?.entrySide === 'x31' &&
      closeTo(use.accessibleChanging?.floorElevation, active.levels.poolDeckElevation) &&
      ['accessible-toilet', 'accessible-shower', 'family-changing'].every((name) =>
        use.accessibleChanging?.functions?.includes(name),
      ),
    'The L1 accessible family room must open from the X31 deck at deck level.',
  );
  check(
    errors,
    use.staffFirstAid?.entrySide === 'x31' && use.staffFirstAid?.poolViewWindowSide === 'x31',
    'The staff/first-aid room must open to and overlook the pool from X31.',
  );
  for (const room of [use.accessibleChanging, use.staffFirstAid]) {
    const door = room?.entrance;
    const half = (door?.clearWidth ?? 0) / 2;
    check(
      errors,
      door?.center?.[0] === room?.bounds?.x1 &&
        door.clearWidth >= 0.9 &&
        door.clearHeight >= 2 &&
        door.center[1] - half >= room.bounds.y1 &&
        door.center[1] + half <= room.bounds.y2,
      `${room?.entityId} needs a door of at least 0.90 m clear width on its X31 wall, inside the room.`,
    );
  }
  const poolWindow = use.staffFirstAid?.poolViewWindow;
  const staffDoor = use.staffFirstAid?.entrance;
  check(
    errors,
    poolWindow &&
      poolWindow.spanY[0] >= use.staffFirstAid.bounds.y1 &&
      poolWindow.spanY[1] <= use.staffFirstAid.bounds.y2 &&
      poolWindow.sillHeight < poolWindow.headHeight &&
      staffDoor &&
      (poolWindow.spanY[1] <= staffDoor.center[1] - staffDoor.clearWidth / 2 ||
        poolWindow.spanY[0] >= staffDoor.center[1] + staffDoor.clearWidth / 2),
    'The staff/first-aid pool-view window must sit in the X31 wall of that room without overlapping its door.',
  );
  check(
    errors,
    !('storage' in active.l1.zones),
    'DEC-157 replaces the dry storage room; it must not remain in the active L1 zones.',
  );
  check(
    errors,
    use.poolLift?.type === 'mobile',
    'Pool entry assistance must be a mobile lift (DEC-157 E3).',
  );
  const routeIds = (use.classRoute ?? []).map(({ id }) => id);
  check(
    errors,
    JSON.stringify(routeIds) ===
      JSON.stringify([
        'route-entry',
        'route-corridor',
        'route-stair',
        'route-rinse',
        'route-assembly',
      ]),
    'The class route must run entry, corridor, stair, rinse, assembly.',
  );
  const entityIds = new Set(geometryEntities(active).keys());
  check(
    errors,
    (use.classRoute ?? []).every(
      ({ standAt, faceEntityId }) =>
        Array.isArray(standAt) && standAt.every(Number.isFinite) && entityIds.has(faceEntityId),
    ),
    'Every class route stop needs a finite stand point and an existing faced entity.',
  );

  // DEC-158: depth stays 1.2–1.5 m; a removable platform serves beginners in the teaching band.
  const platform = active.l1.pool.teachingPlatform;
  const teachingBand = active.l1.pool.laneBands?.find(({ id }) => id === 'POOL-MIXED-01');
  check(
    errors,
    platform?.removable === true &&
      platform?.laneBandId === 'POOL-MIXED-01' &&
      containedBy(platform.bounds, pool.bounds) &&
      closeTo(platform.bounds.y1, teachingBand?.y1) &&
      closeTo(platform.bounds.y2, teachingBand?.y2) &&
      closeTo(platform.bounds.x1, pool.bounds.x1),
    'The removable teaching platform must fill the teaching band from the shallow end.',
  );
  check(
    errors,
    Number.isFinite(platform?.topWaterDepth) &&
      platform.topWaterDepth > 0 &&
      platform.topWaterDepth < active.l1.pool.shallowDepth,
    'The teaching platform must sit below the water surface and above the shallow-end floor.',
  );
  check(
    errors,
    active.l1.structuralStrategy?.glassCarriesGravityLoad === false,
    'Glass must not be a gravity-support element.',
  );
  check(
    errors,
    active.l1.structuralStrategy?.isolatedColumnsAllowed === false,
    'The integrated structure strategy must avoid isolated columns.',
  );

  check(
    errors,
    closeTo(active.levels.poolDeckElevation, 0.3),
    'Pool deck elevation must be +0.30 m.',
  );
  check(
    errors,
    closeTo(active.levels.l2Elevation, 3.3) && closeTo(active.levels.l3Elevation, 6.88),
    'L2/L3 elevations must be +3.30/+6.88 m.',
  );
  check(
    errors,
    active.stair.riserCount === 20 && active.stair.treadsPerRun === 9,
    'ST-01 must contain 20 risers and 18 treads.',
  );
  check(
    errors,
    closeTo(active.stair.runLengthPerFlight, 2.7) && closeTo(active.stair.midLandingLength, 3.1),
    'ST-01 must use 2.70 + 3.10 + 2.70 m plan geometry.',
  );
  check(
    errors,
    closeTo(active.stair.upperElevation, active.levels.l2Elevation),
    'ST-01 must connect directly to L2.',
  );
  check(
    errors,
    active.stair.upperConnection === 'direct-to-l2-at-x29',
    'ST-01 must not use a short bridge to L2.',
  );
  check(
    errors,
    active.stair.designIntent === 'suspended-floating-stair' &&
      active.stair.stringerCount === 2 &&
      active.stair.underStairEnclosure === false,
    'ST-01 must remain a suspended floating stair on two continuous stringers with an open underside.',
  );

  check(
    errors,
    closeTo(active.l2.poolAtriumOverlap, 2) && closeTo(active.l2.rightSetbackOverhang, 2),
    'L2 must preserve the two 2 m overhang relationships.',
  );
  check(
    errors,
    active.l2.gridDisplay?.minorSpacing === 0.5 &&
      active.l2.gridDisplay?.majorSpacing === 2.5 &&
      active.l2.gridDisplay?.axisLabels === true,
    'L2 must expose the 0.5 m / 2.5 m SITE-XY grid with axis labels.',
  );
  check(
    errors,
    closeTo(active.l2.circulationZone?.area, 41.75) &&
      active.l2.circulationZone?.standingOnly === true &&
      active.l2.circulationZone?.seatingAllowed === false,
    'L2 must provide the 41.75 m² standing-only L-shaped pool-view corridor.',
  );
  check(
    errors,
    closeTo(active.l2.stairZone?.area, 21.25) &&
      active.l2.stairZone?.y0Facade === 'full-width-safety-glass' &&
      active.l2.stairZone?.y2_5Divider === 'continuous-fair-faced-exposed-concrete',
    'L2 must keep the independent Y0–2.5 stair zone with full-width Y0 glass and a continuous Y2.5 concrete divider.',
  );
  check(
    errors,
    active.l2.y0ExteriorFacade?.materialIntent === 'full-width-safety-glass' &&
      active.l2.y0ExteriorFacade?.opaqueSegments === false,
    'L2 Y0 must be full-width safety glass without opaque wall segments.',
  );
  check(
    errors,
    active.l2.stairChangingDivider?.axis === 'y2.5' &&
      JSON.stringify(active.l2.stairChangingDivider?.spanX) === JSON.stringify([32, 41]) &&
      active.l2.stairChangingDivider?.openings?.length === 0 &&
      active.l2.stairChangingDivider?.continuous === true,
    'L2 Y2.5 divider must fill X32–41 without an opening from the stair zone to the changing room.',
  );
  check(
    errors,
    active.l2.ceiling?.continuous === true &&
      closeTo(active.l2.ceiling?.elevation, 6.88) &&
      sameBounds(active.l2.ceiling?.bounds, active.l2.floorPlate.bounds),
    'L2 must have a complete ceiling over the full fixed floor-plate bounds.',
  );
  check(
    errors,
    active.l2.changingRoomEntries?.length === 2 &&
      active.l2.changingRoomEntries.every(
        ({ clearWidth, doorLeaf, openingType }) =>
          closeTo(clearWidth, 1) && doorLeaf === false && openingType === 'doorless-opening',
      ),
    'L2 male and female changing rooms must each have one 1.00 m doorless X32 entrance.',
  );
  check(
    errors,
    active.l2.corridorFeatures?.standingCounter?.chairs === 0 &&
      active.l2.corridorFeatures?.standingCounter?.suspended === true,
    'The L2 corridor counter must be suspended and have no chairs.',
  );
  check(
    errors,
    active.l2.corridorFeatures?.poolObservationWindow?.wall === 'x29',
    'The L2 pool observation window must remain on X29.',
  );
  const showerZones = Object.values(active.l2.zones ?? {});
  check(
    errors,
    showerZones.length === 2 &&
      showerZones.every(
        ({ showerCount, showerCubicles }) => showerCount === 15 && showerCubicles?.length === 15,
      ),
    'L2 must provide 15 male and 15 female showers.',
  );
  check(
    errors,
    showerZones.every(
      ({ showerModuleSize, showerDimensionBasis }) =>
        closeTo(showerModuleSize?.[0], 1.2) &&
        closeTo(showerModuleSize?.[1], 1.2) &&
        showerDimensionBasis === 'inclusive-of-partitions',
    ),
    'Every L2 shower must use a 1.20 × 1.20 m module inclusive of partitions.',
  );
  check(
    errors,
    showerZones.every(({ showerCubicles }) =>
      showerCubicles.every(
        ({ planBounds }) =>
          closeTo(planBounds.x2 - planBounds.x1, 1.2) &&
          closeTo(planBounds.y2 - planBounds.y1, 1.2),
      ),
    ),
    'Every L2 shower cubicle plan module must measure 1.20 × 1.20 m.',
  );
  check(
    errors,
    showerZones.every(({ showerCubicles }) =>
      showerCubicles.every(
        ({ planBounds }) => !positiveOverlap(planBounds, active.l2.stairZone.bounds),
      ),
    ),
    'L2 shower cubicles must not overlap the independent ST-02 zone.',
  );
  check(
    errors,
    showerZones.every(
      ({ supportFixtures }) =>
        supportFixtures?.fixtures?.toilets === 1 &&
        supportFixtures?.fixtures?.washbasins === 2 &&
        supportFixtures.toiletCubicles?.length === 1 &&
        supportFixtures.washbasins?.length === 2,
    ),
    'Each L2 changing room must provide one WC and two washbasins.',
  );
  check(
    errors,
    active.l2.stairToL3.lowerStartX === 32.5 &&
      active.l2.stairToL3.axis === '+x' &&
      JSON.stringify(active.l2.stairToL3.yBandLocked) === JSON.stringify([0.5, 2]),
    'ST-02 must start at X32.5 and remain horizontal in Y0.5–2 while ascending +X.',
  );
  const stair2 = active.l2.stairToL3;
  const stair2Flights = deriveStairFlights(stair2);
  check(
    errors,
    stair2.riserCount === 23 &&
      JSON.stringify(stair2.risersPerRun) === JSON.stringify([12, 11]) &&
      JSON.stringify(stair2.treadsPerRun) ===
        JSON.stringify(stair2Flights.flights.map(({ treads }) => treads)),
    'ST-02 must use 23 risers in flights of 12 and 11 (DEC-174).',
  );
  check(
    errors,
    stair2.riserHeight <= 0.16 &&
      stair2.treadDepth >= 0.26 &&
      closeTo(stair2.riserCount * stair2.riserHeight, stair2.totalRise),
    'ST-02 risers must stay at or below 0.16 m and treads at or above 0.26 m (Building Technical Regulations art. 33, first column).',
  );
  check(
    errors,
    stair2.runLengths?.length === 2 &&
      stair2Flights.flights.every(({ run }, index) => closeTo(stair2.runLengths[index], run)) &&
      closeTo(stair2.midLandingElevation, stair2Flights.midLanding.elevation),
    'ST-02 run lengths and mid-landing elevation must follow from its riser counts.',
  );
  check(
    errors,
    closeTo(stair2Flights.upperElevation, 6.88) &&
      closeTo(stair2Flights.topX + stair2.upperLandingLength, stair2.bounds.x2) &&
      closeTo(stair2.midLandingLength, 1.5) &&
      closeTo(stair2.upperLandingLength, 1.5),
    'ST-02 must keep both 1.50 m landings and reach L3 +6.88 m at X41.',
  );
  check(
    errors,
    active.l2.stairToL3.designIntent === 'suspended-floating-stair' &&
      active.l2.stairToL3.stringerCount === 2 &&
      active.l2.stairToL3.underStairEnclosure === false,
    'ST-02 must be a suspended floating stair with two continuous stringers and an open underside.',
  );
  check(
    errors,
    active.l2.stairToL3.underStairLandscape?.planterCount === 3 &&
      active.l2.stairToL3.underStairLandscape?.containers === 'removable-lightweight-planters' &&
      active.l2.stairToL3.underStairLandscape?.deepSoil === false &&
      active.l2.stairToL3.underStairLandscape?.waterFeature === false,
    'ST-02 under-stair landscape must use three removable lightweight planters without deep soil or water features.',
  );
  check(errors, closeTo(active.l3.planRotation, 25.5), 'L3 plan rotation must be +25.5°.');
  check(
    errors,
    closeTo(active.l3.mirror.leanFromVertical, 23),
    'L3 mirror wall lean must be +23.0°.',
  );
  check(
    errors,
    active.l3.mirror.wallAndMirrorCoplanar === true,
    'The mirror and loadbearing wall must remain coplanar.',
  );
  check(
    errors,
    active.l3.mirror.sideWallEndGapsFilled === true && active.l3.mirror.roofEdgeContinuous === true,
    'L3 mirror end gaps must be filled and the mirror top must meet the complete roof.',
  );
  check(
    errors,
    closeTo(active.l3.planPivot.x, 35) && closeTo(active.l3.planPivot.y, 6.75),
    'L3 plan pivot must remain X35/Y6.75.',
  );
  check(
    errors,
    closeTo(active.l3.orthogonalExtension.grossArea, 6.935) &&
      active.l3.orthogonalExtension.rotation === 0 &&
      active.l3.orthogonalExtension.withinL2Projection === true,
    'L3 must add the fixed orthogonal 6.935 m² extension within the L2 projection.',
  );
  check(
    errors,
    closeTo(active.l3.arrivalWing.area, 4.388) &&
      active.l3.arrivalWing.covered === true &&
      active.l3.arrivalWing.connectsStairToIndoorL3 === true &&
      active.l3.arrivalWing.soleRouteViaTerrace === false,
    'ST-02 must arrive through a covered indoor L3 wing, not solely through the terrace.',
  );
  check(
    errors,
    closeTo(active.l3.landscapeTerrace.netLandscapeArea, 2.547) &&
      active.l3.landscapeTerrace.access === 'teachers-and-maintenance-only' &&
      active.l3.landscapeTerrace.studentsAllowed === false &&
      active.l3.landscapeTerrace.visitorsAllowed === false &&
      active.l3.landscapeTerrace.primaryEgress === false,
    'L3 landscape terrace must be controlled for teachers and maintenance staff only and must not be primary egress.',
  );
  check(
    errors,
    active.l3.roof?.continuous === true &&
      active.l3.roof?.extendsToMirrorTopEdge === true &&
      closeTo(active.l3.roof?.area, 182.628) &&
      closeTo(active.l3.roof?.baseElevation, 10.48),
    'L3 must have a complete 182.628 m² roof that extends to the leaned mirror top edge.',
  );
  check(
    errors,
    closeTo(active.l3.pvRoofReserve?.area, 169.364) &&
      closeTo(active.l3.pvRoofReserve?.roofArea, 182.628) &&
      closeTo(active.l3.pvRoofReserve?.coveragePercent, 92.74) &&
      closeTo(active.l3.pvRoofReserve?.perimeterSetback, 0.25) &&
      active.l3.pvRoofReserve?.moduleLayoutStatus === 'working-dense-concept-layout' &&
      active.l3.pvRoofReserve?.capacityStatus === 'deferred',
    'L3 PV must densely cover the complete roof after a 0.25 m perimeter setback without committing capacity.',
  );
  check(
    errors,
    active.l3.pvRoofReserve?.rotation === active.l3.planRotation &&
      active.l3.pvRoofReserve?.excludedSupports?.includes('existing-glass-pool-roof'),
    'The dense PV array must rotate with the L3 roof and remain separate from the glass pool roof.',
  );
  check(
    errors,
    active.l3.energyStorageStrategy?.preferredLocation ===
      'ground-level-independent-outdoor-enclosure' &&
      active.l3.energyStorageStrategy?.batteryObjectsOnGeneralL3Interior === false &&
      active.l3.energyStorageStrategy?.fireApproval === false,
    'Energy storage must prefer a ground-level independent outdoor enclosure and prohibit batteries in general L3 interior space.',
  );
  const l3Program = active.l3.programStrategy;
  check(
    errors,
    l3Program?.teacherObservationRoom === 'built-in-l3-learning-room' &&
      l3Program?.environmentalEducationDisplay ===
        'glass-partition-equipment-view-and-energy-dashboard' &&
      l3Program?.dryMaintenanceStorage === 'under-consideration-not-built',
    'L3 must hold the DEC-173 observation and environmental education room without building dry storage.',
  );
  check(
    errors,
    l3Program?.wholeClassUse === false &&
      JSON.stringify(l3Program?.userGroups) ===
        JSON.stringify(['teachers', 'booked-small-student-groups', 'maintenance-staff']),
    'L3 must be limited to teachers, booked small groups and maintenance staff, not whole classes (DEC-173).',
  );
  check(
    errors,
    l3Program?.mirrorOpenings === false &&
      l3Program?.poolViewing === 'pool-and-underwater-cameras-to-room-screens' &&
      active.l3.mirror.materialIntent === 'original-mirror',
    'L3 pool viewing must use cameras; the mirror wall stays a full mirror without openings or reflective glass (DEC-173).',
  );
  const learningRoom = active.l3.learningRoom;
  const stairOpening = active.l3.stairOpening;
  const slabUnderside = active.l2.ceiling.elevation - active.l2.ceiling.thickness;
  const headroomShortfallX = firstHeadroomShortfallX(
    stair2,
    slabUnderside,
    stairOpening?.requiredHeadroom ?? Number.NaN,
  );
  check(
    errors,
    stairOpening?.stairEntityId === stair2.entityId &&
      closeTo(stairOpening?.requiredHeadroom, 1.9) &&
      headroomShortfallX !== null &&
      stairOpening.bounds.x1 <= headroomShortfallX + TOLERANCE,
    'The ST-02 stair opening must start where headroom to the slab underside drops below 1.90 m (art. 35).',
  );
  check(
    errors,
    closeTo(stairOpening?.bounds.x2, stair2Flights.topX) &&
      closeTo(stairOpening?.bounds.y1, stair2.bounds.y1) &&
      closeTo(stairOpening?.bounds.y2, stair2.bounds.y2) &&
      closeTo(
        stairOpening?.area,
        (stairOpening.bounds.x2 - stairOpening.bounds.x1) *
          (stairOpening.bounds.y2 - stairOpening.bounds.y1),
      ),
    'The ST-02 stair opening must run to the top of the stair across its full width.',
  );
  check(
    errors,
    JSON.stringify(stairOpening?.cutsEntityIds) ===
      JSON.stringify([
        active.l2.ceiling.entityId,
        active.l3.floorPlate.entityId,
        active.l3.arrivalWing.entityId,
      ]) && stairOpening?.edgeProtection === 'guardrail-on-all-edges-except-stair-top',
    'The ST-02 stair opening must cut the L2 ceiling, the L3 plate and the arrival wing, with guardrails on every edge except the stair top.',
  );
  const learningRoomPolygon = rotatedBoundsPolygon(
    learningRoom.bounds,
    active.l3.planPivot,
    active.l3.planRotation,
  );
  const roomOverlap = boundsOverlapArea(stairOpening.bounds, learningRoomPolygon);
  const wingOverlap = boundsOverlapArea(stairOpening.bounds, active.l3.arrivalWing.polygon);
  check(
    errors,
    closeTo(stairOpening.learningRoomOverlapArea, roomOverlap) &&
      closeTo(learningRoom.stairOpeningOverlapArea, roomOverlap) &&
      closeTo(learningRoom.netArea, learningRoom.area - roomOverlap),
    'The L3 learning room net area must deduct the part of the ST-02 stair opening inside it.',
  );
  check(
    errors,
    closeTo(stairOpening.arrivalWingOverlapArea, wingOverlap) &&
      closeTo(active.l3.arrivalWing.walkableArea, active.l3.arrivalWing.area - wingOverlap),
    'The L3 arrival wing walkable area must deduct the part of the ST-02 stair opening inside it.',
  );
  const arrivalWing = active.l3.arrivalWing;
  check(
    errors,
    closeTo(arrivalWing.area, polygonArea(arrivalWing.polygon)) &&
      closeTo(
        active.l3.landscapeTerrace.netLandscapeArea,
        active.l3.orthogonalExtension.grossArea - arrivalWing.area,
      ) &&
      JSON.stringify(active.l3.landscapeTerrace.excludedArrivalWingPolygon) ===
        JSON.stringify(arrivalWing.polygon),
    'The arrival wing area and the terrace net area must follow from the arrival wing polygon.',
  );
  const entryDoor = learningRoom.entryDoor;
  const [roomEdgeStart, roomEdgeEnd] = [learningRoomPolygon[1], learningRoomPolygon[2]];
  const distanceToRoomEndWall = ([x, y]) => {
    const [ax, ay] = roomEdgeStart;
    const [bx, by] = roomEdgeEnd;
    return Math.abs((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / Math.hypot(bx - ax, by - ay);
  };
  // Back to the unrotated L3 plate, where the glass partition is a line of constant Y.
  const roomLocalY = ([x, y]) =>
    rotateSitePointClockwise({ x, y }, active.l3.planPivot, -active.l3.planRotation).y;
  const wingContactTopY = Math.max(
    ...arrivalWing.polygon
      .filter((point) => distanceToRoomEndWall(point) <= TOLERANCE)
      .map(([, y]) => y),
  );
  const doorEnds = entryDoor?.wallSegment ?? [];
  check(
    errors,
    doorEnds.length === 2 &&
      doorEnds.every(
        (point) =>
          distanceToRoomEndWall(point) <= TOLERANCE &&
          point[1] >= stairOpening.bounds.y2 - TOLERANCE &&
          point[1] <= wingContactTopY + TOLERANCE &&
          roomLocalY(point) <= active.l3.glassPartition.bounds.y1 + TOLERANCE,
      ) &&
      closeTo(
        entryDoor.wallLength,
        Math.hypot(doorEnds[1][0] - doorEnds[0][0], doorEnds[1][1] - doorEnds[0][1]),
      ),
    'The L3 learning room door must sit on its end wall where the arrival wing touches it, outside the ST-02 stair opening and short of the glass partition (DEC-175).',
  );
  const equipmentZone = active.l3.equipmentZone;
  const glassPartition = active.l3.glassPartition;
  check(
    errors,
    closeTo(learningRoom?.area, 66) &&
      closeTo(learningRoom?.rotation, active.l3.planRotation) &&
      learningRoom?.entryFrom === active.l3.arrivalWing.entityId,
    'The L3 learning room must cover 66 m² on the arrival side and rotate with L3.',
  );
  check(
    errors,
    closeTo(equipmentZone?.area, 96) &&
      closeTo(equipmentZone?.rotation, active.l3.planRotation) &&
      equipmentZone?.access === 'maintenance-staff-via-locked-door',
    'The L3 equipment zone must cover 96 m², rotate with L3 and stay maintenance-only.',
  );
  check(
    errors,
    closeTo(glassPartition?.rotation, active.l3.planRotation) &&
      JSON.stringify(glassPartition?.separates) ===
        JSON.stringify([learningRoom?.entityId, equipmentZone?.entityId]) &&
      glassPartition?.maintenanceDoor === 'locked',
    'An acoustic glass partition with a locked maintenance door must separate the L3 learning room from the equipment zone.',
  );
  check(
    errors,
    closeTo(
      learningRoom?.area + equipmentZone?.area,
      active.l3.orthogonalExtension.mainRotatedPlateArea,
    ),
    'L3 learning room and equipment zone must exactly divide the 162 m² rotated plate.',
  );
  check(
    errors,
    closeTo(active.roof.pitch, 5) &&
      closeTo(active.roof.lowElevation, 4) &&
      closeTo(active.roof.highElevation, 6.537),
    'The fixed glass roof must remain 29 m at 5° from +4.00 to +6.537 m.',
  );

  check(
    errors,
    closeTo(active.solar.planRotation.value, active.l3.planRotation),
    'Solar and L3 plan rotations must share one value.',
  );
  check(
    errors,
    closeTo(active.solar.mirrorLeanFromVertical.value, active.l3.mirror.leanFromVertical),
    'Solar and mirror-wall lean values must share one value.',
  );
  check(
    errors,
    closeTo(active.solar.azimuthTolerance?.value, 28),
    'Solar azimuth tolerance must remain the active 28-degree working criterion.',
  );
  check(
    errors,
    closeTo(active.solar.minimumDownwardAngle?.value, 8),
    'Solar minimum downward angle must remain the active 8-degree working criterion.',
  );
  check(
    errors,
    active.solar.analysisMethodRevision === 'SOLAR-METHOD-1.1.0',
    'Solar analysis method revision must be SOLAR-METHOD-1.1.0 (right-handed SITE-XY, DEC-150).',
  );
  check(
    errors,
    closeTo(active.solar.energyAssumptions?.mirrorReflectance, 0.75) &&
      closeTo(active.solar.energyAssumptions?.glazingSolarTransmittance, 0.6) &&
      closeTo(active.solar.energyAssumptions?.daylightStartHour, 7) &&
      closeTo(active.solar.energyAssumptions?.daylightEndHour, 17),
    'Solar energy assumptions must be owned by the active solar contract.',
  );
  check(
    errors,
    active.solar.weatherSourceId === 'SRC-SITE-003',
    'Solar weather source must be SRC-SITE-003.',
  );
  check(
    errors,
    model.geometry?.solarReflection &&
      Object.keys(model.geometry.solarReflection).length === 1 &&
      model.geometry.solarReflection.legacyV050Study?.status === 'legacy',
    'geometry.solarReflection must contain only the legacyV050Study historical record.',
  );
  check(
    errors,
    closeTo(active.solar.workingResult?.warmPoolAddedKWh, 0.002),
    'The X35 warm-season pool result must be the SOLAR-METHOD-1.1.0 value +0.002 kWh.',
  );
  check(
    errors,
    closeTo(active.solar.workingResult?.coolPoolAddedKWh, 1224.692),
    'The X35 cool-season pool result must be the SOLAR-METHOD-1.1.0 value +1,224.692 kWh.',
  );
  check(
    errors,
    active.solar.analysisStatus === 'working-optimized-requires-professional-validation',
    'Solar status must require professional validation.',
  );
  check(
    errors,
    active.integrationReview?.status ===
      'conceptual-coordination-complete-professional-approvals-outstanding',
    'Integration review must not claim professional approval.',
  );
  check(
    errors,
    Object.values(active.integrationReview?.professionalApprovals ?? {}).every(
      (value) => value === false,
    ),
    'No professional approval may be implied by the conceptual model.',
  );

  const idsByRegistry = [
    ['entity', model.entities ?? []],
    ['sheet', model.sheets ?? []],
    ['source', model.sources ?? []],
  ];
  for (const [label, records] of idsByRegistry) {
    for (const id of duplicates(records.map(({ id }) => id)))
      errors.push(`${label} ID is duplicated: ${id}`);
  }
  const sheetIds = (model.sheets ?? []).map(({ id }) => id);
  // DEC-170: sheet ids carry no version; the drawings page redirects the retired REF-001／V067-* anchors.
  check(
    errors,
    JSON.stringify(sheetIds) === JSON.stringify(['SITE', 'L1', 'L2', 'L3', 'SECTION']),
    'Current sheet registry must be exactly SITE, L1, L2, L3 and SECTION.',
  );
  check(
    errors,
    (model.sheets ?? []).every(({ title }) => !/v\d+\.\d+|最新/i.test(title ?? '')),
    'Sheet titles must not carry a version or the word 最新.',
  );

  const boundedEntities = geometryEntities(active);
  check(
    errors,
    boundedEntities.size >= Object.keys(requiredBounds).length,
    'Active geometry entity index is incomplete.',
  );
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
      if (actualHash !== source.sha256.toUpperCase())
        errors.push(`${source.id} SHA-256 does not match ${source.path}.`);
      if (Number.isFinite(source.byteSize) && source.byteSize !== bytes.byteLength)
        errors.push(`${source.id} byteSize does not match ${source.path}.`);
    } catch (error) {
      errors.push(
        `${source.id} cannot be read at ${source.path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return errors;
}
