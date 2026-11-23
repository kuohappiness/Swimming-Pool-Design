export interface SiteBounds {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}
export interface GeometryEntity {
  entityId: string;
  coordinateSystemId: 'SITE-XY';
  bounds: SiteBounds;
  [key: string]: unknown;
}
export interface ActiveGeometry {
  id: string;
  revision: string;
  modelVersion: string;
  coordinateSystemId: 'SITE-XY';
  [key: string]: unknown;
}
export const THREE_SITE_ADAPTER_ID: 'SITE-XYZ-TO-THREE-RH';
export function resolveActiveGeometry(model: unknown): ActiveGeometry;
export function geometryEntities(activeGeometry: ActiveGeometry): Map<string, GeometryEntity>;
export function resolveGeometryEntity(
  activeGeometry: ActiveGeometry,
  entityId: string,
): GeometryEntity;
export function sitePointToThree(point: [number, number, number]): [number, number, number];
