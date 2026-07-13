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
  roofPlanStartX: number;
  roofPlanEndX: number;
  roofPlanRun: number;
}

export function deriveReferenceGeometry(model: unknown): ReferenceGeometry;
