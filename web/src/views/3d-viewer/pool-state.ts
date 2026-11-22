import type { PoolBasinShape, PoolHallShape, SubmergedBox } from './rendering/water/water-surface';

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
 * 池梯：淺水端池壁兩側各一座，兩支扶手之間三階踏板，扶手往水下延伸到最後一階踏板下方。尺寸是 3D 展示用的示意值，
 * 場景裡畫的踏板與水面折射看到的踏板都從這裡拿，兩邊才會重合。
 */
export const POOL_LADDER = Object.freeze({
  /** 兩座池梯各離池的長邊多遠（公尺）。 */
  sideInset: 0.8,
  /** 兩支扶手離淺水端池壁的距離（公尺）。 */
  railOffsets: Object.freeze([0.28, 0.7] as const),
  /** 踏板的長（沿池長）、厚、深（公尺）。 */
  treadSize: Object.freeze([0.42, 0.04, 0.08] as const),
  /** 第一階踏板中心在水面下多深，以及每一階再往下多少（公尺）。 */
  firstTreadDepth: 0.2,
  treadSpacing: 0.25,
  treadCount: 3,
  /** 扶手的半徑，以及扶手在水面上的部分：底端在池畔面下多少、總長多少（公尺）。 */
  railRadius: 0.035,
  railBottomBelowDeck: 0.05,
  railLength: 1.2,
  /** 扶手在水下延伸到最後一階踏板中心再往下多少（公尺）。 */
  railBelowLastTread: 0.1,
});

export interface PoolLadderTread {
  /** 踏板中心（x 沿池長、y 高程、z 沿池寬）。 */
  readonly centre: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}

/** 兩座池梯的所有踏板。 */
export function getPoolLadderTreads(model: ViewerPoolBasinSource): readonly PoolLadderTread[] {
  const pool = model.geometry.pool;
  const [minX, minZ] = pool.origin;
  if (minX === undefined || minZ === undefined) {
    throw new TypeError('Pool origin must have two coordinates.');
  }
  const { waterSurfaceElevation } = getViewerPoolPresentation(model);
  const centreX = minX + (POOL_LADDER.railOffsets[0] + POOL_LADDER.railOffsets[1]) / 2;
  const treads: PoolLadderTread[] = [];
  for (const z of [minZ + POOL_LADDER.sideInset, minZ + pool.width.value - POOL_LADDER.sideInset]) {
    for (let step = 0; step < POOL_LADDER.treadCount; step += 1) {
      treads.push(Object.freeze({
        centre: Object.freeze([
          centreX,
          waterSurfaceElevation - POOL_LADDER.firstTreadDepth - step * POOL_LADDER.treadSpacing,
          z,
        ] as const),
        size: POOL_LADDER.treadSize,
      }));
    }
  }
  return Object.freeze(treads);
}

export interface PoolLadderRail {
  /** 扶手軸心的位置（x 沿池長、z 沿池寬）。 */
  readonly x: number;
  readonly z: number;
  /** 水面上那一段的底端與頂端高程。 */
  readonly bottom: number;
  readonly top: number;
  /** 水下延伸段的底端高程；延伸段從 `bottom` 接下去，踏板才不會懸在水裡。 */
  readonly submergedBottom: number;
  readonly radius: number;
}

/** 兩座池梯的四支扶手。 */
export function getPoolLadderRails(model: ViewerPoolBasinSource): readonly PoolLadderRail[] {
  const pool = model.geometry.pool;
  const [minX, minZ] = pool.origin;
  if (minX === undefined || minZ === undefined) {
    throw new TypeError('Pool origin must have two coordinates.');
  }
  const { waterSurfaceElevation } = getViewerPoolPresentation(model);
  const bottom = pool.deckElevation.value - POOL_LADDER.railBottomBelowDeck;
  const submergedBottom = waterSurfaceElevation - POOL_LADDER.firstTreadDepth
    - (POOL_LADDER.treadCount - 1) * POOL_LADDER.treadSpacing - POOL_LADDER.railBelowLastTread;
  const rails: PoolLadderRail[] = [];
  for (const z of [minZ + POOL_LADDER.sideInset, minZ + pool.width.value - POOL_LADDER.sideInset]) {
    for (const offset of POOL_LADDER.railOffsets) {
      rails.push(Object.freeze({
        x: minX + offset,
        z,
        bottom,
        top: bottom + POOL_LADDER.railLength,
        submergedBottom,
        radius: POOL_LADDER.railRadius,
      }));
    }
  }
  return Object.freeze(rails);
}

/** 折射計算裡方盒頂面要比水面低這麼多（公尺），視線才不會從方盒裡面出發。 */
const SUBMERGED_BOX_CLEARANCE = 0.005;

function treadToSubmergedBox(tread: PoolLadderTread): SubmergedBox {
  const [x, y, z] = tread.centre;
  const [sizeX, sizeY, sizeZ] = tread.size;
  return Object.freeze({
    minX: x - sizeX / 2,
    maxX: x + sizeX / 2,
    minY: y - sizeY / 2,
    maxY: y + sizeY / 2,
    minZ: z - sizeZ / 2,
    maxZ: z + sizeZ / 2,
    finish: 'metal',
  });
}

/** 扶手的水下段在折射計算裡近似成同寬的方柱。 */
function railToSubmergedBox(rail: PoolLadderRail, waterLevel: number): SubmergedBox {
  return Object.freeze({
    minX: rail.x - rail.radius,
    maxX: rail.x + rail.radius,
    minY: rail.submergedBottom,
    maxY: waterLevel - SUBMERGED_BOX_CLEARANCE,
    minZ: rail.z - rail.radius,
    maxZ: rail.z + rail.radius,
    finish: 'metal',
  });
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
    submergedBoxes: Object.freeze([
      ...getPoolLadderTreads(model).map(treadToSubmergedBox),
      ...getPoolLadderRails(model).map((rail) => railToSubmergedBox(rail, presentation.waterSurfaceElevation)),
    ]),
  });
}

export interface ViewerPoolHallSource {
  readonly geometry: {
    readonly site: { readonly width: number };
    readonly pool: { readonly deckElevation: { readonly value: number } };
    readonly roof: {
      readonly startX: number;
      readonly planRun: number;
      readonly lowElevation: number;
      readonly highElevation: number;
    };
  };
}

/**
 * 池廳內部的大小：玻璃屋頂蓋住的範圍，從池畔地面到單斜屋頂。
 * 水面的探針倒影用它修正視差，數值與場景裡畫出來的屋頂同一個來源。
 */
export function getViewerPoolHallShape(model: ViewerPoolHallSource): PoolHallShape {
  const { roof, site, pool } = model.geometry;
  return Object.freeze({
    minX: roof.startX,
    maxX: roof.startX + roof.planRun,
    minZ: 0,
    maxZ: site.width,
    floor: pool.deckElevation.value,
    roofAtMinX: roof.lowElevation,
    roofAtMaxX: roof.highElevation,
  });
}
