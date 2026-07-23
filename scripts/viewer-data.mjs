import { createHash } from 'node:crypto';
import {
  geometryEntities,
  resolveActiveGeometry,
  resolveGeometryEntity,
  THREE_SITE_ADAPTER_ID,
} from './active-geometry.mjs';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function hashData(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export function solarAnalysisInput(model) {
  const active = resolveActiveGeometry(model);
  const pool = resolveGeometryEntity(active, 'POOL-01');
  const l3 = resolveGeometryEntity(active, 'L3-PLATE-01');
  const roof = resolveGeometryEntity(active, 'RF-GL-01');
  return {
    schemaVersion: '1.0.0',
    siteLocation: structuredClone(model.referenceSystem.siteLocation),
    localLongAxisBearingFromTrueNorth: model.referenceSystem.localLongAxisBearingFromTrueNorth,
    poolBounds: structuredClone(pool.bounds),
    l3FloorBounds: structuredClone(l3.bounds),
    l3PlanPivot: structuredClone(active.l3.planPivot),
    mirror: {
      baseElevation: active.l3.mirror.baseElevation,
      height: active.l3.mirror.height,
      planRotation: active.solar.planRotation.value,
      leanFromVertical: active.solar.mirrorLeanFromVertical.value,
    },
    pivotSensitivityX: structuredClone(active.solar.pivotSensitivityX),
    fixedRoof: {
      bounds: structuredClone(roof.bounds),
      highElevation: active.roof.highElevation,
      pitch: active.roof.pitch,
    },
    energyAssumptions: {
      mirrorReflectance: 0.75,
      glazingSolarTransmittance: 0.60,
      daylightStartHour: 7,
      daylightEndHour: 17,
    },
    weatherSourceIds: ['SRC-SITE-003'],
  };
}

const finiteRecord = (value, path = 'viewerModel') => {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError(`${path} must not contain non-finite geometry.`);
  }
  if (Array.isArray(value)) value.forEach((entry, index) => finiteRecord(entry, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) finiteRecord(entry, `${path}.${key}`);
  }
};

const size = (bounds) => ({ length: bounds.x2 - bounds.x1, width: bounds.y2 - bounds.y1 });
const confirmed = (value, sourceIds = []) => ({ value, status: 'confirmed', sourceIds });
const working = (value, sourceIds = [], openItemId) => ({
  value, status: 'working', sourceIds, ...(openItemId ? { openItemId } : {}),
});

