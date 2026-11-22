// 網站字型（DEC-211）：從 @fontsource-variable 的思源黑體、思源宋體切片中，
// 只取網站實際用到的字做成子集，輸出到 web/src/generated/fonts/（不入庫）。
// 其他人加了新文字不需要做任何事：prepare、predev 與 build 都會先跑這支，
// 字集沒變時直接跳過。
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);

/** 會出現在網站上的文字來源。多收不會錯，只是字型稍大；漏收的字會改用系統字型。 */
export const TEXT_SOURCES = ['content', 'web/src', 'drawings/current', 'model', 'core'];
const TEXT_FILE = /\.(?:md|ts|mjs|css|html|svg|json)$/;
const SKIPPED_DIRS = new Set(['generated', 'node_modules']);

/** 不論原稿有沒有用到都收進子集：英數與常用中文標點。 */
const ALWAYS_INCLUDED = [
  ...Array.from({ length: 0x7f - 0x20 }, (_, index) => 0x20 + index),
  ...[...'，。、；：？！「」『』（）《》〈〉…—–·％～＋－×÷±°′″²³→←↑↓'].map((char) =>
    char.codePointAt(0),
  ),
];

export const FAMILIES = [
  {
    family: 'Noto Sans TC Web',
    name: 'Noto Sans TC',
    package: '@fontsource-variable/noto-sans-tc',
    manifest: require('@fontsource-variable/noto-sans-tc/package.json'),
    dir: dirname(require.resolve('@fontsource-variable/noto-sans-tc/package.json')),
    prefix: 'sans',
  },
  {
    family: 'Noto Serif TC Web',
    name: 'Noto Serif TC',
    package: '@fontsource-variable/noto-serif-tc',
    manifest: require('@fontsource-variable/noto-serif-tc/package.json'),
    dir: dirname(require.resolve('@fontsource-variable/noto-serif-tc/package.json')),
    prefix: 'serif',
  },
];

/** 只保留 400 到 700 的字重軸：設計系統只用 400、500、700（DEC-211）。 */
export const WEIGHT_RANGE = { min: 400, max: 700 };

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) yield* walk(path);
    } else if (TEXT_FILE.test(entry.name)) {
      yield path;
    }
  }
}

/** 回傳排序過的碼位：來源檔案裡所有可見字元，加上固定收錄的英數與標點。 */
export async function collectCodepoints(root = repoRoot, sources = TEXT_SOURCES) {
  const codepoints = new Set(ALWAYS_INCLUDED);
  for (const source of sources) {
    const directory = join(root, source);
    if (!existsSync(directory)) continue;
    for await (const file of walk(directory)) {
      for (const char of await readFile(file, 'utf8')) {
        const codepoint = char.codePointAt(0);
        if (codepoint >= 0x20 && codepoint !== 0x7f) codepoints.add(codepoint);
      }
    }
  }
  return [...codepoints].sort((a, b) => a - b);
}

/** 解析 unicode-range（例如 `U+0-ff,U+3000-303f`）成 [起, 迄] 的陣列。 */
export function parseUnicodeRange(value) {
  return value.split(',').map((part) => {
    const [start, end] = part
      .trim()
      .replace(/^U\+/i, '')
      .split('-')
      .map((hex) => parseInt(hex, 16));
    return [start, end ?? start];
  });
}

/** 把排序過的碼位壓成 unicode-range 字串。 */
export function formatUnicodeRange(codepoints) {
  const parts = [];
  for (let index = 0; index < codepoints.length; index += 1) {
    const start = codepoints[index];
    while (codepoints[index + 1] === codepoints[index] + 1) index += 1;
    const end = codepoints[index];
    parts.push(
      start === end ? `U+${start.toString(16)}` : `U+${start.toString(16)}-${end.toString(16)}`,
    );
  }
  return parts.join(',');
}

/**
 * 從字型套件的 wght.css 找出要用的切片：每一片只留網站用到的字。
 * 回傳 [{ file, codepoints }]，沒有用到字的切片不列。
 */
export function planSubsets(fontCss, codepoints) {
  const plan = [];
  for (const match of fontCss.matchAll(
    /src:\s*url\(\.\/files\/([^)]+)\)[^;]*;\s*unicode-range:\s*([^;]+);/g,
  )) {
    const ranges = parseUnicodeRange(match[2]);
    const used = codepoints.filter((codepoint) =>
      ranges.some(([start, end]) => codepoint >= start && codepoint <= end),
    );
    if (used.length) plan.push({ file: match[1], codepoints: used });
  }
  return plan;
}

function fontFace(family, file, codepoints) {
  return [
    '@font-face {',
    `  font-family: "${family}";`,
    '  font-style: normal;',
    `  font-weight: ${WEIGHT_RANGE.min} ${WEIGHT_RANGE.max};`,
    '  font-display: swap;',
    `  src: url("./${file}") format("woff2");`,
    `  unicode-range: ${formatUnicodeRange(codepoints)};`,
    '}',
  ].join('\n');
}

export async function buildFonts({
  root = repoRoot,
  outDir = join(root, 'web/src/generated/fonts'),
  force = false,
} = {}) {
  const codepoints = await collectCodepoints(root);
  const versions = FAMILIES.map(({ package: name, manifest }) => `${name}@${manifest.version}`);
  const stamp = createHash('sha256')
    .update(JSON.stringify({ versions, codepoints, weight: WEIGHT_RANGE }))
    .digest('hex');
  const stampFile = join(outDir, 'stamp.txt');
  if (!force && existsSync(stampFile) && (await readFile(stampFile, 'utf8')) === stamp) {
    return { skipped: true, outDir };
  }

  const { default: subsetFont } = await import('subset-font');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const css = [];
  const summary = [];
  for (const {
    family,
    name,
    package: packageName,
    manifest,
    dir: packageDir,
    prefix,
  } of FAMILIES) {
    const plan = planSubsets(await readFile(join(packageDir, 'wght.css'), 'utf8'), codepoints);
    const { version } = manifest;
    css.push(
      `/*! ${name} (${packageName}@${version})，SIL Open Font License 1.1，https://openfontlicense.org */`,
    );
    let bytes = 0;
    for (const [index, { file, codepoints: used }] of plan.entries()) {
      const source = await readFile(join(packageDir, 'files', file));
      const subset = await subsetFont(source, String.fromCodePoint(...used), {
        targetFormat: 'woff2',
        variationAxes: { wght: WEIGHT_RANGE },
      });
      const output = `${prefix}-${String(index).padStart(2, '0')}.woff2`;
      await writeFile(join(outDir, output), subset);
      css.push(fontFace(family, output, used));
      bytes += subset.length;
    }
    summary.push({ family, files: plan.length, bytes });
  }

  await writeFile(join(outDir, 'fonts.css'), `${css.join('\n\n')}\n`);
  await writeFile(stampFile, stamp);
  return { skipped: false, outDir, codepoints: codepoints.length, summary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildFonts({ force: process.argv.includes('--force') });
  const where = relative(repoRoot, result.outDir);
  if (result.skipped) {
    console.log(`Fonts unchanged: ${where}`);
  } else {
    const parts = result.summary.map(
      ({ family, files, bytes }) => `${family} ${files} files ${Math.round(bytes / 1024)} KB`,
    );
    console.log(`Fonts built: ${result.codepoints} characters; ${parts.join('; ')} → ${where}`);
  }
}
