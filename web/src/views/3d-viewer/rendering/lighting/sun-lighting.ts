import {
  calculateSolarPosition,
  solarDirectionInLocalCoordinates,
} from '../../../../../../core/solar/solar-reflection.mjs';
import { assertSolarMoment, type SolarMoment } from './solar-moment';

/**
 * 某個時刻的光：太陽在哪裡、陽光與天光是什麼顏色、多亮。
 *
 * 太陽位置用日照研究頁同一支函式（`core/solar/solar-reflection.mjs`），所以兩頁對同一個時刻
 * 的太陽高度與方位一定相同。顏色與強度是視覺用的近似：陽光穿過大氣越斜、路徑越長、
 * 藍光被散射掉越多，所以低角度的陽光偏暖偏暗。這些數值不是日照量的計算，日照量仍以
 * 日照研究頁為準。
 */

export type Weather = 'clear' | 'overcast' | 'rain';
export const WEATHERS: readonly Weather[] = Object.freeze(['clear', 'overcast', 'rain']);
export const WEATHER_LABELS: Readonly<Record<Weather, string>> = Object.freeze({
  clear: '晴',
  overcast: '陰',
  rain: '雨',
});

export type LinearColor = readonly [number, number, number];
export interface SiteVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SunLightingInput {
  readonly moment: SolarMoment;
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly utcOffsetHours: number;
  };
  /** SITE-XY 的 +X 軸相對真北的方位角（度，順時針）。 */
  readonly positiveXAxisBearingFromTrueNorth: number;
  readonly weather: Weather;
}

export type DayPhase = 'day' | 'twilight' | 'night';

export interface SunLighting {
  readonly moment: SolarMoment;
  readonly weather: Weather;
  /** 太陽高度角（度），地平線以下為負。 */
  readonly altitude: number;
  /** 太陽方位角（度，從真北順時針）。 */
  readonly azimuth: number;
  readonly phase: DayPhase;
  /** 指向太陽的單位向量，SITE 座標（Z 向上）。太陽在地平線下時 z 為負。 */
  readonly sunDirection: SiteVector;
  /** 指向月亮的單位向量（太陽對面、固定仰角）。白天也有值，但只有入夜後才用得到。 */
  readonly moonDirection: SiteVector;
  /**
   * 晝夜的三個漸變量，0 到 1：`daylight` 白天的程度（民用曙暮光開始到太陽 12° 高）、
   * `night` 夜晚的程度（太陽低於 −3° 開始，−9° 全黑）、`dusk` 日出日落的暖色（太陽貼近地平線時最強）。
   * 天空與光用同一組數字，兩者才會一起變。
   */
  readonly factors: { readonly daylight: number; readonly night: number; readonly dusk: number };
  /**
   * 主光源的方向與顏色。白天是太陽；入夜後換成月光（方向取太陽的對面、固定仰角），
   * 讓夜間仍有一點方向性的光與影子。方向一定在地平線以上。
   */
  readonly key: {
    readonly source: 'sun' | 'moon';
    readonly direction: SiteVector;
    readonly color: LinearColor;
    readonly intensity: number;
    /**
     * 光源看起來的半徑（弧度），決定影子邊緣多柔：晴天的日面很小，影子邊緣利；
     * 隔著雲層時整片雲都在發光，影子糊成一片。
     */
    readonly angularRadius: number;
  };
  /** 天光（半球光）：上方是天空的顏色，下方是地面反上來的顏色。 */
  readonly sky: {
    readonly color: LinearColor;
    readonly groundColor: LinearColor;
    readonly intensity: number;
  };
  /** 背景與遠處霧的顏色（線性色）。 */
  readonly horizon: LinearColor;
  readonly fog: { readonly near: number; readonly far: number };
  readonly exposure: number;
}

const RADIANS = Math.PI / 180;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixColor = (a: LinearColor, b: LinearColor, t: number): LinearColor => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];
const scaleColor = (color: LinearColor, factor: number): LinearColor => [
  color[0] * factor,
  color[1] * factor,
  color[2] * factor,
];
const luminance = (color: LinearColor) => 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];

