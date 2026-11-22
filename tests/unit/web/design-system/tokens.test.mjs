import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourceRoot = resolve(import.meta.dirname, '../../../../web/src');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path);
      return /\.(css|ts|html)$/.test(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}

const files = await sourceFiles(sourceRoot);
const sources = await Promise.all(
  files.map(async (path) => ({ path, text: await readFile(path, 'utf8') })),
);
const tokenSource = sources.find(({ path }) => path.endsWith('design-system/tokens.css')).text;
const defined = new Set(tokenSource.match(/--site-[a-z0-9-]+(?=\s*:)/g));
const used = new Map();
for (const { path, text } of sources) {
  for (const [, name] of text.matchAll(/var\(\s*(--site-[a-z0-9-]+)/g)) {
    if (!used.has(name)) used.set(name, path);
  }
}

test('every --site-* variable used by the site is defined in tokens.css', () => {
  const missing = [...used]
    .filter(([name]) => !defined.has(name))
    .map(([name, path]) => `${name} (${path})`);
  assert.deepEqual(missing, []);
});

test('tokens.css defines no --site-* variable that nothing uses', () => {
  assert.deepEqual(
    [...defined].filter((name) => !used.has(name)),
    [],
  );
});

test('--site-* variables are only defined in tokens.css', () => {
  const elsewhere = sources
    .filter(({ path }) => !path.endsWith('design-system/tokens.css'))
    .filter(({ text }) => /--site-[a-z0-9-]+\s*:/.test(text))
    .map(({ path }) => path);
  assert.deepEqual(elsewhere, []);
});
