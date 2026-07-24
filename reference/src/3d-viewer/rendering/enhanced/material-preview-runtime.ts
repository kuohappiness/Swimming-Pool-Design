import type * as THREE from 'three';
import type { ViewerRenderingRuntime } from '../contracts';
import {
  assertRenderQualityProfile,
  type RenderQualityProfile,
} from '../quality-profile';
import { EnhancedPbrMaterialRegistry } from './pbr-material-registry';
import {
  EnhancedEnvironmentEffect,
  type EnvironmentTextureLoader,
} from './environment-effect';
import { EnhancedFrameEffectPipeline } from './frame-effect-pipeline';
import { ENHANCED_QUALITY_PROFILES } from './quality-profiles';
import { EnhancedVisualAssetAdapter } from './visual-asset-adapter';
import type { TextureSourceLoader } from './texture-loader';

export interface EnhancedRenderingRuntimeOptions {
  readonly environmentTextureLoader?: EnvironmentTextureLoader;
  readonly materialTextureSourceLoader?: TextureSourceLoader;
}

export async function createEnhancedMaterialPreviewRuntime(
  renderer: THREE.WebGLRenderer,
  initialQuality: RenderQualityProfile = ENHANCED_QUALITY_PROFILES.high,
  options: EnhancedRenderingRuntimeOptions = {},
): Promise<ViewerRenderingRuntime> {
  let quality = assertRenderQualityProfile(initialQuality);
  const materials = await EnhancedPbrMaterialRegistry.create({
    quality,
    textureSourceLoader: options.materialTextureSourceLoader,
  });
  let environment: EnhancedEnvironmentEffect;
  let framePipeline: EnhancedFrameEffectPipeline;
  let visualAssets: EnhancedVisualAssetAdapter;
  try {
    environment = await EnhancedEnvironmentEffect.create({
      renderer,
      quality,
      textureLoader: options.environmentTextureLoader,
    });
    framePipeline = new EnhancedFrameEffectPipeline(renderer, quality);
    visualAssets = new EnhancedVisualAssetAdapter(quality);
  } catch (error) {
    materials.dispose();
    throw error;
  }
  let disposed = false;

  return {
    get quality() {
      return quality;
    },
    materials,
    environment,
    framePipeline,
    visualAssets,
    setQuality(profile) {
      if (disposed) return;
      quality = assertRenderQualityProfile(profile);
      materials.setQuality(quality);
      environment.setQuality(quality);
      framePipeline.setQuality(quality);
      visualAssets.setQuality(quality);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      visualAssets.dispose();
      framePipeline.dispose();
      environment.dispose();
      materials.dispose();
    },
  };
}

export const createEnhancedRenderingRuntime = createEnhancedMaterialPreviewRuntime;
