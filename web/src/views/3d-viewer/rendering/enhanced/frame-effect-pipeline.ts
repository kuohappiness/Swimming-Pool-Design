import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { FrameEffect, FrameEffectPipeline } from '../contracts';
import {
  assertRenderQualityProfile,
  type RenderQualityProfile,
  supportsFrameEffects,
} from '../quality-profile';
import { ExposureAdaptation } from './exposure-adaptation';
import { FrameGrade } from './frame-grade';
import { ScreenSpaceOcclusion } from './screen-space-occlusion';
import { getToneMappingProfile } from './tone-mapping';

/** 像素比的下限：防呆用，正常情況由畫質分級的最低解析度比例把關。 */
const MINIMUM_PIXEL_RATIO = 0.5;

/** 後製時場景畫進的浮點貼圖用幾倍多重取樣抗鋸齒（直接畫到畫面時由畫布本身的抗鋸齒負責）。 */
export const MULTISAMPLE_SAMPLES = 4;

/**
 * 暈光（TASK-152 步驟 6）：只有曝光後遠比白色亮的地方（太陽在水面與金屬上的反光、夜裡的燈具、
 * 太陽旁的天空）才暈開；陽光下的白牆剛好到白色，不暈。門檻在曝光之後判斷，所以白天黑夜一致，
 * 從門檻到門檻加 `softness` 之間漸強。
 */
export const BLOOM = Object.freeze({
  threshold: 2,
  softness: 1,
  strength: 0.3,
  radius: 0.45,
});

/** 兩格之間最多算幾秒：分頁切走再回來時，曝光不會一下子跳到底。 */
const MAXIMUM_FRAME_SECONDS = 0.25;

interface PostProcessingTargets {
  /** 場景畫在這裡（線性、未做色調映射，多重取樣，含深度）。 */
  readonly scene: THREE.WebGLRenderTarget;
  /** 套上遮蔽、曝光與暈光之後，等著做色調映射。 */
  readonly graded: THREE.WebGLRenderTarget;
}

/**
 * 加強版的畫面管線。中級與省電級直接畫到畫面（材質內做色調映射）；極致與高級先畫到浮點貼圖，
 * 依序做曝光測光、環境遮蔽、接觸陰影與曝光、暈光，最後才做色調映射與 sRGB 轉換（`OutputPass`）。
 * 兩條路的色調映射與曝光算法相同，曝光適應為 0 格時畫面一致。
 */
export class EnhancedFrameEffectPipeline implements FrameEffectPipeline {
  readonly id = 'enhanced-frame-effects';
  private readonly renderer: THREE.WebGLRenderer;
  private readonly postProcessingSupported: boolean;
  private quality: RenderQualityProfile;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private targets: PostProcessingTargets | null = null;
  private occlusion: ScreenSpaceOcclusion | null = null;
  private exposure: ExposureAdaptation | null = null;
  private grade: FrameGrade | null = null;
  private bloom: UnrealBloomPass | null = null;
  private output: OutputPass | null = null;
  private readonly bufferSize = new THREE.Vector2();
  private lastFrameAt: number | null = null;
  private disposed = false;
  private sceneRenderer: ((scene: THREE.Scene, camera: THREE.Camera) => boolean) | null = null;

  constructor(renderer: THREE.WebGLRenderer, initialQuality: RenderQualityProfile) {
    this.renderer = renderer;
    this.postProcessingSupported = supportsFrameEffects(renderer);
    this.quality = assertRenderQualityProfile(initialQuality);
    this.applyRendererQuality();
  }

  /** 先畫到浮點貼圖再後製（極致與高級）。 */
  get usesPostProcessing(): boolean {
    return this.postProcessingSupported && Boolean(this.quality.postProcessing);
  }

  get usesAmbientOcclusion(): boolean {
    return this.usesPostProcessing && Boolean(this.quality.ambientOcclusion);
  }

  get usesBloom(): boolean {
    return this.usesPostProcessing && Boolean(this.quality.bloom);
  }

