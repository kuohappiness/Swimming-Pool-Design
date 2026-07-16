import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  calculateSolarPosition,
  deriveSolarPlanOrientation,
  evaluatePoolReflection,
  normalizeAzimuth,
  projectMirrorReflectionFootprint,
  reflectSolarRay,
  rotatePlanPoint,
} from './solar-reflection.mjs';
import { deriveReferenceGeometry } from './reference-geometry.mjs';

export const SUMMER_DATES = [[2026, 5, 21], [2026, 6, 21], [2026, 7, 21], [2026, 8, 21]];
export const WINTER_DATES = [[2026, 11, 21], [2026, 12, 21], [2027, 1, 21], [2027, 2, 21]];
export const WARM_SEASON_START = [2026, 5, 1];
export const WARM_SEASON_END = [2026, 9, 30];

const HORIZONTAL_CANDIDATES = [0, 4.5, 9.5, 10, 12];
const MIRROR_CANDIDATES = [7.5, 8, 8.5, 9, 9.5];
const MIRROR_ENVELOPE_CANDIDATES = [8, 8.5, 9, 9.5];
const ENVELOPE_DELTAS = [-0.5, 0, 0.5];
const BEARING_OFFSETS = [-1, 0, 1];

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
};

const round = (value, digits = 1) => Number(value.toFixed(digits));
const pad = (value) => String(value).padStart(2, '0');
const formatDateTime = (year, month, day, minute) => (
  `${year}-${pad(month)}-${pad(day)} ${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`
);

