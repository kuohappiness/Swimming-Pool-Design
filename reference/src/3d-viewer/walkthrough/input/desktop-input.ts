import type { MovementIntent } from '../types.js';
import {
  clampIntentAxis,
  normalizeMovementAxis,
  type InputAdapter,
} from './input-adapter.js';

export interface DesktopInputOptions {
  canvas: HTMLElement;
  document?: Document;
  window?: Window;
  lookSensitivity?: number;
}

export class DesktopInput implements InputAdapter {
  readonly id = 'desktop-keyboard-pointer';
  private readonly canvas: HTMLElement;
  private readonly documentTarget: Document;
  private readonly windowTarget: Window;
  private readonly lookSensitivity: number;
  private keys = new Set<string>();
  private lookYaw = 0;
  private lookPitch = 0;
  private exitRequested = false;
  private draggingPointerId: number | null = null;
  private previousPointer = { x: 0, y: 0 };
  private started = false;
  private disposed = false;

  constructor(options: DesktopInputOptions) {
    this.canvas = options.canvas;
    this.documentTarget = options.document ?? document;
    this.windowTarget = options.window ?? window;
    this.lookSensitivity = options.lookSensitivity ?? 0.0022;
  }

  get active() {
    return this.started;
  }

  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.windowTarget.addEventListener('keydown', this.onKeyDown);
    this.windowTarget.addEventListener('keyup', this.onKeyUp);
    this.windowTarget.addEventListener('blur', this.onReset);
    this.documentTarget.addEventListener('visibilitychange', this.onVisibilityChange);
    this.documentTarget.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.documentTarget.addEventListener('mousemove', this.onLockedMouseMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerEnd);
    this.canvas.addEventListener('pointercancel', this.onPointerEnd);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.windowTarget.removeEventListener('keydown', this.onKeyDown);
    this.windowTarget.removeEventListener('keyup', this.onKeyUp);
    this.windowTarget.removeEventListener('blur', this.onReset);
    this.documentTarget.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.documentTarget.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.documentTarget.removeEventListener('mousemove', this.onLockedMouseMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerEnd);
    this.canvas.removeEventListener('pointercancel', this.onPointerEnd);
    this.reset();
  }

  readIntent(): MovementIntent {
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? -1 : 0;
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0;
    const forward = this.keys.has('KeyW') || this.keys.has('ArrowUp') ? -1 : 0;
    const backward = this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0;
    const movement = normalizeMovementAxis(left + right, forward + backward);
    const intent: MovementIntent = {
      moveX: clampIntentAxis(movement.moveX),
      moveZ: clampIntentAxis(movement.moveZ),
      lookYaw: this.lookYaw,
      lookPitch: this.lookPitch,
      ascend: this.keys.has('Space') ? 1 : 0,
      descend: this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyC') ? 1 : 0,
      fast: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      exitRequested: this.exitRequested,
    };
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.exitRequested = false;
    return intent;
  }

  reset() {
    this.keys.clear();
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.exitRequested = false;
    this.draggingPointerId = null;
  }

  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      this.exitRequested = true;
      return;
    }
    if ([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'ControlLeft', 'ControlRight', 'KeyC', 'ShiftLeft', 'ShiftRight',
    ].includes(event.code)) {
      event.preventDefault();
      this.keys.add(event.code);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private readonly onReset = () => this.reset();

  private readonly onVisibilityChange = () => {
    if (this.documentTarget.hidden) this.reset();
  };

  private readonly onPointerLockChange = () => {
    if (this.documentTarget.pointerLockElement !== this.canvas) {
      this.draggingPointerId = null;
    }
  };

  private readonly onLockedMouseMove = (event: MouseEvent) => {
    if (this.documentTarget.pointerLockElement !== this.canvas) return;
    this.lookYaw -= event.movementX * this.lookSensitivity;
    this.lookPitch -= event.movementY * this.lookSensitivity;
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (this.documentTarget.pointerLockElement !== this.canvas) {
      this.draggingPointerId = event.pointerId;
      this.previousPointer = { x: event.clientX, y: event.clientY };
      try {
        this.canvas.setPointerCapture?.(event.pointerId);
      } catch {
        // Drag-look remains available when capture is unavailable.
      }
      try {
        const pointerLockCanvas = this.canvas as HTMLElement & {
          requestPointerLock?: () => void | Promise<void>;
        };
        void Promise.resolve(pointerLockCanvas.requestPointerLock?.()).catch(() => {});
      } catch {
        // Drag-look remains available when Pointer Lock is unsupported or denied.
      }
    }
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.documentTarget.pointerLockElement === this.canvas
      || this.draggingPointerId !== event.pointerId) return;
    this.lookYaw -= (event.clientX - this.previousPointer.x) * this.lookSensitivity;
    this.lookPitch -= (event.clientY - this.previousPointer.y) * this.lookSensitivity;
    this.previousPointer = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerEnd = (event: PointerEvent) => {
    if (this.draggingPointerId === event.pointerId) this.draggingPointerId = null;
  };
}
