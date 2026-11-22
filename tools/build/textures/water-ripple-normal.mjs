// 水面細波紋的法線貼圖：可無縫拼接、不含任何方向性，供水面著色器以兩種尺度與方向疊加取樣。
// 內容完全由下面的數字決定，同樣的設定在任何機器上產生同樣的像素。

const SIZE = 512;
const WAVE_COUNT = 96;
const MINIMUM_WAVE_NUMBER = 2;
const MAXIMUM_WAVE_NUMBER = 48;
/** 振幅隨波數衰減的指數：越大，長波越明顯、細紋越淡。 */
const SPECTRUM_FALLOFF = 1.7;
/** 整張圖的均方根坡度，決定法線偏離垂直的程度。 */
const TARGET_RMS_SLOPE = 0.22;
const SEED = 0x51f15e;

/** mulberry32：小而固定的亂數產生器，只為了讓結果可重現。 */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createWaves() {
  const random = createRandom(SEED);
  const waves = [];
  while (waves.length < WAVE_COUNT) {
    // 波數取整數，圖的左右、上下邊才接得起來。
    const magnitude = MINIMUM_WAVE_NUMBER
      + (MAXIMUM_WAVE_NUMBER - MINIMUM_WAVE_NUMBER) * random() ** 2;
    const angle = random() * Math.PI * 2;
    const kx = Math.round(Math.cos(angle) * magnitude);
    const ky = Math.round(Math.sin(angle) * magnitude);
    const length = Math.hypot(kx, ky);
    const phase = random() * Math.PI * 2;
    if (length < MINIMUM_WAVE_NUMBER) continue;
    waves.push({ kx, ky, phase, amplitude: length ** -SPECTRUM_FALLOFF });
  }
  return waves;
}

/**
 * 波紋在每個像素的坡度（高度對 x、y 的偏微分）與把它縮放到目標均方根坡度的倍率。
 * 焦散貼圖用同一片水面去追光線，所以另外匯出。
 */
export function rippleSlopeField() {
  const waves = createWaves();
  const slopeX = new Float32Array(SIZE * SIZE);
  const slopeY = new Float32Array(SIZE * SIZE);
  const tau = Math.PI * 2;
  let squared = 0;

  for (const { kx, ky, phase, amplitude } of waves) {
    // 高度是 amplitude × cos(θ)，坡度是它對 x、y 的偏微分。
    const cosX = new Float32Array(SIZE);
    const sinX = new Float32Array(SIZE);
    for (let x = 0; x < SIZE; x += 1) {
      cosX[x] = Math.cos((tau * kx * x) / SIZE);
      sinX[x] = Math.sin((tau * kx * x) / SIZE);
    }
    for (let y = 0; y < SIZE; y += 1) {
      const rowAngle = (tau * ky * y) / SIZE + phase;
      const cosY = Math.cos(rowAngle);
      const sinY = Math.sin(rowAngle);
      const row = y * SIZE;
      for (let x = 0; x < SIZE; x += 1) {
        const sine = sinX[x] * cosY + cosX[x] * sinY;
        slopeX[row + x] -= amplitude * tau * kx * sine;
        slopeY[row + x] -= amplitude * tau * ky * sine;
      }
    }
  }

  for (let index = 0; index < slopeX.length; index += 1) {
    squared += slopeX[index] ** 2 + slopeY[index] ** 2;
  }
  // 坡度乘上 scale 才是實際值；分開回傳，使用端以雙精度相乘，法線貼圖的像素才不會因捨入而變動。
  return { size: SIZE, slopeX, slopeY, scale: TARGET_RMS_SLOPE / Math.sqrt(squared / slopeX.length) };
}

export const waterRippleNormal = Object.freeze({
  manifest: Object.freeze({
    id: 'material-water-ripple-normal-v1',
    kind: 'texture',
    purpose: 'Seamless isotropic ripple normal map sampled at two scales by the water surface shader.',
    localPath: 'assets/materials/water/ripple-normal.ktx2',
    source: 'project-authored:tools/build/textures/water-ripple-normal.mjs',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    qualityTiers: Object.freeze(['high', 'medium']),
    requirement: 'optional',
    loadingPriority: 'scene-ready',
  }),
  width: SIZE,
  height: SIZE,
  colorSpace: 'linear',
  normalMap: true,
  /** 回傳 RGBA 位元組；第一列對應貼圖座標 v = 0。 */
  generate() {
    const { slopeX, slopeY, scale } = rippleSlopeField();

    const pixels = new Uint8Array(SIZE * SIZE * 4);
    for (let index = 0; index < slopeX.length; index += 1) {
      const nx = -slopeX[index] * scale;
      const ny = -slopeY[index] * scale;
      const inverseLength = 1 / Math.hypot(nx, ny, 1);
      pixels[index * 4] = Math.round((nx * inverseLength * 0.5 + 0.5) * 255);
      pixels[index * 4 + 1] = Math.round((ny * inverseLength * 0.5 + 0.5) * 255);
      pixels[index * 4 + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
      pixels[index * 4 + 3] = 255;
    }
    return pixels;
  },
});
