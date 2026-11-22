import {
  REALISM_TIER_IDS,
  RENDER_BUDGETS,
} from '../../../../../../core/viewer/render-budgets.mjs';
import type { RenderQualityTier } from '../quality-profile';

/** 寫實版的四級畫質（DEC-190）。順序由高到低，數字上限在 core/viewer/render-budgets.mjs。 */
export type RealismTierId = 'ultra' | 'high' | 'medium' | 'saver';

export type DeviceClass = 'desktop' | 'mobile';

/**
 * 幀率吃緊時可以暫時關掉的效果，依固定順序由前往後卸載、由後往前恢復。
 * 順序依「關掉後最不容易被察覺」排列：先暈光，最後才動到陰影層數與人物動畫。
 */
export const SHED_ORDER = Object.freeze([
  'bloom',
  'ambient-occlusion',
  'water-refraction',
  'mirror-reflection',
  'water-reflection-resolution',
  'shadow-cascades',
  'people-animation',
] as const);

export type ShedStep = (typeof SHED_ORDER)[number];

export interface RealismTier {
  readonly id: RealismTierId;
  /** 畫面上顯示的名稱。 */
  readonly label: string;
  /** 接上新管線前，舊的三級畫質用哪一級代替。 */
  readonly legacyTier: RenderQualityTier;
  readonly pixelRatioCap: number;
  /** 動態解析度可降到的最低比例；1 代表這一級不做動態解析度。 */
  readonly minimumResolutionScale: number;
  /** 即時陰影的層數；0 代表只用烘焙光照。 */
  readonly shadowCascades: 0 | 1 | 2 | 3;
  readonly shadowMapSize: number;
  /** 水面倒影繪製解析度相對於畫面的比例；0 代表只取環境貼圖。 */
  readonly waterReflectionScale: number;
  readonly waterRefraction: boolean;
  readonly caustics: 'realtime' | 'scrolling' | 'baked';
  /** 鏡牆倒影：即時平面反射，或只取反射探針。 */
  readonly mirrorReflection: 'planar' | 'probe';
  readonly ambientOcclusion: boolean;
  readonly bloom: boolean;
  readonly textureMaxSize: 2048 | 1024 | 512;
  readonly anisotropyCap: number;
  /** 同時播放動畫的人物上限。 */
  readonly animatedPeople: number;
  readonly drawCallBudget: number;
  readonly triangleBudget: number;
  readonly downloadBudgetBytes: number;
  /** 相對於中級的估計繪製成本，只用於啟動時選級；實機量測後再校正。 */
  readonly relativeCost: number;
}

/**
 * 幀率底線：電腦 60 fps；手機底線 30 fps、目標 45 fps。
 * 調節器以 target 判斷是否有餘裕，以 floor 判斷是否必須卸載。
 */
export const FRAME_TARGETS: Readonly<Record<DeviceClass, { readonly floorFps: number; readonly targetFps: number }>> =
  Object.freeze({
    desktop: Object.freeze({ floorFps: 60, targetFps: 60 }),
    mobile: Object.freeze({ floorFps: 30, targetFps: 45 }),
  });

function tier(definition: Omit<RealismTier, 'drawCallBudget' | 'triangleBudget' | 'downloadBudgetBytes'>): RealismTier {
  const budget = RENDER_BUDGETS[definition.id];
  return Object.freeze({
    ...definition,
    drawCallBudget: budget.drawCalls,
    triangleBudget: budget.triangles,
    downloadBudgetBytes: budget.downloadBytes,
  });
}

export const REALISM_TIERS: Readonly<Record<RealismTierId, RealismTier>> = Object.freeze({
  ultra: tier({
    id: 'ultra',
    label: '極致',
    legacyTier: 'high',
    pixelRatioCap: 2,
    minimumResolutionScale: 0.7,
    shadowCascades: 3,
    shadowMapSize: 2048,
    waterReflectionScale: 0.5,
    waterRefraction: true,
    caustics: 'realtime',
    mirrorReflection: 'planar',
    ambientOcclusion: true,
    bloom: true,
    textureMaxSize: 2048,
    anisotropyCap: 16,
    animatedPeople: 12,
    relativeCost: 3.2,
  }),
  high: tier({
    id: 'high',
    label: '高',
    legacyTier: 'high',
    pixelRatioCap: 1.5,
    minimumResolutionScale: 0.7,
    shadowCascades: 2,
    shadowMapSize: 2048,
    waterReflectionScale: 0.5,
    waterRefraction: true,
    caustics: 'realtime',
    mirrorReflection: 'planar',
    ambientOcclusion: false,
    bloom: true,
    textureMaxSize: 2048,
    anisotropyCap: 8,
    animatedPeople: 8,
    relativeCost: 1.9,
  }),
  medium: tier({
    id: 'medium',
    label: '中',
    legacyTier: 'medium',
    pixelRatioCap: 1.5,
    minimumResolutionScale: 0.7,
    shadowCascades: 1,
    shadowMapSize: 1024,
    // 平面倒影要把場景多畫一次，實測會讓這一級的繪製呼叫從 145 變成 285，超過上限 200；
    // 中級是手機自動選級的最高級，所以只用探針（探針已依池廳大小修正視差）。
    waterReflectionScale: 0,
    waterRefraction: false,
    caustics: 'scrolling',
    mirrorReflection: 'probe',
    ambientOcclusion: false,
    bloom: false,
    textureMaxSize: 1024,
    anisotropyCap: 4,
    animatedPeople: 4,
    relativeCost: 1,
  }),
  saver: tier({
    id: 'saver',
    label: '省電',
    legacyTier: 'low',
    pixelRatioCap: 1,
    minimumResolutionScale: 0.7,
    shadowCascades: 0,
    shadowMapSize: 0,
    waterReflectionScale: 0,
    waterRefraction: false,
    caustics: 'baked',
    mirrorReflection: 'probe',
    ambientOcclusion: false,
    bloom: false,
    textureMaxSize: 512,
    anisotropyCap: 2,
    animatedPeople: 0,
    relativeCost: 0.55,
  }),
});