/**
 * 相對光學空氣質量（Kasten 與 Young 1989）：陽光穿過的大氣厚度是垂直入射時的幾倍。
 * 太陽在天頂是 1，在地平線約 38。
 */
export function relativeAirMass(altitudeDegrees: number): number {
  const altitude = Math.max(altitudeDegrees, -0.5);
  return 1 / (Math.sin(altitude * RADIANS) + 0.50572 * (altitude + 6.07995) ** -1.6364);
}

/**
 * 紅、綠、藍三個波段（約 680、550、440 nm）垂直穿過大氣的光學厚度：
 * 空氣分子的瑞利散射加上都市常見的懸浮微粒（Ångström β 0.1、α 1.3）與少量臭氧吸收。
 */
const VERTICAL_OPTICAL_DEPTH: LinearColor = [
  0.0408 + 0.165 + 0.013,
  0.0973 + 0.2175 + 0.03,
  0.2428 + 0.291 + 0.001,
];

/** 陽光穿過大氣後剩下的比例（紅、綠、藍）。 */
export function atmosphericTransmittance(altitudeDegrees: number): LinearColor {
  const airMass = relativeAirMass(altitudeDegrees);
  return [
    Math.exp(-VERTICAL_OPTICAL_DEPTH[0] * airMass),
    Math.exp(-VERTICAL_OPTICAL_DEPTH[1] * airMass),
    Math.exp(-VERTICAL_OPTICAL_DEPTH[2] * airMass),
  ];
}

const ZENITH_TRANSMITTANCE = atmosphericTransmittance(90);
const ZENITH_LUMINANCE = luminance(ZENITH_TRANSMITTANCE);

/**
 * 太陽在天頂、晴天時主光源的強度（three.js 的光強單位：垂直照在表面上的照度）。
 *
 * 和下面的天光是一組：晴天時直射光大約是天空漫射光的四到五倍，影子裡才會明顯比陽光下暗。
 * 兩者的比例取自晴天的實測量級（都市有霾時直射與漫射約 4:1 到 7:1），絕對值配合曝光決定。
 */
export const SUN_ZENITH_INTENSITY = 4.5;
/**
 * 晴天正午，整片天空照在水平面上的漫射照度。場景裡這份光由半球光與環境貼圖一起提供，
 * 兩者加起來等於這個數字（怎麼分在 `environment-effect.ts`）。
 */
export const SKY_NOON_INTENSITY = 1;

/**
 * 晴天時日面（與月面）看起來的半徑。實際約 0.27°；這裡放大到 0.4°，
 * 因為陰影貼圖一格約 4 公分，照實際大小算出來的半影在多數地方不到一格，看不出遠近的差別。
 */
const CLEAR_SOURCE_RADIUS_DEGREES = 0.4;

/** 各種天氣下，直射陽光與天光各剩多少，以及曝光與霧的遠近。 */
const WEATHER_FACTORS: Readonly<
  Record<
    Weather,
    {
      readonly sun: number;
      readonly sky: number;
      /** 陽光與天光被雲層染成灰白的程度，0 到 1。 */
      readonly grey: number;
      /** 主光源看起來的半徑（度）。 */
      readonly sourceRadiusDegrees: number;
      readonly exposure: number;
      readonly fog: { readonly near: number; readonly far: number };
    }
  >
> = Object.freeze({
  clear: Object.freeze({
    sun: 1,
    sky: 1,
    grey: 0,
    sourceRadiusDegrees: CLEAR_SOURCE_RADIUS_DEGREES,
    exposure: 0.75,
    fog: Object.freeze({ near: 72, far: 148 }),
  }),
  overcast: Object.freeze({
    sun: 0.1,
    sky: 0.95,
    grey: 0.85,
    sourceRadiusDegrees: 3,
    exposure: 1.35,
    fog: Object.freeze({ near: 62, far: 132 }),
  }),
  rain: Object.freeze({
    sun: 0.035,
    sky: 0.6,
    grey: 1,
    sourceRadiusDegrees: 4.5,
    exposure: 1.5,
    fog: Object.freeze({ near: 48, far: 112 }),
  }),
});

