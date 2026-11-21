import type { SitePlanPoint } from './site-orientation.mjs';

export interface SitePoint3 extends SitePlanPoint {
  z: number;
}

export interface MirrorGeometryInput {
  startX: number;
  width: number;
  pivot: SitePlanPoint;
  planRotation: number;
  leanFromVertical: number;
  height: number;
  baseElevation: number;
  positiveXAxisBearingFromTrueNorth: number;
}

export interface MirrorGeometry {
  normalAzimuth: number;
  normal: SitePlanPoint;
  lower: [SitePoint3, SitePoint3];
  upper: [SitePoint3, SitePoint3];
}

export function deriveMirrorGeometry(input: MirrorGeometryInput): MirrorGeometry;
