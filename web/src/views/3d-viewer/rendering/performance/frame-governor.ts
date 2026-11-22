import {
  FRAME_TARGETS,
  lowerRealismTier,
  sheddableSteps,
  type DeviceClass,
  type RealismTier,
  type RealismTierId,
  type ShedStep,
} from './realism-tiers';

/**
 * 幀率調節器：流暢度不可犧牲（DEC-190），所以幀率掉到底線以下時先降解析度、再依固定順序
 * 關效果；有餘裕一段時間後再依相反順序恢復。這裡只做決定，不碰 renderer：
 * 呼叫端把滑動視窗的統計餵進來，拿到變更後自己套用。
 *
 * 級別本身自動只降不升（升級要下載更大的資產，交給使用者手動選）；
 * 同一級裡的解析度與效果可以雙向調整。
 */

export interface FrameObservation {
  /** 單調遞增的時間，單位秒。 */
  readonly timeSeconds: number;
  /** 視窗內的樣本數；不足時不做決定。 */
  readonly samples: number;
  /** 相鄰兩幀間隔的 p95：用來判斷有沒有掉幀。 */
  readonly intervalP95Milliseconds: number;
  /**
   * 每幀實際花在更新與繪製的 p95（有 GPU 計時就取兩者較大的）。
   * 螢幕同步會把幀間隔鎖在更新率上，所以「還有多少餘裕」只能看這個數字。
   */
  readonly workP95Milliseconds: number;
}

export interface FrameGovernorState {
  /** 繪製解析度相對於該級像素比的比例，1 代表不縮。 */
  readonly resolutionScale: number;
  /** 目前被關掉的效果，依卸載順序排列。 */
  readonly shed: readonly ShedStep[];
}

export type FrameGovernorAction =
  | 'lower-resolution'
  | 'shed'
  | 'restore'
  | 'raise-resolution'
  | 'lower-tier';

export interface FrameGovernorChange extends FrameGovernorState {
  readonly action: FrameGovernorAction;
  /** shed／restore 時是哪一個效果。 */
  readonly step: ShedStep | null;
  /** lower-tier 時建議改用的級別。 */
  readonly tier: RealismTierId | null;
}

export interface FrameGovernorOptions {
  readonly tier: RealismTier;
  readonly deviceClass: DeviceClass;
  /** 每次調整解析度的幅度。 */
  readonly resolutionStep?: number;
  /** 持續低於底線多久才動手。 */
  readonly overBudgetSeconds?: number;
  /** 持續有餘裕多久才恢復一步。 */
  readonly headroomSeconds?: number;
  /** 每次變更後先等統計視窗換新，這段時間不做決定。 */
  readonly settleSeconds?: number;
  /** 全部卸載後仍低於底線多久才建議降一級。 */
  readonly exhaustedSeconds?: number;
  readonly minimumSamples?: number;
}

/** 幀間隔超過底線這個比例才算掉幀，容許計時抖動。 */
export const OVER_BUDGET_TOLERANCE = 1.08;
/** 實際工作時間低於幀預算這個比例才算有餘裕。 */
export const HEADROOM_WORK_RATIO = 0.5;
/** 恢復後在這個倍數的 headroomSeconds 內又掉幀，視為恢復失敗。 */
const PROBATION_FACTOR = 2;
/** 恢復失敗後，下次恢復要等的時間加倍，最多到這個倍數。 */
const MAXIMUM_BACKOFF_FACTOR = 16;
/** 兩次觀測相隔超過這個秒數（分頁被切到背景）就重新計時。 */
const OBSERVATION_GAP_SECONDS = 1;

export class FrameGovernor {
  readonly tier: RealismTier;
  readonly floorMilliseconds: number;
  readonly targetMilliseconds: number;

  private readonly sheddable: readonly ShedStep[];
  private readonly resolutionStep: number;
  private readonly overBudgetSeconds: number;
  private readonly headroomSeconds: number;
  private readonly settleSeconds: number;
  private readonly exhaustedSeconds: number;
  private readonly minimumSamples: number;

  private resolutionScale = 1;
  private shedCount = 0;
  private overSince: number | null = null;
  private headroomSince: number | null = null;
  private settleUntil = Number.NEGATIVE_INFINITY;
  private lastObservation: number | null = null;
  private lastRestore: number | null = null;
  private backoffFactor = 1;
  private tierChangeSuggested = false;

  constructor(options: FrameGovernorOptions) {
    const target = FRAME_TARGETS[options.deviceClass];
    this.tier = options.tier;
    this.floorMilliseconds = 1000 / target.floorFps;
    this.targetMilliseconds = 1000 / target.targetFps;
    this.sheddable = sheddableSteps(options.tier);
    this.resolutionStep = options.resolutionStep ?? 0.1;
    this.overBudgetSeconds = options.overBudgetSeconds ?? 1.5;
    this.headroomSeconds = options.headroomSeconds ?? 10;
    this.settleSeconds = options.settleSeconds ?? 1;
    this.exhaustedSeconds = options.exhaustedSeconds ?? 5;
    this.minimumSamples = options.minimumSamples ?? 30;
    if (!(this.resolutionStep > 0 && this.resolutionStep <= 0.5)) {
      throw new RangeError('FrameGovernor resolutionStep must be within (0, 0.5].');
    }
  }

