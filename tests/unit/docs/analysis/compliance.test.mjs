import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveStairFlights, deriveStairNosings } from '../../../../core/geometry/stair-geometry.mjs';

// 合規對照（TASK-121、DEC-160）：docs/analysis/compliance.md 的模型值與狀態必須和模型算出來的一致。
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => readFile(path.join(repoRoot, relativePath), 'utf8');

function tableRows(text, idPattern) {
  return text
    .split(/\r?\n/)
    .filter((line) => idPattern.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

const metres = (value) => `${value.toFixed(3)} m`;
// 1F 使用動線（DEC-157）的房間以 functions 標示用途；數量就是含該用途的房間數。
const withFunction = (g, name) => Object.values(g.l1.poolUse ?? {})
  .filter((item) => Array.isArray(item?.functions) && item.functions.includes(name)).length;
const lifesavingLabels = [['lifeguardChair', '救生椅'], ['aed', 'AED'], ['staffFirstAid', '管理暨急救室'], ['poolLift', '移動式升降椅']];

// 每一列的模型值從 active geometry 算；`limit` 只給門檻不是固定數值的列（例如「≥ 梯寬」）。
const checks = {
  'CMP-01': { value: (g) => g.stair.riserHeight, format: metres },
  'CMP-02': { value: (g) => g.stair.treadDepth, format: metres },
  'CMP-03': { value: (g) => g.stair.clearWidth, format: metres },
  'CMP-04': { value: (g) => g.stair.risersPerRun * g.stair.riserHeight, format: metres },
  'CMP-05': { value: (g) => g.stair.midLandingLength, format: metres, limit: (g) => ({ op: '≥', value: g.stair.clearWidth }) },
  'CMP-06': { value: (g) => g.l2.stairToL3.riserHeight, format: metres },
  'CMP-07': { value: (g) => g.l2.stairToL3.treadDepth, format: metres },
  'CMP-08': { value: (g) => g.l2.stairToL3.clearWidth, format: metres },
  'CMP-09': {
    value: (g) => Math.max(...deriveStairFlights(g.l2.stairToL3).flights.map(({ z1, z2 }) => z2 - z1)),
    format: metres,
  },
  'CMP-10': {
    value: (g) => g.l2.stairToL3.midLandingLength,
    format: metres,
    limit: (g) => ({ op: '≥', value: g.l2.stairToL3.clearWidth }),
  },
  'CMP-11': { value: (g) => [g.l1.pool.shallowDepth, g.l1.pool.deepDepth], format: ([low, high]) => `${low}～${high} m` },
  'CMP-12': { value: (g) => withFunction(g, 'accessible-toilet'), format: (count) => `${count} 處` },
  'CMP-13': { value: (g) => withFunction(g, 'accessible-shower'), format: (count) => `${count} 處` },
  'CMP-14': { value: (g) => g.l1.poolUse.entryRamp.slopeRatio, format: (ratio) => `1:${ratio}` },
  'CMP-15': { value: (g) => g.l1.mainEntrance.bounds.x2 - g.l1.mainEntrance.bounds.x1, format: metres },
  'CMP-16': {
    value: (g) => Object.values(g.l1.zones).reduce((sum, zone) => sum + (zone.fixtures?.toilets ?? 0), 0)
      + withFunction(g, 'accessible-toilet'),
    format: (count) => `${count} 座`,
  },
  'CMP-17': {
    value: (g) => lifesavingLabels.filter(([key]) => g.l1.poolUse[key]).map(([, label]) => label),
    format: (labels) => (labels.length ? labels.join('、') : '未建模'),
  },
  'CMP-18': { value: (g) => g.l1.pool.teachingPlatform.topWaterDepth, format: (depth) => `${depth} m` },
  // 樓梯口以外的踏面外緣到 2F 天花板底的最小淨高；樓梯口內上方沒有樓板。
  'CMP-19': {
    value: (g) => {
      const underside = g.l2.ceiling.elevation - g.l2.ceiling.thickness;
      const covered = deriveStairNosings(g.l2.stairToL3).filter(({ x }) => x < g.l3.stairOpening.bounds.x1);
      return Math.min(...covered.map(({ z }) => underside - z));
    },
    format: metres,
  },
};

function parseLimit(cell) {
  const bound = cell.match(/^(≤|≥)\s*([\d.]+)\s*(m|處|座)$/);
  if (bound) return { op: bound[1], value: Number(bound[2]) };
  const range = cell.match(/^([\d.]+)～([\d.]+)\s*m$/);
  if (range) return { op: 'range', min: Number(range[1]), max: Number(range[2]) };
  return undefined;
}

function judge(limit, value) {
  const epsilon = 1e-9;
  if (limit.op === '≤') return value <= limit.value + epsilon;
  if (limit.op === '≥') return value >= limit.value - epsilon;
  const values = Array.isArray(value) ? value : [value];
  return values.every((item) => item >= limit.min - epsilon && item <= limit.max + epsilon);
}

test('compliance matrix values and statuses follow the canonical model', async () => {
  const [matrixText, sourcesText, modelText] = await Promise.all([
    read('docs/analysis/compliance.md'),
    read('docs/site-and-sources.md'),
    read('model/project-model.json'),
  ]);
  const model = JSON.parse(modelText);
  const active = model.geometryRevisions.find(({ id }) => id === model.activeGeometryRevisionId);
  const sourceStatus = new Map(tableRows(sourcesText, /^\|\s*SRC-REG-\d{3}\s*\|/).map((row) => [row[0], row[6]]));
  const rows = tableRows(matrixText, /^\|\s*CMP-\d{2}\s*\|/);

  assert.deepEqual(rows.map(([id]) => id), Object.keys(checks), 'matrix rows and test checks must list the same IDs in order');
  for (const [id, , , limitCell, valueCell, status, sourceId] of rows) {
    const check = checks[id];
    const value = check.value(active, model);
    assert.equal(valueCell, check.format(value), `${id} model value`);
    assert.ok(['符合', '不符', '待認定'].includes(status), `${id} status ${status}`);
    assert.ok(sourceStatus.has(sourceId), `${id} cites unregistered ${sourceId}`);
    if (sourceStatus.get(sourceId) === '未能覆核') assert.equal(status, '待認定', `${id} cites an unverified source`);

    const limit = check.limit?.(active) ?? parseLimit(limitCell);
    if (limitCell === '—') {
      assert.equal(status, '待認定', `${id} has no limit`);
    } else {
      assert.ok(limit, `${id} limit ${limitCell} cannot be parsed`);
      assert.equal(status, judge(limit, value) ? '符合' : '不符', `${id} status must follow the limit`);
    }
  }
});

test('regulation registry rows use the four allowed statuses', async () => {
  const rows = tableRows(await read('docs/site-and-sources.md'), /^\|\s*SRC-REG-\d{3}\s*\|/);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.length, 7, `${row[0]} column count`);
    assert.ok(['已讀條文', '版本待補', '未能覆核', '國外參考'].includes(row[6]), `${row[0]} status ${row[6]}`);
    assert.match(row[5], /^\d{4}-\d{2}-\d{2}$/, `${row[0]} checked date`);
  }
});
