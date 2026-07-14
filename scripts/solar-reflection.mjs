const RADIANS = Math.PI / 180;
const DEGREES = 180 / Math.PI;

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite.');
  return value;
};

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function normalizeAzimuth(value) {
  const normalized = finite(value, 'azimuth') % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function circularAngleDelta(first, second) {
  const a = normalizeAzimuth(first);
  const b = normalizeAzimuth(second);
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function deriveSolarPlanOrientation(referenceSystem) {
  const localLongAxisBearing = normalizeAzimuth(finite(
    referenceSystem?.localLongAxisBearingFromTrueNorth,
    'referenceSystem.localLongAxisBearingFromTrueNorth',
  ));
  const buildingAzimuth = normalizeAzimuth(finite(
    referenceSystem?.worldTransform?.rotationFromTrueNorth,
    'referenceSystem.worldTransform.rotationFromTrueNorth',
  ));
  if (buildingAzimuth !== localLongAxisBearing) {
    throw new RangeError('solar plan orientation fields must match.');
  }
  return {
    buildingAzimuth,
    poolFacingAzimuth: normalizeAzimuth(buildingAzimuth + 180),
    svgRotationFromLocalX: normalizeAzimuth(buildingAzimuth - 90),
  };
}

const dayOfYear = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError('solar date must be valid.');
  }
  const start = Date.UTC(year, 0, 1);
  return Math.floor((date.getTime() - start) / 86_400_000) + 1;
};

export function calculateSolarPosition(input) {
  const year = finite(input?.year, 'year');
  const month = finite(input?.month, 'month');
  const day = finite(input?.day, 'day');
  const hour = finite(input?.hour, 'hour');
  const minute = finite(input?.minute ?? 0, 'minute');
  const second = finite(input?.second ?? 0, 'second');
  const latitude = finite(input?.latitude, 'latitude');
  const longitude = finite(input?.longitude, 'longitude');
  const utcOffsetHours = finite(input?.utcOffsetHours, 'utcOffsetHours');

  if (latitude < -90 || latitude > 90) throw new RangeError('latitude must be within -90..90.');
  if (longitude < -180 || longitude > 180) throw new RangeError('longitude must be within -180..180.');
  if (hour < 0 || hour >= 24 || minute < 0 || minute >= 60 || second < 0 || second >= 60) {
    throw new RangeError('solar time must be within a civil day.');
  }

  const ordinal = dayOfYear(year, month, day);
  const localHour = hour + minute / 60 + second / 3600;
  const fractionalYear = (2 * Math.PI / 365) * (ordinal - 1 + (localHour - 12) / 24);
  const equationOfTime = 229.18 * (
    0.000075
    + 0.001868 * Math.cos(fractionalYear)
    - 0.032077 * Math.sin(fractionalYear)
    - 0.014615 * Math.cos(2 * fractionalYear)
    - 0.040849 * Math.sin(2 * fractionalYear)
  );
  const declination = (
    0.006918
    - 0.399912 * Math.cos(fractionalYear)
    + 0.070257 * Math.sin(fractionalYear)
    - 0.006758 * Math.cos(2 * fractionalYear)
    + 0.000907 * Math.sin(2 * fractionalYear)
    - 0.002697 * Math.cos(3 * fractionalYear)
    + 0.00148 * Math.sin(3 * fractionalYear)
  );

  const timeOffset = equationOfTime + 4 * longitude - 60 * utcOffsetHours;
  let trueSolarTime = (localHour * 60 + timeOffset) % 1440;
  if (trueSolarTime < 0) trueSolarTime += 1440;
  let hourAngle = trueSolarTime / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;

  const latitudeRadians = latitude * RADIANS;
  const hourAngleRadians = hourAngle * RADIANS;
  const cosineZenith = clamp(
    Math.sin(latitudeRadians) * Math.sin(declination)
      + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngleRadians),
    -1,
    1,
  );
  const zenith = Math.acos(cosineZenith);
  const altitude = 90 - zenith * DEGREES;
  const azimuth = normalizeAzimuth(
    Math.atan2(
      Math.sin(hourAngleRadians),
      Math.cos(hourAngleRadians) * Math.sin(latitudeRadians)
        - Math.tan(declination) * Math.cos(latitudeRadians),
    ) * DEGREES + 180,
  );

  return {
    altitude,
    azimuth,
    declination: declination * DEGREES,
    equationOfTime,
  };
}

export function reflectSolarRay(input) {
  const solarAltitude = finite(input?.solarAltitude, 'solarAltitude');
  const solarAzimuth = normalizeAzimuth(input?.solarAzimuth);
  const wallNormalAzimuth = normalizeAzimuth(input?.wallNormalAzimuth);
  const wallLeanFromVertical = finite(input?.wallLeanFromVertical, 'wallLeanFromVertical');

  if (solarAltitude < -90 || solarAltitude > 90) throw new RangeError('solarAltitude must be within -90..90.');
  if (wallLeanFromVertical < -89 || wallLeanFromVertical > 89) {
    throw new RangeError('wallLeanFromVertical must be within -89..89.');
  }

  const altitude = solarAltitude * RADIANS;
  const sunAzimuth = solarAzimuth * RADIANS;
  const wallAzimuth = wallNormalAzimuth * RADIANS;
  const lean = wallLeanFromVertical * RADIANS;
  const sun = [
    Math.cos(altitude) * Math.sin(sunAzimuth),
    Math.cos(altitude) * Math.cos(sunAzimuth),
    Math.sin(altitude),
  ];
  const normal = [
    Math.cos(lean) * Math.sin(wallAzimuth),
    Math.cos(lean) * Math.cos(wallAzimuth),
    -Math.sin(lean),
  ];
  const facingDot = sun[0] * normal[0] + sun[1] * normal[1] + sun[2] * normal[2];
  const reflected = sun.map((component, index) => -component + 2 * facingDot * normal[index]);
  const horizontal = Math.hypot(reflected[0], reflected[1]);

  return {
    frontLit: facingDot > 0,
    facingFactor: Math.max(0, facingDot),
    incidenceAngle: Math.acos(clamp(facingDot, -1, 1)) * DEGREES,
    reflectedAzimuth: normalizeAzimuth(Math.atan2(reflected[0], reflected[1]) * DEGREES),
    reflectedDownwardAngle: Math.atan2(-reflected[2], horizontal) * DEGREES,
  };
}

export function evaluatePoolReflection(reflection, target) {
  const poolTargetAzimuth = normalizeAzimuth(target?.poolTargetAzimuth);
  const azimuthTolerance = finite(target?.azimuthTolerance ?? 28, 'azimuthTolerance');
  const minimumDownwardAngle = finite(target?.minimumDownwardAngle ?? 8, 'minimumDownwardAngle');
  const azimuthDelta = circularAngleDelta(reflection?.reflectedAzimuth, poolTargetAzimuth);
  const planPass = azimuthDelta <= azimuthTolerance;
  const sectionPass = reflection?.reflectedDownwardAngle >= minimumDownwardAngle;
  return {
    azimuthDelta,
    planPass,
    sectionPass,
    hitsPool: reflection?.frontLit === true && planPass && sectionPass,
  };
}
