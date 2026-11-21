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

export interface FrameTimeStatistics {
  readonly samples: number;
  readonly averageMilliseconds: number;
  readonly p95Milliseconds: number;
  readonly slowFrameRatio: number;
}

export interface AdaptiveFrameTimeOptions {
  readonly minimumSamples?: number;
  readonly sampleWindow?: number;
  readonly slowFrameRatio?: number;
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

const TARGET_FRAME_MILLISECONDS: Readonly<Record<RenderQualityTier, number>> =
  Object.freeze({
    high: 1000 / 50,
    medium: 1000 / 40,
    low: 1000 / 30,
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
  });
}

export class AdaptiveFrameTimeMonitor {
  readonly id = 'walkthrough-one-way-frame-time-monitor';
  private readonly minimumSamples: number;
  private readonly sampleWindow: number;
  private readonly maximumSlowFrameRatio: number;
  private readonly samples: number[] = [];
  private tier: RenderQualityTier;
  private samplesSinceEvaluation = 0;
  private consecutiveBreaches = 0;

  constructor(
    initialTier: RenderQualityTier,
    options: AdaptiveFrameTimeOptions = {},
  ) {
    this.tier = initialTier;
    this.minimumSamples = options.minimumSamples ?? 120;
    this.sampleWindow = Math.max(this.minimumSamples, options.sampleWindow ?? 240);
    this.maximumSlowFrameRatio = options.slowFrameRatio ?? 0.3;
  }

  get currentTier() {
    return this.tier;
  }

  observe(milliseconds: number): RenderQualityTier | null {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return null;
    this.samples.push(milliseconds);
    if (this.samples.length > this.sampleWindow) this.samples.shift();
    this.samplesSinceEvaluation += 1;
    if (
      this.samples.length < this.minimumSamples
      || this.samplesSinceEvaluation < this.minimumSamples
      || this.tier === 'low'
    ) return null;
    this.samplesSinceEvaluation = 0;
    const statistics = this.statistics();
    const target = TARGET_FRAME_MILLISECONDS[this.tier];
    if (
      statistics.p95Milliseconds <= target * 1.2
      || statistics.slowFrameRatio <= this.maximumSlowFrameRatio
    ) {
      this.consecutiveBreaches = 0;
      return null;
    }
    this.consecutiveBreaches += 1;
    if (this.consecutiveBreaches < 2) return null;
    this.tier = this.tier === 'high' ? 'medium' : 'low';
    this.samples.length = 0;
    this.consecutiveBreaches = 0;
    return this.tier;
  }

  statistics(): FrameTimeStatistics {
    if (this.samples.length === 0) {
      return Object.freeze({
        samples: 0,
        averageMilliseconds: 0,
        p95Milliseconds: 0,
        slowFrameRatio: 0,
      });
    }
    const sorted = [...this.samples].sort((left, right) => left - right);
    const averageMilliseconds = this.samples.reduce((sum, value) => sum + value, 0)
      / this.samples.length;
    const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    const target = TARGET_FRAME_MILLISECONDS[this.tier];
    return Object.freeze({
      samples: this.samples.length,
      averageMilliseconds,
      p95Milliseconds: sorted[p95Index],
      slowFrameRatio: this.samples.filter((value) => value > target).length / this.samples.length,
    });
  }
}
