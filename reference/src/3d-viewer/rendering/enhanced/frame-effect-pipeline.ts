import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import type { FrameEffectPipeline } from '../contracts';
import {
  assertRenderQualityProfile,
  type RenderQualityProfile,
} from '../quality-profile';
import { getToneMappingProfile } from './tone-mapping';

export class EnhancedFrameEffectPipeline implements FrameEffectPipeline {
  readonly id = 'enhanced-frame-effects';
  private readonly renderer: THREE.WebGLRenderer;
  private quality: RenderQualityProfile;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private ssaoPass: SSAOPass | null = null;
  private outputPass: OutputPass | null = null;
  private activeScene: THREE.Scene | null = null;
  private activeCamera: THREE.Camera | null = null;
  private disposed = false;
  private readonly ambientOcclusionResolutionScale = 0.5;

  constructor(renderer: THREE.WebGLRenderer, initialQuality: RenderQualityProfile) {
    this.renderer = renderer;
    this.quality = assertRenderQualityProfile(initialQuality);
    this.applyRendererQuality();
  }

  get usesAmbientOcclusion() {
    return Boolean(this.quality.ambientOcclusion && this.quality.postProcessing);
  }

  resize(width: number, height: number, pixelRatio: number) {
    if (this.disposed) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.pixelRatio = Math.min(Math.max(1, pixelRatio), this.quality.pixelRatioCap);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer?.setPixelRatio(this.pixelRatio);
    this.composer?.setSize(this.width, this.height);
    this.resizeAmbientOcclusionTargets();
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.disposed) return;
    const environmentId = scene.userData.environmentId ?? 'day';
    const toneMapping = getToneMappingProfile(environmentId);
    this.renderer.toneMappingExposure = scene.userData.toneMappingExposure ?? toneMapping.exposure;
    if (this.usesAmbientOcclusion) {
      this.ensureComposer(scene, camera);
      this.composer!.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }

  setQuality(profile: RenderQualityProfile) {
    if (this.disposed) return;
    const previousAo = this.usesAmbientOcclusion;
    this.quality = assertRenderQualityProfile(profile);
    this.applyRendererQuality();
    if (previousAo !== this.usesAmbientOcclusion && !this.usesAmbientOcclusion) {
      this.disposeComposer();
    }
    this.resize(this.width, this.height, this.pixelRatio);
  }

  restore() {
    if (this.disposed) return;
    this.renderer.resetState();
    this.disposeComposer();
    this.applyRendererQuality();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeComposer();
  }

  private applyRendererQuality() {
    const profile = getToneMappingProfile('day');
    this.renderer.outputColorSpace = profile.outputColorSpace;
    this.renderer.toneMapping = profile.toneMapping;
    this.renderer.toneMappingExposure = profile.exposure;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  private ensureComposer(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.composer && this.activeScene === scene && this.activeCamera === camera) return;
    this.disposeComposer();
    this.activeScene = scene;
    this.activeCamera = camera;
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);
    this.renderPass = new RenderPass(scene, camera);
    this.ssaoPass = new SSAOPass(scene, camera, this.width, this.height);
    this.ssaoPass.kernelRadius = 10;
    this.ssaoPass.minDistance = 0.004;
    this.ssaoPass.maxDistance = 0.13;
    this.ssaoPass.output = SSAOPass.OUTPUT.Default;
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.ssaoPass);
    this.composer.addPass(this.outputPass);
    this.resizeAmbientOcclusionTargets();
  }

  private resizeAmbientOcclusionTargets() {
    if (!this.ssaoPass) return;
    this.ssaoPass.setSize(
      Math.max(1, Math.round(this.width * this.ambientOcclusionResolutionScale)),
      Math.max(1, Math.round(this.height * this.ambientOcclusionResolutionScale)),
    );
  }

  private disposeComposer() {
    this.ssaoPass?.dispose();
    this.renderPass?.dispose();
    this.outputPass?.dispose();
    this.composer?.dispose();
    this.ssaoPass = null;
    this.renderPass = null;
    this.outputPass = null;
    this.composer = null;
    this.activeScene = null;
    this.activeCamera = null;
  }
}
