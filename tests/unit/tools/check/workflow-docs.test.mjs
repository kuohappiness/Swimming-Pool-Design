import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus, whoCell } from '../../../../tools/check/status-line.mjs';
import {
  entryStatus,
  isRealDate,
  validateBacklog,
  validateRoadmap,
} from '../../../../tools/check/workflow-docs.mjs';

test('status line accepts the three-field format and the closing forms', () => {
  const open = parseStatus('狀態：實作中｜下一步：補測試｜等誰：Claude');
  assert.deepEqual(open.status, { label: '實作中', state: '實作中', done: false, text: '補測試', who: ['Claude'] });
  assert.equal(whoCell(open.status), 'Claude');

  const merged = parseStatus('狀態：已合併｜完成：上線｜等誰：—');
  assert.equal(merged.status.done, true);
  assert.equal(whoCell(merged.status), '—');

  assert.equal(parseStatus('狀態：已結案 → [設計](design.md)｜完成：併入設計｜等誰：—').status.state, '已結案');
  assert.equal(parseStatus('狀態：已結案 → DEC-147｜完成：寫成決定｜等誰：—').status.state, '已結案');
  assert.equal(parseStatus('狀態：暫停（等場勘）｜下一步：場勘後再排｜等誰：使用者').status.state, '暫停');
  assert.deepEqual(parseStatus('狀態：待審｜下一步：看截圖｜等誰：使用者、Claude').status.who, ['使用者', 'Claude']);
});

test('status line rejects malformed values with a fix hint', () => {
  const cases = [
    ['狀態：實作中｜下一步：補測試', /剛好三欄/],
    ['狀態：進行中｜下一步：補測試｜等誰：Claude', /不是狀態值/],
    ['狀態：已合併｜下一步：補測試｜等誰：—', /完成：/],
    ['狀態：實作中｜完成：補測試｜等誰：Claude', /下一步：/],
    ['狀態：實作中｜下一步：｜等誰：Claude', /不能空/],
    ['狀態：已合併｜完成：上線｜等誰：Claude', /等誰寫「—」/],
    ['狀態：等觸發點｜下一步：發版後｜等誰：使用者', /等誰寫「—」/],
    ['狀態：實作中｜下一步：補測試｜等誰：Codex', /不是/],
    ['狀態：實作中｜下一步：補測試｜等誰：Claude、Claude', /重複/],
    ['狀態：暫停｜下一步：等｜等誰：使用者', /原因/],
    ['狀態：實作中 → DEC-147｜下一步：等｜等誰：使用者', /箭頭只能接在「已結案」/],
    ['狀態：已結案 → [外部](https://example.com)｜完成：轉出｜等誰：—', /不連外部網址/],
  ];
  for (const [line, pattern] of cases) assert.match(parseStatus(line).error, pattern, line);
});

test('entry status reads the first non-empty line under the title', () => {
  assert.equal(entryStatus('# 任務\n\n狀態：規劃中｜下一步：寫規格｜等誰：Claude\n\n## 目的\n').status.state, '規劃中');
  assert.deepEqual(entryStatus('# 任務\n\n- 日期：2026-07-01\n'), { missing: true });
  assert.match(entryStatus('# 任務\n\n狀態：實作中｜等誰：Claude\n').error, /第 3 行/);
  assert.equal(entryStatus('```\n# 不是標題\n```\n# 任務\n\n狀態：待審｜下一步：看｜等誰：使用者\n').status.state, '待審');
});

test('dates must exist on the calendar', () => {
  assert.equal(isRealDate('2026-11-22'), true);
  assert.equal(isRealDate('2026-02-30'), false);
  assert.equal(isRealDate('2026-1-2'), false);
});

const roadmap = ({ board = '', trigger = '', done = '', extra = '' } = {}) => `# 進度與任務

## 現在在哪裡

| 工作 | 狀態 | 下一步 | 等誰 | 入口 |
| --- | --- | --- | --- | --- |
${board}
## 等觸發點

| 工作 | 觸發點 | 入口 |
| --- | --- | --- |
${trigger}
## 已完成

| 日期 | 工作 |
| --- | --- |
${done}
${extra}`;

const entries = {
  'tasks/a.md': '狀態：實作中｜下一步：補測試｜等誰：Claude',
  'tasks/b.md': '狀態：已合併｜完成：上線｜等誰：—',
  'tasks/c.md': '狀態：等觸發點｜下一步：發版之後｜等誰：—',
};
function resolveEntry(href) {
  const line = entries[href];
  if (!line) return undefined;
  return { path: href, ...entryStatus(`# 入口\n\n${line}\n`) };
}
const check = (parts) => validateRoadmap({ text: roadmap(parts), source: 'docs/roadmap.md', resolveEntry });

