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
  status: string;
  [key: string]: unknown;
}

export interface ViewerModel {
  schemaVersion: '1.1.0';
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
    coordinateAdapter: { siteX: string; siteY: string; siteZ: string; adapterId: 'SITE-XY-TO-THREE' };
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
      doors: Array<{ entityId: string; side: string; center: number[]; clearWidth: number; status: string }>;
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
      planRotation: ViewerMeasure;
      poolAtriumOverlap: number;
      rightSetbackOverhang: number;
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
        openItemId: string;
      };
      highLevelEquipment: string[];
      equipmentPlacementRule: string;
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
      startX: number;
      endX: number;
      originY: number;
      width: number;
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
      recordedModelHash: string | null;
      currentModelHash: string;
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

export function adaptViewerData(modelInput: unknown, contentInput: unknown): {
  model: ViewerModel;
  content: ConceptContent;
} {
  const model = modelInput as ViewerModel;
  const content = contentInput as ConceptContent;
  if (model?.schemaVersion !== '1.1.0') throw new TypeError('Viewer model schema 不受支援。');
  if (content?.schemaVersion !== '1.0.0') throw new TypeError('理念內容 schema 不受支援。');
  if (!/^[a-f0-9]{64}$/.test(model.modelHash) || content.modelHash !== model.modelHash) {
    throw new TypeError('Viewer 模型與理念內容版本不同步。');
  }
  if (content.modelVersion !== model.modelVersion) throw new TypeError('Viewer modelVersion 不同步。');
  if (!model.activeGeometryRevisionId || model.coordinateSystemId !== 'SITE-XY') {
    throw new TypeError('Viewer 缺少唯一 active geometry 或 SITE-XY 座標系。');
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
    ['roof.highElevation', model.geometry.roof.highElevation],
    ['roof.lowElevation', model.geometry.roof.lowElevation],
    ['stair.totalRise', model.geometry.stair.totalRise],
  ] as const) finite(value, label);
  const ids = content.scenes.map((scene) => scene.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('理念場景 ID 不可重複。');
  return { model, content };
}

export const formatMetres = (value: number) => `${value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} m`;
export const formatElevation = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)} m`;
export const formatDegrees = (value: number) => `${value.toFixed(1)}°`;
