import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveActiveGeometry } from '../../../../core/geometry/active-geometry.mjs';
import { buildSwimClassData } from '../../../../core/geometry/class-route.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const model = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const active = () => structuredClone(resolveActiveGeometry(model));
const inside = (bounds, [x, y]) =>
  x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;

test('class route keeps the model order and ties every stop to a place on the plan', () => {
  const source = active();
  const data = buildSwimClassData(source);
  assert.equal(data.revision, model.activeGeometryRevisionId);
  assert.deepEqual(
    data.route.map(({ id }) => id),
    source.l1.poolUse.classRoute.map(({ id }) => id),
  );
  assert.deepEqual(
    data.route.map(({ place }) => place),
    ['entryVestibule', 'dryCorridor', 'stair', 'rinseGate', 'assemblyArea'],
  );
  for (const stop of data.route) {
    const place = stop.place === 'stair' ? data.stair : data.zones[stop.place];
    assert.ok(place, `stop ${stop.id} points at an unknown place`);
    assert.ok(inside(data.hall, stop.standAt), `stop ${stop.id} stands outside the pool hall`);
  }
  // Every place and marker the page draws lies inside the plan it is drawn on.
  const planBounds = { x1: 0, x2: data.serviceWing.x2, y1: data.hall.y1, y2: data.hall.y2 };
  for (const [name, { bounds }] of Object.entries({
    ...data.zones,
    stair: data.stair,
    platform: data.platform,
    pool: data.pool,
  })) {
    assert.ok(
      inside(planBounds, [bounds.x1, bounds.y1]) && inside(planBounds, [bounds.x2, bounds.y2]),
      `${name} leaves the plan`,
    );
  }
  assert.ok(inside(planBounds, data.aed));
});

test('figures are the sizes of the model bounds', () => {
  const source = active();
  const { figures } = buildSwimClassData(source);
  const { poolUse, pool } = source.l1;
  assert.equal(
    figures.corridorLength,
    poolUse.dryCorridor.bounds.x2 - poolUse.dryCorridor.bounds.x1,
  );
  assert.equal(figures.entryRise, poolUse.entryRamp.toElevation - poolUse.entryRamp.fromElevation);
  // A 1:n ramp is n times as long as it is high.
  assert.ok(Math.abs(figures.rampLength - figures.entryRise * poolUse.entryRamp.slopeRatio) < 1e-9);
  assert.ok(
    Math.abs(poolUse.entrySteps.risers * poolUse.entrySteps.riserHeight - figures.entryRise) < 1e-9,
  );
  assert.equal(
    figures.platformLength,
    pool.teachingPlatform.bounds.x2 - pool.teachingPlatform.bounds.x1,
  );
  assert.equal(figures.platformWidth, figures.teachingBandWidth);
  assert.equal(figures.poolLength, pool.bounds.x2 - pool.bounds.x1);
  // The lane bands fill the pool width exactly.
  const laneWidths = buildSwimClassData(source).pool.lanes.reduce(
    (total, { width }) => total + width,
    0,
  );
  assert.ok(Math.abs(laneWidths - figures.poolWidth) < 1e-9);
  assert.equal(figures.standardLaneCount, 2);
});

test('figures follow the model when it changes', () => {
  const source = active();
  source.l1.poolUse.dryCorridor.bounds.x2 += 2;
  source.l1.pool.teachingPlatform.bounds.x2 += 1;
  const { figures } = buildSwimClassData(source);
  const baseline = buildSwimClassData(active()).figures;
  assert.equal(figures.corridorLength, baseline.corridorLength + 2);
  assert.equal(figures.platformLength, baseline.platformLength + 1);
});

test('class route data fails closed on a broken model', () => {
  const cases = [
    [
      (value) => {
        delete value.l1.poolUse;
      },
      /needs l1\.poolUse/,
    ],
    [
      (value) => {
        delete value.l1.poolUse.rinseGate.entityId;
      },
      /rinseGate needs an entityId/,
    ],
    [
      (value) => {
        value.l1.poolUse.assemblyArea.bounds.x2 = value.l1.poolUse.assemblyArea.bounds.x1;
      },
      /positive size/,
    ],
    [
      (value) => {
        value.l1.poolUse.lifeguardChair.bounds.y1 = Number.NaN;
      },
      /finite y1/,
    ],
    [
      (value) => {
        value.l1.poolUse.classRoute = [];
      },
      /at least one stop/,
    ],
    [
      (value) => {
        value.l1.poolUse.classRoute[0].standAt = [2.5];
      },
      /route stop 1 y/,
    ],
    [
      (value) => {
        value.l1.poolUse.classRoute[4].standAt = [38, 13];
      },
      /neither faces nor stands in a known place/,
    ],
    [
      (value) => {
        value.l1.pool.teachingPlatform.bounds.x2 = value.l1.pool.bounds.x2 + 1;
      },
      /must lie inside the pool/,
    ],
    [
      (value) => {
        value.l1.pool.laneBands[1].y2 += 0.5;
      },
      /share one width/,
    ],
    [
      (value) => {
        delete value.l1.poolUse.aed;
      },
      /AED x/,
    ],
  ];
  for (const [mutate, error] of cases) {
    const source = active();
    mutate(source);
    assert.throws(() => buildSwimClassData(source), error);
  }
});
