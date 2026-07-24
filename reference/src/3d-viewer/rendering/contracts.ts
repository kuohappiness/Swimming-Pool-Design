import type * as THREE from 'three';
import type { EnvironmentId } from '../scenes';
import type { MovementMode } from '../walkthrough/types';
import type { RenderQualityProfile } from './quality-profile';

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
  | 'cubicle'
  | 'cubicle-door'
  | 'pool-deck'
  | 'lane-line'
  | 'lane-float-light'
  | 'lane-float-red'
  | 'pool-rail'
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

export interface VisualAssetAdapter {
  readonly id: string;
  attach(context: VisualAssetContext): void;
  setQuality(profile: RenderQualityProfile): void;
  setWalkthroughState?(state: VisualWalkthroughState): void;
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
