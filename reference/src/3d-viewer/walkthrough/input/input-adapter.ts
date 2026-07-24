import type { MovementIntent } from '../types.js';

export interface InputAdapter {
  readonly id: string;
  readonly active: boolean;
  start(): void;
  stop(): void;
  readIntent(): MovementIntent;
  reset(): void;
  dispose(): void;
}

export const ZERO_MOVEMENT_INTENT: MovementIntent = Object.freeze({
  moveX: 0,
  moveZ: 0,
  lookYaw: 0,
  lookPitch: 0,
  ascend: 0,
  descend: 0,
  fast: false,
  exitRequested: false,
});

export function normalizeMovementAxis(moveX: number, moveZ: number) {
  const length = Math.hypot(moveX, moveZ);
  if (length <= 1 || length === 0) return { moveX, moveZ };
  return { moveX: moveX / length, moveZ: moveZ / length };
}

export function clampIntentAxis(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}
