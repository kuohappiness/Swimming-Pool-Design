import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isDerivativeImage,
  parseSourceTable,
  validateDerivativeImages,
  validateSourceRegistry,
} from '../../../../tools/check/source-registry.mjs';

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
    {
      id: 'SRC-SITE-001',
      path: 'source-materials/site/a.png',
      pixelSize: [1612, 1430],
      sha256: hash,
    },
    {
      id: 'SRC-CONCEPT-012',
      path: 'source-materials/site/photos/b.jpeg',
      pixelSize: [8064, 4536],
      byteSize: 6141202,
      sha256: hash,
    },
  ],
});

test('source table rows parse into path, pixel size, byte size and hash', () => {
  const [site, photo] = parseSourceTable(table);
  assert.deepEqual(site, {
    id: 'SRC-SITE-001',
    path: 'source-materials/site/a.png',
    pixelSize: [1612, 1430],
    byteSize: undefined,
    sha256: hash,
  });
  assert.deepEqual(photo.pixelSize, [8064, 4536]);
  assert.equal(photo.byteSize, 6141202);
});

test('source table covers every file-backed category but not the regulation registry', () => {
  const extra = `${table}\n| SRC-DATA-001 | \`source-materials/data/c.json\` | 氣候 | JSON；2,028 bytes；12 個月 | \`${hash}\` |\n| SRC-REG-001 | 建築技術規則 | 第 33 條 | 110 年版 | — | 2026-11-21 | 已讀條文 |`;
  assert.deepEqual(
    parseSourceTable(extra).map(({ id }) => id),
    ['SRC-SITE-001', 'SRC-CONCEPT-012', 'SRC-DATA-001'],
  );
  assert.equal(parseSourceTable(extra)[2].byteSize, 2028);
});

test('source registry accepts a table that matches the model', () => {
  assert.deepEqual(validateSourceRegistry({ text: table, source: 'doc', model: model() }), []);
});

test('source registry reports every kind of drift between table and model', () => {
  const cases = [
    [
      (m) => {
        m.sources.pop();
      },
      /SRC-CONCEPT-012 is listed in the source table but missing from model sources/,
    ],
    [
      (m) => {
        m.sources.push({ id: 'SRC-SITE-009', path: 'x', sha256: hash });
      },
      /model source SRC-SITE-009 is missing from the source table/,
    ],
    [
      (m) => {
        m.sources[0].path = 'source-materials/site/other.png';
      },
      /SRC-SITE-001 path differs/,
    ],
    [
      (m) => {
        m.sources[0].sha256 = 'B'.repeat(64);
      },
      /SRC-SITE-001 SHA-256 differs/,
    ],
    [
      (m) => {
        m.sources[1].pixelSize = [4536, 8064];
      },
      /SRC-CONCEPT-012 pixel size 8064 × 4536 differs/,
    ],
    [
      (m) => {
        m.sources[1].byteSize = 1;
      },
      /SRC-CONCEPT-012 byte size 6141202 differs/,
    ],
    [
      (m) => {
        m.sources[0].byteSize = 3833443;
      },
      /SRC-SITE-001 has a model byte size but the table does not state one/,
    ],
  ];
  for (const [mutate, pattern] of cases) {
    const value = model();
    mutate(value);
    const errors = validateSourceRegistry({ text: table, source: 'doc', model: value });
    assert.ok(
      errors.some((error) => pattern.test(error)),
      `${pattern} not reported: ${errors.join('; ')}`,
    );
  }
});

test('the repository source table and model sources agree', async () => {
  const [text, modelText] = await Promise.all([
    readFile(path.join(repoRoot, 'docs', 'site-and-sources.md'), 'utf8'),
    readFile(path.join(repoRoot, 'model', 'project-model.json'), 'utf8'),
  ]);
  const value = JSON.parse(modelText);
  assert.deepEqual(
    validateSourceRegistry({ text, source: 'docs/site-and-sources.md', model: value }),
    [],
  );
  assert.equal(value.sources.length, parseSourceTable(text).length);
});

test('derivative images are web images outside the 3D assets and generated files', () => {
  assert.equal(isDerivativeImage('web/public/favicon-32.png'), true);
  assert.equal(
    isDerivativeImage('web/src/views/design-concept/assets/origin-section-960.jpg'),
    true,
  );
  assert.equal(isDerivativeImage('web/src/views/3d-viewer/assets/materials/tile.webp'), false);
  assert.equal(isDerivativeImage('web/src/generated/fonts/a.png'), false);
  assert.equal(isDerivativeImage('web/src/views/drawings/index.ts'), false);
  assert.equal(isDerivativeImage('source-materials/site/a.png'), false);
});

test('derivative images must be registered with matching byte size and hash', () => {
  const text = `衍生檔 \`web/public/icon.png\`（32 × 32、1,972 bytes、SHA-256 \`${hash}\`）與 \`b-960.jpg\`（960 × 540、125,785 bytes、SHA-256 \`${hash}\`）。`;
  const image = (name, byteSize, sha256 = hash.toLowerCase()) => ({
    path: `web/x/${name}`,
    byteSize,
    sha256,
  });
  assert.deepEqual(
    validateDerivativeImages({
      text,
      source: 'doc',
      images: [image('icon.png', 1972), image('b-960.jpg', 125785)],
    }),
    [],
  );
  const errors = validateDerivativeImages({
    text,
    source: 'doc',
    images: [
      image('c.webp', 1),
      image('icon.png', 1973),
      image('b-960.jpg', 125785, 'b'.repeat(64)),
    ],
  });
  assert.equal(errors.length, 3);
  assert.match(errors[0], /web\/x\/c\.webp is not registered/);
  assert.match(errors[1], /web\/x\/icon\.png registration does not match 1,973 bytes/);
  assert.match(errors[2], /web\/x\/b-960\.jpg registration does not match/);
});
