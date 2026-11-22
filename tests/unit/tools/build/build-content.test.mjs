import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ABOUT_SECTION_IDS,
  DESIGN_PROCESS_SECTION_IDS,
  RAINFALL_SOURCE_PATH,
  WATER_CYCLE_SECTION_IDS,
  compileSectionedContent,
  injectRecordQuotes,
  readRecords,
  recordKeysIn,
  recordPathFor,
  waterCycleDataFor,
} from '../../../../tools/build/build-content.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const [modelText, aboutMarkdown, designProcessMarkdown, waterCycleMarkdown, rainfallText] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'content/about.md'), 'utf8'),
  readFile(resolve(repoRoot, 'content/design-process.md'), 'utf8'),
  readFile(resolve(repoRoot, 'content/water-cycle.md'), 'utf8'),
  readFile(resolve(repoRoot, RAINFALL_SOURCE_PATH), 'utf8'),
]);
const rainfallSource = JSON.parse(rainfallText);
const designProcessRecords = await readRecords(repoRoot, designProcessMarkdown);
const model = JSON.parse(modelText);
const clone = () => structuredClone(model);
const activeRevision = model.geometryRevisions.find(({ id }) => id === model.activeGeometryRevisionId);

const sample = [
  '<!-- section:intro -->',
  '## 開場',
  '',
  '第一段，含 [連結](?view=drawings)。',
  '',
  '<!-- section:terms -->',
  '## 名詞',
  '',
  '### 坡度',
  '',
  '屋頂坡度 {{active:roof.pitch|degree}}。',
  '',
  '### 池長',
  '',
  '池體長 {{derived:poolLength|metre}}。',
].join('\n');

test('sectioned content splits intro and items and injects model tokens', () => {
  const compiled = compileSectionedContent(sample, clone(), ['intro', 'terms']);
  assert.deepEqual(compiled.sections.map(({ id, title }) => ({ id, title })), [
    { id: 'intro', title: '開場' },
    { id: 'terms', title: '名詞' },
  ]);
  assert.equal(compiled.sections[0].html, '<p>第一段，含 <a href="?view=drawings">連結</a>。</p>');
  assert.deepEqual(compiled.sections[0].items, []);
  assert.deepEqual(compiled.sections[1].items, [
    { id: 'terms-1', title: '坡度', html: `<p>屋頂坡度 ${activeRevision.roof.pitch}°。</p>` },
    { id: 'terms-2', title: '池長', html: '<p>池體長 25 m。</p>' },
  ]);
  assert.equal(compiled.modelVersion, model.modelVersion);
  assert.match(compiled.contentHash, /^[0-9a-f]{64}$/);
});

test('sectioned content follows the model instead of hand-typed numbers', () => {
  const changed = clone();
  const active = changed.geometryRevisions.find(({ id }) => id === changed.activeGeometryRevisionId);
  active.roof.pitch = 7.5;
  const compiled = compileSectionedContent(sample, changed, ['intro', 'terms']);
  assert.equal(compiled.sections[1].items[0].html, '<p>屋頂坡度 7.5°。</p>');
});

test('sectioned content rejects missing, extra, reordered or malformed sections', () => {
  assert.throws(() => compileSectionedContent(sample, clone(), ['intro']), /sections must be exactly/);
  assert.throws(() => compileSectionedContent(sample, clone(), ['terms', 'intro']), /sections must be exactly/);
  assert.throws(() => compileSectionedContent(sample, clone(), ['intro', 'terms', 'faq']), /sections must be exactly/);
  assert.throws(
    () => compileSectionedContent(`${sample}\n\n<!-- section:intro -->\n## 重複`, clone(), ['intro', 'terms']),
    /repeats section ID/,
  );
  assert.throws(
    () => compileSectionedContent(`前言\n${sample}`, clone(), ['intro', 'terms']),
    /must begin with an explicit section reference/,
  );
  assert.throws(
    () => compileSectionedContent(sample.replace('## 開場', '第一行不是標題'), clone(), ['intro', 'terms']),
    /must start with a level-2 title/,
  );
  assert.throws(
    () => compileSectionedContent(`${sample}\n\n## 第二個標題`, clone(), ['intro', 'terms']),
    /only one level-2 title/,
  );
  assert.throws(
    () => compileSectionedContent(`${sample}\n\n### 空的項目`, clone(), ['intro', 'terms']),
    /has no content/,
  );
  assert.throws(
    () => compileSectionedContent(sample.replace('roof.pitch', 'roof.missing'), clone(), ['intro', 'terms']),
    /token path does not exist/,
  );
});