  get usesExposureAdaptation(): boolean {
    return this.usesPostProcessing && Boolean(this.quality.exposureAdaptation);
  }

  get activeEffects(): readonly FrameEffect[] {
    if (!this.usesPostProcessing) return [];
    const effects: FrameEffect[] = ['multisample'];
    if (this.usesExposureAdaptation) effects.push('exposure-adaptation');
    if (this.usesBloom) effects.push('bloom');
    if (this.usesAmbientOcclusion) effects.push('ambient-occlusion', 'contact-shadows');
    return effects;
  }

  resize(width: number, height: number, pixelRatio: number) {
    if (this.disposed) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    // 動態解析度（DEC-190）會把像素比降到 1 以下，所以下限不是 1。
    this.pixelRatio = Math.min(Math.max(MINIMUM_PIXEL_RATIO, pixelRatio), this.quality.pixelRatioCap);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.resizeTargets();
  }

  /**
   * 讓別人接手畫某些畫面（鏡頭在水裡時的水下畫面）。接手的一方有畫就回傳 true；
   * 回傳 false 時管線照常畫。接手的一方畫完要把繪製目標換回原本的（後製時是場景貼圖）。
   */
  setSceneRenderer(render: ((scene: THREE.Scene, camera: THREE.Camera) => boolean) | null) {
    this.sceneRenderer = render;
  }

