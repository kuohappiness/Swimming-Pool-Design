import type { MovementIntent, MovementMode, WalkthroughConfig } from './types.js';

export interface PlayerVector {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  position: PlayerVector;
  velocity: PlayerVector;
  yaw: number;
  pitch: number;
  grounded: boolean;
  movementMode: MovementMode;
}

export interface MovementStrategy {
  readonly id: string;
  step(state: PlayerState, intent: MovementIntent, deltaSeconds: number): void;
}

export const STATIONARY_MOVEMENT_STRATEGY: MovementStrategy = Object.freeze({
  id: 'stationary-task-054',
  step() {},
});

export class PlayerController {
  readonly state: PlayerState = {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    grounded: false,
    movementMode: 'walking',
  };
  private readonly config: WalkthroughConfig;
  private movementStrategy: MovementStrategy;

  constructor(
    config: WalkthroughConfig,
    movementStrategy: MovementStrategy = STATIONARY_MOVEMENT_STRATEGY,
  ) {
    this.config = config;
    this.movementStrategy = movementStrategy;
  }

  setMovementStrategy(strategy: MovementStrategy) {
    this.movementStrategy = strategy;
  }

  setPose(position: PlayerVector, yaw = 0, pitch = 0) {
    this.state.position = { ...position };
    this.state.velocity = { x: 0, y: 0, z: 0 };
    this.state.yaw = yaw;
    this.state.pitch = this.clampPitch(pitch);
    this.state.grounded = false;
    this.state.movementMode = 'walking';
  }

  step(intent: MovementIntent, deltaSeconds: number) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this.state.yaw += intent.lookYaw;
    this.state.pitch = this.clampPitch(this.state.pitch + intent.lookPitch);
    this.movementStrategy.step(this.state, intent, deltaSeconds);
  }

  private clampPitch(pitch: number) {
    const limit = this.config.player.maxPitchDegrees * Math.PI / 180;
    return Math.max(-limit, Math.min(limit, pitch));
  }
}
