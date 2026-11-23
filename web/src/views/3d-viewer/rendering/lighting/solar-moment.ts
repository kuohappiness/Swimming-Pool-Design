/**
 * 3D 頁的「現在是什麼時候」：校址當地的日期與時刻。
 *
 * 不用 `Date` 物件：它會帶進瀏覽器所在的時區，同一個網址在不同國家打開會得到不同的太陽。
 * 這裡只存年月日與「從午夜起算的分鐘」，一律指校址當地時間。
 */
export interface SolarMoment {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  /** 當地時間從午夜起算的分鐘，0 到 1439。 */
  readonly minutes: number;
}

export interface SolarTerm {
  readonly id: 'spring-equinox' | 'summer-solstice' | 'autumn-equinox' | 'winter-solstice';
  readonly label: string;
  readonly month: number;
  readonly day: number;
}

/** 二分二至的日期。與日照研究頁標示的日期一致（3/20、6/21、9/23、12/21）。 */
export const SOLAR_TERMS: readonly SolarTerm[] = Object.freeze([
  Object.freeze({ id: 'spring-equinox', label: '春分', month: 3, day: 20 }),
  Object.freeze({ id: 'summer-solstice', label: '夏至', month: 6, day: 21 }),
  Object.freeze({ id: 'autumn-equinox', label: '秋分', month: 9, day: 23 }),
  Object.freeze({ id: 'winter-solstice', label: '冬至', month: 12, day: 21 }),
]);

export const MINUTES_PER_DAY = 1440;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export function assertSolarMoment(moment: SolarMoment): SolarMoment {
  const { year, month, day, minutes } = moment;
  if (![year, month, day, minutes].every(Number.isInteger)) {
    throw new TypeError('Solar moment fields must be integers.');
  }
  if (year < 1900 || year > 2200)
    throw new RangeError('Solar moment year must be within 1900..2200.');
  if (month < 1 || month > 12) throw new RangeError('Solar moment month must be within 1..12.');
  if (day < 1 || day > daysInMonth(year, month))
    throw new RangeError('Solar moment day is not in that month.');
  if (minutes < 0 || minutes >= MINUTES_PER_DAY)
    throw new RangeError('Solar moment minutes must be within 0..1439.');
  return moment;
}

/** 一年中的第幾天，1 月 1 日是 1。 */
export function dayOfYear(moment: Pick<SolarMoment, 'year' | 'month' | 'day'>): number {
  let ordinal = moment.day;
  for (let month = 1; month < moment.month; month += 1) ordinal += daysInMonth(moment.year, month);
  return ordinal;
}

/** 把一年中的第幾天換回月與日；超出範圍時夾在該年的第一天與最後一天。 */
export function dateFromDayOfYear(year: number, ordinal: number): { month: number; day: number } {
  let remaining = Math.min(daysInYear(year), Math.max(1, Math.round(ordinal)));
  for (let month = 1; month <= 12; month += 1) {
    const length = daysInMonth(year, month);
    if (remaining <= length) return { month, day: remaining };
    remaining -= length;
  }
  return { month: 12, day: 31 };
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

/** 網址參數 `time` 的寫法：`2026-12-21T09:30`（校址當地時間，不帶時區）。 */
export function formatSolarMoment(moment: SolarMoment): string {
  return `${pad(moment.year, 4)}-${pad(moment.month)}-${pad(moment.day)}T${pad(
    Math.floor(moment.minutes / 60),
  )}:${pad(moment.minutes % 60)}`;
}

/** 讀網址參數 `time`；寫法不對或日期不存在時回傳 null，由呼叫端決定退回哪個時刻。 */
export function parseSolarMoment(text: string | null | undefined): SolarMoment | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text ?? '');
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  if (hour > 23 || minute > 59) return null;
  try {
    return assertSolarMoment({ year, month, day, minutes: hour * 60 + minute });
  } catch {
    return null;
  }
}

/** 給畫面看的寫法：`12月21日（冬至）09:30`。 */
export function describeSolarMoment(moment: SolarMoment): { date: string; time: string } {
  const term = SOLAR_TERMS.find(
    (candidate) => candidate.month === moment.month && candidate.day === moment.day,
  );
  return {
    date: `${moment.month}月${moment.day}日${term ? `（${term.label}）` : ''}`,
    time: `${pad(Math.floor(moment.minutes / 60))}:${pad(moment.minutes % 60)}`,
  };
}
