const RADIANS = Math.PI / 180;

const SITE_ORIENTATION_COORDINATE_SYSTEM = 'SITE-XY';
const SITE_POSITIVE_X_DIRECTION = 'pool-remote-to-service-core';

/** 圖面上真北所在方位的中文說明，供圖面產生器與圖面頁共用。 */
export const NORTH_PLAN_DIRECTION_LABELS = Object.freeze({
  'upper-left': '圖面左上',
  'upper-right': '圖面右上',
  'lower-left': '圖面左下',
  'lower-right': '圖面右下',
});

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
};

export function normalizeBearingDegrees(value) {
  const normalized = finite(value, 'bearing from true north') % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeSignedDegrees(value) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

export function deriveSiteOrientation(referenceSystem) {
  for (const legacyKey of [
    'localLongAxisBearingFromTrueNorth',
    'rightwardBearingFromTrueNorth',
    'northArrowPlanDirection',
  ]) {
    if (referenceSystem && legacyKey in referenceSystem) {
      throw new TypeError(`Legacy referenceSystem.${legacyKey} is forbidden.`);
    }
  }
  if (
    referenceSystem?.worldTransform &&
    'rotationFromTrueNorth' in referenceSystem.worldTransform
  ) {
    throw new TypeError('Legacy worldTransform.rotationFromTrueNorth is forbidden.');
  }
  const canonical = referenceSystem?.siteOrientation;
  if (canonical?.coordinateSystemId !== SITE_ORIENTATION_COORDINATE_SYSTEM) {
    throw new TypeError('referenceSystem.siteOrientation must use SITE-XY.');
  }
  if (canonical?.positiveXAxisDirection !== SITE_POSITIVE_X_DIRECTION) {
    throw new TypeError('SITE +X must run from the pool remote end toward the service core.');
  }

  const positiveXAxisBearingFromTrueNorth = normalizeBearingDegrees(
    canonical?.positiveXAxisBearingFromTrueNorth,
  );
  const negativeXAxisBearingFromTrueNorth = normalizeBearingDegrees(
    positiveXAxisBearingFromTrueNorth + 180,
  );
  const bearingRadians = positiveXAxisBearingFromTrueNorth * RADIANS;
  const northInSite = {
    x: Math.cos(bearingRadians),
    y: Math.sin(bearingRadians),
  };
  const horizontal = northInSite.x < 0 ? 'left' : 'right';
  const vertical = northInSite.y < 0 ? 'lower' : 'upper';
  const threeWorldRotationDegrees = normalizeSignedDegrees(90 - positiveXAxisBearingFromTrueNorth);

  return {
    positiveXAxisBearingFromTrueNorth,
    negativeXAxisBearingFromTrueNorth,
    longAxisBearingsFromTrueNorth: [
      negativeXAxisBearingFromTrueNorth,
      positiveXAxisBearingFromTrueNorth,
    ],
    poolFacingAzimuth: negativeXAxisBearingFromTrueNorth,
    svgRotationFromLocalX: normalizeBearingDegrees(positiveXAxisBearingFromTrueNorth - 90),
    svgNorthArrowRotation: normalizeBearingDegrees(threeWorldRotationDegrees),
    threeWorldRotationDegrees,
    threeWorldRotationRadians: threeWorldRotationDegrees * RADIANS,
    northInSite,
    northPlanDirection: `${vertical}-${horizontal}`,
  };
}

export function deriveMirrorNormalAzimuth(referenceSystem, planRotation) {
  const orientation = deriveSiteOrientation(referenceSystem);
  return normalizeBearingDegrees(
    orientation.poolFacingAzimuth + finite(planRotation, 'L3 plan rotation'),
  );
}

// SITE-XY is right-handed with Z up: seen from above, +X turns counter-clockwise
// onto +Y. Compass azimuths turn clockwise, so a bearing maps to the plan angle
// (bearing of +X) − azimuth. Every conversion between compass directions and
// SITE-XY goes through the two functions below; do not re-derive it elsewhere.

/** Horizontal unit vector in SITE-XY for a compass azimuth (degrees clockwise from true north). */
export function siteVectorFromAzimuth(azimuth, positiveXAxisBearingFromTrueNorth) {
  const planAngle =
    (finite(positiveXAxisBearingFromTrueNorth, 'bearing of SITE +X') - finite(azimuth, 'azimuth')) *
    RADIANS;
  return { x: Math.cos(planAngle), y: Math.sin(planAngle) };
}

/** Compass azimuth of a horizontal SITE-XY vector. */
export function azimuthFromSiteVector(vector, positiveXAxisBearingFromTrueNorth) {
  const planAngle =
    Math.atan2(finite(vector?.y, 'vector.y'), finite(vector?.x, 'vector.x')) / RADIANS;
  return normalizeBearingDegrees(
    finite(positiveXAxisBearingFromTrueNorth, 'bearing of SITE +X') - planAngle,
  );
}

/**
 * Rotates a SITE-XY plan point clockwise as seen from above, the sense in which
 * the model states the L3 plan rotation (same as the 3D viewer and drawings).
 */
export function rotateSitePointClockwise(point, pivot, clockwiseDegrees) {
  const angle = -finite(clockwiseDegrees, 'clockwise rotation') * RADIANS;
  const relativeX = finite(point?.x, 'point.x') - finite(pivot?.x, 'pivot.x');
  const relativeY = finite(point?.y, 'point.y') - finite(pivot?.y, 'pivot.y');
  return {
    x: pivot.x + relativeX * Math.cos(angle) - relativeY * Math.sin(angle),
    y: pivot.y + relativeX * Math.sin(angle) + relativeY * Math.cos(angle),
  };
}
