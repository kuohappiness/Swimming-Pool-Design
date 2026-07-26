import assert from 'node:assert/strict';
import { access, mkdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import {
  deriveMirrorNormalAzimuth,
  deriveSiteOrientation,
} from './site-orientation.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const outputDirectory = resolve(repoRoot, 'test-results');
const projectModel = JSON.parse(
  await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'),
);
const expectedModelVersion = projectModel.modelVersion;
const expectedGeometryRevision = projectModel.geometryRevisions
  .find(({ id }) => id === projectModel.activeGeometryRevisionId)?.revision;
assert.ok(expectedGeometryRevision, 'Active geometry revision must resolve for browser tests.');
const expectedActiveGeometry = projectModel.geometryRevisions
  .find(({ id }) => id === projectModel.activeGeometryRevisionId);
const expectedMirrorNormal = deriveMirrorNormalAzimuth(
  projectModel.referenceSystem,
  expectedActiveGeometry.solar.planRotation.value,
);
const expectedSiteOrientation = deriveSiteOrientation(projectModel.referenceSystem);
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
      const response = await fetch(`${origin}/?view=3d-viewer`);
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
  const activateScene = async (page, label) => {
    await page.locator('[data-scene-nav] button').filter({
      hasText: new RegExp(`^${label}$`),
    }).evaluate((button) => button.click());
  };
  const selectObject = async (page, option) => {
    const value = await option.getAttribute('value');
    await page.locator('[data-object-select]').evaluate((select, nextValue) => {
      select.value = nextValue;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  };
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  trackErrors(desktop);
  await desktop.goto(`${origin}/?view=3d-viewer`, { waitUntil: 'networkidle' });
  await desktop.locator('[data-viewer-shell]').waitFor({ state: 'visible' });
  await desktop.waitForFunction(() => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') !== 'false');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-viewer-ready'), 'true');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-rendering-mode'), 'enhanced');
  assert.equal(
    await desktop.locator('[data-viewer-shell]').getAttribute('data-material-registry'),
    'enhanced-pbr-material-registry',
  );
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-software-renderer'), 'true');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-render-quality'), 'low');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-performance-profile'), 'low');
  assert.equal(
    await desktop.locator('[data-viewer-shell]').getAttribute('data-shadow-update-mode'),
    'on-demand-static-scene',
  );
  await desktop.waitForFunction(
    () => Number(document.querySelector('[data-viewer-shell]')?.getAttribute('data-draw-calls')) > 0,
  );
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-coordinate-adapter'), 'SITE-XYZ-TO-THREE-RH');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-collision-world'), 'capsule-proxies-task-055');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-safe-spawn-count'), '7');
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
  assert.equal(await desktop.locator('[data-scene-nav]').isHidden(), true);
  assert.equal(await desktop.locator('[data-object-select]').isHidden(), true);
  assert.equal(await desktop.locator('[data-layer-list] input').count(), 10);
  assert.equal(await desktop.locator('input[value="energy"]').isChecked(), true);
  assert.equal(await desktop.locator('canvas[aria-label*="3D 模型"]').count(), 1);
  assert.equal(await desktop.locator('.site-release strong').innerText(), expectedModelVersion);
  assert.equal(await desktop.locator('.topbar').count(), 0);
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
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l2-split-axis-y'), '8');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-l2-gender-divider-overlaps-y0'), 'false');
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
  await activateScene(desktop, '向雨');
  await desktop.locator('input[value="energy"]').uncheck();
  const poolBeforeWalkthrough = desktop.locator('[data-object-select] option').filter({
    hasText: /^POOL-01 ·/,
  });
  await selectObject(desktop, poolBeforeWalkthrough);
  await desktop.getByRole('button', { name: '泳池剖視' }).click();
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-pool-cutaway'), 'true');
  await desktop.locator('[data-enter-walkthrough]').click();
  await desktop.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-camera-mode') === 'walkthrough',
  );
  const areaSelect = desktop.locator('[data-walkthrough-area-select]');
  assert.equal(await areaSelect.locator('option').count(), 7);
  for (const areaId of [
    'entrance',
    'l1-pool-deck',
    'l1-sanitary',
    'l2-arrival',
    'l3-arrival',
    'l3-terrace',
    'roof-inspection',
  ]) {
    await areaSelect.selectOption(areaId);
    await desktop.waitForFunction(
      (expectedArea) => document.querySelector('[data-viewer-shell]')
        ?.getAttribute('data-walkthrough-area') === expectedArea
        && document.querySelector('[data-viewer-shell]')
          ?.getAttribute('data-player-grounded') === 'true',
      areaId,
    );
    assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-player-grounded'), 'true');
  }
  await areaSelect.selectOption('entrance');
  const walkthroughStart = await desktop.locator('[data-viewer-shell]').getAttribute('data-player-site-position');
  await desktop.keyboard.down('w');
  await desktop.evaluate(async () => {
    for (let frame = 0; frame < 16; frame += 1) await new Promise(requestAnimationFrame);
  });
  await desktop.keyboard.up('w');
  const walkthroughMoved = await desktop.locator('[data-viewer-shell]').getAttribute('data-player-site-position');
  assert.notEqual(walkthroughMoved, walkthroughStart);
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-player-grounded'), 'true');
  await desktop.locator('[data-return-safe]').click();
  await desktop.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-player-site-position')
      === '2.000,0.000,-1.250',
  );
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-walkthrough-area'), 'entrance');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-player-site-position'), '2.000,0.000,-1.250');

  await areaSelect.selectOption('l1-pool-deck');
  await desktop.locator('canvas').focus();
  await desktop.keyboard.down('Shift');
  await desktop.keyboard.down('w');
  let desktopWaterEntryError = null;
  try {
    await desktop.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')
        ?.getAttribute('data-movement-mode')?.startsWith('swimming-'),
      undefined,
      { timeout: 8_000 },
    );
  } catch (error) {
    desktopWaterEntryError = new Error(
      `Desktop water entry failed at ${
        await desktop.locator('[data-viewer-shell]').getAttribute('data-player-site-position')
      } in ${
        await desktop.locator('[data-viewer-shell]').getAttribute('data-movement-mode')
      }: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await desktop.keyboard.up('w');
    await desktop.keyboard.up('Shift');
  }
  if (desktopWaterEntryError) throw desktopWaterEntryError;
  assert.equal(await desktop.locator('[data-return-poolside]').isVisible(), true);
  await desktop.keyboard.down('c');
  try {
    await desktop.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')
        ?.getAttribute('data-movement-mode') === 'swimming-underwater'
        && document.querySelector('[data-viewer-shell]')
          ?.getAttribute('data-underwater') === 'true',
      undefined,
      { timeout: 3_000 },
    );
    assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-underwater'), 'true');
    await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-walkthrough-underwater.png') });
  } finally {
    await desktop.keyboard.up('c');
  }
  await desktop.locator('[data-return-poolside]').click();
  await desktop.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')
      ?.getAttribute('data-walkthrough-area') === 'l1-pool-deck',
  );
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-underwater'), 'false');
  await desktop.locator('[data-exit-walkthrough]').click();
  await desktop.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-camera-mode') === 'inspect',
  );
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-scene'), 'rain');
  assert.equal(await desktop.locator('input[value="energy"]').isChecked(), false);
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-pool-cutaway'), 'true');
  assert.match(await desktop.locator('[data-selection-info]').innerText(), /POOL-01/);
  assert.equal(
    await desktop.locator('[data-enter-walkthrough]').evaluate(
      (element) => element === document.activeElement,
    ),
    true,
  );
  await activateScene(desktop, '總覽');
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
    await selectObject(desktop, option);
    assert.match(await desktop.locator('[data-selection-info]').innerText(), expectedText);
    await desktop.screenshot({ path: resolve(outputDirectory, screenshotName), fullPage: true });
    if (objectId === 'F-L2-Y0-01') {
      await desktop.getByRole('button', { name: '池側' }).click();
      await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-l2-y0-glass-from-y0.png'), fullPage: true });
      await desktop.getByRole('button', { name: '校側' }).click();
      await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-l2-y0-glass-from-y14.png'), fullPage: true });
      await desktop.getByRole('button', { name: '重設視角' }).click();
    }
  }

  const stairOption = desktop.locator('[data-object-select] option').filter({ hasText: /^ST-01 ·/ });
  await selectObject(desktop, stairOption);
  assert.match(await desktop.locator('[data-selection-info]').innerText(), /Y0 側/);
  await desktop.getByRole('button', { name: '俯視' }).click();
  await desktop.screenshot({ path: resolve(outputDirectory, 'viewer-stair-y0-top.png'), fullPage: true });
  await desktop.getByRole('button', { name: '重設視角' }).click();

  await activateScene(desktop, '向雨');
  assert.equal(await desktop.locator('[data-viewer-shell]').getAttribute('data-scene'), 'rain');
  assert.equal(await desktop.locator('input[value="rain"]').isChecked(), true);
  assert.equal(await desktop.locator('[data-scene-context]').count(), 0);
  const coreOption = desktop.locator('[data-object-select] option').filter({ hasText: 'CORE-01' });
  await selectObject(desktop, coreOption);
  assert.match(await desktop.locator('[data-selection-info]').innerText(), /CORE-01/);
  await activateScene(desktop, '總覽');
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
  await mobile.goto(`${origin}/?view=3d-viewer`, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'true');
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-rendering-mode'), 'enhanced');
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-render-quality'), 'low');
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-l2-split-axis-y'), '8');
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-l2-gender-divider-overlaps-y0'), 'false');
  await mobile.screenshot({ path: resolve(outputDirectory, 'viewer-l2-y0-mobile-overview.png'), fullPage: true });
  await mobile.goto(`${origin}/?view=3d-viewer#people`, { waitUntil: 'networkidle' });
  await mobile.reload({ waitUntil: 'networkidle' });
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
  await mobile.getByRole('button', { name: '重設視角' }).click();
  assert.equal(await mobile.locator('[data-viewer-shell]').getAttribute('data-pool-cutaway'), 'false');
  await mobile.screenshot({ path: resolve(outputDirectory, 'viewer-mobile.png'), fullPage: true });

  await mobile.locator('[data-enter-walkthrough]').click();
  await mobile.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-camera-mode') === 'walkthrough',
  );
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.equal(await mobile.locator('[data-walkthrough-area-select] option').count(), 7);
  for (const selector of [
    '[data-walkthrough-area-select]',
    '[data-return-safe]',
    '[data-exit-walkthrough]',
  ]) {
    const box = await mobile.locator(selector).boundingBox();
    assert.ok(box && box.height >= 44, `${selector} must remain at least 44 CSS px high`);
  }
  await mobile.locator('[data-walkthrough-area-select]').selectOption('l1-pool-deck');
  const touchMove = mobile.locator('[data-touch-move]');
  await touchMove.dispatchEvent('pointerdown', {
    pointerId: 51,
    clientX: 70,
    clientY: 700,
  });
  await touchMove.dispatchEvent('pointermove', {
    pointerId: 51,
    clientX: 70,
    clientY: 620,
  });
  try {
    await mobile.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')
        ?.getAttribute('data-movement-mode')?.startsWith('swimming-'),
      undefined,
      { timeout: 5_000 },
    );
  } finally {
    await touchMove.dispatchEvent('pointerup', {
      pointerId: 51,
      clientX: 70,
      clientY: 620,
    });
  }
  assert.equal(await mobile.locator('[data-swim-controls]').isVisible(), true);
  for (const selector of ['[data-swim-up]', '[data-swim-down]']) {
    const box = await mobile.locator(selector).boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44);
  }
  await mobile.locator('[data-swim-down]').dispatchEvent('pointerdown', { pointerId: 52 });
  try {
    await mobile.waitForFunction(
      () => document.querySelector('[data-viewer-shell]')
        ?.getAttribute('data-movement-mode') === 'swimming-underwater'
        && document.querySelector('[data-viewer-shell]')
          ?.getAttribute('data-underwater') === 'true',
      undefined,
      { timeout: 3_000 },
    );
    await mobile.screenshot({ path: resolve(outputDirectory, 'viewer-walkthrough-mobile-underwater.png') });
  } finally {
    await mobile.locator('[data-swim-down]').dispatchEvent('pointerup', { pointerId: 52 });
  }
  await mobile.locator('[data-return-poolside]').click();
  await mobile.locator('[data-exit-walkthrough]').click();
  await mobile.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-camera-mode') === 'inspect',
  );
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await mobile.close();

  const explicitBaseline = await browser.newPage({ viewport: { width: 900, height: 700 } });
  trackErrors(explicitBaseline);
  await explicitBaseline.goto(`${origin}/?view=3d-viewer&rendering=baseline`, { waitUntil: 'networkidle' });
  await explicitBaseline.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'true',
  );
  assert.equal(
    await explicitBaseline.locator('[data-viewer-shell]').getAttribute('data-rendering-mode'),
    'baseline-explicit',
  );
  assert.equal(
    await explicitBaseline.locator('[data-viewer-shell]').getAttribute('data-material-registry'),
    'baseline-material-registry',
  );
  assert.equal(
    await explicitBaseline.locator('[data-enter-walkthrough]').isEnabled(),
    true,
  );
  await explicitBaseline.close();

  const requiredAssetFallback = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const requiredAssetPageErrors = [];
  requiredAssetFallback.on('pageerror', (error) => requiredAssetPageErrors.push(error.message));
  await requiredAssetFallback.goto(
    `${origin}/?view=3d-viewer&simulateRequiredAssetFailure=material`,
    { waitUntil: 'networkidle' },
  );
  await requiredAssetFallback.waitForFunction(
    () => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'true',
  );
  assert.equal(
    await requiredAssetFallback.locator('[data-viewer-shell]').getAttribute('data-rendering-mode'),
    'baseline-fallback',
  );
  assert.match(
    await requiredAssetFallback.locator('[data-viewer-shell]').getAttribute('data-rendering-diagnostic'),
    /Simulated required material asset failure/,
  );
  assert.equal(
    await requiredAssetFallback.locator('[data-viewer-shell]').getAttribute('data-material-registry'),
    'baseline-material-registry',
  );
  assert.equal(requiredAssetPageErrors.length, 0, requiredAssetPageErrors.join('\n'));
  await requiredAssetFallback.close();

  const fallback = await browser.newPage({ viewport: { width: 900, height: 700 } });
  trackErrors(fallback);
  await fallback.goto(`${origin}/?view=3d-viewer&forceFallback=1`, { waitUntil: 'networkidle' });
  await fallback.waitForFunction(() => document.querySelector('[data-viewer-shell]')?.getAttribute('data-viewer-ready') === 'fallback');
  assert.equal(await fallback.locator('[data-webgl-fallback]').isVisible(), true);
  assert.equal(await fallback.locator('[data-scene-nav] button').count(), 5);
  assert.equal(await fallback.locator('[data-scene-nav]').isHidden(), true);
  await activateScene(fallback, '向光');
  assert.equal(await fallback.locator('[data-scene-context]').count(), 0);

  const solarDesktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  trackErrors(solarDesktop);
  await solarDesktop.goto(`${origin}/?view=solar-study`, { waitUntil: 'networkidle' });
  assert.match(await solarDesktop.locator('h1').innerText(), /讓建築轉向光/);
  assert.match(
    await solarDesktop.locator('#model-version').innerText(),
    new RegExp(
      `^STUDY ${expectedGeometryRevision.replaceAll('.', '\\.')} · MODEL ${
        expectedModelVersion.replaceAll('.', '\\.')
      }`,
    ),
  );
  assert.equal(await solarDesktop.locator('#confirmed-plan').innerText(), '+25.5°');
  assert.equal(await solarDesktop.locator('#confirmed-lean').innerText(), '+23.0°');
  assert.equal(
    await solarDesktop.locator('#confirmed-normal').innerText(),
    `${expectedMirrorNormal.toFixed(1)}°`,
  );
  assert.equal(
    await solarDesktop.locator('#study-baseline-label').innerText(),
    `v0.6.7 研究基線 · Model ${expectedModelVersion} 已驗證`,
  );
  assert.equal(
    await solarDesktop.locator('#study-method').innerText(),
    expectedActiveGeometry.solar.analysisMethodRevision,
  );
  assert.equal(
    await solarDesktop.locator('#study-thresholds').innerText(),
    `方位 ±${expectedActiveGeometry.solar.azimuthTolerance.value.toFixed(0)}° · 下射 ≥${
      expectedActiveGeometry.solar.minimumDownwardAngle.value.toFixed(0)
    }°`,
  );
  assert.equal(
    await solarDesktop.locator('#study-energy-assumptions').innerText(),
    'ρ 0.75 · τ 0.60 · 07:00–17:00',
  );
  assert.equal(await solarDesktop.locator('#study-analysis-status').innerText(), 'current／已驗證');
  assert.match(
    await solarDesktop.locator('.decision-summary').innerText(),
    /冷季新增仍為 \+1,036\.829 kWh/,
  );
  assert.match(await solarDesktop.locator('#azimuthToleranceFan').getAttribute('d'), /^M 280 235 L /);
  assert.equal(
    await solarDesktop.locator('#azimuthToleranceLabel').textContent(),
    `池向方位容許 ±${expectedActiveGeometry.solar.azimuthTolerance.value.toFixed(0)}°`,
  );
  assert.equal(
    await solarDesktop.locator('#minimumDownwardLabel').textContent(),
    `最低下射 ${expectedActiveGeometry.solar.minimumDownwardAngle.value.toFixed(0)}°（方向代理）`,
  );
  assert.equal(await solarDesktop.locator('.live-preview').isVisible(), true);
  assert.equal(await solarDesktop.locator('.desktop-preview-grid').isVisible(), true);
  assert.equal(await solarDesktop.locator('#desktopPlanPreviewViewport svg').count(), 1);
  assert.equal(await solarDesktop.locator('#desktopSectionPreviewViewport svg').count(), 1);
  assert.equal(await solarDesktop.locator('.mobile-preview-tabs').isVisible(), false);
  assert.equal(await solarDesktop.locator('#mobilePreviewViewport').isVisible(), false);
  assert.equal(await solarDesktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await solarDesktop.locator('#date').evaluate((input) => {
    input.value = '7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await solarDesktop.locator('#time').evaluate((input) => {
    input.value = '7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await solarDesktop.locator('#selectedSun').getAttribute('data-reflection-state'), 'front-lit');
  assert.ok(Number(await solarDesktop.locator('#selectedSun').getAttribute('data-front-half-space-dot')) > 0);
  assert.equal(await solarDesktop.locator('#selectedSun .selected-sun-ray').count(), 1);
  assert.equal(await solarDesktop.locator('#selectedSun .selected-reflected-ray').count(), 1);
  assert.match(
    await solarDesktop.locator('#selectedSun .selected-reflection-label').textContent(),
    /^反射方位投影 \d+\.\d° · 下射角 -?\d+\.\d°$/,
  );
  assert.match(
    await solarDesktop.locator('#selectedSun .selected-reflected-ray').getAttribute('aria-label'),
    /^3D 反射光水平投影，方位 .*下射角 .*度$/,
  );
  assert.equal(
    await solarDesktop.locator('#selectedSun .selected-sun-ray').getAttribute('stroke'),
    await solarDesktop.locator('#selectedSun .selected-reflected-ray').getAttribute('stroke'),
  );
  assert.equal(
    await solarDesktop.locator('#selectedSun .selected-sun-ray').getAttribute('marker-end'),
    'url(#plan-arrow-incoming)',
  );
  assert.equal(
    await solarDesktop.locator('#selectedSun .selected-reflected-ray').getAttribute('marker-end'),
    'url(#plan-arrow-reflected)',
  );
  assert.equal(
    await solarDesktop.locator('#incoming').getAttribute('marker-end'),
    'url(#arrow-sun)',
  );
  assert.equal(
    await solarDesktop.locator('#reflected').getAttribute('marker-end'),
    'url(#arrow-reflected)',
  );
  const rayGeometry = await solarDesktop.evaluate(() => {
    const required = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing solar study element: ${selector}`);
      return element;
    };
    const mirrorEdge = required('.mirror-edge');
    const upperBoxPlan = required('#upperBoxPlan');
    const buildingPlan = required('#buildingPlan');
    const wallNormal = required('#wallNormal');
    const incidentPoint = required('#planIncidentPoint');
    const selectedSun = required('#selectedSun');
    const incomingPlanRay = required('#selectedSun .selected-sun-ray');
    const reflectedPlanRay = required('#selectedSun .selected-reflected-ray');
    const sectionIncomingRay = required('#incoming');
    const sectionReflectedRay = required('#reflected');
    const applyMatrix = (point, matrix) => ({
      x: point.x * matrix.a + point.y * matrix.c + matrix.e,
      y: point.x * matrix.b + point.y * matrix.d + matrix.f,
    });
    const midpoint = {
      x: (Number(mirrorEdge.getAttribute('x1')) + Number(mirrorEdge.getAttribute('x2'))) / 2,
      y: (Number(mirrorEdge.getAttribute('y1')) + Number(mirrorEdge.getAttribute('y2'))) / 2,
    };
    const upperMatrix = upperBoxPlan.transform.baseVal.consolidate().matrix;
    const buildingMatrix = buildingPlan.transform.baseVal.consolidate().matrix;
    const wallCenter = applyMatrix(applyMatrix(midpoint, upperMatrix), buildingMatrix);
    const normalStart = {
      x: Number(wallNormal.getAttribute('x1')),
      y: Number(wallNormal.getAttribute('y1')),
    };
    const incomingEnd = incomingPlanRay.points.getItem(incomingPlanRay.points.numberOfItems - 1);
    const reflectedStart = reflectedPlanRay.points.getItem(0);
    const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
    return {
      wallCenter,
      normalStart,
      normalDistance: distance(normalStart, wallCenter),
      incidentDistance: distance({
        x: Number(incidentPoint.getAttribute('cx')),
        y: Number(incidentPoint.getAttribute('cy')),
      }, wallCenter),
      incomingDistance: distance(incomingEnd, wallCenter),
      reflectedDistance: distance(reflectedStart, wallCenter),
      wallOverlaysRays: Boolean(
        selectedSun.compareDocumentPosition(buildingPlan) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      planIncomingWidth: Number.parseFloat(getComputedStyle(incomingPlanRay).strokeWidth),
      planReflectedWidth: Number.parseFloat(getComputedStyle(reflectedPlanRay).strokeWidth),
      normalWidth: Number.parseFloat(getComputedStyle(wallNormal).strokeWidth),
      sectionIncomingWidth: Number.parseFloat(getComputedStyle(sectionIncomingRay).strokeWidth),
      sectionReflectedWidth: Number.parseFloat(getComputedStyle(sectionReflectedRay).strokeWidth),
    };
  });
  assert.ok(rayGeometry.normalDistance < 0.15);
  assert.ok(rayGeometry.incidentDistance < 0.15);
  assert.ok(Math.abs(rayGeometry.incomingDistance - 10) < 0.15);
  assert.ok(Math.abs(rayGeometry.reflectedDistance - 10) < 0.15);
  assert.equal(rayGeometry.wallOverlaysRays, true);
  assert.ok(Math.hypot(
    rayGeometry.normalStart.x - 280,
    rayGeometry.normalStart.y - 235,
  ) > 1);
  assert.equal(rayGeometry.planIncomingWidth, 4.8);
  assert.equal(rayGeometry.planReflectedWidth, 4.8);
  assert.equal(rayGeometry.normalWidth, 4);
  assert.equal(rayGeometry.sectionIncomingWidth, 4);
  assert.equal(rayGeometry.sectionReflectedWidth, 4);
  assert.equal(await solarDesktop.locator('#reflected').getAttribute('data-reflection-state'), 'misses-pool');
  assert.equal(
    await solarDesktop.locator('#incoming').getAttribute('stroke'),
    await solarDesktop.locator('#reflected').getAttribute('stroke'),
  );
  assert.equal(
    await solarDesktop.locator('#reflected').evaluate(
      (line) => Number.parseFloat(getComputedStyle(line).opacity),
    ),
    1,
  );
  assert.notEqual(
    await solarDesktop.locator('#reflected').evaluate(
      (line) => getComputedStyle(line).strokeDasharray,
    ),
    'none',
  );
  assert.equal(await solarDesktop.locator('#rayLabel').textContent(), '反射光（未命中池面）');
  assert.equal(await solarDesktop.locator('#reflected').getAttribute('aria-label'), '反射光，未命中池面');
  assert.equal(
    await solarDesktop.locator('#desktop-preview-section-reflected').getAttribute('data-reflection-state'),
    'misses-pool',
  );
  assert.equal(
    await solarDesktop.locator('#desktop-preview-section-incoming').getAttribute('stroke'),
    await solarDesktop.locator('#desktop-preview-section-reflected').getAttribute('stroke'),
  );
  assert.equal(
    await solarDesktop.locator('#desktop-preview-section-reflected').getAttribute('marker-end'),
    'url(#desktop-preview-section-arrow-reflected)',
  );
  assert.notEqual(
    await solarDesktop.locator('#selectedSun .selected-reflected-ray').evaluate(
      (line) => getComputedStyle(line).strokeDasharray,
    ),
    'none',
  );
  assert.match(await solarDesktop.locator('#resultDetail').innerText(), /實際方位偏差 .*門檻/);
  await solarDesktop.locator('#time').evaluate((input) => {
    input.value = '18';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(
    await solarDesktop.locator('#timeScope').innerText(),
    /方向診斷 07:00–18:00 · 年度能量 07:00–17:00 · 本時刻僅供方向診斷/,
  );
  await solarDesktop.locator('#planRotation').evaluate((input) => {
    input.value = '27';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await solarDesktop.locator('#planValue').innerText(), '+27.0°');
  assert.equal(
    await solarDesktop.locator('#mirrorAz').innerText(),
    `${deriveMirrorNormalAzimuth(projectModel.referenceSystem, 27).toFixed(1)}°`,
  );
  assert.equal(
    await solarDesktop.locator('#desktop-preview-plan-wallNormal').getAttribute('x1'),
    await solarDesktop.locator('#wallNormal').getAttribute('x1'),
  );
  assert.equal(
    await solarDesktop.locator('#desktop-preview-plan-wallNormal').getAttribute('y1'),
    await solarDesktop.locator('#wallNormal').getAttribute('y1'),
  );
  await solarDesktop.screenshot({ path: resolve(outputDirectory, 'solar-study-desktop.png'), fullPage: true });

  const solarTablet = await browser.newPage({ viewport: { width: 768, height: 900 }, deviceScaleFactor: 1 });
  trackErrors(solarTablet);
  await solarTablet.goto(`${origin}/?view=solar-study`, { waitUntil: 'networkidle' });
  assert.equal(await solarTablet.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.equal(await solarTablet.locator('.live-preview').isVisible(), true);
  assert.equal(await solarTablet.locator('.desktop-preview-grid').isVisible(), true);
  assert.equal(await solarTablet.locator('#desktopPlanPreviewViewport svg').count(), 1);
  assert.equal(await solarTablet.locator('#desktopSectionPreviewViewport svg').count(), 1);
  assert.equal(await solarTablet.locator('.mobile-preview-tabs').isVisible(), false);
  assert.equal(await solarTablet.locator('#mobilePreviewViewport').isVisible(), false);
  await solarTablet.screenshot({ path: resolve(outputDirectory, 'solar-study-tablet.png'), fullPage: true });

  const solarMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  trackErrors(solarMobile);
  await solarMobile.goto(`${origin}/?view=solar-study`, { waitUntil: 'networkidle' });
  assert.equal(await solarMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.equal(await solarMobile.locator('.live-preview').isVisible(), true);
  assert.equal(await solarMobile.locator('.desktop-preview-grid').isVisible(), false);
  assert.equal(await solarMobile.locator('#desktopPlanPreviewViewport svg').count(), 0);
  assert.equal(await solarMobile.locator('#desktopSectionPreviewViewport svg').count(), 0);
  assert.equal(await solarMobile.locator('.mobile-preview-tabs').isVisible(), true);
  assert.equal(await solarMobile.locator('#mobilePreviewViewport').isVisible(), true);
  await solarMobile.locator('#date').evaluate((input) => {
    input.value = '7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await solarMobile.locator('#time').evaluate((input) => {
    input.value = '7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await solarMobile.locator('#previewSection').click();
  assert.equal(
    await solarMobile.locator('#mobile-preview-section-reflected').getAttribute('data-reflection-state'),
    'misses-pool',
  );
  assert.equal(
    await solarMobile.locator('#mobile-preview-section-incoming').getAttribute('stroke'),
    await solarMobile.locator('#mobile-preview-section-reflected').getAttribute('stroke'),
  );
  assert.equal(
    await solarMobile.locator('#mobile-preview-section-reflected').getAttribute('marker-end'),
    'url(#mobile-preview-section-arrow-reflected)',
  );
  assert.equal(
    await solarMobile.locator('#mobile-preview-section-rayLabel').textContent(),
    '反射光（未命中池面）',
  );
  await solarMobile.screenshot({ path: resolve(outputDirectory, 'solar-study-mobile.png'), fullPage: true });
  await solarDesktop.close();
  await solarTablet.close();
  await solarMobile.close();

  const atlasDesktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  trackErrors(atlasDesktop);
  await atlasDesktop.goto(`${origin}/?view=drawings#REF-001`, { waitUntil: 'networkidle' });
  assert.equal(await atlasDesktop.locator('[data-sheet]').count(), 5);
  assert.equal(await atlasDesktop.locator('#detail-panel').count(), 0);
  assert.equal(await atlasDesktop.locator('#model-version').innerText(), `MODEL ${expectedModelVersion}`);
  assert.equal(
    await atlasDesktop.locator('.sheet-note').innerText(),
    `MODEL ${expectedModelVersion} · ACTIVE ${projectModel.activeGeometryRevisionId}`,
  );
  assert.match(await atlasDesktop.locator('#sheet-stage image').getAttribute('href'), /SRC-SITE-001_google-maps-satellite/);
  await atlasDesktop.screenshot({ path: resolve(outputDirectory, 'atlas-site-latest.png'), fullPage: true });

  for (const [sheetId, entityId, screenshotName] of [
    ['V067-L1', 'F-L1-Y0-01', 'atlas-v067-l1.png'],
    ['V067-L2', 'F-L2-Y0-01', 'atlas-v067-l2.png'],
    ['V067-L3', 'RF-PV-RES-01', 'atlas-v067-l3.png'],
    ['V067-SECTION', 'W-L3-X41-01', 'atlas-v067-section.png'],
  ]) {
    await atlasDesktop.locator(`[data-sheet="${sheetId}"]`).click();
    assert.equal(await atlasDesktop.locator(`[data-sheet="${sheetId}"]`).getAttribute('aria-current'), 'page');
    assert.equal(await atlasDesktop.locator(`.review-drawing[data-sheet-id="${sheetId}"]`).count(), 1);
    assert.equal(await atlasDesktop.locator('.review-drawing image').count(), 0);
    assert.equal(await atlasDesktop.locator(`.review-drawing [data-entity="${entityId}"]`).count(), 1);
    if (sheetId !== 'V067-SECTION') {
      assert.equal(
        await atlasDesktop.locator('.review-drawing [data-north-plan-direction]').getAttribute('data-north-plan-direction'),
        expectedSiteOrientation.northPlanDirection,
      );
      assert.equal(
        await atlasDesktop.locator('.review-drawing [data-north-rotation]').getAttribute('data-north-rotation'),
        `${expectedSiteOrientation.svgNorthArrowRotation}`,
      );
    }
    if (sheetId === 'V067-L3') {
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
  await atlasMobile.goto(`${origin}/?view=drawings#V067-L1`, { waitUntil: 'networkidle' });
  assert.equal(await atlasMobile.locator('#model-version').innerText(), `MODEL ${expectedModelVersion}`);
  assert.equal(await atlasMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.equal(await atlasMobile.locator('.review-drawing[data-sheet-id="V067-L1"]').count(), 1);
  assert.equal(await atlasMobile.locator('.review-drawing [data-entity="F-L1-Y0-01"]').count(), 1);
  assert.equal(await atlasMobile.locator('#sheet-stage').getAttribute('class'), 'sheet-stage fit-sheet');
  assert.equal(
    await atlasMobile.locator('.drawing-scroll').evaluate(
      (scroller) => scroller.scrollWidth <= scroller.clientWidth + 1,
    ),
    true,
  );
  await atlasMobile.locator('#fit-sheet').click();
  assert.equal(await atlasMobile.locator('#fit-sheet').getAttribute('aria-pressed'), 'false');
  assert.equal(
    await atlasMobile.locator('.drawing-scroll').evaluate(
      (scroller) => scroller.scrollWidth > scroller.clientWidth,
    ),
    true,
  );
  await atlasMobile.locator('#fit-sheet').click();
  await atlasMobile.screenshot({ path: resolve(outputDirectory, 'atlas-v067-l1-mobile.png'), fullPage: true });
  await atlasMobile.close();

  assert.equal(browserErrors.length, 0, browserErrors.join('\n'));

  process.stdout.write(`Viewer, solar-study, and atlas browser smoke passed: desktop, mobile, and WebGL fallback.\n`);
  process.stdout.write(`Screenshots: ${outputDirectory}\n`);
} finally {
  await browser?.close();
  preview.kill();
}
