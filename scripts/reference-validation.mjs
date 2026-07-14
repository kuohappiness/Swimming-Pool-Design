import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deriveReferenceGeometry } from './reference-geometry.mjs';

const GEOMETRY_TOLERANCE = 0.002;
const EXPECTED_LOCAL_ORIGIN = [27, 0, 0];
const TASK_002_ENTITY_CONTRACTS = {
  'Z-L1-ENTRY-01': { type: 'outdoor-forecourt', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008'] },
  'RTE-L1-ARRIVAL-01': { type: 'arrival-route', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008'] },
  'OP-L1-PH-01': { type: 'outdoor-opening', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008'] },
  'DR-L1-WC-M-FRONT-01': { type: 'door', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008'] },
  'DR-L1-WC-M-REAR-01': { type: 'door', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-005', 'SRC-CONCEPT-008'] },
  'DR-L1-WC-F-FRONT-01': { type: 'door', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-008'] },
  'DR-L1-WC-F-REAR-01': { type: 'door', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-005', 'SRC-CONCEPT-008'] },
  'PSG-L1-DRY-01': { type: 'dry-passage', level: 'L1', status: 'confirmed', sourceIds: ['SRC-CONCEPT-005', 'SRC-CONCEPT-008'] },
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
  for (const [id, contract] of Object.entries(TASK_002_ENTITY_CONTRACTS)) {
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
    ['pool.length', pool.length],
    ['pool.width', pool.width],
    ['pool.shallowDepth', pool.shallowDepth],
    ['pool.deepDepth', pool.deepDepth],
    ['roof.pitch', roof.pitch],
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
  if (rfLevel?.elevation !== null || rfLevel?.status !== 'deferred' || rfLevel?.openItemId !== 'OPEN-010') {
    errors.push('RF level elevation must remain deferred under OPEN-010');
  }

  if (roof.coverageZoneId !== 'Z-PH-01') errors.push('roof coverage zone must remain Z-PH-01');
  if (roof.pitch?.value !== 10 || roof.pitch?.status !== 'confirmed') errors.push('roof pitch must remain confirmed at 10 degrees');
  if (roof.highEdge !== 'l2-extension-edge' || roof.lowEdge !== 'far-pool-end') {
    errors.push('roof must rise from the far pool end to the L2 extension edge');
  }
  if (!isDeferredMeasure(roof.lowElevation, 'OPEN-010') || !isDeferredMeasure(roof.highElevation, 'OPEN-010')) {
    errors.push('roof elevations must remain deferred under OPEN-010');
  }
  if (roof.jointEntityId !== 'J-RF-L2-01') errors.push('roof joint must use J-RF-L2-01');
  if (roof.supportedByExtension !== false) errors.push('glass roof and L2 extension must remain structurally independent');

  if (stair.runs !== 2 || stair.risersPerRun * stair.runs !== stair.riserCount) {
    errors.push('ST-01 must contain two equal stair runs');
  }
  if (stair.stringers !== 2 || stair.underStair !== 'fully-open' || stair.supportedByRoof !== false) {
    errors.push('ST-01 must retain dual stringers, open underside, and independent roof support');
  }
  if (stair.guardrail !== 'transparent' || stair.enclosure !== 'dry-glass-gallery') {
    errors.push('ST-01 must retain transparent guards and a dry glass gallery');
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
    'J-RF-L2-01',
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
    'REF-301': ['EXT-L2-01', 'J-RF-L2-01'],
    'REF-401': ['EXT-L2-01', 'J-RF-L2-01'],
    'REF-501': ['EXT-L2-01', 'J-RF-L2-01'],
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
