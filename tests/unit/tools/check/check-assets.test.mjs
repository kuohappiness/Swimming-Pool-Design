import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../../..');

test('check:assets passes on the committed 3D asset folder', async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [resolve(repoRoot, 'tools/check/check-assets.mjs')],
    { cwd: repoRoot },
  );
  assert.match(stdout, /^3D assets within budget: \d+ files, .+ of 70\.00 MB\.\n$/);
});
