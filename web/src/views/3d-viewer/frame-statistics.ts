/**
 * Rolling frame-time statistics for the quality governor (3D thread, TASK-150).
 *
 * Two numbers are kept apart on purpose: the interval between frames is locked
 * to the display refresh when the page keeps up, so only the work time (update
 * plus render submission, measured on the CPU) shows how much headroom is
 * left. GPU time is not included yet; on a GPU-bound device the work time
 * understates the real cost, so the governor must still watch the interval.
 */
export interface FrameObservation {
  /** Seconds since the statistics started, at the last observed frame. */
  readonly timeSeconds: number;
  /** Frames currently in the window. */
  readonly samples: number;
  /** 95th percentile of the time between consecutive frames. */
  readonly intervalP95Milliseconds: number;
  /** 95th percentile of the time spent updating and submitting one frame. */
  readonly workP95Milliseconds: number;
  /** Mean time between consecutive frames; diagnostic only. */
  readonly intervalAverageMilliseconds: number;
}

function percentile95(values: Float64Array, count: number) {
  if (count === 0) return 0;
  const sorted = Array.from(values.subarray(0, count)).sort((a, b) => a - b);
  return sorted[Math.min(count - 1, Math.ceil(count * 0.95) - 1)];
}

export class FrameStatistics {
  private readonly intervals: Float64Array;
  private readonly work: Float64Array;
  private next = 0;
  private count = 0;
  private lastTimeSeconds = 0;

  constructor(readonly windowSize = 120) {
    if (!Number.isInteger(windowSize) || windowSize < 1) {
      throw new RangeError('Frame statistics window must be a positive integer.');
    }
    this.intervals = new Float64Array(windowSize);
    this.work = new Float64Array(windowSize);
  }

  observe(timeSeconds: number, intervalMilliseconds: number, workMilliseconds: number) {
    if (![timeSeconds, intervalMilliseconds, workMilliseconds].every(Number.isFinite)) return;
    if (intervalMilliseconds < 0 || workMilliseconds < 0) return;
    this.intervals[this.next] = intervalMilliseconds;
    this.work[this.next] = workMilliseconds;
    this.next = (this.next + 1) % this.windowSize;
    this.count = Math.min(this.count + 1, this.windowSize);
    this.lastTimeSeconds = timeSeconds;
  }

  reset() {
    this.next = 0;
    this.count = 0;
  }

  snapshot(): FrameObservation {
    return {
      timeSeconds: this.lastTimeSeconds,
      samples: this.count,
      intervalP95Milliseconds: percentile95(this.intervals, this.count),
      workP95Milliseconds: percentile95(this.work, this.count),
      intervalAverageMilliseconds: this.count === 0
        ? 0
        : this.intervals.subarray(0, this.count).reduce((sum, value) => sum + value, 0) / this.count,
    };
  }
}