function *dateRange(start, end) {
  const cursor = new Date(Date.UTC(start[0], start[1] - 1, start[2]));
  const last = new Date(Date.UTC(end[0], end[1] - 1, end[2]));
  if (cursor > last) throw new RangeError('continuous analysis end date must not precede start date.');
  while (cursor <= last) {
    yield [cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()];
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

function evaluateContinuousWindow(model, input) {
  const location = model.referenceSystem.siteLocation;
  let daylightSamples = 0;
  let hits = 0;
  let firstHit = null;
  let lastHit = null;
  const dailyWindows = [];

  for (const [year, month, day] of dateRange(input.startDate, input.endDate)) {
    let dailyHits = 0;
    let dailyFirst = null;
    let dailyLast = null;
    for (let minute = input.startMinute; minute <= input.endMinute; minute += input.stepMinutes) {
      const solar = calculateSolarPosition({
        year,
        month,
        day,
        hour: Math.floor(minute / 60),
        minute: minute % 60,
        latitude: location.latitude.value,
        longitude: location.longitude.value,
        utcOffsetHours: location.utcOffsetHours,
      });
      if (solar.altitude <= 0) continue;
      daylightSamples += 1;
      if (!input.hits(solar)) continue;
      const timestamp = formatDateTime(year, month, day, minute);
      hits += 1;
      dailyHits += 1;
      firstHit ??= timestamp;
      lastHit = timestamp;
      dailyFirst ??= timestamp;
      dailyLast = timestamp;
    }
    if (dailyHits > 0) {
      dailyWindows.push({
        date: dailyFirst.slice(0, 10),
        first: dailyFirst.slice(11),
        last: dailyLast.slice(11),
        hits: dailyHits,
      });
    }
  }

  return {
    daylightSamples,
    hits,
    hitRatePercent: round(hits / daylightSamples * 100, 3),
    firstHit,
    lastHit,
    dailyWindows,
  };
}

function continuousInput(options) {
  const stepMinutes = finite(options.stepMinutes ?? 1, 'stepMinutes');
  const startMinute = finite(options.startMinute ?? 4 * 60, 'startMinute');
  const endMinute = finite(options.endMinute ?? 19 * 60, 'endMinute');
  if (stepMinutes <= 0) throw new RangeError('stepMinutes must be greater than zero.');
  if (startMinute < 0 || endMinute >= 24 * 60 || endMinute < startMinute) {
    throw new RangeError('continuous analysis minute range is invalid.');
  }
  return {
    startDate: options.startDate ?? WARM_SEASON_START,
    endDate: options.endDate ?? WARM_SEASON_END,
    startMinute,
    endMinute,
    stepMinutes,
  };
}

function evaluateWindow(model, input) {
  const location = model.referenceSystem.siteLocation;
  const poolAzimuth = normalizeAzimuth(
    deriveSolarPlanOrientation(model.referenceSystem).poolFacingAzimuth + input.bearingOffset,
  );
  const wallAzimuth = normalizeAzimuth(poolAzimuth + input.planRotation);
  let hits = 0;
  let directionWeight = 0;
  let total = 0;

  for (const [year, month, day] of input.dates) {
    for (let minute = input.startMinute; minute <= input.endMinute; minute += input.stepMinutes) {
      const solar = calculateSolarPosition({
        year,
        month,
        day,
        hour: Math.floor(minute / 60),
        minute: minute % 60,
        latitude: location.latitude.value,
        longitude: location.longitude.value,
        utcOffsetHours: location.utcOffsetHours,
      });
      const reflection = reflectSolarRay({
        solarAltitude: solar.altitude,
        solarAzimuth: solar.azimuth,
        wallNormalAzimuth: wallAzimuth,
        wallLeanFromVertical: input.mirrorLeanFromVertical,
      });
      const evaluation = evaluatePoolReflection(reflection, {
        poolTargetAzimuth: poolAzimuth,
        azimuthTolerance: model.geometry.solarReflection.azimuthTolerance.value,
        minimumDownwardAngle: model.geometry.solarReflection.minimumDownwardAngle.value,
      });

      total += 1;
      if (evaluation.hitsPool) {
        hits += 1;
        directionWeight += reflection.facingFactor;
      }
    }
  }

  return {
    total,
    hits,
    hitRatePercent: round(hits / total * 100),
    directionWeight: round(directionWeight, 3),
  };
}

export function evaluateSolarCandidate(model, options = {}) {
  const solar = model?.geometry?.solarReflection;
  const common = {
    planRotation: finite(options.planRotation ?? solar?.planRotation?.value, 'planRotation'),
    mirrorLeanFromVertical: finite(
      options.mirrorLeanFromVertical ?? solar?.mirrorLeanFromVertical?.value,
      'mirrorLeanFromVertical',
    ),
    bearingOffset: finite(options.bearingOffset ?? 0, 'bearingOffset'),
    stepMinutes: finite(options.stepMinutes ?? 1, 'stepMinutes'),
  };
  if (common.stepMinutes <= 0) throw new RangeError('stepMinutes must be greater than zero.');

  return {
    input: common,
    summer: evaluateWindow(model, {
      ...common,
      dates: SUMMER_DATES,
      startMinute: 7 * 60,
      endMinute: 17 * 60,
    }),
    winter: evaluateWindow(model, {
      ...common,
      dates: WINTER_DATES,
      startMinute: 8 * 60,
      endMinute: 12 * 60,
    }),
  };
}

export function evaluateHorizontalScan(model, options = {}) {
  const minimumPlanRotation = finite(options.minimumPlanRotation ?? -12, 'minimumPlanRotation');
  const maximumPlanRotation = finite(options.maximumPlanRotation ?? 18, 'maximumPlanRotation');
  const increment = finite(options.increment ?? 0.1, 'increment');
  const mirrorLeanFromVertical = finite(
    options.mirrorLeanFromVertical ?? 9.5,
    'mirrorLeanFromVertical',
  );
  const stepMinutes = finite(options.stepMinutes ?? 5, 'stepMinutes');
  if (maximumPlanRotation < minimumPlanRotation) {
    throw new RangeError('maximumPlanRotation must not be less than minimumPlanRotation.');
  }
  if (increment <= 0) throw new RangeError('increment must be greater than zero.');

  const intervalCount = Math.round((maximumPlanRotation - minimumPlanRotation) / increment);
  const results = [];
  for (let index = 0; index <= intervalCount; index += 1) {
    const planRotation = round(minimumPlanRotation + index * increment, 10);
    results.push(evaluateSolarCandidate(model, {
      planRotation,
      mirrorLeanFromVertical,
      stepMinutes,
    }));
  }

  const summerSafe = results.filter((result) => result.summer.hits === 0);
  if (summerSafe.length === 0) throw new RangeError('horizontal scan found no summer-safe candidate.');
  const maximumWinterHits = Math.max(...summerSafe.map((result) => result.winter.hits));
  const maximumHitCandidates = summerSafe.filter((result) => result.winter.hits === maximumWinterHits);
  const bestDirectionCandidate = maximumHitCandidates.reduce((best, candidate) => (
    candidate.winter.directionWeight > best.winter.directionWeight ? candidate : best
  ));

  return {
    input: {
      minimumPlanRotation,
      maximumPlanRotation,
      increment,
      mirrorLeanFromVertical,
      stepMinutes,
    },
    candidateCount: results.length,
    summerSafeCandidateCount: summerSafe.length,
    maximumWinterHits,
    maximumHitPlanRotations: maximumHitCandidates.map((result) => result.input.planRotation),
    bestDirectionWeight: {
      planRotation: bestDirectionCandidate.input.planRotation,
      directionWeight: bestDirectionCandidate.winter.directionWeight,
    },
  };
}

export function evaluateMirrorEnvelope(model, options = {}) {
  const canonicalPlanRotation = finite(
    model?.geometry?.solarReflection?.planRotation?.value,
    'model.geometry.solarReflection.planRotation.value',
  );
  const nominalLean = finite(
    options.nominalLean ?? model?.geometry?.solarReflection?.mirrorLeanFromVertical?.value,
    'nominalLean',
  );
  const results = [];

  for (const leanDelta of ENVELOPE_DELTAS) {
    for (const planDelta of ENVELOPE_DELTAS) {
      for (const bearingOffset of BEARING_OFFSETS) {
        results.push(evaluateSolarCandidate(model, {
          mirrorLeanFromVertical: nominalLean + leanDelta,
          planRotation: canonicalPlanRotation + planDelta,
          bearingOffset,
          stepMinutes: 1,
        }));
      }
    }
  }

  return {
    nominalLean,
    maximumSummerHits: Math.max(...results.map((result) => result.summer.hits)),
    winterHitRange: [
      Math.min(...results.map((result) => result.winter.hits)),
      Math.max(...results.map((result) => result.winter.hits)),
    ],
  };
}

export function evaluateContinuousWarmSeason(model, options = {}) {
  const solarGeometry = model?.geometry?.solarReflection;
  const planRotation = finite(
    options.planRotation ?? solarGeometry?.planRotation?.value,
    'planRotation',
  );
  const mirrorLeanFromVertical = finite(
    options.mirrorLeanFromVertical ?? solarGeometry?.mirrorLeanFromVertical?.value,
    'mirrorLeanFromVertical',
  );
  const bearingOffset = finite(options.bearingOffset ?? 0, 'bearingOffset');
  const interval = continuousInput(options);
  const orientation = deriveSolarPlanOrientation(model.referenceSystem);
  const poolAzimuth = normalizeAzimuth(orientation.poolFacingAzimuth + bearingOffset);
  const wallAzimuth = normalizeAzimuth(poolAzimuth + planRotation);
  const result = evaluateContinuousWindow(model, {
    ...interval,
    hits: (solar) => {
      const reflection = reflectSolarRay({
        solarAltitude: solar.altitude,
        solarAzimuth: solar.azimuth,
        wallNormalAzimuth: wallAzimuth,
        wallLeanFromVertical: mirrorLeanFromVertical,
      });
      return evaluatePoolReflection(reflection, {
        poolTargetAzimuth: poolAzimuth,
        azimuthTolerance: solarGeometry.azimuthTolerance.value,
        minimumDownwardAngle: solarGeometry.minimumDownwardAngle.value,
      }).hitsPool;
    },
  });
  return {
    input: {
      ...interval,
      planRotation,
      mirrorLeanFromVertical,
      bearingOffset,
    },
    ...result,
  };
}

export function evaluateContinuousWarmSeasonEnvelope(model, options = {}) {
  const canonicalPlanRotation = finite(
    model?.geometry?.solarReflection?.planRotation?.value,
    'model.geometry.solarReflection.planRotation.value',
  );
  const nominalLean = finite(
    options.nominalLean ?? model?.geometry?.solarReflection?.mirrorLeanFromVertical?.value,
    'nominalLean',
  );
  const results = [];
  for (const leanDelta of ENVELOPE_DELTAS) {
    for (const planDelta of ENVELOPE_DELTAS) {
      for (const bearingOffset of BEARING_OFFSETS) {
        results.push(evaluateContinuousWarmSeason(model, {
          ...options,
          mirrorLeanFromVertical: nominalLean + leanDelta,
          planRotation: canonicalPlanRotation + planDelta,
          bearingOffset,
        }));
      }
    }
  }
  const worst = results.reduce((current, candidate) => (
    candidate.hits > current.hits ? candidate : current
  ));
  const firstHits = results.map((result) => result.firstHit).filter(Boolean).sort();
  return {
    nominalLean,
    configurationCount: results.length,
    zeroHitConfigurationCount: results.filter((result) => result.hits === 0).length,
    maximumHits: worst.hits,
    worstInput: worst.input,
    earliestHit: firstHits[0] ?? null,
    results,
  };
}

const levelElevation = (model, id) => {
  const level = model?.referenceSystem?.levels?.find((candidate) => candidate.id === id);
  return finite(level?.elevation, `referenceSystem.levels.${id}.elevation`);
};

function poolRectangle(model) {
  const pool = model?.geometry?.pool;
  const x1 = finite(pool?.origin?.[0], 'geometry.pool.origin[0]');
  const y1 = finite(pool?.origin?.[1], 'geometry.pool.origin[1]');
  return {
    x1,
    x2: x1 + finite(pool?.length?.value, 'geometry.pool.length.value'),
    y1,
    y2: y1 + finite(pool?.width?.value, 'geometry.pool.width.value'),
  };
}

export function buildL2VolumeCorners(model, input) {
  const derived = deriveReferenceGeometry(model);
  const buildingWidth = finite(model?.geometry?.building?.width?.value, 'geometry.building.width.value');
  const baseElevation = levelElevation(model, 'L2');
  const pivot = { x: input.pivotX, y: buildingWidth / 2 };
  const bottomPlan = [
    { x: derived.l2StartX, y: 0 },
    { x: derived.l2EndX, y: 0 },
    { x: derived.l2EndX, y: buildingWidth },
    { x: derived.l2StartX, y: buildingWidth },
  ].map((point) => rotatePlanPoint(point, pivot, input.planRotation));
  const rotationRadians = input.planRotation * Math.PI / 180;
  const normal = { x: -Math.cos(rotationRadians), y: -Math.sin(rotationRadians) };
  const topOffset = input.mirrorHeight * Math.tan(input.mirrorLeanFromVertical * Math.PI / 180);
  const topPlan = bottomPlan.map((point, index) => (
    index === 0 || index === 3
      ? { x: point.x + normal.x * topOffset, y: point.y + normal.y * topOffset }
      : point
  ));
  return [
    ...bottomPlan.map((point) => ({ ...point, z: baseElevation })),
    ...topPlan.map((point) => ({ ...point, z: baseElevation + input.mirrorHeight })),
  ];
}

export function evaluatePoolSurfaceScenario(model, options = {}) {
  const solarGeometry = model?.geometry?.solarReflection;
  const derived = deriveReferenceGeometry(model);
  const buildingWidth = finite(model?.geometry?.building?.width?.value, 'geometry.building.width.value');
  const planRotation = finite(
    options.planRotation ?? solarGeometry?.planRotation?.value,
    'planRotation',
  );
  const mirrorLeanFromVertical = finite(
    options.mirrorLeanFromVertical ?? solarGeometry?.mirrorLeanFromVertical?.value,
    'mirrorLeanFromVertical',
  );
  const mirrorHeight = finite(options.mirrorHeight ?? 3, 'mirrorHeight');
  const pivotX = finite(options.pivotX ?? derived.l2StartX, 'pivotX');
  const bearingOffset = finite(options.bearingOffset ?? 0, 'bearingOffset');
  const interval = continuousInput(options);
  const localBearing = normalizeAzimuth(
    model.referenceSystem.localLongAxisBearingFromTrueNorth + bearingOffset,
  );
  const orientation = deriveSolarPlanOrientation(model.referenceSystem);
  const poolAzimuth = normalizeAzimuth(orientation.poolFacingAzimuth + bearingOffset);
  const wallAzimuth = normalizeAzimuth(poolAzimuth + planRotation);
  const geometryInput = {
    localLongAxisBearingFromTrueNorth: localBearing,
    baseCenter: { x: derived.l2StartX, y: buildingWidth / 2 },
    pivot: { x: pivotX, y: buildingWidth / 2 },
    width: buildingWidth,
    verticalHeight: mirrorHeight,
    baseElevation: levelElevation(model, 'L2'),
    planRotation,
    leanFromVertical: mirrorLeanFromVertical,
    poolRectangle: poolRectangle(model),
  };
  const result = evaluateContinuousWindow(model, {
    ...interval,
    hits: (solar) => {
      const reflection = reflectSolarRay({
        solarAltitude: solar.altitude,
        solarAzimuth: solar.azimuth,
        wallNormalAzimuth: wallAzimuth,
        wallLeanFromVertical: mirrorLeanFromVertical,
      });
      return projectMirrorReflectionFootprint({ ...geometryInput, reflection }).hitsPool;
    },
  });
  return {
    input: {
      ...interval,
      planRotation,
      mirrorLeanFromVertical,
      mirrorHeight,
      pivotX,
      bearingOffset,
    },
    geometry: geometryInput,
    ...result,
  };
}

export function evaluatePoolSurfaceSensitivity(model, options = {}) {
  const derived = deriveReferenceGeometry(model);
  const pivotScenarios = options.pivotScenarios ?? [derived.l2StartX, 27, 35];
  const heightScenarios = options.heightScenarios ?? [2.5, 3, 3.6];
  const results = [];
  for (const pivotX of pivotScenarios) {
    for (const mirrorHeight of heightScenarios) {
      results.push(evaluatePoolSurfaceScenario(model, { ...options, pivotX, mirrorHeight }));
    }
  }
  return {
    scenarioCount: results.length,
    pivotScenarios,
    heightScenarios,
    minimumHits: Math.min(...results.map((result) => result.hits)),
    maximumHits: Math.max(...results.map((result) => result.hits)),
    earliestHit: results.map((result) => result.firstHit).filter(Boolean).sort()[0] ?? null,
    latestHit: results.map((result) => result.lastHit).filter(Boolean).sort().at(-1) ?? null,
    zeroHitScenarioCount: results.filter((result) => result.hits === 0).length,
    results,
  };
}

function buildCliReport(model) {
  const solar = model.geometry.solarReflection;
  return {
    confirmed: evaluateSolarCandidate(model),
    horizontalFineScan: evaluateHorizontalScan(model),
    horizontalComparison: HORIZONTAL_CANDIDATES.map((planRotation) => evaluateSolarCandidate(model, {
      planRotation,
      mirrorLeanFromVertical: 9.5,
      stepMinutes: 5,
    })),
    mirrorComparison: MIRROR_CANDIDATES.map((mirrorLeanFromVertical) => evaluateSolarCandidate(model, {
      planRotation: solar.planRotation.value,
      mirrorLeanFromVertical,
      stepMinutes: 1,
    })),
    mirrorEnvelopes: MIRROR_ENVELOPE_CANDIDATES.map((nominalLean) => (
      evaluateMirrorEnvelope(model, { nominalLean })
    )),
    continuousWarmSeason: evaluateContinuousWarmSeason(model),
    continuousWarmSeasonEnvelope: evaluateContinuousWarmSeasonEnvelope(model),
    poolSurfaceSensitivity: evaluatePoolSurfaceSensitivity(model),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const model = JSON.parse(await readFile(new URL('../model/project-model.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(buildCliReport(model), null, 2));
}
