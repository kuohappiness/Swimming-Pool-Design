export type Status = 'confirmed' | 'working' | 'deferred' | 'legacy';
export type NumericStatus = Exclude<Status, 'deferred'>;

export interface NumericMeasure {
  value: number;
  status: NumericStatus;
  sourceIds: string[];
}

export interface DeferredMeasure {
  value: null;
  status: 'deferred';
  sourceIds: string[];
  openItemId: string;
}

export type Measure = NumericMeasure | DeferredMeasure;

export interface SolarReflectionGeometry {
  planRotation: NumericMeasure;
  mirrorLeanFromVertical: NumericMeasure;
  rotationDirection: 'clockwise-from-above';
  mirrorLeanDirection: 'toward-pool';
  azimuthTolerance: NumericMeasure;
  minimumDownwardAngle: NumericMeasure;
  planPivot: {
    strategy: 'l2-start-width-center';
    status: 'working';
    sourceIds: string[];
    openItemId: 'OPEN-011';
  };
  mirrorVisualWallHeight: NumericMeasure & { openItemId: 'OPEN-011' };
  openItemId: 'OPEN-011';
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

export interface DoorProgram {
  entityId: string;
  connectsTo: string;
  access: 'daily-open' | 'pool-hours-only';
}

export interface ToiletProgram {
  zoneId: string;
  side: 'lower-x' | 'higher-x';
  toilets: number;
  urinals: number;
  frontDoor: DoorProgram;
  rearDoor: DoorProgram;
  doorsDirectlyAligned: false;
  privacyScreen: true;
}

export interface DryPassageProgram {
  entityId: string;
  side: 'pool-side';
  connectsFromZoneId: string;
  connectsToDoorEntityIds: string[];
  continuous: true;
  geometryStatus: 'deferred';
  openItemId: string;
}

export interface L1AccessConflicts {
  stairEntityId: string;
  blocksOutdoorOpenings: false;
  blocksToiletDoors: false;
  blocksDryPassage: false;
}

export interface GenderProgram {
  zoneId: string;
  side: 'lower-x' | 'higher-x';
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
    siteLocation: {
      latitude: NumericMeasure;
      longitude: NumericMeasure;
      timeZone: string;
      utcOffsetHours: number;
    };
    levels: Array<{
      id: string;
      name: string;
      elevation: number | null;
      status?: 'confirmed' | 'working' | 'deferred';
      sourceIds?: string[];
      openItemId?: string;
    }>;
    grids: { x: Array<{ id: string; position: number }>; y: Array<{ id: string; position: number }> };
  };
  geometry: {
    building: {
      length: NumericMeasure;
      width: NumericMeasure;
      poolHallLength: NumericMeasure;
      serviceCoreLength: NumericMeasure;
      l2ExtensionLength: NumericMeasure;
      l2VolumeHeight: NumericMeasure;
    };
    pool: {
      origin: number[];
      length: NumericMeasure;
      width: NumericMeasure;
      shallowDepth: NumericMeasure;
      deepDepth: NumericMeasure;
      laneCount: number;
    };
    roof: {
      coverageZoneId: string;
      type: string;
      lowEdge: string;
      highEdge: string;
      pitch: NumericMeasure;
      lowOverhang: NumericMeasure;
      jointEntityId: string;
      supportedByExtension: false;
      jointStrategy: 'independent-curb-movement-joint-double-flashing';
      l2Visor: {
        projection: number;
        visualThickness: number;
        shadowGap: number;
        sideReturn: number;
        supportsRoof: false;
      };
      rainCurtain: {
        entityId: 'RC-RF-01';
        type: 'passive-full-width-overflow-curtain';
        equalizationTrough: true;
        dryWeatherRecirculation: false;
        catchTrenchEntityId: 'RW-TR-01';
        catchTrenchType: 'closed-isolated-removable-grating';
        groundRunoffIsolated: true;
        extremeRainBypass: 'independent-high-level-overflow';
      };
      rainwaterReuse: {
        entityId: 'RW-01';
        source: 'roof-only';
        firstFlush: true;
        debrisScreen: true;
        settlingAndFiltration: true;
        coveredStorage: true;
        use: 'l1-toilet-flushing';
        potableMakeupIsolation: 'visible-air-gap-or-approved-equivalent';
        identifiedSeparatePipework: true;
        overflow: 'site-stormwater-or-infiltration';
        capacityStatus: 'deferred';
        openItemId: 'OPEN-014';
      };
    };
    stair: {
      id: string;
      type: string;
      originY: number;
      originZ: number;
      upperEndAlignment: 'l2-split-axis';
      width: number;
      riserCount: number;
      runs: number;
      risersPerRun: number;
      treadsPerRun: number;
      treadDepth: number;
      midLandingLength: number;
      stringers: number;
      stringerDescription: string;
      supportSystem: 'S1-continuous-twin-box-stringers';
      landingSupport: 'integrated-torsion-box-no-column';
      riserClosure: 'closed';
      guardrail: {
        primaryType: 'full-height-vertical-tension-screen';
        fallbackType: 'laminated-glass';
        minimumHeight: number;
        fallbackHeight: number;
        nominalLineSpacing: number;
        collectorBeam: 'concealed-independent-l2-or-gallery-structure';
        materialStatus: 'deferred';
        openItemId: 'OPEN-013';
      };
      underStair: string;
      enclosure: string;
      supportedByRoof: boolean;
    };
    combinedCubicle: {
      width: number;
      depth: number;
      integratedChangingShower: boolean;
      wallMountedCabinet: boolean;
      centralLockerArea: boolean;
      cabinet: { width: number; depth: number; height: number; bottomElevation: number };
    };
    solarReflection: SolarReflectionGeometry;
  };
  program: {
    entrance: {
      entityId: string;
      dailyPeopleEntrance: boolean;
      arrivalContext: 'school-playground';
      outdoorForecourtZoneId: string;
      forecourtEnvironment: 'outdoor';
      arrivalPathEntityId: string;
      clearsStairEntityId: string;
      positiveStairClearanceRequired: true;
      outdoorOpeningEntityIds: string[];
      openingsIndependent: true;
      geometryStatus: 'deferred';
      openItemId: string;
    };
    l1: {
      dryPassage: DryPassageProgram;
      accessConflicts: L1AccessConflicts;
      maleToilet: ToiletProgram;
      femaleToilet: ToiletProgram;
    };
    l2: {
      strictGenderSeparation: boolean;
      sharedDistributionZoneId: string;
      male: GenderProgram;
      female: GenderProgram;
    };
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
