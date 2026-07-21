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
  const study = activeSolarStudyGeometry(model);
  const common = {
    planRotation: finite(options.planRotation ?? study.planRotation, 'planRotation'),
    mirrorLeanFromVertical: finite(
      options.mirrorLeanFromVertical ?? study.mirrorLeanFromVertical,
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
  const study = activeSolarStudyGeometry(model);
  const minimumPlanRotation = finite(options.minimumPlanRotation ?? -12, 'minimumPlanRotation');
  const maximumPlanRotation = finite(options.maximumPlanRotation ?? 18, 'maximumPlanRotation');
  const increment = finite(options.increment ?? 0.1, 'increment');
  const mirrorLeanFromVertical = finite(
    options.mirrorLeanFromVertical ?? study.mirrorLeanFromVertical,
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

  const strictSummerSafe = results.filter((result) => result.summer.hits === 0);
  const minimumSummerHits = Math.min(...results.map((result) => result.summer.hits));
  const preferred = strictSummerSafe.length > 0
    ? strictSummerSafe
    : results.filter((result) => result.summer.hits === minimumSummerHits);
  const maximumWinterHits = Math.max(...preferred.map((result) => result.winter.hits));
  const maximumHitCandidates = preferred.filter((result) => result.winter.hits === maximumWinterHits);
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
    summerSafeCandidateCount: strictSummerSafe.length,
    minimumSummerHits,
    maximumWinterHits,
    maximumHitPlanRotations: maximumHitCandidates.map((result) => result.input.planRotation),
    bestDirectionWeight: {
      planRotation: bestDirectionCandidate.input.planRotation,
      directionWeight: bestDirectionCandidate.winter.directionWeight,
    },
  };
}

export function evaluateMirrorEnvelope(model, options = {}) {
  const study = activeSolarStudyGeometry(model);
  const canonicalPlanRotation = finite(
    study.planRotation,
    'activeSolarStudyGeometry.planRotation',
  );
  const nominalLean = finite(
    options.nominalLean ?? study.mirrorLeanFromVertical,
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
  const study = activeSolarStudyGeometry(model);
  const planRotation = finite(
    options.planRotation ?? study.planRotation,
    'planRotation',
  );
  const mirrorLeanFromVertical = finite(
    options.mirrorLeanFromVertical ?? study.mirrorLeanFromVertical,
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
  const study = activeSolarStudyGeometry(model);
  const canonicalPlanRotation = finite(
    study.planRotation,
    'activeSolarStudyGeometry.planRotation',
  );
  const nominalLean = finite(
    options.nominalLean ?? study.mirrorLeanFromVertical,
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

export function activeSolarStudyGeometry(model) {
  const solar = model?.geometry?.solarReflection;
  const study = solar?.v050Study;
  if (study) {
    return {
      revision: study.revision,
      rotatingLevel: study.rotatingLevel,
      planRotation: finite(study.optimization?.planRotation?.value, 'v050Study.optimization.planRotation'),
      mirrorLeanFromVertical: finite(
        study.optimization?.mirrorLeanFromVertical?.value,
        'v050Study.optimization.mirrorLeanFromVertical',
      ),
      startX: finite(study.floorPlate?.poolSideX, 'v050Study.floorPlate.poolSideX'),
      endX: finite(study.floorPlate?.farSideX, 'v050Study.floorPlate.farSideX'),
      width: finite(study.floorPlate?.width, 'v050Study.floorPlate.width'),
      baseElevation: finite(study.mirror?.baseElevation, 'v050Study.mirror.baseElevation'),
      mirrorHeight: finite(study.mirror?.height, 'v050Study.mirror.height'),
      pivotX: finite(study.planPivot?.x, 'v050Study.planPivot.x'),
      pivotY: finite(study.planPivot?.y, 'v050Study.planPivot.y'),
      pivotScenarios: study.planPivot?.sensitivityX?.map((value, index) => (
        finite(value, `v050Study.planPivot.sensitivityX[${index}]`)
      )) ?? [],
      roof: {
        x1: 0,
        x2: finite(study.roofInterface?.planRun, 'v050Study.roofInterface.planRun'),
        y1: 0,
        y2: finite(study.floorPlate?.width, 'v050Study.floorPlate.width'),
        highElevation: finite(
          study.roofInterface?.highElevation,
          'v050Study.roofInterface.highElevation',
        ),
        pitchDegrees: finite(study.roofInterface?.pitch, 'v050Study.roofInterface.pitch'),
      },
    };
  }
  const derived = deriveReferenceGeometry(model);
  const width = finite(model?.geometry?.building?.width?.value, 'geometry.building.width.value');
  return {
    revision: model?.modelVersion ?? 'legacy',
    rotatingLevel: 'L2',
    planRotation: finite(solar?.planRotation?.value, 'solarReflection.planRotation'),
    mirrorLeanFromVertical: finite(
      solar?.mirrorLeanFromVertical?.value,
      'solarReflection.mirrorLeanFromVertical',
    ),
    startX: derived.l2StartX,
    endX: derived.l2EndX,
    width,
    baseElevation: levelElevation(model, 'L2'),
    mirrorHeight: finite(
      solar?.mirrorVisualWallHeight?.value,
      'solarReflection.mirrorVisualWallHeight',
    ),
    pivotX: derived.l2StartX,
    pivotY: width / 2,
    pivotScenarios: [derived.l2StartX, 27, 35],
    roof: {
      x1: 0,
      x2: derived.roofPlanEndX,
      y1: 0,
      y2: width,
      highElevation: derived.roofHighElevation,
      pitchDegrees: finite(model?.geometry?.roof?.pitch?.value, 'geometry.roof.pitch.value'),
    },
  };
}

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

export function buildReflectingVolumeCorners(model, input) {
  const study = activeSolarStudyGeometry(model);
  const pivot = { x: input.pivotX, y: study.pivotY };
  const bottomPlan = [
    { x: study.startX, y: 0 },
    { x: study.endX, y: 0 },
    { x: study.endX, y: study.width },
    { x: study.startX, y: study.width },
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
    ...bottomPlan.map((point) => ({ ...point, z: study.baseElevation })),
    ...topPlan.map((point) => ({ ...point, z: study.baseElevation + input.mirrorHeight })),
  ];
}

export const buildL2VolumeCorners = buildReflectingVolumeCorners;

export function evaluatePoolSurfaceScenario(model, options = {}) {
  const solarGeometry = model?.geometry?.solarReflection;
  const study = activeSolarStudyGeometry(model);
  const planRotation = finite(
    options.planRotation ?? study.planRotation,
    'planRotation',
  );
  const mirrorLeanFromVertical = finite(
    options.mirrorLeanFromVertical ?? study.mirrorLeanFromVertical,
    'mirrorLeanFromVertical',
  );
  const mirrorHeight = finite(options.mirrorHeight ?? study.mirrorHeight, 'mirrorHeight');
  const pivotX = finite(options.pivotX ?? study.pivotX, 'pivotX');
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
    baseCenter: { x: study.startX, y: study.width / 2 },
    pivot: { x: pivotX, y: study.pivotY },
    width: study.width,
    verticalHeight: mirrorHeight,
    baseElevation: study.baseElevation,
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
  const study = activeSolarStudyGeometry(model);
  const pivotScenarios = options.pivotScenarios ?? study.pivotScenarios;
  const heightScenarios = options.heightScenarios ?? [study.mirrorHeight];
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
  const study = activeSolarStudyGeometry(model);
  return {
    confirmed: evaluateSolarCandidate(model),
    horizontalFineScan: evaluateHorizontalScan(model),
    horizontalComparison: HORIZONTAL_CANDIDATES.map((planRotation) => evaluateSolarCandidate(model, {
      planRotation,
      mirrorLeanFromVertical: 9.5,
      stepMinutes: 5,
    })),
    mirrorComparison: MIRROR_CANDIDATES.map((mirrorLeanFromVertical) => evaluateSolarCandidate(model, {
      planRotation: study.planRotation,
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
