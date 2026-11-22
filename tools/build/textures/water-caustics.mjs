// 池底焦散的明暗圖樣：讓陽光垂直穿過 water-ripple-normal 的那片波紋，折射後落在池底，
// 統計每一格收到多少光。波紋把光聚攏的地方亮、散開的地方暗，就是池底晃動的光網。
// 圖樣可無縫拼接；水面著色器以兩種尺度與方向取樣後取較暗者，看起來就會流動。
import { rippleSlopeField } from './water-ripple-normal.mjs';

/** 追光時把波紋坡度乘上這個倍率，對應水面著色器實際使用的波紋強度。 */
const RIPPLE_STRENGTH = 0.3;
/** 池底深度相對於一塊圖樣邊長的比例：圖樣鋪 2.6 公尺、水深約 1.3 公尺。 */
const DEPTH_PER_TILE = 0.5;
/** 每個像素射出 SUPERSAMPLE² 條光線，壓低雜訊。 */
const SUPERSAMPLE = 3;
/** 亮度 1 是平均照度；存檔時把 0 到這個倍數對應到 0 到 255。 */
export const CAUSTIC_MAXIMUM_GAIN = 4;
const WATER_IOR = 1.333;

function sampleBilinear(field, size, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const wrap = (value) => ((value % size) + size) % size;
  const xa = wrap(x0);
  const xb = wrap(x0 + 1);
  const ya = wrap(y0) * size;
  const yb = wrap(y0 + 1) * size;
  return (field[ya + xa] * (1 - fx) + field[ya + xb] * fx) * (1 - fy)
    + (field[yb + xa] * (1 - fx) + field[yb + xb] * fx) * fy;
}

/** 回傳每個像素相對於平均照度的倍率（Float64Array，平均為 1）。 */
export function causticIrradiance() {
  const { size, slopeX, slopeY, scale } = rippleSlopeField();
  const strength = scale * RIPPLE_STRENGTH;
  const irradiance = new Float64Array(size * size);
  const wrap = (value) => ((value % size) + size) % size;
  const eta = 1 / WATER_IOR;

  for (let row = 0; row < size * SUPERSAMPLE; row += 1) {
    for (let column = 0; column < size * SUPERSAMPLE; column += 1) {
      const x = (column + 0.5) / SUPERSAMPLE - 0.5;
      const y = (row + 0.5) / SUPERSAMPLE - 0.5;
      // 水面法線；光線垂直向下入射。
      const nx = -sampleBilinear(slopeX, size, x, y) * strength;
      const ny = -sampleBilinear(slopeY, size, x, y) * strength;
      const inverseLength = 1 / Math.hypot(nx, ny, 1);
      const cosIncident = inverseLength;
      const cosRefracted = Math.sqrt(1 - eta * eta * (1 - cosIncident * cosIncident));
      const along = eta * cosIncident - cosRefracted;
      // 折射方向的水平分量除以垂直分量，再乘深度，就是落點的水平位移（以像素計）。
      const vertical = eta - along * inverseLength;
      const offset = (DEPTH_PER_TILE * size) / vertical;
      const hitX = x + along * nx * inverseLength * offset;
      const hitY = y + along * ny * inverseLength * offset;

      const x0 = Math.floor(hitX);
      const y0 = Math.floor(hitY);
      const fx = hitX - x0;
      const fy = hitY - y0;
      const xa = wrap(x0);
      const xb = wrap(x0 + 1);
      const ya = wrap(y0) * size;
      const yb = wrap(y0 + 1) * size;
      irradiance[ya + xa] += (1 - fx) * (1 - fy);
      irradiance[ya + xb] += fx * (1 - fy);
      irradiance[yb + xa] += (1 - fx) * fy;
      irradiance[yb + xb] += fx * fy;
    }
  }

  const perPixel = SUPERSAMPLE * SUPERSAMPLE;
  for (let index = 0; index < irradiance.length; index += 1) irradiance[index] /= perPixel;
  return { size, irradiance };
}

export const waterCaustics = Object.freeze({
  manifest: Object.freeze({
    id: 'material-water-caustics-v1',
    kind: 'texture',
    purpose: 'Seamless pool-floor caustic irradiance traced through the ripple field; grey value 255 is four times the mean.',
    localPath: 'assets/materials/water/caustics.ktx2',
    source: 'project-authored:tools/build/textures/water-caustics.mjs',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    qualityTiers: Object.freeze(['high', 'medium', 'low']),
    requirement: 'optional',
    loadingPriority: 'scene-ready',
  }),
  width: 512,
  height: 512,
  colorSpace: 'linear',
  normalMap: false,
  generate() {
    const { size, irradiance } = causticIrradiance();
    const pixels = new Uint8Array(size * size * 4);
    for (let index = 0; index < irradiance.length; index += 1) {
      const value = Math.round(Math.min(irradiance[index] / CAUSTIC_MAXIMUM_GAIN, 1) * 255);
      pixels[index * 4] = value;
      pixels[index * 4 + 1] = value;
      pixels[index * 4 + 2] = value;
      pixels[index * 4 + 3] = 255;
    }
    return pixels;
  },
});
