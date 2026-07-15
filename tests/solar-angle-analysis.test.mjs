import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateHorizontalScan,
  evaluateMirrorEnvelope,
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

test('rejects a non-positive analysis interval', () => {
  assert.throws(
    () => evaluateSolarCandidate(model, { stepMinutes: 0 }),
    /stepMinutes must be greater than zero/,
  );
});
