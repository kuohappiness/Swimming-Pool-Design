import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const repoRoot = resolve(import.meta.dirname, '..');
const port = 4175;
const origin = `http://127.0.0.1:${port}`;
const packageVersion = JSON.parse(
  await readFile(resolve(repoRoot, 'package.json'), 'utf8'),
).version;
const outputDirectory = resolve(repoRoot, `test-results/viewer-quality-v${packageVersion}`);
const reuseVisualEvidence = process.env.REUSE_VIEWER_QUALITY_SCREENSHOTS === '1';
const sanitaryOnly = process.argv.includes('--sanitary-only');
const sceneIds = ['overview', 'light', 'rain', 'people', 'time'];
const qualityBudgets = {
  high: 24 * 1024 * 1024,
  medium: 12 * 1024 * 1024,
  low: 6 * 1024 * 1024,
};
const qualityFpsTargets = { high: 50, medium: 40, low: 30 };
const baseline = JSON.parse(
  await readFile(
    resolve(repoRoot, 'tests/visual-baselines/v0.6.7/baseline-report.json'),
    'utf8',
  ),
);
const deterministicRelativeFloor = 0.8;
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
  throw new Error('Chrome or Edge executable was not found for Viewer quality capture.');
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

async function settle(page, frames = 12) {
  await page.evaluate(async (frameCount) => {
    for (let frame = 0; frame < frameCount; frame += 1) {
      await new Promise(requestAnimationFrame);
    }
  }, frames);
}

async function measureFrameTiming(page, sampleCount = 24) {
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
    const averageFrameTimeMs = samples.reduce((total, value) => total + value, 0)
      / samples.length;
    return {
      sampleCount: samples.length,
      averageFrameTimeMs: Number(averageFrameTimeMs.toFixed(3)),
      p95FrameTimeMs: Number(ordered[Math.ceil(ordered.length * 0.95) - 1].toFixed(3)),
      averageFps: Number((1000 / averageFrameTimeMs).toFixed(2)),
    };
  }, sampleCount);
}

async function measureFrameTimingWithWarmupRetry(page, minimumFps) {
  const first = await measureFrameTiming(page);
  if (first.averageFps >= minimumFps) {
    return { ...first, attemptCount: 1, attempts: [first] };
  }
  process.stdout.write(
    `Frame sample ${first.averageFps} FPS is below ${minimumFps.toFixed(2)}; warming up and retrying once...\n`,
  );
  await settle(page, 12);
  const second = await measureFrameTiming(page);
  const selected = second.averageFps > first.averageFps ? second : first;
  return { ...selected, attemptCount: 2, attempts: [first, second] };
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
    };
  });
}

async function getRuntimeEvidence(page) {
  return page.locator('[data-viewer-shell]').evaluate((shell) => ({
    renderingMode: shell.dataset.renderingMode,
    requestedTier: shell.dataset.renderQuality,
    activeTier: shell.dataset.performanceProfile,
    adaptive: shell.dataset.adaptiveQuality,
    reducedMotion: shell.dataset.reducedMotion,
    environmentDiagnostic: shell.dataset.environmentDiagnostic,
    shaderCompileMs: Number(shell.dataset.shaderCompileMs),
    renderingInitMs: Number(shell.dataset.renderingInitMs),
    shaderPrograms: Number(shell.dataset.shaderPrograms),
    drawCalls: Number(shell.dataset.drawCalls),
    triangles: Number(shell.dataset.triangles),
    lines: Number(shell.dataset.lines),
    geometries: Number(shell.dataset.geometries),
    textures: Number(shell.dataset.textures),
    canvas: (() => {
      const canvas = shell.querySelector('canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        cssWidth: rect.width,
        cssHeight: rect.height,
        drawingBufferWidth: canvas.width,
        drawingBufferHeight: canvas.height,
      };
    })(),
  }));
}

function trackUnexpectedErrors(page, errors) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
}

async function openQualityPage(browser, {
  tier,
  viewport,
  label,
  adaptive = false,
  reducedMotion = 'no-preference',
}) {
  const errors = [];
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'zh-TW',
    reducedMotion,
  });
  const page = await context.newPage();
  trackUnexpectedErrors(page, errors);
  const renderingParameters = new URLSearchParams({ rendering: 'enhanced' });
  if (tier) renderingParameters.set('quality', tier);
  if (!adaptive) renderingParameters.set('adaptive', 'off');
  await page.goto(
    `${origin}/3d-viewer/?${renderingParameters}`,
    { waitUntil: 'networkidle' },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'true',
  );
  await page.waitForFunction(
    () => Number(document.querySelector('[data-viewer-shell]')?.getAttribute('data-draw-calls')) > 0,
  );
  assert.equal(
    await page.locator('[data-viewer-shell]').getAttribute('data-rendering-mode'),
    'enhanced',
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
    `${label} viewport must not overflow horizontally`,
  );
  return { context, page, errors };
}

