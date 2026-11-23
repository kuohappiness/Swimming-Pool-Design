import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import adaptationFragment from './shaders/exposure-adaptation.frag.glsl?raw';
import meterFragment from './shaders/exposure-meter.frag.glsl?raw';
import fullscreenVertex from './shaders/fullscreen.vert.glsl?raw';

/**
 * 依畫面亮度的曝光適應（TASK-152 步驟 6）：從室外走進室內、從亮處看向暗處時，曝光跟著慢慢
 * 調整，像眼睛一樣。測光在顯示卡上做，結果不讀回 CPU。
 *
 * 基準曝光（時刻與天氣，`lighting.exposure`）照舊；這裡只看畫面平均亮度和這一刻水平面照度的比值
 *（`FrameGrade.horizontalIlluminance`），比一般的畫面暗或亮幾格，就在基準上補一部分：
 * 補的格數 = 比例 ×（目標 −（畫面平均亮度的對數 − 照度的對數）），最多補 `rangeStops` 格。
 * 雨天、黃昏整體較暗是光線弱，比值和晴天差不多，不會被拉亮。
 */
export const EXPOSURE_ADAPTATION = Object.freeze({
  /** 測光圖的大小；最小一層（1×1）是整個畫面的加權平均。 */
  meterWidth: 128,
  meterHeight: 64,
  /** 往亮處適應的時間常數（秒）：瞳孔縮小很快。 */
  brightenSeconds: 0.5,
  /** 往暗處適應的時間常數（秒）：眼睛要比較久才看清暗處。 */
  darkenSeconds: 1.6,
  /** 補回差距的比例：不補滿，暗的地方看起來仍然比較暗。 */
  strength: 0.6,
  /** 最多調整幾格曝光（EV）。 */
  rangeStops: 1.5,
  /**
   * 目標：畫面平均亮度（幾何平均）÷ 水平面照度的對數。取白天各種天氣的一般畫面（晴天正午總覽、
   * 晴天池畔、陰天總覽、雨天池畔、黃昏池畔、水下）量到的平均，這些畫面都在 ±0.15 格內（任務說明）。
   */
  targetLog2: -2.73,
});

/** 這一格往目標靠近的比例：1 − exp(−Δt ÷ 時間常數)。 */
export function adaptationRate(deltaSeconds: number, timeConstantSeconds: number): number {
  if (!(timeConstantSeconds > 0)) throw new RangeError('Adaptation time constant must be positive.');
  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  return 1 - Math.exp(-delta / timeConstantSeconds);
}

/** 測光圖最小一層（1×1）的層號。 */
export function meterLevel(width: number, height: number): number {
  return Math.ceil(Math.log2(Math.max(width, height, 1)));
}

function stateTarget(): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  target.texture.name = 'realistic:exposure-adaptation';
  return target;
}

export class ExposureAdaptation {
  private readonly meter: THREE.WebGLRenderTarget;
  private readonly states: readonly [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private readonly meterMaterial: THREE.ShaderMaterial;
  private readonly adaptationMaterial: THREE.ShaderMaterial;
  private readonly quad = new FullScreenQuad();
  private current = 0;
  private resetPending = true;
  private disposed = false;

  constructor() {
    const { meterWidth, meterHeight } = EXPOSURE_ADAPTATION;
    this.meter = new THREE.WebGLRenderTarget(meterWidth, meterHeight, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.meter.texture.name = 'realistic:exposure-meter';
    this.states = [stateTarget(), stateTarget()];
    this.meterMaterial = new THREE.ShaderMaterial({
      name: 'realistic:exposure-meter',
      vertexShader: fullscreenVertex,
      fragmentShader: meterFragment,
      uniforms: {
        tScene: { value: null },
        // 一格的寬是 1 ÷ 測光圖寬，格內 4×4 個取樣點平均分布。
        uSpacing: { value: new THREE.Vector2(1 / meterWidth / 4, 1 / meterHeight / 4) },
      },
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.adaptationMaterial = new THREE.ShaderMaterial({
      name: 'realistic:exposure-adaptation',
      vertexShader: fullscreenVertex,
      fragmentShader: adaptationFragment,
      uniforms: {
        tMeter: { value: this.meter.texture },
        tPrevious: { value: null },
        uMeterLevel: { value: meterLevel(meterWidth, meterHeight) },
        uBrighten: { value: 1 },
        uDarken: { value: 1 },
        uReset: { value: 1 },
      },
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
  }

  /** 適應到的平均對數亮度（1×1，r）。 */
  get texture(): THREE.Texture {
    return this.states[this.current].texture;
  }

  /** 下一格直接用測到的值，不慢慢靠近（第一格、換場景、畫質切換之後）。 */
  reset(): void {
    this.resetPending = true;
  }

  update(renderer: THREE.WebGLRenderer, scene: THREE.Texture, deltaSeconds: number): void {
    if (this.disposed) return;
    this.meterMaterial.uniforms.tScene.value = scene;
    renderer.setRenderTarget(this.meter);
    this.quad.material = this.meterMaterial;
    this.quad.render(renderer);

    const next = 1 - this.current;
    const uniforms = this.adaptationMaterial.uniforms;
    uniforms.tPrevious.value = this.states[this.current].texture;
    uniforms.uBrighten.value = adaptationRate(deltaSeconds, EXPOSURE_ADAPTATION.brightenSeconds);
    uniforms.uDarken.value = adaptationRate(deltaSeconds, EXPOSURE_ADAPTATION.darkenSeconds);
    uniforms.uReset.value = this.resetPending ? 1 : 0;
    renderer.setRenderTarget(this.states[next]);
    this.quad.material = this.adaptationMaterial;
    this.quad.render(renderer);
    this.current = next;
    this.resetPending = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.meter.dispose();
    for (const state of this.states) state.dispose();
    this.meterMaterial.dispose();
    this.adaptationMaterial.dispose();
    this.quad.dispose();
  }
}
