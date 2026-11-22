import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const [routerSource, architecture] = await Promise.all([
  readFile(resolve(repoRoot, 'web/src/app/router.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'docs/architecture.md'), 'utf8'),
]);

function routeRegistry() {
  const block = routerSource.slice(routerSource.indexOf('export const viewDefinitions'));
  const pattern = /id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*eyebrow:\s*'([^']+)'/g;
  return [...block.matchAll(pattern)].map(([, id, label, eyebrow]) => ({ id, label, eyebrow }));
}

function glossaryRows() {
  const section = architecture.split(/\n## /).find((part) => part.startsWith('6. 名詞對照'));
  assert.ok(section, 'docs/architecture.md must keep section 6 名詞對照');
  const table = section.split('\n\n').find((part) => part.startsWith('| 中文頁名 |'));
  assert.ok(table, 'section 6 must start its page table with the 中文頁名 column');
  return table
    .split('\n')
    .slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim().replaceAll('`', '')))
    .map(([label, eyebrow, id, folder]) => ({ id, label, eyebrow, folder }));
}

test('glossary lists every registered view with its label and eyebrow, in route order', () => {
  const registry = routeRegistry();
  assert.equal(registry.length, 6);
  assert.deepEqual(
    glossaryRows().map(({ id, label, eyebrow }) => ({ id, label, eyebrow })),
    registry,
  );
});

test('glossary folders exist and match the view id', async () => {
  for (const { id, folder } of glossaryRows()) {
    assert.equal(folder, `web/src/views/${id}/`);
    await access(resolve(repoRoot, folder, 'index.ts'));
  }
});