  get state(): FrameGovernorState {
    return Object.freeze({
      resolutionScale: this.resolutionScale,
      shed: Object.freeze(this.sheddable.slice(0, this.shedCount)),
    });
  }

  /** 下一次恢復需要連續多少秒的餘裕（恢復失敗後會拉長）。 */
  get requiredHeadroomSeconds(): number {
    return this.headroomSeconds * this.backoffFactor;
  }

  /** 餵一筆統計；有變更時回傳變更後的狀態，否則回傳 null。 */
  observe(observation: FrameObservation): FrameGovernorChange | null {
    const { timeSeconds } = observation;
    if (!Number.isFinite(timeSeconds)) return null;

    const gap = this.lastObservation === null ? 0 : timeSeconds - this.lastObservation;
    this.lastObservation = timeSeconds;
    if (gap < 0 || gap > OBSERVATION_GAP_SECONDS) this.clearTimers();

    if (
      timeSeconds < this.settleUntil
      || observation.samples < this.minimumSamples
      || !Number.isFinite(observation.intervalP95Milliseconds)
      || !Number.isFinite(observation.workP95Milliseconds)
    ) {
      this.clearTimers();
      return null;
    }

    const over = observation.intervalP95Milliseconds > this.floorMilliseconds * OVER_BUDGET_TOLERANCE;
    const headroom = !over
      && observation.workP95Milliseconds < this.targetMilliseconds * HEADROOM_WORK_RATIO;

    if (over) {
      this.headroomSince = null;
      this.overSince ??= timeSeconds;
      const exhausted = this.isExhausted();
      const wait = exhausted ? this.exhaustedSeconds : this.overBudgetSeconds;
      if (timeSeconds - this.overSince < wait) return null;
      return exhausted ? this.suggestLowerTier(timeSeconds) : this.degrade(timeSeconds);
    }

    this.overSince = null;
    if (!headroom || this.isPristine()) {
      this.headroomSince = null;
      return null;
    }
    this.headroomSince ??= timeSeconds;
    if (timeSeconds - this.headroomSince < this.requiredHeadroomSeconds) return null;
    return this.recover(timeSeconds);
  }

  private isPristine(): boolean {
    return this.shedCount === 0 && this.resolutionScale >= 1;
  }

  private isExhausted(): boolean {
    return this.shedCount >= this.sheddable.length
      && this.resolutionScale <= this.tier.minimumResolutionScale;
  }

  private clearTimers(): void {
    this.overSince = null;
    this.headroomSince = null;
  }

  private settle(timeSeconds: number): void {
    this.clearTimers();
    this.settleUntil = timeSeconds + this.settleSeconds;
  }

  private degrade(timeSeconds: number): FrameGovernorChange {
    if (
      this.lastRestore !== null
      && timeSeconds - this.lastRestore < this.requiredHeadroomSeconds * PROBATION_FACTOR
    ) {
      this.backoffFactor = Math.min(this.backoffFactor * 2, MAXIMUM_BACKOFF_FACTOR);
    }
    this.lastRestore = null;
    this.settle(timeSeconds);

    if (this.resolutionScale > this.tier.minimumResolutionScale) {
      this.resolutionScale = roundScale(
        Math.max(this.tier.minimumResolutionScale, this.resolutionScale - this.resolutionStep),
      );
      return this.change('lower-resolution', null);
    }
    const step = this.sheddable[this.shedCount];
    this.shedCount += 1;
    return this.change('shed', step);
  }

  private recover(timeSeconds: number): FrameGovernorChange {
    this.lastRestore = timeSeconds;
    this.tierChangeSuggested = false;
    this.settle(timeSeconds);

    if (this.shedCount > 0) {
      this.shedCount -= 1;
      return this.change('restore', this.sheddable[this.shedCount]);
    }
    this.resolutionScale = roundScale(Math.min(1, this.resolutionScale + this.resolutionStep));
    return this.change('raise-resolution', null);
  }

  private suggestLowerTier(timeSeconds: number): FrameGovernorChange | null {
    const lower = lowerRealismTier(this.tier.id);
    this.settle(timeSeconds);
    if (!lower || this.tierChangeSuggested) return null;
    this.tierChangeSuggested = true;
    return Object.freeze({ ...this.state, action: 'lower-tier', step: null, tier: lower });
  }

  private change(action: FrameGovernorAction, step: ShedStep | null): FrameGovernorChange {
    return Object.freeze({ ...this.state, action, step, tier: null });
  }
}

function roundScale(value: number): number {
  return Math.round(value * 100) / 100;
}