  /** 下一格的曝光直接用測到的值（換場景之後，不從上一個場景慢慢適應過來）。 */
  resetAdaptation() {
    this.exposure?.reset();
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.disposed) return;
    const environmentId = scene.userData.environmentId ?? 'day';
    const exposure = scene.userData.toneMappingExposure ?? getToneMappingProfile(environmentId).exposure;
    this.renderer.toneMappingExposure = exposure;
    if (this.usesPostProcessing) {
      this.renderPostProcessed(scene, camera, exposure);
    } else if (!this.sceneRenderer?.(scene, camera)) {
      this.renderer.render(scene, camera);
    }
  }

  setQuality(profile: RenderQualityProfile) {
    if (this.disposed) return;
    const previous = this.activeEffects;
    this.quality = assertRenderQualityProfile(profile);
    this.applyRendererQuality();
    // 卸載的效果連同它的貼圖一起釋放；後製本身（場景貼圖與曝光）留著。
    if (!this.usesPostProcessing) this.disposePostProcessing();
    else {
      if (!this.usesAmbientOcclusion) this.disposeOcclusion();
      if (!this.usesBloom) this.disposeBloom();
    }
    if (this.usesExposureAdaptation && !previous.includes('exposure-adaptation')) this.exposure?.reset();
    this.resize(this.width, this.height, this.pixelRatio);
  }

  restore() {
    if (this.disposed) return;
    this.renderer.resetState();
    this.disposePostProcessing();
    this.applyRendererQuality();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.disposePostProcessing();
  }

  private applyRendererQuality() {
    const profile = getToneMappingProfile('day');
    this.renderer.outputColorSpace = profile.outputColorSpace;
    this.renderer.toneMapping = profile.toneMapping;
    this.renderer.toneMappingExposure = profile.exposure;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  private renderPostProcessed(scene: THREE.Scene, camera: THREE.Camera, exposure: number) {
    const renderer = this.renderer;
    const targets = this.ensureTargets();
    const now = performance.now();
    const delta = this.lastFrameAt === null ? 0 : Math.min((now - this.lastFrameAt) / 1000, MAXIMUM_FRAME_SECONDS);
    this.lastFrameAt = now;
    const previousTarget = renderer.getRenderTarget();

    // 畫進浮點貼圖時 three.js 不做色調映射與 sRGB 轉換，材質輸出的就是線性亮度。
    renderer.setRenderTarget(targets.scene);
    if (!this.sceneRenderer?.(scene, camera)) renderer.render(scene, camera);

    let adaptation: THREE.Texture | null = null;
    if (this.usesExposureAdaptation) {
      this.exposure ??= new ExposureAdaptation();
      this.exposure.update(renderer, targets.scene.texture, delta);
      adaptation = this.exposure.texture;
    }
    const occlusionOn = this.usesAmbientOcclusion && targets.scene.depthTexture !== null;
    const gradeOptions = { occlusion: occlusionOn, adaptation: adaptation !== null };
    this.grade ??= new FrameGrade(gradeOptions);
    this.grade.setOptions(gradeOptions);
    this.grade.prepare(scene, camera);
    let occlusion: THREE.Texture | null = null;
    if (occlusionOn) {
      if (!this.occlusion) {
        this.occlusion = new ScreenSpaceOcclusion();
        this.occlusion.setSize(targets.scene.width, targets.scene.height);
      }
      occlusion = this.occlusion.render(renderer, targets.scene.depthTexture!, camera, this.grade.towardSun);
    }
    this.grade.render(renderer, {
      scene,
      camera,
      color: targets.scene.texture,
      depth: targets.scene.depthTexture,
      occlusion,
      adaptation,
      exposure,
      width: targets.scene.width,
      height: targets.scene.height,
    }, targets.graded);

    if (this.usesBloom) {
      if (!this.bloom) {
        this.bloom = new UnrealBloomPass(
          new THREE.Vector2(targets.graded.width, targets.graded.height),
          BLOOM.strength,
          BLOOM.radius,
          BLOOM.threshold,
        );
        (this.bloom.highPassUniforms as Record<string, THREE.IUniform<number>>).smoothWidth!.value = BLOOM.softness;
      }
      // 暈光疊加回同一張貼圖。
      this.bloom.render(renderer, targets.graded, targets.graded, delta, false);
    }

    // 曝光已經乘進去了：色調映射用 1，算法與材質內的色調映射相同（ACES，含 three.js 的 ÷ 0.6）。
    this.output ??= new OutputPass();
    this.output.renderToScreen = previousTarget === null;
    renderer.toneMappingExposure = 1;
    this.output.render(renderer, previousTarget as THREE.WebGLRenderTarget, targets.graded, delta, false);
    renderer.toneMappingExposure = exposure;
    renderer.setRenderTarget(previousTarget);
  }

  private ensureTargets(): PostProcessingTargets {
    if (this.targets) return this.targets;
    const { x: width, y: height } = this.renderer.getDrawingBufferSize(this.bufferSize);
    const maximumSamples = this.renderer.capabilities?.maxSamples ?? MULTISAMPLE_SAMPLES;
    const depthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
    depthTexture.name = 'realistic:frame-depth';
    const scene = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: Math.min(MULTISAMPLE_SAMPLES, maximumSamples),
      depthTexture,
      stencilBuffer: false,
    });
    scene.texture.name = 'realistic:frame-scene';
    const graded = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    graded.texture.name = 'realistic:frame-graded';
    this.targets = { scene, graded };
    this.exposure?.reset();
    return this.targets;
  }

  private resizeTargets() {
    if (!this.targets) return;
    const { x: width, y: height } = this.renderer.getDrawingBufferSize(this.bufferSize);
    if (this.targets.scene.width === width && this.targets.scene.height === height) return;
    this.targets.scene.setSize(width, height);
    this.targets.graded.setSize(width, height);
    this.occlusion?.setSize(width, height);
    this.bloom?.setSize(width, height);
  }

  private disposeOcclusion() {
    this.occlusion?.dispose();
    this.occlusion = null;
  }

  private disposeBloom() {
    this.bloom?.dispose();
    this.bloom = null;
  }

  private disposePostProcessing() {
    this.disposeOcclusion();
    this.disposeBloom();
    this.exposure?.dispose();
    this.grade?.dispose();
    this.output?.dispose();
    this.targets?.scene.depthTexture?.dispose();
    this.targets?.scene.dispose();
    this.targets?.graded.dispose();
    this.exposure = null;
    this.grade = null;
    this.output = null;
    this.targets = null;
    this.lastFrameAt = null;
  }
}
