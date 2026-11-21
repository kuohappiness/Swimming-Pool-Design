const RADIANS = Math.PI / 180;

export const SITE_ORIENTATION_COORDINATE_SYSTEM = 'SITE-XY';
export const SITE_POSITIVE_X_DIRECTION = 'pool-remote-to-service-core';

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
};

export function normalizeBearingDegrees(value) {
  const normalized = finite(value, 'bearing from true north') % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeSignedDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
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
  if (referenceSystem?.worldTransform
    && 'rotationFromTrueNorth' in referenceSystem.worldTransform) {
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
  const threeWorldRotationDegrees = normalizeSignedDegrees(
    90 - positiveXAxisBearingFromTrueNorth,
  );

  return {
    positiveXAxisBearingFromTrueNorth,
    negativeXAxisBearingFromTrueNorth,
    longAxisBearingsFromTrueNorth: [
      negativeXAxisBearingFromTrueNorth,
      positiveXAxisBearingFromTrueNorth,
    ],
    poolFacingAzimuth: negativeXAxisBearingFromTrueNorth,
    svgRotationFromLocalX: normalizeBearingDegrees(
      positiveXAxisBearingFromTrueNorth - 90,
    ),
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
