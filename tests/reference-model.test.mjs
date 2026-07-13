import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { deriveReferenceGeometry } from '../scripts/reference-geometry.mjs';
import { validateModel } from '../scripts/reference-validation.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceModel = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const clone = () => structuredClone(sourceModel);
const closeTo = (actual, expected, tolerance = 0.002) => Math.abs(actual - expected) <= tolerance;

test('derives the approved 5 m extension geometry from one base parameter', () => {
  const derived = deriveReferenceGeometry(clone());
  assert.equal(derived.l2StartX, 19);
  assert.equal(derived.l2Length, 16);
  assert.equal(derived.l2SplitAxisX, 27);
  assert.equal(derived.roofPlanRun, 19);
  assert.ok(closeTo(derived.stairStartX, 19.04));
  assert.equal(derived.stairEndX, 27);
});

test('re-derives every dependent position when the extension changes', () => {
  const model = clone();
  model.geometry.building.l2ExtensionLength.value = 4;
  const derived = deriveReferenceGeometry(model);
  assert.equal(derived.l2StartX, 20);
  assert.equal(derived.l2Length, 15);
  assert.equal(derived.l2SplitAxisX, 27.5);
  assert.equal(derived.roofPlanRun, 20);
  assert.ok(closeTo(derived.stairStartX, 19.54));
  assert.equal(derived.stairEndX, 27.5);
});

test('rejects an extension outside the usable pool hall', () => {
  const model = clone();
  model.geometry.building.l2ExtensionLength.value = model.geometry.building.poolHallLength.value;
  assert.throws(() => deriveReferenceGeometry(model), /l2ExtensionLength/);
});

test('authoritative reference model is internally consistent', () => {
  assert.deepEqual(validateModel(clone()), []);
});

test('derived L2 zones stay equal and the stair ends on the split axis', () => {
  const derived = deriveReferenceGeometry(clone());
  const area = (bounds) => (bounds.x2 - bounds.x1) * (bounds.y2 - bounds.y1);
  assert.equal(area(derived.maleL2Bounds), area(derived.femaleL2Bounds));
  assert.equal(derived.maleL2Bounds.x2, derived.femaleL2Bounds.x1);
  assert.equal(derived.stairEndX, derived.l2SplitAxisX);
});

test('renderer uses the shared derivation layer and first-revision semantics', async () => {
  const renderer = await readFile(resolve(repoRoot, 'reference/src/sheets.ts'), 'utf8');
  assert.match(renderer, /deriveReferenceGeometry\(model\)/);
  for (const token of ['Z-L1-ENTRY-01', 'EXT-L2-01', 'J-RF-L2-01', 'pool-hours-only']) {
    assert.match(renderer, new RegExp(token));
  }
  assert.doesNotMatch(renderer, /LOW 6\.000/);
  assert.doesNotMatch(renderer, /HIGH 10\.231/);
  assert.doesNotMatch(renderer, /採 127°/);
});

test('rejects a missing base cubicle', () => {
  const model = clone();
  model.program.l2.female.activeIds.pop();
  assert.match(validateModel(model).join('\n'), /female must contain 15 active cubicles/);
});

test('rejects a central locker area', () => {
  const model = clone();
  model.geometry.combinedCubicle.centralLockerArea = true;
  assert.match(validateModel(model).join('\n'), /centralLockerArea must remain false/);
});

test('rejects numeric roof elevations before OPEN-010 is resolved', () => {
  const model = clone();
  model.geometry.roof.highElevation = { value: 9, status: 'working', sourceIds: [] };
  assert.match(validateModel(model).join('\n'), /roof elevations must remain deferred under OPEN-010/);
});

test('rejects a second orientation answer', () => {
  const model = clone();
  model.referenceSystem.worldTransform.rotationFromTrueNorth = 127;
  assert.match(validateModel(model).join('\n'), /orientation fields must both equal 307 degrees/);
});

test('rejects an L1 toilet without a pool-hours rear door', () => {
  const model = clone();
  model.program.l1.maleToilet.rearDoor.access = 'always-open';
  assert.match(validateModel(model).join('\n'), /L1 toilet rear doors must be pool-hours-only/);
});

test('rejects unregistered sheet references', () => {
  const model = clone();
  model.sheets[0].referencedEntityIds.push('UNKNOWN-01');
  assert.match(validateModel(model).join('\n'), /references unknown entity/);
});
