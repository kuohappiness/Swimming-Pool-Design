import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateContinuousWarmSeason,
  evaluateContinuousWarmSeasonEnvelope,
  evaluateHorizontalScan,
  evaluateMirrorEnvelope,
  evaluatePoolSurfaceSensitivity,
  evaluateSolarCandidate,
} from '../scripts/solar-angle-analysis.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));

test('reproduces the approved one-minute mirror comparison', () => {
  const expected = new Map([
    [7.5, { summerHits: 3, winterHits: 706, winterRate: 73.2 }],
    [8.0, { summerHits: 0, winterHits: 696, winterRate: 72.2 }],
    [8.5, { summerHits: 0, winterHits: 684, winterRate: 71.0 }],
    [9.0, { summerHits: 0, winterHits: 674, winterRate: 69.9 }],
    [9.5, { summerHits: 0, winterHits: 663, winterRate: 68.8 }],
  ]);

  for (const [mirrorLeanFromVertical, counts] of expected) {
    const result = evaluateSolarCandidate(model, {
      planRotation: 9.5,
      mirrorLeanFromVertical,
      stepMinutes: 1,
    });
    assert.equal(result.summer.total, 2404);
    assert.equal(result.summer.hits, counts.summerHits);
    assert.equal(result.winter.total, 964);
    assert.equal(result.winter.hits, counts.winterHits);
    assert.equal(result.winter.hitRatePercent, counts.winterRate);
  }
});

test('uses the canonical model angles and working thresholds by default', () => {
  const result = evaluateSolarCandidate(model);
  assert.deepEqual(result.input, {
    planRotation: 9.5,
    mirrorLeanFromVertical: 8.5,
    bearingOffset: 0,
    stepMinutes: 1,
  });
  assert.equal(result.summer.hits, 0);
  assert.equal(result.winter.hits, 684);
});

test('reproduces the approved 0.1 degree horizontal scan', () => {
  const scan = evaluateHorizontalScan(model);
  assert.equal(scan.candidateCount, 301);
  assert.equal(scan.summerSafeCandidateCount, 201);
  assert.equal(scan.maximumWinterHits, 135);
  assert.deepEqual(scan.maximumHitPlanRotations, [9.4, 9.5, 9.6]);
  assert.deepEqual(scan.bestDirectionWeight, {
    planRotation: 9.6,
    directionWeight: 94.899,
  });
});

test('keeps 8.5 degrees safe across the approved error envelope', () => {
  const safe = evaluateMirrorEnvelope(model, { nominalLean: 8.5 });
  const unsafe = evaluateMirrorEnvelope(model, { nominalLean: 8.0 });
  assert.equal(safe.maximumSummerHits, 0);
  assert.deepEqual(safe.winterHitRange, [665, 699]);
  assert.equal(unsafe.maximumSummerHits, 6);
});

test('continuous warm-season scan exposes the late-summer gap in the representative dates', () => {
  const result = evaluateContinuousWarmSeason(model);
  assert.equal(result.daylightSamples, 119364);
  assert.equal(result.hits, 1577);
  assert.equal(result.hitRatePercent, 1.321);
  assert.equal(result.firstHit, '2026-08-25 11:11');
  assert.equal(result.lastHit, '2026-09-30 10:57');
  assert.equal(result.dailyWindows.length, 37);
});

test('continuous error envelope has no zero-hit configuration', () => {
  const envelope = evaluateContinuousWarmSeasonEnvelope(model);
  assert.equal(envelope.configurationCount, 27);
  assert.equal(envelope.zeroHitConfigurationCount, 0);
  assert.equal(envelope.maximumHits, 1918);
  assert.equal(envelope.earliestHit, '2026-08-22 11:12');
  assert.equal(envelope.worstInput.planRotation, 9);
  assert.equal(envelope.worstInput.mirrorLeanFromVertical, 8);
  assert.equal(envelope.worstInput.bearingOffset, -1);
});

test('working pool-surface scenarios all retain a geometric reflection path', () => {
  const sensitivity = evaluatePoolSurfaceSensitivity(model);
  assert.equal(sensitivity.scenarioCount, 9);
  assert.equal(sensitivity.zeroHitScenarioCount, 0);
  assert.equal(sensitivity.minimumHits, 43094);
  assert.equal(sensitivity.maximumHits, 47211);
  assert.equal(sensitivity.earliestHit, '2026-05-01 06:28');
  assert.equal(sensitivity.latestHit, '2026-09-30 12:49');
  assert.deepEqual(
    sensitivity.results.map((result) => [
      result.input.pivotX,
      result.input.mirrorHeight,
      result.hits,
    ]),
    [
      [19, 2.5, 47211], [19, 3, 47211], [19, 3.6, 47211],
      [27, 2.5, 45389], [27, 3, 45389], [27, 3.6, 45389],
      [35, 2.5, 43094], [35, 3, 43094], [35, 3.6, 43094],
    ],
  );
});

test('rejects a non-positive analysis interval', () => {
  assert.throws(
    () => evaluateSolarCandidate(model, { stepMinutes: 0 }),
    /stepMinutes must be greater than zero/,
  );
});
