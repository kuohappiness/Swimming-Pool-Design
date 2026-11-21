export const SITE_COORDINATE_SYSTEM_ID = 'SITE-XY';
export const THREE_SITE_ADAPTER_ID = 'SITE-XYZ-TO-THREE-RH';

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
};

export function normalizeBounds(bounds, label = 'bounds') {
  if (!bounds || typeof bounds !== 'object') throw new TypeError(`${label} must be an object.`);
  const normalized = {
    x1: finite(bounds.x1, `${label}.x1`),
    x2: finite(bounds.x2, `${label}.x2`),
    y1: finite(bounds.y1, `${label}.y1`),
    y2: finite(bounds.y2, `${label}.y2`),
  };
  if (normalized.x2 <= normalized.x1 || normalized.y2 <= normalized.y1) {
    throw new RangeError(`${label} must have positive SITE-XY area.`);
  }
  return normalized;
}

function collectGeometryEntities(value, output, path = 'activeGeometry') {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectGeometryEntities(entry, output, `${path}[${index}]`));
    return output;
  }
  if ('bounds' in value) {
    if (typeof value.entityId !== 'string' || !value.entityId) {
      throw new TypeError(`${path} with bounds must declare entityId.`);
    }
    if (value.coordinateSystemId !== SITE_COORDINATE_SYSTEM_ID) {
      throw new TypeError(`${path} must declare coordinateSystemId ${SITE_COORDINATE_SYSTEM_ID}.`);
    }
    if (output.has(value.entityId)) {
      throw new RangeError(`Active geometry contains duplicate entityId ${value.entityId}.`);
    }
    output.set(value.entityId, { ...value, bounds: normalizeBounds(value.bounds, `${path}.bounds`) });
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key !== 'bounds') collectGeometryEntities(entry, output, `${path}.${key}`);
  }
  return output;
}

export function resolveActiveGeometry(model) {
  const activeId = model?.activeGeometryRevisionId;
  if (typeof activeId !== 'string' || !activeId) {
    throw new TypeError('activeGeometryRevisionId is required.');
  }
  if (!Array.isArray(model?.geometryRevisions)) {
    throw new TypeError('geometryRevisions must be an array.');
  }
  const matches = model.geometryRevisions.filter((revision) => revision?.id === activeId);
  if (matches.length !== 1) {
    throw new RangeError(`activeGeometryRevisionId ${activeId} must resolve exactly once; found ${matches.length}.`);
  }
  const active = matches[0];
  if (active.modelVersion !== active.revision || active.id !== `GEO-${active.revision}`) {
    throw new RangeError('Active geometry id, revision, and geometry modelVersion must match exactly.');
  }
  const releaseVersion = String(model?.modelVersion ?? '').split('.').map(Number);
  const geometryVersion = String(active.revision).split('.').map(Number);
  if (releaseVersion.length !== 3
    || geometryVersion.length !== 3
    || [...releaseVersion, ...geometryVersion].some((value) => !Number.isInteger(value) || value < 0)) {
    throw new TypeError('Release and active geometry revisions must be semantic x.y.z versions.');
  }
  const geometryIsNewer = geometryVersion.some(
    (value, index) => value > releaseVersion[index]
      && geometryVersion.slice(0, index).every((entry, prefixIndex) => entry === releaseVersion[prefixIndex]),
  );
  if (geometryIsNewer) {
    throw new RangeError('Active geometry revision cannot be newer than the release modelVersion.');
  }
  if (active.coordinateSystemId !== SITE_COORDINATE_SYSTEM_ID) {
    throw new TypeError(`Active geometry must use ${SITE_COORDINATE_SYSTEM_ID}.`);
  }
  const coordinateSystems = model?.referenceSystem?.coordinateSystems;
  const frames = Array.isArray(coordinateSystems)
    ? coordinateSystems.filter((frame) => frame?.id === SITE_COORDINATE_SYSTEM_ID)
    : [];
  if (frames.length !== 1) {
    throw new RangeError(`${SITE_COORDINATE_SYSTEM_ID} must be declared exactly once; found ${frames.length}.`);
  }
  normalizeBounds(frames[0].bounds, `referenceSystem.coordinateSystems.${SITE_COORDINATE_SYSTEM_ID}.bounds`);
  collectGeometryEntities(active, new Map());
  return active;
}

export function geometryEntities(activeGeometry) {
  return collectGeometryEntities(activeGeometry, new Map());
}

export function resolveGeometryEntity(activeGeometry, entityId) {
  const entity = geometryEntities(activeGeometry).get(entityId);
  if (!entity) throw new RangeError(`Active geometry entity ${entityId} does not exist.`);
  return entity;
}

export function sitePointToThree(point) {
  if (!Array.isArray(point) || point.length !== 3) {
    throw new TypeError('SITE-XY point must be [x, y, z].');
  }
  const [x, y, z] = point.map((value, index) => finite(value, `point[${index}]`));
  // Three.js uses Y-up. Negating SITE Y preserves a right-handed frame:
  // SITE +X -> Three +X, SITE +Y -> Three -Z, SITE +Z -> Three +Y.
  return [x, z, -y];
}

export function boundsEqual(first, second, tolerance = 1e-9) {
  const a = normalizeBounds(first, 'firstBounds');
  const b = normalizeBounds(second, 'secondBounds');
  return ['x1', 'x2', 'y1', 'y2'].every((key) => Math.abs(a[key] - b[key]) <= tolerance);
}