/** 太陽在天頂時直射光的顏色：相對於天光略暖的白。 */
const SUN_ZENITH_TINT: LinearColor = [1, 0.95, 0.87];
const CLOUD_GREY: LinearColor = [0.78, 0.8, 0.82];
const SKY_DAY: LinearColor = [0.8, 0.9, 1];
const SKY_DUSK: LinearColor = [0.92, 0.66, 0.5];
const SKY_NIGHT: LinearColor = [0.2, 0.27, 0.46];
/**
 * 地面把照到它的陽光與天光反射回來的比例，給朝下的面（屋簷、樓板底）當補光。
 * 池畔、水面與基地地坪的折衷值，視覺用，不是材料量測值。
 */
const GROUND_BOUNCE: LinearColor = [0.3, 0.28, 0.25];
const HORIZON_DAY: LinearColor = [0.65, 0.72, 0.75];
const HORIZON_DUSK: LinearColor = [0.8, 0.62, 0.5];
const HORIZON_NIGHT: LinearColor = [0.012, 0.018, 0.035];
const MOON_COLOR: LinearColor = [0.62, 0.72, 1];
const MOON_INTENSITY = 0.3;
const MOON_ALTITUDE = 48;
/**
 * 夜裡的天光：城市夜空的散射光。仍比真實的夜晚亮（夜景攝影般的曝光），讓量體在夜裡讀得出輪廓；
 * 池館裡的亮度由燈具負責（`fixture-lights.ts`），室內約是室外的三到五倍。
 */
const SKY_NIGHT_INTENSITY = 0.1;
/** 入夜後曝光拉高的倍數，像眼睛適應暗處。對晴天的曝光而言。 */
const NIGHT_EXPOSURE_GAIN = 2.2;
/** 主光源的最低仰角：再低，影子會長到看不出形狀，陰影貼圖也用不上。 */
const MINIMUM_KEY_ALTITUDE = 2;

function siteDirection(altitude: number, azimuth: number, bearing: number): SiteVector {
  const direction = solarDirectionInLocalCoordinates({ altitude, azimuth }, bearing);
  return Object.freeze({ x: direction.x, y: direction.y, z: direction.z });
}

