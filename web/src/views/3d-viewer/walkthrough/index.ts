export { adaptWalkthroughSource, deepFreezeWalkthroughData } from './adapters/viewer-model-adapter.js';
export {
  SafeSpawnAreaRegistry,
  type AreaRegistry,
  type WalkthroughArea,
} from './area-registry.js';
export { CameraModeManager } from './camera-mode-manager.js';
export { createCollisionProxies } from './collision/collision-proxies.js';
export { CollisionWorld } from './collision/collision-world.js';
export { SafeSpawnRegistry } from './collision/safe-spawn-registry.js';
export { FixedStepLoop } from './fixed-step-loop.js';
export { UnderwaterEffects } from './environment/underwater-effects.js';
export { WaterVolume } from './environment/water-volume.js';
export { DesktopInput } from './input/desktop-input.js';
export type { InputAdapter } from './input/input-adapter.js';
export { TouchInput } from './input/touch-input.js';
export {
  PlayerController,
  STATIONARY_MOVEMENT_STRATEGY,
} from './player-controller.js';
export { WalkMovement } from './movement/walk-movement.js';
export { SwimMovement } from './movement/swim-movement.js';
export {
  AdaptiveFrameTimeMonitor,
  adaptRenderQualityProfile,
  getWalkthroughCapabilityProfile,
  type AdaptiveFrameTimeOptions,
  type FrameTimeStatistics,
  type WalkthroughCapabilityProfile,
} from './performance-profile.js';
export type {
  MovementStrategy,
  PlayerState,
  PlayerVector,
} from './player-controller.js';
export { WALKTHROUGH_CONFIG } from './walkthrough-config.js';
export type {
  CollisionDescriptor,
  DeepReadonly,
  MovementIntent,
  MovementMode,
  OpeningDescriptor,
  PlanTransform,
  PoolShellDescriptor,
  ReadonlyViewerModel,
  SiteBounds,
  SitePoint,
  SpawnDescriptor,
  StairRampDescriptor,
  WalkSurfaceDescriptor,
  WalkthroughCapabilities,
  WalkthroughConfig,
  WalkthroughEntityDescriptor,
  WalkthroughIdentity,
  WalkthroughReferenceFrame,
  WalkthroughSource,
  WaterVolumeDescriptor,
} from './types.js';
