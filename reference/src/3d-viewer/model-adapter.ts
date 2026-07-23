export type DesignStatus = 'confirmed' | 'working' | 'deferred';

export interface ViewerMeasure {
  value: number;
  status: DesignStatus;
  sourceIds: string[];
  openItemId?: string;
}

export interface SiteBounds { x1: number; x2: number; y1: number; y2: number }
export interface ViewerZone {
  entityId: string;
  coordinateSystemId: 'SITE-XY';
  bounds: SiteBounds;
  floorElevation?: number;
  entrySide?: string;
  fixtures?: { toilets: number; urinals: number; washbasins: number };
  layout?: {
    entranceRangeY: [number, number];
    washbasinWall: string;
    washbasins: Array<{ center: [number, number]; facing: string }>;
    toiletCubicles: Array<{ planBounds: SiteBounds; doorSide: string; doorLeaf: true; wallContact?: string }>;
    urinals: Array<{ center: [number, number]; facing: string; wallContact?: string }>;
    privacyScreen?: { planBounds: SiteBounds; height: number };
  };
  status: string;
  [key: string]: unknown;
}

export interface ViewerModel {
  schemaVersion: '1.3.0';
  modelVersion: string;
  revision: string;
  activeGeometryRevisionId: string;
  coordinateSystemId: 'SITE-XY';
  modelHash: string;
  project: { name: string; shortName: string; purpose: string; disclaimer: string };
  referenceSystem: {
    unit: 'm';
    angleUnit: 'degree';
    localLongAxisBearingFromTrueNorth: number;
    axes: { x: string; y: string; z: string };
    coordinateAdapter: {
      siteX: 'threeX';
      siteY: 'negativeThreeZ';
      siteZ: 'threeY';
      adapterId: 'SITE-XYZ-TO-THREE-RH';
    };
  };
  entityBounds: Record<string, { coordinateSystemId: 'SITE-XY'; bounds: SiteBounds }>;
  geometry: {
    site: { bounds: SiteBounds; length: number; width: number };
    building: {
      bounds: SiteBounds;
      length: ViewerMeasure;
      width: ViewerMeasure;
      upperFloorWidth: ViewerMeasure;
      poolHallLength: ViewerMeasure;
      serviceCoreLength: ViewerMeasure;
      leftSetback: ViewerMeasure;
      rightSetback: ViewerMeasure;
    };
    pool: {
      bounds: SiteBounds;
      origin: number[];
      length: ViewerMeasure;
      width: ViewerMeasure;
      shallowDepth: ViewerMeasure;
      deepDepth: ViewerMeasure;
      deckElevation: ViewerMeasure;
      laneCount: number;
      laneBands: Array<{ id: string; y1: number; y2: number; use: string }>;
    };
    l1: {
      bounds: SiteBounds;
      serviceWingBounds: SiteBounds;
      serviceWingStyle: {
        materialIntent: 'fair-faced-exposed-concrete';
        appearance: string;
        scope: string;
        excludedMaterials: string[];
        formworkExpression: string;
        status: 'confirmed';
        detailStatus: string;
      };
      y0ExteriorFacade: ViewerZone & {
        materialIntent: 'fair-faced-exposed-concrete';
        appearance: string;
        mainEntranceEntityId: 'EN-01';
        continuousExceptMainEntrance: true;
      };
      rightSetbackBounds: SiteBounds;
      mainEntranceBounds: SiteBounds;
      playgroundRamp: ViewerZone & { startElevation: number; endElevation: number; workingSlope: string };
      zones: {
        poolMaleToilet: ViewerZone;
        poolFemaleToilet: ViewerZone;
        playgroundMaleToilet: ViewerZone;
        playgroundFemaleToilet: ViewerZone;
        storage: ViewerZone;
        waterTreatment: ViewerZone;
        chemicalRoom: ViewerZone;
      };
      toiletEntrances: Array<{
        entityId: string;
        side: 'x31' | 'x39';
        center: [number, number];
        clearWidth: number;
        displayClearHeight: number;
        openingType: 'doorless-opening';
        doorLeaf: false;
        facadePosition: 'left' | 'right';
        viewedFrom: 'pool-hall-looking-positive-x' | 'playground-looking-negative-x';
        status: 'confirmed';
      }>;
      structuralStrategy: Record<string, unknown>;
    };
    l2: {
      bounds: SiteBounds;
      startX: number;
      endX: number;
      length: number;
      width: number;
      baseElevation: number;
      topElevation: number;
      volumeHeight: ViewerMeasure;
      ceiling: ViewerZone & { elevation: number; thickness: number; continuous: true };
      planRotation: ViewerMeasure;
      poolAtriumOverlap: number;
      rightSetbackOverhang: number;
      splitAxisY: number;
      gridDisplay: { minorSpacing: number; majorSpacing: number; axisLabels: boolean; status: string };
      circulationZone: ViewerZone & {
        polygon: Array<[number, number]>; area: number; use: string; standingOnly: true; seatingAllowed: false;
      };
      stairZone: ViewerZone & { area: number; y0Facade: string; y2_5Divider: string };
      y0ExteriorFacade: ViewerZone & {
        materialIntent: 'full-width-safety-glass'; opaqueSegments: false;
      };
      stairChangingDivider: ViewerZone & {
        axis: 'y2.5'; spanX: [number, number]; materialIntent: 'fair-faced-exposed-concrete';
        openings: []; continuous: true;
      };
      changingRoomEntries: Array<{
        entityId: string; zoneId: string; side: 'x32'; rangeY: [number, number]; clearWidth: number;
        openingType: 'doorless-opening'; doorLeaf: false; status: string;
      }>;
      corridorFeatures: {
        poolObservationWindow: { entityId: string; wall: 'x29'; spanY: [number, number]; status: string };
        standingCounter: { entityId: string; planExtent: SiteBounds; suspended: true; chairs: 0; status: string };
        drinkingFountain: { entityId: string; planExtent: SiteBounds; status: string };
        planters: Array<{ center: [number, number]; type: string }>;
      };
      zones: Record<'maleChangingShower' | 'femaleChangingShower', ViewerZone & {
        showerCount: number;
        showerModuleSize: [number, number];
        showerDimensionBasis: 'inclusive-of-partitions';
        showerCubicles: Array<{ id: string; planBounds: SiteBounds }>;
        supportFixtures: {
          fixtures: { toilets: 1; washbasins: 2 };
          washbasinWall: 'x32';
          toiletCubicles: Array<{ planBounds: SiteBounds; doorSide: string; doorLeaf: true }>;
          washbasins: Array<{ center: [number, number]; facing: 'positive-x' }>;
        };
        lockerBanks: Array<{ planExtent: SiteBounds }>;
        entryEntityId: string;
      }>;
      stairToL3: {
        entityId: 'ST-02'; coordinateSystemId: 'SITE-XY'; bounds: SiteBounds;
        lowerElevation: number; upperElevation: number; totalRise: number; clearWidth: number;
        axis: '+x'; lowerStartX: number; riserCount: number; runs: 2; risersPerRun: number;
        treadsPerRun: number; riserHeight: number; treadDepth: number; runLengthPerFlight: number;
        flightRun: number; midLandingLength: number; upperLandingLength: number;
        midLandingElevation: number; totalPlanLength: number; yBandLocked: [number, number];
        upperConnection: string; designIntent: 'suspended-floating-stair'; treadConstruction: string;
        stringerStrategy: string; stringerCount: 2; midLandingSupport: string; underStairEnclosure: false;
        underStairLandscape: ViewerZone & {
          planterCount: number; planting: string[]; containers: string; deepSoil: false;
          waterFeature: false; fixedIrrigationOnStringer: false; openItemId: string;
        };
        status: string; openItemId: string;
      };
      planPivot: { x: number; y: number; z: number; status: 'working'; strategy: string; openItemId: string };
    };
    l3: {
      bounds: SiteBounds;
      startX: number;
      endX: number;
      length: number;
      width: number;
      baseElevation: number;
      volumeHeight: ViewerMeasure;
      planRotation: ViewerMeasure;
      planPivot: { x: number; y: number; z: number; status: 'working'; strategy: string; openItemId: string };
      mirror: {
        entityId: string;
        height: ViewerMeasure;
        leanFromVertical: ViewerMeasure;
        materialIntent: string;
        wallAndMirrorCoplanar: true;
        sideWallEndGapsFilled: true;
        roofEdgeContinuous: true;
        openItemId: string;
      };
      highLevelEquipment: string[];
      equipmentPlacementRule: string;
      orthogonalExtension: ViewerZone & { polygon: Array<[number, number]>; grossArea: number; totalL3Area: number; rotation: 0 };
      arrivalWing: ViewerZone & { polygon: Array<[number, number]>; area: number; covered: true; connectsStairToIndoorL3: true };
      landscapeTerrace: ViewerZone & {
        outerPolygon: Array<[number, number]>; excludedArrivalWingPolygon: Array<[number, number]>;
        netLandscapeArea: number; access: 'teachers-and-maintenance-only'; studentsAllowed: false;
        visitorsAllowed: false; publicGathering: false; primaryEgress: false; accessControl: string[];
      };
      programStrategy: Record<string, string>;
      roof: ViewerZone & {
        baseElevation: number; thickness: number; rotation: number; area: number;
        continuous: true; extendsToMirrorTopEdge: true; openItemId: string;
      };
      pvRoofReserve: ViewerZone & {
        area: number; roofArea: number; coveragePercent: number; perimeterSetback: number;
        baseElevation: number; rotation: number; type: string; supportStrategy: string; excludedSupports: string[];
        reservedInterfaces: string[]; moduleLayoutStatus: 'working-dense-concept-layout'; capacityStatus: 'deferred';
        generationStatus: 'deferred'; openItemId: string;
      };
      energyStorageStrategy: {
        preferredLocation: 'ground-level-independent-outdoor-enclosure';
        exactGroundLocationStatus: 'deferred';
        batteryObjectsOnGeneralL3Interior: false;
        l3ReservedInterfaces: string[];
        l3Fallback: string;
        capacityStatus: 'deferred';
        backupDurationStatus: 'deferred';
        fireApproval: false;
        status: string;
        openItemId: string;
      };
    };
    roof: {
      bounds: SiteBounds;
      startX: number;
      endX: number;
      planRun: number;
      totalRun: number;
      width: number;
      pitch: ViewerMeasure;
      highElevation: number;
      lowElevation: number;
      transitionBand: ViewerMeasure;
      interfacePlanMismatch: ViewerMeasure;
      rainCurtain: Record<string, unknown>;
      rainwaterReuse: Record<string, unknown>;
    };
    stair: {
      entityId: string;
      coordinateSystemId: 'SITE-XY';
      bounds: SiteBounds;
      totalRise: number;
      riserCount: number;
      risersPerRun: number;
      treadsPerRun: number;
      treadDepth: number;
      flightRun: number;
      midLandingLength: number;
      midLandingElevation: number;
      lowerElevation: number;
      upperElevation: number;
      designIntent: 'suspended-floating-stair';
      treadConstruction: string;
      stringerStrategy: string;
      stringerCount: 2;
      midLandingSupport: string;
      underStairEnclosure: false;
      status: 'working';
      guardStatus: 'deferred';
      guardOpenItemId: string;
    };
    integrationReview: Record<string, unknown>;
  };
  layers: Array<{ id: string; label: string; status: DesignStatus }>;
  analysis: {
    solar: {
      status: 'current' | 'stale' | 'unavailable';
      recordedAnalysisInputHash: string | null;
      currentAnalysisInputHash: string;
      sourceIds: string[];
      disclaimer: string;
    };
  };
}

