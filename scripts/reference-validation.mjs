import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deriveReferenceGeometry } from './reference-geometry.mjs';

const GEOMETRY_TOLERANCE = 0.002;
const EXPECTED_LOCAL_ORIGIN = [27, 0, 0];
const FORBIDDEN_FORMAL_GEOMETRY_FIELDS = new Set(['mirrorFacade', 'leanAngle', 'displayRoofElevation']);
const FORBIDDEN_DERIVED_ROOF_FIELDS = new Set(['highElevation', 'lowElevation', 'farWallElevation']);
const SOURCE_CONTRACTS = {
  'SRC-CONCEPT-009': {
    id: 'SRC-CONCEPT-009',
    path: 'source-materials/concepts/SRC-CONCEPT-009_longitudinal-section-correction-annotated.png',
    kind: 'annotated-concept',
    pixelSize: [2216, 1130],
    sha256: '3CD710CEC62E32F2209EFA731FCF0EBFDA38A978BD0925A504481EE563175034',
  },
  'SRC-CONCEPT-010': {
    id: 'SRC-CONCEPT-010',
    path: 'source-materials/concepts/SRC-CONCEPT-010_l1-plan-v2.0.jpeg',
    kind: 'hand-sketch',
    pixelSize: [3840, 2110],
    sha256: '467B4CFB573A5250FCF5D5D74D02AF4D696071B35FCA0C1D96817DFFCA99BD08',
  },
  'SRC-CONCEPT-011': {
    id: 'SRC-CONCEPT-011',
    path: 'source-materials/concepts/SRC-CONCEPT-011_longitudinal-section-v2.0.jpeg',
    kind: 'hand-sketch',
    pixelSize: [3840, 2747],
    sha256: '3612C211F9AC06C6E9E8B40210C8282B7088DD81691D36F237C75E483329EB8B',
  },
};
const ENTITY_REGISTRY_CONTRACTS = {
  'Z-L1-ENTRY-01': { type: 'outdoor-forecourt', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008', 'SRC-CONCEPT-009'] },
  'RTE-L1-ARRIVAL-01': { type: 'arrival-route', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008'] },
  'OP-L1-PH-01': { type: 'outdoor-opening', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008'] },
  'DR-L1-WC-M-FRONT-01': { type: 'door', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008'] },
  'DR-L1-WC-M-REAR-01': { type: 'door', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-005', 'SRC-CONCEPT-008'] },
  'DR-L1-WC-F-FRONT-01': { type: 'door', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008'] },
  'DR-L1-WC-F-REAR-01': { type: 'door', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-005', 'SRC-CONCEPT-008'] },
  'PSG-L1-DRY-01': { type: 'dry-passage', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-005', 'SRC-CONCEPT-008'] },
  'F-MIR-01': { type: 'mirror-facade', level: 'L2', status: 'confirmed', sourceIds: ['SRC-CONCEPT-009'] },
  'J-RF-L2-01': { type: 'roof-joint', level: 'RF', status: 'confirmed', sourceIds: ['SRC-CONCEPT-001'] },
  'RC-RF-01': { type: 'rain-curtain', level: 'RF-L1', status: 'confirmed', sourceIds: [] },
  'RW-TR-01': { type: 'rainwater-catch-trench', level: 'L1', status: 'confirmed', sourceIds: [] },
  'RW-01': { type: 'rainwater-reuse-system', level: 'L1', status: 'working', sourceIds: [] },
};

const closeTo = (actual, expected, tolerance = GEOMETRY_TOLERANCE) =>
  Math.abs(actual - expected) <= tolerance;

const duplicateValues = (values) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

const isDeferredMeasure = (measure, openItemId) => measure?.value === null
  && measure?.status === 'deferred'
  && measure?.openItemId === openItemId
  && Array.isArray(measure?.sourceIds);

const boundsIntersectOrTouch = (a, b, tolerance = GEOMETRY_TOLERANCE) => Boolean(a && b)
  && a.x1 <= b.x2 + tolerance
  && a.x2 >= b.x1 - tolerance
  && a.y1 <= b.y2 + tolerance
  && a.y2 >= b.y1 - tolerance;

const boundsContainedBy = (inner, outer, tolerance = GEOMETRY_TOLERANCE) => Boolean(inner && outer)
  && inner.x1 >= outer.x1 - tolerance
  && inner.x2 <= outer.x2 + tolerance
  && inner.y1 >= outer.y1 - tolerance
  && inner.y2 <= outer.y2 + tolerance;

const pointContainedBy = (point, bounds, tolerance = GEOMETRY_TOLERANCE) => Boolean(point && bounds)
  && point.x >= bounds.x1 - tolerance
  && point.x <= bounds.x2 + tolerance
  && point.y >= bounds.y1 - tolerance
  && point.y <= bounds.y2 + tolerance;

const findForbiddenGeometryFields = (geometry) => {
  const findings = [];
  const visited = new WeakSet();

  const visit = (value, ownerPath) => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);

    for (const field of Object.keys(value)) {
      if (FORBIDDEN_FORMAL_GEOMETRY_FIELDS.has(field)) findings.push({ ownerPath, field });
      visit(value[field], `${ownerPath}.${field}`);
    }
  };

  visit(geometry, 'model.geometry');
  return findings;
};

export function validateModel(model) {
  const errors = [];
  const entities = Array.isArray(model.entities) ? model.entities : [];
  const sheets = Array.isArray(model.sheets) ? model.sheets : [];
  const sources = Array.isArray(model.sources) ? model.sources : [];
  const entityIds = entities.map((entity) => entity.id);
  const sheetIds = sheets.map((sheet) => sheet.id);
  const sourceIds = sources.map((source) => source.id);

  for (const [label, ids] of [
    ['entity', entityIds],
    ['sheet', sheetIds],
    ['source', sourceIds],
  ]) {
    for (const duplicate of duplicateValues(ids)) errors.push(`${label} ID is duplicated: ${duplicate}`);
  }

  const entitySet = new Set(entityIds);
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  for (const [id, contract] of Object.entries(SOURCE_CONTRACTS)) {
    const source = sourceById.get(id);
    if (!source) {
      errors.push(`${id} source contract mismatch: id must remain ${contract.id}`);
      continue;
    }
    if (source.path !== contract.path) {
      errors.push(`${id} source contract mismatch: path must remain ${contract.path}`);
    }
    if (source.kind !== contract.kind) {
      errors.push(`${id} source contract mismatch: kind must remain ${contract.kind}`);
    }
    if (!Array.isArray(source.pixelSize)
      || source.pixelSize.length !== contract.pixelSize.length
      || source.pixelSize.some((value, index) => value !== contract.pixelSize[index])) {
      errors.push(`${id} source contract mismatch: pixelSize must remain [${contract.pixelSize.join(', ')}]`);
    }
    if (source.sha256 !== contract.sha256) {
      errors.push(`${id} source contract mismatch: sha256 must remain ${contract.sha256}`);
    }
  }
  for (const sheet of sheets) {
    for (const entityId of sheet.referencedEntityIds ?? []) {
      if (!entitySet.has(entityId)) errors.push(`${sheet.id} references unknown entity: ${entityId}`);
    }
  }
  for (const entity of entities) {
    for (const sourceId of entity.sourceIds ?? []) {
      if (!sourceSet.has(sourceId)) errors.push(`${entity.id} references unknown source: ${sourceId}`);
    }
  }
  for (const [id, contract] of Object.entries(ENTITY_REGISTRY_CONTRACTS)) {
    const entity = entityById.get(id);
    const sourceIdsForEntity = entity?.sourceIds;
    if (!entity
      || entity.type !== contract.type
      || entity.level !== contract.level
      || entity.status !== contract.status) {
      errors.push(`${id} registry contract mismatch`);
      continue;
    }

    const hasExactUniqueSourceSet = Array.isArray(sourceIdsForEntity)
      && sourceIdsForEntity.length === contract.sourceIds.length
      && new Set(sourceIdsForEntity).size === sourceIdsForEntity.length
      && contract.sourceIds.every((sourceId) => sourceIdsForEntity.includes(sourceId))
      && sourceIdsForEntity.every((sourceId) => contract.sourceIds.includes(sourceId));
    if (!hasExactUniqueSourceSet) {
      errors.push(
        `${id} registry contract mismatch: sourceIds must be the exact unique set [${contract.sourceIds.join(', ')}]`,
      );
    }
  }

  const geometry = model.geometry ?? {};
  for (const { ownerPath, field } of findForbiddenGeometryFields(geometry)) {
    errors.push(`${ownerPath} must not define ${field} before the related OPEN item is resolved`);
  }
  const solar = model.geometry?.solarReflection;
  const exactMeasure = (measure, value, status) => measure?.value === value
    && measure?.status === status
    && Array.isArray(measure?.sourceIds)
    && measure.sourceIds.length === 0;

  if (!exactMeasure(solar?.planRotation, 9.5, 'confirmed')) {
    errors.push('solar plan rotation must remain confirmed at 9.5 degrees');
  }
  if (!exactMeasure(solar?.mirrorLeanFromVertical, 8.5, 'confirmed')) {
    errors.push('solar mirror lean must remain confirmed at 8.5 degrees');
  }
  if (solar?.rotationDirection !== 'clockwise-from-above') {
    errors.push('solar rotation direction must remain clockwise-from-above');
  }
  if (solar?.mirrorLeanDirection !== 'toward-pool') {
    errors.push('solar mirror lean direction must remain toward-pool');
  }
  if (!exactMeasure(solar?.azimuthTolerance, 28, 'working')) {
    errors.push('solar azimuth tolerance must remain working at 28 degrees');
  }
  if (!exactMeasure(solar?.minimumDownwardAngle, 8, 'working')) {
    errors.push('solar minimum downward angle must remain working at 8 degrees');
  }
  if (solar?.openItemId !== 'OPEN-011') {
    errors.push('solar reflection must remain linked to OPEN-011');
  }
  if (solar?.planPivot?.strategy !== 'l2-start-width-center'
    || solar?.planPivot?.status !== 'working'
    || solar?.planPivot?.openItemId !== 'OPEN-011'
    || !Array.isArray(solar?.planPivot?.sourceIds)) {
    errors.push('solar plan pivot must remain a working L2-start/width-center strategy linked to OPEN-011');
  }
  if (solar?.mirrorVisualWallHeight?.value !== 3.6
    || solar?.mirrorVisualWallHeight?.status !== 'working'
    || solar?.mirrorVisualWallHeight?.openItemId !== 'OPEN-011'
    || !Array.isArray(solar?.mirrorVisualWallHeight?.sourceIds)) {
    errors.push('mirror visual wall height must remain a 3.6 m working value linked to OPEN-011');
  }
  const { building, pool, roof, stair, combinedCubicle } = geometry;
  if (!building || !pool || !roof || !stair || !combinedCubicle) {
    errors.push('model.geometry must include building, pool, roof, stair, and combinedCubicle');
    return errors;
  }

  const numericMeasures = [
    ['building.length', building.length],
    ['building.width', building.width],
    ['building.poolHallLength', building.poolHallLength],
    ['building.serviceCoreLength', building.serviceCoreLength],
    ['building.l2ExtensionLength', building.l2ExtensionLength],
    ['building.l2VolumeHeight', building.l2VolumeHeight],
    ['pool.length', pool.length],
    ['pool.width', pool.width],
    ['pool.shallowDepth', pool.shallowDepth],
    ['pool.deepDepth', pool.deepDepth],
    ['roof.pitch', roof.pitch],
    ['roof.lowOverhang', roof.lowOverhang],
    ['solarReflection.mirrorVisualWallHeight', solar.mirrorVisualWallHeight],
  ];
  for (const [label, measure] of numericMeasures) {
    if (!Number.isFinite(measure?.value) || measure.value <= 0 || measure.status === 'deferred') {
      errors.push(`${label} must be a positive numeric measure`);
      continue;
    }
    for (const sourceId of measure.sourceIds ?? []) {
      if (!sourceSet.has(sourceId)) errors.push(`${label} references unknown source: ${sourceId}`);
    }
  }

  let derived;
  try {
    derived = deriveReferenceGeometry(model);
  } catch (error) {
    errors.push(`reference geometry cannot be derived: ${error.message}`);
  }

  if (!closeTo(building.length.value, building.poolHallLength.value + building.serviceCoreLength.value)) {
    errors.push('building length must equal pool hall length plus service core length');
  }
  const poolRight = pool.origin?.[0] + pool.length.value;
  const poolTop = pool.origin?.[1] + pool.width.value;
  if (!Number.isFinite(poolRight) || !Number.isFinite(poolTop)
    || pool.origin[0] <= 0 || pool.origin[1] <= 0
    || poolRight >= building.poolHallLength.value || poolTop >= building.width.value) {
    errors.push('pool must remain inside the pool hall with positive deck clearances');
  }
  if (pool.deepDepth.value <= pool.shallowDepth.value) errors.push('pool deep depth must exceed shallow depth');

  const bearing = model.referenceSystem?.localLongAxisBearingFromTrueNorth;
  const rotation = model.referenceSystem?.worldTransform?.rotationFromTrueNorth;
  if (bearing !== 307 || rotation !== 307) errors.push('orientation fields must both equal 307 degrees');
  if (bearing !== rotation) errors.push('orientation may only have one transform answer');
  if (model.referenceSystem?.worldOriginEntityId !== 'O-SITE-01') errors.push('world origin entity must be O-SITE-01');
  const localOrigin = model.referenceSystem?.worldTransform?.localOrigin;
  if (!Array.isArray(localOrigin)
    || localOrigin.length !== EXPECTED_LOCAL_ORIGIN.length
    || localOrigin.some((value, index) => !Number.isFinite(value) || value !== EXPECTED_LOCAL_ORIGIN[index])) {
    errors.push('local origin must remain [27, 0, 0] for the EN-01 and O-SITE-01 contract');
  }
  if (model.referenceSystem?.axes?.x !== 'east' || model.referenceSystem?.axes?.y !== 'north' || model.referenceSystem?.axes?.z !== 'up') {
    errors.push('world axes must remain +X east, +Y north, +Z up');
  }

  if (model.project?.name !== '國立臺中教育大學附設實驗國民小學游泳池改善概念設計') {
    errors.push('project name must identify the current school site');
  }

  const siteLocation = model.referenceSystem?.siteLocation;
  const latitude = siteLocation?.latitude?.value;
  const longitude = siteLocation?.longitude?.value;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push('site latitude must be valid');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push('site longitude must be valid');
  if (siteLocation?.timeZone !== 'Asia/Taipei' || siteLocation?.utcOffsetHours !== 8) {
    errors.push('site timezone must remain Asia/Taipei UTC+8');
  }
  for (const sourceId of [...(siteLocation?.latitude?.sourceIds ?? []), ...(siteLocation?.longitude?.sourceIds ?? [])]) {
    if (!sourceIds.includes(sourceId)) errors.push(`site location references missing source ${sourceId}`);
  }
  const rfLevel = model.referenceSystem?.levels?.find((level) => level.id === 'RF');
  const l1Level = model.referenceSystem?.levels?.find((level) => level.id === 'L1');
  const l2Level = model.referenceSystem?.levels?.find((level) => level.id === 'L2');
  if (l1Level?.elevation !== 0 || l1Level?.status !== 'confirmed' || !Array.isArray(l1Level?.sourceIds)) {
    errors.push('L1 level must remain the confirmed 0.000 m canonical datum');
  }
  if (l2Level?.elevation !== 4.5 || l2Level?.status !== 'confirmed' || !Array.isArray(l2Level?.sourceIds)) {
    errors.push('L2 level must remain the confirmed +4.500 m canonical elevation');
  }
  if (rfLevel?.elevation !== null || rfLevel?.status !== 'working' || Object.hasOwn(rfLevel ?? {}, 'openItemId')) {
    errors.push('RF must remain a working sloped level without a false single elevation');
  }

  if (roof.coverageZoneId !== 'Z-PH-01') errors.push('roof coverage zone must remain Z-PH-01');
  if (!exactMeasure(roof.pitch, 4.5, 'confirmed')) errors.push('roof pitch must remain confirmed at 4.5 degrees');
  if (!exactMeasure(roof.lowOverhang, 1.2, 'confirmed')) errors.push('roof low overhang must remain confirmed at 1.2 m');
  if (roof.highEdge !== 'l2-extension-edge' || roof.lowEdge !== 'far-pool-end') {
    errors.push('roof must rise from the far pool end to the L2 extension edge');
  }
  for (const field of FORBIDDEN_DERIVED_ROOF_FIELDS) {
    if (Object.hasOwn(roof, field)) {
      errors.push(`roof must not duplicate derived ${field}; referenceSystem.levels.L2.elevation is canonical`);
    }
  }
  if (!derived
    || !closeTo(derived.roofHighElevation, l2Level?.elevation)
    || !closeTo(derived.roofLowElevation, 2.91, 0.002)
    || !closeTo(derived.roofFarWallElevation, 3.005, 0.002)) {
    errors.push('roof elevations must derive from +4.500 m, 4.5 degrees, 19.0 m run, and 1.2 m overhang');
  }
  if (roof.jointEntityId !== 'J-RF-L2-01') errors.push('roof joint must use J-RF-L2-01');
  if (roof.supportedByExtension !== false) errors.push('glass roof and L2 extension must remain structurally independent');
  if (roof.jointStrategy !== 'independent-curb-movement-joint-double-flashing'
    || roof.l2Visor?.projection !== 0.75
    || roof.l2Visor?.visualThickness !== 0.15
    || roof.l2Visor?.shadowGap !== 0.12
    || roof.l2Visor?.sideReturn !== 0.6
    || roof.l2Visor?.supportsRoof !== false) {
    errors.push('J-RF-L2-01 must retain the approved independent joint and L2 visor hierarchy');
  }
  const curtain = roof.rainCurtain;
  if (curtain?.entityId !== 'RC-RF-01'
    || curtain?.type !== 'passive-full-width-overflow-curtain'
    || curtain?.equalizationTrough !== true
    || curtain?.dryWeatherRecirculation !== false
    || curtain?.catchTrenchEntityId !== 'RW-TR-01'
    || curtain?.catchTrenchType !== 'closed-isolated-removable-grating'
    || curtain?.groundRunoffIsolated !== true
    || curtain?.extremeRainBypass !== 'independent-high-level-overflow') {
    errors.push('roof rain curtain must remain passive, full-width, isolated, and independently bypassed');
  }
  const reuse = roof.rainwaterReuse;
  if (reuse?.entityId !== 'RW-01'
    || reuse?.source !== 'roof-only'
    || reuse?.firstFlush !== true
    || reuse?.debrisScreen !== true
    || reuse?.settlingAndFiltration !== true
    || reuse?.coveredStorage !== true
    || reuse?.use !== 'l1-toilet-flushing'
    || reuse?.potableMakeupIsolation !== 'visible-air-gap-or-approved-equivalent'
    || reuse?.identifiedSeparatePipework !== true
    || reuse?.overflow !== 'site-stormwater-or-infiltration'
    || reuse?.capacityStatus !== 'deferred'
    || reuse?.openItemId !== 'OPEN-014') {
    errors.push('rainwater reuse must remain roof-only, maintainable, isolated, and linked to OPEN-014 sizing');
  }

  if (Object.hasOwn(stair, 'totalRise')) {
    errors.push('ST-01 must not duplicate totalRise; L2 minus L1 elevation is canonical');
  }
  if (derived?.stairTotalRise !== 4.5
    || stair.width !== 1.8
    || stair.riserCount !== 30
    || stair.runs !== 2
    || stair.risersPerRun !== 15
    || stair.treadsPerRun !== 14
    || stair.treadDepth !== 0.3
    || stair.midLandingLength !== 1.8) {
    errors.push('ST-01 approved geometry must remain 4.5 m / 30 risers / 28 treads / 10.2 m');
  }
  if (stair.treadsPerRun !== stair.risersPerRun - 1) {
    errors.push('ST-01 treadsPerRun must equal risersPerRun - 1');
  }
  if (stair.stringers !== 2
    || stair.supportSystem !== 'S1-continuous-twin-box-stringers'
    || stair.landingSupport !== 'integrated-torsion-box-no-column'
    || stair.riserClosure !== 'closed'
    || stair.underStair !== 'fully-open'
    || stair.supportedByRoof !== false) {
    errors.push('ST-01 must retain dual stringers, open underside, and independent roof support');
  }
  const guard = stair.guardrail;
  if (guard?.primaryType !== 'full-height-vertical-tension-screen'
    || guard?.fallbackType !== 'laminated-glass'
    || guard?.minimumHeight !== 2.4
    || guard?.fallbackHeight !== 1.35
    || guard?.nominalLineSpacing !== 0.04) {
    errors.push('ST-01 guard must retain B tension-screen primary and A laminated-glass fallback');
  }
  if (guard?.collectorBeam !== 'concealed-independent-l2-or-gallery-structure') {
    errors.push('ST-01 guard collector must use independent L2 or gallery structure');
  }
  if (guard?.materialStatus !== 'deferred' || guard?.openItemId !== 'OPEN-013') {
    errors.push('ST-01 guard material must remain deferred under OPEN-013');
  }
  if (stair.enclosure !== 'dry-glass-gallery') {
    errors.push('ST-01 must retain a dry glass gallery');
  }
  if (stair.upperEndAlignment !== 'l2-split-axis') errors.push('ST-01 upper end must align with the L2 split axis');
  if (derived && !closeTo(derived.stairEndX, derived.l2SplitAxisX)) errors.push('derived stair end must equal the L2 split axis');

  if (!combinedCubicle.integratedChangingShower || !combinedCubicle.wallMountedCabinet) {
    errors.push('combined cubicles must integrate changing, showering, and a wall cabinet');
  }
  if (combinedCubicle.centralLockerArea) errors.push('centralLockerArea must remain false');

  const entrance = model.program?.entrance;
  if (entrance?.entityId !== 'EN-01' || entrance?.dailyPeopleEntrance !== true) errors.push('EN-01 must remain the daily people entrance');
  if (entrance && Object.hasOwn(entrance, 'sharedVestibuleZoneId')) {
    errors.push('L1 entrance must not define a shared indoor vestibule');
  }
  if (entrance?.arrivalContext !== 'school-playground'
    || entrance?.outdoorForecourtZoneId !== 'Z-L1-ENTRY-01'
    || entrance?.forecourtEnvironment !== 'outdoor') {
    errors.push('EN-01 must arrive from the school playground into the outdoor forecourt');
  }
  if (entrance?.arrivalPathEntityId !== 'RTE-L1-ARRIVAL-01'
    || entrance?.clearsStairEntityId !== 'ST-01'
    || entrance?.positiveStairClearanceRequired !== true) {
    errors.push('EN-01 must use RTE-L1-ARRIVAL-01 with positive clearance from ST-01');
  }
  if (entrance?.geometryStatus !== 'deferred' || entrance?.openItemId !== 'OPEN-008') {
    errors.push('L1 outdoor forecourt geometry must remain deferred under OPEN-008');
  }
  const expectedOutdoorOpenings = ['OP-L1-PH-01', 'DR-L1-WC-M-FRONT-01', 'DR-L1-WC-F-FRONT-01'];
  const outdoorOpenings = entrance?.outdoorOpeningEntityIds ?? [];
  if (entrance?.openingsIndependent !== true
    || outdoorOpenings.length !== expectedOutdoorOpenings.length
    || new Set(outdoorOpenings).size !== expectedOutdoorOpenings.length
    || expectedOutdoorOpenings.some((id) => !outdoorOpenings.includes(id))) {
    errors.push('L1 must define three distinct outdoor openings for the pool hall, male toilet, and female toilet');
  }
  for (const id of outdoorOpenings) {
    if (!entitySet.has(id)) errors.push(`outdoor opening references missing entity ${id}`);
  }
  const forecourtEntity = entityById.get('Z-L1-ENTRY-01');
  if (forecourtEntity?.type !== 'outdoor-forecourt' || forecourtEntity?.status !== 'confirmed'
    || /共用前室|vestibule/i.test(forecourtEntity?.name ?? '')) {
    errors.push('Z-L1-ENTRY-01 must be the confirmed outdoor forecourt, not an indoor vestibule');
  }

  const maleToilet = model.program?.l1?.maleToilet;
  const femaleToilet = model.program?.l1?.femaleToilet;
  if (maleToilet?.side !== 'lower-x' || femaleToilet?.side !== 'higher-x') {
    errors.push('L1 toilets must be male lower-X and female higher-X');
  }
  const expectedDoorIds = {
    male: { front: 'DR-L1-WC-M-FRONT-01', rear: 'DR-L1-WC-M-REAR-01' },
    female: { front: 'DR-L1-WC-F-FRONT-01', rear: 'DR-L1-WC-F-REAR-01' },
  };
  for (const [label, toilet] of Object.entries({ male: maleToilet, female: femaleToilet })) {
    if (toilet?.frontDoor?.entityId !== expectedDoorIds[label].front
      || toilet?.frontDoor?.connectsTo !== 'Z-L1-ENTRY-01'
      || toilet?.frontDoor?.access !== 'daily-open') {
      errors.push('L1 toilet front doors must independently connect to the outdoor forecourt');
    }
    if (toilet?.rearDoor?.entityId !== expectedDoorIds[label].rear
      || toilet?.rearDoor?.connectsTo !== 'PSG-L1-DRY-01'
      || toilet?.rearDoor?.access !== 'pool-hours-only') {
      errors.push('L1 toilet rear doors must be pool-hours-only');
    }
    if (toilet?.doorsDirectlyAligned !== false) errors.push('L1 toilet front and rear doors must be offset');
    if (toilet?.privacyScreen !== true) errors.push('L1 toilet entrances must include privacy screens');
  }

  const dryPassage = model.program?.l1?.dryPassage;
  const expectedRearDoors = ['DR-L1-WC-M-REAR-01', 'DR-L1-WC-F-REAR-01'];
  if (dryPassage?.entityId !== 'PSG-L1-DRY-01' || dryPassage?.side !== 'pool-side'
    || dryPassage?.connectsFromZoneId !== 'Z-PH-01' || dryPassage?.continuous !== true) {
    errors.push('L1 pool-side dry passage must be continuous from the pool hall');
  }
  const passageRearDoors = dryPassage?.connectsToDoorEntityIds ?? [];
  if (passageRearDoors.length !== expectedRearDoors.length
    || new Set(passageRearDoors).size !== expectedRearDoors.length
    || expectedRearDoors.some((id) => !passageRearDoors.includes(id))) {
    errors.push('L1 dry passage must connect to both toilet rear doors');
  }
  if (dryPassage?.geometryStatus !== 'deferred' || dryPassage?.openItemId !== 'OPEN-008') {
    errors.push('L1 dry passage geometry must remain deferred under OPEN-008');
  }

  const accessConflicts = model.program?.l1?.accessConflicts;
  if (accessConflicts?.stairEntityId !== 'ST-01'
    || accessConflicts?.blocksOutdoorOpenings !== false
    || accessConflicts?.blocksToiletDoors !== false
    || accessConflicts?.blocksDryPassage !== false) {
    errors.push('ST-01 must not block outdoor openings, toilet doors, or the dry passage');
  }
  if (derived) {
    const l1 = derived.diagrammaticL1;
    const stairTopY = stair.originY + stair.width;
    if (!l1 || l1.outdoorForecourtBounds.x1 !== derived.l1ServiceStartX
      || l1.outdoorForecourtBounds.x2 !== derived.l1ServiceEndX
      || l1.dryPassageBounds.x1 >= derived.l1ServiceStartX
      || l1.poolHallOpening.y <= stairTopY
      || closeTo(l1.maleFrontDoor.x, l1.maleRearDoor.x)
      || closeTo(l1.femaleFrontDoor.x, l1.femaleRearDoor.x)) {
      errors.push('derived L1 topology must keep the outdoor forecourt, continuous dry passage, offset doors, and stair clearance');
    }
    const arrivalPath = l1?.arrivalPath;
    const thresholdPoint = arrivalPath?.points?.[0];
    if (!thresholdPoint
      || !Array.isArray(localOrigin)
      || !closeTo(thresholdPoint.x, localOrigin[0])
      || !closeTo(thresholdPoint.y, localOrigin[1])
      || !pointContainedBy(thresholdPoint, arrivalPath?.thresholdBypassBounds)) {
      errors.push('L1 arrival path threshold must remain connected to EN-01 and O-SITE-01');
    }
    if (!boundsContainedBy(arrivalPath?.thresholdBypassBounds, l1?.outdoorForecourtBounds)
      || !boundsContainedBy(arrivalPath?.clearRunBounds, l1?.outdoorForecourtBounds)) {
      errors.push('L1 arrival path bounds must remain inside the outdoor forecourt');
    }
    if (!arrivalPath
      || arrivalPath.entityId !== 'RTE-L1-ARRIVAL-01'
      || !Number.isFinite(arrivalPath.minimumStairClearance)
      || arrivalPath.minimumStairClearance <= GEOMETRY_TOLERANCE
      || boundsIntersectOrTouch(arrivalPath.thresholdBypassBounds, arrivalPath.stairBounds)
      || boundsIntersectOrTouch(arrivalPath.clearRunBounds, arrivalPath.stairBounds)) {
      errors.push('L1 arrival path must maintain positive clearance from ST-01');
    }
  }

  const l2 = model.program?.l2;
  if (!l2?.strictGenderSeparation) errors.push('L2 gender zones must remain strictly separated');
  if (l2?.male?.side !== 'lower-x' || l2?.female?.side !== 'higher-x') errors.push('L2 must be male lower-X and female higher-X');

  const allCubicleIds = [];
  for (const [label, area] of Object.entries({ male: l2?.male, female: l2?.female })) {
    if (!area || area.baseCount !== 15 || area.activeIds?.length !== 15) {
      errors.push(`${label} must contain 15 active cubicles`);
      continue;
    }
    if (area.maximumCount !== 20 || area.activeIds.length + area.expansionIds.length !== 20) {
      errors.push(`${label} must retain capacity for 20 cubicles`);
    }
    allCubicleIds.push(...area.activeIds, ...area.expansionIds);
  }
  for (const duplicate of duplicateValues(allCubicleIds)) errors.push(`cubicle ID is duplicated: ${duplicate}`);

  const requiredEntityIds = [
    'Z-L1-ENTRY-01',
    'RTE-L1-ARRIVAL-01',
    ...expectedOutdoorOpenings,
    ...expectedRearDoors,
    'PSG-L1-DRY-01',
    'EXT-L2-01',
    'F-MIR-01',
    'J-RF-L2-01',
    'RC-RF-01',
    'RW-TR-01',
    'RW-01',
  ];
  for (const id of requiredEntityIds) {
    if (!entitySet.has(id)) errors.push(`required entity is missing: ${id}`);
  }
  const requiredSheetIds = ['REF-001', 'REF-101', 'REF-201', 'REF-301', 'REF-401', 'REF-501'];
  for (const id of requiredSheetIds) {
    if (!sheetIds.includes(id)) errors.push(`required sheet is missing: ${id}`);
  }
  const requiredSheetReferences = {
    'REF-101': [
      'Z-L1-ENTRY-01',
      'RTE-L1-ARRIVAL-01',
      ...expectedOutdoorOpenings,
      ...expectedRearDoors,
      'PSG-L1-DRY-01',
    ],
    'REF-201': ['EXT-L2-01'],
    'REF-301': ['EXT-L2-01', 'J-RF-L2-01', 'RC-RF-01', 'RW-TR-01', 'RW-01'],
    'REF-401': ['Z-L1-ENTRY-01', 'EXT-L2-01', 'F-MIR-01', 'ST-01', 'RF-GL-01', 'J-RF-L2-01', 'RC-RF-01', 'RW-TR-01'],
    'REF-501': ['EXT-L2-01', 'J-RF-L2-01', 'RC-RF-01'],
  };
  for (const [sheetId, ids] of Object.entries(requiredSheetReferences)) {
    const referenced = new Set(sheets.find((sheet) => sheet.id === sheetId)?.referencedEntityIds ?? []);
    for (const id of ids) if (!referenced.has(id)) errors.push(`${sheetId} must reference ${id}`);
  }

  return errors;
}

export async function validateSourceFiles(model, repoRoot) {
  const errors = [];
  for (const source of model.sources) {
    const fullPath = resolve(repoRoot, source.path);
    try {
      const bytes = await readFile(fullPath);
      const hash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
      if (hash !== source.sha256) errors.push(`${source.id} SHA-256 does not match`);
    } catch (error) {
      errors.push(`${source.id} cannot be read: ${error.message}`);
    }
  }
  return errors;
}
