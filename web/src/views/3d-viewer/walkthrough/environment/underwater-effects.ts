import * as THREE from 'three';
import type { MovementMode } from '../types.js';

export interface UnderwaterAudioHook {
  setUnderwater(active: boolean): void | Promise<void>;
}

export interface UnderwaterEffectsOptions {
  readonly quality: 'high' | 'low';
  readonly reducedMotion: boolean;
  readonly audio?: UnderwaterAudioHook;
}

function swimming(mode: MovementMode) {
  return mode === 'swimming-surface' || mode === 'swimming-underwater';
}

export class UnderwaterEffects {
  readonly id = 'walkthrough-underwater-effects';
  private readonly shell: HTMLElement;
  private readonly scene: THREE.Scene;
  private readonly options: UnderwaterEffectsOptions;
  private quality: UnderwaterEffectsOptions['quality'];
  private previousFog: THREE.Fog | THREE.FogExp2 | null = null;
  private underwater = false;
  private disposed = false;

  constructor(
    shell: HTMLElement,
    scene: THREE.Scene,
    options: UnderwaterEffectsOptions,
  ) {
    this.shell = shell;
    this.scene = scene;
    this.options = options;
    this.quality = options.quality;
    this.shell.dataset.underwaterQuality = options.quality;
    this.shell.dataset.underwaterReducedMotion = String(options.reducedMotion);
  }

  update(mode: MovementMode) {
    if (this.disposed) return;
    const nextUnderwater = mode === 'swimming-underwater';
    this.shell.dataset.waterMode = swimming(mode) ? mode : 'dry';
    this.shell.dataset.underwater = String(nextUnderwater);
    if (nextUnderwater === this.underwater) return;
    this.underwater = nextUnderwater;
    if (nextUnderwater) {
      this.previousFog = this.scene.fog;
      this.scene.fog = new THREE.FogExp2(
        this.quality === 'high' ? 0x236f82 : 0x2f7785,
        this.quality === 'high' ? 0.075 : 0.048,
      );
    } else {
      this.scene.fog = this.previousFog;
      this.previousFog = null;
    }
    try {
      void Promise.resolve(this.options.audio?.setUnderwater(nextUnderwater)).catch(() => {});
    } catch {
      // Audio permission or device failure never blocks swimming.
    }
  }

  setQuality(quality: UnderwaterEffectsOptions['quality']) {
    if (this.disposed || this.quality === quality) return;
    this.quality = quality;
    this.shell.dataset.underwaterQuality = quality;
    if (this.underwater) {
      this.scene.fog = new THREE.FogExp2(
        quality === 'high' ? 0x236f82 : 0x2f7785,
        quality === 'high' ? 0.075 : 0.048,
      );
    }
  }

  dispose() {
    if (this.disposed) return;
    if (this.underwater) this.scene.fog = this.previousFog;
    this.disposed = true;
    this.previousFog = null;
    this.underwater = false;
    delete this.shell.dataset.underwater;
    delete this.shell.dataset.waterMode;
  }
}
