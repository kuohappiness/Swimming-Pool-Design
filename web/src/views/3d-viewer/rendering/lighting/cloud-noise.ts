/**
 * 雲用的雜訊：一張上下左右都能接起來的灰階圖，在天空著色器裡疊幾層不同大小來取樣。
 * 由固定的亂數種子產生，不必另外下載圖檔，每次開頁面的雲也都一樣。
 */
export interface CloudNoise {
  readonly size: number;
  readonly data: Uint8Array;
}

/** 可重現的亂數（mulberry32）。 */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param size 圖的邊長（像素）。
 * @param cells 一邊分成幾格；格點上放亂數，格點之間平滑內插。必須整除 size。
 */
export function createCloudNoise(size = 256, cells = 16, seed = 20261122): CloudNoise {
  if (
    !Number.isInteger(size) ||
    !Number.isInteger(cells) ||
    size <= 0 ||
    cells <= 0 ||
    size % cells !== 0
  ) {
    throw new RangeError('Cloud noise size must be a positive multiple of its cell count.');
  }
  const random = createRandom(seed);
  const lattice = Float32Array.from({ length: cells * cells }, () => random());
  const at = (x: number, y: number) => lattice[(y % cells) * cells + (x % cells)] ?? 0;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const step = cells / size;
  const data = new Uint8Array(size * size);
  for (let row = 0; row < size; row += 1) {
    const y = row * step;
    const y0 = Math.floor(y);
    const ty = fade(y - y0);
    for (let column = 0; column < size; column += 1) {
      const x = column * step;
      const x0 = Math.floor(x);
      const tx = fade(x - x0);
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      data[row * size + column] = Math.round((top + (bottom - top) * ty) * 255);
    }
  }
  return { size, data };
}
