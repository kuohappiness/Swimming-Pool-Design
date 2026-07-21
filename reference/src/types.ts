export type Status = 'confirmed' | 'working' | 'deferred' | 'legacy';

export interface NumericMeasure {
  value: number;
  status: Exclude<Status, 'deferred'>;
  sourceIds: string[];
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  level: string;
  grid: string;
  status: Status;
  sourceIds: string[];
}

export interface Sheet {
  id: string;
  title: string;
  level: string;
  referencedEntityIds: string[];
}

export interface ActiveGeometryRevision {
  id: string;
  revision: string;
  modelVersion: string;
  status: string;
  coordinateSystemId: 'SITE-XY';
  solar: {
    planRotation: NumericMeasure;
    mirrorLeanFromVertical: NumericMeasure;
    azimuthTolerance: NumericMeasure;
    minimumDownwardAngle: NumericMeasure;
  };
  [key: string]: unknown;
}

export interface ProjectModel {
  schemaVersion: string;
  modelVersion: string;
  revision: string;
  activeGeometryRevisionId: string;
  designTargetVersion: string;
  geometryRevisions: ActiveGeometryRevision[];
  project: {
    name: string;
    shortName: string;
    purpose: string;
    disclaimer: string;
  };
  referenceSystem: {
    unit: string;
    angleUnit: string;
    axes: Record<string, string>;
    localLongAxisBearingFromTrueNorth: number;
    worldOriginEntityId: string;
    worldTransform: {
      localOrigin: number[];
      worldOrigin: number[];
      rotationFromTrueNorth: number;
    };
    siteLocation: {
      latitude: NumericMeasure;
      longitude: NumericMeasure;
      timeZone: string;
      utcOffsetHours: number;
    };
    coordinateSystems: Array<{
      id: 'SITE-XY';
      bounds: { x1: number; x2: number; y1: number; y2: number };
    }>;
    grids: {
      x: Array<{ id: string; position: number }>;
      y: Array<{ id: string; position: number }>;
    };
  };
  geometry: {
    building: {
      length: NumericMeasure;
      width: NumericMeasure;
      [key: string]: unknown;
    };
    combinedCubicle: {
      width: number;
      depth: number;
      integratedChangingShower: boolean;
      wallMountedCabinet: boolean;
      centralLockerArea: boolean;
      cabinet: { width: number; depth: number; height: number; bottomElevation: number };
    };
    [key: string]: unknown;
  };
  program: Record<string, unknown>;
  entities: Entity[];
  sheets: Sheet[];
  sources: Array<{
    id: string;
    path: string;
    kind: string;
    pixelSize?: number[];
    byteSize?: number;
    recordCount?: number;
    sha256: string;
  }>;
}

export interface SheetRender {
  id: string;
  title?: string;
  markup: string;
  note: string;
}