test('roadmap rows that copy their entry status pass', () => {
  const result = check({
    board: '| TASK-112 補測試 | 實作中 | 補測試 | Claude | [任務說明](tasks/a.md) |\n',
    trigger: '| TASK-113 發版後整理 | 發版之後 | [任務說明](tasks/c.md) |\n| 評估工具 | 用過三件 | DEC-147 |\n',
    done: '| 2026-11-22 | **TASK-111 上線**：上線（已合併，[入口](tasks/b.md)） |\n',
    extra: '### 舊表\n\n| TASK-001 | 舊任務 | done |\n',
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual([...result.entries.keys()].sort(), ['tasks/a.md', 'tasks/b.md', 'tasks/c.md']);
  assert.deepEqual(result.taskIds, ['TASK-112', 'TASK-113', 'TASK-111']);
});

test('roadmap catches drift between a row and its entry', () => {
  const drift = check({ board: '| TASK-112 補測試 | 待審 | 補測試 | Claude | [任務說明](tasks/a.md) |\n' });
  assert.match(drift.errors.join('\n'), /要和 tasks\/a\.md 的狀態行一致：\| TASK-112 補測試 \| 實作中 \| 補測試 \| Claude \|/);

  const finished = check({ board: '| 上線 | 已合併 | 上線 | — | [任務說明](tasks/b.md) |\n' });
  assert.match(finished.errors.join('\n'), /移到〈已完成〉/);

  const waiting = check({ board: '| 整理 | 等觸發點 | 發版之後 | — | [任務說明](tasks/c.md) |\n' });
  assert.match(waiting.errors.join('\n'), /移到〈等觸發點〉/);

  const notDone = check({ done: '| 2026-11-22 | **補測試**：補測試（實作中，[入口](tasks/a.md)） |\n' });
  assert.match(notDone.errors.join('\n'), /還沒結束/);

  const badDate = check({ done: '| 2026-02-30 | **上線**：上線（已合併，[入口](tasks/b.md)） |\n' });
  assert.match(badDate.errors.join('\n'), /真的 YYYY-MM-DD/);

  const twice = check({
    board: '| 補測試 | 實作中 | 補測試 | Claude | [任務說明](tasks/a.md) |\n',
    done: '| 2026-11-22 | **補測試**：補測試（實作中，[入口](tasks/a.md)） |\n',
  });
  assert.match(twice.errors.join('\n'), /一份入口只寫一列/);

  const noEntry = check({ board: '| 補測試 | 實作中 | 補測試 | Claude | [任務說明](tasks/missing.md) |\n' });
  assert.match(noEntry.errors.join('\n'), /有狀態行的文件/);
});

test('roadmap must have exactly the three sections in order', () => {
  const result = validateRoadmap({
    text: '# 進度\n\n## 已完成\n\n## 現在在哪裡\n\n## 等觸發點\n',
    source: 'docs/roadmap.md',
    resolveEntry,
  });
  assert.match(result.errors[0], /剛好依序是〈現在在哪裡〉、〈等觸發點〉、〈已完成〉/);
});

test('backlog keeps two sections and records where moved items went', () => {
  const ok = '# 待決事項\n\n## 待處理\n\n### 尚待精化\n\n- OPEN-001：問題\n\n## 已轉出\n\n- OPEN-002：舊問題\n  → [決策](decisions.md)（2026-11-22）\n';
  assert.deepEqual(validateBacklog({ text: ok, source: 'docs/backlog.md' }), []);

  const wrongSections = '# 待決事項\n\n## 1. 尚待精化\n';
  assert.match(validateBacklog({ text: wrongSections, source: 'docs/backlog.md' })[0], /〈待處理〉、〈已轉出〉/);

  const arrowInPending = '# 待決事項\n\n## 待處理\n\n- OPEN-001：問題\n  → [決策](decisions.md)（2026-11-22）\n\n## 已轉出\n';
  assert.match(validateBacklog({ text: arrowInPending, source: 'docs/backlog.md' })[0], /〈待處理〉裡不能有「→」/);

  const missingArrow = '# 待決事項\n\n## 待處理\n\n## 已轉出\n\n- OPEN-002：舊問題\n';
  assert.match(validateBacklog({ text: missingArrow, source: 'docs/backlog.md' })[0], /下一行要寫「→/);

  const badDate = '# 待決事項\n\n## 待處理\n\n## 已轉出\n\n- OPEN-002：舊問題\n  → [決策](decisions.md)（2026-13-01）\n';
  assert.match(validateBacklog({ text: badDate, source: 'docs/backlog.md' })[0], /不是真的日期/);
});