test('about page copy compiles with every required section and no unresolved token', () => {
  const compiled = compileSectionedContent(aboutMarkdown, clone(), ABOUT_SECTION_IDS);
  assert.deepEqual(compiled.sections.map(({ id }) => id), ABOUT_SECTION_IDS);
  const bySection = Object.fromEntries(compiled.sections.map((section) => [section.id, section]));
  assert.ok(bySection.glossary.items.length >= 20);
  assert.ok(bySection.faq.items.length >= 8);
  assert.equal(bySection.downloads.items.length, 0);
  const itemTitles = compiled.sections.flatMap(({ items }) => items.map(({ title }) => title));
  assert.equal(new Set(itemTitles).size, itemTitles.length, 'about item titles must be unique');
  const html = compiled.sections.map((section) => section.html + section.items.map((item) => item.html).join('')).join('');
  assert.doesNotMatch(html, /\{\{|\}\}/);
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    assert.match(
      href,
      /^(\.\/|\?view=(solar-study|drawings|3d-viewer|about)|https:\/\/github\.com\/kuohappiness\/Swimming-Pool-Design(\/|$))/,
      `unexpected link target in about copy: ${href}`,
    );
  }
});

test('about page copy carries no hand-typed design dimensions', () => {
  // Lengths and elevations must come from model tokens; general angles such as 90° are definitions, not design values.
  const withoutTokens = aboutMarkdown.replace(/\{\{[^}]+\}\}/g, '');
  assert.doesNotMatch(withoutTokens, /(?<![A-Za-z0-9.])\d+(\.\d+)?\s*(m²|m³|m|公尺|公分)(?![A-Za-z])/u);
});

test('record quotes render only when the cited record really contains them', () => {
  const records = { '0.3.0': '2F 水平旋轉 +9.5°、鏡牆外傾 +8.5°', sources: '標示 33 m 泳池主體' };
  assert.equal(
    injectRecordQuotes('轉 {{record:0.3.0|9.5°}}，主體 {{record:sources|33 m}}。', records),
    '轉 9.5°，主體 33 m。',
  );
  assert.throws(() => injectRecordQuotes('{{record:0.3.0|12°}}', records), /does not appear in docs\/releases\/0\.3\.0\.md/);
  assert.throws(() => injectRecordQuotes('{{record:0.5.0|20.5 × 7.5 m}}', records), /was not provided/);
  assert.throws(() => injectRecordQuotes('{{record:notes|1 m}}', records), /Unknown record key/);
  assert.deepEqual(recordKeysIn('{{record:0.3.0|a}} {{record:sources|b}} {{record:0.3.0|c}}'), ['0.3.0', 'sources']);
  assert.equal(recordPathFor('0.6.0'), 'docs/releases/0.6.0.md');
  assert.equal(recordPathFor('sources'), 'docs/site-and-sources.md');
  // A page that quotes a record cannot be compiled without that record.
  const page = ['<!-- section:a -->', '## 標題', '', '舊值 {{record:0.3.0|9.5°}}。'].join('\n');
  assert.throws(() => compileSectionedContent(page, clone(), ['a']), /was not provided/);
  assert.match(compileSectionedContent(page, clone(), ['a'], { records }).sections[0].html, /舊值 9\.5°。/);
});

