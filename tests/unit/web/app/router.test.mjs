import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const [indexHtml, routerSource, bootstrapSource, viteSource, appShellSource] = await Promise.all([
  readFile(resolve(repoRoot, 'web/index.html'), 'utf8'),
  readFile(resolve(repoRoot, 'web/src/app/router.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'web/src/app/bootstrap.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'vite.config.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'web/src/app/app-shell.ts'), 'utf8'),
]);

test('public site has one HTML entry and eight query views', async () => {
  assert.match(indexHtml, /src="\/src\/app\/bootstrap\.ts"/);
  assert.doesNotMatch(indexHtml, /src\/3d-viewer\/main|src\/solar-study\/main|src\/main\.ts/);
  await assert.rejects(access(resolve(repoRoot, 'web/solar-study/index.html'), constants.F_OK));
  await assert.rejects(access(resolve(repoRoot, 'web/3d-viewer/index.html'), constants.F_OK));
  assert.match(viteSource, /input:\s*resolve\(webRoot,\s*'index\.html'\)/);
  assert.doesNotMatch(viteSource, /solarStudy:|viewer3d:|atlas:/);
  for (const view of ['design-concept', 'solar-study', 'water-cycle', 'swim-class', 'design-process', 'drawings', '3d-viewer', 'about']) {
    assert.match(routerSource, new RegExp(`'${view}'`));
    assert.match(bootstrapSource, new RegExp(`(?:'${view}'|\\b${view})\\s*:`));
  }
});

test('invalid routes fail safely to design concept and navigation is accessible', () => {
  assert.match(routerSource, /if \(requested === null\) return 'design-concept'/);
  assert.match(routerSource, /url\.searchParams\.delete\('view'\)/);
  assert.match(routerSource, /return 'design-concept'/);
  assert.match(appShellSource, /aria-label="主要章節"/);
  assert.match(appShellSource, /aria-current="page"/);
  assert.match(appShellSource, /site-skip-link/);
  assert.match(bootstrapSource, /restoreHashTarget\(\)/);
  assert.match(bootstrapSource, /getElementById\(targetId\)/);
  assert.match(bootstrapSource, /root\.style\.scrollBehavior = 'auto'/);
  assert.match(bootstrapSource, /window\.scrollTo\(0, Math\.max\(0, top\)\)/);
});

test('3D runtime is isolated behind its view-level dynamic import', () => {
  assert.match(bootstrapSource, /'3d-viewer': \(\) => import\('\.\.\/views\/3d-viewer'\)/);
  assert.doesNotMatch(bootstrapSource, /from ['"]three/);
  assert.doesNotMatch(appShellSource, /from ['"]three/);
});
