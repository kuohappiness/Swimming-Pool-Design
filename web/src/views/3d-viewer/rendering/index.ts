import type * as THREE from 'three';
import { BaselineEnvironmentEffect } from './baseline-environment';
import { BaselineFrameEffectPipeline } from './baseline-frame-pipeline';
import { BaselineMaterialRegistry } from './baseline-material-registry';
import { BaselineVisualAssetAdapter } from './baseline-visual-assets';
import type { SceneRenderingDependencies, ViewerRenderingRuntime } from './contracts';
import {
  assertRenderQualityProfile,
  BASELINE_QUALITY_PROFILE,
  type RenderQualityProfile,
} from './quality-profile';

export * from './contracts';
export * from './quality-profile';

/** @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。 */
export function createBaselineSceneRenderingDependencies(): SceneRenderingDependencies {
  return {
    materials: new BaselineMaterialRegistry(),
    visualAssets: new BaselineVisualAssetAdapter(),
  };
}

export function createBaselineRenderingRuntime(
  renderer: THREE.WebGLRenderer,
  initialQuality: RenderQualityProfile = BASELINE_QUALITY_PROFILE,
): ViewerRenderingRuntime {
  let quality = assertRenderQualityProfile(initialQuality);
  const materials = new BaselineMaterialRegistry();
  const environment = new BaselineEnvironmentEffect();
  const framePipeline = new BaselineFrameEffectPipeline(renderer, quality);
  const visualAssets = new BaselineVisualAssetAdapter();
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
