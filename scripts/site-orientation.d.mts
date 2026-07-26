export type NorthPlanDirection = 'upper-left' | 'upper-right' | 'lower-left' | 'lower-right';

export interface CanonicalSiteOrientation {
  coordinateSystemId: 'SITE-XY';
  positiveXAxisBearingFromTrueNorth: number;
  positiveXAxisDirection: 'pool-remote-to-service-core';
  status?: string;
  sourceIds?: string[];
}

export interface SiteOrientationReferenceSystem {
  siteOrientation: CanonicalSiteOrientation;
}

export interface DerivedSiteOrientation {
  positiveXAxisBearingFromTrueNorth: number;
  negativeXAxisBearingFromTrueNorth: number;
  longAxisBearingsFromTrueNorth: [number, number];
  poolFacingAzimuth: number;
  svgRotationFromLocalX: number;
  svgNorthArrowRotation: number;
  threeWorldRotationDegrees: number;
  threeWorldRotationRadians: number;
  northInSite: { x: number; y: number };
  northPlanDirection: NorthPlanDirection;
}

export const SITE_ORIENTATION_COORDINATE_SYSTEM: 'SITE-XY';
export const SITE_POSITIVE_X_DIRECTION: 'pool-remote-to-service-core';
export function normalizeBearingDegrees(value: number): number;
export function deriveSiteOrientation(
  referenceSystem: SiteOrientationReferenceSystem,
): DerivedSiteOrientation;
export function deriveMirrorNormalAzimuth(
  referenceSystem: SiteOrientationReferenceSystem,
  planRotation: number,
): number;