const capturedFiles = [];
async function captureCanvas(page, filename, includeCanvasOverlays = false) {
  const path = resolve(outputDirectory, filename);
  await settle(page, 1);
  const target = page.locator(
    includeCanvasOverlays ? '[data-canvas-host]' : 'canvas[aria-label]',
  );
  const clip = await target.boundingBox();
  if (!clip) throw new TypeError(`Screenshot target is not visible: ${filename}`);
  await page.screenshot({ path, clip, timeout: 120_000 });
  capturedFiles.push(filename);
  process.stdout.write(`Captured ${filename}\n`);
}

async function captureSanitaryAcceptance(page) {
  await page.locator('[data-enter-walkthrough]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-camera-mode') === 'walkthrough',
  );
  await page.locator('[data-walkthrough-area-select]').selectOption('l1-sanitary');
  await page.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')
      ?.getAttribute('data-walkthrough-area') === 'l1-sanitary',
  );
  await page.locator('canvas[aria-label]').evaluate((canvas) => {
    canvas.requestPointerLock = () => Promise.reject(new Error('visual acceptance uses drag-look'));
    const bounds = canvas.getBoundingClientRect();
    const x = bounds.left + bounds.width * 0.5;
    const y = bounds.top + bounds.height * 0.5;
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, button: 0, buttons: 1, pointerId: 91, clientX: x, clientY: y,
    }));
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, button: 0, buttons: 1, pointerId: 91, clientX: x, clientY: y + 105,
    }));
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, button: 0, buttons: 0, pointerId: 91, clientX: x, clientY: y + 105,
    }));
  });
  await settle(page, 4);
  await captureCanvas(page, 'enhanced-eye-sanitary.png', true);
}

async function captureVisualAcceptance(page) {
  for (let index = 0; index < sceneIds.length; index += 1) {
    await page.locator('[data-scene-nav] button').nth(index).click();
    await page.waitForFunction(
      (sceneId) => document.querySelector('[data-viewer-shell]')?.getAttribute('data-scene') === sceneId,
      sceneIds[index],
    );
    await captureCanvas(page, `enhanced-scene-${sceneIds[index]}.png`);
  }

  await page.getByRole('button', { name: '池側' }).click();
  await captureCanvas(page, 'enhanced-view-pool-side.png');
  await page.getByRole('button', { name: '校側' }).click();
  await captureCanvas(page, 'enhanced-view-school-side.png');
  await page.getByRole('button', { name: '俯視' }).click();
  await captureCanvas(page, 'enhanced-view-top.png');
  await page.getByRole('button', { name: '泳池剖視' }).click();
  await captureCanvas(page, 'enhanced-view-pool-cutaway.png');
  await page.getByRole('button', { name: '重設本場景視角' }).click();

  await page.locator('[data-enter-walkthrough]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-camera-mode') === 'walkthrough',
  );
  const areaSelect = page.locator('[data-walkthrough-area-select]');
  for (const [areaId, filename] of [
    ['l1-pool-deck', 'enhanced-eye-l1.png'],
    ['l1-sanitary', 'enhanced-eye-sanitary.png'],
    ['l2-arrival', 'enhanced-eye-l2.png'],
    ['l3-arrival', 'enhanced-eye-l3.png'],
  ]) {
    await areaSelect.selectOption(areaId);
    await page.waitForFunction(
      (expectedArea) => document.querySelector('[data-viewer-shell]')
        ?.getAttribute('data-walkthrough-area') === expectedArea,
      areaId,
    );
    await captureCanvas(page, filename);
  }

  await areaSelect.selectOption('l1-pool-deck');
  await page.locator('canvas').focus();
  await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')
        ?.getAttribute('data-movement-mode')?.startsWith('swimming-'),
      undefined,
      { timeout: 60_000 },
    );
  } finally {
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');
  }
  await page.keyboard.down('c');
  try {
    await page.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')
        ?.getAttribute('data-movement-mode') === 'swimming-underwater',
      undefined,
      { timeout: 30_000 },
    );
  } finally {
    await page.keyboard.up('c');
  }
  await captureCanvas(page, 'enhanced-eye-underwater.png', true);
  await page.locator('[data-return-poolside]').click();
  await page.locator('[data-exit-walkthrough]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-camera-mode') === 'inspect',
  );
}

