export interface SolarPositionInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  second?: number;
  latitude: number;
  longitude: number;
  utcOffsetHours: number;
}

export interface SolarPosition {
  altitude: number;
  azimuth: number;
  declination: number;
  equationOfTime: number;
}

export interface ReflectionInput {
  solarAltitude: number;
  solarAzimuth: number;
  wallNormalAzimuth: number;
  wallLeanFromVertical: number;
}

export interface SolarReflection {
  frontLit: boolean;
  facingFactor: number;
  incidenceAngle: number;
  reflectedAzimuth: number;
  reflectedDownwardAngle: number;
}

export interface PoolReflectionTarget {
  poolTargetAzimuth: number;
  azimuthTolerance?: number;
  minimumDownwardAngle?: number;
}

export interface PoolReflectionEvaluation {
  azimuthDelta: number;
  planPass: boolean;
  sectionPass: boolean;
  hitsPool: boolean;
}

export function normalizeAzimuth(value: number): number;
export function circularAngleDelta(first: number, second: number): number;
export function calculateSolarPosition(input: SolarPositionInput): SolarPosition;
export function reflectSolarRay(input: ReflectionInput): SolarReflection;
export function evaluatePoolReflection(
  reflection: SolarReflection,
  target: PoolReflectionTarget,
): PoolReflectionEvaluation;