export const REALISM_TIER_ORDER: readonly RealismTierId[] = Object.freeze(
  [...REALISM_TIER_IDS] as RealismTierId[],
);

/** 這一級開著、因此在幀率吃緊時可以卸載的效果，依 SHED_ORDER 排序。 */
export function sheddableSteps(definition: RealismTier): readonly ShedStep[] {
  const enabled: Record<ShedStep, boolean> = {
    bloom: definition.bloom,
    'ambient-occlusion': definition.ambientOcclusion,
    'water-refraction': definition.waterRefraction,
    'mirror-reflection': definition.mirrorReflection === 'planar',
    'water-reflection-resolution': definition.waterReflectionScale > 0,
    'shadow-cascades': definition.shadowCascades > 1,
    'people-animation': definition.animatedPeople > 0,
  };
  return Object.freeze(SHED_ORDER.filter((step) => enabled[step]));
}

export function assertRealismTiers(
  tiers: Readonly<Record<RealismTierId, RealismTier>> = REALISM_TIERS,
): Readonly<Record<RealismTierId, RealismTier>> {
  let previous: RealismTier | null = null;
  for (const id of REALISM_TIER_ORDER) {
    const current = tiers[id];
    if (!current || current.id !== id) {
      throw new TypeError(`Realism tier key and ID must match: ${id}`);
    }
    if (!(current.pixelRatioCap > 0 && current.pixelRatioCap <= 2)) {
      throw new TypeError(`Realism tier pixelRatioCap must be within (0, 2]: ${id}`);
    }
    if (!(current.minimumResolutionScale >= 0.5 && current.minimumResolutionScale <= 1)) {
      throw new TypeError(`Realism tier minimumResolutionScale must be within [0.5, 1]: ${id}`);
    }
    if ((current.shadowCascades === 0) !== (current.shadowMapSize === 0)) {
      throw new TypeError(`Realism tier shadow cascades and map size must agree: ${id}`);
    }
    if (!(current.relativeCost > 0)) {
      throw new TypeError(`Realism tier relativeCost must be positive: ${id}`);
    }
    if (previous) {
      const descending: ReadonlyArray<keyof RealismTier> = [
        'pixelRatioCap',
        'shadowCascades',
        'shadowMapSize',
        'waterReflectionScale',
        'textureMaxSize',
        'anisotropyCap',
        'animatedPeople',
        'drawCallBudget',
        'triangleBudget',
        'downloadBudgetBytes',
        'relativeCost',
      ];
      for (const key of descending) {
        if ((current[key] as number) > (previous[key] as number)) {
          throw new TypeError(`Realism tier ${key} must not grow from ${previous.id} to ${id}.`);
        }
      }
      for (const key of ['waterRefraction', 'ambientOcclusion', 'bloom'] as const) {
        if (current[key] && !previous[key]) {
          throw new TypeError(`Realism tier ${key} must not turn on below ${previous.id}.`);
        }
      }
    }
    previous = current;
  }
  return tiers;
}

export function getRealismTier(id: RealismTierId): RealismTier {
  return REALISM_TIERS[id];
}

/** 往下一級；已經是最低級時回傳 null。 */
export function lowerRealismTier(id: RealismTierId): RealismTierId | null {
  const index = REALISM_TIER_ORDER.indexOf(id);
  return REALISM_TIER_ORDER[index + 1] ?? null;
}

/** 往上一級；已經是最高級時回傳 null。 */
export function higherRealismTier(id: RealismTierId): RealismTierId | null {
  const index = REALISM_TIER_ORDER.indexOf(id);
  return index > 0 ? REALISM_TIER_ORDER[index - 1] : null;
}
