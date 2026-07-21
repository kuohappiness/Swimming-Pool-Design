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

test('reads the v0.5.0 L3 study geometry instead of the legacy L2 mirror', () => {
  const study = activeSolarStudyGeometry(model);
  assert.equal(study.revision, '0.5.0');
  assert.equal(study.rotatingLevel, 'L3');
  assert.equal(study.startX, 29);
  assert.equal(study.endX, 41);
  assert.equal(study.width, 13.5);
  assert.equal(study.baseElevation, 6.88);
  assert.equal(study.mirrorHeight, 3.6);
  assert.equal(study.pivotX, 35);
  assert.equal(study.roof.x2, 29);
  assert.equal(study.roof.highElevation, 6.537);
  assert.equal(study.roof.pitchDegrees, 5);
});

test('uses the v0.5.0 working angles by default', () => {
  const result = evaluateSolarCandidate(model);
  assert.deepEqual(result.input, {
    planRotation: 26.5,
    mirrorLeanFromVertical: 3.1,
    bearingOffset: 0,
    stepMinutes: 1,
  });
  assert.equal(result.summer.hits, 27);
  assert.equal(result.winter.hits, 346);
});

test('keeps the direction-only proxy separate from finite-surface energy', () => {
  const result = evaluateContinuousWarmSeason(model, { stepMinutes: 5 });
  assert.equal(result.daylightSamples, 23869);
  assert.equal(result.hits, 536);
  assert.equal(result.hitRatePercent, 2.246);
  assert.equal(result.firstHit, '2026-05-01 11:35');
  assert.equal(result.lastHit, '2026-09-30 12:20');
});

test('horizontal direction scan reports a minimum even without a strict zero proxy', () => {
  const scan = evaluateHorizontalScan(model);
  assert.equal(scan.candidateCount, 301);
  assert.equal(scan.summerSafeCandidateCount, 0);
  assert.equal(scan.minimumSummerHits, 6);
  assert.equal(scan.maximumWinterHits, 138);
  assert.deepEqual(scan.maximumHitPlanRotations, [15.8, 15.9, 16]);
});

test('finite pool-surface sensitivity uses all five structural-core pivots', () => {
  const sensitivity = evaluatePoolSurfaceSensitivity(model, { stepMinutes: 5 });
  assert.equal(sensitivity.scenarioCount, 5);
  assert.deepEqual(sensitivity.pivotScenarios, [33, 35, 37, 39, 41]);
  assert.deepEqual(sensitivity.heightScenarios, [3.6]);
  assert.equal(sensitivity.minimumHits, 0);
  assert.equal(sensitivity.maximumHits, 17);
  assert.equal(sensitivity.zeroHitScenarioCount, 4);
});

test('rejects a non-positive analysis interval', () => {
  assert.throws(
    () => evaluateSolarCandidate(model, { stepMinutes: 0 }),
    /stepMinutes must be greater than zero/,
  );
});
