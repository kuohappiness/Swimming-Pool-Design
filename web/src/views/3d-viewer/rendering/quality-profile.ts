export type RenderQualityTier = 'high' | 'medium' | 'low';

export interface RenderQualityProfile {
  readonly id: RenderQualityTier;
  readonly pixelRatioCap: number;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly textureTier: RenderQualityTier;
  /** 環境遮蔽與接觸陰影（同一張畫面深度）。要 `postProcessing`。 */
  readonly ambientOcclusion: boolean;
  readonly enhancedWater: boolean;
  /** 先把場景畫到浮點貼圖、多重取樣抗鋸齒，最後才做色調映射（TASK-152 步驟 6）。 */
  readonly postProcessing: boolean;
  /** 暈光。要 `postProcessing`。 */
  readonly bloom?: boolean;
  /** 依畫面亮度的曝光適應。要 `postProcessing`。 */
  readonly exposureAdaptation?: boolean;
  /**
   * 水面平面倒影的繪製解析度相對於畫面的比例；0 或沒給代表只用反射探針（DEC-190）。
   * 由四級畫質帶入，見 `performance/tier-profile.ts`。
   */
  readonly waterReflectionScale?: number;
}

export const BASELINE_QUALITY_PROFILE: RenderQualityProfile = Object.freeze({
  id: 'high',
  pixelRatioCap: 2,
  shadows: true,
  shadowMapSize: 2048,
  textureTier: 'high',
  ambientOcclusion: false,
  enhancedWater: false,
  postProcessing: false,
});

/**
 * 鏡頭效果（`postProcessing`）要先把場景畫到半浮點貼圖；顯示卡不支援時，極致與高級也直接畫到
 * 畫面，暈光與環境遮蔽就不在。測試用的假繪圖器沒有 extensions，算不支援。
 */
export function supportsFrameEffects(renderer: {
  readonly extensions?: { has(name: string): boolean };
}): boolean {
  return (
    typeof renderer.extensions?.has === 'function' &&
    renderer.extensions.has('EXT_color_buffer_float')
  );
}

export function assertRenderQualityProfile(profile: RenderQualityProfile): RenderQualityProfile {
  if (!['high', 'medium', 'low'].includes(profile.id)) {
    throw new TypeError(`Unknown render quality profile: ${String(profile.id)}`);
  }
  if (
    !Number.isFinite(profile.pixelRatioCap) ||
    profile.pixelRatioCap <= 0 ||
    profile.pixelRatioCap > 2
  ) {
    throw new TypeError('Render quality pixelRatioCap must be finite and within (0, 2].');
  }
  if (!Number.isInteger(profile.shadowMapSize) || profile.shadowMapSize < 0) {
    throw new TypeError('Render quality shadowMapSize must be a non-negative integer.');
  }
  if (
    (profile.ambientOcclusion || profile.bloom || profile.exposureAdaptation) &&
    !profile.postProcessing
  ) {
    throw new TypeError(
      'Render quality ambient occlusion, bloom and exposure adaptation need postProcessing.',
    );
  }
  const reflection = profile.waterReflectionScale ?? 0;
  if (!Number.isFinite(reflection) || reflection < 0 || reflection > 1) {
    throw new TypeError('Render quality waterReflectionScale must be within [0, 1].');
  }
  return profile;
}
