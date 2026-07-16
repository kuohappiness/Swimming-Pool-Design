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

export interface Point2D {
  x: number;
  y: number;
}

export interface Vector3D extends Point2D {
  z: number;
}

export interface Rectangle2D {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface MirrorFootprintInput {
  reflection: SolarReflection;
  localLongAxisBearingFromTrueNorth: number;
  baseCenter: Point2D;
  pivot: Point2D;
  width: number;
  verticalHeight: number;
  baseElevation: number;
  planRotation: number;
  leanFromVertical: number;
  poolRectangle?: Rectangle2D;
}

export interface MirrorFootprintResult {
  reachesPoolPlane: boolean;
  rotatedBaseCenter?: Point2D;
  sourceCorners?: Vector3D[];
  footprint: Point2D[];
  hitsPool: boolean;
}

export interface SolarPlanReferenceSystem {
  localLongAxisBearingFromTrueNorth: number;
  worldTransform: {
    rotationFromTrueNorth: number;
  };
}

export function normalizeAzimuth(value: number): number;
export function circularAngleDelta(first: number, second: number): number;
export function deriveSolarPlanOrientation(referenceSystem: SolarPlanReferenceSystem): {
  buildingAzimuth: number;
  poolFacingAzimuth: number;
  svgRotationFromLocalX: number;
};
export function calculateSolarPosition(input: SolarPositionInput): SolarPosition;
export function reflectSolarRay(input: ReflectionInput): SolarReflection;
export function evaluatePoolReflection(
  reflection: SolarReflection,
  target: PoolReflectionTarget,
): PoolReflectionEvaluation;
export function reflectionDirectionInLocalCoordinates(
  reflection: SolarReflection,
  localLongAxisBearingFromTrueNorth: number,
): Vector3D;
export function solarDirectionInLocalCoordinates(
  solar: Pick<SolarPosition, 'altitude' | 'azimuth'>,
  localLongAxisBearingFromTrueNorth: number,
): Vector3D;
export function rotatePlanPoint(
  point: Point2D,
  pivot: Point2D,
  rotationDegrees: number,
): Point2D;
export function polygonArea(polygon: Point2D[]): number;
export function intersectConvexPolygons(
  subjectPolygon: Point2D[],
  clipPolygon: Point2D[],
): Point2D[];
export function projectShadowFootprint(
  points: Vector3D[],
  solarDirection: Vector3D,
  planeElevation?: number,
): Point2D[];
export function polygonIntersectsRectangle(
  polygon: Point2D[],
  rectangle: Rectangle2D,
): boolean;
export function projectMirrorReflectionFootprint(
  input: MirrorFootprintInput,
): MirrorFootprintResult;
