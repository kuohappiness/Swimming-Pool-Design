import type { CollisionWorld } from '../collision/collision-world.js';
import type { SafeSpawnRegistry } from '../collision/safe-spawn-registry.js';
import type { WaterVolume } from '../environment/water-volume.js';
import type {
  MovementStrategy,
  PlayerState,
} from '../player-controller.js';
import type {
  MovementIntent,
  WalkthroughConfig,
} from '../types.js';
import type { WalkMovement } from './walk-movement.js';

const SURFACE_EYE_OFFSET = 0.12;
const BOTTOM_EYE_CLEARANCE = 0.42;

function isSwimming(state: PlayerState) {
  return state.movementMode === 'swimming-surface'
    || state.movementMode === 'swimming-underwater';
}

function clearVelocity(state: PlayerState) {
  state.velocity.x = 0;
  state.velocity.y = 0;
  state.velocity.z = 0;
}

export class SwimMovement implements MovementStrategy {
  readonly id = 'walk-swim-task-056';
  private readonly walking: WalkMovement;
  private readonly world: CollisionWorld;
  private readonly water: WaterVolume;
  private readonly safeSpawns: SafeSpawnRegistry;
  private readonly config: WalkthroughConfig;

  constructor(
    walking: WalkMovement,
    world: CollisionWorld,
    water: WaterVolume,
    safeSpawns: SafeSpawnRegistry,
    config: WalkthroughConfig,
  ) {
    this.walking = walking;
    this.world = world;
    this.water = water;
    this.safeSpawns = safeSpawns;
    this.config = config;
  }

  returnToPoolside(state: PlayerState) {
    const spawn = this.safeSpawns.get('l1-pool-deck');
    if (!this.world.isCapsuleClear(spawn.position) || !this.world.isSupported(spawn.position)) return false;
    state.position = { ...spawn.position };
    state.movementMode = 'teleporting';
    state.grounded = true;
    clearVelocity(state);
    return true;
  }

  step(state: PlayerState, intent: MovementIntent, deltaSeconds: number) {
    if (!isSwimming(state)) {
      this.walking.step(state, intent, deltaSeconds);
      const waterline = this.water.stateAt(
        state.position,
        this.config.player.eyeHeight,
        this.config.swimming.waterlineHysteresis,
      );
      if (waterline.bodySubmerged) {
        state.movementMode = waterline.eyeSubmerged
          ? 'swimming-underwater'
          : 'swimming-surface';
        state.grounded = false;
        state.velocity.y = 0;
      }
      return;
    }

    if (!this.water.containsHorizontal(state.position)) {
      state.movementMode = 'falling';
      state.grounded = false;
      this.walking.step(state, intent, deltaSeconds);
      return;
    }

    if (intent.ascend > 0.5) {
      const climbTarget = this.water.assistedClimbTarget(
        state.position,
        this.config.player.eyeHeight,
        this.config.player.capsuleRadius,
      );
      if (climbTarget && this.world.isCapsuleClear(climbTarget) && this.world.isSupported(climbTarget)) {
        state.position = climbTarget;
        state.movementMode = 'walking';
        state.grounded = true;
        clearVelocity(state);
        return;
      }
    }

    const speed = state.movementMode === 'swimming-underwater'
      ? this.config.swimming.underwaterSwimSpeed
      : this.config.swimming.surfaceSwimSpeed;
    const cosine = Math.cos(state.yaw);
    const sine = Math.sin(state.yaw);
    state.velocity.x = (intent.moveX * cosine + intent.moveZ * sine) * speed;
    state.velocity.z = (-intent.moveX * sine + intent.moveZ * cosine) * speed;
    const horizontal = this.world.resolveCapsule({
      x: state.position.x + state.velocity.x * deltaSeconds,
      y: state.position.y,
      z: state.position.z + state.velocity.z * deltaSeconds,
    });
    if (horizontal.unresolved) {
      this.walking.recoverToNearest(state);
      return;
    }
    state.position.x = horizontal.position.x;
    state.position.z = horizontal.position.z;

    const surface = this.water.surfaceWorldElevation;
    const hysteresis = this.config.swimming.waterlineHysteresis;
    if (state.movementMode === 'swimming-surface') {
      if (intent.descend > 0.25) {
        state.movementMode = 'swimming-underwater';
        state.velocity.y = -this.config.swimming.verticalSwimSpeed * 0.6;
      } else {
        const target = surface + SURFACE_EYE_OFFSET;
        state.velocity.y += (target - state.position.y) * 7 * deltaSeconds;
        state.velocity.y *= Math.exp(-4.5 * deltaSeconds);
        state.position.y += state.velocity.y * deltaSeconds;
        if (state.position.y < surface - hysteresis) {
          state.movementMode = 'swimming-underwater';
        }
      }
    }

    if (state.movementMode === 'swimming-underwater') {
      const verticalIntent = Math.max(-1, Math.min(1, intent.ascend - intent.descend));
      const targetVelocity = verticalIntent * this.config.swimming.verticalSwimSpeed;
      state.velocity.y += (targetVelocity - state.velocity.y)
        * Math.min(1, deltaSeconds * 4.5);
      state.position.y += state.velocity.y * deltaSeconds;
      const bottom = this.water.bottomWorldElevation(state.position) + BOTTOM_EYE_CLEARANCE;
      if (state.position.y < bottom) {
        state.position.y = bottom;
        state.velocity.y = Math.max(0, state.velocity.y);
      }
      if (state.position.y >= surface + hysteresis && intent.descend <= 0) {
        state.position.y = surface + SURFACE_EYE_OFFSET;
        state.velocity.y = 0;
        state.movementMode = 'swimming-surface';
      }
    }
    state.grounded = false;
  }
}
