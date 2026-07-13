export type Status = 'confirmed' | 'working' | 'deferred' | 'legacy';

export interface Measure {
  value: number;
  status: Status;
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

export interface GenderProgram {
  zoneId: string;
  baseCount: number;
  maximumCount: number;
  activeIds: string[];
  expansionIds: string[];
}

export interface ProjectModel {
  schemaVersion: string;
  modelVersion: string;
  revision: string;
  project: { name: string; shortName: string; purpose: string; disclaimer: string };
  referenceSystem: {
    unit: string;
    angleUnit: string;
    axes: Record<string, string>;
    localLongAxisBearingFromTrueNorth: number;
    worldOriginEntityId: string;
    worldTransform: { localOrigin: number[]; worldOrigin: number[]; rotationFromTrueNorth: number };
    levels: Array<{ id: string; name: string; elevation: number }>;
    grids: { x: Array<{ id: string; position: number }>; y: Array<{ id: string; position: number }> };
  };
  geometry: {
    building: { length: Measure; width: Measure; poolHallLength: Measure; serviceCoreLength: Measure };
    pool: { origin: number[]; length: Measure; width: Measure; shallowDepth: Measure; deepDepth: Measure; laneCount: number };
    roof: { coverageZoneId: string; type: string; lowEdge: string; highEdge: string; pitch: Measure; lowElevation: Measure; highElevation: Measure };
    stair: {
      id: string; type: string; origin: number[]; width: number; totalRise: number; riserCount: number;
      runs: number; risersPerRun: number; treadDepth: number; midLandingLength: number; stringers: number;
      stringerDescription: string; guardrail: string; underStair: string; enclosure: string; supportedByRoof: boolean;
    };
    combinedCubicle: {
      width: number; depth: number; integratedChangingShower: boolean; wallMountedCabinet: boolean;
      centralLockerArea: boolean; cabinet: { width: number; depth: number; height: number; bottomElevation: number };
    };
  };
  program: {
    entrance: { entityId: string; dailyPeopleEntrance: boolean };
    l1: Record<string, { zoneId: string; toilets: number; urinals: number }>;
    l2: { strictGenderSeparation: boolean; sharedDistributionZoneId: string; male: GenderProgram; female: GenderProgram };
  };
  entities: Entity[];
  sheets: Sheet[];
  sources: Array<{ id: string; path: string; kind: string; pixelSize: number[]; sha256: string }>;
}

export interface SheetRender {
  id: string;
  markup: string;
  note: string;
}
