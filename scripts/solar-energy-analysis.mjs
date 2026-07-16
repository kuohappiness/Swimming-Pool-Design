import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  calculateSolarPosition,
  deriveSolarPlanOrientation,
  intersectConvexPolygons,
  polygonArea,
  projectMirrorReflectionFootprint,
  projectShadowFootprint,
  reflectSolarRay,
  reflectionDirectionInLocalCoordinates,
  solarDirectionInLocalCoordinates,
} from './solar-reflection.mjs';
import { buildL2VolumeCorners } from './solar-angle-analysis.mjs';
import { deriveReferenceGeometry } from './reference-geometry.mjs';

export const WARM_MONTHS = new Set([5, 6, 7, 8, 9]);
export const DEFAULT_ENERGY_ASSUMPTIONS = Object.freeze({
  mirrorReflectance: 0.75,
  glazingSolarTransmittance: 0.60,
  mirrorHeight: 3.0,
  pivotX: 19.0,
  daylightStartHour: 7,
  daylightEndHour: 17,
});
export const RECOMMENDED_SOLAR_MASK = Object.freeze({
  maximumActiveSolarAltitude: 22,
  minimumActiveSolarAzimuth: 88,
  maximumActiveSolarAzimuth: 135,
});

const EPSILON = 1e-9;

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
};

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));

const rectanglePolygon = ({ x1, x2, y1, y2 }) => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
];

const poolRectangle = (model) => {
  const pool = model.geometry.pool;
  return {
    x1: finite(pool.origin[0], 'geometry.pool.origin[0]'),
    x2: pool.origin[0] + finite(pool.length.value, 'geometry.pool.length.value'),
    y1: finite(pool.origin[1], 'geometry.pool.origin[1]'),
    y2: pool.origin[1] + finite(pool.width.value, 'geometry.pool.width.value'),
  };
};

const levelElevation = (model, id) => {
  const level = model.referenceSystem.levels.find((candidate) => candidate.id === id);
  return finite(level?.elevation, `referenceSystem.levels.${id}.elevation`);
};

