// roadmap 三節、backlog 兩節與入口狀態行的檢查（TASK-110）。純函式，不讀檔；check-docs.mjs 讀檔後呼叫。
// 寫法見 docs/agents/workflow.md。
import { fencedLines, headings } from '../section.mjs';
import { looksLikeStatus, parseStatus, whoCell } from './status-line.mjs';

export const ROADMAP_SECTIONS = ['現在在哪裡', '等觸發點', '已完成'];
export const BACKLOG_SECTIONS = ['待處理', '已轉出'];
const BOARD_HEADER = ['工作', '狀態', '下一步', '等誰', '入口'];
const TRIGGER_HEADER = ['工作', '觸發點', '入口'];
const DONE_HEADER = ['日期', '工作'];

const splitLines = (text) => text.replace(/^\uFEFF/, '').split(/\r?\n/);

/** 真的存在的 YYYY-MM-DD。 */
export function isRealDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

/** 標題下第一個非空行（不在程式碼區塊裡）；沒有一級標題時是整份的第一個非空行。回傳 { text, line } 或 undefined。 */
export function firstLineAfterTitle(text) {
  const lines = splitLines(text);
  const code = fencedLines(lines);
  const titleIndex = lines.findIndex((line, index) => !code[index] && /^#\s/.test(line));
  for (let index = titleIndex + 1; index < lines.length; index += 1) {
    if (code[index] || lines[index].trim() === '') continue;
    return { text: lines[index].trim(), line: index + 1 };
  }
  return undefined;
}

/** 入口的狀態：{ status } 或 { error }；標題下第一行不像狀態行時是 { missing: true }。 */
export function entryStatus(text) {
  const first = firstLineAfterTitle(text);
  if (!first || !looksLikeStatus(first.text)) return { missing: true };
  const parsed = parseStatus(first.text);
  return parsed.error ? { error: `第 ${first.line} 行的狀態行：${parsed.error}` } : parsed;
}

/** 二級標題與它們的行範圍（1 起算，含標題行）。 */
function h2Sections(text) {
  return headings(text).filter((heading) => heading.level === 2);
}

/** 一節裡、第一個子標題之前的表格：{ header, rows: [{ cells, line }] }；沒有表格時是 undefined。 */
function leadTable(text, section) {
  const lines = splitLines(text);
  const code = fencedLines(lines);
  const sub = headings(text).find(
    (heading) => heading.line > section.line && heading.line <= section.end,
  );
  const stop = sub ? sub.line - 1 : section.end;
  const cells = (line) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());
  let header;
  const rows = [];
  for (let index = section.line; index < stop; index += 1) {
    const line = lines[index];
    if (code[index] || !line.trim().startsWith('|')) {
      if (header) break;
      continue;
    }
    if (!header) header = cells(line);
    else if (/^\|?\s*:?-{3,}/.test(line.trim())) continue;
    else rows.push({ cells: cells(line), line: index + 1 });
  }
  return header ? { header, rows } : undefined;
}

const LINK = /\[([^\]]*)\]\((<[^>]+>|[^)\s]+)\)/g;
const linksIn = (cell) => [...cell.matchAll(LINK)].map((match) => match[2].replace(/^<|>$/g, ''));
const taskIdOf = (work) => /^\**\s*(TASK-\d{3})\b/.exec(work)?.[1];

/**
 * roadmap 的三節與每一列。resolveEntry(href) 回傳 { path, status } 、{ path, error }、{ path, missing: true }，
 * 或 undefined（連結不是 repo 裡的文件）。回傳 { errors, entries: Map<path, 節名>, taskIds }。
 */
