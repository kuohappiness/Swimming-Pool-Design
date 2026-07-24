import type {
  MovementStrategy,
  PlayerState,
  PlayerVector,
} from '../player-controller.js';
import type {
  MovementIntent,
  SpawnDescriptor,
  WalkthroughConfig,
} from '../types.js';
import type { CollisionWorld } from '../collision/collision-world.js';
import type { SafeSpawnRegistry } from '../collision/safe-spawn-registry.js';

const STEP_UP_HEIGHT = 0.32;
const GROUND_SNAP_DISTANCE = 0.08;

function finiteVector(vector: PlayerVector) {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function clearVelocity(state: PlayerState) {
  state.velocity.x = 0;
  state.velocity.y = 0;
  state.velocity.z = 0;
}

export class WalkMovement implements MovementStrategy {
  readonly id = 'capsule-walk-task-055';
  private readonly world: CollisionWorld;
  private readonly safeSpawns: SafeSpawnRegistry;
  private readonly config: WalkthroughConfig;

  constructor(
    world: CollisionWorld,
    safeSpawns: SafeSpawnRegistry,
    config: WalkthroughConfig,
  ) {
    this.world = world;
    this.safeSpawns = safeSpawns;
    this.config = config;
  }

  teleportToSpawn(state: PlayerState, id: SpawnDescriptor['id']) {
    const spawn = this.safeSpawns.get(id);
    if (!this.world.isCapsuleClear(spawn.position) || !this.world.isSupported(spawn.position)) return false;
    state.movementMode = 'teleporting';
    state.position = { ...spawn.position };
    state.grounded = true;
    clearVelocity(state);
    return true;
  }

  recoverToNearest(state: PlayerState) {
    const reference = finiteVector(state.position)
      ? state.position
      : this.safeSpawns.get('entrance').position;
    const spawn = this.safeSpawns.nearest(reference);
    state.movementMode = 'recovering';
    state.position = { ...spawn.position };
    state.grounded = true;
    clearVelocity(state);
    return spawn;
  }

  step(state: PlayerState, intent: MovementIntent, deltaSeconds: number) {
    if (!finiteVector(state.position)
      || !finiteVector(state.velocity)
      || state.position.y < this.config.recovery.minimumWorldElevation) {
      this.recoverToNearest(state);
      return;
    }

    const speed = intent.fast
      ? this.config.player.fastWalkSpeed
      : this.config.player.walkSpeed;
    const cosine = Math.cos(state.yaw);
    const sine = Math.sin(state.yaw);
    const desiredX = (intent.moveX * cosine + intent.moveZ * sine) * speed;
    const desiredZ = (-intent.moveX * sine + intent.moveZ * cosine) * speed;
    state.velocity.x = desiredX;
    state.velocity.z = desiredZ;

    const proposedHorizontal = {
      x: state.position.x + desiredX * deltaSeconds,
      y: state.position.y,
      z: state.position.z + desiredZ * deltaSeconds,
    };
    const resolved = this.world.resolveCapsule(proposedHorizontal);
    if (resolved.unresolved) {
      this.recoverToNearest(state);
      return;
    }
    state.position.x = resolved.position.x;
    state.position.z = resolved.position.z;

    const currentFoot = state.position.y - this.config.player.eyeHeight;
    const stepLimit = state.grounded
      ? currentFoot + STEP_UP_HEIGHT
      : currentFoot + GROUND_SNAP_DISTANCE;
    const stepGround = this.world.getGroundHeight(state.position, stepLimit);
    if (state.grounded && stepGround !== null && stepGround >= currentFoot - GROUND_SNAP_DISTANCE) {
      state.position.y = stepGround + this.config.player.eyeHeight;
      state.velocity.y = 0;
      state.grounded = true;
      state.movementMode = 'walking';
      return;
    }

    state.velocity.y -= this.config.physics.gravity * deltaSeconds;
    const predictedEye = state.position.y + state.velocity.y * deltaSeconds;
    const predictedFoot = predictedEye - this.config.player.eyeHeight;
    const landing = this.world.getGroundHeight(state.position, Math.max(currentFoot, predictedFoot) + EPSILON);
    if (landing !== null && predictedFoot <= landing && state.velocity.y <= 0) {
      state.position.y = landing + this.config.player.eyeHeight;
      state.velocity.y = 0;
      state.grounded = true;
      state.movementMode = 'walking';
    } else {
      state.position.y = predictedEye;
      state.grounded = false;
      state.movementMode = 'falling';
    }
  }
}

const EPSILON = 1e-6;
