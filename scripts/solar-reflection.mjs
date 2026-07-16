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

const daysInYear = (year) => (
  Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)
) / 86_400_000;

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
  const fractionalYear = (2 * Math.PI / daysInYear(year))
    * (ordinal - 1 + (localHour - 12) / 24);
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

export function reflectionDirectionInLocalCoordinates(
  reflection,
  localLongAxisBearingFromTrueNorth,
) {
  const downwardAngle = finite(
    reflection?.reflectedDownwardAngle,
    'reflection.reflectedDownwardAngle',
  );
  const relativeAzimuth = (
    normalizeAzimuth(reflection?.reflectedAzimuth)
      - normalizeAzimuth(localLongAxisBearingFromTrueNorth)
  ) * RADIANS;
  const downwardRadians = downwardAngle * RADIANS;
  const horizontal = Math.cos(downwardRadians);
  return {
    x: horizontal * Math.cos(relativeAzimuth),
    y: horizontal * Math.sin(relativeAzimuth),
    z: -Math.sin(downwardRadians),
  };
}

export function solarDirectionInLocalCoordinates(
  solar,
  localLongAxisBearingFromTrueNorth,
) {
  const altitude = finite(solar?.altitude, 'solar.altitude') * RADIANS;
  const relativeAzimuth = (
    normalizeAzimuth(solar?.azimuth)
      - normalizeAzimuth(localLongAxisBearingFromTrueNorth)
  ) * RADIANS;
  const horizontal = Math.cos(altitude);
  return {
    x: horizontal * Math.cos(relativeAzimuth),
    y: horizontal * Math.sin(relativeAzimuth),
    z: Math.sin(altitude),
  };
}

export function rotatePlanPoint(point, pivot, rotationDegrees) {
  const normalizedPoint = {
    x: finite(point?.x, 'point.x'),
    y: finite(point?.y, 'point.y'),
  };
  const normalizedPivot = {
    x: finite(pivot?.x, 'pivot.x'),
    y: finite(pivot?.y, 'pivot.y'),
  };
  const rotation = finite(rotationDegrees, 'rotationDegrees') * RADIANS;
  const relativeX = normalizedPoint.x - normalizedPivot.x;
  const relativeY = normalizedPoint.y - normalizedPivot.y;
  return {
    x: normalizedPivot.x + relativeX * Math.cos(rotation) - relativeY * Math.sin(rotation),
    y: normalizedPivot.y + relativeX * Math.sin(rotation) + relativeY * Math.cos(rotation),
  };
}

const cross2d = (origin, first, second) => (
  (first.x - origin.x) * (second.y - origin.y)
    - (first.y - origin.y) * (second.x - origin.x)
);

const pointInRectangle = (point, rectangle, epsilon = 1e-9) => (
  point.x >= rectangle.x1 - epsilon
    && point.x <= rectangle.x2 + epsilon
    && point.y >= rectangle.y1 - epsilon
    && point.y <= rectangle.y2 + epsilon
);

const pointInConvexPolygon = (point, polygon, epsilon = 1e-9) => {
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const cross = cross2d(polygon[index], polygon[(index + 1) % polygon.length], point);
    if (Math.abs(cross) <= epsilon) continue;
    const nextSign = Math.sign(cross);
    if (sign !== 0 && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
};

const onSegment = (point, first, second, epsilon = 1e-9) => (
  Math.abs(cross2d(first, second, point)) <= epsilon
    && point.x >= Math.min(first.x, second.x) - epsilon
    && point.x <= Math.max(first.x, second.x) + epsilon
    && point.y >= Math.min(first.y, second.y) - epsilon
    && point.y <= Math.max(first.y, second.y) + epsilon
);

const segmentsIntersect = (a1, a2, b1, b2, epsilon = 1e-9) => {
  const c1 = cross2d(a1, a2, b1);
  const c2 = cross2d(a1, a2, b2);
  const c3 = cross2d(b1, b2, a1);
  const c4 = cross2d(b1, b2, a2);
  if (((c1 > epsilon && c2 < -epsilon) || (c1 < -epsilon && c2 > epsilon))
    && ((c3 > epsilon && c4 < -epsilon) || (c3 < -epsilon && c4 > epsilon))) {
    return true;
  }
  return onSegment(b1, a1, a2, epsilon)
    || onSegment(b2, a1, a2, epsilon)
    || onSegment(a1, b1, b2, epsilon)
    || onSegment(a2, b1, b2, epsilon);
};

const signedPolygonArea = (polygon) => {
  let sum = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    sum += current.x * next.y - current.y * next.x;
  }
  return sum / 2;
};