export function validateRoadmap({ text, source, resolveEntry }) {
  const errors = [];
  const entries = new Map();
  const taskIds = [];
  const add = (line, message) => errors.push(`${source}:${line}: ${message}`);

  const sections = h2Sections(text);
  const titles = sections.map((heading) => heading.title);
  if (titles.join('\n') !== ROADMAP_SECTIONS.join('\n')) {
    add(
      sections[0]?.line ?? 1,
      `二級標題要剛好依序是${ROADMAP_SECTIONS.map((title) => `〈${title}〉`).join('、')}，現在是${titles.map((title) => `〈${title}〉`).join('、') || '沒有'}；其他內容降成三級放進這三節`,
    );
    return { errors, entries, taskIds };
  }
  const [board, trigger, done] = sections;

  const entryOf = (row, cell, sectionName) => {
    const hrefs = linksIn(cell);
    if (hrefs.length !== 1) {
      add(row.line, `「入口」要剛好一個連結，現在有 ${hrefs.length} 個`);
      return undefined;
    }
    const entry = resolveEntry(hrefs[0]);
    if (!entry) {
      add(row.line, `「入口」要連到 repo 裡有狀態行的文件：${hrefs[0]}`);
      return undefined;
    }
    if (entries.has(entry.path))
      add(row.line, `${entry.path} 已經在〈${entries.get(entry.path)}〉有一列；一份入口只寫一列`);
    entries.set(entry.path, sectionName);
    if (entry.missing) {
      add(row.line, `${entry.path} 標題下第一行沒有狀態行`);
      return undefined;
    }
    if (entry.error) {
      add(row.line, `${entry.path} ${entry.error}`);
      return undefined;
    }
    return entry;
  };

  const checkHeader = (table, expected, section) => {
    if (!table) return false;
    if (table.header.join('｜') !== expected.join('｜')) {
      add(
        section.line,
        `〈${section.title}〉的表頭要是「${expected.join('｜')}」，現在是「${table.header.join('｜')}」`,
      );
      return false;
    }
    return true;
  };

  const boardTable = leadTable(text, board);
  if (checkHeader(boardTable, BOARD_HEADER, board)) {
    for (const row of boardTable.rows) {
      if (row.cells.length !== BOARD_HEADER.length) {
        add(row.line, `要剛好 ${BOARD_HEADER.length} 欄`);
        continue;
      }
      const [work, state, next, who, link] = row.cells;
      const id = taskIdOf(work);
      if (id) taskIds.push(id);
      const entry = entryOf(row, link, board.title);
      if (!entry) continue;
      const { status } = entry;
      if (status.done) {
        add(row.line, `${entry.path} 已經結束（${status.label}），這一列移到〈已完成〉`);
        continue;
      }
      if (status.state === '等觸發點') {
        add(row.line, `${entry.path} 是等觸發點，這一列移到〈等觸發點〉`);
        continue;
      }
      const expected = [status.label, status.text, whoCell(status)];
      if ([state, next, who].join('\n') !== expected.join('\n')) {
        add(
          row.line,
          `狀態、下一步、等誰要和 ${entry.path} 的狀態行一致：| ${work} | ${expected.join(' | ')} | ${link} |`,
        );
      }
    }
  }

  const triggerTable = leadTable(text, trigger);
  if (checkHeader(triggerTable, TRIGGER_HEADER, trigger)) {
    for (const row of triggerTable.rows) {
      if (row.cells.length !== TRIGGER_HEADER.length) {
        add(row.line, `要剛好 ${TRIGGER_HEADER.length} 欄`);
        continue;
      }
      const [work, triggerText, link] = row.cells;
      const id = taskIdOf(work);
      if (id) taskIds.push(id);
      // 入口只有 DEC-ID 的列是手寫的觸發點，不查。
      if (/^DEC-\d{3}$/.test(link.replace(LINK, '$1').trim())) continue;
      const entry = entryOf(row, link, trigger.title);
      if (!entry) continue;
      if (entry.status.state !== '等觸發點') {
        add(
          row.line,
          `${entry.path} 的狀態是「${entry.status.label}」，不是等觸發點；這一列移回〈${entry.status.done ? '已完成' : '現在在哪裡'}〉`,
        );
      } else if (triggerText !== entry.status.text) {
        add(row.line, `「觸發點」要和 ${entry.path} 狀態行的下一步一致：${entry.status.text}`);
      }
    }
  }

  const doneTable = leadTable(text, done);
  if (checkHeader(doneTable, DONE_HEADER, done)) {
    for (const row of doneTable.rows) {
      if (row.cells.length !== DONE_HEADER.length) {
        add(row.line, `要剛好 ${DONE_HEADER.length} 欄`);
        continue;
      }
      const [date, work] = row.cells;
      if (!isRealDate(date)) add(row.line, `日期要是真的 YYYY-MM-DD：${date}`);
      const match = /^\*\*(.+?)\*\*：(.+)（([^（）]+?)，(\[[^\]]*\]\([^)]+\))）$/.exec(work);
      if (!match) {
        add(row.line, '「工作」寫成：**<工作>**：<完成那一句>（<狀態值>，[入口](…)）');
        continue;
      }
      const id = taskIdOf(match[1]);
      if (id) taskIds.push(id);
      const entry = entryOf(row, match[4], done.title);
      if (!entry) continue;
      if (!entry.status.done) {
        add(
          row.line,
          `${entry.path} 還沒結束（${entry.status.label}），這一列移回〈${entry.status.state === '等觸發點' ? '等觸發點' : '現在在哪裡'}〉`,
        );
      } else if (match[2] !== entry.status.text || match[3] !== entry.status.label) {
        add(
          row.line,
          `完成那一句與狀態值要和 ${entry.path} 的狀態行一致：**${match[1]}**：${entry.status.text}（${entry.status.label}，${match[4]}）`,
        );
      }
    }
  }

  return { errors, entries, taskIds };
}

