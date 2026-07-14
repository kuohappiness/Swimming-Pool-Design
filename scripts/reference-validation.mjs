import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deriveReferenceGeometry } from './reference-geometry.mjs';

const closeTo = (actual, expected, tolerance = 0.002) =>
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
  if (entrance?.sharedVestibuleZoneId !== 'Z-L1-ENTRY-01'
    || entrance?.geometryStatus !== 'deferred' || entrance?.openItemId !== 'OPEN-008') {
    errors.push('L1 shared entrance vestibule must remain deferred under OPEN-008');
  }

  const maleToilet = model.program?.l1?.maleToilet;
  const femaleToilet = model.program?.l1?.femaleToilet;
  if (maleToilet?.side !== 'lower-x' || femaleToilet?.side !== 'higher-x') {
    errors.push('L1 toilets must be male lower-X and female higher-X');
  }
  for (const toilet of [maleToilet, femaleToilet]) {
    if (toilet?.frontDoor?.connectsTo !== 'Z-L1-ENTRY-01' || toilet?.frontDoor?.access !== 'daily-open') {
      errors.push('L1 toilet front doors must connect to the shared vestibule');
    }
    if (toilet?.rearDoor?.connectsTo !== 'pool-side-dry-passage' || toilet?.rearDoor?.access !== 'pool-hours-only') {
      errors.push('L1 toilet rear doors must be pool-hours-only');
    }
    if (toilet?.doorsDirectlyAligned !== false) errors.push('L1 toilet front and rear doors must be offset');
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

  const requiredEntityIds = ['Z-L1-ENTRY-01', 'EXT-L2-01', 'J-RF-L2-01'];
  for (const id of requiredEntityIds) {
    if (!entitySet.has(id)) errors.push(`required entity is missing: ${id}`);
  }
  const requiredSheetIds = ['REF-001', 'REF-101', 'REF-201', 'REF-301', 'REF-401', 'REF-501'];
  for (const id of requiredSheetIds) {
    if (!sheetIds.includes(id)) errors.push(`required sheet is missing: ${id}`);
  }
  const requiredSheetReferences = {
    'REF-101': ['Z-L1-ENTRY-01'],
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
