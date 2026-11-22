export type RenderQualityTier = 'high' | 'medium' | 'low';

export interface RenderQualityProfile {
  readonly id: RenderQualityTier;
  readonly pixelRatioCap: number;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly textureTier: RenderQualityTier;
  readonly ambientOcclusion: boolean;
  readonly enhancedWater: boolean;
  readonly postProcessing: boolean;
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

export function assertRenderQualityProfile(profile: RenderQualityProfile): RenderQualityProfile {
  if (!['high', 'medium', 'low'].includes(profile.id)) {
    throw new TypeError(`Unknown render quality profile: ${String(profile.id)}`);
  }
  if (!Number.isFinite(profile.pixelRatioCap) || profile.pixelRatioCap <= 0 || profile.pixelRatioCap > 2) {
    throw new TypeError('Render quality pixelRatioCap must be finite and within (0, 2].');
  }
  if (!Number.isInteger(profile.shadowMapSize) || profile.shadowMapSize < 0) {
    throw new TypeError('Render quality shadowMapSize must be a non-negative integer.');
  }
  const reflection = profile.waterReflectionScale ?? 0;
  if (!Number.isFinite(reflection) || reflection < 0 || reflection > 1) {
    throw new TypeError('Render quality waterReflectionScale must be within [0, 1].');
  }
  return profile;
}
