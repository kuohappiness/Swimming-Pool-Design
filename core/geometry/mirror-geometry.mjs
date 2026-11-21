// The outward-leaning L3 mirror wall in SITE-XY. Solar analysis, the solar study
// page and (later) the 3D viewer read the mirror from this one function, so the
// rotation sense and the lean direction are defined exactly once.
import {
  normalizeBearingDegrees,
  rotateSitePointClockwise,
  siteVectorFromAzimuth,
} from './site-orientation.mjs';

const RADIANS = Math.PI / 180;

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
};

/**
 * @param {object} input
 * @param {number} input.startX SITE X of the mirror edge before rotation (L3 pool end).
 * @param {number} input.width L3 width along SITE Y; the unrotated edge runs Y0 → Y=width.
 * @param {{x:number,y:number}} input.pivot L3 plan rotation pivot.
 * @param {number} input.planRotation L3 plan rotation, degrees clockwise seen from above.
 * @param {number} input.leanFromVertical Outward lean of the mirror, degrees from vertical.
 * @param {number} input.height Vertical height of the mirror.
 * @param {number} input.baseElevation Elevation of the mirror's lower edge.
 * @param {number} input.positiveXAxisBearingFromTrueNorth Compass bearing of SITE +X.
 */
export function deriveMirrorGeometry(input) {
  const startX = finite(input?.startX, 'startX');
  const width = finite(input?.width, 'width');
  const pivot = { x: finite(input?.pivot?.x, 'pivot.x'), y: finite(input?.pivot?.y, 'pivot.y') };
  const planRotation = finite(input?.planRotation, 'planRotation');
  const leanFromVertical = finite(input?.leanFromVertical, 'leanFromVertical');
  const height = finite(input?.height, 'height');
  const baseElevation = finite(input?.baseElevation, 'baseElevation');
  const positiveXBearing = finite(
    input?.positiveXAxisBearingFromTrueNorth,
    'positiveXAxisBearingFromTrueNorth',
  );
  if (width <= 0 || height <= 0) throw new RangeError('mirror width and height must be positive.');

  // The mirror faces the pool, i.e. SITE −X, and turns with L3.
  const normalAzimuth = normalizeBearingDegrees(positiveXBearing + 180 + planRotation);
  const normal = siteVectorFromAzimuth(normalAzimuth, positiveXBearing);
  const leanOffset = height * Math.tan(leanFromVertical * RADIANS);
  const lowerPlan = [
    rotateSitePointClockwise({ x: startX, y: 0 }, pivot, planRotation),
    rotateSitePointClockwise({ x: startX, y: width }, pivot, planRotation),
  ];
  const lower = lowerPlan.map((point) => ({ ...point, z: baseElevation }));
  const upper = lowerPlan.map((point) => ({
    x: point.x + normal.x * leanOffset,
    y: point.y + normal.y * leanOffset,
    z: baseElevation + height,
  }));
  return { normalAzimuth, normal, lower, upper };
}
