import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSET_FILE_LIMITS,
  REALISM_TIER_IDS,
  RENDER_BUDGETS,
  assertRenderBudgets,
  findAssetBudgetErrors,
  formatBytes,
  isRealismTierId,
} from '../../../../core/viewer/render-budgets.mjs';

const MEBIBYTE = 1024 * 1024;

test('render budgets carry the agreed hard limits for the four tiers', () => {
  assert.deepEqual(REALISM_TIER_IDS, ['ultra', 'high', 'medium', 'saver']);
  assert.equal(assertRenderBudgets(), RENDER_BUDGETS);
  assert.deepEqual(RENDER_BUDGETS.ultra, { drawCalls: 500, triangles: 800_000, downloadBytes: 40 * MEBIBYTE });
  assert.equal(RENDER_BUDGETS.high.downloadBytes, 20 * MEBIBYTE);
  assert.deepEqual(RENDER_BUDGETS.medium, { drawCalls: 200, triangles: 250_000, downloadBytes: 8 * MEBIBYTE });
  assert.equal(RENDER_BUDGETS.saver.downloadBytes, 4 * MEBIBYTE);
  assert.equal(Object.isFrozen(RENDER_BUDGETS) && Object.isFrozen(RENDER_BUDGETS.medium), true);
  assert.equal(isRealismTierId('saver'), true);
  assert.equal(isRealismTierId('low'), false);
});

test('render budgets must not grow toward lower tiers', () => {
  assert.throws(
    () => assertRenderBudgets({
      ...RENDER_BUDGETS,
      saver: { ...RENDER_BUDGETS.saver, drawCalls: RENDER_BUDGETS.medium.drawCalls + 1 },
    }),
    /must not grow/,
  );
  assert.throws(
    () => assertRenderBudgets({ ...RENDER_BUDGETS, high: { ...RENDER_BUDGETS.high, triangles: 0 } }),
    /positive integer/,
  );
});

test('asset check accepts registered kinds within the size limits', () => {
  assert.deepEqual(findAssetBudgetErrors([
    { path: 'README.md', byteSize: 1_500 },
    { path: 'materials/concrete/base-color.ktx2', byteSize: ASSET_FILE_LIMITS.textureBytes },
    { path: 'materials/water-normal.svg', byteSize: 670 },
    { path: 'models/people/swimmer-01.glb', byteSize: ASSET_FILE_LIMITS.modelBytes },
    { path: 'lightmaps/bake-registry.json', byteSize: 2_048 },
    { path: 'audio/pool-hall.ogg', byteSize: 400_000 },
  ]), []);
});

test('asset check rejects oversized files, raw originals and bad names', () => {
  const errors = findAssetBudgetErrors([
    { path: 'materials/concrete/base-color.ktx2', byteSize: ASSET_FILE_LIMITS.textureBytes + 1 },
    { path: 'models/props/starting-block.glb', byteSize: ASSET_FILE_LIMITS.modelBytes + 1 },
    { path: 'materials/concrete/base-color.png', byteSize: 10 },
    { path: 'materials/Pool_Tile/normal.ktx2', byteSize: 10 },
    { path: 'materials/deck/Normal Map.ktx2', byteSize: 10 },
    { path: 'models/readme', byteSize: 10 },
  ]);
  assert.equal(errors.length, 6);
  assert.match(errors[0], /base-color\.ktx2：4\.00 MB 超過單檔上限 4\.00 MB/);
  assert.match(errors[1], /starting-block\.glb：.*超過單檔上限 2\.00 MB/);
  assert.match(errors[2], /副檔名「\.png」不得入庫/);
  assert.match(errors[3], /資料夾「Pool_Tile」須為英文小寫加連字號/);
  assert.match(errors[4], /檔名須為英文小寫加連字號/);
  assert.match(errors[5], /副檔名「（無）」不得入庫/);
});

test('asset check enforces the folder total', () => {
  const files = Array.from({ length: 18 }, (_, index) => ({
    path: `materials/set-${index}/base-color.ktx2`,
    byteSize: ASSET_FILE_LIMITS.textureBytes,
  }));
  assert.deepEqual(findAssetBudgetErrors(files), ['3D 資產合計 72.00 MB 超過上限 70.00 MB。']);
  assert.equal(formatBytes(670), '670 bytes');
  assert.equal(formatBytes(7_680), '7.5 KB');
});
