import type { MirrorGeometryInput } from '../geometry/mirror-geometry.mjs';
import type { MirrorFootprintResult, Rectangle2D, SolarReflection } from './solar-reflection.mjs';

export interface FootprintOverrides {
  planRotation?: number;
  leanFromVertical?: number;
  pivotX?: number;
}

export interface ActiveMirrorFootprintGeometry extends MirrorGeometryInput {
  poolRectangle: Rectangle2D;
}

export function activeMirrorFootprintGeometry(
  model: unknown,
  overrides?: FootprintOverrides,
): ActiveMirrorFootprintGeometry;
export function projectPoolFootprint(
  model: unknown,
  reflection: SolarReflection,
  overrides?: FootprintOverrides,
): MirrorFootprintResult;
