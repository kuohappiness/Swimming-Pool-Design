import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activeSolarStudyGeometry,
  evaluateContinuousWarmSeason,
  evaluateHorizontalScan,
  evaluatePoolSurfaceSensitivity,
  evaluateSolarCandidate,
} from '../scripts/solar-angle-analysis.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));

test('reads solar geometry only from the active v0.6.2 SITE-XY revision', () => {
  const study = activeSolarStudyGeometry(model);
  assert.deepEqual(study, {
    revision: '0.6.2',
    rotatingLevel: 'L3',
    planRotation: 25.5,
    mirrorLeanFromVertical: 23,
    startX: 29,
    endX: 41,
    width: 13.5,
    baseElevation: 6.88,
    mirrorHeight: 3.6,
    pivotX: 35,
    pivotY: 6.75,
    pivotScenarios: [33, 35, 37, 39, 41],
    roof: { x1: 0, x2: 29, y1: 0, y2: 14, highElevation: 6.537, pitchDegrees: 5 },
  });
});

test('uses the v0.6.2 working angles by default', () => {
  const result = evaluateSolarCandidate(model);
  assert.deepEqual(result.input, {
    planRotation: 25.5,
    mirrorLeanFromVertical: 23,
    bearingOffset: 0,
    stepMinutes: 1,
  });
  assert.equal(result.summer.hits, 0);
  assert.equal(result.winter.hits, 52);
});

test('direction-only warm-season screen stays separate from finite-surface energy', () => {
  const result = evaluateContinuousWarmSeason(model, { stepMinutes: 5 });
  assert.equal(result.daylightSamples, 23869);
  assert.equal(result.hits, 0);
  assert.equal(result.hitRatePercent, 0);
  assert.equal(result.firstHit, null);
  assert.equal(result.lastHit, null);
});

test('horizontal direction scan remains reproducible at the new mirror lean', () => {
  const scan = evaluateHorizontalScan(model);
  assert.equal(scan.candidateCount, 301);
  assert.equal(scan.summerSafeCandidateCount, 301);
  assert.equal(scan.minimumSummerHits, 0);
  assert.equal(scan.maximumWinterHits, 63);
  assert.deepEqual(scan.maximumHitPlanRotations, [5.6]);
});

test('finite-surface proxy still reports all five pivot scenarios', () => {
  const sensitivity = evaluatePoolSurfaceSensitivity(model, { stepMinutes: 5 });
  assert.equal(sensitivity.scenarioCount, 5);
  assert.deepEqual(sensitivity.pivotScenarios, [33, 35, 37, 39, 41]);
  assert.deepEqual(sensitivity.heightScenarios, [3.6]);
  assert.equal(sensitivity.minimumHits, 0);
  assert.equal(sensitivity.maximumHits, 95);
  assert.equal(sensitivity.zeroHitScenarioCount, 3);
});

test('rejects a non-positive analysis interval', () => {
  assert.throws(() => evaluateSolarCandidate(model, { stepMinutes: 0 }), /stepMinutes must be greater than zero/);
});
