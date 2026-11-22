import type { PoolBasinShape } from './rendering/water/water-surface';

export interface ViewerPoolPresentationSource {
  readonly geometry: {
    readonly pool: {
      readonly deckElevation: {
        readonly value: number;
      };
      readonly shallowDepth: {
        readonly value: number;
      };
      readonly deepDepth: {
        readonly value: number;
      };
    };
  };
}

export const POOL_WATERLINE_OFFSET_BELOW_DECK = 0.08;
/** 池底水道標線的寬度（公尺）。實體標線與水面折射看到的標線共用，兩邊才會重合。 */
export const POOL_FLOOR_LANE_LINE_WIDTH = 0.16;
/** 池底水道標線兩端距池壁的距離（公尺）。 */
export const POOL_FLOOR_LANE_LINE_INSET = 0.35;

export interface ViewerPoolPresentation {
  readonly waterSurfaceElevation: number;
  readonly shallowBottomElevation: number;
  readonly deepBottomElevation: number;
}

export function getViewerPoolPresentation(
  model: ViewerPoolPresentationSource,
): ViewerPoolPresentation {
  const pool = model.geometry.pool;
  const waterSurfaceElevation = Number(
    (pool.deckElevation.value - POOL_WATERLINE_OFFSET_BELOW_DECK).toFixed(6),
  );
  return Object.freeze({
    waterSurfaceElevation,
    shallowBottomElevation: waterSurfaceElevation - pool.shallowDepth.value,
    deepBottomElevation: waterSurfaceElevation - pool.deepDepth.value,
  });
}

export interface ViewerPoolBasinSource extends ViewerPoolPresentationSource {
  readonly geometry: ViewerPoolPresentationSource['geometry'] & {
    readonly pool: ViewerPoolPresentationSource['geometry']['pool'] & {
      readonly origin: readonly number[];
      readonly length: { readonly value: number };
      readonly width: { readonly value: number };
      readonly laneBands: ReadonlyArray<{ readonly y1: number; readonly y2: number }>;
    };
  };
}

/** 池底水道標線中心的位置（基地 Y，也就是場景裡的 z）：每個水道帶的中線，最後一帶不畫。 */
export function getPoolFloorLaneLineCentres(model: ViewerPoolBasinSource): readonly number[] {
  return Object.freeze(
    model.geometry.pool.laneBands.slice(0, -1).map((band) => (band.y1 + band.y2) / 2),
  );
}

/**
 * 池體的形狀：斜底方盒加池底標線。水面著色器用它直接算出折射後看到池底哪一點，
 * 所以數值必須與場景裡實際畫出來的池體一致，兩邊都只從這裡拿。
 */
export function getViewerPoolBasinShape(model: ViewerPoolBasinSource): PoolBasinShape {
  const pool = model.geometry.pool;
  const presentation = getViewerPoolPresentation(model);
  const [minX, minZ] = pool.origin;
  if (minX === undefined || minZ === undefined) {
    throw new TypeError('Pool origin must have two coordinates.');
  }
  return Object.freeze({
    minX,
    maxX: minX + pool.length.value,
    minZ,
    maxZ: minZ + pool.width.value,
    waterLevel: presentation.waterSurfaceElevation,
    shallowBottom: presentation.shallowBottomElevation,
    deepBottom: presentation.deepBottomElevation,
    laneLineZ: getPoolFloorLaneLineCentres(model),
    laneLineWidth: POOL_FLOOR_LANE_LINE_WIDTH,
    laneLineInset: POOL_FLOOR_LANE_LINE_INSET,
  });
}
