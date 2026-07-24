import type { MovementIntent } from '../types.js';
import {
  clampIntentAxis,
  normalizeMovementAxis,
  type InputAdapter,
} from './input-adapter.js';

export interface TouchInputOptions {
  moveSurface: HTMLElement;
  lookSurface: HTMLElement;
  ascendButton?: HTMLElement;
  descendButton?: HTMLElement;
  window?: Window;
  document?: Document;
  moveRadius?: number;
  lookSensitivity?: number;
}

export class TouchInput implements InputAdapter {
  readonly id = 'touch-dual-surface';
  private readonly moveSurface: HTMLElement;
  private readonly lookSurface: HTMLElement;
  private readonly ascendButton: HTMLElement | null;
  private readonly descendButton: HTMLElement | null;
  private readonly windowTarget: Window;
  private readonly documentTarget: Document;
  private readonly moveRadius: number;
  private readonly lookSensitivity: number;
  private movePointerId: number | null = null;
  private lookPointerId: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private lookPrevious = { x: 0, y: 0 };
  private moveX = 0;
  private moveZ = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private ascend = 0;
  private descend = 0;
  private started = false;
  private disposed = false;

  constructor(options: TouchInputOptions) {
    this.moveSurface = options.moveSurface;
    this.lookSurface = options.lookSurface;
    this.ascendButton = options.ascendButton ?? null;
    this.descendButton = options.descendButton ?? null;
    this.windowTarget = options.window ?? window;
    this.documentTarget = options.document ?? document;
    this.moveRadius = options.moveRadius ?? 64;
    this.lookSensitivity = options.lookSensitivity ?? 0.005;
  }

  get active() {
    return this.started;
  }

  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.moveSurface.addEventListener('pointerdown', this.onMoveStart);
    this.moveSurface.addEventListener('pointermove', this.onMove);
    this.moveSurface.addEventListener('pointerup', this.onMoveEnd);
    this.moveSurface.addEventListener('pointercancel', this.onMoveEnd);
    this.lookSurface.addEventListener('pointerdown', this.onLookStart);
    this.lookSurface.addEventListener('pointermove', this.onLook);
    this.lookSurface.addEventListener('pointerup', this.onLookEnd);
    this.lookSurface.addEventListener('pointercancel', this.onLookEnd);
    this.ascendButton?.addEventListener('pointerdown', this.onAscendStart);
    this.ascendButton?.addEventListener('pointerup', this.onAscendEnd);
    this.ascendButton?.addEventListener('pointercancel', this.onAscendEnd);
    this.descendButton?.addEventListener('pointerdown', this.onDescendStart);
    this.descendButton?.addEventListener('pointerup', this.onDescendEnd);
    this.descendButton?.addEventListener('pointercancel', this.onDescendEnd);
    this.windowTarget.addEventListener('blur', this.onReset);
    this.windowTarget.addEventListener('orientationchange', this.onReset);
    this.documentTarget.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.moveSurface.removeEventListener('pointerdown', this.onMoveStart);
    this.moveSurface.removeEventListener('pointermove', this.onMove);
    this.moveSurface.removeEventListener('pointerup', this.onMoveEnd);
    this.moveSurface.removeEventListener('pointercancel', this.onMoveEnd);
    this.lookSurface.removeEventListener('pointerdown', this.onLookStart);
    this.lookSurface.removeEventListener('pointermove', this.onLook);
    this.lookSurface.removeEventListener('pointerup', this.onLookEnd);
    this.lookSurface.removeEventListener('pointercancel', this.onLookEnd);
    this.ascendButton?.removeEventListener('pointerdown', this.onAscendStart);
    this.ascendButton?.removeEventListener('pointerup', this.onAscendEnd);
    this.ascendButton?.removeEventListener('pointercancel', this.onAscendEnd);
    this.descendButton?.removeEventListener('pointerdown', this.onDescendStart);
    this.descendButton?.removeEventListener('pointerup', this.onDescendEnd);
    this.descendButton?.removeEventListener('pointercancel', this.onDescendEnd);
    this.windowTarget.removeEventListener('blur', this.onReset);
    this.windowTarget.removeEventListener('orientationchange', this.onReset);
    this.documentTarget.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.reset();
  }

  readIntent(): MovementIntent {
    const intent: MovementIntent = {
      moveX: this.moveX,
      moveZ: this.moveZ,
      lookYaw: this.lookYaw,
      lookPitch: this.lookPitch,
      ascend: this.ascend,
      descend: this.descend,
      fast: Math.hypot(this.moveX, this.moveZ) > 0.82,
      exitRequested: false,
    };
    this.lookYaw = 0;
    this.lookPitch = 0;
    return intent;
  }

  reset() {
    this.movePointerId = null;
    this.lookPointerId = null;
    this.moveX = 0;
    this.moveZ = 0;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.ascend = 0;
    this.descend = 0;
  }

  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  private readonly onMoveStart = (event: PointerEvent) => {
    if (this.movePointerId !== null) return;
    event.preventDefault();
    this.movePointerId = event.pointerId;
    this.moveOrigin = { x: event.clientX, y: event.clientY };
    try {
      this.moveSurface.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic events and older touch implementations can reject capture.
    }
  };

  private readonly onMove = (event: PointerEvent) => {
    if (event.pointerId !== this.movePointerId) return;
    event.preventDefault();
    const normalized = normalizeMovementAxis(
      clampIntentAxis((event.clientX - this.moveOrigin.x) / this.moveRadius),
      clampIntentAxis((event.clientY - this.moveOrigin.y) / this.moveRadius),
    );
    this.moveX = normalized.moveX;
    this.moveZ = normalized.moveZ;
  };

  private readonly onMoveEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.movePointerId) return;
    this.movePointerId = null;
    this.moveX = 0;
    this.moveZ = 0;
  };

  private readonly onLookStart = (event: PointerEvent) => {
    if (this.lookPointerId !== null) return;
    event.preventDefault();
    this.lookPointerId = event.pointerId;
    this.lookPrevious = { x: event.clientX, y: event.clientY };
    try {
      this.lookSurface.setPointerCapture?.(event.pointerId);
    } catch {
      // Look remains available through uncaptured pointer events.
    }
  };

  private readonly onLook = (event: PointerEvent) => {
    if (event.pointerId !== this.lookPointerId) return;
    event.preventDefault();
    this.lookYaw -= (event.clientX - this.lookPrevious.x) * this.lookSensitivity;
    this.lookPitch -= (event.clientY - this.lookPrevious.y) * this.lookSensitivity;
    this.lookPrevious = { x: event.clientX, y: event.clientY };
  };

  private readonly onLookEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.lookPointerId) return;
    this.lookPointerId = null;
  };

  private readonly onAscendStart = (event: PointerEvent) => {
    event.preventDefault();
    this.ascend = 1;
  };

  private readonly onAscendEnd = (event: PointerEvent) => {
    event.preventDefault();
    this.ascend = 0;
  };

  private readonly onDescendStart = (event: PointerEvent) => {
    event.preventDefault();
    this.descend = 1;
  };

  private readonly onDescendEnd = (event: PointerEvent) => {
    event.preventDefault();
    this.descend = 0;
  };

  private readonly onReset = () => this.reset();

  private readonly onVisibilityChange = () => {
    if (this.documentTarget.hidden) this.reset();
  };
}
