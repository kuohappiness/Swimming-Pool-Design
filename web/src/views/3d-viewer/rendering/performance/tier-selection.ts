import {
  FRAME_TARGETS,
  REALISM_TIERS,
  REALISM_TIER_ORDER,
  type DeviceClass,
  type RealismTierId,
} from './realism-tiers';

/** 啟動檢測在這一級、這台裝置實際會用的像素比下量測，其他級的成本由 relativeCost 換算。 */
export const BENCHMARK_REFERENCE_TIER: RealismTierId = 'medium';

/** 自動選級時保留的餘裕：估計成本不得超過幀預算的這個比例。 */
const BENCHMARK_HEADROOM_RATIO = 0.8;

/** 手機自動選級的上限；更高的級別只能由使用者自己選。 */
const MOBILE_AUTOMATIC_CEILING: RealismTierId = 'medium';

export interface BenchmarkSummary {
  readonly frames: number;
  readonly medianMilliseconds: number;
  readonly p95Milliseconds: number;
}

export type TierSelectionSource = 'url' | 'manual' | 'software-renderer' | 'benchmark' | 'default';

export interface TierSelectionInput {
  /** 網址 `quality` 參數的原始值。 */
  readonly requested: string | null;
  /** 使用者在這個瀏覽器手動選過的級別。 */
  readonly stored: string | null;
  readonly softwareRenderer: boolean;
  readonly deviceClass: DeviceClass;
  /** 啟動檢測的結果；沒有跑或樣本不足時是 null。 */
  readonly benchmark: BenchmarkSummary | null;
}

export interface TierSelection {
  readonly tier: RealismTierId;
  readonly source: TierSelectionSource;
}

const LEGACY_TIER_IDS: Readonly<Record<string, RealismTierId>> = Object.freeze({ low: 'saver' });

/** 接受四級的 ID 與舊網址的 `low`；其他值回傳 null，由呼叫端改走自動選級。 */
export function parseRealismTierId(value: string | null | undefined): RealismTierId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if ((REALISM_TIER_ORDER as readonly string[]).includes(normalized))
    return normalized as RealismTierId;
  return LEGACY_TIER_IDS[normalized] ?? null;
}

/** 啟動檢測畫幾幀、前幾幀不計，以及整段檢測最多花多久（裝置太慢時提早結束）。 */
export const BENCHMARK_FRAMES = 20;
const BENCHMARK_WARMUP_FRAMES = 5;
export const BENCHMARK_TIME_LIMIT_MILLISECONDS = 1500;

/**
 * 把啟動檢測的逐幀毫秒數整理成中位數與 p95。
 * 前幾幀含著色器編譯與貼圖上傳，不計入；有效樣本不足 `minimumSamples` 幀時回傳 null。
 * @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。
 */
export function summarizeBenchmark(
  frameMilliseconds: readonly number[],
  warmupFrames = BENCHMARK_WARMUP_FRAMES,
  minimumSamples = 10,
): BenchmarkSummary | null {
  const samples = frameMilliseconds
    .slice(Math.max(0, warmupFrames))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  if (samples.length < Math.max(1, minimumSamples)) return null;
  const middle = samples.length / 2;
  const medianMilliseconds =
    samples.length % 2 === 0
      ? (samples[middle - 1] + samples[middle]) / 2
      : samples[Math.floor(middle)];
  const p95Index = Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1);
  return Object.freeze({
    frames: samples.length,
    medianMilliseconds,
    p95Milliseconds: samples[p95Index],
  });
}

/**
 * 整理一次啟動檢測。`timedOut` 代表裝置慢到在時限內畫不完：這時樣本很少，
 * 但「很慢」本身就是結論，所以有幾幀算幾幀，不因樣本不足而放棄。
 */
export function summarizeBenchmarkRun(
  frameMilliseconds: readonly number[],
  timedOut: boolean,
): BenchmarkSummary | null {
  if (!timedOut) return summarizeBenchmark(frameMilliseconds);
  const warmup = Math.min(BENCHMARK_WARMUP_FRAMES, Math.max(0, frameMilliseconds.length - 1));
  return summarizeBenchmark(frameMilliseconds, warmup, 1);
}

/**
 * 檢測結果換算到某一級的估計每幀毫秒數。
 * @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。
 */
export function estimateFrameMilliseconds(
  benchmark: BenchmarkSummary,
  tier: RealismTierId,
): number {
  const reference = REALISM_TIERS[BENCHMARK_REFERENCE_TIER].relativeCost;
  return benchmark.medianMilliseconds * (REALISM_TIERS[tier].relativeCost / reference);
}

function automaticCandidates(deviceClass: DeviceClass): readonly RealismTierId[] {
  if (deviceClass === 'desktop') return REALISM_TIER_ORDER;
  return REALISM_TIER_ORDER.slice(REALISM_TIER_ORDER.indexOf(MOBILE_AUTOMATIC_CEILING));
}

/**
 * 估計成本在幀預算內的最高一級；都放不進去時用省電級。
 * @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。
 */
export function chooseTierFromBenchmark(
  benchmark: BenchmarkSummary,
  deviceClass: DeviceClass,
): RealismTierId {
  const budgetMilliseconds =
    (1000 / FRAME_TARGETS[deviceClass].targetFps) * BENCHMARK_HEADROOM_RATIO;
  for (const tier of automaticCandidates(deviceClass)) {
    if (estimateFrameMilliseconds(benchmark, tier) <= budgetMilliseconds) return tier;
  }
  return 'saver';
}

/**
 * 決定啟動時的畫質。優先順序：網址參數 → 使用者手動選過的 → 軟體繪圖一律省電 →
 * 啟動檢測 → 沒有檢測結果時的保守預設。自動測試固定用網址參數，不走檢測。
 */
export function selectRealismTier(input: TierSelectionInput): TierSelection {
  const requested = parseRealismTierId(input.requested);
  if (requested) return Object.freeze({ tier: requested, source: 'url' });

  const stored = parseRealismTierId(input.stored);
  if (stored) return Object.freeze({ tier: stored, source: 'manual' });

  if (input.softwareRenderer) return Object.freeze({ tier: 'saver', source: 'software-renderer' });

  if (input.benchmark) {
    return Object.freeze({
      tier: chooseTierFromBenchmark(input.benchmark, input.deviceClass),
      source: 'benchmark',
    });
  }

  return Object.freeze({
    tier: input.deviceClass === 'desktop' ? 'high' : 'medium',
    source: 'default',
  });
}
