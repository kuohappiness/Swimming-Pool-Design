// npm run build:textures：把 tools/build/textures/ 的自製貼圖轉成 KTX2 壓縮貼圖（DEC-190）。
//
// 轉檔結果入庫，CI 不重轉；CI 只用 findStaleTextures 確認「產生貼圖的程式或設定改了卻沒重轉」
// 不會發生。來源像素與轉檔設定的雜湊記在資產清單的 conversion.sourceSha256。
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TEXTURE_RECIPES } from './textures/index.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const viewerRoot = resolve(repoRoot, 'web/src/views/3d-viewer');
const manifestPath = resolve(viewerRoot, 'assets/asset-manifest.json');

export const TEXTURE_ENCODER = 'ktx2-encoder@0.6.0';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** 一張貼圖的轉檔設定；任何一項改了都要重轉。 */
export function conversionSettings(recipe) {
  return {
    encoder: TEXTURE_ENCODER,
    format: 'uastc',
    width: recipe.width,
    height: recipe.height,
    mipmaps: true,
    colorSpace: recipe.colorSpace,
    normalMap: recipe.normalMap,
  };
}

/** 來源像素加轉檔設定的雜湊：不必真的轉檔就能判斷入庫的檔案是否過期。 */
export function sourceHash(recipe, pixels) {
  if (pixels.byteLength !== recipe.width * recipe.height * 4) {
    throw new RangeError(`${recipe.manifest.id} must generate ${recipe.width}×${recipe.height} RGBA pixels.`);
  }
  return createHash('sha256')
    .update(JSON.stringify(conversionSettings(recipe)))
    .update(pixels)
    .digest('hex');
}

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

async function readIfExists(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * 找出需要重轉的貼圖：清單沒有登錄、來源雜湊不符、檔案不存在或檔案內容與清單不符。
 * 回傳的每一項含原因；空陣列代表入庫的貼圖都是最新的。
 */
export async function findStaleTextures(recipes = TEXTURE_RECIPES) {
  const manifest = await readManifest();
  const stale = [];
  for (const recipe of recipes) {
    const { id, localPath } = recipe.manifest;
    const entry = manifest.assets.find((asset) => asset.id === id);
    const pixels = recipe.generate();
    const expected = sourceHash(recipe, pixels);
    const file = await readIfExists(resolve(viewerRoot, localPath));
    let reason = null;
    if (!entry) reason = '資產清單沒有這一筆';
    else if (entry.conversion?.sourceSha256 !== expected) reason = '產生貼圖的程式或轉檔設定改了';
    else if (!file) reason = '轉檔後的檔案不存在';
    else if (sha256(file) !== entry.sha256 || file.byteLength !== entry.byteSize) reason = '檔案內容與資產清單不符';
    if (reason) stale.push({ id, localPath, reason, recipe, pixels, expected });
  }
  return stale;
}

async function encode(recipe, pixels) {
  const { encodeToKTX2 } = await import('ktx2-encoder');
  // 編碼器的 WASM 會把逐層進度印到標準輸出；轉檔期間先收起來。
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await encodeToKTX2(new Uint8Array(1), {
      isKTX2File: true,
      isUASTC: true,
      needSupercompression: true,
      generateMipmap: true,
      isNormalMap: recipe.normalMap,
      isPerceptual: recipe.colorSpace === 'srgb',
      isSetKTX2SRGBTransferFunc: recipe.colorSpace === 'srgb',
      // 授權寫進檔案本身，檔案離開 repo 也查得到。
      kvData: { license: `SPDX-License-Identifier: ${recipe.manifest.license}` },
      imageDecoder: async () => ({ data: pixels, width: recipe.width, height: recipe.height }),
    });
  } finally {
    console.log = originalLog;
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const stale = await findStaleTextures();
  const staleIds = new Set(stale.map(({ id }) => id));
  const work = force
    ? TEXTURE_RECIPES.map((recipe) => {
      const pixels = recipe.generate();
      return { id: recipe.manifest.id, localPath: recipe.manifest.localPath, reason: '--force', recipe, pixels, expected: sourceHash(recipe, pixels) };
    })
    : stale;

  for (const recipe of TEXTURE_RECIPES) {
    if (!force && !staleIds.has(recipe.manifest.id)) console.log(`up to date  ${recipe.manifest.localPath}`);
  }
  if (work.length === 0) return;

  const manifest = await readManifest();
  for (const { id, localPath, reason, recipe, pixels, expected } of work) {
    const started = performance.now();
    const bytes = await encode(recipe, pixels);
    const outputPath = resolve(viewerRoot, localPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes);

    const entry = {
      ...recipe.manifest,
      qualityTiers: [...recipe.manifest.qualityTiers],
      sha256: sha256(bytes),
      byteSize: bytes.byteLength,
      conversion: { ...conversionSettings(recipe), sourceSha256: expected },
    };
    const index = manifest.assets.findIndex((asset) => asset.id === id);
    if (index === -1) manifest.assets.push(entry);
    else manifest.assets[index] = entry;
    console.log(
      `encoded     ${localPath}  ${(bytes.byteLength / 1024).toFixed(1)} KB  `
      + `${Math.round(performance.now() - started)} ms  (${reason})`,
    );
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
