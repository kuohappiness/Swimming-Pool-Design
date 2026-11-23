import * as THREE from 'three';
import type { MovementMode } from '../types.js';

export interface UnderwaterAudioHook {
  setUnderwater(active: boolean): void | Promise<void>;
}

export interface UnderwaterEffectsOptions {
  readonly quality: 'high' | 'low';
  readonly reducedMotion: boolean;
  readonly audio?: UnderwaterAudioHook;
  /**
   * 回傳 true 代表水下的水色已經由繪圖端處理（寫實水面的水下畫面，依鏡頭位置判斷），
   * 這裡就不替場景加霧，免得水色疊兩層。
   */
  readonly waterColorHandled?: () => boolean;
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
  private fogApplied = false;
  private disposed = false;

  constructor(shell: HTMLElement, scene: THREE.Scene, options: UnderwaterEffectsOptions) {
    this.shell = shell;
    this.scene = scene;
    this.options = options;
    this.quality = options.quality;
    this.shell.dataset.underwaterQuality = options.quality;
    this.shell.dataset.underwaterReducedMotion = String(options.reducedMotion);
    this.shell.dataset.underwaterFog = 'false';
  }

  /**
   * @param eyeSubmerged 鏡頭是否真的在水面下。移動狀態有遲滯（剛下潛或剛浮出時狀態和畫面差一點），
   *   水色霧要跟著鏡頭，不然頭已經出水了整個池廳還罩著一層水色。沒給時退回用移動狀態判斷。
   */
  update(mode: MovementMode, eyeSubmerged?: boolean) {
    if (this.disposed) return;
    const nextUnderwater = mode === 'swimming-underwater';
    this.shell.dataset.waterMode = swimming(mode) ? mode : 'dry';
    this.shell.dataset.underwater = String(nextUnderwater);
    // 水色由繪圖端處理與否可能在潛水途中改變（寫實水面晚一點才載入、畫質被調降），每次都對一次。
    this.syncFog((eyeSubmerged ?? nextUnderwater) && !this.options.waterColorHandled?.());
    if (nextUnderwater === this.underwater) return;
    this.underwater = nextUnderwater;
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
    if (this.fogApplied) this.scene.fog = this.createFog();
  }

  dispose() {
    if (this.disposed) return;
    this.syncFog(false);
    this.disposed = true;
    this.previousFog = null;
    this.underwater = false;
    delete this.shell.dataset.underwater;
    delete this.shell.dataset.waterMode;
    delete this.shell.dataset.underwaterFog;
  }

  private syncFog(wanted: boolean) {
    if (wanted === this.fogApplied) return;
    this.fogApplied = wanted;
    this.shell.dataset.underwaterFog = String(wanted);
    if (wanted) {
      this.previousFog = this.scene.fog;
      this.scene.fog = this.createFog();
    } else {
      this.scene.fog = this.previousFog;
      this.previousFog = null;
    }
  }

  private createFog() {
    return new THREE.FogExp2(
      this.quality === 'high' ? 0x236f82 : 0x2f7785,
      this.quality === 'high' ? 0.075 : 0.048,
    );
  }
}
