import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  calculateSolarPosition,
  deriveSolarPlanOrientation,
  evaluatePoolReflection,
  normalizeAzimuth,
  reflectSolarRay,
} from './solar-reflection.mjs';

export const SUMMER_DATES = [[2026, 5, 21], [2026, 6, 21], [2026, 7, 21], [2026, 8, 21]];
export const WINTER_DATES = [[2026, 11, 21], [2026, 12, 21], [2027, 1, 21], [2027, 2, 21]];

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
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const model = JSON.parse(await readFile(new URL('../model/project-model.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(buildCliReport(model), null, 2));
}