export function polygonArea(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return 0;
  return Math.abs(signedPolygonArea(polygon));
}

const lineIntersection = (subjectStart, subjectEnd, clipStart, clipEnd) => {
  const subjectX = subjectEnd.x - subjectStart.x;
  const subjectY = subjectEnd.y - subjectStart.y;
  const clipX = clipEnd.x - clipStart.x;
  const clipY = clipEnd.y - clipStart.y;
  const denominator = subjectX * clipY - subjectY * clipX;
  if (Math.abs(denominator) <= 1e-12) return subjectEnd;
  const offsetX = clipStart.x - subjectStart.x;
  const offsetY = clipStart.y - subjectStart.y;
  const scale = (offsetX * clipY - offsetY * clipX) / denominator;
  return {
    x: subjectStart.x + scale * subjectX,
    y: subjectStart.y + scale * subjectY,
  };
};

export function intersectConvexPolygons(subjectPolygon, clipPolygon) {
  if (!Array.isArray(subjectPolygon) || !Array.isArray(clipPolygon)
    || subjectPolygon.length < 3 || clipPolygon.length < 3) return [];
  let output = subjectPolygon.map((point, index) => ({
    x: finite(point?.x, `subjectPolygon[${index}].x`),
    y: finite(point?.y, `subjectPolygon[${index}].y`),
  }));
  const clip = clipPolygon.map((point, index) => ({
    x: finite(point?.x, `clipPolygon[${index}].x`),
    y: finite(point?.y, `clipPolygon[${index}].y`),
  }));
  const orientation = Math.sign(signedPolygonArea(clip)) || 1;
  for (let clipIndex = 0; clipIndex < clip.length; clipIndex += 1) {
    const clipStart = clip[clipIndex];
    const clipEnd = clip[(clipIndex + 1) % clip.length];
    const input = output;
    output = [];
    if (input.length === 0) break;
    let previous = input.at(-1);
    let previousInside = orientation * cross2d(clipStart, clipEnd, previous) >= -1e-9;
    for (const current of input) {
      const currentInside = orientation * cross2d(clipStart, clipEnd, current) >= -1e-9;
      if (currentInside !== previousInside) {
        output.push(lineIntersection(previous, current, clipStart, clipEnd));
      }
      if (currentInside) output.push(current);
      previous = current;
      previousInside = currentInside;
    }
  }
  return output;
}

const convexHull = (points) => {
  const sorted = [...points].sort((first, second) => first.x - second.x || first.y - second.y);
  if (sorted.length <= 1) return sorted;
  const buildHalf = (source) => {
    const half = [];
    for (const point of source) {
      while (half.length >= 2 && cross2d(half.at(-2), half.at(-1), point) <= 1e-9) half.pop();
      half.push(point);
    }
    return half;
  };
  const lower = buildHalf(sorted);
  const upper = buildHalf([...sorted].reverse());
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
};

export function projectShadowFootprint(points, solarDirection, planeElevation = 0) {
  if (!Array.isArray(points) || points.length < 3) {
    throw new TypeError('shadow source must contain at least three points.');
  }
  const direction = {
    x: finite(solarDirection?.x, 'solarDirection.x'),
    y: finite(solarDirection?.y, 'solarDirection.y'),
    z: finite(solarDirection?.z, 'solarDirection.z'),
  };
  const targetZ = finite(planeElevation, 'planeElevation');
  if (direction.z <= 1e-9) return [];
  const projected = points.map((point, index) => {
    const x = finite(point?.x, `points[${index}].x`);
    const y = finite(point?.y, `points[${index}].y`);
    const z = finite(point?.z, `points[${index}].z`);
    const scale = (z - targetZ) / direction.z;
    return {
      x: x - direction.x * scale,
      y: y - direction.y * scale,
    };
  });
  return convexHull(projected);
}

