export type CameraModeState = 'inspect' | 'entering' | 'walkthrough' | 'exiting';

export interface CameraModeHooks<Snapshot> {
  captureInspectState(): Snapshot;
  enterWalkthrough(snapshot: Snapshot): void | Promise<void>;
  restoreInspectState(snapshot: Snapshot): void | Promise<void>;
  onStateChange?(state: CameraModeState): void;
}

export class CameraModeManager<Snapshot> {
  private currentState: CameraModeState = 'inspect';
  private snapshot: Snapshot | null = null;
  private disposed = false;
  private readonly hooks: CameraModeHooks<Snapshot>;

  constructor(hooks: CameraModeHooks<Snapshot>) {
    this.hooks = hooks;
  }

  get state() {
    return this.currentState;
  }

  async enter() {
    if (this.disposed || this.currentState !== 'inspect') return false;
    this.setState('entering');
    const snapshot = this.hooks.captureInspectState();
    this.snapshot = snapshot;
    try {
      await this.hooks.enterWalkthrough(snapshot);
      if (this.disposed) return false;
      this.setState('walkthrough');
      return true;
    } catch (error) {
      await this.hooks.restoreInspectState(snapshot);
      this.snapshot = null;
      this.setState('inspect');
      throw error;
    }
  }

  async exit() {
    if (this.disposed || this.currentState !== 'walkthrough' || !this.snapshot) return false;
    this.setState('exiting');
    const snapshot = this.snapshot;
    try {
      await this.hooks.restoreInspectState(snapshot);
    } finally {
      this.snapshot = null;
      if (!this.disposed) this.setState('inspect');
    }
    return true;
  }

  async dispose() {
    if (this.disposed) return;
    if (this.currentState === 'walkthrough' && this.snapshot) {
      await this.hooks.restoreInspectState(this.snapshot);
    }
    this.snapshot = null;
    this.disposed = true;
  }

  private setState(state: CameraModeState) {
    this.currentState = state;
    this.hooks.onStateChange?.(state);
  }
}
