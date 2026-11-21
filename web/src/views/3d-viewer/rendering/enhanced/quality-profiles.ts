import {
  assertRenderQualityProfile,
  type RenderQualityProfile,
  type RenderQualityTier,
} from '../quality-profile';
import { getVisualAssetByteSize } from './asset-manifest';

const MEBIBYTE = 1024 * 1024;

export interface EnhancedQualityProfile extends RenderQualityProfile {
  readonly assetBudgetBytes: number;
  readonly minimumAverageFps: number;
  readonly p95FrameTimeRecord: boolean;
  readonly anisotropyCap: number;
  readonly environmentResolution: number;
  readonly surfaceDetail: 'full' | 'reduced' | 'essential';
}

export const ENHANCED_QUALITY_PROFILES: Readonly<Record<RenderQualityTier, EnhancedQualityProfile>> =
  Object.freeze({
    high: Object.freeze({
      id: 'high',
      pixelRatioCap: 2,
      shadows: true,
      shadowMapSize: 2048,
      textureTier: 'high',
      ambientOcclusion: false,
      enhancedWater: true,
      postProcessing: false,
      assetBudgetBytes: 24 * MEBIBYTE,
      minimumAverageFps: 50,
      p95FrameTimeRecord: true,
      anisotropyCap: 8,
      environmentResolution: 512,
      surfaceDetail: 'full',
    }),
    medium: Object.freeze({
      id: 'medium',
      pixelRatioCap: 1.5,
      shadows: true,
      shadowMapSize: 1024,
      textureTier: 'medium',
      ambientOcclusion: false,
      enhancedWater: true,
      postProcessing: false,
      assetBudgetBytes: 12 * MEBIBYTE,
      minimumAverageFps: 40,
      p95FrameTimeRecord: true,
      anisotropyCap: 4,
      environmentResolution: 256,
      surfaceDetail: 'reduced',
    }),
    low: Object.freeze({
      id: 'low',
      pixelRatioCap: 1,
      shadows: false,
      shadowMapSize: 0,
      textureTier: 'low',
      ambientOcclusion: false,
      enhancedWater: false,
      postProcessing: false,
      assetBudgetBytes: 6 * MEBIBYTE,
      minimumAverageFps: 30,
      p95FrameTimeRecord: true,
      anisotropyCap: 1,
      environmentResolution: 0,
      surfaceDetail: 'essential',
    }),
  });

export function assertEnhancedQualityProfiles(
  profiles: Readonly<Record<RenderQualityTier, EnhancedQualityProfile>> = ENHANCED_QUALITY_PROFILES,
): Readonly<Record<RenderQualityTier, EnhancedQualityProfile>> {
  for (const tier of ['high', 'medium', 'low'] as const) {
    const profile = profiles[tier];
    assertRenderQualityProfile(profile);
    if (profile.id !== tier) {
      throw new TypeError(`Enhanced quality profile key and ID must match: ${tier}/${profile.id}`);
    }
    if (!Number.isSafeInteger(profile.assetBudgetBytes) || profile.assetBudgetBytes <= 0) {
      throw new TypeError(`Enhanced quality asset budget is invalid: ${tier}`);
    }
    if (getVisualAssetByteSize(tier) > profile.assetBudgetBytes) {
      throw new TypeError(`Enhanced quality asset budget is exceeded: ${tier}`);
    }
    if (!Number.isFinite(profile.minimumAverageFps) || profile.minimumAverageFps <= 0) {
      throw new TypeError(`Enhanced quality FPS target is invalid: ${tier}`);
    }
    if (!Number.isInteger(profile.anisotropyCap) || profile.anisotropyCap < 1) {
      throw new TypeError(`Enhanced quality anisotropy cap is invalid: ${tier}`);
    }
    if (!Number.isInteger(profile.environmentResolution) || profile.environmentResolution < 0) {
      throw new TypeError(`Enhanced quality environment resolution is invalid: ${tier}`);
    }
  }

  if (
    profiles.high.assetBudgetBytes < profiles.medium.assetBudgetBytes
    || profiles.medium.assetBudgetBytes < profiles.low.assetBudgetBytes
  ) {
    throw new TypeError('Enhanced quality asset budgets must descend from high to low.');
  }

  return profiles;
}

export function getEnhancedQualityProfile(tier: RenderQualityTier): EnhancedQualityProfile {
  assertEnhancedQualityProfiles();
  return ENHANCED_QUALITY_PROFILES[tier];
}
