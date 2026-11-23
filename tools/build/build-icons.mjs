// npm run build:icons：網站圖示與社群分享預覽圖（TASK-172）。
// 從校徽原始檔 SRC-SITE-005 與網站字型子集，以 Chrome 繪出三個衍生檔到 web/public/：
//   favicon-32.png（瀏覽器分頁）、apple-touch-icon.png（180 × 180，加到主畫面）、
//   share-card.png（1200 × 630，社群分享預覽）。
// 需要 Chrome 或 Edge（以 CHROME_PATH 指定），所以不在 npm run build 裡；產物入庫，
// 校徽或標題文字改了再手動重跑。原始檔只讀不改。
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { buildFonts } from './build-fonts.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const emblem = resolve(repoRoot, 'source-materials/site/SRC-SITE-005_school-emblem-transparent.png');
const outDir = resolve(repoRoot, 'web/public');
const fontsCss = resolve(repoRoot, 'web/src/generated/fonts/fonts.css');

const browserCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

async function firstExisting(paths) {
  for (const path of paths) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('Chrome or Edge executable was not found; set CHROME_PATH.');
}

// 與 web/src/design-system/tokens.css 相同的色票。
const paper = '#f4f0e8';
const ink = '#1e292a';
const muted = '#586263';
const water = '#176f76';
const terracotta = '#a64f35';
const line = '#c8c5bc';

const emblemUrl = pathToFileURL(emblem).href;

function iconPage(size, { background, inset }) {
  return `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${background}; }
  body { display: grid; place-items: center; }
  img { width: ${size - inset * 2}px; height: ${size - inset * 2}px; object-fit: contain; }
</style>
<img src="${emblemUrl}" alt="">`;
}

const sharePage = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(fontsCss).href}">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; background: ${paper}; }
  body {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 220px 1fr;
    column-gap: 56px;
    align-items: center;
    padding: 72px 88px;
    border-bottom: 16px solid ${water};
    color: ${ink};
    font-family: "Noto Sans TC Web", sans-serif;
  }
  img { width: 220px; height: 220px; object-fit: contain; }
  p { margin: 0; }
  .school { color: ${muted}; font-size: 26px; font-weight: 500; }
  h1 {
    margin: 18px 0 22px;
    font-family: "Noto Serif TC Web", serif;
    font-size: 70px;
    white-space: nowrap;
    font-weight: 700;
    line-height: 1.15;
  }
  .directions {
    padding-top: 22px;
    border-top: 2px solid ${line};
    color: ${water};
    font-family: "Noto Serif TC Web", serif;
    font-size: 40px;
    font-weight: 700;
  }
  .directions span { color: ${terracotta}; }
</style>
<img src="${emblemUrl}" alt="">
<div>
  <p class="school">國立臺中教育大學附設實驗國民小學</p>
  <h1>實小泳池改建概念設計</h1>
  <p class="directions">向光<span>、</span>向雨<span>、</span>向人<span>、</span>向時間</p>
</div>`;

const outputs = [
  { file: 'favicon-32.png', width: 32, height: 32, html: iconPage(32, { background: 'transparent', inset: 0 }) },
  { file: 'apple-touch-icon.png', width: 180, height: 180, html: iconPage(180, { background: paper, inset: 22 }) },
  { file: 'share-card.png', width: 1200, height: 630, html: sharePage },
];

await buildFonts();
const workDir = await mkdtemp(join(tmpdir(), 'icons-'));
// 字型以 file:// 載入，需要允許本機檔案互相讀取。
const browser = await chromium.launch({
  executablePath: await firstExisting(browserCandidates),
  headless: true,
  args: ['--allow-file-access-from-files'],
});
try {
  for (const { file, width, height, html } of outputs) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const source = join(workDir, `${file}.html`);
    await writeFile(source, html);
    await page.goto(pathToFileURL(source).href, { waitUntil: 'load' });
    await page.evaluate('document.fonts.ready');
    const output = join(outDir, file);
    await page.screenshot({ path: output, omitBackground: file === 'favicon-32.png' });
    await page.close();
    console.log(relative(repoRoot, output));
  }
} finally {
  await browser.close();
  await rm(workDir, { recursive: true, force: true });
}
