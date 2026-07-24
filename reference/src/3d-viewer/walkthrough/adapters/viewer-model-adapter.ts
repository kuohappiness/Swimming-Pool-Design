import type {
  DeepReadonly,
  FixedPlanTransform,
  OpeningDescriptor,
  PlanTransform,
  PoolShellDescriptor,
  ReadonlyViewerModel,
  SiteBounds,
  SpawnDescriptor,
  StairRampDescriptor,
  WalkSurfaceDescriptor,
  WalkthroughEntityDescriptor,
  WalkthroughSource,
  WaterVolumeDescriptor,
} from '../types.js';
import { getViewerPoolPresentation } from '../../pool-state.ts';

const REQUIRED_ENTITY_IDS = [
  'SITE-01',
  'BLDG-01',
  'EN-01',
  'POOL-01',
  'L2-PLATE-01',
  'L3-PLATE-01',
  'L3-EXT-01',
  'Z-L3-ARRIVAL-01',
  'Z-L3-TERRACE-01',
  'RF-L3-01',
  'RF-PV-RES-01',
  'ST-01',
  'ST-02',
] as const;

const FIXED_TRANSFORM: FixedPlanTransform = Object.freeze({ kind: 'fixed' });
const EPSILON = 1e-6;

function finite(value: number, path: string) {
  if (!Number.isFinite(value)) throw new TypeError(`${path} must be finite.`);
  return value;
}

function positive(value: number, path: string) {
  finite(value, path);
  if (value <= 0) throw new TypeError(`${path} must be positive.`);
  return value;
}

function cloneBounds(bounds: SiteBounds): SiteBounds {
  return { x1: bounds.x1, x2: bounds.x2, y1: bounds.y1, y2: bounds.y2 };
}

function validateBounds(bounds: SiteBounds, path: string) {
  finite(bounds.x1, `${path}.x1`);
  finite(bounds.x2, `${path}.x2`);
  finite(bounds.y1, `${path}.y1`);
  finite(bounds.y2, `${path}.y2`);
  if (bounds.x2 <= bounds.x1 || bounds.y2 <= bounds.y1) {
    throw new TypeError(`${path} must have positive area.`);
  }
}

function sameBounds(a: SiteBounds, b: SiteBounds) {
  return Math.abs(a.x1 - b.x1) <= EPSILON
    && Math.abs(a.x2 - b.x2) <= EPSILON
    && Math.abs(a.y1 - b.y1) <= EPSILON
    && Math.abs(a.y2 - b.y2) <= EPSILON;
}