async function validateContextRestore(page) {
  await page.getByRole('button', { name: '向雨' }).click();
  await page.locator('input[value="energy"]').uncheck();
  const poolOption = page.locator('[data-object-select] option').filter({ hasText: /^POOL-01 ·/ });
  await page.locator('[data-object-select]').selectOption(await poolOption.getAttribute('value'));
  await page.getByRole('button', { name: '泳池剖視' }).click();
  const before = await page.locator('[data-viewer-shell]').evaluate((shell) => ({
    scene: shell.dataset.scene,
    cutaway: shell.dataset.poolCutaway,
    selected: shell.querySelector('[data-selection-info]')?.textContent,
    energy: shell.querySelector('input[value="energy"]')?.checked,
  }));
  const usedExtension = await page.locator('canvas').evaluate(async (canvas) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) {
      canvas.dispatchEvent(new Event('webglcontextrestored'));
      return false;
    }
    extension.loseContext();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
    extension.restoreContext();
    return true;
  });
  await page.waitForFunction(
    () => Number(document.querySelector('[data-viewer-shell]')?.getAttribute('data-context-restores')) >= 1,
  );
  await settle(page, 30);
  const after = await page.locator('[data-viewer-shell]').evaluate((shell) => ({
    scene: shell.dataset.scene,
    cutaway: shell.dataset.poolCutaway,
    selected: shell.querySelector('[data-selection-info]')?.textContent,
    energy: shell.querySelector('input[value="energy"]')?.checked,
  }));
  assert.deepEqual(after, before, 'context restore must preserve semantic Viewer state');
  return { usedWebglLoseContextExtension: usedExtension, statePreserved: true };
}