test('design process copy compiles against the model and the records it quotes', () => {
  const compiled = compileSectionedContent(
    designProcessMarkdown,
    clone(),
    DESIGN_PROCESS_SECTION_IDS,
    { records: designProcessRecords },
  );
  assert.deepEqual(compiled.sections.map(({ id }) => id), DESIGN_PROCESS_SECTION_IDS);
  const bySection = Object.fromEntries(compiled.sections.map((section) => [section.id, section]));
  assert.equal(bySection.overview.items.length, 0);
  assert.ok(bySection.overview.html.length > 0);
  assert.ok(bySection.timeline.items.length >= 6);
  for (const { title } of bySection.timeline.items) {
    assert.match(title, /^[^｜]+｜[^｜]+$/, `timeline title needs "<when>｜<name>": ${title}`);
  }
  // The page shows two drawings in three versions each: one paragraph with a bold stage label per image.
  assert.equal(bySection.versions.items.length, 2);
  for (const { title, html } of bySection.versions.items) {
    assert.deepEqual(
      [...html.matchAll(/<p><strong>([^<]+)<\/strong>/g)].map((match) => match[1]),
      ['第一版手繪', '第二版手繪', '現行圖面'],
      `version item "${title}" must describe the three versions in order`,
    );
    assert.equal(html.match(/<p>/g).length, 3);
  }
  assert.ok(bySection.pivots.items.length >= 5);
  assert.ok(bySection.corrections.items.length >= 3);
  assert.ok(bySection.open.items.length >= 4);
  const html = compiled.sections.map((section) => section.html + section.items.map((item) => item.html).join('')).join('');
  assert.doesNotMatch(html, /\{\{|\}\}/);
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    assert.match(
      href,
      /^(\.\/|\?view=(solar-study|drawings|3d-viewer|about)|https:\/\/github\.com\/kuohappiness\/Swimming-Pool-Design(\/|$))/,
      `unexpected link target in design process copy: ${href}`,
    );
  }
  // Current values follow the model: change the roof pitch and the page changes with it.
  const changed = clone();
  changed.geometryRevisions.find(({ id }) => id === changed.activeGeometryRevisionId).roof.pitch = 6;
  const recompiled = compileSectionedContent(
    designProcessMarkdown,
    changed,
    DESIGN_PROCESS_SECTION_IDS,
    { records: designProcessRecords },
  );
  assert.notEqual(recompiled.contentHash, compiled.contentHash);
});

test('design process copy carries no hand-typed measurement', () => {
  // Current values are model tokens and superseded values are record quotes, so nothing with a unit is typed by hand.
  const withoutTokens = designProcessMarkdown.replace(/\{\{[^}]+\}\}/g, '');
  assert.doesNotMatch(withoutTokens, /(?<![A-Za-z0-9.])\d+(\.\d+)?\s*(m²|m³|m|公尺|公分|°|度|kWh|%)(?![A-Za-z])/u);
  assert.ok(recordKeysIn(designProcessMarkdown).length >= 3);
});

test('data tokens read the page data and fail closed without it', () => {
  const markdown = [
    '<!-- section:intro -->',
    '## 雨',
    '',
    '{{data:station|text}} 一年 {{data:annualMm|millimetre}}，屋頂 {{data:area|squareMetre}}，'
      + '約 {{data:volume|cubicMetre}}，佔 {{data:share|percent}}，{{data:pools|decimal1}} 座，距離 {{data:distance|kilometre}}。',
  ].join('\n');
  const data = { station: '測站', annualMm: 1762.84, area: 406, volume: 1715.4, share: 0.7773, pools: 2.4948, distance: 0.433 };
  const compiled = compileSectionedContent(markdown, clone(), ['intro'], { data });
  assert.equal(
    compiled.sections[0].html,
    '<p>測站 一年 1,762.8 mm，屋頂 406 m²，約 1,715 m³，佔 78%，2.5 座，距離 0.4 km。</p>',
  );
  assert.throws(() => compileSectionedContent(markdown, clone(), ['intro']), /Token owner data was not provided/);
  assert.throws(
    () => compileSectionedContent(markdown, clone(), ['intro'], { data: { ...data, annualMm: undefined } }),
    /Model token path does not exist: annualMm/,
  );
  assert.throws(
    () => compileSectionedContent(markdown, clone(), ['intro'], { data: { ...data, station: '' } }),
    /text requires a non-empty string/,
  );
  assert.throws(
    () => compileSectionedContent(markdown, clone(), ['intro'], { data: { ...data, volume: '多' } }),
    /requires a finite number/,
  );
});

