import assert from 'node:assert/strict';
import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const repoRoot = resolve(import.meta.dirname, '..');
const port = 4174;
const origin = `http://127.0.0.1:${port}`;
const outputDirectory = resolve(repoRoot, 'test-results');
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const routes = [
  { id: 'design-concept', url: '/' },
  { id: 'solar-study', url: '/?view=solar-study' },
  { id: 'drawings', url: '/?view=drawings' },
  { id: '3d-viewer', url: '/?view=3d-viewer&quality=low&adaptive=off' },
];

const viewports = [
  { name: 'desktop-wide', width: 1440, height: 900 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-narrow', width: 320, height: 720 },
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
  throw new Error('Chrome or Edge executable was not found for public-site tests.');
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error('Vite preview did not start within 30 seconds.');
}

function trackErrors(page, errors) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      errors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
}

async function waitForView(page, viewId) {
  await page.locator(`[data-view-root][data-view-mounted="${viewId}"]`).waitFor({ state: 'attached' });
  if (viewId === '3d-viewer') {
    await page.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') !== 'false',
    );
  }
}

async function assertCommonShell(page, route, viewport) {
  assert.equal(await page.locator('[data-site-nav]').count(), 4);
  assert.deepEqual(
    await page.locator('[data-site-nav]').allTextContents(),
    ['設計理念', '日照研究', '圖面設計', '3D 展示'],
  );
  assert.equal(await page.locator(`[data-site-nav="${route.id}"]`).getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('[data-site-nav][aria-current="page"]').count(), 1);
  assert.equal(await page.locator('main').count(), 1);
  assert.equal(await page.locator('footer.site-footer').count(), 1);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
    `${route.id} overflows at ${viewport.width}px`,
  );

  const navigationTargets = await page.locator('[data-site-nav]').evaluateAll((links) =>
    links.map((link) => {
      const rect = link.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    }),
  );
  assert.equal(
    navigationTargets.every(({ height, width }) => height >= 44 && width >= 44),
    true,
    `${route.id} navigation target is smaller than 44px at ${viewport.width}px`,
  );

  const resourceOrigins = await page.evaluate(() =>
    [...new Set(performance.getEntriesByType('resource').map(({ name }) => new URL(name).origin))],
  );
  assert.deepEqual(resourceOrigins, [origin], `${route.id} requested a runtime asset from another origin`);
}

async function scriptMetrics(page) {
  return page.evaluate(() =>
    performance.getEntriesByType('resource')
      .filter(({ initiatorType, name }) => initiatorType === 'script' || name.endsWith('.js'))
      .map(({ name, decodedBodySize }) => ({ name, decodedBodySize })),
  );
}

await mkdir(outputDirectory, { recursive: true });
const viteCli = resolve(repoRoot, 'node_modules/vite/bin/vite.js');
const preview = spawn(
  process.execPath,
  [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
);

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

  const errors = [];
  const routeScriptMetrics = new Map();
  for (const route of routes) {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      trackErrors(page, errors);
      await page.goto(`${origin}${route.url}`, { waitUntil: 'networkidle' });
      await waitForView(page, route.id);
      await assertCommonShell(page, route, viewport);

      if (viewport.name === 'desktop-wide') {
        routeScriptMetrics.set(route.id, await scriptMetrics(page));
      }
      if (route.id === 'design-concept' && ['desktop-wide', 'mobile'].includes(viewport.name)) {
        await page.screenshot({
          path: resolve(outputDirectory, `public-design-concept-${viewport.name}.png`),
          fullPage: viewport.name === 'desktop-wide',
        });
      }
      await page.close();
    }
  }

  for (const viewId of ['design-concept', 'solar-study', 'drawings']) {
    const metrics = routeScriptMetrics.get(viewId) ?? [];
    assert.equal(
      metrics.some(({ decodedBodySize }) => decodedBodySize > 500_000),
      false,
      `${viewId} loaded the heavy 3D runtime`,
    );
  }
  assert.equal(
    (routeScriptMetrics.get('3d-viewer') ?? []).some(({ decodedBodySize }) => decodedBodySize > 500_000),
    true,
    '3D route did not load its isolated heavy runtime chunk',
  );

  const concept = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  trackErrors(concept, errors);
  await concept.goto(origin, { waitUntil: 'networkidle' });
  await waitForView(concept, 'design-concept');
  assert.equal(await concept.locator('.concept-chapter').count(), 4);
  assert.deepEqual(
    await concept.locator('.concept-chapter-heading h2').allTextContents(),
    ['向光', '向水', '向人', '向時間'],
  );
  assert.match(await concept.locator('.concept-overview').innerText(), /不是替舊游泳池換上一張新的臉/);
  await concept.keyboard.press('Tab');
  assert.equal(await concept.locator('.site-skip-link').evaluate((link) => link === document.activeElement), true);
  await concept.close();

  const reentry = await browser.newPage({ viewport: { width: 390, height: 844 } });
  trackErrors(reentry, errors);
  await reentry.goto(origin, { waitUntil: 'networkidle' });
  for (const viewId of ['3d-viewer', 'design-concept', '3d-viewer']) {
    await Promise.all([
      reentry.waitForNavigation({ waitUntil: 'networkidle' }),
      reentry.locator(`[data-site-nav="${viewId}"]`).click(),
    ]);
    await waitForView(reentry, viewId);
    if (viewId === '3d-viewer') {
      assert.equal(await reentry.locator('canvas[aria-label*="3D 模型"]').count(), 1);
    }
  }
  await reentry.screenshot({
    path: resolve(outputDirectory, 'public-viewer-mobile-top.png'),
  });
  await reentry.close();

  const invalid = await browser.newPage({ viewport: { width: 390, height: 844 } });
  trackErrors(invalid, errors);
  await invalid.goto(`${origin}/?view=not-a-public-view`, { waitUntil: 'networkidle' });
  await waitForView(invalid, 'design-concept');
  assert.equal(new URL(invalid.url()).searchParams.has('view'), false);
  await invalid.close();

  const reducedMotion = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  trackErrors(reducedMotion, errors);
  await reducedMotion.goto(origin, { waitUntil: 'networkidle' });
  await waitForView(reducedMotion, 'design-concept');
  assert.equal(
    await reducedMotion.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
    'auto',
  );
  await reducedMotion.close();

  assert.equal(errors.length, 0, errors.join('\n'));
  process.stdout.write(
    'Unified public site smoke passed: 4 views × 5 viewports, routing, accessibility, isolation, and reduced motion.\n',
  );
  process.stdout.write(`Screenshots: ${outputDirectory}\n`);
} finally {
  await browser?.close();
  preview.kill();
}
