export type NorthPlanDirection = 'upper-left' | 'upper-right' | 'lower-left' | 'lower-right';

export interface ViewerOrientation {
  bearingFromTrueNorth: number;
  threeWorldRotationDegrees: number;
  threeWorldRotationRadians: number;
  northInSite: { x: number; y: number };
  northPlanDirection: NorthPlanDirection;
}

const radians = (degrees: number) => degrees * Math.PI / 180;

export function normalizeBearingDegrees(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError('Bearing from true north must be finite.');
  return ((value % 360) + 360) % 360;
}

function normalizeSignedDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function deriveViewerOrientation(bearingFromTrueNorth: number): ViewerOrientation {
  const bearing = normalizeBearingDegrees(bearingFromTrueNorth);
  const bearingRadians = radians(bearing);
  const northInSite = {
    x: Math.cos(bearingRadians),
    y: Math.sin(bearingRadians),
  };
  const horizontal = northInSite.x < 0 ? 'left' : 'right';
  const vertical = northInSite.y < 0 ? 'lower' : 'upper';
  const threeWorldRotationDegrees = normalizeSignedDegrees(90 - bearing);

  return {
    bearingFromTrueNorth: bearing,
    threeWorldRotationDegrees,
    threeWorldRotationRadians: radians(threeWorldRotationDegrees),
    northInSite,
    northPlanDirection: `${vertical}-${horizontal}` as NorthPlanDirection,
  };
}
