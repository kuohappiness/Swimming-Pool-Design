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
  assert.equal(await desktop.locator('[data-layer-list] input').count(), 9);
  assert.equal(await desktop.locator('canvas[aria-label*="3D 模型"]').count(), 1);
  assert.match(await desktop.locator('[data-model-version]').innerText(), /^MODEL 0\.5\.0/);
  assert.match(await desktop.locator('.trust-strip [data-model-hash]').innerText(), /^[a-f0-9]{12}/);
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l3-rotation'), '26.5°');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-pool-deck-elevation'), '+0.300 m');
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-perspective.png'), fullPage: true });

  await desktop.getByRole('button', { name: '向雨' }).click();
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-scene'), 'rain');
  assert.equal(await desktop.locator('input[value="rain"]').isChecked(), true);
  assert.match(await desktop.locator('[data-concept-content]').innerText(), /雨天也是建築的風景/);
  const coreOption = desktop.locator('[data-object-select] option').filter({ hasText: 'CORE-01' });
  await desktop.locator('[data-object-select]').selectOption(await coreOption.getAttribute('value'));
  assert.match(await desktop.locator('[data-selection-info]').innerText(), /CORE-01/);
  await desktop.getByRole('button', { name: '俯視' }).click();
  await desktop.locator('canvas').focus();
  await desktop.keyboard.press('Enter');
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-top.png'), fullPage: true });
  await desktop.getByRole('button', { name: '池側' }).click();
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-pool-elevation.png'), fullPage: true });
  await desktop.getByRole('button', { name: '校側' }).click();
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-school-elevation.png'), fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  trackErrors(mobile);
  await mobile.goto(`${origin}/3d-viewer/#people`, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'true');
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-scene'), 'people');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  const canvasBox = await mobile.locator('canvas').boundingBox();
  assert.ok(canvasBox && canvasBox.width >= 389 && canvasBox.height > 350, 'mobile canvas must remain usable');
  await mobile.screenshot({ path: resolve(outputDirectory, 'viewer-mobile.png'), fullPage: true });
  await mobile.close();

  const fallback = await browser.newPage({ viewport: { width: 900, height: 700 } });
  trackErrors(fallback);
  await fallback.goto(`${origin}/3d-viewer/?forceFallback=1`, { waitUntil: 'networkidle' });
  await fallback.waitForFunction(() => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'fallback');
  assert.equal(await fallback.locator('[data-webgl-fallback]').isVisible(), true);
  assert.equal(await fallback.locator('[data-scene-nav] button').count(), 5);
  await fallback.getByRole('button', { name: '向光' }).click();
  assert.match(await fallback.locator('[data-concept-content]').innerText(), /替游泳池找尋新的「方向」/);

  const solarDesktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  trackErrors(solarDesktop);
  await solarDesktop.goto(`${origin}/solar-study/`, { waitUntil: 'networkidle' });
  assert.match(await solarDesktop.locator('h1').innerText(), /固定 L1／L2/);
  assert.match(await solarDesktop.locator('#model-version').innerText(), /^STUDY 0\.5\.0 · MODEL /);
  assert.equal(await solarDesktop.locator('#confirmed-plan').innerText(), '+26.5°');
  assert.equal(await solarDesktop.locator('#confirmed-lean').innerText(), '+3.1°');
  assert.equal(await solarDesktop.locator('#confirmed-normal').innerText(), '153.5°');
  assert.match(await solarDesktop.locator('.decision-summary').innerText(), /冷季新增 \+1,022\.903 kWh/);
  assert.equal(await solarDesktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await solarDesktop.locator('#planRotation').evaluate((input) => {
    input.value = '27';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await solarDesktop.locator('#planValue').innerText(), '+27.0°');
  await solarDesktop.screenshot({ path: resolve(outputDirectory, 'solar-study-desktop.png'), fullPage: true });

  const solarMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  trackErrors(solarMobile);
  await solarMobile.goto(`${origin}/solar-study/`, { waitUntil: 'networkidle' });
  assert.equal(await solarMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.equal(await solarMobile.locator('.mobile-live-preview').isVisible(), true);
  await solarMobile.screenshot({ path: resolve(outputDirectory, 'solar-study-mobile.png'), fullPage: true });
  await solarDesktop.close();
  await solarMobile.close();

  const atlasDesktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  trackErrors(atlasDesktop);
  await atlasDesktop.goto(`${origin}/#REF-001`, { waitUntil: 'networkidle' });
  assert.equal(await atlasDesktop.locator('[data-sheet]').count(), 8);
  assert.equal(await atlasDesktop.locator('#model-version').innerText(), 'MODEL 0.5.0');
  assert.match(await atlasDesktop.locator('.sheet-note').innerText(), /SRC-SITE-001 最新原圖/);
  assert.match(await atlasDesktop.locator('.drawing image').getAttribute('href'), /SRC-SITE-001_google-maps-satellite/);
  await atlasDesktop.screenshot({ path: resolve(outputDirectory, 'atlas-site-latest.png'), fullPage: true });

  await atlasDesktop.locator('[data-sheet="V23-PLAN"]').click();
  assert.equal(await atlasDesktop.locator('[data-sheet="V23-PLAN"]').getAttribute('aria-current'), 'page');
  assert.match(await atlasDesktop.locator('.sheet-note').innerText(), /真北箭頭指向右下/);
  assert.match(await atlasDesktop.locator('.review-drawing image').getAttribute('href'), /DRAW-L1-L3-PLANS-V2\.3/);
  await atlasDesktop.screenshot({ path: resolve(outputDirectory, 'atlas-v23-plan.png'), fullPage: true });

  await atlasDesktop.locator('[data-sheet="V23-SECTION"]').click();
  assert.equal(await atlasDesktop.locator('[data-sheet="V23-SECTION"]').getAttribute('aria-current'), 'page');
  assert.match(await atlasDesktop.locator('.sheet-note').innerText(), /池畔 \+0\.30 m/);
  assert.match(await atlasDesktop.locator('.review-drawing image').getAttribute('href'), /DRAW-LONGITUDINAL-SECTION-V2\.3/);
  await atlasDesktop.screenshot({ path: resolve(outputDirectory, 'atlas-v23-section.png'), fullPage: true });
  await atlasDesktop.close();

  const atlasMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  trackErrors(atlasMobile);
  await atlasMobile.goto(`${origin}/#V23-PLAN`, { waitUntil: 'networkidle' });
  assert.equal(await atlasMobile.locator('#model-version').innerText(), 'MODEL 0.5.0');
  assert.equal(await atlasMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.match(await atlasMobile.locator('.review-drawing image').getAttribute('href'), /DRAW-L1-L3-PLANS-V2\.3/);
  await atlasMobile.screenshot({ path: resolve(outputDirectory, 'atlas-v23-plan-mobile.png'), fullPage: true });
  await atlasMobile.close();

  assert.equal(browserErrors.length, 0, browserErrors.join('\n'));

  process.stdout.write(`Viewer, solar-study, and atlas browser smoke passed: desktop, mobile, and WebGL fallback.\n`);
  process.stdout.write(`Screenshots: ${outputDirectory}\n`);
} finally {
  await browser?.close();
  preview.kill();
}
