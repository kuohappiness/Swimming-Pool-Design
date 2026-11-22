import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ABOUT_SECTION_IDS, compileSectionedContent } from '../../../../tools/build/build-content.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const [modelText, aboutMarkdown] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'),
  readFile(resolve(repoRoot, 'content/about.md'), 'utf8'),
]);
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
