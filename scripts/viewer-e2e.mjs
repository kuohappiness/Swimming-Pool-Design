import assert from 'node:assert/strict';
import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const repoRoot = resolve(import.meta.dirname, '..');
const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const outputDirectory = resolve(repoRoot, 'test-results');
const chromeCandidates = [
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
      // Try the next known browser path.
    }
  }
  throw new Error('Chrome or Edge executable was not found for Viewer smoke tests.');
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/3d-viewer/`);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error('Vite preview did not start within 30 seconds.');
}

await mkdir(outputDirectory, { recursive: true });
const viteCli = resolve(repoRoot, 'node_modules/vite/bin/vite.js');
const preview = spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: repoRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser;
try {
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

  const browserErrors = [];
  const trackErrors = (page) => {
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
        browserErrors.push(message.text());
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400) browserErrors.push(`${response.status()} ${response.url()}`);
    });
  };
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  trackErrors(desktop);
  await desktop.goto(`${origin}/3d-viewer/`, { waitUntil: 'networkidle' });
  await desktop.locator('[data-viewer-shell]').waitFor({ state: 'visible' });
  await desktop.waitForFunction(() => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') !== 'false');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-viewer-ready'), 'true');
  assert.equal(await desktop.locator('[data-loading]').isHidden(), true);
  assert.equal(await desktop.locator('[data-scene-nav] button').count(), 5);
  assert.equal(await desktop.locator('canvas[aria-label*="3D 模型"]').count(), 1);
  assert.match(await desktop.locator('[data-model-version]').innerText(), /^MODEL /);
  assert.match(await desktop.locator('.trust-strip [data-model-hash]').innerText(), /^[a-f0-9]{12}/);
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-perspective.png'), fullPage: true });

  await desktop.getByRole('button', { name: '向雨' }).click();
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-scene'), 'rain');
  assert.equal(await desktop.locator('input[value="rain"]').isChecked(), true);
  assert.match(await desktop.locator('[data-concept-content]').innerText(), /雨天也是建築的風景/);
  await desktop.locator('[data-object-select]').selectOption('0');
  assert.match(await desktop.locator('[data-selection-info]').innerText(), /CORE-01/);
  await desktop.getByRole('button', { name: '俯視' }).click();
  await desktop.locator('canvas').focus();
  await desktop.keyboard.press('Enter');
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-top.png'), fullPage: true });
  await desktop.getByRole('button', { name: '池側' }).click();
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-pool-elevation.png'), fullPage: true });
  await desktop.getByRole('button', { name: '校側' }).click();
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-school-elevation.png'), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  trackErrors(mobile);
  await mobile.goto(`${origin}/3d-viewer/#people`, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'true');
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-scene'), 'people');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  const canvasBox = await mobile.locator('canvas').boundingBox();
  assert.ok(canvasBox && canvasBox.width >= 389 && canvasBox.height > 350, 'mobile canvas must remain usable');
  await mobile.screenshot({ path: resolve(outputDirectory, 'viewer-mobile.png'), fullPage: true });

  const fallback = await browser.newPage({ viewport: { width: 900, height: 700 } });
  trackErrors(fallback);
  await fallback.goto(`${origin}/3d-viewer/?forceFallback=1`, { waitUntil: 'networkidle' });
  await fallback.waitForFunction(() => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'fallback');
  assert.equal(await fallback.locator('[data-webgl-fallback]').isVisible(), true);
  assert.equal(await fallback.locator('[data-scene-nav] button').count(), 5);
  await fallback.getByRole('button', { name: '向光' }).click();
  assert.match(await fallback.locator('[data-concept-content]').innerText(), /替游泳池找尋新的「方向」/);
  assert.equal(browserErrors.length, 0, browserErrors.join('\n'));

  process.stdout.write(`Viewer browser smoke passed: desktop 1440×900, mobile 390×844, WebGL fallback.\n`);
  process.stdout.write(`Screenshots: ${outputDirectory}\n`);
} finally {
  await browser?.close();
  preview.kill();
}
