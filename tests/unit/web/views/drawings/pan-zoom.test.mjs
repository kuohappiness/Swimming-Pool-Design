import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SCALE,
  MIN_SCALE,
  clampView,
  fitView,
  panBy,
  viewForKey,
  zoomAt,
} from '../../../../../web/src/views/drawings/pan-zoom.ts';

const size = { width: 400, height: 300 };

test('符合畫面是倍率 1、不偏移，倍率 1 時拖曳不會移動圖紙', () => {
  assert.deepEqual(fitView(), { scale: 1, x: 0, y: 0 });
  assert.deepEqual(panBy(fitView(), 50, -30, size), { scale: 1, x: 0, y: 0 });
});

test('倍率限制在 1 到 8 之間', () => {
  assert.equal(clampView({ scale: 0.2, x: 0, y: 0 }, size).scale, MIN_SCALE);
  assert.equal(clampView({ scale: 20, x: 0, y: 0 }, size).scale, MAX_SCALE);
});

test('以一點為中心縮放時，那一點底下的圖面位置不動', () => {
  const point = { x: 100, y: 75 };
  const zoomed = zoomAt(fitView(), 2, point, size);
  assert.equal(zoomed.scale, 2);
  // 縮放前圖面座標 (100, 75) 縮放後仍在檢視框的 (100, 75)。
  assert.equal(zoomed.x + 100 * zoomed.scale, point.x);
  assert.equal(zoomed.y + 75 * zoomed.scale, point.y);
});

test('放大後平移不能拖出圖紙外的空白', () => {
  const zoomed = zoomAt(fitView(), 2, { x: 200, y: 150 }, size);
  assert.deepEqual(panBy(zoomed, 10_000, 10_000, size), { scale: 2, x: 0, y: 0 });
  assert.deepEqual(panBy(zoomed, -10_000, -10_000, size), { scale: 2, x: -400, y: -300 });
});

test('鍵盤：+ 放大、- 縮小、0 回到符合畫面，方向鍵只在放大時平移', () => {
  const zoomed = viewForKey(fitView(), '+', size);
  assert.equal(zoomed.scale, 1.5);
  assert.equal(viewForKey(zoomed, '-', size).scale, 1);
  assert.deepEqual(viewForKey(zoomed, '0', size), fitView());
  assert.equal(viewForKey(fitView(), 'ArrowRight', size), null);
  assert.ok(viewForKey(zoomed, 'ArrowRight', size).x < zoomed.x);
  assert.ok(viewForKey(zoomed, 'ArrowDown', size).y < zoomed.y);
  assert.equal(viewForKey(zoomed, 'a', size), null);
});
