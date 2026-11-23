import { FrameGovernor, type FrameObservation } from './frame-governor';
import {
  REALISM_TIERS,
  REALISM_TIER_ORDER,
  type DeviceClass,
  type RealismTier,
  type RealismTierId,
  type ShedStep,
} from './realism-tiers';
import type { TierSelection, TierSelectionSource } from './tier-selection';

/**
 * 畫質的單一決定者（DEC-190）：現在用哪一級、為什麼、解析度縮到多少、關了哪些效果。
 * 它不碰 renderer；呼叫端把每一筆變更套到畫面上。
 *
 * 級別有三種來源：啟動時選的（網址、使用者手動、檢測）、使用者在選單改的，
 * 以及幀率撐不住時自動往下降的。自動只降不升；唯一的例外是事後發現降級沒有用
 * （更新率其實是被螢幕或瀏覽器鎖住），這時會回到自動降級之前的那一級。
 */

export type QualityTierSource = TierSelectionSource | 'frame-rate';

export interface QualityState {
  readonly tier: RealismTierId;
  readonly source: QualityTierSource;
  /** 繪製解析度相對於該級像素比的比例。 */
  readonly resolutionScale: number;
  readonly shed: readonly ShedStep[];
  /** 更新率被螢幕或瀏覽器限制時的實際間隔（毫秒）；沒有限制時是 null。 */
  readonly displayIntervalMilliseconds: number | null;
}

export type QualityEvent =
  | {
      readonly kind: 'resolution';
      readonly state: QualityState;
      readonly direction: 'lower' | 'raise';
    }
  | {
      readonly kind: 'effects';
      readonly state: QualityState;
      readonly step: ShedStep;
      readonly direction: 'shed' | 'restore';
    }
  | {
      readonly kind: 'tier';
      readonly state: QualityState;
      readonly previous: RealismTierId;
      readonly reason: 'selected' | 'frame-rate' | 'display-limited';
    }
  | { readonly kind: 'display-limited'; readonly state: QualityState };

export interface QualityControllerOptions {
  readonly selection: TierSelection;
  readonly deviceClass: DeviceClass;
  /** false 時不做任何自動調整（網址 `adaptive=off`、軟體繪圖）；選單仍可換級。 */
  readonly adaptive: boolean;
  /** 畫面上真的能開關的效果；其餘不排進卸載順序。 */
  readonly availableShedSteps?: readonly ShedStep[];
  /** 螢幕更新間隔；通常建立時還沒量到，之後用 setDisplayInterval 補上。 */
  readonly displayIntervalMilliseconds?: number | null;
}

export class QualityController {
  readonly deviceClass: DeviceClass;
  readonly adaptive: boolean;

  private readonly availableShedSteps: readonly ShedStep[] | undefined;
  private tierId: RealismTierId;
  private tierSource: QualityTierSource;
  private governor: FrameGovernor;
  /** 自動降級之前的級別；沒有自動降過時是 null。 */
  private tierBeforeAutomaticLowering: {
    readonly tier: RealismTierId;
    readonly source: QualityTierSource;
  } | null = null;

  constructor(options: QualityControllerOptions) {
    assertTierId(options.selection.tier);
    this.deviceClass = options.deviceClass;
    this.adaptive = options.adaptive;
    this.availableShedSteps = options.availableShedSteps;
    this.tierId = options.selection.tier;
    this.tierSource = options.selection.source;
    this.governor = this.createGovernor(options.displayIntervalMilliseconds ?? null);
  }

  get tier(): RealismTier {
    return REALISM_TIERS[this.tierId];
  }

  get state(): QualityState {
    const { resolutionScale, shed } = this.governor.state;
    return Object.freeze({
      tier: this.tierId,
      source: this.tierSource,
      resolutionScale,
      shed,
      displayIntervalMilliseconds: this.governor.displayIntervalMilliseconds,
    });
  }

  /** 螢幕更新間隔量到之後補上（載入期間量，建立時通常還沒有結果）。 */
  setDisplayInterval(milliseconds: number | null): void {
    this.governor.displayIntervalMilliseconds = milliseconds;
  }

  /** 啟動選級或使用者在選單選了某一級（或選回自動後重新選級）。 */
  select(selection: TierSelection): QualityEvent | null {
    assertTierId(selection.tier);
    const previous = this.tierId;
    const unchanged =
      previous === selection.tier &&
      this.governor.state.resolutionScale === 1 &&
      this.governor.state.shed.length === 0;
    this.tierSource = selection.source;
    this.tierBeforeAutomaticLowering = null;
    if (unchanged) return null;
    this.tierId = selection.tier;
    this.governor = this.createGovernor(this.governor.displayIntervalMilliseconds);
    return Object.freeze({ kind: 'tier', state: this.state, previous, reason: 'selected' });
  }

  /** 餵一筆幀統計；畫質有變更時回傳要套用的事件。 */
  observe(observation: FrameObservation): QualityEvent | null {
    if (!this.adaptive) return null;
    const change = this.governor.observe(observation);
    if (!change) return null;

    switch (change.action) {
      case 'lower-resolution':
        return Object.freeze({ kind: 'resolution', state: this.state, direction: 'lower' });
      case 'raise-resolution':
        return Object.freeze({ kind: 'resolution', state: this.state, direction: 'raise' });
      case 'shed':
      case 'restore':
        return Object.freeze({
          kind: 'effects',
          state: this.state,
          step: change.step as ShedStep,
          direction: change.action,
        });
      case 'lower-tier': {
        const previous = this.tierId;
        this.tierBeforeAutomaticLowering ??= { tier: previous, source: this.tierSource };
        this.tierId = change.tier as RealismTierId;
        this.tierSource = 'frame-rate';
        this.governor = this.createGovernor(this.governor.displayIntervalMilliseconds);
        return Object.freeze({ kind: 'tier', state: this.state, previous, reason: 'frame-rate' });
      }
      case 'display-limited': {
        const restore = this.tierBeforeAutomaticLowering;
        this.tierBeforeAutomaticLowering = null;
        if (!restore || restore.tier === this.tierId) {
          return Object.freeze({ kind: 'display-limited', state: this.state });
        }
        // 降級沒有用：回到自動降級之前的那一級，底線已放寬到實際的更新間隔。
        // 那一級如果真的太重，調節器會照新的底線再降一次，停在撐得住的地方。
        const previous = this.tierId;
        this.tierId = restore.tier;
        this.tierSource = restore.source;
        this.governor = this.createGovernor(this.governor.displayIntervalMilliseconds);
        return Object.freeze({
          kind: 'tier',
          state: this.state,
          previous,
          reason: 'display-limited',
        });
      }
      default:
        return null;
    }
  }

  private createGovernor(displayIntervalMilliseconds: number | null): FrameGovernor {
    return new FrameGovernor({
      tier: REALISM_TIERS[this.tierId],
      deviceClass: this.deviceClass,
      displayIntervalMilliseconds,
      ...(this.availableShedSteps ? { availableSteps: this.availableShedSteps } : {}),
    });
  }
}

function assertTierId(tier: RealismTierId): void {
  if (!REALISM_TIER_ORDER.includes(tier)) {
    throw new TypeError(`Unknown realism tier: ${String(tier)}`);
  }
}
