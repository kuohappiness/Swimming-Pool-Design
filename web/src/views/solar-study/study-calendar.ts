/**
 * 日照研究頁的日期與時間：滑桿的日期站、診斷時段、季別與日期文字。
 * 純函式，不碰畫面，單元測試直接驗。
 */

/** 逐時診斷的時段（當地時間整點）。 */
export const DIAGNOSTIC_START_HOUR = 7;
export const DIAGNOSTIC_END_HOUR = 18;

export const sampleTimes: readonly string[] = Array.from(
  { length: DIAGNOSTIC_END_HOUR - DIAGNOSTIC_START_HOUR + 1 },
  (_, index) => String(index + DIAGNOSTIC_START_HOUR).padStart(2, '0') + ':00',
);

/** 日期滑桿的每一站：每月 1 日，另加夏至與冬至。 */
export const dateStops = [
  { month: 1, day: 1 },
  { month: 2, day: 1 },
  { month: 3, day: 1 },
  { month: 4, day: 1 },
  { month: 5, day: 1 },
  { month: 6, day: 1 },
  { month: 6, day: 21, milestone: '夏至' },
  { month: 7, day: 1 },
  { month: 8, day: 1 },
  { month: 9, day: 1 },
  { month: 10, day: 1 },
  { month: 11, day: 1 },
  { month: 12, day: 1 },
  { month: 12, day: 21, milestone: '冬至' },
] as const;

export const solstices = {
  winter: { name: '冬至', month: 12, day: 21, color: '#e5a23d' },
  summer: { name: '夏至', month: 6, day: 21, color: '#e15a4f' },
} as const;
export type SolsticeKey = keyof typeof solstices;

export interface ZonedNow {
  year: number;
  month: number;
  day: number;
  hour: number;
}

/** 指定時區（例如 Asia/Taipei）此刻的年、月、日、時。 */
export function zonedNow(timeZone: string, now: Date = new Date()): ZonedNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
  };
}

/** 開頁時日期滑桿停的站：當天剛好是夏至或冬至就停那一站，否則停當月 1 日。 */
export function initialDateStopIndex(month: number, day: number): number {
  const exactSolstice = dateStops.findIndex((stop) => stop.month === month && stop.day === day);
  if (exactSolstice >= 0) return exactSolstice;
  return Math.max(
    0,
    dateStops.findIndex((stop) => stop.month === month && stop.day === 1),
  );
}

/** 開頁時時間滑桿停的整點：限制在診斷時段內。 */
export function initialHour(hour: number): number {
  return Math.max(DIAGNOSTIC_START_HOUR, Math.min(DIAGNOSTIC_END_HOUR, hour));
}

/** 研究年的某一天（以 UTC 午夜表示，只拿來讀月、日）。 */
export function studyDate(year: number, month: number, day = 1): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function minutesFromTime(value: string): number {
  const parts = value.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

export function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

/** 5 到 9 月是暖季，其餘是冷季（與日照分析的季別相同）。 */
export function periodFor(date: Date): {
  key: 'warm' | 'cool';
  name: '暖季' | '冷季';
  color: string;
} {
  const month = date.getUTCMonth() + 1;
  return month >= 5 && month <= 9
    ? { key: 'warm', name: '暖季', color: '#e15a4f' }
    : { key: 'cool', name: '冷季', color: '#e5a23d' };
}

function dateMilestone(date: Date): string {
  const key =
    String(date.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getUTCDate()).padStart(2, '0');
  const milestones: Record<string, string> = {
    '03-20': '春分',
    '06-21': '夏至',
    '09-23': '秋分',
    '12-21': '冬至',
  };
  return milestones[key] ?? '';
}

/** 「6月21日（夏至）」；給了年份時前面加「2026年」。 */
export function formatStudyDate(date: Date, year?: number): string {
  const base =
    (year === undefined ? '' : year + '年') +
    (date.getUTCMonth() + 1) +
    '月' +
    date.getUTCDate() +
    '日';
  const milestone = dateMilestone(date);
  return base + (milestone ? '（' + milestone + '）' : '');
}
