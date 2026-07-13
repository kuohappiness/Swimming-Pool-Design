import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateModel } from '../scripts/reference-validation.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceModel = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const clone = () => structuredClone(sourceModel);

test('authoritative reference model is internally consistent', () => {
  assert.deepEqual(validateModel(clone()), []);
});

test('rejects a missing base cubicle', () => {
  const model = clone();
  model.program.l2.female.activeIds.pop();
  assert.match(validateModel(model).join('\n'), /female 必須配置 15 間/);
});

test('rejects a central locker area', () => {
  const model = clone();
  model.geometry.combinedCubicle.centralLockerArea = true;
  assert.match(validateModel(model).join('\n'), /不得設置集中式置物櫃區/);
});

test('rejects roof geometry outside the confirmed slope contract', () => {
  const model = clone();
  model.geometry.roof.highElevation.value = 9;
  assert.match(validateModel(model).join('\n'), /屋頂高側標高/);
});

test('rejects unregistered sheet references', () => {
  const model = clone();
  model.sheets[0].referencedEntityIds.push('UNKNOWN-01');
  assert.match(validateModel(model).join('\n'), /不存在的 entity/);
});
