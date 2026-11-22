import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const names = ['DRAW-L1-PLAN', 'DRAW-L2-PLAN', 'DRAW-L3-PLAN', 'DRAW-LONGITUDINAL-SECTION'];

// The drawings are embedded inline on the drawings and design-concept pages, so their
// <style> must not be able to style anything outside the drawing (TASK-165).
test('drawing SVG classes and inline style rules stay inside the dw- namespace', async () => {
  for (const name of names) {
    const svg = await readFile(resolve(repoRoot, 'drawings/current', `${name}.svg`), 'utf8');

    const classTokens = [...svg.matchAll(/ class="([^"]+)"/g)].flatMap(([, value]) => value.trim().split(/\s+/));
    assert.ok(classTokens.length > 0, `${name} has classes`);
    for (const token of classTokens) {
      assert.match(token, /^dw-[a-z0-9]+(?:-[a-z0-9]+)*$/, `${name} class ${token}`);
    }

    const styles = [...svg.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(([, css]) => css);
    assert.equal(styles.length, 1, `${name} has one inline style`);
    const selectors = [...styles[0].matchAll(/(?:^|\})\s*([^{}]+)\{/g)].map(([, selector]) => selector.trim());
    assert.ok(selectors.length > 0, `${name} has style rules`);
    for (const selector of selectors) {
      assert.ok(
        /^\.dw-[a-z0-9-]+$/.test(selector) || selector === ':where(.dw-sheet) text',
        `${name} selector ${selector} must be a dw- class or the scoped text rule`,
      );
    }

    assert.match(svg, /<g class="dw-sheet">/, `${name} wraps its content in the dw-sheet group`);
  }
});
