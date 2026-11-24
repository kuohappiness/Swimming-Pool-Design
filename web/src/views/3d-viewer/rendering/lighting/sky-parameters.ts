import { dayOfYear } from './solar-moment';
import type { LinearColor, SunLighting, Weather } from './sun-lighting';

/**
 * 天空著色器要的數值，全部由 `SunLighting` 推出來：天空和場景的光用同一份狀態，
 * 所以太陽多高、天多亮、雲多厚，畫面上的天空與打在建築上的光一定一致。
 * 顏色都是線性的亮度（和被照亮的表面同一個尺度）。
 */
export interface SkyParameters {
  /** 大氣的混濁度：越大越灰白、太陽周圍的光暈越大。 */
  readonly turbidity: number;
  readonly rayleigh: number;
  readonly mieCoefficient: number;
  readonly mieDirectionalG: number;
  /** 晴空散射光的整體亮度。 */
  readonly atmosphereScale: number;
  /** 日面的亮度；太陽在地平線下或主光源已換成月光時為零。 */
  readonly sunDiscColor: LinearColor;
  /** 太陽剛落到地平線下時，朝太陽那一側地平線的餘暉。 */
  readonly twilightColor: LinearColor;
  /** 夜空的底色。 */
  readonly nightColor: LinearColor;
  /** 星星的可見度，0 到 1。 */
  readonly stars: number;
  /** 月面的亮度；白天為零。 */
  readonly moonColor: LinearColor;
  /** 雲量，0（無雲）到 1（滿天）。 */
  readonly cloudCover: number;
  /** 雲受光那一面與雲底的亮度。 */
  readonly cloudLit: LinearColor;
  readonly cloudShade: LinearColor;
  /** 雲的位置：隨時刻慢慢飄，每一天的雲也不一樣。 */
  readonly cloudOffset: readonly [number, number];
  /** 地平線以下（基地以外）地面的亮度。 */
  readonly groundColor: LinearColor;
}

const CLOUD_COVER: Readonly<Record<Weather, number>> = Object.freeze({
  clear: 0.3,
  overcast: 1,
  rain: 1,
});

/** 臺中市區常見的晴天：有一點霾，天空不是高山上那種深藍。 */
const CLEAR_SKY = Object.freeze({
  turbidity: 2.8,
  rayleigh: 2.2,
  mieCoefficient: 0.004,
  mieDirectionalG: 0.8,
});
/** 晴空模型的輸出換成場景亮度的倍率：讓晴天正午的天空平均亮度和天光（半球光）的照度相稱。 */
const ATMOSPHERE_SCALE = 0.5;
const SUN_DISC_GAIN = 28;
const MOON_DISC: LinearColor = [1.5, 1.6, 1.8];
const TWILIGHT: LinearColor = [0.62, 0.3, 0.14];
/** 基地以外地面的反射率：中性的淺灰，當模型的襯底，不搶建築的顏色（周邊校園是下一階段）。 */
const GROUND_ALBEDO: LinearColor = [0.58, 0.6, 0.62];
/** 雲每分鐘飄多遠（雜訊貼圖座標）。 */
const CLOUD_DRIFT_PER_MINUTE: readonly [number, number] = [0.00042, 0.00015];

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const scale = (color: LinearColor, factor: number): LinearColor => [
  color[0] * factor,
  color[1] * factor,
  color[2] * factor,
];
const add = (a: LinearColor, b: LinearColor): LinearColor => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
const multiply = (a: LinearColor, b: LinearColor): LinearColor => [
  a[0] * b[0],
  a[1] * b[1],
  a[2] * b[2],
];
const fract = (value: number) => value - Math.floor(value);

export function deriveSkyParameters(lighting: SunLighting): SkyParameters {
  const { daylight, night } = lighting.factors;
  const cloudCover = CLOUD_COVER[lighting.weather];
  if (cloudCover === undefined)
    throw new TypeError(`Weather is unknown: ${String(lighting.weather)}`);

  // 一片均勻亮度 L 的天空給地面的照度是 πL；所以照度除以 π 就是「看起來」的亮度。
  const skyRadiance = scale(lighting.sky.color, lighting.sky.intensity / Math.PI);
  const keyIrradiance = scale(lighting.key.color, lighting.key.intensity);
  const sunUp = lighting.key.source === 'sun';

  // 曙暮光只補太陽在地平線下的那一段；太陽還在地平線上時，日出日落的顏色由散射模型自己算出來。
  const twilight =
    smoothstep(-9, -3, lighting.altitude) * (1 - smoothstep(-2, 2.5, lighting.altitude));
  const minutes = lighting.moment.minutes;
  const daySeed = fract(dayOfYear(lighting.moment) * 0.137);

  return Object.freeze({
    ...CLEAR_SKY,
    atmosphereScale: ATMOSPHERE_SCALE,
    sunDiscColor: scale(keyIrradiance, sunUp ? SUN_DISC_GAIN : 0),
    twilightColor: scale(TWILIGHT, twilight * (1 - cloudCover * 0.8)),
    nightColor: scale(skyRadiance, 1 - daylight),
    stars: night * (1 - cloudCover),
    moonColor: scale(MOON_DISC, night),
    cloudCover,
    cloudLit: add(scale(keyIrradiance, 0.55 / Math.PI), skyRadiance),
    cloudShade: scale(skyRadiance, 0.7),
    cloudOffset: [
      fract(daySeed + minutes * CLOUD_DRIFT_PER_MINUTE[0]),
      fract(daySeed * 1.7 + minutes * CLOUD_DRIFT_PER_MINUTE[1]),
    ] as const,
    groundColor: multiply(
      GROUND_ALBEDO,
      add(skyRadiance, scale(keyIrradiance, Math.max(0, lighting.key.direction.z) / Math.PI)),
    ),
  });
}
