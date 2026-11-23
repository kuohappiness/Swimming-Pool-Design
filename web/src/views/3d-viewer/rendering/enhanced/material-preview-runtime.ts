import * as THREE from 'three';
import type { ViewerRenderingRuntime } from '../contracts';
import { assertRenderQualityProfile, type RenderQualityProfile } from '../quality-profile';
import { EnhancedPbrMaterialRegistry } from './pbr-material-registry';
import { EnhancedEnvironmentEffect, type EnvironmentTextureLoader } from './environment-effect';
import { EnhancedFrameEffectPipeline } from './frame-effect-pipeline';
import { ENHANCED_QUALITY_PROFILES } from './quality-profiles';
import { EnhancedVisualAssetAdapter } from './visual-asset-adapter';
import type { TextureSourceLoader } from './texture-loader';
import type { PoolBasinShape, PoolHallShape } from '../water/water-surface';

export interface EnhancedRenderingRuntimeOptions {
  readonly environmentTextureLoader?: EnvironmentTextureLoader;
  readonly materialTextureSourceLoader?: TextureSourceLoader;
  /** 模型的池體形狀；有給才啟用寫實水面。 */
  readonly poolBasin?: PoolBasinShape;
  /** 模型的池廳大小；有給時水面的探針倒影會修正視差。 */
  readonly poolHall?: PoolHallShape;
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
    const laneLineMaterial = materials.get('sanitary-dark');
    const railMaterial = materials.get('pool-rail');
    visualAssets = new EnhancedVisualAssetAdapter(
      quality,
      options.poolBasin
        ? {
            mirrorReflection: { renderer },
            realisticWater: {
              renderer,
              basin: options.poolBasin,
              hall: options.poolHall,
              basinMaterial: materials.get('pool-basin'),
              // 水面折射看到的池底標線，要和實體標線（sanitary-dark）同色。
              laneLineColor:
                laneLineMaterial instanceof THREE.MeshStandardMaterial
                  ? laneLineMaterial.color
                  : undefined,
              // 水面折射看到的池梯踏階，要和實體踏階（pool-rail）同色。
              metalColor:
                railMaterial instanceof THREE.MeshStandardMaterial ? railMaterial.color : undefined,
            },
          }
        : { mirrorReflection: { renderer } },
    );
  } catch (error) {
    materials.dispose();
    throw error;
  }
  framePipeline.setSceneRenderer((scene, camera) =>
    visualAssets.renderFrame(renderer, scene, camera),
  );
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
