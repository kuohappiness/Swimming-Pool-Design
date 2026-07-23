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
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-coordinate-adapter'), 'SITE-XYZ-TO-THREE-RH');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-site-y-to-three'), 'negativeThreeZ');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-site-root-scale-z'), '-1');
  assert.equal(await desktop.locator('[data-orientation-cue]').isVisible(), true);
  assert.equal(await desktop.locator('[data-orientation-cue]').getAttribute('data-north-direction'), 'lower-right');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-stair-side'), 'Y0');
  assert.equal(
    await desktop.locator('[data-viewer-shell]').getAttribute('data-stair-site-bounds'),
    '{"x1":20.5,"x2":29,"y1":0.5,"y2":2}',
  );
  assert.equal(await desktop.locator('[data-loading]').isHidden(), true);
  assert.equal(await desktop.locator('[data-scene-nav] button').count(), 5);
  assert.equal(await desktop.locator('[data-layer-list] input').count(), 10);
  assert.equal(await desktop.locator('input[value="energy"]').isChecked(), true);
  assert.equal(await desktop.locator('canvas[aria-label*="3D 模型"]').count(), 1);
  assert.match(await desktop.locator('[data-model-version]').innerText(), /^MODEL 0\.6\.6/);
  assert.match(await desktop.locator('.trust-strip [data-model-hash]').innerText(), /^[a-f0-9]{12}/);
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l3-rotation'), '25.5°');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-pool-deck-elevation'), '+0.300 m');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-stair-design'), 'suspended-floating-stair');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-stair-stringers'), '2');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-toilet-entrance-count'), '4');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-toilet-entrance-width'), '1.00 m');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-toilet-entrance-door-leaves'), '0');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-wc-cubicle-door-leaves'), '8');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-service-material'), 'fair-faced-exposed-concrete');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-playground-male-washbasins'), '2');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-playground-male-urinals'), '2');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-playground-female-washbasins'), '2');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-stair2-design'), 'suspended-floating-stair');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-stair2-planters'), '3');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l2-shower-module'), '1.2 × 1.2');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l2-support-wc-per-gender'), '1');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l2-support-basins-per-gender'), '2');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-pv-reserve-area'), '169.364');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-pv-coverage-percent'), '92.74');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l1-y0-material'), 'segmented-safety-glass-and-fair-faced-concrete');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l2-y0-material'), 'full-width-safety-glass');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-selection-outline'), 'none');
  assert.equal(
    await desktop.locator('[data-viewer-shell]').getAttribute('data-glass-facade-material-system'),
    'shared-safety-glass-facade',
  );
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l2-divider-span'), '32–41');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l2-divider-openings'), '0');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l2-ceiling-continuous'), 'true');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l3-roof-continuous'), 'true');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l3-mirror-end-gaps-filled'), 'true');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l3-interior-battery-objects'), 'false');
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-perspective.png'), fullPage: true });

  for (const [objectId, expectedText, screenshotName] of [
    ['EN-01', /泳池大廳玻璃主入口/, 'viewer-pool-entry.png'],
    ['OP-WC-POOL-F-01', /1\.00 m.*無門板/, 'viewer-pool-female-opening.png'],
    ['WC-L1-DETAIL-01', /不設遮擋版[\s\S]*隔間仍保留門板[\s\S]*Y3\.5/, 'viewer-toilet-details.png'],
    ['Z-CS-M-01', /15 間[\s\S]*1\.20 × 1\.20 m[\s\S]*1 間一般 WC[\s\S]*2 座洗手槽/, 'viewer-l2-male-showers.png'],
    ['ST-02', /X32\.5[\s\S]*Y0\.5～2\.0[\s\S]*\+X[\s\S]*兩道連續深色鋼箱梯梁/, 'viewer-st02.png'],
    ['Z-ST-02-PLANT-01', /3 組[\s\S]*可移除[\s\S]*不設深土槽/, 'viewer-st02-planting.png'],
    ['F-L1-Y0-01', /X0\.5～X31[\s\S]*安全玻璃[\s\S]*X31～X39[\s\S]*自然灰清水模/, 'viewer-l1-y0-segmented.png'],
    ['RF-L1-WEST-EAVE-01', /X0～X0\.5[\s\S]*0\.5 m 突出屋簷/, 'viewer-west-glass-eave.png'],
    ['RF-L1-REAR-CANOPY-01', /Y13\.5～Y14\.5[\s\S]*突出屋簷/, 'viewer-rear-glass-canopy.png'],
    ['F-L2-Y0-01', /X29～X41[\s\S]*淡藍安全玻璃[\s\S]*Y0／Y14/, 'viewer-l2-y0-glass.png'],
    ['W-L2-ST-CH-01', /Y2\.5[\s\S]*X32[\s\S]*X41[\s\S]*無門洞/, 'viewer-l2-divider.png'],
    ['CLG-L2-01', /X29～X41／Y0～Y13\.5[\s\S]*連續封閉/, 'viewer-l2-ceiling.png'],
    ['F-MIR-SIDE-INFILL-01', /三角空隙[\s\S]*補滿/, 'viewer-l3-mirror-infill.png'],
    ['RF-L3-01', /182\.628 m²[\s\S]*連續屋頂[\s\S]*填滿 L3 天花/, 'viewer-l3-roof.png'],
    ['RF-PV-RES-01', /182\.6 m²[\s\S]*169\.4 m²[\s\S]*92\.74%/, 'viewer-pv-reserve.png'],
    ['Z-L3-ARRIVAL-01', /有頂室內[\s\S]*戶外景觀區不是唯一/, 'viewer-l3-arrival.png'],
    ['Z-L3-TERRACE-01', /只限教師與維修人員[\s\S]*不開放學生/, 'viewer-l3-terrace.png'],
  ]) {
    const option = desktop.locator('[data-object-select] option').filter({
      hasText: new RegExp(`^${objectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ·`),
    });
    await desktop.locator('[data-object-select]').selectOption(await option.getAttribute('value'));
    assert.match(await desktop.locator('[data-selection-info]').innerText(), expectedText);
    await desktop.screenshot({ path: resolve(outputDirectory, screenshotName), fullPage: true });
    if (objectId === 'F-L2-Y0-01') {
      await desktop.getByRole('button', { name: '池側' }).click();
      await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-l2-y0-glass-from-y0.png'), fullPage: true });
      await desktop.getByRole('button', { name: '校側' }).click();
      await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-l2-y0-glass-from-y14.png'), fullPage: true });
      await desktop.getByRole('button', { name: '重設本場景視角' }).click();
    }
  }

  const stairOption = desktop.locator('[data-object-select] option').filter({ hasText: /^ST-01 ·/ });
  await desktop.locator('[data-object-select]').selectOption(await stairOption.getAttribute('value'));
  assert.match(await desktop.locator('[data-selection-info]').innerText(), /Y0 側/);
  await desktop.getByRole('button', { name: '俯視' }).click();
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-stair-y0-top.png'), fullPage: true });
  await desktop.getByRole('button', { name: '重設本場景視角' }).click();

  await desktop.getByRole('button', { name: '向雨' }).click();
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-scene'), 'rain');
  assert.equal(await desktop.locator('input[value="rain"]').isChecked(), true);
  assert.match(await desktop.locator('[data-concept-content]').innerText(), /雨天也是建築的風景/);
  const coreOption = desktop.locator('[data-object-select] option').filter({ hasText: 'CORE-01' });
  await desktop.locator('[data-object-select]').selectOption(await coreOption.getAttribute('value'));
  assert.match(await desktop.locator('[data-selection-info]').innerText(), /CORE-01/);
  await desktop.getByRole('button', { name: '總覽' }).click();
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-scene'), 'overview');
  assert.equal(await desktop.locator('input[value="energy"]').isChecked(), true);
  await desktop.getByRole('button', { name: '俯視' }).click();
  await desktop.locator('canvas').focus();
  await desktop.keyboard.press('Enter');
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-top.png'), fullPage: true });
  await desktop.getByRole('button', { name: '池側' }).click();
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-pool-elevation.png'), fullPage: true });
  await desktop.getByRole('button', { name: '泳池剖視' }).click();
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-pool-cutaway'), 'true');
  assert.equal(await desktop.locator('[data-pool-cutaway-key]').isVisible(), true);
  assert.match(await desktop.locator('[data-pool-cutaway-key]').innerText(), /淺端 1\.20 m[\s\S]*高差 0\.30 m[\s\S]*深端 1\.50 m/);
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-pool-cutaway.png'), fullPage: true });
  await desktop.getByRole('button', { name: '校側' }).click();
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-pool-cutaway'), 'false');
  assert.equal(await desktop.locator('[data-pool-cutaway-key]').isHidden(), true);
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-school-elevation.png'), fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  trackErrors(mobile);
  await mobile.goto(`${origin}/3d-viewer/#people`, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'true');
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-scene'), 'people');
  assert.equal(await mobile.locator('[data-orientation-cue]').isVisible(), true);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  const canvasBox = await mobile.locator('canvas').boundingBox();
  assert.ok(canvasBox && canvasBox.width >= 389 && canvasBox.height > 350, 'mobile canvas must remain usable');
  await mobile.getByRole('button', { name: '泳池剖視' }).click();
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-pool-cutaway'), 'true');
  assert.equal(await mobile.locator('[data-pool-cutaway-key]').isVisible(), true);
  await mobile.screenshot({ path: resolve(outputDirectory, 'viewer-pool-cutaway-mobile.png'), fullPage: true });
  await mobile.getByRole('button', { name: '重設本場景視角' }).click();
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-pool-cutaway'), 'false');
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
  assert.match(await solarDesktop.locator('#model-version').innerText(), /^STUDY 0\.6\.6 · MODEL 0\.6\.6/);
  assert.equal(await solarDesktop.locator('#confirmed-plan').innerText(), '+25.5°');
  assert.equal(await solarDesktop.locator('#confirmed-lean').innerText(), '+23.0°');
  assert.equal(await solarDesktop.locator('#confirmed-normal').innerText(), '152.5°');
  assert.match(await solarDesktop.locator('.decision-summary').innerText(), /冷季新增 \+1,036\.829 kWh/);
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
  assert.equal(await atlasDesktop.locator('[data-sheet]').count(), 5);
  assert.equal(await atlasDesktop.locator('#model-version').innerText(), 'MODEL 0.6.6');
  assert.match(await atlasDesktop.locator('.sheet-note').innerText(), /基地現況來源圖/);
  assert.match(await atlasDesktop.locator('#sheet-stage image').getAttribute('href'), /SRC-SITE-001_google-maps-satellite/);
  await atlasDesktop.screenshot({ path: resolve(outputDirectory, 'atlas-site-latest.png'), fullPage: true });

  for (const [sheetId, entityId, screenshotName] of [
    ['V066-L1', 'F-L1-Y0-01', 'atlas-v066-l1.png'],
    ['V066-L2', 'F-L2-Y0-01', 'atlas-v066-l2.png'],
    ['V066-L3', 'RF-PV-RES-01', 'atlas-v066-l3.png'],
    ['V066-SECTION', 'W-L3-X41-01', 'atlas-v066-section.png'],
  ]) {
    await atlasDesktop.locator(`[data-sheet="${sheetId}"]`).click();
    assert.equal(await atlasDesktop.locator(`[data-sheet="${sheetId}"]`).getAttribute('aria-current'), 'page');
    assert.equal(await atlasDesktop.locator(`.review-drawing[data-sheet-id="${sheetId}"]`).count(), 1);
    assert.equal(await atlasDesktop.locator('.review-drawing image').count(), 0);
    assert.equal(await atlasDesktop.locator(`.review-drawing [data-entity="${entityId}"]`).count(), 1);
    if (sheetId === 'V066-L3') {
      assert.equal(await atlasDesktop.locator('#toggle-pv').isChecked(), true);
      await atlasDesktop.locator('#toggle-pv').uncheck();
      assert.equal(await atlasDesktop.locator('[data-entity="RF-PV-RES-01"]').isHidden(), true);
      await atlasDesktop.locator('#toggle-pv').check();
      assert.equal(await atlasDesktop.locator('[data-entity="RF-PV-RES-01"]').isVisible(), true);
    }
    await atlasDesktop.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await atlasDesktop.screenshot({ path: resolve(outputDirectory, screenshotName), fullPage: true });
  }
  await atlasDesktop.close();

  const atlasMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  trackErrors(atlasMobile);
  await atlasMobile.goto(`${origin}/#V066-L1`, { waitUntil: 'networkidle' });
  assert.equal(await atlasMobile.locator('#model-version').innerText(), 'MODEL 0.6.6');
  assert.equal(await atlasMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.equal(await atlasMobile.locator('.review-drawing[data-sheet-id="V066-L1"]').count(), 1);
  assert.equal(await atlasMobile.locator('.review-drawing [data-entity="F-L1-Y0-01"]').count(), 1);
  await atlasMobile.screenshot({ path: resolve(outputDirectory, 'atlas-v066-l1-mobile.png'), fullPage: true });
  await atlasMobile.close();

  assert.equal(browserErrors.length, 0, browserErrors.join('\n'));

  process.stdout.write(`Viewer, solar-study, and atlas browser smoke passed: desktop, mobile, and WebGL fallback.\n`);
  process.stdout.write(`Screenshots: ${outputDirectory}\n`);
} finally {
  await browser?.close();
  preview.kill();
}
