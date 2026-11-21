import type { FixedStepLoop, FixedStepResult } from './fixed-step-loop.js';
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

  /**
   * Applies view rotation once per rendered frame. Looking is not physics, so it
   * must not wait for a fixed step: on displays faster than the step rate some
   * frames run no step at all, and their mouse movement would be lost.
   */
  look(yaw: number, pitch: number) {
    if (Number.isFinite(yaw)) this.state.yaw += yaw;
    if (Number.isFinite(pitch)) this.state.pitch = this.clampPitch(this.state.pitch + pitch);
  }

  /** Advances movement by one fixed step. View rotation goes through {@link look}. */
  step(intent: MovementIntent, deltaSeconds: number) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this.movementStrategy.step(this.state, intent, deltaSeconds);
  }

  private clampPitch(pitch: number) {
    const limit = this.config.player.maxPitchDegrees * Math.PI / 180;
    return Math.max(-limit, Math.min(limit, pitch));
  }
}

/**
 * One rendered frame of walkthrough input: the view turns every frame, movement
 * advances in fixed steps. Keeping them apart means no mouse movement is lost on
 * a frame that happens to run zero physics steps.
 */
export function advancePlayerFrame(
  player: PlayerController,
  loop: FixedStepLoop,
  intent: MovementIntent,
  frameDeltaSeconds: number,
): FixedStepResult {
  player.look(intent.lookYaw, intent.lookPitch);
  return loop.advance(frameDeltaSeconds, (stepSeconds) => player.step(intent, stepSeconds));
}
