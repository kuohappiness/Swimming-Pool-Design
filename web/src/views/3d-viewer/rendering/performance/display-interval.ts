/**
 * 從載入期間的 requestAnimationFrame 間隔估計螢幕更新間隔。
 *
 * 瀏覽器不會比螢幕更新得更快，所以間隔只會因為主執行緒忙而變長、不會變短；
 * 取偏低的百分位數就能避開載入時的卡頓。量到的值交給幀率調節器：50 Hz 的螢幕或被
 * 省電模式鎖在 30 fps 的瀏覽器，不該因為「達不到 60 fps」就一路降畫質。
 */
export const DISPLAY_INTERVAL_MINIMUM_SAMPLES = 20;
const LOW_PERCENTILE = 0.2;
/** 超過這個毫秒數的間隔視為分頁在背景或長時間卡住，不列入。 */
const MAXIMUM_PLAUSIBLE_INTERVAL = 100;
/** 低於這個毫秒數（高於 500 Hz）視為計時雜訊。 */
const MINIMUM_PLAUSIBLE_INTERVAL = 2;

export function estimateDisplayIntervalMilliseconds(intervals: readonly number[]): number | null {
  const samples = intervals
    .filter((value) => Number.isFinite(value)
      && value >= MINIMUM_PLAUSIBLE_INTERVAL
      && value <= MAXIMUM_PLAUSIBLE_INTERVAL)
    .sort((left, right) => left - right);
  if (samples.length < DISPLAY_INTERVAL_MINIMUM_SAMPLES) return null;
  return samples[Math.floor((samples.length - 1) * LOW_PERCENTILE)];
}
