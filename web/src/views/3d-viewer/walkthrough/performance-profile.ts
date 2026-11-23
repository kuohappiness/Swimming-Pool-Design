import type {
  RenderQualityProfile,
  RenderQualityTier,
} from '../rendering/quality-profile.js';

export interface WalkthroughCapabilityProfile {
  readonly id: RenderQualityTier;
  readonly pixelRatioCap: number;
  readonly shadows: boolean;
  readonly underwaterEffect: 'full' | 'reduced' | 'essential';
  readonly cameraMotion: boolean;
}

const CAPABILITIES: Readonly<Record<RenderQualityTier, Omit<WalkthroughCapabilityProfile, 'cameraMotion'>>> =
  Object.freeze({
    high: Object.freeze({
      id: 'high',
      pixelRatioCap: 2,
      shadows: true,
      underwaterEffect: 'full',
    }),
    medium: Object.freeze({
      id: 'medium',
      pixelRatioCap: 1.5,
      shadows: true,
      underwaterEffect: 'reduced',
    }),
    low: Object.freeze({
      id: 'low',
      pixelRatioCap: 1,
      shadows: false,
      underwaterEffect: 'essential',
    }),
  });

export function getWalkthroughCapabilityProfile(
  tier: RenderQualityTier,
  reducedMotion: boolean,
): WalkthroughCapabilityProfile {
  return Object.freeze({
    ...CAPABILITIES[tier],
    cameraMotion: !reducedMotion && tier !== 'low',
  });
}

export function adaptRenderQualityProfile(
  profile: RenderQualityProfile,
  tier: RenderQualityTier,
): RenderQualityProfile {
  const capability = CAPABILITIES[tier];
  return Object.freeze({
    ...profile,
    id: tier,
    pixelRatioCap: capability.pixelRatioCap,
    shadows: capability.shadows,
    shadowMapSize: tier === 'high' ? 2048 : tier === 'medium' ? 1024 : 0,
    textureTier: tier,
    ambientOcclusion: tier === 'high' && profile.ambientOcclusion,
    enhancedWater: tier !== 'low' && profile.enhancedWater,
    postProcessing: tier === 'high' && profile.postProcessing,
    bloom: tier === 'high' && Boolean(profile.bloom),
    exposureAdaptation: tier === 'high' && Boolean(profile.exposureAdaptation),
  });
}
