import type { ViewerModel } from './model-adapter';
import { getViewerPoolBasinShape, getViewerPoolHallShape } from './pool-state';
import type {
  FixtureLayout,
  FixtureZone,
  LightFixture,
  PoolLight,
} from './rendering/lighting/fixture-lights';

/**
 * 池館燈具的配置：場景畫出來的燈具網格與燈光計算共用這一份位置。
 *
 * 全部是視覺用的概念配置（0.8.2 起的天花燈，TASK-152 步驟 5 加上水下燈），不是機電設計；
 * 燈具數量、位置、光通量、照度與水下燈的安全電壓仍待機電專業設計（`OPEN-009`）。
 */

export const POOL_HALL_DETAILS_NAME = 'POOL-HALL-DETAILS-PHASE-1';
export const POOL_HALL_FIXTURE_MESH_NAME = 'visual-only:POOL-HALL-ceiling-lights:12';
export const L2_INTERIOR_DETAILS_NAME = 'L2-INTERIOR-DETAILS-PHASE-1';
export const L2_FIXTURE_MESH_NAME = 'visual-only:L2-ceiling-lights:12';

/** 池廳天花燈沿池長的位置（SITE-X）與兩排的位置（SITE-Y），掛在屋頂下 0.12 m。 */
const POOL_HALL_FIXTURE_X = Object.freeze([4.5, 9, 13.5, 18, 22.5, 27]);
const POOL_HALL_FIXTURE_Y = Object.freeze([2.1, 11.9]);
const POOL_HALL_FIXTURE_DROP = 0.12;
/**
 * 池廳每盞燈的光通量（lm）。12 盞讓池畔與水面的平均直射照度約 300 lux，
 * 學校訓練池常見的範圍；不是照度計算。
 */
const POOL_HALL_FIXTURE_LUMENS = 16_000;

const L2_FIXTURE_X = Object.freeze([33.2, 36.2, 39.2]);
const L2_FIXTURE_Y = Object.freeze([4, 6.4, 9.6, 12]);
/** 2F 每盞平板燈的光通量（lm），更衣淋浴空間的平均直射照度約 300 lux。 */
const L2_FIXTURE_LUMENS = 5_500;

/** 水下燈：兩道長池壁各 6 盞，燈心在水面下 0.6 m，被教學平台蓋住的位置不裝。 */
const POOL_LIGHTS_PER_WALL = 6;
const POOL_LIGHT_DEPTH = 0.6;
const POOL_LIGHT_LENS_RADIUS = 0.14;
/** 每盞水下燈的光通量（lm）。 */
const POOL_LIGHT_LUMENS = 2_200;

/** 池廳光線溢出玻璃牆的距離（公尺）；朝服務核心那一側（+X）是實牆，不溢出。 */
const POOL_HALL_SPILL = 6;
const ZONE_EDGE = 0.25;

type Point = [number, number, number];

/** 池廳天花燈網格的中心（SITE 根節點座標）。 */
export function getPoolHallCeilingFixtureCentres(model: ViewerModel): Point[] {
  const roof = model.geometry.roof;
  const centres: Point[] = [];
  for (const x of POOL_HALL_FIXTURE_X) {
    const roofHeight =
      roof.lowElevation +
      (roof.highElevation - roof.lowElevation) * ((x - roof.startX) / roof.planRun);
    for (const y of POOL_HALL_FIXTURE_Y) centres.push([x, roofHeight - POOL_HALL_FIXTURE_DROP, y]);
  }
  return centres;
}

/** 2F 天花平板燈網格的中心（SITE 根節點座標）。 */
export function getL2CeilingFixtureCentres(model: ViewerModel): Point[] {
  const l2 = model.geometry.l2;
  const height = l2.ceiling.elevation - l2.ceiling.thickness - 0.04;
  return L2_FIXTURE_X.flatMap((x) => L2_FIXTURE_Y.map((y): Point => [x, height, y]));
}

