import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const repoRoot = resolve(import.meta.dirname, '..');
const outputPath = resolve(repoRoot, 'docs/public/website-copy-v1.0.md');
const previewPort = 4175;
const suppliedOrigin = process.env.COPY_BASE_URL?.replace(/\/$/, '');
const origin = suppliedOrigin ?? `http://127.0.0.1:${previewPort}`;
const packageJson = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const routes = [
  { id: 'design-concept', label: '設計理念', url: '/' },
  { id: 'solar-study', label: '日照研究', url: '/?view=solar-study' },
  { id: 'drawings', label: '圖面設計', url: '/?view=drawings' },
  {
    id: '3d-viewer',
    label: '3D 展示與實境漫遊',
    url: '/?view=3d-viewer&quality=low&adaptive=off',
  },
];

async function firstExisting(paths) {
  for (const path of paths) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // Try the next known browser path.
    }
  }
  throw new Error('Chrome or Edge executable was not found for the copy snapshot.');
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`The website did not become available at ${origin} within 30 seconds.`);
}

function normalizeVisibleText(value) {
  return value
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/u, ''))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}

let preview;
let browser;
try {
  if (!suppliedOrigin) {
    const viteCli = resolve(repoRoot, 'node_modules/vite/bin/vite.js');
    preview = spawn(
      process.execPath,
      [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  }

  await waitForServer();
  browser = await chromium.launch({
    executablePath: await firstExisting(chromeCandidates),
    headless: true,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
    ],
  });

  const snapshots = [];
  for (const route of routes) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.goto(`${origin}${route.url}`, { waitUntil: 'networkidle' });
    await page.locator(`[data-view-root][data-view-mounted="${route.id}"]`).waitFor({
      state: 'attached',
    });
    if (route.id === '3d-viewer') {
      await page.waitForFunction(
        () =>
          document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') !==
          'false',
      );
    }
    await page.evaluate(() => document.fonts.ready);
    const text = normalizeVisibleText(await page.locator('body').innerText());
    snapshots.push({ ...route, text, hash: sha256(text) });
    await page.close();
  }

  const capturedAt = `${new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(' ', 'T')}+08:00`;
  const coverageRows = snapshots
    .map(
      ({ label, url, hash }) =>
        `| ${label} | \`${url}\` | \`${hash}\` |`,
    )
    .join('\n');
  const copySections = snapshots
    .map(
      ({ label, url, text }) => `## ${label}

- 擷取路徑：\`${url}\`

\`\`\`text
${text}
\`\`\``,
    )
    .join('\n\n');
  const document = `# 網站文字快照 v1.0

> 這是發布版 ${packageJson.version} 四個公開分頁在桌面版實際渲染後的可見文字備份，供後續文字修訂與改版比對。此文件不取代各功能資料與模型來源；隱藏、暫不顯示或僅存在於程式內的備用內容不列入本快照。

- 快照版本：\`v1.0\`
- 對應網站版本：\`${packageJson.version}\`
- 擷取時間：\`${capturedAt}\`
- 擷取方式：以 Chromium 開啟各公開路徑，等待分頁掛載完成後讀取 \`document.body.innerText\`
- 行文保真：保留實際斷行與可見標點；連續空白行僅正規化為一個空白段落

## 覆蓋範圍與校驗碼

| 分頁 | 路徑 | 可見文字 SHA-256 |
|---|---|---|
${coverageRows}

${copySections}
`;

  await writeFile(outputPath, document, 'utf8');
  process.stdout.write(`Captured ${snapshots.length} public views to ${outputPath}\n`);
} finally {
  await browser?.close();
  preview?.kill();
}