export interface ConceptScene {
  id: string;
  label: string;
  title: string;
  html: string;
}

export interface ConceptContent {
  schemaVersion: '1.0.0';
  modelVersion: string;
  modelHash: string;
  sourceHash: string;
  contentHash: string;
  scenes: ConceptScene[];
}

const finite = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} 必須是有限數值。`);
  return value;
};

const sameBounds = (first: SiteBounds, second: SiteBounds) =>
  first.x1 === second.x1 && first.x2 === second.x2 && first.y1 === second.y1 && first.y2 === second.y2;

export function adaptViewerData(modelInput: unknown, contentInput: unknown): {
  model: ViewerModel;
  content: ConceptContent;
} {
  const model = modelInput as ViewerModel;
  const content = contentInput as ConceptContent;
  if (model?.schemaVersion !== '1.3.0') throw new TypeError('Viewer model schema 不受支援。');
  if (content?.schemaVersion !== '1.0.0') throw new TypeError('理念內容 schema 不受支援。');
  if (!/^[a-f0-9]{64}$/.test(model.modelHash) || content.modelHash !== model.modelHash) {
    throw new TypeError('Viewer 模型與理念內容版本不同步。');
  }
  if (content.modelVersion !== model.modelVersion) throw new TypeError('Viewer modelVersion 不同步。');
  if (!model.activeGeometryRevisionId || model.coordinateSystemId !== 'SITE-XY') {
    throw new TypeError('Viewer 缺少唯一 active geometry 或 SITE-XY 座標系。');
  }
  const adapter = model.referenceSystem.coordinateAdapter;
  if (adapter?.adapterId !== 'SITE-XYZ-TO-THREE-RH'
    || adapter.siteX !== 'threeX'
    || adapter.siteY !== 'negativeThreeZ'
    || adapter.siteZ !== 'threeY') {
    throw new TypeError('Viewer 必須使用右手座標 SITE-XYZ-TO-THREE-RH adapter。');
  }
  const stairBounds = model.geometry.stair.bounds;
  const canonicalStairBounds = model.entityBounds[model.geometry.stair.entityId]?.bounds;
  if (!canonicalStairBounds || !sameBounds(stairBounds, canonicalStairBounds)) {
    throw new TypeError('ST-01 必須直接使用 active entityBounds 的 canonical bounds。');
  }
  if (stairBounds.y2 > model.geometry.pool.bounds.y1) {
    throw new TypeError('ST-01 必須保持在泳池 Y0 側，不得移到 Y14 側。');
  }
  if (model.geometry.stair.designIntent !== 'suspended-floating-stair'
    || model.geometry.stair.stringerCount !== 2
    || model.geometry.stair.underStairEnclosure !== false) {
    throw new TypeError('ST-01 必須維持懸空雙梯梁且梯下開放。');
  }
  const toiletEntrances = model.geometry.l1.toiletEntrances;
  if (toiletEntrances.length !== 4
    || toiletEntrances.some((entrance) => entrance.clearWidth !== 1
      || entrance.openingType !== 'doorless-opening'
      || entrance.doorLeaf !== false)) {
    throw new TypeError('四間廁所必須各有 1.00 m 無門板主入口。');
  }
  if (model.geometry.l1.serviceWingStyle.materialIntent !== 'fair-faced-exposed-concrete') {
    throw new TypeError('服務量體必須使用清水模材質意圖。');
  }
  if (model.geometry.l1.y0ExteriorFacade.materialIntent !== 'fair-faced-exposed-concrete'
    || model.geometry.l1.y0ExteriorFacade.continuousExceptMainEntrance !== true
    || model.geometry.l1.y0ExteriorFacade.mainEntranceEntityId !== 'EN-01') {
    throw new TypeError('0.6.4 的 L1 Y0 外牆必須為連續清水模，且只保留 EN-01 玻璃入口。');
  }
  const toiletZones = [
    model.geometry.l1.zones.poolMaleToilet,
    model.geometry.l1.zones.poolFemaleToilet,
    model.geometry.l1.zones.playgroundMaleToilet,
    model.geometry.l1.zones.playgroundFemaleToilet,
  ];
  if (toiletZones.some((zone) => zone.privacyScreen !== false || zone.layout?.privacyScreen !== undefined)) {
    throw new TypeError('0.6.3 四間廁所入口不得設置遮擋版。');
  }
  if (toiletZones.some((zone) => zone.layout?.toiletCubicles.some((cubicle) => cubicle.wallContact !== 'y3.5'))) {
    throw new TypeError('0.6.3 廁所 WC 隔間必須貼齊 Y3.5 牆面。');
  }
  if (model.geometry.l1.zones.playgroundMaleToilet.fixtures?.urinals !== 2
    || model.geometry.l1.zones.playgroundMaleToilet.fixtures?.washbasins !== 2
    || model.geometry.l1.zones.playgroundFemaleToilet.fixtures?.washbasins !== 2) {
    throw new TypeError('0.6.3 操場男廁須有 2 小便斗與 2 洗手槽，操場女廁須有 2 洗手槽。');
  }
  const showers = Object.values(model.geometry.l2.zones);
  if (showers.length !== 2 || showers.some((zone) => zone.showerCount !== 15
    || zone.showerCubicles.length !== 15
    || zone.showerModuleSize[0] !== 1.2 || zone.showerModuleSize[1] !== 1.2
    || zone.showerDimensionBasis !== 'inclusive-of-partitions'
    || zone.showerCubicles.some(({ planBounds }) => Math.abs(planBounds.x2 - planBounds.x1 - 1.2) > 1e-9 || Math.abs(planBounds.y2 - planBounds.y1 - 1.2) > 1e-9)
    || zone.supportFixtures.fixtures.toilets !== 1 || zone.supportFixtures.fixtures.washbasins !== 2)) {
    throw new TypeError('2F 男女各須配置 15 間含隔間 1.20 × 1.20 m 淋浴、1 WC 與 2 洗手槽。');
  }
  if (model.geometry.l2.circulationZone.area !== 41.75
    || model.geometry.l2.circulationZone.standingOnly !== true
    || model.geometry.l2.circulationZone.seatingAllowed !== false
    || model.geometry.l2.changingRoomEntries.length !== 2
    || model.geometry.l2.changingRoomEntries.some(({ clearWidth, doorLeaf }) => clearWidth !== 1 || doorLeaf !== false)) {
    throw new TypeError('2F 必須保留 L 形面池走道與男女各一個 1.00 m 無門片入口。');
  }
  const l2Divider = model.geometry.l2.stairChangingDivider;
  if (model.geometry.l2.y0ExteriorFacade.materialIntent !== 'full-width-safety-glass'
    || model.geometry.l2.y0ExteriorFacade.opaqueSegments !== false
    || l2Divider.axis !== 'y2.5'
    || l2Divider.spanX[0] !== 32 || l2Divider.spanX[1] !== 41
    || l2Divider.openings.length !== 0 || l2Divider.continuous !== true
    || model.geometry.l2.ceiling.continuous !== true
    || !sameBounds(model.geometry.l2.ceiling.bounds, model.geometry.l2.bounds)) {
    throw new TypeError('0.6.4 的 L2 必須保留 Y0 全玻璃、X32～41 無開口 Y2.5 分隔牆與完整天花板。');
  }
  const stairToL3 = model.geometry.l2.stairToL3;
  const canonicalStairToL3 = model.entityBounds[stairToL3.entityId]?.bounds;
  if (!canonicalStairToL3 || !sameBounds(stairToL3.bounds, canonicalStairToL3)
    || stairToL3.lowerStartX !== 32.5 || stairToL3.axis !== '+x'
    || stairToL3.bounds.y1 !== 0.5 || stairToL3.bounds.y2 !== 2) {
    throw new TypeError('ST-02 必須由 X32.5 起步並固定於 Y0.5～2 朝 +X 上行。');
  }
  if (stairToL3.designIntent !== 'suspended-floating-stair'
    || stairToL3.stringerCount !== 2
    || stairToL3.underStairEnclosure !== false
    || stairToL3.underStairLandscape.planterCount !== 3
    || stairToL3.underStairLandscape.containers !== 'removable-lightweight-planters') {
    throw new TypeError('ST-02 必須維持懸空雙梯梁、梯下開放及三組可移除輕量植栽。');
  }
  const terrace = model.geometry.l3.landscapeTerrace;
  if (model.geometry.l3.arrivalWing.covered !== true
    || model.geometry.l3.arrivalWing.connectsStairToIndoorL3 !== true
    || terrace.access !== 'teachers-and-maintenance-only'
    || terrace.studentsAllowed !== false || terrace.visitorsAllowed !== false
    || terrace.primaryEgress !== false) {
    throw new TypeError('3F 到達翼須為有頂室內動線；景觀區只限教師與維修人員且不得作主要逃生。');
  }
  const pv = model.geometry.l3.pvRoofReserve;
  const l3Roof = model.geometry.l3.roof;
  const storage = model.geometry.l3.energyStorageStrategy;
  if (l3Roof.continuous !== true || l3Roof.extendsToMirrorTopEdge !== true
    || model.geometry.l3.mirror.sideWallEndGapsFilled !== true
    || model.geometry.l3.mirror.roofEdgeContinuous !== true
    || pv.area !== 169.364 || pv.coveragePercent !== 92.74 || pv.perimeterSetback !== 0.25
    || pv.moduleLayoutStatus !== 'working-dense-concept-layout'
    || pv.capacityStatus !== 'deferred'
    || pv.rotation !== model.geometry.l3.planRotation.value
    || storage.preferredLocation !== 'ground-level-independent-outdoor-enclosure'
    || storage.batteryObjectsOnGeneralL3Interior !== false
    || storage.fireApproval !== false) {
    throw new TypeError('0.6.4 的 L3 必須有完整屋頂、鏡牆端部收邊與高覆蓋率光電排布；儲能仍以地面獨立戶外優先。');
  }
  if (model.referenceSystem.unit !== 'm') throw new TypeError('Viewer 只接受公尺模型。');
  for (const [label, value] of [
    ['building.length', model.geometry.building.length.value],
    ['building.width', model.geometry.building.width.value],
    ['pool.length', model.geometry.pool.length.value],
    ['pool.width', model.geometry.pool.width.value],
    ['pool.deckElevation', model.geometry.pool.deckElevation.value],
    ['l2.baseElevation', model.geometry.l2.baseElevation],
    ['l2.volumeHeight', model.geometry.l2.volumeHeight.value],
    ['l3.baseElevation', model.geometry.l3.baseElevation],
    ['l3.volumeHeight', model.geometry.l3.volumeHeight.value],
    ['l3.roof.area', model.geometry.l3.roof.area],
    ['roof.highElevation', model.geometry.roof.highElevation],
    ['roof.lowElevation', model.geometry.roof.lowElevation],
    ['stair.totalRise', model.geometry.stair.totalRise],
    ['stairToL3.totalRise', model.geometry.l2.stairToL3.totalRise],
    ['landscapeTerrace.netLandscapeArea', model.geometry.l3.landscapeTerrace.netLandscapeArea],
    ['pvRoofReserve.area', model.geometry.l3.pvRoofReserve.area],
    ['pvRoofReserve.baseElevation', model.geometry.l3.pvRoofReserve.baseElevation],
  ] as const) finite(value, label);
  const ids = content.scenes.map((scene) => scene.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('理念場景 ID 不可重複。');
  return { model, content };
}

export const formatMetres = (value: number) => `${value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} m`;
export const formatElevation = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)} m`;
export const formatDegrees = (value: number) => `${value.toFixed(1)}°`;
