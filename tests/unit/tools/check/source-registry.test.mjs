import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSourceTable, validateSourceRegistry } from '../../../../tools/check/source-registry.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const hash = 'A'.repeat(64);
const table = [
  '| 編號 | 路徑 | 內容 | 尺寸 | SHA-256 |',
  '| --- | --- | --- | --- | --- |',
  `| SRC-SITE-001 | \`source-materials/site/a.png\` | 衛星圖 | 1612 × 1430 | \`${hash}\` |`,
  `| SRC-CONCEPT-012 | \`source-materials/site/photos/b.jpeg\` | 場勘 | image/jpeg；8064 × 4536；6,141,202 bytes | \`${hash}\` |`,
].join('\n');
const model = () => ({
  sources: [
    { id: 'SRC-SITE-001', path: 'source-materials/site/a.png', pixelSize: [1612, 1430], sha256: hash },
    { id: 'SRC-CONCEPT-012', path: 'source-materials/site/photos/b.jpeg', pixelSize: [8064, 4536], byteSize: 6141202, sha256: hash },
  ],
});

test('source table rows parse into path, pixel size, byte size and hash', () => {
  const [site, photo] = parseSourceTable(table);
  assert.deepEqual(site, { id: 'SRC-SITE-001', path: 'source-materials/site/a.png', pixelSize: [1612, 1430], byteSize: undefined, sha256: hash });
  assert.deepEqual(photo.pixelSize, [8064, 4536]);
  assert.equal(photo.byteSize, 6141202);
});

test('source registry accepts a table that matches the model', () => {
  assert.deepEqual(validateSourceRegistry({ text: table, source: 'doc', model: model() }), []);
});

test('source registry reports every kind of drift between table and model', () => {
  const cases = [
    [(m) => { m.sources.pop(); }, /SRC-CONCEPT-012 is listed in the source table but missing from model sources/],
    [(m) => { m.sources.push({ id: 'SRC-SITE-009', path: 'x', sha256: hash }); }, /model source SRC-SITE-009 is missing from the source table/],
    [(m) => { m.sources[0].path = 'source-materials/site/other.png'; }, /SRC-SITE-001 path differs/],
    [(m) => { m.sources[0].sha256 = 'B'.repeat(64); }, /SRC-SITE-001 SHA-256 differs/],
    [(m) => { m.sources[1].pixelSize = [4536, 8064]; }, /SRC-CONCEPT-012 pixel size 8064 × 4536 differs/],
    [(m) => { m.sources[1].byteSize = 1; }, /SRC-CONCEPT-012 byte size 6141202 differs/],
    [(m) => { m.sources[0].byteSize = 3833443; }, /SRC-SITE-001 has a model byte size but the table does not state one/],
  ];
  for (const [mutate, pattern] of cases) {
    const value = model();
    mutate(value);
    const errors = validateSourceRegistry({ text: table, source: 'doc', model: value });
    assert.ok(errors.some((error) => pattern.test(error)), `${pattern} not reported: ${errors.join('; ')}`);
  }
});

test('the repository source table and model sources agree', async () => {
  const [text, modelText] = await Promise.all([
    readFile(path.join(repoRoot, 'docs', 'site-and-sources.md'), 'utf8'),
    readFile(path.join(repoRoot, 'model', 'project-model.json'), 'utf8'),
  ]);
  const value = JSON.parse(modelText);
  assert.deepEqual(validateSourceRegistry({ text, source: 'docs/site-and-sources.md', model: value }), []);
  assert.equal(value.sources.length, parseSourceTable(text).length);
});