export function polygonIntersectsRectangle(polygon, rectangle) {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    throw new TypeError('polygon must contain at least three points.');
  }
  const normalizedRectangle = {
    x1: finite(rectangle?.x1, 'rectangle.x1'),
    x2: finite(rectangle?.x2, 'rectangle.x2'),
    y1: finite(rectangle?.y1, 'rectangle.y1'),
    y2: finite(rectangle?.y2, 'rectangle.y2'),
  };
  if (normalizedRectangle.x2 < normalizedRectangle.x1
    || normalizedRectangle.y2 < normalizedRectangle.y1) {
    throw new RangeError('rectangle maximum bounds must not be less than minimum bounds.');
  }
  const points = polygon.map((point, index) => ({
    x: finite(point?.x, `polygon[${index}].x`),
    y: finite(point?.y, `polygon[${index}].y`),
  }));
  const rectanglePoints = [
    { x: normalizedRectangle.x1, y: normalizedRectangle.y1 },
    { x: normalizedRectangle.x2, y: normalizedRectangle.y1 },
    { x: normalizedRectangle.x2, y: normalizedRectangle.y2 },
    { x: normalizedRectangle.x1, y: normalizedRectangle.y2 },
  ];
  if (points.some((point) => pointInRectangle(point, normalizedRectangle))) return true;
  if (rectanglePoints.some((point) => pointInConvexPolygon(point, points))) return true;
  for (let polygonIndex = 0; polygonIndex < points.length; polygonIndex += 1) {
    const polygonStart = points[polygonIndex];
    const polygonEnd = points[(polygonIndex + 1) % points.length];
    for (let rectangleIndex = 0; rectangleIndex < rectanglePoints.length; rectangleIndex += 1) {
      const rectangleStart = rectanglePoints[rectangleIndex];
      const rectangleEnd = rectanglePoints[(rectangleIndex + 1) % rectanglePoints.length];
      if (segmentsIntersect(polygonStart, polygonEnd, rectangleStart, rectangleEnd)) return true;
    }
  }
  return false;
}

export function projectMirrorReflectionFootprint(input) {
  const baseCenter = {
    x: finite(input?.baseCenter?.x, 'baseCenter.x'),
    y: finite(input?.baseCenter?.y, 'baseCenter.y'),
  };
  const pivot = {
    x: finite(input?.pivot?.x, 'pivot.x'),
    y: finite(input?.pivot?.y, 'pivot.y'),
  };
  const width = finite(input?.width, 'width');
  const verticalHeight = finite(input?.verticalHeight, 'verticalHeight');
  const baseElevation = finite(input?.baseElevation, 'baseElevation');
  const planRotation = finite(input?.planRotation, 'planRotation');
  const leanFromVertical = finite(input?.leanFromVertical, 'leanFromVertical');
  if (width <= 0 || verticalHeight <= 0 || baseElevation <= 0) {
    throw new RangeError('mirror dimensions and baseElevation must be greater than zero.');
  }

  const direction = reflectionDirectionInLocalCoordinates(
    input?.reflection,
    input?.localLongAxisBearingFromTrueNorth,
  );
  if (input?.reflection?.frontLit !== true || direction.z >= -1e-9) {
    return { reachesPoolPlane: false, footprint: [], hitsPool: false };
  }

  const rotationRadians = planRotation * RADIANS;
  const rotatedBaseCenter = rotatePlanPoint(baseCenter, pivot, planRotation);
  const normal = {
    x: -Math.cos(rotationRadians),
    y: -Math.sin(rotationRadians),
  };
  const tangent = { x: -normal.y, y: normal.x };
  const topOffset = verticalHeight * Math.tan(leanFromVertical * RADIANS);
  const mirrorCorners = [
    { along: -width / 2, height: 0 },
    { along: width / 2, height: 0 },
    { along: width / 2, height: verticalHeight },
    { along: -width / 2, height: verticalHeight },
  ];
  const sourceCorners = mirrorCorners.map((corner) => {
    const leanOffset = corner.height === 0 ? 0 : topOffset;
    return {
      x: rotatedBaseCenter.x + tangent.x * corner.along + normal.x * leanOffset,
      y: rotatedBaseCenter.y + tangent.y * corner.along + normal.y * leanOffset,
      z: baseElevation + corner.height,
    };
  });
  const footprint = sourceCorners.map((point) => {
    const rayScale = -point.z / direction.z;
    return {
      x: point.x + direction.x * rayScale,
      y: point.y + direction.y * rayScale,
    };
  });
  const hitsPool = input?.poolRectangle
    ? polygonIntersectsRectangle(footprint, input.poolRectangle)
    : false;
  return {
    reachesPoolPlane: true,
    rotatedBaseCenter,
    sourceCorners,
    footprint,
    hitsPool,
  };
}
