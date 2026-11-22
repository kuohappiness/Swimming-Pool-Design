// stylelint 外掛：分頁樣式（web/src/views/<view id>/）最外層的選擇器只能從這一頁自己的
// class、id 或 :where(.<class>) 開始。包在 @media 等 at-rule 裡的規則一樣算最外層；
// 已經寫在另一條規則裡面（CSS 巢狀）的不檢查，因為外層已經限定了範圍。
import stylelint from 'stylelint';

const ruleName = 'swimming-pool/view-scope';
const messages = stylelint.utils.ruleMessages(ruleName, {
  unscoped: (selector) =>
    `「${selector}」會影響這一頁以外的地方。分頁樣式最外層只能以這一頁自己的 class、id 或 :where(.<class>) 開頭。`,
  shell: (selector) =>
    `「${selector}」直接改了共用外框。分頁要調整外框時只能寫成 .site-view--<view id> 開頭的選擇器。`,
});

const startsInsideView = /^(?:[.#]|:where\(\.)/;
const startsWithShellClass = /^\.site-(?!view--)/;

function isNestedInStyleRule(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'rule') return true;
  }
  return false;
}

function isKeyframeSelector(node) {
  return node.parent?.type === 'atrule' && /keyframes$/i.test(node.parent.name);
}

const rule = (enabled) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: enabled })) return;
  root.walkRules((node) => {
    if (isNestedInStyleRule(node) || isKeyframeSelector(node)) return;
    for (const selector of node.selectors) {
      const trimmed = selector.trim();
      const message = !startsInsideView.test(trimmed)
        ? messages.unscoped(trimmed)
        : startsWithShellClass.test(trimmed)
          ? messages.shell(trimmed)
          : null;
      if (message) stylelint.utils.report({ ruleName, result, node, message, word: trimmed });
    }
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
