import test from 'node:test';
import assert from 'node:assert/strict';
import stylelint from 'stylelint';
import viewScope from '../../../../tools/check/stylelint-view-scope.mjs';

const config = { plugins: [viewScope], rules: { 'swimming-pool/view-scope': true } };

async function flagged(code) {
  const { results } = await stylelint.lint({ code, config });
  return results[0].warnings.map((warning) => warning.text);
}

test('view-scope accepts selectors that start inside the view', async () => {
  assert.deepEqual(
    await flagged(`
    .sheet-tab { color: red; }
    #concept-rain .concept-chapter-copy { color: red; }
    :where(.site-view--drawings) { h1 { color: red; } button, input { font: inherit; } }
    :where(.viewer-shell) [data-status="working"] { color: red; }
    .site-view--drawings + .site-footer { margin-top: 0; }
    @media (max-width: 520px) { .sheet-tab { color: blue; } }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  `),
    [],
  );
});

test('view-scope rejects tag, html, body and attribute selectors at the outermost level', async () => {
  const warnings = await flagged(`
    body { margin: 0; }
    .ok, h1 { color: red; }
    [data-status] { color: red; }
    @media (max-width: 520px) { table { width: 100%; } }
  `);
  assert.equal(warnings.length, 4);
  assert.match(warnings[0], /「body」會影響這一頁以外的地方/);
  assert.match(warnings[1], /「h1」/);
  assert.match(warnings[2], /「\[data-status\]」/);
  assert.match(warnings[3], /「table」/);
});

test('view-scope rejects restyling the shared shell directly', async () => {
  const warnings = await flagged(
    '.site-footer { display: none; } .site-masthead a { color: red; }',
  );
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /「\.site-footer」直接改了共用外框/);
});
