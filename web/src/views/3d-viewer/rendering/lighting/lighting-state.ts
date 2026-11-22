import {
  MINUTES_PER_DAY,
  assertSolarMoment,
  formatSolarMoment,
  parseSolarMoment,
  type SolarMoment,
} from './solar-moment';
import { WEATHERS, type Weather } from './sun-lighting';

/** 3D 頁目前的光：什麼時候、什麼天氣。 */
export interface LightingState {
  readonly moment: SolarMoment;
  readonly weather: Weather;
}

/** 場景自帶的時刻與天氣（`scene-manifest.json`）。年份不寫在場景裡，一律用開啟頁面當年。 */
export interface SceneLightingPreset {
  readonly month: number;
  readonly day: number;
  /** 校址當地時間，`HH:MM`。 */
  readonly time: string;
  readonly weather: Weather;
}

const isWeather = (value: unknown): value is Weather => WEATHERS.includes(value as Weather);

export function parseClockTime(text: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);
  if (!match || hour > 23 || minute > 59) throw new TypeError(`Clock time is invalid: ${text}`);
  return hour * 60 + minute;
}

export function lightingStateFromPreset(preset: SceneLightingPreset, year: number): LightingState {
  if (!isWeather(preset.weather)) throw new TypeError(`Scene weather is unknown: ${String(preset.weather)}`);
  return Object.freeze({
    moment: assertSolarMoment({
      year,
      month: preset.month,
      day: preset.day,
      minutes: parseClockTime(preset.time),
    }),
    weather: preset.weather,
  });
}

/** 校址當地「現在」是哪一年、幾月幾日、幾點幾分；與瀏覽器所在時區無關。 */
export function siteMomentAt(epochMilliseconds: number, utcOffsetHours: number): SolarMoment {
  const shifted = new Date(epochMilliseconds + utcOffsetHours * 3_600_000);
  return assertSolarMoment({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  });
}

/** `weather=night` 沒有另外指定時刻時用的時間。 */
export const NIGHT_ALIAS_MINUTES = 21 * 60;

/**
 * 讀網址參數 `time` 與 `weather`，蓋在場景自帶的設定上。
 *
 * - `time=2026-12-21T09:30`：校址當地時間。寫法不對就忽略，不猜。
 * - `weather=clear|overcast|rain`。
 * - `weather=night`：夜景的簡寫，等於晴天晚上九點；同時有 `time` 時以 `time` 為準。
 */
export function readLightingParameters(parameters: URLSearchParams, base: LightingState): LightingState {
  const requestedWeather = parameters.get('weather');
  const requestedMoment = parseSolarMoment(parameters.get('time'));
  const night = requestedWeather === 'night';
  const weather = night ? 'clear' : isWeather(requestedWeather) ? requestedWeather : base.weather;
  const moment = requestedMoment
    ?? (night ? { ...base.moment, minutes: NIGHT_ALIAS_MINUTES } : base.moment);
  return Object.freeze({ moment: assertSolarMoment(moment), weather });
}

export function sameLightingState(a: LightingState, b: LightingState): boolean {
  return a.weather === b.weather
    && a.moment.year === b.moment.year
    && a.moment.month === b.moment.month
    && a.moment.day === b.moment.day
    && a.moment.minutes === b.moment.minutes;
}

/**
 * 把目前的光寫回網址參數。和場景自帶的設定相同時不寫，網址保持乾淨；
 * 使用者自己調過才帶上 `time` 與 `weather`，複製網址就能分享同一個畫面。
 */
export function writeLightingParameters(
  parameters: URLSearchParams,
  state: LightingState,
  scenePreset: LightingState,
): void {
  if (sameLightingState(state, scenePreset)) {
    parameters.delete('time');
    parameters.delete('weather');
    return;
  }
  parameters.set('time', formatSolarMoment(state.moment));
  parameters.set('weather', state.weather);
}

export function withMinutes(state: LightingState, minutes: number): LightingState {
  const clamped = Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round(minutes)));
  return Object.freeze({ ...state, moment: { ...state.moment, minutes: clamped } });
}

export function withDate(state: LightingState, date: { month: number; day: number }): LightingState {
  return Object.freeze({
    ...state,
    moment: assertSolarMoment({ ...state.moment, month: date.month, day: date.day }),
  });
}

export function withWeather(state: LightingState, weather: Weather): LightingState {
  if (!isWeather(weather)) throw new TypeError(`Weather is unknown: ${String(weather)}`);
  return Object.freeze({ ...state, weather });
}
