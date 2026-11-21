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