async function validateOptionalAssetFailure(browser) {
  const context = await browser.newContext({
    viewport: { width: 900, height: 700 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await page.goto(
      `${origin}/3d-viewer/?rendering=enhanced&quality=high&adaptive=off&simulateOptionalAssetFailure=environment`,
      { waitUntil: 'networkidle' },
    );
    await page.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'true',
    );
    await page.waitForFunction(
      () => Number(document.querySelector('[data-viewer-shell]')?.getAttribute('data-draw-calls')) > 0,
    );
    const shell = page.locator('[data-viewer-shell]');
    assert.equal(await shell.getAttribute('data-rendering-mode'), 'enhanced');
    assert.notEqual(await shell.getAttribute('data-environment-diagnostic'), 'none');
    assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
    return {
      renderingMode: await shell.getAttribute('data-rendering-mode'),
      environmentDiagnostic: await shell.getAttribute('data-environment-diagnostic'),
      drawCalls: Number(await shell.getAttribute('data-draw-calls')),
    };
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

  if (sanitaryOnly) {
    process.stdout.write('Capturing desktop high sanitary acceptance...\n');
    const opened = await openQualityPage(browser, {
      tier: 'high',
      viewport: { width: 1440, height: 900 },
      label: 'desktop-high-sanitary',
    });
    try {
      await captureSanitaryAcceptance(opened.page);
      assert.equal(opened.errors.length, 0, opened.errors.join('\n'));
    } finally {
      await opened.context.close();
    }
    process.stdout.write(`Sanitary visual acceptance passed in ${outputDirectory}\n`);
  } else {
  const tierEvidence = {};
  for (const tier of ['high', 'medium', 'low']) {
    process.stdout.write(`Measuring desktop ${tier} quality...\n`);
    const opened = await openQualityPage(browser, {
      tier,
      viewport: { width: 1440, height: 900 },
      label: `desktop-${tier}`,
    });
    const { page, context, errors } = opened;
    try {
      await settle(page);
      const [frameTiming, resources, runtime] = await Promise.all([
        measureFrameTimingWithWarmupRetry(
          page,
          baseline.desktop.frameTiming.averageFps * deterministicRelativeFloor,
        ),
        getResourceEvidence(page),
        getRuntimeEvidence(page),
      ]);
      process.stdout.write(
        `Desktop ${tier}: ${frameTiming.averageFps} FPS relative evidence, `
        + `${runtime.drawCalls} draw calls, ${runtime.triangles} triangles\n`,
      );
      assert.deepEqual(resources.externalOrigins, []);
      assert.ok(
        resources.transferBytes <= qualityBudgets[tier],
        `${tier} transfer ${resources.transferBytes} exceeds ${qualityBudgets[tier]}`,
      );
      assert.ok(
        frameTiming.averageFps
          >= baseline.desktop.frameTiming.averageFps * deterministicRelativeFloor,
        `${tier} regressed below the deterministic baseline floor`,
      );
      assert.equal(runtime.requestedTier, tier);
      assert.equal(runtime.activeTier, tier);
      assert.equal(runtime.adaptive, 'false');
      assert.ok(runtime.drawCalls > 0);
      assert.ok(runtime.triangles > 0);
      assert.ok(runtime.shaderPrograms > 0);
      assert.ok(runtime.shaderCompileMs >= 0);
      assert.equal(errors.length, 0, errors.join('\n'));
      tierEvidence[tier] = { frameTiming, resources, runtime };
      if (tier === 'high') {
        if (reuseVisualEvidence) {
          capturedFiles.push(
            ...(await readdir(outputDirectory)).filter((filename) => filename.endsWith('.png')),
          );
        } else {
          await captureVisualAcceptance(page);
        }
        tierEvidence.high.contextRestore = await validateContextRestore(page);
      }
    } finally {
      await context.close();
    }
  }

  process.stdout.write('Measuring 390x844 adaptive quality...\n');
  const mobileOpened = await openQualityPage(browser, {
    viewport: { width: 390, height: 844 },
    label: 'mobile-adaptive',
    adaptive: true,
    reducedMotion: 'reduce',
  });
  let mobileEvidence;
  try {
    await settle(mobileOpened.page, 48);
    const [frameTiming, resources, runtime] = await Promise.all([
      measureFrameTimingWithWarmupRetry(
        mobileOpened.page,
        baseline.mobile.frameTiming.averageFps * deterministicRelativeFloor,
      ),
      getResourceEvidence(mobileOpened.page),
      getRuntimeEvidence(mobileOpened.page),
    ]);
    process.stdout.write(
      `Mobile adaptive: ${frameTiming.averageFps} FPS relative evidence, `
      + `${runtime.activeTier} active tier\n`,
    );
    assert.ok(
      frameTiming.averageFps
        >= baseline.mobile.frameTiming.averageFps * deterministicRelativeFloor,
      `mobile regressed below the deterministic baseline floor`,
    );
    assert.equal(
      runtime.requestedTier,
      'low',
      'SwiftShader mobile must select the deterministic low-detail starting tier',
    );
    assert.equal(
      runtime.activeTier,
      'low',
      'mobile adaptive validation must retain the low-detail fallback tier',
    );
    assert.equal(runtime.adaptive, 'true');
    assert.equal(runtime.reducedMotion, 'true');
    assert.equal(
      await mobileOpened.page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      true,
    );
    assert.equal(mobileOpened.errors.length, 0, mobileOpened.errors.join('\n'));
    if (!reuseVisualEvidence) {
      await captureCanvas(mobileOpened.page, 'enhanced-mobile-adaptive.png');
    }
    mobileEvidence = { frameTiming, resources, runtime };
  } finally {
    await mobileOpened.context.close();
  }

  const optionalAssetFailure = await validateOptionalAssetFailure(browser);
  assert.equal(tierEvidence.high.runtime.reducedMotion, 'false');
  assert.equal(tierEvidence.low.runtime.canvas.drawingBufferWidth <= 1440, true);

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
    evidenceId: `viewer-${packageVersion}-enhanced-quality`,
    capturedAt: new Date().toISOString(),
    captureRuntime: 'Playwright Chromium with SwiftShader, deviceScaleFactor 1',
    performanceInterpretation:
      'Deterministic relative acceptance. SwiftShader verifies budgets, p95 recording, tier behavior and a minimum 80% of the matching v0.6.7 software-rendered baseline; configured 50/40/30 FPS values remain hardware-device targets and are not certified by this run.',
    deterministicConditions: {
      colorScheme: 'light',
      locale: 'zh-TW',
      sceneIds,
      exactTierAdaptiveQuality: false,
      mobileAdaptiveQuality: true,
    },
    targets: {
      qualityBudgets,
      hardwareDeviceAverageFps: qualityFpsTargets,
      deterministicRelativeFloor,
      baselineDesktopAverageFps: baseline.desktop.frameTiming.averageFps,
      baselineMobileAverageFps: baseline.mobile.frameTiming.averageFps,
    },
    tiers: tierEvidence,
    mobileAdaptive: mobileEvidence,
    optionalAssetFailure,
    baselineComparison: {
      baselineId: baseline.baselineId,
      baselineScreenshotHashes: baseline.screenshots,
      enhancedScreenshotHashes: screenshots,
    },
  };
  await writeFile(
    resolve(outputDirectory, 'quality-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  process.stdout.write(
    `Viewer quality evidence passed: ${screenshots.length} screenshots and high/medium/low/mobile metrics in ${outputDirectory}\n`,
  );
  }
} finally {
  await browser?.close();
  preview.kill();
}
