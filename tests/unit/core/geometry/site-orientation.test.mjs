import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  deriveMirrorNormalAzimuth,
  deriveSiteOrientation,
} from '../scripts/site-orientation.mjs';

const model = JSON.parse(
  await readFile(new URL('../model/project-model.json', import.meta.url), 'utf8'),
);

function pathsContainingKey(value, targetKey, path = 'model') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    const nextPath = `${path}.${key}`;
    return [
      ...(key === targetKey ? [nextPath] : []),
      ...pathsContainingKey(entry, targetKey, nextPath),
    ];
  });
}

test('SITE-XY orientation has one confirmed canonical source and no legacy duplicates', () => {
  assert.deepEqual(model.referenceSystem.siteOrientation, {
    coordinateSystemId: 'SITE-XY',
    positiveXAxisBearingFromTrueNorth: 307,
    positiveXAxisDirection: 'pool-remote-to-service-core',
    status: 'confirmed',
    sourceIds: ['SRC-SITE-001', 'SRC-SITE-002'],
  });

  for (const forbiddenKey of [
    'localLongAxisBearingFromTrueNorth',
    'rotationFromTrueNorth',
    'rightwardBearingFromTrueNorth',
    'northArrowPlanDirection',
  ]) {
    assert.deepEqual(pathsContainingKey(model, forbiddenKey), []);
  }
});

test('all fixed site directions derive from canonical +X 307 degrees', () => {
  const orientation = deriveSiteOrientation(model.referenceSystem);
  assert.equal(orientation.positiveXAxisBearingFromTrueNorth, 307);
  assert.equal(orientation.negativeXAxisBearingFromTrueNorth, 127);
  assert.deepEqual(orientation.longAxisBearingsFromTrueNorth, [127, 307]);
  assert.equal(orientation.poolFacingAzimuth, 127);
  assert.equal(orientation.threeWorldRotationDegrees, 143);
  assert.equal(orientation.svgNorthArrowRotation, 143);
  assert.equal(orientation.northPlanDirection, 'lower-right');
});

test('mirror normal is derived from the current L3 rotation and is not canonical site data', () => {
  const referenceSystem = model.referenceSystem;
  const active = model.geometryRevisions
    .find(({ id }) => id === model.activeGeometryRevisionId);
  const currentRotation = active.solar.planRotation.value;
  assert.equal('mirrorNormalAzimuth' in referenceSystem.siteOrientation, false);
  assert.equal(
    deriveMirrorNormalAzimuth(referenceSystem, currentRotation),
    (127 + currentRotation) % 360,
  );
  assert.equal(deriveMirrorNormalAzimuth(referenceSystem, 10), 137);
  assert.equal(deriveMirrorNormalAzimuth(referenceSystem, -20), 107);
});

test('site orientation rejects legacy parallel sources', () => {
  const legacy = structuredClone(model.referenceSystem);
  legacy.localLongAxisBearingFromTrueNorth = 307;
  assert.throws(
    () => deriveSiteOrientation(legacy),
    /localLongAxisBearingFromTrueNorth is forbidden/,
  );
});