export function buildViewerModel(model, analysisRegistry = {}) {
  const active = resolveActiveGeometry(model);
  const entities = geometryEntities(active);
  const site = resolveGeometryEntity(active, 'SITE-01');
  const building = resolveGeometryEntity(active, 'BLDG-01');
  const poolHall = resolveGeometryEntity(active, 'Z-PH-01');
  const pool = resolveGeometryEntity(active, 'POOL-01');
  const serviceWing = resolveGeometryEntity(active, 'CORE-01');
  const l2 = resolveGeometryEntity(active, 'L2-PLATE-01');
  const l3 = resolveGeometryEntity(active, 'L3-PLATE-01');
  const roof = resolveGeometryEntity(active, 'RF-GL-01');
  const stair = resolveGeometryEntity(active, 'ST-01');
  const stairToL3 = resolveGeometryEntity(active, 'ST-02');
  const currentModelHash = hashData(model);
  const currentAnalysisInputHash = hashData(solarAnalysisInput(model));
  const recordedAnalysisInputHash = analysisRegistry?.solar?.inputHash ?? null;
  const analysisStatus = recordedAnalysisInputHash === null
    ? 'unavailable'
    : recordedAnalysisInputHash === currentAnalysisInputHash ? 'current' : 'stale';
  const poolSize = size(pool.bounds);
  const l2Size = size(l2.bounds);
  const l3Size = size(l3.bounds);
  const roofSize = size(roof.bounds);
  const l3Data = active.l3;
  const stairData = active.stair;

  const viewerModel = {
    schemaVersion: '1.3.0',
    modelVersion: model.modelVersion,
    revision: model.revision,
    activeGeometryRevisionId: active.id,
    coordinateSystemId: active.coordinateSystemId,
    modelHash: currentModelHash,
    project: structuredClone(model.project),
    viewerPresentation: structuredClone(active.viewerPresentation),
    referenceSystem: {
      unit: model.referenceSystem.unit,
      angleUnit: model.referenceSystem.angleUnit,
      localLongAxisBearingFromTrueNorth: model.referenceSystem.localLongAxisBearingFromTrueNorth,
      axes: structuredClone(model.referenceSystem.axes),
      coordinateAdapter: {
        siteX: 'threeX', siteY: 'negativeThreeZ', siteZ: 'threeY', adapterId: THREE_SITE_ADAPTER_ID,
      },
    },
    entityBounds: Object.fromEntries([...entities].map(([id, entity]) => [id, {
      coordinateSystemId: entity.coordinateSystemId,
      bounds: structuredClone(entity.bounds),
    }])),
    geometry: {
      site: {
        bounds: structuredClone(site.bounds),
        length: site.bounds.x2 - site.bounds.x1,
        width: site.bounds.y2 - site.bounds.y1,
      },
      building: {
        bounds: structuredClone(building.bounds),
        length: working(building.bounds.x2 - building.bounds.x1, [], 'OPEN-016'),
        width: working(building.bounds.y2 - building.bounds.y1, [], 'OPEN-016'),
        upperFloorWidth: working(l2Size.width, [], 'OPEN-016'),
        poolHallLength: working(poolHall.bounds.x2 - poolHall.bounds.x1, [], 'OPEN-016'),
        serviceCoreLength: working(serviceWing.bounds.x2 - serviceWing.bounds.x1, [], 'OPEN-016'),
        leftSetback: confirmed(active.l1.westSetback.bounds.x2 - active.l1.westSetback.bounds.x1, []),
        rightSetback: confirmed(active.l1.rightSetback.bounds.x2 - active.l1.rightSetback.bounds.x1, []),
      },
      pool: {
        bounds: structuredClone(pool.bounds),
        origin: [pool.bounds.x1, pool.bounds.y1],
        length: confirmed(poolSize.length, []),
        width: confirmed(poolSize.width, []),
        shallowDepth: confirmed(active.l1.pool.shallowDepth, []),
        deepDepth: confirmed(active.l1.pool.deepDepth, []),
        deckElevation: confirmed(active.levels.poolDeckElevation, []),
        laneCount: active.l1.pool.laneBands.length - 1,
        laneBands: structuredClone(active.l1.pool.laneBands),
      },
      l1: {
        bounds: structuredClone(building.bounds),
        serviceWingBounds: structuredClone(serviceWing.bounds),
        serviceWingStyle: structuredClone(active.l1.serviceWing.architecturalStyle),
        y0ExteriorFacade: structuredClone(active.l1.y0ExteriorFacade),
        westSetbackBounds: structuredClone(active.l1.westSetback.bounds),
        rightSetbackBounds: structuredClone(active.l1.rightSetback.bounds),
        mainEntranceBounds: structuredClone(active.l1.mainEntrance.bounds),
        westGlassEave: structuredClone(active.l1.westGlassEave),
        rearGlassCanopy: structuredClone(active.l1.rearGlassCanopy),
        westRainwaterRecovery: structuredClone(active.l1.westRainwaterRecovery),
        playgroundRamp: structuredClone(active.l1.playgroundRamp),
        zones: structuredClone(active.l1.zones),
        toiletEntrances: structuredClone(active.l1.toiletEntrances),
        structuralStrategy: structuredClone(active.l1.structuralStrategy),
      },
      l2: {
        ...structuredClone(active.l2),
        bounds: structuredClone(l2.bounds),
        startX: l2.bounds.x1,
        endX: l2.bounds.x2,
        length: l2Size.length,
        width: l2Size.width,
        baseElevation: active.levels.l2Elevation,
        topElevation: active.levels.l3Elevation,
        volumeHeight: working(active.levels.l2FloorToFloor, [], 'OPEN-016'),
        ceiling: structuredClone(active.l2.ceiling),
        planRotation: confirmed(active.l2.planRotation, []),
        poolAtriumOverlap: active.l2.poolAtriumOverlap,
        rightSetbackOverhang: active.l2.rightSetbackOverhang,
        gridDisplay: structuredClone(active.l2.gridDisplay),
        circulationZone: structuredClone(active.l2.circulationZone),
        stairZone: structuredClone(active.l2.stairZone),
        y0ExteriorFacade: structuredClone(active.l2.y0ExteriorFacade),
        stairChangingDivider: structuredClone(active.l2.stairChangingDivider),
        changingRoomEntries: structuredClone(active.l2.changingRoomEntries),
        corridorFeatures: structuredClone(active.l2.corridorFeatures),
        zones: structuredClone(active.l2.zones),
        stairToL3: {
          ...structuredClone(active.l2.stairToL3),
          flightRun: active.l2.stairToL3.runLengthPerFlight,
          midLandingElevation: active.l2.stairToL3.lowerElevation + active.l2.stairToL3.totalRise / 2,
          bounds: structuredClone(stairToL3.bounds),
        },
        planPivot: {
          x: l3Data.planPivot.x, y: l3Data.planPivot.y, z: active.levels.l2Elevation,
          status: 'working', strategy: 'fixed-floor-plate-centroid', openItemId: 'OPEN-016',
        },
      },
      l3: {
        bounds: structuredClone(l3.bounds),
        startX: l3.bounds.x1,
        endX: l3.bounds.x2,
        length: l3Size.length,
        width: l3Size.width,
        baseElevation: active.levels.l3Elevation,
        volumeHeight: working(l3Data.mirror.height, [], 'OPEN-011'),
        planRotation: working(active.solar.planRotation.value, active.solar.planRotation.sourceIds, 'OPEN-011'),
        planPivot: {
          x: l3Data.planPivot.x, y: l3Data.planPivot.y, z: active.levels.l3Elevation,
          status: 'working', strategy: l3Data.planPivot.strategy, openItemId: 'OPEN-011',
        },
        mirror: {
          entityId: l3Data.mirror.entityId,
          height: working(l3Data.mirror.height, [], 'OPEN-011'),
          leanFromVertical: working(active.solar.mirrorLeanFromVertical.value, active.solar.mirrorLeanFromVertical.sourceIds, 'OPEN-011'),
          materialIntent: l3Data.mirror.materialIntent,
          wallAndMirrorCoplanar: l3Data.mirror.wallAndMirrorCoplanar,
          sideWallEndGapsFilled: l3Data.mirror.sideWallEndGapsFilled,
          roofEdgeContinuous: l3Data.mirror.roofEdgeContinuous,
          openItemId: 'OPEN-011',
        },
        highLevelEquipment: structuredClone(l3Data.highLevelEquipment),
        equipmentPlacementRule: l3Data.equipmentPlacementRule,
        orthogonalExtension: structuredClone(l3Data.orthogonalExtension),
        arrivalWing: structuredClone(l3Data.arrivalWing),
        landscapeTerrace: structuredClone(l3Data.landscapeTerrace),
        programStrategy: structuredClone(l3Data.programStrategy),
        roof: structuredClone(l3Data.roof),
        pvRoofReserve: structuredClone(l3Data.pvRoofReserve),
        energyStorageStrategy: structuredClone(l3Data.energyStorageStrategy),
      },
      roof: {
        bounds: structuredClone(roof.bounds),
        startX: roof.bounds.x1,
        endX: roof.bounds.x2,
        planRun: roofSize.length,
        totalRun: roofSize.length,
        width: roofSize.width,
        pitch: confirmed(active.roof.pitch, []),
        highElevation: active.roof.highElevation,
        lowElevation: active.roof.lowElevation,
        transitionBand: confirmed(active.roof.l3TransitionBand, []),
        interfacePlanMismatch: working(0.7, [], 'OPEN-016'),
        rainCurtain: structuredClone(model.geometry.roof.rainCurtain),
        rainwaterReuse: structuredClone(model.geometry.roof.rainwaterReuse),
      },
      stair: {
        entityId: stairData.entityId,
        coordinateSystemId: stairData.coordinateSystemId,
        bounds: structuredClone(stair.bounds),
        totalRise: stairData.totalRise,
        riserCount: stairData.riserCount,
        risersPerRun: stairData.risersPerRun,
        treadsPerRun: stairData.treadsPerRun,
        treadDepth: stairData.treadDepth,
        flightRun: stairData.runLengthPerFlight,
        midLandingLength: stairData.midLandingLength,
        midLandingElevation: stairData.lowerElevation + stairData.totalRise / 2,
        lowerElevation: stairData.lowerElevation,
        upperElevation: stairData.upperElevation,
        designIntent: stairData.designIntent,
        treadConstruction: stairData.treadConstruction,
        stringerStrategy: stairData.stringerStrategy,
        stringerCount: stairData.stringerCount,
        midLandingSupport: stairData.midLandingSupport,
        underStairEnclosure: stairData.underStairEnclosure,
        status: 'working',
        guardStatus: 'deferred',
        guardOpenItemId: stairData.openItemId,
      },
      integrationReview: structuredClone(active.integrationReview),
    },
    layers: [
      { id: 'site', label: '基地與退縮', status: 'confirmed' },
      { id: 'l1', label: '1F 池畔、四間廁所與機房', status: 'working' },
      { id: 'water', label: '25 m 泳池與混合水道', status: 'confirmed' },
      { id: 'l2', label: '2F 固定更衣層', status: 'working' },
      { id: 'l3', label: '3F 旋轉服務層', status: 'working' },
      { id: 'roof', label: '玻璃屋頂與 3F 完整屋頂', status: 'working' },
      { id: 'circulation', label: '樓梯與結構整合', status: 'working' },
      { id: 'rain', label: '雨簾與回用水路', status: 'deferred' },
      { id: 'energy', label: '屋頂光電與儲能策略', status: 'working' },
      { id: 'annotations', label: '幾何註記', status: 'working' },
    ],
    analysis: {
      solar: {
        status: analysisStatus,
        recordedAnalysisInputHash,
        currentAnalysisInputHash,
        sourceIds: [...(analysisRegistry?.solar?.sourceIds ?? [])],
        disclaimer: '0.6.7 概念模型已同步；本版只修正 Viewer L2 splitAxisY 資料投影、錯置牆面與玻璃材質回復，鏡牆角度與 solar inputHash 未變，因此沿用既有日照分析。3F 光電發電／眩光、玻璃屋簷結構與儲能消防仍須專業驗證。',
      },
    },
  };

  finiteRecord(viewerModel);
  return viewerModel;
}
