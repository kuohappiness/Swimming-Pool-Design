import type * as THREE from 'three';
import type { EnvironmentId } from '../scenes';
import type { MovementMode } from '../walkthrough/types';
import type { SceneLighting } from './lighting/scene-lighting';
import type { RenderQualityProfile } from './quality-profile';

/** 場景裡鏡牆鏡面的網格名稱：場景建立它，rendering 換上它的倒影（`enhanced/mirror-reflection.ts`）。 */
export const MIRROR_SURFACE_NAME = 'F-MIR-01-SURFACE';

/** 鏡面網格 `userData` 裡反光那一面的法線（網格的物件座標，`[x, y, z]`）。 */
export const MIRROR_FRONT_NORMAL_KEY = 'mirrorFrontNormal';

export type SemanticMaterialId =
  | 'ground'
  | 'planting'
  | 'exposed-concrete-l1'
  | 'exposed-concrete-l2'
  | 'exposed-concrete-l3'
  | 'service-overlay'
  | 'structural-steel'
  | 'deferred'
  | 'roof-glass'
  | 'safety-glass'
  | 'water'
  | 'pool-basin'
  | 'mirror'
  | 'site-boundary'
  | 'program-zone'
  | 'equipment-zone'
  | 'opening-marker'
  | 'sanitary-fixture'
  | 'sanitary-metal'
  | 'sanitary-seat'
  | 'sanitary-dark'
  | 'wet-surface'
  | 'interior-tile'
  | 'interior-grout'
  | 'interior-light'
  | 'signage'
  | 'cubicle'
  | 'cubicle-door'
  | 'pool-deck'
  | 'lane-line'
  | 'lane-float-light'
  | 'lane-float-red'
  | 'pool-rail'
  | 'pool-caustic'
  | 'l2-circulation'
  | 'l2-stair-zone'
  | 'glass-edge'
  | 'shower-partition'
  | 'interior-fixture'
  | 'locker'
  | 'l3-extension'
  | 'l3-arrival'
  | 'terrace'
  | 'planter'
  | 'equipment'
  | 'roof-grid'
  | 'canopy-frame'
  | 'photovoltaic'
  | 'photovoltaic-grid'
  | 'rain'
  | 'rain-path'
  | 'west-rain-path'
  | 'cutaway-water'
  | 'cutaway-depth'
  | 'cutaway-guide'
  | 'cutaway-waterline';

export interface MaterialRegistry {
  readonly id: string;
  readonly semanticIds: readonly SemanticMaterialId[];
  get(id: SemanticMaterialId): THREE.Material;
  setQuality(profile: RenderQualityProfile): void;
  dispose(): void;
}

export interface EnvironmentTarget {
  scene: THREE.Scene;
  lights: {
    sun: THREE.DirectionalLight;
    ambient: THREE.HemisphereLight;
  };
}

export interface EnvironmentEffect {
  readonly id: string;
  readonly diagnostic?: string | null;
  apply(environment: EnvironmentId, target: EnvironmentTarget): void;
  /**
   * 以算出來的光（太陽位置、顏色、天光、霧與曝光）蓋過 `apply` 寫入的固定數值。
   * 沒有實作的環境（診斷用的基準繪圖）維持 `apply` 的固定光線，時刻控制也就不出現。
   */
  applyLighting?(lighting: SceneLighting, target: EnvironmentTarget): void;
  /**
   * 依目前的天空重新產生倒影與間接光用的環境貼圖；有重新產生就回傳 true。
   * 這一步比其他更新貴，呼叫端在光線停止變化之後才呼叫。
   */
  refreshEnvironment?(): boolean;
  /** 距離柔化的陰影過濾有沒有裝進著色器；沒有時陰影一律用固定半徑。 */
  setSoftShadows?(available: boolean): void;
  /** 診斷用：倒影與間接光目前的來源。 */
  readonly environmentSource?: 'sky' | 'fixed' | 'none';
  setQuality(profile: RenderQualityProfile): void;
  dispose(): void;
}

export interface FrameEffectPipeline {
  readonly id: string;
  resize(width: number, height: number, pixelRatio: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setQuality(profile: RenderQualityProfile): void;
  restore(): void;
  dispose(): void;
}

export interface VisualAssetContext {
  scene: THREE.Scene;
  worldRoot: THREE.Group;
  siteRoot: THREE.Group;
  layerGroups: ReadonlyMap<string, THREE.Group>;
}

export interface VisualWalkthroughState {
  readonly movementMode: MovementMode;
  readonly waterSurfaceElevation: number;
  readonly poolCutaway: boolean;
}

export interface VisualFrameState {
  readonly deltaSeconds: number;
  readonly elapsedSeconds: number;
  readonly reducedMotion: boolean;
  readonly camera: THREE.Camera;
}

export interface VisualAssetAdapter {
  readonly id: string;
  attach(context: VisualAssetContext): void;
  setQuality(profile: RenderQualityProfile): void;
  setWalkthroughState?(state: VisualWalkthroughState): void;
  updateFrame?(state: VisualFrameState): void;
  /**
   * 這個畫面改由它畫（鏡頭在水裡時的水下畫面）。有畫就回傳 true；回傳 false 時由繪圖管線照常畫。
   */
  renderFrame?(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): boolean;
  /** 鏡頭在水下時的水色是否由 `renderFrame` 處理；是的話，漫遊不必再替場景加水下霧。 */
  readonly handlesUnderwaterView?: boolean;
  /** 診斷用：上一個畫面是不是水下畫面。 */
  readonly underwaterViewActive?: boolean;
  /** 診斷用：水面倒影目前的來源。 */
  readonly waterReflection?: 'planar' | 'probe' | 'none';
  /** 鏡牆鏡面的倒影來源：反射探針照出場景，或只有環境貼圖。 */
  readonly mirrorReflection?: 'probe' | 'environment';
  /** 池廳裡的構件照出池館本身（`probe`）或只照環境貼圖（`environment`）。 */
  readonly hallReflection?: 'probe' | 'environment';
  /** 光線、天候或可見物件改變後呼叫，讓事先拍好的倒影等資料重新產生。 */
  invalidateLighting?(): void;
  dispose(): void;
}

export interface SceneRenderingDependencies {
  materials: MaterialRegistry;
  visualAssets: VisualAssetAdapter;
}

export interface ViewerRenderingRuntime extends SceneRenderingDependencies {
  quality: RenderQualityProfile;
  environment: EnvironmentEffect;
  framePipeline: FrameEffectPipeline;
  setQuality(profile: RenderQualityProfile): void;
  dispose(): void;
}