/** 水下燈：位置在池壁面上，朝池內打光。 */
function getPoolUnderwaterLights(model: ViewerModel): PoolLight[] {
  const basin = getViewerPoolBasinShape(model);
  const platform = model.geometry.pool.teachingPlatform?.bounds;
  const length = basin.maxX - basin.minX;
  const height = basin.waterLevel - POOL_LIGHT_DEPTH;
  const lights: PoolLight[] = [];
  for (const [z, aim] of [
    [basin.minZ, 1],
    [basin.maxZ, -1],
  ] as const) {
    for (let index = 0; index < POOL_LIGHTS_PER_WALL; index += 1) {
      const x = basin.minX + ((index + 0.5) * length) / POOL_LIGHTS_PER_WALL;
      const covered =
        platform && x > platform.x1 && x < platform.x2 && z >= platform.y1 && z <= platform.y2;
      if (covered) continue;
      lights.push(
        Object.freeze({
          position: Object.freeze<readonly [number, number, number]>([x, height, z]),
          aim: Object.freeze<readonly [number, number, number]>([0, 0, aim]),
          lumens: POOL_LIGHT_LUMENS,
        }),
      );
    }
  }
  return lights;
}

const fixturesAt = (centres: readonly Point[], lumens: number): LightFixture[] =>
  centres.map((position) =>
    Object.freeze({
      position: Object.freeze<readonly [number, number, number]>(position),
      lumens,
    }),
  );

export function getViewerFixtureLayout(model: ViewerModel): FixtureLayout {
  const hall = getViewerPoolHallShape(model);
  const basin = getViewerPoolBasinShape(model);
  const roofTop = Math.max(hall.roofAtMinX, hall.roofAtMaxX);
  const bottom = Math.min(basin.shallowBottom, basin.deepBottom);
  const hallZone: FixtureZone = {
    id: 'pool-hall',
    fixtures: fixturesAt(getPoolHallCeilingFixtureCentres(model), POOL_HALL_FIXTURE_LUMENS),
    inner: { min: [hall.minX, bottom - 0.1, hall.minZ], max: [hall.maxX, roofTop, hall.maxZ] },
    outer: {
      min: [hall.minX - POOL_HALL_SPILL, bottom - 0.1 - ZONE_EDGE, hall.minZ - POOL_HALL_SPILL],
      max: [hall.maxX + ZONE_EDGE, roofTop + ZONE_EDGE, hall.maxZ + POOL_HALL_SPILL],
    },
    floor: hall.floor,
    reachesWater: true,
    anchorName: POOL_HALL_DETAILS_NAME,
    emitterName: POOL_HALL_FIXTURE_MESH_NAME,
  };
  const l2 = model.geometry.l2;
  const ceiling = l2.ceiling.elevation - l2.ceiling.thickness;
  const l2Zone: FixtureZone = {
    id: 'l2',
    fixtures: fixturesAt(getL2CeilingFixtureCentres(model), L2_FIXTURE_LUMENS),
    inner: {
      min: [l2.bounds.x1, l2.baseElevation, l2.bounds.y1],
      max: [l2.bounds.x2, ceiling, l2.bounds.y2],
    },
    outer: {
      min: [l2.bounds.x1 - ZONE_EDGE, l2.baseElevation - ZONE_EDGE, l2.bounds.y1 - ZONE_EDGE],
      max: [l2.bounds.x2 + ZONE_EDGE, ceiling + ZONE_EDGE, l2.bounds.y2 + ZONE_EDGE],
    },
    floor: l2.baseElevation,
    reachesWater: false,
    anchorName: L2_INTERIOR_DETAILS_NAME,
    emitterName: L2_FIXTURE_MESH_NAME,
  };
  return Object.freeze({
    zones: Object.freeze([hallZone, l2Zone]),
    poolLights: Object.freeze(getPoolUnderwaterLights(model)),
    poolLightAnchorName: POOL_HALL_DETAILS_NAME,
    poolLightLensRadius: POOL_LIGHT_LENS_RADIUS,
  });
}
