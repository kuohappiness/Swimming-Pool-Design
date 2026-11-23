import type { FrameObservation } from './frame-governor';
import { QualityController, type QualityEvent, type QualityState } from './quality-controller';
import {
  REALISM_TIERS,
  REALISM_TIER_ORDER,
  type DeviceClass,
  type RealismTier,
  type RealismTierId,
  type ShedStep,
} from './realism-tiers';
import {
  BENCHMARK_REFERENCE_TIER,
  parseRealismTierId,
  selectRealismTier,
  type BenchmarkSummary,
  type TierSelection,
} from './tier-selection';

/**
 * 一次瀏覽期間的畫質：啟動選級、畫質選單、幀率調節器三者在這裡接在一起（DEC-190）。
 * 不引用 three.js 也不直接碰 DOM；畫面與選單由呼叫端依回呼更新，所以整段流程可以單元測試。
 */

/** 使用者手動選的級別存在這個瀏覽器的 localStorage，下次造訪沿用。 */
export const QUALITY_STORAGE_KEY = 'swimming-pool-design.3d-viewer.quality';

/** 選單的值：自動，或四級之一。 */
export type QualityChoice = 'auto' | RealismTierId;

export const QUALITY_CHOICES: readonly { readonly value: QualityChoice; readonly label: string }[] =
  Object.freeze([
    Object.freeze({ value: 'auto', label: '自動' }),
    ...REALISM_TIER_ORDER.map((id) => Object.freeze({ value: id, label: REALISM_TIERS[id].label })),
  ]);

export interface QualityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface QualitySessionHost {
  /**
   * 把這一級套到繪圖管線（材質、陰影、貼圖版本），不含解析度。
   * `shed` 是調節器為了幀率暫時關掉或調低的效果；換級時是空的。
   */
  applyTier(tier: RealismTier, shed: readonly ShedStep[]): void;
  /** 依目前的級別與動態解析度重設畫布大小。 */
  applyResolution(): void;
  /** 在目前的畫質下畫幾幀並回傳統計；量不到時回傳 null。 */
  runBenchmark(): BenchmarkSummary | null;
  /** 畫質狀態有任何改變時呼叫：更新選單、狀態列與診斷屬性。 */
  publish(snapshot: QualitySnapshot): void;
  /** 級別自動改變時給使用者的一句話。 */
  announce(message: string): void;
}

export interface QualitySessionOptions {
  /** 網址 `quality` 參數的原始值。 */
  readonly requested: string | null;
  readonly softwareRenderer: boolean;
  readonly deviceClass: DeviceClass;
  /** 網址 `adaptive=off` 時為 false；軟體繪圖一律不做自動調整。 */
  readonly adaptive: boolean;
  readonly storage: QualityStorage | null;
  readonly availableShedSteps?: readonly ShedStep[];
}

export interface QualitySnapshot extends QualityState {
  readonly label: string;
  /** 選單應該顯示的值。 */
  readonly choice: QualityChoice;
  /** 狀態列的一句話。 */
  readonly description: string;
  readonly adaptive: boolean;
  readonly benchmark: BenchmarkSummary | null;
}

function readStored(storage: QualityStorage | null): string | null {
  try {
    return storage?.getItem(QUALITY_STORAGE_KEY) ?? null;
  } catch {
    // 隱私模式或停用網站資料時讀不到：當作沒有選過。
    return null;
  }
}

function writeStored(storage: QualityStorage | null, tier: RealismTierId | null): void {
  try {
    if (tier) storage?.setItem(QUALITY_STORAGE_KEY, tier);
    else storage?.removeItem(QUALITY_STORAGE_KEY);
  } catch {
    // 寫不進去只影響下次造訪是否記得，這次照常運作。
  }
}

export class QualitySession {
  readonly controller: QualityController;

  private readonly options: QualitySessionOptions;
  private host: QualitySessionHost | null = null;
  private choice: QualityChoice;
  private benchmark: BenchmarkSummary | null = null;
  private benchmarkPending: boolean;

  constructor(options: QualitySessionOptions) {
    this.options = options;
    const selection = selectRealismTier({
      requested: options.requested,
      stored: readStored(options.storage),
      softwareRenderer: options.softwareRenderer,
      deviceClass: options.deviceClass,
      benchmark: null,
    });
    // 沒有人指定、也不是軟體繪圖：先用檢測基準級啟動，量完再決定。
    this.benchmarkPending = selection.source === 'default';
    this.choice =
      selection.source === 'url' || selection.source === 'manual' ? selection.tier : 'auto';
    this.controller = new QualityController({
      selection: this.benchmarkPending
        ? { tier: BENCHMARK_REFERENCE_TIER, source: 'default' }
        : selection,
      deviceClass: options.deviceClass,
      adaptive: options.adaptive && !options.softwareRenderer,
      ...(options.availableShedSteps ? { availableShedSteps: options.availableShedSteps } : {}),
    });
  }