function equalWithin(a: number, b: number) {
  return Math.abs(a - b) <= EPSILON;
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function requireEntity(model: ReadonlyViewerModel, entityId: string): WalkthroughEntityDescriptor {
  const entity = model.entityBounds[entityId];
  if (!entity) throw new TypeError(`Walkthrough required entity ${entityId} is missing.`);
  if (entity.coordinateSystemId !== 'SITE-XY') {
    throw new TypeError(`${entityId} coordinateSystemId must be SITE-XY.`);
  }
  validateBounds(entity.bounds, `${entityId} bounds`);
  return {
    entityId,
    coordinateSystemId: 'SITE-XY',
    bounds: cloneBounds(entity.bounds),
  };
}

function requireGeometryMatch(
  entities: Readonly<Record<string, WalkthroughEntityDescriptor>>,
  entityId: string,
  geometryBounds: SiteBounds,
) {
  validateBounds(geometryBounds, `${entityId} geometry bounds`);
  if (!sameBounds(entities[entityId].bounds, geometryBounds)) {
    throw new TypeError(`${entityId} geometry must match canonical entity bounds.`);
  }
}

function buildOpenings(model: ReadonlyViewerModel): OpeningDescriptor[] {
  const entranceWidth = model.geometry.l1.mainEntranceBounds.x2
    - model.geometry.l1.mainEntranceBounds.x1;
  const mainEntrance: OpeningDescriptor = {
    id: 'main-entrance',
    kind: 'opening',
    entityId: 'EN-01',
    level: 'l1',
    side: 'y0',
    clearWidth: positive(entranceWidth, 'EN-01.clearWidth'),
    clearHeight: null,
    heightStatus: 'unresolved',
    bounds: cloneBounds(model.geometry.l1.mainEntranceBounds),
  };

  const toiletOpenings = model.geometry.l1.toiletEntrances.map((opening) => {
    const centre = {
      x: finite(opening.center[0], `${opening.entityId}.center.x`),
      y: finite(opening.center[1], `${opening.entityId}.center.y`),
    };
    return {
      id: `toilet-${opening.entityId}`,
      kind: 'opening' as const,
      entityId: opening.entityId,
      level: 'l1' as const,
      side: opening.side,
      clearWidth: positive(opening.clearWidth, `${opening.entityId}.clearWidth`),
      clearHeight: positive(opening.displayClearHeight, `${opening.entityId}.displayClearHeight`),
      heightStatus: 'canonical-working' as const,
      centre,
    };
  });

  const changingOpenings = model.geometry.l2.changingRoomEntries.map((opening) => {
    const zoneKey = opening.zoneId === 'Z-CS-M-01'
      ? 'maleChangingShower'
      : opening.zoneId === 'Z-CS-F-01' ? 'femaleChangingShower' : null;
    if (!zoneKey) throw new TypeError(`${opening.entityId}.zoneId is not a supported changing zone.`);
    const y1 = finite(opening.rangeY[0], `${opening.entityId}.rangeY[0]`);
    const y2 = finite(opening.rangeY[1], `${opening.entityId}.rangeY[1]`);
    if (!equalWithin(y2 - y1, opening.clearWidth)) {
      throw new TypeError(`${opening.entityId}.rangeY must equal its clearWidth.`);
    }
    return {
      id: `changing-${opening.entityId}`,
      kind: 'opening' as const,
      entityId: opening.entityId,
      level: 'l2' as const,
      side: opening.side,
      clearWidth: positive(opening.clearWidth, `${opening.entityId}.clearWidth`),
      clearHeight: null,
      heightStatus: 'unresolved' as const,
      centre: {
        x: finite(model.geometry.l2.zones[zoneKey].bounds.x1, `${opening.entityId}.center.x`),
        y: (y1 + y2) / 2,
      },
    };
  });

  return [mainEntrance, ...toiletOpenings, ...changingOpenings];
}

export function adaptWalkthroughSource(input: ReadonlyViewerModel): DeepReadonly<WalkthroughSource> {
  const model = input;
  if (model.schemaVersion !== '1.3.0') {
    throw new TypeError('Walkthrough only accepts Viewer schemaVersion 1.3.0.');
  }
  if (!model.modelVersion) throw new TypeError('Viewer modelVersion is required.');
  if (!model.revision) throw new TypeError('Viewer revision is required.');
  if (model.activeGeometryRevisionId !== `GEO-${model.modelVersion}`) {
    throw new TypeError('activeGeometryRevisionId must match modelVersion.');
  }
  if (!/^[a-f0-9]{64}$/.test(model.modelHash)) {
    throw new TypeError('modelHash must be a canonical SHA-256.');
  }
  if (model.coordinateSystemId !== 'SITE-XY') {
    throw new TypeError('Viewer coordinateSystemId must be SITE-XY.');
  }
  if (model.referenceSystem.unit !== 'm') {
    throw new TypeError('Walkthrough only accepts metre-based Viewer data.');
  }
  const coordinateAdapter = model.referenceSystem.coordinateAdapter;
  if (coordinateAdapter.adapterId !== 'SITE-XYZ-TO-THREE-RH'
    || coordinateAdapter.siteX !== 'threeX'
    || coordinateAdapter.siteY !== 'negativeThreeZ'
    || coordinateAdapter.siteZ !== 'threeY') {
    throw new TypeError('Walkthrough requires the SITE-XYZ-TO-THREE-RH coordinate adapter.');
  }

  const entities = Object.fromEntries(
    REQUIRED_ENTITY_IDS.map((entityId) => [entityId, requireEntity(model, entityId)]),
  );

  requireGeometryMatch(entities, 'SITE-01', model.geometry.site.bounds);
  requireGeometryMatch(entities, 'BLDG-01', model.geometry.building.bounds);
  requireGeometryMatch(entities, 'EN-01', model.geometry.l1.mainEntranceBounds);
  requireGeometryMatch(entities, 'POOL-01', model.geometry.pool.bounds);
  requireGeometryMatch(entities, 'L2-PLATE-01', model.geometry.l2.bounds);
  requireGeometryMatch(entities, 'L3-PLATE-01', model.geometry.l3.bounds);
  requireGeometryMatch(entities, 'L3-EXT-01', model.geometry.l3.orthogonalExtension.bounds);
  requireGeometryMatch(entities, 'Z-L3-ARRIVAL-01', model.geometry.l3.arrivalWing.bounds);
  requireGeometryMatch(entities, 'Z-L3-TERRACE-01', model.geometry.l3.landscapeTerrace.bounds);
  requireGeometryMatch(entities, 'RF-L3-01', model.geometry.l3.roof.bounds);
  requireGeometryMatch(entities, 'RF-PV-RES-01', model.geometry.l3.pvRoofReserve.bounds);
  requireGeometryMatch(entities, 'ST-01', model.geometry.stair.bounds);
  requireGeometryMatch(entities, 'ST-02', model.geometry.l2.stairToL3.bounds);
  if (model.geometry.stair.coordinateSystemId !== 'SITE-XY'
    || model.geometry.l2.stairToL3.coordinateSystemId !== 'SITE-XY') {
    throw new TypeError('Walkthrough stairs must use SITE-XY.');
  }

  const pool = model.geometry.pool;
  const stair1 = model.geometry.stair;
  const stair2 = model.geometry.l2.stairToL3;
  const l2Elevation = finite(model.geometry.l2.baseElevation, 'l2.baseElevation');
  const l3Elevation = finite(model.geometry.l3.baseElevation, 'l3.baseElevation');
  const deckElevation = finite(pool.deckElevation.value, 'pool.deckElevation');
  const shallowDepth = positive(pool.shallowDepth.value, 'pool.shallowDepth');
  const deepDepth = positive(pool.deepDepth.value, 'pool.deepDepth');
  const poolPresentation = getViewerPoolPresentation(model);
  if (deepDepth < shallowDepth) throw new TypeError('pool.deepDepth must not be less than pool.shallowDepth.');
  const siteBounds = entities['SITE-01'].bounds;
  const buildingBounds = entities['BLDG-01'].bounds;
  if (pool.bounds.x1 < buildingBounds.x1 || pool.bounds.x2 > buildingBounds.x2
    || pool.bounds.y1 < buildingBounds.y1 || pool.bounds.y2 > buildingBounds.y2
    || buildingBounds.x1 < siteBounds.x1 || buildingBounds.x2 > siteBounds.x2
    || buildingBounds.y1 < siteBounds.y1 || buildingBounds.y2 > siteBounds.y2) {
    throw new TypeError('POOL-01 must remain inside BLDG-01 and BLDG-01 inside SITE-01.');
  }
  if (stair1.bounds.y2 > pool.bounds.y1) throw new TypeError('ST-01 must remain outside POOL-01.');
  finite(stair1.lowerElevation, 'ST-01.lowerElevation');
  finite(stair1.midLandingElevation, 'ST-01.midLandingElevation');
  finite(stair1.upperElevation, 'ST-01.upperElevation');
  finite(stair2.lowerElevation, 'ST-02.lowerElevation');
  finite(stair2.midLandingElevation, 'ST-02.midLandingElevation');
  finite(stair2.upperElevation, 'ST-02.upperElevation');
  if (!equalWithin(stair1.lowerElevation, deckElevation)
    || !equalWithin(stair1.upperElevation, l2Elevation)
    || !equalWithin(stair1.upperElevation - stair1.lowerElevation, stair1.totalRise)) {
    throw new TypeError('ST-01 elevations must connect the pool deck to L2.');
  }
  if (!equalWithin(stair2.lowerElevation, l2Elevation)
    || !equalWithin(stair2.upperElevation, l3Elevation)
    || !equalWithin(stair2.upperElevation - stair2.lowerElevation, stair2.totalRise)) {
    throw new TypeError('ST-02 elevations must connect L2 to L3.');
  }
  if (stair2.axis !== '+x') throw new TypeError('ST-02 axis must remain +x.');

  const l3Rotation = finite(model.geometry.l3.planRotation.value, 'l3.planRotation');
  const l3Pivot = {
    x: finite(model.geometry.l3.planPivot.x, 'l3.planPivot.x'),
    y: finite(model.geometry.l3.planPivot.y, 'l3.planPivot.y'),
  };
  if (!equalWithin(model.geometry.l3.roof.rotation, l3Rotation)
    || !equalWithin(model.geometry.l3.pvRoofReserve.rotation, l3Rotation)) {
    throw new TypeError('L3 floor, roof, and PV reserve must share one plan rotation.');
  }
  if (model.geometry.l3.orthogonalExtension.rotation !== 0) {
    throw new TypeError('L3 orthogonal extension must remain fixed in SITE-XY.');
  }
  const l3Transform: PlanTransform = {
    kind: 'rotate-around-pivot',
    degrees: l3Rotation,
    pivot: l3Pivot,
  };

  const surface = (
    id: string,
    entityId: string,
    elevation: number,
    transform: PlanTransform = FIXED_TRANSFORM,
    exclusions: readonly string[] = [],
  ): WalkSurfaceDescriptor => ({
    id,
    kind: 'walk-surface',
    entityId,
    coordinateSystemId: 'SITE-XY',
    bounds: cloneBounds(entities[entityId].bounds),
    elevation: finite(elevation, `${id}.elevation`),
    transform,
    exclusions: [...exclusions],
  });

  const surfaces: WalkSurfaceDescriptor[] = [
    surface('site-ground', 'SITE-01', 0),
    surface('l1-pool-deck', 'BLDG-01', deckElevation, FIXED_TRANSFORM, ['POOL-01']),
    surface('l2-floor', 'L2-PLATE-01', l2Elevation),
    surface('l3-rotated-floor', 'L3-PLATE-01', l3Elevation, l3Transform),
    surface('l3-fixed-extension', 'L3-EXT-01', l3Elevation),
    surface('l3-arrival', 'Z-L3-ARRIVAL-01', l3Elevation),
    surface('l3-terrace', 'Z-L3-TERRACE-01', l3Elevation),
    surface('roof-inspection', 'RF-PV-RES-01', model.geometry.l3.pvRoofReserve.baseElevation, l3Transform),
  ];

  const stairs: StairRampDescriptor[] = [
    {
      id: 'stair-ramp-st-01',
      kind: 'stair-ramp',
      entityId: 'ST-01',
      coordinateSystemId: 'SITE-XY',
      bounds: cloneBounds(stair1.bounds),
      axis: '+x',
      lowerElevation: stair1.lowerElevation,
      midLandingElevation: stair1.midLandingElevation,
      upperElevation: stair1.upperElevation,
      flightRun: positive(stair1.flightRun, 'ST-01.flightRun'),
      midLandingLength: positive(stair1.midLandingLength, 'ST-01.midLandingLength'),
      upperLandingLength: 0,
      transform: FIXED_TRANSFORM,
    },
    {
      id: 'stair-ramp-st-02',
      kind: 'stair-ramp',
      entityId: 'ST-02',
      coordinateSystemId: 'SITE-XY',
      bounds: cloneBounds(stair2.bounds),
      axis: '+x',
      lowerElevation: stair2.lowerElevation,
      midLandingElevation: stair2.midLandingElevation,
      upperElevation: stair2.upperElevation,
      flightRun: positive(stair2.flightRun, 'ST-02.flightRun'),
      midLandingLength: positive(stair2.midLandingLength, 'ST-02.midLandingLength'),
      upperLandingLength: positive(stair2.upperLandingLength, 'ST-02.upperLandingLength'),
      transform: FIXED_TRANSFORM,
    },
  ];

  const poolShell: PoolShellDescriptor = {
    id: 'main-pool-shell',
    kind: 'pool-shell',
    entityId: 'POOL-01',
    coordinateSystemId: 'SITE-XY',
    bounds: cloneBounds(pool.bounds),
    rimElevation: deckElevation,
    waterSurfaceElevation: poolPresentation.waterSurfaceElevation,
    shallowEndX: pool.bounds.x1,
    deepEndX: pool.bounds.x2,
    shallowDepth,
    deepDepth,
    bottomProfile: 'linear-x-slope',
  };
  const waterVolume: WaterVolumeDescriptor = {
    id: 'main-pool-water',
    kind: 'water-volume',
    entityId: 'POOL-01',
    coordinateSystemId: 'SITE-XY',
    bounds: cloneBounds(pool.bounds),
    surfaceElevation: poolPresentation.waterSurfaceElevation,
    shallowEndX: pool.bounds.x1,
    deepEndX: pool.bounds.x2,
    shallowDepth,
    deepDepth,
    bottomProfile: 'linear-x-slope',
  };

  const spawns: SpawnDescriptor[] = [
    {
      id: 'entrance',
      entityId: 'EN-01',
      coordinateSystemId: 'SITE-XY',
      normalizedAnchor: { x: 0.5, y: 0 },
      siteOffset: { x: 0, y: -1.25, z: 0 },
      elevationRole: 'site-ground',
      facingEntityId: 'EN-01',
    },
    {
      id: 'l1-pool-deck',
      entityId: 'POOL-01',
      coordinateSystemId: 'SITE-XY',
      normalizedAnchor: { x: 0.5, y: 0 },
      siteOffset: { x: 0, y: -0.8, z: 0 },
      elevationRole: 'pool-deck',
      facingEntityId: 'POOL-01',
    },
    {
      id: 'l2-arrival',
      entityId: 'ST-01',
      coordinateSystemId: 'SITE-XY',
      normalizedAnchor: { x: 1, y: 0.5 },
      siteOffset: { x: 0.45, y: 0, z: 0 },
      elevationRole: 'l2-floor',
    },
    {
      id: 'l3-arrival',
      entityId: 'Z-L3-ARRIVAL-01',
      coordinateSystemId: 'SITE-XY',
      normalizedAnchor: { x: 0.65, y: 0.5 },
      siteOffset: { x: 0, y: 0, z: 0 },
      elevationRole: 'l3-floor',
    },
    {
      id: 'l3-terrace',
      entityId: 'Z-L3-TERRACE-01',
      coordinateSystemId: 'SITE-XY',
      normalizedAnchor: { x: 0.72, y: 0.62 },
      siteOffset: { x: 0, y: 0, z: 0 },
      elevationRole: 'l3-floor',
    },
    {
      id: 'roof-inspection',
      entityId: 'RF-PV-RES-01',
      coordinateSystemId: 'SITE-XY',
      normalizedAnchor: { x: 0.5, y: 0.5 },
      siteOffset: { x: 0, y: 0, z: 0 },
      elevationRole: 'roof-surface',
    },
  ];

  const result: WalkthroughSource = {
    identity: {
      schemaVersion: '1.0.0',
      modelVersion: model.modelVersion,
      revision: model.revision,
      activeGeometryRevisionId: model.activeGeometryRevisionId,
      sourceModelHash: model.modelHash,
    },
    referenceFrame: {
      coordinateSystemId: 'SITE-XY',
      adapterId: 'SITE-XYZ-TO-THREE-RH',
      siteX: 'threeX',
      siteY: 'negativeThreeZ',
      siteZ: 'threeY',
      worldBearingDegrees: finite(
        model.referenceSystem.localLongAxisBearingFromTrueNorth,
        'referenceSystem.localLongAxisBearingFromTrueNorth',
      ),
    },
    entities,
    surfaces,
    stairs,
    poolShells: [poolShell],
    openings: buildOpenings(model),
    waterVolumes: [waterVolume],
    spawns,
    capabilities: {
      inspectModePreserved: true,
      desktopInput: true,
      touchInput: true,
      walking: true,
      stairTraversal: true,
      areaJump: true,
      surfaceSwimming: true,
      underwaterSwimming: true,
      futureVisualAssetAdapter: true,
    },
  };

  return deepFreeze(result);
}

export { deepFreeze as deepFreezeWalkthroughData };