/** backlog 只有〈待處理〉〈已轉出〉兩節；〈待處理〉不能有「→」；〈已轉出〉每一項下面要有「→ [下一站](…)（YYYY-MM-DD）」。 */
export function validateBacklog({ text, source }) {
  const errors = [];
  const add = (line, message) => errors.push(`${source}:${line}: ${message}`);
  const sections = h2Sections(text);
  const titles = sections.map((heading) => heading.title);
  if (titles.join('\n') !== BACKLOG_SECTIONS.join('\n')) {
    add(
      sections[0]?.line ?? 1,
      `二級標題要剛好依序是${BACKLOG_SECTIONS.map((title) => `〈${title}〉`).join('、')}，現在是${titles.map((title) => `〈${title}〉`).join('、') || '沒有'}；其他分類降成三級放進這兩節`,
    );
    return errors;
  }
  const lines = splitLines(text);
  const code = fencedLines(lines);
  const [pending, moved] = sections;
  const arrow = /^\s*→\s*/;
  for (let index = pending.line; index < pending.end; index += 1) {
    if (!code[index] && arrow.test(lines[index]))
      add(index + 1, '轉出的項目搬到〈已轉出〉：〈待處理〉裡不能有「→」');
  }
  let item;
  const closeItem = () => {
    if (item && !item.hasArrow)
      add(item.line, '〈已轉出〉的每一項下一行要寫「→ [下一站](…)（YYYY-MM-DD）」');
  };
  for (let index = moved.line; index < moved.end; index += 1) {
    if (code[index]) continue;
    const line = lines[index];
    if (/^[-*]\s/.test(line) || /^#{3,6}\s/.test(line)) {
      closeItem();
      item = /^[-*]\s/.test(line) ? { line: index + 1, hasArrow: false } : undefined;
      continue;
    }
    if (!arrow.test(line)) continue;
    const match = /^\s*→\s*\[[^\]]+\]\((<[^>]+>|[^)\s]+)\)（(\d{4}-\d{2}-\d{2})）\s*$/.exec(line);
    if (!match) add(index + 1, '「→」寫成：→ [下一站](…)（YYYY-MM-DD）');
    else if (!isRealDate(match[2])) add(index + 1, `「→」的日期不是真的日期：${match[2]}`);
    if (item) item.hasArrow = true;
    else add(index + 1, '「→」要接在〈已轉出〉的一個項目（「- 」開頭）下面');
  }
  closeItem();
  return errors;
}
