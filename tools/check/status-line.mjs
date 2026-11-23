// 入口的狀態行（TASK-110，比照 Essence 的工作流程）：
//   狀態：<狀態值>｜下一步：<一句>｜等誰：<值>
//   狀態：已合併｜完成：<一句>｜等誰：—
// 文件檢查（check-docs.mjs）用這裡的解析。寫法見 docs/agents/workflow.md〈入口的狀態行〉。

/** 不帶參數的狀態值；另外還有 `已結案 → <DEC-ID 或連結>` 與 `暫停（<原因>）`。 */
export const STATES = ['規劃中', '討論中', '實作中', '待審', '等觸發點', '已合併', '已結案'];
export const WHO = ['使用者', 'Claude'];
const NONE = '—';
/** 「已結案 →」後面的下一站：一個以上的 DEC-ID 或行內連結，用「、」接。 */
const STATION = String.raw`(?:DEC-\d{3}|\[[^\]]+\]\((?:<[^>]+>|[^)\s]+)\))`;
const NEXT = new RegExp(String.raw`^${STATION}(?:\s*、\s*${STATION})*$`);
const HINT =
  '寫法：狀態：<狀態值>｜下一步：<一句>｜等誰：<值>；結束時「狀態：已合併｜完成：<一句>｜等誰：—」';

/** 看起來是想寫狀態行：以「狀態：」開頭，又有「｜下一步：」「｜完成：」「｜等誰：」其中之一。 */
export const looksLikeStatus = (line) =>
  line.trim().startsWith('狀態：') && /｜\s*(?:下一步|完成|等誰)：/.test(line);

/**
 * 解析一行狀態行。成功回傳 { status }，status 有 label（狀態欄原文）、state（狀態值或「暫停」）、
 * done（已合併、已結案）、text（下一步或完成那一句）、who（等誰的陣列，「—」是空陣列）；
 * 格式不對回傳 { error }，一句話說哪裡不對、怎麼改。
 */
export function parseStatus(line) {
  const text = line.trim();
  if (!text.startsWith('狀態：')) return { error: `要以「狀態：」開頭。${HINT}` };
  const fields = text.split('｜').map((field) => field.trim());
  if (fields.length !== 3) {
    return {
      error: `要剛好三欄、用全形「｜」分，現在是 ${fields.length} 欄（欄裡的「｜」改用「，」）。${HINT}`,
    };
  }
  const [first, second, third] = fields;

  const label = first.slice('狀態：'.length).trim();
  let state;
  const paused = /^暫停（(.*)）$/.exec(label);
  const arrow = /^(.*?)\s*→\s*(.*)$/.exec(label);
  if (paused) {
    if (!paused[1].trim()) return { error: '暫停要寫原因：暫停（<原因>）' };
    state = '暫停';
  } else if (arrow) {
    if (arrow[1] !== '已結案')
      return { error: `箭頭只能接在「已結案」後面，現在是「${arrow[1]}」` };
    if (!NEXT.test(arrow[2]))
      return { error: '「已結案 →」後面接下一站：DEC-ID 或連結，好幾站用「、」接' };
    const hrefs = [...arrow[2].matchAll(/\]\((<[^>]+>|[^)\s]+)\)/g)].map((match) =>
      match[1].replace(/^<|>$/g, ''),
    );
    if (hrefs.some((href) => /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//'))) {
      return { error: '「已結案 →」的下一站要在 repo 裡：DEC-ID 或 repo 裡的文件，不連外部網址' };
    }
    state = '已結案';
  } else if (STATES.includes(label)) {
    state = label;
  } else if (label.startsWith('暫停')) {
    return { error: '暫停要寫原因：暫停（<原因>）' };
  } else {
    return {
      error: `「${label}」不是狀態值；可用：${STATES.join('、')}、已結案 → <下一站>、暫停（<原因>）`,
    };
  }
  const done = state === '已合併' || state === '已結案';

  const key = done ? '完成：' : '下一步：';
  if (!second.startsWith(key)) {
    return {
      error: done
        ? `${state}是結束：第二欄寫「完成：<一句>」`
        : '沒結束的第二欄寫「下一步：<一句>」（結束才寫「完成：」）',
    };
  }
  const content = second.slice(key.length).trim();
  if (!content) return { error: `「${key}」後面不能空` };

  if (!third.startsWith('等誰：')) return { error: `第三欄寫「等誰：<值>」。${HINT}` };
  const whoText = third.slice('等誰：'.length).trim();
  if (whoText === NONE) return { status: { label, state, done, text: content, who: [] } };
  if (done || state === '等觸發點') return { error: `${state}的等誰寫「—」` };
  const who = whoText.split('、').map((name) => name.trim());
  if (who.includes(NONE)) return { error: '「—」只能單獨用' };
  const unknown = who.filter((name) => !WHO.includes(name));
  if (unknown.length > 0)
    return {
      error: `等誰只收${WHO.join('、')}、—（好幾個用「、」接）；「${unknown.join('、')}」不是`,
    };
  if (new Set(who).size !== who.length) return { error: '等誰重複了' };
  return { status: { label, state, done, text: content, who } };
}

/** 狀態行第三欄的寫法（roadmap 狀態板的「等誰」欄用同一個寫法）。 */
export const whoCell = (status) => (status.who.length > 0 ? status.who.join('、') : NONE);
