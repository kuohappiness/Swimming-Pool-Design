import assert from 'node:assert/strict';
import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const repoRoot = resolve(import.meta.dirname, '../..');
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

// Registry order (router.ts viewDefinitions), which the footer's previous/next links follow.
const pageOrder = ['design-concept', 'solar-study', 'design-process', 'drawings', '3d-viewer', 'about'];

const routes = [
  { id: 'design-concept', url: '/' },
  { id: 'solar-study', url: '/?view=solar-study', group: 'topics' },
  { id: 'drawings', url: '/?view=drawings' },
  { id: '3d-viewer', url: '/?view=3d-viewer&quality=low&adaptive=off' },
  { id: 'design-process', url: '/?view=design-process', group: 'topics' },
  { id: 'about', url: '/?view=about' },
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

async function openMenuIfFolded(page) {
  // At 900px and below the main navigation folds into the menu panel (a native popover).
  const menuButton = page.locator('.site-menu-button');
  if (!(await menuButton.isVisible())) return false;
  await menuButton.click();
  assert.equal(await page.locator('#site-navigation').evaluate((nav) => nav.matches(':popover-open')), true);
  return true;
}

async function assertCommonShell(page, route, viewport) {
  // DEC-170: five main items; 四向專題 is a group, not a page.
  assert.equal(await page.locator('[data-site-nav]').count(), 5);
  const folded = await openMenuIfFolded(page);
  assert.equal(folded, viewport.width <= 900, `${route.id} menu button visibility is wrong at ${viewport.width}px`);
  if (folded) {
    const button = await page.locator('.site-menu-button').boundingBox();
    assert.ok(button.width >= 44 && button.height >= 44, `${route.id} menu button is smaller than 44px at ${viewport.width}px`);
    assert.equal(
      await page.locator('[data-site-nav]').evaluateAll((links) =>
        links.every((link) => {
          const rect = link.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
        }),
      ),
      true,
      `${route.id} menu panel does not fit the screen at ${viewport.width}px`,
    );
  }
  assert.deepEqual(
    (await page.locator('[data-site-nav]').allTextContents()).map((text) => text.trim()),
    ['設計理念', '四向專題', '圖面', '3D', '關於'],
  );
  assert.equal(
    await page.locator('[data-site-nav][aria-current]').evaluate((link) => {
      const navigation = link.closest('nav').getBoundingClientRect();
      const rect = link.getBoundingClientRect();
      return rect.left >= navigation.left - 1 && rect.right <= navigation.right + 1;
    }),
    true,
    `${route.id} current navigation link is scrolled out of view at ${viewport.width}px`,
  );
  assert.equal(await page.locator('[data-site-nav][aria-current]').count(), 1);
  if (folded) {
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#site-navigation').evaluate((nav) => nav.matches(':popover-open')), false);
  }
  const label = await page.locator(route.group ? `[data-site-subnav="${route.id}"]` : `[data-site-nav="${route.id}"]`).textContent();
  assert.equal(await page.title(), `${label.trim()}｜實小泳池改建概念設計`);
  if (route.group) {
    assert.equal(await page.locator(`[data-site-nav="${route.group}"]`).getAttribute('aria-current'), 'true');
    assert.equal(await page.locator(`[data-site-subnav="${route.id}"]`).getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('[data-site-subnav][aria-current="page"]').count(), 1);
    const layout = await page.evaluate(() => {
      const masthead = document.querySelector('.site-masthead').getBoundingClientRect();
      const subnavigation = document.querySelector('.site-subnavigation').getBoundingClientRect();
      const tabs = [...document.querySelectorAll('[data-site-subnav]')].map((tab) => tab.getBoundingClientRect());
      return {
        inside: subnavigation.top >= masthead.top - 1 && subnavigation.bottom <= masthead.bottom + 1,
        targets: tabs.every(({ height, width }) => height >= 44 && width >= 44),
      };
    });
    assert.equal(layout.inside, true, `${route.id} second-level tabs fall outside the masthead at ${viewport.width}px`);
    assert.equal(layout.targets, true, `${route.id} second-level tab is smaller than 44px at ${viewport.width}px`);
  } else {
    assert.equal(await page.locator(`[data-site-nav="${route.id}"]`).getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('.site-subnavigation').count(), 0);
  }
  // Sticky elements and anchors offset by --site-header-height, so it must equal the masthead
  // exactly (border included) on every page and width, or they slide under the masthead.
  const header = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.height = 'var(--site-header-height)';
    document.body.append(probe);
    const token = probe.getBoundingClientRect().height;
    probe.remove();
    return { masthead: document.querySelector('.site-masthead').getBoundingClientRect().height, token };
  });
  assert.ok(
    Math.abs(header.masthead - header.token) <= 0.5,
    `${route.id} masthead is ${header.masthead}px but --site-header-height is ${header.token}px at ${viewport.width}px`,
  );
  assert.equal(await page.locator('main').count(), 1);
  assert.equal(await page.locator('footer.site-footer').count(), 1);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
    `${route.id} overflows at ${viewport.width}px`,
  );

  const reopened = await openMenuIfFolded(page);
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
  if (reopened) await page.keyboard.press('Escape');

  // Footer: previous and next page in registry order, each a 44px target.
  const index = pageOrder.indexOf(route.id);
  const pager = await page.locator('[data-site-pager]').evaluateAll((links) =>
    links.map((link) => ({
      rel: link.getAttribute('rel'),
      href: link.getAttribute('href'),
      height: link.getBoundingClientRect().height,
    })),
  );
  const expectedPager = [
    index > 0 && { rel: 'prev', view: pageOrder[index - 1] },
    index < pageOrder.length - 1 && { rel: 'next', view: pageOrder[index + 1] },
  ].filter(Boolean);
  assert.deepEqual(
    pager.map(({ rel, href }) => ({ rel, view: new URL(href, origin).searchParams.get('view') ?? 'design-concept' })),
    expectedPager,
    `${route.id} footer previous/next links are wrong`,
  );
  assert.equal(pager.every(({ height }) => height >= 44), true, `${route.id} footer pager target is smaller than 44px`);

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

  // Site icons and the share card are published next to index.html (npm run build:icons).
  const iconPage = await browser.newPage();
  await iconPage.goto(origin, { waitUntil: 'networkidle' });
  for (const [selector, attribute] of [
    ['link[rel="icon"]', 'href'],
    ['link[rel="apple-touch-icon"]', 'href'],
  ]) {
    const href = await iconPage.locator(selector).getAttribute(attribute);
    const response = await iconPage.request.get(new URL(href, iconPage.url()).href);
    assert.equal(response.ok(), true, `${selector} ${href} is missing`);
    assert.equal(response.headers()['content-type'], 'image/png');
  }
  const shareImage = await iconPage.locator('meta[property="og:image"]').getAttribute('content');
  const shareResponse = await iconPage.request.get(`${origin}/${new URL(shareImage).pathname.split('/').pop()}`);
  assert.equal(shareResponse.ok(), true, 'share card is not published next to index.html');
  await iconPage.close();

  for (const viewId of ['design-concept', 'solar-study', 'design-process', 'drawings', 'about']) {
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
  // 首頁（TASK-173）：每章只有一個 H2，編號在標題裡；設計細節與結語各一個 H2。
  assert.deepEqual(
    await concept.locator('.concept-chapters h2').evaluateAll((headings) =>
      headings.map((heading) => heading.textContent?.trim()),
    ),
    ['01向光而轉', '02向雨而生', '03向人而開', '04向時間延續', '設計細節', '結語'],
  );
  for (const sceneId of ['light', 'rain', 'people', 'time']) {
    assert.equal(await concept.locator(`#concept-${sceneId} h2`).count(), 1);
    assert.equal(
      await concept.locator(`#concept-${sceneId}`).getAttribute('aria-labelledby'),
      `concept-${sceneId}-title`,
    );
  }
  assert.equal(await concept.locator('.concept-hero-figure[data-source-id="SRC-CONCEPT-020"] img').count(), 1);
  assert.equal(await concept.locator('.concept-intro h2').innerText(), '設計從保留開始');
  assert.equal(await concept.locator('#concept-light .concept-plan-figure svg.concept-drawing').count(), 1);
  assert.equal(await concept.locator('.concept-detail-card').count(), 11);
  assert.deepEqual(
    await concept.locator('.concept-detail-grid').evaluate((grid) => {
      const cards = [...grid.children];
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        wide: cards.filter((card) => card.classList.contains('concept-detail-card--wide'))
          .map((card) => card.querySelector('h3')?.textContent),
      };
    }),
    { columns: 2, wide: ['尚未完成的專業檢核'] },
  );
  assert.match(await concept.locator('.concept-overview').innerText(), /不是替舊游泳池換上一張新的臉/);
  assert.equal(await concept.locator('.concept-origin-figure').count(), 7);
  assert.deepEqual(
    await concept.locator('.concept-origin-figure').evaluateAll((figures) =>
      figures.map((figure) => figure.getAttribute('data-source-id')),
    ),
    [
      'SRC-CONCEPT-013',
      'SRC-CONCEPT-017',
      'SRC-CONCEPT-016',
      'SRC-CONCEPT-022',
      'SRC-CONCEPT-021',
      'SRC-CONCEPT-018',
      'SRC-CONCEPT-019',
    ],
  );
  const originFigures = concept.locator('.concept-origin-figure');
  for (let index = 0; index < await originFigures.count(); index += 1) {
    const figure = originFigures.nth(index);
    await figure.scrollIntoViewIfNeeded();
    await figure.locator('img').evaluate((image) => {
      image.loading = 'eager';
    });
  }
  await concept.waitForFunction(() =>
    [...document.querySelectorAll('.concept-origin-figure img')]
      .every((image) => image.complete && image.naturalWidth > 0),
  );
  assert.equal(
    await concept.locator('.concept-origin-figure img').evaluateAll((images) =>
      images.every((image) => image.complete && image.naturalWidth > 0),
    ),
    true,
  );
  await concept.locator('.concept-origin-stage').nth(0).screenshot({
    path: resolve(outputDirectory, 'public-origin-survey-desktop.png'),
  });
  await concept.locator('.concept-origin-stage').nth(1).screenshot({
    path: resolve(outputDirectory, 'public-origin-sketches-desktop.png'),
  });
  await concept.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await concept.locator('.concept-chapter-title').evaluateAll((titles) =>
      titles.every((title) => getComputedStyle(title).display !== 'none'),
    ),
    true,
  );
  assert.equal(
    await concept.locator('.concept-detail-grid').evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    ),
    1,
  );
  assert.equal(
    await concept.locator('.concept-index strong').evaluateAll((titles) =>
      titles.every((title) => getComputedStyle(title).whiteSpace === 'nowrap'),
    ),
    true,
  );
  assert.equal(
    await concept.locator('#concept-people .concept-chapter-copy').evaluate((copy) => {
      const paragraph = copy.querySelector('p');
      const quote = copy.querySelector('blockquote');
      if (!paragraph || !quote) return false;
      const paragraphStyle = getComputedStyle(paragraph);
      const quoteStyle = getComputedStyle(quote);
      return quoteStyle.fontFamily === paragraphStyle.fontFamily
        && Math.abs(Number.parseFloat(quoteStyle.fontSize) - Number.parseFloat(paragraphStyle.fontSize)) <= 0.2
        && quoteStyle.borderLeftWidth === '2px';
    }),
    true,
  );
  await concept.locator('.concept-origin-stage').nth(0).screenshot({
    path: resolve(outputDirectory, 'public-origin-survey-mobile.png'),
  });
  await concept.locator('.concept-origin-stage').nth(1).screenshot({
    path: resolve(outputDirectory, 'public-origin-sketches-mobile.png'),
  });
  assert.equal(
    await concept.locator(
      '[data-source-id="SRC-CONCEPT-012"], [data-source-id="SRC-CONCEPT-014"], [data-source-id="SRC-CONCEPT-015"], [data-source-id="SRC-CONCEPT-023"]',
    ).count(),
    0,
  );
  await concept.keyboard.press('Tab');
  assert.equal(await concept.locator('.site-skip-link').evaluate((link) => link === document.activeElement), true);
  await concept.close();

  const drawings = await browser.newPage({ viewport: { width: 390, height: 844 } });
  trackErrors(drawings, errors);
  await drawings.goto(`${origin}/?view=drawings#SITE`, { waitUntil: 'networkidle' });
  await waitForView(drawings, 'drawings');
  await drawings.waitForFunction(() =>
    document.querySelector('.sheet-tabs-shell')?.classList.contains('can-scroll-right'),
  );
  assert.equal(
    await drawings.locator('.sheet-stage').evaluate((stage) => {
      const catalogue = document.querySelector('.drawings-catalogue');
      return catalogue !== null
        && Math.abs(stage.getBoundingClientRect().width - catalogue.getBoundingClientRect().width) <= 1;
    }),
    true,
  );
  assert.equal(
    await drawings.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
  );
  await drawings.locator('.sheet-tabs').evaluate((tabs) => {
    tabs.scrollLeft = Math.round((tabs.scrollWidth - tabs.clientWidth) / 2);
    tabs.dispatchEvent(new Event('scroll'));
  });
  await drawings.waitForFunction(() => {
    const shell = document.querySelector('.sheet-tabs-shell');
    return shell?.classList.contains('can-scroll-left') && shell.classList.contains('can-scroll-right');
  });
  await drawings.locator('.sheet-tabs').evaluate((tabs) => {
    tabs.scrollLeft = tabs.scrollWidth;
    tabs.dispatchEvent(new Event('scroll'));
  });
  await drawings.waitForFunction(() => {
    const shell = document.querySelector('.sheet-tabs-shell');
    return shell?.classList.contains('can-scroll-left') && !shell.classList.contains('can-scroll-right');
  });
  await drawings.close();

  const designProcess = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  trackErrors(designProcess, errors);
  await designProcess.goto(`${origin}/?view=design-process`, { waitUntil: 'networkidle' });
  await waitForView(designProcess, 'design-process');
  assert.match(await designProcess.title(), /^設計歷程｜.+概念設計$/);
  const processSectionIds = ['timeline', 'versions', 'pivots', 'corrections', 'open'].map((id) => `process-${id}`);
  assert.deepEqual(
    await designProcess.locator('.process-section').evaluateAll((sections) => sections.map((section) => section.id)),
    processSectionIds,
  );
  assert.deepEqual(
    await designProcess.locator('.process-index a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    processSectionIds.map((id) => `#${id}`),
  );
  assert.equal(await designProcess.locator('h1').count(), 1);
  assert.equal(await designProcess.locator('.process-milestone').count() >= 6, true);
  assert.equal(
    await designProcess.locator('.process-milestone').evaluateAll((items) =>
      items.every((item) => item.querySelector('.process-when')?.textContent.trim() && item.querySelector('h3')?.textContent.trim())),
    true,
    'every milestone needs a date label and a name',
  );
  // 兩張圖各三個版本：第一版手繪、第二版手繪、現行圖面，手繪稿要標出來源編號。
  assert.deepEqual(
    await designProcess.locator('.process-version').evaluateAll((versions) =>
      versions.map((version) => [...version.querySelectorAll('.process-version-figure')].map((figure) => ({
        stage: figure.querySelector('.process-stage')?.textContent.trim(),
        sourceId: figure.dataset.sourceId ?? null,
      })))),
    [
      [
        { stage: '第一版手繪', sourceId: 'SRC-CONCEPT-003' },
        { stage: '第二版手繪', sourceId: 'SRC-CONCEPT-010' },
        { stage: '現行圖面', sourceId: null },
      ],
      [
        { stage: '第一版手繪', sourceId: 'SRC-CONCEPT-001' },
        { stage: '第二版手繪', sourceId: 'SRC-CONCEPT-011' },
        { stage: '現行圖面', sourceId: null },
      ],
    ],
  );
  const versionImages = designProcess.locator('.process-version-figure img');
  assert.equal(await versionImages.count(), 6);
  for (let index = 0; index < 6; index += 1) await versionImages.nth(index).scrollIntoViewIfNeeded();
  await designProcess.waitForFunction(() =>
    [...document.querySelectorAll('.process-version-figure img')].every((image) => image.complete && image.naturalWidth > 0));
  assert.equal(
    await versionImages.evaluateAll((images) => images.every((image) => image.alt.trim().length >= 8)),
    true,
    'every version image needs a descriptive alt text',
  );
  const sketchLinks = await designProcess.locator('a.process-version-media').evaluateAll((links) =>
    links.map((link) => ({ href: link.href, target: link.target, rel: link.rel })));
  assert.equal(sketchLinks.length, 4);
  for (const { href, target, rel } of sketchLinks) {
    assert.equal(target, '_blank');
    assert.equal(rel, 'noopener');
    const response = await designProcess.request.get(href);
    assert.equal(response.ok(), true, `large sketch ${href} is not reachable`);
    assert.match(response.headers()['content-type'] ?? '', /^image\/jpeg/);
  }
  assert.equal(
    await designProcess.locator('.process-section a[href^="http"]').evaluateAll((links) =>
      links.length > 0 && links.every((link) => link.target === '_blank' && link.rel === 'noopener')),
    true,
  );
  assert.equal(
    await designProcess.locator('.process-section a:not([href^="http"]):not(.process-version-media)').evaluateAll((links) =>
      links.every((link) => ['./', '?view=solar-study', '?view=drawings', '?view=3d-viewer', '?view=about']
        .includes(link.getAttribute('href')))),
    true,
    'design-process in-site links must point to registered views',
  );
  assert.equal(await designProcess.locator('.process-card').count() >= 12, true);
  await designProcess.screenshot({ path: resolve(outputDirectory, 'public-design-process-desktop.png'), fullPage: true });
  await designProcess.close();

  const designProcessMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  trackErrors(designProcessMobile, errors);
  await designProcessMobile.goto(`${origin}/?view=design-process#process-versions`, { waitUntil: 'networkidle' });
  await waitForView(designProcessMobile, 'design-process');
  await designProcessMobile.waitForFunction(() => {
    const target = document.querySelector('#process-versions');
    const masthead = document.querySelector('.site-masthead');
    if (!target || !masthead) return false;
    const top = target.getBoundingClientRect().top;
    return top >= masthead.getBoundingClientRect().bottom - 1 && top < window.innerHeight;
  });
  assert.equal(
    await designProcessMobile.locator('.process-index a, a.process-version-media').evaluateAll((targets) =>
      targets.every((target) => target.getBoundingClientRect().height >= 44 && target.getBoundingClientRect().width >= 44)),
    true,
    'design-process tap targets are smaller than 44px at 390px',
  );
  assert.equal(
    await designProcessMobile.locator('.process-version-row').first().evaluate((row) =>
      getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/).length),
    1,
    'version comparison should stack into one column on a phone',
  );
  await designProcessMobile.screenshot({ path: resolve(outputDirectory, 'public-design-process-mobile.png') });
  await designProcessMobile.close();

  const about = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  trackErrors(about, errors);
  await about.goto(`${origin}/?view=about`, { waitUntil: 'networkidle' });
  await waitForView(about, 'about');
  // The page name before the separator comes from the route registry (DEC-170 one page, one name).
  assert.match(await about.title(), /^關於｜.+概念設計$/);
  const aboutSectionIds = ['project', 'reading', 'sources', 'glossary', 'faq', 'downloads'].map((id) => `about-${id}`);
  assert.deepEqual(
    await about.locator('.about-section').evaluateAll((sections) => sections.map((section) => section.id)),
    aboutSectionIds,
  );
  assert.deepEqual(
    await about.locator('.about-contents a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    aboutSectionIds.map((id) => `#${id}`),
  );
  assert.equal(await about.locator('h1').count(), 1);
  assert.equal(await about.locator('.about-term').count() >= 20, true);
  assert.equal(
    await about.locator('.about-section a[href^="http"]').evaluateAll((links) =>
      links.length > 0 && links.every((link) => link.target === '_blank' && link.rel === 'noopener'),
    ),
    true,
  );
  assert.equal(
    await about.locator('.about-section a:not([href^="http"]):not([download])').evaluateAll((links) =>
      links.length > 0
        && links.every((link) => ['./', '?view=solar-study', '?view=drawings', '?view=3d-viewer'].includes(link.getAttribute('href'))),
    ),
    true,
  );

  const questions = about.locator('.about-question');
  assert.equal(await questions.count() >= 8, true);
  assert.equal(await questions.evaluateAll((items) => items.every((item) => !item.open)), true);
  await questions.nth(0).locator('summary').click();
  assert.equal(await questions.nth(0).evaluate((item) => item.open), true);
  assert.equal(await questions.nth(0).locator('.about-answer').isVisible(), true);
  await questions.nth(1).locator('summary').focus();
  await about.keyboard.press('Enter');
  assert.equal(await questions.nth(1).evaluate((item) => item.open), true);

  const downloadLinks = await about.locator('[data-about-download]').evaluateAll((links) =>
    links.map((link) => ({ href: link.href, fileName: link.getAttribute('download') })),
  );
  assert.deepEqual(
    downloadLinks.map(({ fileName }) => fileName),
    ['DRAW-L1-PLAN.svg', 'DRAW-L2-PLAN.svg', 'DRAW-L3-PLAN.svg', 'DRAW-LONGITUDINAL-SECTION.svg'],
  );
  for (const { href, fileName } of downloadLinks) {
    const response = await fetch(href);
    assert.equal(response.ok, true, `${fileName} download is not reachable`);
    assert.match(response.headers.get('content-type') ?? '', /image\/svg\+xml/);
    assert.match(await response.text(), /<svg[\s>]/);
  }
  await about.screenshot({ path: resolve(outputDirectory, 'public-about-desktop.png'), fullPage: true });
  await about.close();

  const aboutDeepLink = await browser.newPage({ viewport: { width: 390, height: 844 } });
  trackErrors(aboutDeepLink, errors);
  await aboutDeepLink.goto(`${origin}/?view=about#about-faq-3`, { waitUntil: 'networkidle' });
  await waitForView(aboutDeepLink, 'about');
  assert.equal(await aboutDeepLink.locator('#about-faq-3').evaluate((item) => item.open), true);
  await aboutDeepLink.waitForFunction(() => {
    const target = document.querySelector('#about-faq-3');
    const masthead = document.querySelector('.site-masthead');
    if (!target || !masthead) return false;
    const top = target.getBoundingClientRect().top;
    return top >= masthead.getBoundingClientRect().bottom - 1 && top < window.innerHeight / 2;
  });
  assert.equal(
    await aboutDeepLink.locator('.about-contents a, .about-question summary, [data-about-download]').evaluateAll((targets) =>
      targets.every((target) => target.getBoundingClientRect().height >= 44),
    ),
    true,
  );
  await aboutDeepLink.screenshot({ path: resolve(outputDirectory, 'public-about-mobile.png') });
  await aboutDeepLink.close();

  const reentry = await browser.newPage({ viewport: { width: 390, height: 844 } });
  trackErrors(reentry, errors);
  await reentry.goto(origin, { waitUntil: 'networkidle' });
  for (const viewId of ['3d-viewer', 'design-concept', '3d-viewer']) {
    await openMenuIfFolded(reentry);
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
    'Unified public site smoke passed: 6 views × 5 viewports, routing, accessibility, isolation, and reduced motion.\n',
  );
  process.stdout.write(`Screenshots: ${outputDirectory}\n`);
} finally {
  await browser?.close();
  preview.kill();
}
