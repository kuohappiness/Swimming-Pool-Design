import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildFonts,
  collectCodepoints,
  formatUnicodeRange,
  parseUnicodeRange,
  planSubsets,
} from '../../../../tools/build/build-fonts.mjs';

test('unicode ranges round-trip between the CSS form and code points', () => {
  assert.deepEqual(parseUnicodeRange('U+20-22, U+4e00,U+958f-9590'), [
    [0x20, 0x22],
    [0x4e00, 0x4e00],
    [0x958f, 0x9590],
  ]);
  assert.equal(
    formatUnicodeRange([0x20, 0x21, 0x22, 0x4e00, 0x958f, 0x9590]),
    'U+20-22,U+4e00,U+958f-9590',
  );
});

test('only slices that hold characters the site uses are kept, each cut down to those characters', () => {
  const css = [
    '@font-face { src: url(./files/a.woff2) format("woff2"); unicode-range: U+4e00-4e10; }',
    '@font-face { src: url(./files/b.woff2) format("woff2"); unicode-range: U+5000-5010; }',
    '@font-face { src: url(./files/c.woff2) format("woff2"); unicode-range: U+20-7e; }',
  ].join('\n');
  assert.deepEqual(planSubsets(css, [0x41, 0x4e01, 0x4e02, 0x6000]), [
    { file: 'a.woff2', codepoints: [0x4e01, 0x4e02] },
    { file: 'c.woff2', codepoints: [0x41] },
  ]);
});

test('characters written anywhere in the page sources are collected, generated output is skipped', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fonts-'));
  try {
    await mkdir(join(root, 'content'), { recursive: true });
    await mkdir(join(root, 'web/src/generated'), { recursive: true });
    await writeFile(join(root, 'content/page.md'), '# 泳池\n');
    await writeFile(join(root, 'web/src/generated/old.json'), '"舊"');
    await writeFile(join(root, 'content/image.png'), '圖');
    const codepoints = await collectCodepoints(root, ['content', 'web/src']);
    assert.ok(codepoints.includes('泳'.codePointAt(0)));
    assert.ok(codepoints.includes('池'.codePointAt(0)));
    assert.ok(codepoints.includes('A'.codePointAt(0)), 'ASCII is always included');
    assert.ok(
      codepoints.includes('，'.codePointAt(0)),
      'common Chinese punctuation is always included',
    );
    assert.ok(!codepoints.includes('舊'.codePointAt(0)), 'generated files are not sources');
    assert.ok(!codepoints.includes('圖'.codePointAt(0)), 'binary files are not read');
    assert.deepEqual(
      codepoints,
      [...codepoints].sort((a, b) => a - b),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the site fonts are subset to the weights the design system uses and rebuilt only when the text changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fonts-'));
  try {
    await mkdir(join(root, 'content'), { recursive: true });
    await writeFile(join(root, 'content/page.md'), '游泳池改建');
    const outDir = join(root, 'out');
    const first = await buildFonts({ root, outDir });
    assert.equal(first.skipped, false);
    const css = await readFile(join(outDir, 'fonts.css'), 'utf8');
    assert.match(css, /font-family: "Noto Sans TC Web";/);
    assert.match(css, /font-family: "Noto Serif TC Web";/);
    assert.match(css, /font-weight: 400 700;/);
    assert.match(css, /font-display: swap;/);
    assert.match(css, /SIL Open Font License/);
    const files = (await readdir(outDir)).filter((name) => name.endsWith('.woff2'));
    assert.ok(files.length >= 2);
    for (const file of files) assert.ok(css.includes(`url("./${file}")`), `${file} is referenced`);

    assert.equal((await buildFonts({ root, outDir })).skipped, true);
    await writeFile(join(root, 'content/page.md'), '游泳池改建，日照');
    assert.equal((await buildFonts({ root, outDir })).skipped, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
