import {
  deriveSiteOrientation,
  normalizeBearingDegrees as normalizeCanonicalBearing,
  type NorthPlanDirection,
  type SiteOrientationReferenceSystem,
} from '../../../scripts/site-orientation.mjs';

export interface ViewerOrientation {
  bearingFromTrueNorth: number;
  threeWorldRotationDegrees: number;
  threeWorldRotationRadians: number;
  northInSite: { x: number; y: number };
  northPlanDirection: NorthPlanDirection;
}

export function normalizeBearingDegrees(value: number): number {
  return normalizeCanonicalBearing(value);
}

export function deriveViewerOrientation(
  referenceSystem: SiteOrientationReferenceSystem,
): ViewerOrientation {
  const orientation = deriveSiteOrientation(referenceSystem);
  return {
    bearingFromTrueNorth: orientation.positiveXAxisBearingFromTrueNorth,
    threeWorldRotationDegrees: orientation.threeWorldRotationDegrees,
    threeWorldRotationRadians: orientation.threeWorldRotationRadians,
    northInSite: orientation.northInSite,
    northPlanDirection: orientation.northPlanDirection as NorthPlanDirection,
  };
}

export type { NorthPlanDirection };
