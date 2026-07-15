export interface PlanBounds {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface ReferenceGeometry {
  l1ServiceStartX: number;
  l1ServiceEndX: number;
  l1SplitAxisX: number;
  l2StartX: number;
  l2EndX: number;
  l2Length: number;
  l2SplitAxisX: number;
  maleL1Bounds: PlanBounds;
  femaleL1Bounds: PlanBounds;
  maleL2Bounds: PlanBounds;
  femaleL2Bounds: PlanBounds;
  flightRun: number;
  stairTotalRun: number;
  stairStartX: number;
  stairEndX: number;
  riserHeight: number;
  midLandingElevation: number;
  roofPlanStartX: number;
  roofPlanEndX: number;
  roofPlanRun: number;
  roofTotalRun: number;
  roofFarWallElevation: number;
  roofLowElevation: number;
  roofHighElevation: number;
  diagrammaticL1: {
    outdoorForecourtBounds: PlanBounds;
    dryPassageBounds: PlanBounds;
    poolHallOpening: PlanPoint;
    arrivalPath: {
      entityId: 'RTE-L1-ARRIVAL-01';
      width: number;
      thresholdBypassBounds: PlanBounds;
      clearRunBounds: PlanBounds;
      stairBounds: PlanBounds;
      minimumStairClearance: number;
      points: PlanPoint[];
    };
    maleFrontDoor: PlanPoint;
    maleRearDoor: PlanPoint;
    femaleFrontDoor: PlanPoint;
    femaleRearDoor: PlanPoint;
  };
}

export interface PlanPoint {
  x: number;
  y: number;
}

export function deriveReferenceGeometry(model: unknown): ReferenceGeometry;