test('water cycle copy compiles from the registered rainfall and the active model', () => {
  const data = waterCycleDataFor(clone(), rainfallSource);
  const compiled = compileSectionedContent(waterCycleMarkdown, clone(), WATER_CYCLE_SECTION_IDS, { data });
  assert.deepEqual(compiled.sections.map(({ id }) => id), WATER_CYCLE_SECTION_IDS);
  const html = compiled.sections.map((section) => [section.html, ...section.items.map((item) => item.html)].join('\n')).join('\n');
  assert.doesNotMatch(html, /\{\{/);
  // The page states the station, the period and the open item it depends on.
  assert.match(html, new RegExp(`站號 ${rainfallSource.station.number}`));
  assert.match(html, new RegExp(rainfallSource.statisticalPeriod));
  assert.match(html, /OPEN-014/);
  assert.match(html, /概念估算/);
  assert.doesNotMatch(html, /符合法規/);
  assert.equal(compiled.sections.find(({ id }) => id === 'path').items.length, 8);
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    assert.match(
      href,
      /^(\.\/|\?view=3d-viewer#rain|https:\/\/www\.cwa\.gov\.tw\/V8\/|https:\/\/github\.com\/kuohappiness\/Swimming-Pool-Design\/)/,
      `unexpected link target in water cycle copy: ${href}`,
    );
  }
  // The roof is the active glass roof and the yardstick is the active pool.
  const active = model.geometryRevisions.find(({ id }) => id === model.activeGeometryRevisionId);
  const { x1, x2, y1, y2 } = active.roof.bounds;
  assert.equal(data.roofAreaM2, (x2 - x1) * (y2 - y1));
  assert.equal(data.annualMm, rainfallSource.monthlyPrecipitation.annual);
  assert.ok(Math.abs(data.annualVolumeM3 - data.annualMm * data.roofAreaM2 / 1000) < 1e-9);
  assert.ok(data.stationDistanceKm < 1, 'the registered station should be the one next to the site');
  // A longer roof catches more rain, and the page follows.
  const changed = clone();
  changed.geometryRevisions.find(({ id }) => id === changed.activeGeometryRevisionId).roof.bounds.x2 += 1;
  const changedData = waterCycleDataFor(changed, rainfallSource);
  assert.ok(changedData.annualVolumeM3 > data.annualVolumeM3);
  const recompiled = compileSectionedContent(waterCycleMarkdown, changed, WATER_CYCLE_SECTION_IDS, { data: changedData });
  assert.notEqual(recompiled.contentHash, compiled.contentHash);
});

test('water cycle copy carries no hand-typed measurement', () => {
  // Rainfall comes from the registered source and sizes from the model, so nothing with a unit is typed by hand.
  const withoutTokens = waterCycleMarkdown.replace(/\{\{[^}]+\}\}/g, '');
  assert.doesNotMatch(
    withoutTokens,
    /(?<![A-Za-z0-9.])\d+(\.\d+)?\s*(mm|毫米|m²|m³|km|m|公尺|公分|公里|公升|平方公尺|立方公尺|°|度|kWh|%)(?![A-Za-z])/u,
  );
  assert.ok((waterCycleMarkdown.match(/\{\{data:/g) ?? []).length >= 15);
});