export function computeSunLighting(input: SunLightingInput): SunLighting {
  const moment = assertSolarMoment(input.moment);
  const weather = WEATHER_FACTORS[input.weather];
  if (!weather) throw new TypeError(`Weather is unknown: ${String(input.weather)}`);
  const bearing = input.positiveXAxisBearingFromTrueNorth;
  if (!Number.isFinite(bearing)) throw new TypeError('Site bearing must be finite.');

  const solar = calculateSolarPosition({
    year: moment.year,
    month: moment.month,
    day: moment.day,
    hour: Math.floor(moment.minutes / 60),
    minute: moment.minutes % 60,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    utcOffsetHours: input.location.utcOffsetHours,
  });
  const { altitude, azimuth } = solar;

  // 日面穿過地平線大約是 -0.8° 到 +1.5°；民用曙暮光到 -6° 為止。
  const sunAbove = smoothstep(-0.8, 1.5, altitude);
  const daylight = smoothstep(-6, 12, altitude);
  const night = 1 - smoothstep(-9, -3, altitude);
  // 太陽很低時天空與地平線帶暖色，升高或沉到地平線下之後消失。
  const dusk = smoothstep(-5, 1, altitude) * (1 - smoothstep(3, 16, altitude));

  // 顏色以「太陽在天頂時」為基準：那時是白平衡下略暖的白光，越低越偏橘紅。
  const transmittance = atmosphericTransmittance(altitude);
  const relative: LinearColor = [
    (SUN_ZENITH_TINT[0] * transmittance[0]) / ZENITH_TRANSMITTANCE[0],
    (SUN_ZENITH_TINT[1] * transmittance[1]) / ZENITH_TRANSMITTANCE[1],
    (SUN_ZENITH_TINT[2] * transmittance[2]) / ZENITH_TRANSMITTANCE[2],
  ];
  const peak = Math.max(...relative);
  const sunTint = mixColor(scaleColor(relative, 1 / peak), CLOUD_GREY, weather.grey);
  const sunIntensity =
    SUN_ZENITH_INTENSITY * (luminance(transmittance) / ZENITH_LUMINANCE) * sunAbove * weather.sun;

  const moonIntensity = MOON_INTENSITY * night * weather.sun;
  const moonDirection = siteDirection(MOON_ALTITUDE, azimuth + 180, bearing);
  const useMoon = sunIntensity <= moonIntensity;
  const key = useMoon
    ? {
        source: 'moon' as const,
        direction: moonDirection,
        color: mixColor(MOON_COLOR, CLOUD_GREY, weather.grey * 0.6),
        intensity: moonIntensity,
        angularRadius: weather.sourceRadiusDegrees * RADIANS,
      }
    : {
        source: 'sun' as const,
        direction: siteDirection(Math.max(altitude, MINIMUM_KEY_ALTITUDE), azimuth, bearing),
        color: sunTint,
        intensity: sunIntensity,
        angularRadius: weather.sourceRadiusDegrees * RADIANS,
      };

  // 暖色只加一點：背景目前是單一顏色，整片染成橘紅並不像黃昏；真正的天空漸層在天空那一步做。
  const clearSky = mixColor(mixColor(SKY_NIGHT, SKY_DAY, daylight), SKY_DUSK, dusk * 0.35);
  const skyColor = mixColor(
    clearSky,
    scaleColor(CLOUD_GREY, mix(0.35, 1, daylight)),
    weather.grey * daylight,
  );
  const skyIntensity = mix(SKY_NIGHT_INTENSITY, SKY_NOON_INTENSITY * weather.sky, daylight);
  // 朝下的面看到的是被照亮的地面：地面收到的天光加上陽光的水平分量，再乘上反射比例。
  // 半球光把這個顏色再乘上天光強度，所以這裡先除回去。
  const keyOnGround = (key.intensity * Math.max(0, key.direction.z)) / Math.max(skyIntensity, 1e-3);
  const groundColor: LinearColor = [
    GROUND_BOUNCE[0] * (skyColor[0] + key.color[0] * keyOnGround),
    GROUND_BOUNCE[1] * (skyColor[1] + key.color[1] * keyOnGround),
    GROUND_BOUNCE[2] * (skyColor[2] + key.color[2] * keyOnGround),
  ];
  const clearHorizon = mixColor(
    mixColor(HORIZON_NIGHT, HORIZON_DAY, daylight),
    HORIZON_DUSK,
    dusk * 0.35,
  );
  const horizon = mixColor(
    clearHorizon,
    scaleColor(CLOUD_GREY, mix(0.04, input.weather === 'rain' ? 0.5 : 0.74, daylight)),
    weather.grey,
  );

  return Object.freeze({
    moment,
    weather: input.weather,
    altitude,
    azimuth,
    phase: altitude >= 0 ? 'day' : altitude >= -6 ? 'twilight' : 'night',
    sunDirection: siteDirection(altitude, azimuth, bearing),
    moonDirection,
    factors: Object.freeze({ daylight, night, dusk }),
    key: Object.freeze(key),
    sky: Object.freeze({
      color: skyColor,
      groundColor,
      intensity: skyIntensity,
    }),
    horizon,
    fog: weather.fog,
    // 入夜後把曝光拉高一點，像眼睛適應暗處；完整的曝光適應在鏡頭效果那一步做。
    exposure: weather.exposure * mix(NIGHT_EXPOSURE_GAIN, 1, daylight),
  });
}

const COMPASS_POINTS = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'] as const;

/** 方位角換成八方位的中文說法。 */
export function compassPoint(azimuthDegrees: number): string {
  const index = Math.round((((azimuthDegrees % 360) + 360) % 360) / 45) % 8;
  return COMPASS_POINTS[index] ?? '北';
}

/** 給畫面看的一行說明，例如「太陽高度 23°，在東南方」。 */
export function describeSunLighting(lighting: SunLighting): string {
  if (lighting.phase === 'night') return '夜間，太陽在地平線下';
  if (lighting.phase === 'twilight') {
    return `${lighting.azimuth < 180 ? '天剛亮' : '天將暗'}，太陽在地平線下 ${Math.round(-lighting.altitude)}°`;
  }
  return `太陽高度 ${Math.round(lighting.altitude)}°，在${compassPoint(lighting.azimuth)}方`;
}
