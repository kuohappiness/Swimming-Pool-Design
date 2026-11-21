import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { findRows, findSection, headings } from '../../../tools/section.mjs';

const repoRoot = resolve(import.meta.dirname, '../../..');
const sample = `# 文件

## 1. 甲

甲的內容

\`\`\`text
## 不是標題
\`\`\`

### 甲之一

## 2. 乙

| ID | 內容 |
| --- | --- |
| DEC-001 | 第一條 |
| DEC-010 | 第十條，提到 DEC-001 |
`;

test('headings skip fenced code and know where each section ends', () => {
  const found = headings(sample);
  assert.deepEqual(found.map(({ level, title, line, end }) => [level, title, line, end]), [
    [1, '文件', 1, 18],
    [2, '1. 甲', 3, 12],
    [3, '甲之一', 11, 12],
    [2, '2. 乙', 13, 18],
  ]);
});

test('sections match exact titles first, then unique partial titles', () => {
  assert.equal(findSection(sample, '1. 甲').section.line, 3);
  assert.equal(findSection(sample, '乙').section.line, 13);
  assert.equal(findSection(sample, '甲').candidates.length, 2);
});

test('ID lookup returns only rows whose first cell is that ID', () => {
  assert.deepEqual(findRows(sample, 'DEC-001'), [{ line: 17, text: '| DEC-001 | 第一條 |' }]);
  assert.deepEqual(findRows(sample, 'DEC-999'), []);
});

test('the command prints one section of a repo document', () => {
  const output = execFileSync(process.execPath, ['tools/section.mjs', 'docs/roadmap.md', '現在在哪裡'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.match(output, /^docs\/roadmap\.md:\d+-\d+\n## 現在在哪裡\n/);
  assert.doesNotMatch(output, /## 等觸發點/);

  const row = execFileSync(process.execPath, ['tools/section.mjs', 'docs/decisions.md', 'DEC-147'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.match(row, /^docs\/decisions\.md:\d+\n\| DEC-147 \|/);
});
