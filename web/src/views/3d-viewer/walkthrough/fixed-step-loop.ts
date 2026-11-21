export interface FixedStepResult {
  readonly steps: number;
  readonly alpha: number;
  readonly droppedTimeSeconds: number;
}

export class FixedStepLoop {
  private accumulator = 0;
  readonly fixedStepSeconds: number;
  readonly maxFrameDeltaSeconds: number;
  readonly maxSubsteps: number;

  constructor(
    fixedStepSeconds: number,
    maxFrameDeltaSeconds: number,
    maxSubsteps: number,
  ) {
    if (!Number.isFinite(fixedStepSeconds) || fixedStepSeconds <= 0) {
      throw new TypeError('fixedStepSeconds must be finite and positive.');
    }
    if (!Number.isFinite(maxFrameDeltaSeconds) || maxFrameDeltaSeconds < fixedStepSeconds) {
      throw new TypeError('maxFrameDeltaSeconds must be finite and at least one fixed step.');
    }
    if (!Number.isInteger(maxSubsteps) || maxSubsteps < 1) {
      throw new TypeError('maxSubsteps must be a positive integer.');
    }
    this.fixedStepSeconds = fixedStepSeconds;
    this.maxFrameDeltaSeconds = maxFrameDeltaSeconds;
    this.maxSubsteps = maxSubsteps;
  }

  advance(frameDeltaSeconds: number, update: (stepSeconds: number) => void): FixedStepResult {
    const finiteDelta = Number.isFinite(frameDeltaSeconds) ? Math.max(0, frameDeltaSeconds) : 0;
    const clampedDelta = Math.min(finiteDelta, this.maxFrameDeltaSeconds);
    let droppedTimeSeconds = Math.max(0, finiteDelta - clampedDelta);
    this.accumulator += clampedDelta;
    let steps = 0;
    while (this.accumulator >= this.fixedStepSeconds && steps < this.maxSubsteps) {
      update(this.fixedStepSeconds);
      this.accumulator -= this.fixedStepSeconds;
      steps += 1;
    }
    if (steps === this.maxSubsteps && this.accumulator >= this.fixedStepSeconds) {
      const retained = this.accumulator % this.fixedStepSeconds;
      droppedTimeSeconds += this.accumulator - retained;
      this.accumulator = retained;
    }
    return {
      steps,
      alpha: this.accumulator / this.fixedStepSeconds,
      droppedTimeSeconds,
    };
  }

  reset() {
    this.accumulator = 0;
  }
}
