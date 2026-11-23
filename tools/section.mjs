// 只讀需要的那一段（TASK-110，比照 Essence 的 tools/section.ts）：長文件不整份讀進對話。
// 用法：node tools/section.mjs <檔案> <標題>    印那一節（到下一個同級或更高的標題為止），開頭一行「<檔案>:<起>-<迄>」
//       node tools/section.mjs <檔案> <ID>      印表格第一欄是這個 ID 的列（例如 DEC-141、OPEN-008、TASK-107、SRC-SITE-001）
//       node tools/section.mjs <檔案>           列出每個標題的行號、層級與字數
// 標題先比完全相同的純文字，沒有再比包含（不分大小寫）；對到好幾個時列出候選、exit 1；沒對到列出全部標題、exit 1。
// 圍欄程式碼區塊（``` 或 ~~~）裡的 # 不算標題。不寫任何檔。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const splitLines = (text) => text.replace(/^\uFEFF/, '').split(/\r?\n/);

/** 每一行是不是在圍欄程式碼區塊裡（開頭與收尾那一行也算）；沒收尾的算到檔尾。 */
export function fencedLines(lines) {
  let open;
  return lines.map((line) => {
    if (open) {
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (close && close[1][0] === open.char && close[1].length >= open.length) open = undefined;
      return true;
    }
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!fence || (fence[1][0] === '`' && fence[2].includes('`'))) return false;
    open = { char: fence[1][0], length: fence[1].length };
    return true;
  });
}

/** 標題的純文字：拿掉結尾的 #、連結只留文字、反引號與強調符號拿掉。 */
export function plainTitle(raw) {
  return raw
    .replace(/\s+#+\s*$/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .trim();
}

/** 每個 ATX 標題：level、title、line 與 end（1 起算，end 是這一節最後一行）、chars（這一節的字數）。 */
export function headings(text) {
  const lines = splitLines(text);
  const code = fencedLines(lines);
  const found = [];
  lines.forEach((line, index) => {
    if (code[index]) return;
    const match = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/.exec(line);
    if (match)
      found.push({ level: match[1].length, title: plainTitle(match[2] ?? ''), line: index + 1 });
  });
  let total = lines.length;
  if (lines.at(-1) === '') total -= 1;
  return found.map((heading, index) => {
    const next = found.slice(index + 1).find((other) => other.level <= heading.level);
    const end = next ? next.line - 1 : total;
    const chars = [...lines.slice(heading.line - 1, end).join('\n')].length;
    return { ...heading, end, chars };
  });
}

/** 完全相同的優先；沒有才比包含。兩種都不分大小寫。回傳 { section } 或 { candidates }。 */
export function findSection(text, query) {
  const all = headings(text);
  const want = plainTitle(query).toLowerCase();
  const exact = all.filter((heading) => heading.title.toLowerCase() === want);
  const hits =
    exact.length > 0 ? exact : all.filter((heading) => heading.title.toLowerCase().includes(want));
  return hits.length === 1 ? { section: hits[0] } : { candidates: hits.length > 0 ? hits : all };
}

export const ID_PATTERN = /^[A-Z]+(?:-[A-Z]+)*-\d{3}$/;

/** 表格第一欄剛好是這個 ID 的列：{ line, text }，line 1 起算。 */
export function findRows(text, id) {
  const lines = splitLines(text);
  const code = fencedLines(lines);
  const rows = [];
  lines.forEach((line, index) => {
    if (code[index]) return;
    const match = /^\|\s*([^|]+?)\s*\|/.exec(line);
    if (match && match[1] === id) rows.push({ line: index + 1, text: line });
  });
  return rows;
}

const listLine = (heading) =>
  `${String(heading.line).padStart(5)}  ${'#'.repeat(heading.level)} ${heading.title}（${heading.chars} 字）`;

function main() {
  const [file, ...rest] = process.argv.slice(2);
  if (!file) {
    console.error('用法：node tools/section.mjs <檔案> [標題或 ID]');
    process.exit(1);
  }
  const text = readFileSync(resolve(file), 'utf8');
  const query = rest.join(' ').trim();
  if (!query) {
    console.log(headings(text).map(listLine).join('\n'));
    return;
  }
  if (ID_PATTERN.test(query)) {
    const rows = findRows(text, query);
    if (rows.length > 0) {
      console.log(rows.map(({ line, text: row }) => `${file}:${line}\n${row}`).join('\n'));
      return;
    }
  }
  const found = findSection(text, query);
  if (found.section) {
    const { line, end } = found.section;
    const lines = splitLines(text).slice(line - 1, end);
    console.log(`${file}:${line}-${end}\n${lines.join('\n')}`);
    return;
  }
  const partial = found.candidates.some((heading) =>
    heading.title.toLowerCase().includes(plainTitle(query).toLowerCase()),
  );
  console.error(
    partial
      ? `「${query}」對到好幾個標題，寫完整一點：`
      : `沒有包含「${query}」的標題，全部的標題：`,
  );
  console.error(found.candidates.map(listLine).join('\n'));
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
