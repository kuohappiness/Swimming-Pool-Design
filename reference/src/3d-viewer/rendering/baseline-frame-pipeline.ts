import * as THREE from 'three';
import type { FrameEffectPipeline } from './contracts';
import { assertRenderQualityProfile, type RenderQualityProfile } from './quality-profile';

export class BaselineFrameEffectPipeline implements FrameEffectPipeline {
  readonly id = 'baseline-frame-pipeline';
  private quality: RenderQualityProfile;
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    initialQuality: RenderQualityProfile,
  ) {
    this.quality = assertRenderQualityProfile(initialQuality);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.applyQuality();
  }

  resize(width: number, height: number, pixelRatio: number) {
    if (this.disposed) return;
    this.renderer.setPixelRatio(Math.min(pixelRatio, this.quality.pixelRatioCap));
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (!this.disposed) this.renderer.render(scene, camera);
  }

  setQuality(profile: RenderQualityProfile) {
    this.quality = assertRenderQualityProfile(profile);
    this.applyQuality();
  }

  restore() {
    if (this.disposed) return;
    this.renderer.resetState();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.applyQuality();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
  }

  private applyQuality() {
    this.renderer.shadowMap.enabled = this.quality.shadows;
    // Three r185 maps the deprecated PCFSoftShadowMap to PCFShadowMap.
    // Use the effective implementation directly to keep the baseline image
    // stable without emitting a warning on every Viewer load.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }
}