const parseTimestamp = (timestamp, offsetHours) => {
  const match = /^(\d{4})(\d{2})(\d{2}):(\d{2})(\d{2})$/.exec(timestamp);
  if (!match) throw new TypeError(`PVGIS timestamp is invalid: ${timestamp}`);
  const utc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  const local = new Date(utc + offsetHours * 60 * 60 * 1000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
};

export function buildPvgisWeatherSamples(model, pvgis) {
  const hourly = pvgis?.outputs?.tmy_hourly;
  if (!Array.isArray(hourly) || hourly.length !== 8760) {
    throw new RangeError('PVGIS TMY must contain exactly 8760 hourly records.');
  }
  const sourceLocation = pvgis?.inputs?.location;
  const latitude = finite(model.referenceSystem.siteLocation.latitude.value, 'site latitude');
  const longitude = finite(model.referenceSystem.siteLocation.longitude.value, 'site longitude');
  if (Math.abs(sourceLocation?.latitude - latitude) > 1e-6
    || Math.abs(sourceLocation?.longitude - longitude) > 1e-6) {
    throw new RangeError('PVGIS TMY coordinates must match the model site location.');
  }
  const utcOffsetHours = finite(model.referenceSystem.siteLocation.utcOffsetHours, 'site utc offset');
  const irradianceOffset = finite(sourceLocation.irradiance_time_offset ?? 0, 'irradiance time offset');
  return hourly.map((record) => {
    const local = parseTimestamp(record['time(UTC)'], utcOffsetHours + irradianceOffset);
    const solar = calculateSolarPosition({
      ...local,
      latitude,
      longitude,
      utcOffsetHours,
    });
    return {
      ...local,
      season: WARM_MONTHS.has(local.month) ? 'warm' : 'cool',
      ghi: Math.max(0, finite(record['G(h)'], 'PVGIS G(h)')),
      dni: Math.max(0, finite(record['Gb(n)'], 'PVGIS Gb(n)')),
      dhi: Math.max(0, finite(record['Gd(h)'], 'PVGIS Gd(h)')),
      solar,
    };
  });
}

function projectToRoofPlane(sourceCorners, direction, roof) {
  const slope = Math.tan(roof.pitchDegrees * Math.PI / 180);
  const intercept = roof.highElevation - slope * roof.x2;
  const denominator = direction.z - slope * direction.x;
  if (Math.abs(denominator) <= EPSILON) return null;
  const footprint = [];
  const scales = [];
  for (const point of sourceCorners) {
    const scale = (slope * point.x + intercept - point.z) / denominator;
    scales.push(scale);
    footprint.push({
      x: point.x + direction.x * scale,
      y: point.y + direction.y * scale,
    });
  }
  return { footprint, scales };
}

function clipUnitSquareToForwardProjection(scales) {
  const scalarAt = (point) => (
    scales[0]
      + (scales[1] - scales[0]) * point.x
      + (scales[3] - scales[0]) * point.y
  );
  const input = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const output = [];
  for (let index = 0; index < input.length; index += 1) {
    const start = input[index];
    const end = input[(index + 1) % input.length];
    const startValue = scalarAt(start);
    const endValue = scalarAt(end);
    const startInside = startValue >= -EPSILON;
    const endInside = endValue >= -EPSILON;
    if (startInside) output.push(start);
    if (startInside !== endInside) {
      const ratio = startValue / (startValue - endValue);
      output.push({
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      });
    }
  }
  return output;
}

function pointToUnitCoordinates(point, projectedCorners) {
  const origin = projectedCorners[0];
  const uAxis = {
    x: projectedCorners[1].x - origin.x,
    y: projectedCorners[1].y - origin.y,
  };
  const vAxis = {
    x: projectedCorners[3].x - origin.x,
    y: projectedCorners[3].y - origin.y,
  };
  const determinant = uAxis.x * vAxis.y - uAxis.y * vAxis.x;
  if (Math.abs(determinant) <= EPSILON) {
    throw new RangeError('Projected mirror footprint is degenerate.');
  }
  const relative = { x: point.x - origin.x, y: point.y - origin.y };
  return {
    x: (relative.x * vAxis.y - relative.y * vAxis.x) / determinant,
    y: (uAxis.x * relative.y - uAxis.y * relative.x) / determinant,
  };
}

function receiverUnitPolygon(projectedCorners, receiverRectangle) {
  const clipped = intersectConvexPolygons(
    projectedCorners,
    rectanglePolygon(receiverRectangle),
  );
  if (clipped.length < 3 || polygonArea(clipped) <= EPSILON) return [];
  return clipped.map((point) => pointToUnitCoordinates(point, projectedCorners));
}

export function mirrorReceiverFractions(model, input, reflection) {
  const derived = deriveReferenceGeometry(model);
  const buildingWidth = model.geometry.building.width.value;
  const poolBounds = poolRectangle(model);
  const common = {
    localLongAxisBearingFromTrueNorth: model.referenceSystem.localLongAxisBearingFromTrueNorth,
    baseCenter: { x: derived.l2StartX, y: buildingWidth / 2 },
    pivot: { x: input.pivotX, y: buildingWidth / 2 },
    width: buildingWidth,
    verticalHeight: input.mirrorHeight,
    baseElevation: levelElevation(model, 'L2'),
    planRotation: input.planRotation,
    leanFromVertical: input.mirrorLeanFromVertical,
    poolRectangle: poolBounds,
    reflection,
  };
  const poolProjection = projectMirrorReflectionFootprint(common);
  if (!poolProjection.reachesPoolPlane || !poolProjection.sourceCorners) {
    return { rawPoolFraction: 0, roofFraction: 0, poolFraction: 0 };
  }
  const poolUnit = receiverUnitPolygon(poolProjection.footprint, poolBounds);
  const rawPoolFraction = poolUnit.length >= 3 ? clamp(polygonArea(poolUnit), 0, 1) : 0;
  const direction = reflectionDirectionInLocalCoordinates(
    reflection,
    model.referenceSystem.localLongAxisBearingFromTrueNorth,
  );
  const roof = {
    x1: 0,
    x2: derived.roofPlanEndX,
    y1: 0,
    y2: buildingWidth,
    highElevation: derived.roofHighElevation,
    pitchDegrees: model.geometry.roof.pitch.value,
  };
  const roofProjection = projectToRoofPlane(poolProjection.sourceCorners, direction, roof);
  if (!roofProjection) return { rawPoolFraction, roofFraction: 0, poolFraction: rawPoolFraction };
  const roofReceiverUnit = receiverUnitPolygon(roofProjection.footprint, roof);
  const forwardUnit = clipUnitSquareToForwardProjection(roofProjection.scales);
  const roofUnit = roofReceiverUnit.length >= 3 && forwardUnit.length >= 3
    ? intersectConvexPolygons(roofReceiverUnit, forwardUnit)
    : [];
  const roofFraction = roofUnit.length >= 3 ? clamp(polygonArea(roofUnit), 0, 1) : 0;
  return {
    rawPoolFraction,
    roofFraction,
    poolFraction: rawPoolFraction,
  };
}

function emptySeason() {
  return {
    weatherHours: 0,
    dniHours: 0,
    baselinePoolKWh: 0,
    mirrorInterceptedKWh: 0,
    roofRedirectedKWh: 0,
    poolAddedKWh: 0,
    roofRedirectedHours: 0,
    rawPoolProjectionHours: 0,
    poolAddedHours: 0,
    occupiedRoofRedirectedHours: 0,
    maximumPoolAddedKW: 0,
  };
}

function finalizeSeason(raw) {
  return {
    weatherHours: raw.weatherHours,
    dniHours: raw.dniHours,
    baselinePoolKWh: round(raw.baselinePoolKWh),
    mirrorInterceptedKWh: round(raw.mirrorInterceptedKWh),
    roofRedirectedKWh: round(raw.roofRedirectedKWh),
    poolAddedKWh: round(raw.poolAddedKWh),
    poolTotalWithMirrorKWh: round(raw.baselinePoolKWh + raw.poolAddedKWh),
    poolIncreasePercent: raw.baselinePoolKWh > 0
      ? round(raw.poolAddedKWh / raw.baselinePoolKWh * 100)
      : 0,
    roofRedirectedHours: raw.roofRedirectedHours,
    rawPoolProjectionHours: raw.rawPoolProjectionHours,
    poolAddedHours: raw.poolAddedHours,
    occupiedRoofRedirectedHours: raw.occupiedRoofRedirectedHours,
    maximumPoolAddedKW: round(raw.maximumPoolAddedKW),
  };
}

export function evaluateMirrorEnergy(model, weatherSamples, options = {}) {
  const solarGeometry = model.geometry.solarReflection;
  const input = {
    planRotation: finite(options.planRotation ?? solarGeometry.planRotation.value, 'planRotation'),
    mirrorLeanFromVertical: finite(
      options.mirrorLeanFromVertical ?? solarGeometry.mirrorLeanFromVertical.value,
      'mirrorLeanFromVertical',
    ),
    mirrorReflectance: finite(
      options.mirrorReflectance ?? DEFAULT_ENERGY_ASSUMPTIONS.mirrorReflectance,
      'mirrorReflectance',
    ),
    glazingSolarTransmittance: finite(
      options.glazingSolarTransmittance
        ?? DEFAULT_ENERGY_ASSUMPTIONS.glazingSolarTransmittance,
      'glazingSolarTransmittance',
    ),
    mirrorHeight: finite(options.mirrorHeight ?? DEFAULT_ENERGY_ASSUMPTIONS.mirrorHeight, 'mirrorHeight'),
    pivotX: finite(options.pivotX ?? DEFAULT_ENERGY_ASSUMPTIONS.pivotX, 'pivotX'),
    daylightStartHour: finite(
      options.daylightStartHour ?? DEFAULT_ENERGY_ASSUMPTIONS.daylightStartHour,
      'daylightStartHour',
    ),
    daylightEndHour: finite(
      options.daylightEndHour ?? DEFAULT_ENERGY_ASSUMPTIONS.daylightEndHour,
      'daylightEndHour',
    ),
    maximumActiveSolarAltitude: options.maximumActiveSolarAltitude == null
      ? null
      : finite(options.maximumActiveSolarAltitude, 'maximumActiveSolarAltitude'),
    minimumActiveSolarAzimuth: options.minimumActiveSolarAzimuth == null
      ? null
      : finite(options.minimumActiveSolarAzimuth, 'minimumActiveSolarAzimuth'),
    maximumActiveSolarAzimuth: options.maximumActiveSolarAzimuth == null
      ? null
      : finite(options.maximumActiveSolarAzimuth, 'maximumActiveSolarAzimuth'),
    includeBaseline: options.includeBaseline !== false,
  };
  if (input.mirrorReflectance < 0 || input.mirrorReflectance > 1
    || input.glazingSolarTransmittance < 0 || input.glazingSolarTransmittance > 1) {
    throw new RangeError('Optical factors must be within 0..1.');
  }
  const buildingWidth = model.geometry.building.width.value;
  const mirrorSurfaceArea = buildingWidth * input.mirrorHeight
    / Math.cos(input.mirrorLeanFromVertical * Math.PI / 180);
  const poolBounds = poolRectangle(model);
  const poolPlan = rectanglePolygon(poolBounds);
  const poolArea = polygonArea(poolPlan);
  const l2Volume = input.includeBaseline ? buildL2VolumeCorners(model, input) : null;
  const results = { warm: emptySeason(), cool: emptySeason() };
  const wallNormalAzimuth = (
    deriveSolarPlanOrientation(model.referenceSystem).poolFacingAzimuth + input.planRotation
  ) % 360;

  for (const sample of weatherSamples) {
    const season = results[sample.season];
    season.weatherHours += 1;
    if (sample.dni > 0) season.dniHours += 1;
    if (input.includeBaseline) {
      const sunDirection = solarDirectionInLocalCoordinates(
        sample.solar,
        model.referenceSystem.localLongAxisBearingFromTrueNorth,
      );
      const shadow = projectShadowFootprint(l2Volume, sunDirection);
      const shadowArea = shadow.length >= 3
        ? clamp(polygonArea(intersectConvexPolygons(poolPlan, shadow)), 0, poolArea)
        : 0;
      const directHorizontal = Math.max(0, sample.ghi - sample.dhi);
      const baselineWatts = input.glazingSolarTransmittance * (
        sample.dhi * poolArea + directHorizontal * (poolArea - shadowArea)
      );
      season.baselinePoolKWh += baselineWatts / 1000;
    }
    if (sample.dni <= 0 || sample.solar.altitude <= 0) continue;
    if (input.maximumActiveSolarAltitude != null
      && sample.solar.altitude > input.maximumActiveSolarAltitude) continue;
    if (input.minimumActiveSolarAzimuth != null
      && sample.solar.azimuth < input.minimumActiveSolarAzimuth) continue;
    if (input.maximumActiveSolarAzimuth != null
      && sample.solar.azimuth > input.maximumActiveSolarAzimuth) continue;
    const reflection = reflectSolarRay({
      solarAltitude: sample.solar.altitude,
      solarAzimuth: sample.solar.azimuth,
      wallNormalAzimuth,
      wallLeanFromVertical: input.mirrorLeanFromVertical,
    });
    if (!reflection.frontLit || reflection.reflectedDownwardAngle <= 0) continue;
    const interceptedKW = sample.dni * mirrorSurfaceArea * reflection.facingFactor / 1000;
    season.mirrorInterceptedKWh += interceptedKW;
    const fractions = mirrorReceiverFractions(model, input, reflection);
    if (fractions.rawPoolFraction > EPSILON) season.rawPoolProjectionHours += 1;
    const reflectedKW = interceptedKW * input.mirrorReflectance;
    const roofKW = reflectedKW * fractions.roofFraction;
    const poolKW = reflectedKW * fractions.poolFraction * input.glazingSolarTransmittance;
    if (roofKW > EPSILON) {
      season.roofRedirectedKWh += roofKW;
      season.roofRedirectedHours += 1;
      if (sample.hour >= input.daylightStartHour && sample.hour < input.daylightEndHour) {
        season.occupiedRoofRedirectedHours += 1;
      }
    }
    if (poolKW > EPSILON) {
      season.poolAddedKWh += poolKW;
      season.poolAddedHours += 1;
      season.maximumPoolAddedKW = Math.max(season.maximumPoolAddedKW, poolKW);
    }
  }

  const warm = finalizeSeason(results.warm);
  const cool = finalizeSeason(results.cool);
  return {
    input,
    mirrorSurfaceArea: round(mirrorSurfaceArea),
    warm,
    cool,
    selectivity: {
      warmToCoolPoolEnergyRatio: cool.poolAddedKWh > 0
        ? round(warm.poolAddedKWh / cool.poolAddedKWh, 4)
        : null,
      coolMinusWarmPoolKWh: round(cool.poolAddedKWh - warm.poolAddedKWh),
      strictWarmZero: warm.poolAddedKWh <= 0.001,
    },
  };
}

export function evaluateEnergySensitivity(model, weatherSamples, options = {}) {
  const pivotScenarios = options.pivotScenarios ?? [19, 27, 35];
  const heightScenarios = options.heightScenarios ?? [2.5, 3, 3.6];
  const results = [];
  for (const pivotX of pivotScenarios) {
    for (const mirrorHeight of heightScenarios) {
      results.push(evaluateMirrorEnergy(model, weatherSamples, {
        ...options,
        pivotX,
        mirrorHeight,
      }));
    }
  }
  return { pivotScenarios, heightScenarios, results };
}

export function scanMirrorEnergyAngles(model, weatherSamples, options = {}) {
  const planRotations = options.planRotations ?? [-10, -5, 0, 5, 9.5, 15, 20, 25];
  const leanAngles = options.leanAngles ?? [-5, 0, 5, 8.5, 10, 15, 20, 25, 30];
  const results = [];
  for (const planRotation of planRotations) {
    for (const mirrorLeanFromVertical of leanAngles) {
      results.push(evaluateMirrorEnergy(model, weatherSamples, {
        ...options,
        planRotation,
        mirrorLeanFromVertical,
        mirrorReflectance: 1,
        glazingSolarTransmittance: 1,
        includeBaseline: false,
      }));
    }
  }
  const ranked = [...results].sort((left, right) => {
    const leftWarm = left.warm.poolAddedKWh;
    const rightWarm = right.warm.poolAddedKWh;
    if (Math.abs(leftWarm - rightWarm) > 0.001) return leftWarm - rightWarm;
    return right.cool.poolAddedKWh - left.cool.poolAddedKWh;
  });
  const strictWarmZero = results
    .filter((result) => result.selectivity.strictWarmZero && result.cool.poolAddedKWh > 0)
    .sort((left, right) => right.cool.poolAddedKWh - left.cool.poolAddedKWh);
  const nearZero = results
    .filter((result) => result.cool.poolAddedKWh > 0
      && result.warm.poolAddedKWh / result.cool.poolAddedKWh <= 0.05)
    .sort((left, right) => right.cool.poolAddedKWh - left.cool.poolAddedKWh);
  return {
    candidateCount: results.length,
    strictWarmZeroCount: strictWarmZero.length,
    nearZeroCount: nearZero.length,
    bestStrictWarmZero: strictWarmZero[0] ?? null,
    bestNearZero: nearZero[0] ?? null,
    lowestWarmCandidates: ranked.slice(0, 10),
    results,
  };
}

async function buildReport() {
  const model = JSON.parse(await readFile(new URL('../model/project-model.json', import.meta.url), 'utf8'));
  const pvgis = JSON.parse(await readFile(
    new URL('../source-materials/site/SRC-SITE-003_pvgis-5-3-tmy.json', import.meta.url),
    'utf8',
  ));
  const weather = buildPvgisWeatherSamples(model, pvgis);
  const current = evaluateMirrorEnergy(model, weather);
  const sensitivity = evaluateEnergySensitivity(model, weather);
  const planRotations = Array.from({ length: 61 }, (_, index) => -20 + index);
  const leanAngles = Array.from({ length: 51 }, (_, index) => -10 + index);
  const denseScan = scanMirrorEnergyAngles(model, weather, { planRotations, leanAngles });
  const ratioRanked = denseScan.results
    .filter((result) => result.cool.poolAddedKWh > 0)
    .sort((left, right) => (
      left.warm.poolAddedKWh / left.cool.poolAddedKWh
        - right.warm.poolAddedKWh / right.cool.poolAddedKWh
    ));
  const angleScan = {
    planRotationRange: [-20, 40, 1],
    leanRange: [-10, 40, 1],
    candidateCount: denseScan.candidateCount,
    strictWarmZeroCount: denseScan.strictWarmZeroCount,
    bestNearZero: denseScan.bestNearZero,
    lowestWarmToCoolRatio: ratioRanked[0] ?? null,
  };
  const solarMask = evaluateMirrorEnergy(model, weather, RECOMMENDED_SOLAR_MASK);
  const solarMaskSensitivity = evaluateEnergySensitivity(
    model,
    weather,
    RECOMMENDED_SOLAR_MASK,
  );
  const opticalSensitivity = [
    [0.60, 0.40],
    [0.60, 0.60],
    [0.75, 0.60],
    [0.90, 0.60],
    [0.90, 0.75],
  ].map(([mirrorReflectance, glazingSolarTransmittance]) => evaluateMirrorEnergy(
    model,
    weather,
    { ...RECOMMENDED_SOLAR_MASK, mirrorReflectance, glazingSolarTransmittance },
  ));
  const annualHorizontalIrradiation = weather.reduce((sum, sample) => sum + sample.ghi, 0) / 1000;
  const ceilingDiffuseScenarios = [0.10, 0.20, 0.30].map((diffuseFraction) => ({
    diffuseFraction,
    warmPotentialKWh: round(solarMask.warm.roofRedirectedKWh * diffuseFraction),
    coolPotentialKWh: round(solarMask.cool.roofRedirectedKWh * diffuseFraction),
  }));
  return {
    source: {
      id: 'SRC-SITE-003',
      hourlyRecords: weather.length,
      radiationDatabase: pvgis.inputs.meteo_data.radiation_db,
      sourceYears: [pvgis.inputs.meteo_data.year_min, pvgis.inputs.meteo_data.year_max],
      annualHorizontalIrradiationKWhPerSquareMetre: round(annualHorizontalIrradiation),
    },
    assumptions: DEFAULT_ENERGY_ASSUMPTIONS,
    current,
    sensitivity,
    angleScan,
    recommendedSolarMask: RECOMMENDED_SOLAR_MASK,
    solarMask,
    solarMaskSensitivity,
    opticalSensitivity,
    ceilingDiffuseScenarios,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await buildReport(), null, 2));
}