  /** 目前這一級的定義；啟動時繪圖管線用它建立。 */
  get tier(): RealismTier {
    return this.controller.tier;
  }

  get snapshot(): QualitySnapshot {
    const state = this.controller.state;
    const tier = REALISM_TIERS[state.tier];
    return Object.freeze({
      ...state,
      label: tier.label,
      choice: this.choice,
      description: describe(state, tier),
      adaptive: this.controller.adaptive,
      benchmark: this.benchmark,
    });
  }

  /**
   * 畫面第一次能畫之後呼叫一次：需要的話做啟動檢測並換到選出的級別，然後公布狀態。
   * 呼叫前繪圖管線必須已經是 `tier` 這一級。`displayIntervalMilliseconds` 是載入期間量到的
   * 螢幕更新間隔（量不到就給 null），交給調節器放寬底線。
   */
  start(host: QualitySessionHost, displayIntervalMilliseconds: number | null = null): void {
    this.host = host;
    this.controller.setDisplayInterval(displayIntervalMilliseconds);
    if (this.benchmarkPending) this.selectAutomatically();
    host.publish(this.snapshot);
  }

  /** 使用者在選單選了一項。不認得的值不做任何事。 */
  choose(value: string): void {
    const host = this.requireHost();
    if (value === 'auto') {
      this.choice = 'auto';
      writeStored(this.options.storage, null);
      if (this.options.softwareRenderer || this.benchmark) {
        this.apply(this.controller.select(this.automaticSelection()));
      } else {
        // 之前是指定級別所以沒量過：先換到檢測基準級，量完再選。
        this.apply(this.controller.select({ tier: BENCHMARK_REFERENCE_TIER, source: 'default' }));
        this.selectAutomatically();
      }
      host.publish(this.snapshot);
      return;
    }
    const tier = parseRealismTierId(value);
    if (!tier) return;
    this.choice = tier;
    writeStored(this.options.storage, tier);
    this.apply(this.controller.select({ tier, source: 'manual' }));
    host.publish(this.snapshot);
  }

  /** 每隔幾幀餵一筆統計；調節器有動作時套用並公布。 */
  observe(observation: FrameObservation): void {
    if (!this.host) return;
    const event = this.controller.observe(observation);
    if (!event) return;
    this.apply(event);
    if (event.kind === 'tier') {
      const label = REALISM_TIERS[event.state.tier].label;
      this.host.announce(
        event.reason === 'frame-rate'
          ? `為維持流暢，畫質已調整為「${label}」；移動與碰撞維持不變`
          : `畫質已恢復為「${label}」`,
      );
    }
    this.host.publish(this.snapshot);
  }

  private selectAutomatically(): void {
    const host = this.requireHost();
    this.benchmarkPending = false;
    this.benchmark = host.runBenchmark();
    this.apply(this.controller.select(this.automaticSelection()));
  }

  private automaticSelection(): TierSelection {
    return selectRealismTier({
      requested: null,
      stored: null,
      softwareRenderer: this.options.softwareRenderer,
      deviceClass: this.options.deviceClass,
      benchmark: this.benchmark,
    });
  }

  private apply(event: QualityEvent | null): void {
    if (!event) return;
    const host = this.requireHost();
    if (event.kind === 'tier' || event.kind === 'effects') {
      host.applyTier(REALISM_TIERS[event.state.tier], event.state.shed);
    }
    // 級別、解析度與「更新率受限」都會改變實際的像素比；效果開關不會。
    if (event.kind !== 'effects') host.applyResolution();
  }

  private requireHost(): QualitySessionHost {
    if (!this.host) throw new TypeError('Quality session has not been started.');
    return this.host;
  }
}

function describe(state: QualityState, tier: RealismTier): string {
  const reasons: Record<QualityState['source'], string> = {
    url: '由網址指定',
    manual: '',
    'software-renderer': '這台裝置使用軟體繪圖',
    benchmark: '依這台裝置的檢測結果',
    default: '',
    'frame-rate': '為維持流暢自動調降',
  };
  const notes = [reasons[state.source]];
  if (state.resolutionScale < 1) notes.push(`解析度 ${Math.round(state.resolutionScale * 100)}%`);
  const detail = notes.filter(Boolean).join('，');
  return detail ? `目前：${tier.label}（${detail}）` : `目前：${tier.label}`;
}
