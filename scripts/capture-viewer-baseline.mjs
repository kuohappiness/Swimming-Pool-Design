import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const repoRoot = resolve(import.meta.dirname, '..');
const port = 4174;
const origin = `http://127.0.0.1:${port}`;
const outputDirectory = resolve(repoRoot, 'tests/visual-baselines/v0.6.7');
const sceneIds = ['overview', 'light', 'rain', 'people', 'time'];
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
  throw new Error('Chrome or Edge executable was not found for Viewer baseline capture.');
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

async function settle(page, frames = 1) {
  await page.evaluate(async (frameCount) => {
    for (let frame = 0; frame < frameCount; frame += 1) {
      await new Promise(requestAnimationFrame);
    }
  }, frames);
}

async function measureFrameTiming(page, sampleCount = 12) {
  return page.evaluate(async (frames) => {
    const samples = [];
    let previous = performance.now();
    for (let frame = 0; frame < frames; frame += 1) {
      await new Promise(requestAnimationFrame);
      const current = performance.now();
      samples.push(current - previous);
      previous = current;
    }
    const ordered = [...samples].sort((left, right) => left - right);
    const averageFrameTimeMs = samples.reduce((total, value) => total + value, 0) / samples.length;
    return {
      sampleCount: samples.length,
      averageFrameTimeMs: Number(averageFrameTimeMs.toFixed(3)),
      p95FrameTimeMs: Number(ordered[Math.ceil(ordered.length * 0.95) - 1].toFixed(3)),
      averageFps: Number((1000 / averageFrameTimeMs).toFixed(2)),
    };
  }, sampleCount);
}

async function getResourceEvidence(page) {
  return page.evaluate(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => {
      const resource = /** @type {PerformanceResourceTiming} */ (entry);
      const url = new URL(resource.name);
      return {
        path: `${url.pathname}${url.search}`,
        origin: url.origin,
        initiatorType: resource.initiatorType,
        transferSize: resource.transferSize,
        encodedBodySize: resource.encodedBodySize,
      };
    });
    return {
      resourceCount: resources.length,
      transferBytes: resources.reduce((total, resource) => total + resource.transferSize, 0),
      encodedBodyBytes: resources.reduce((total, resource) => total + resource.encodedBodySize, 0),
      visualAssetEncodedBytes: resources
        .filter(({ path }) => path.includes('/assets/'))
        .reduce((total, resource) => total + resource.encodedBodySize, 0),
      externalOrigins: [...new Set(resources.map(({ origin: resourceOrigin }) => resourceOrigin))]
        .filter((resourceOrigin) => resourceOrigin !== window.location.origin),
      resources,
    };
  });
}

const capturedFiles = [];
async function captureCanvas(page, filename) {
  const path = resolve(outputDirectory, filename);
  await settle(page);
  await page.locator('canvas[aria-label]').screenshot({ path });
  capturedFiles.push(filename);
}

async function captureViewport(browser, label, viewport, includeViews) {
  const browserErrors = [];
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'zh-TW',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) browserErrors.push(`${response.status()} ${response.url()}`);
  });

  try {
    await page.goto(`${origin}/3d-viewer/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'true',
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
      `${label} viewport must not overflow horizontally`,
    );
    assert.equal(await page.locator('[data-scene-nav] button').count(), sceneIds.length);
    assert.match(await page.locator('[data-model-version]').innerText(), /^MODEL 0\.6\.7/);

    for (let index = 0; index < sceneIds.length; index += 1) {
      await page.locator('[data-scene-nav] button').nth(index).click();
      await page.waitForFunction(
        (sceneId) => document.querySelector('[data-viewer-shell]')?.getAttribute('data-scene') === sceneId,
        sceneIds[index],
      );
      await captureCanvas(page, `${label}-scene-${sceneIds[index]}.png`);
    }

    if (includeViews) {
      await page.locator('button[data-view="elevation"]').click();
      await captureCanvas(page, `${label}-view-pool-side.png`);
      await page.locator('button[data-view="opposite"]').click();
      await captureCanvas(page, `${label}-view-school-side.png`);
    }

    await page.locator('[data-reset-view]').click();
    await page.locator('[data-enter-walkthrough]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-camera-mode') === 'walkthrough',
    );
    await captureCanvas(page, `${label}-walkthrough-entrance.png`);

    const [frameTiming, resources, runtime] = await Promise.all([
      measureFrameTiming(page),
      getResourceEvidence(page),
      page.locator('[data-viewer-shell]').evaluate((shell) => ({
        rendering: {
          materialRegistry: shell.dataset.materialRegistry,
          environmentEffect: shell.dataset.environmentEffect,
          frameEffectPipeline: shell.dataset.frameEffectPipeline,
          visualAssetAdapter: shell.dataset.visualAssetAdapter,
          quality: shell.dataset.renderQuality,
        },
        inputAdapter: shell.dataset.walkthroughInput,
        reducedMotion: shell.dataset.reducedMotion,
        canvas: (() => {
          const canvas = shell.querySelector('canvas');
          return canvas ? {
            cssWidth: canvas.getBoundingClientRect().width,
            cssHeight: canvas.getBoundingClientRect().height,
            drawingBufferWidth: canvas.width,
            drawingBufferHeight: canvas.height,
          } : null;
        })(),
      })),
    ]);
    assert.deepEqual(resources.externalOrigins, [], `${label} must not use runtime external resources`);
    assert.equal(browserErrors.length, 0, browserErrors.join('\n'));
    return { viewport, frameTiming, resources, runtime };
  } finally {
    await context.close();
  }
}

await mkdir(outputDirectory, { recursive: true });
const viteCli = resolve(repoRoot, 'node_modules/vite/bin/vite.js');
const preview = spawn(process.execPath, [
  viteCli,
  'preview',
  '--host',
  '127.0.0.1',
  '--port',
  String(port),
  '--strictPort',
], {
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
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });

  // Capture sequentially so a background page cannot be throttled to 1 FPS and
  // contaminate the frame-time evidence.
  const desktop = await captureViewport(browser, 'desktop-1440x900', { width: 1440, height: 900 }, true);
  const mobile = await captureViewport(browser, 'mobile-390x844', { width: 390, height: 844 }, false);
  const screenshots = [];
  for (const filename of capturedFiles.sort()) {
    const bytes = await readFile(resolve(outputDirectory, filename));
    screenshots.push({
      filename,
      byteSize: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }

  const report = {
    schemaVersion: '1.0.0',
    baselineId: 'viewer-0.6.7-before-enhanced-rendering',
    capturedAt: new Date().toISOString(),
    captureRuntime: 'Playwright Chromium with SwiftShader, deviceScaleFactor 1',
    performanceInterpretation:
      'Relative regression baseline only; SwiftShader results are not hardware acceptance measurements.',
    deterministicConditions: {
      colorScheme: 'light',
      locale: 'zh-TW',
      reducedMotion: 'reduce',
      sceneIds,
    },
    desktop,
    mobile,
    screenshots,
  };
  await writeFile(
    resolve(outputDirectory, 'baseline-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  process.stdout.write(
    `Viewer v0.6.7 visual baseline captured: ${screenshots.length} screenshots in ${outputDirectory}\n`,
  );
} finally {
  await browser?.close();
  preview.kill();
}
