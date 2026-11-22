// npm run check:assets：3D 資產的容量、副檔名與命名上限（DEC-190）。
// 上限數字在 core/viewer/render-budgets.mjs，這裡只負責讀檔與回報。
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve, sep } from 'node:path';
import {
  ASSET_FILE_LIMITS,
  findAssetBudgetErrors,
  formatBytes,
} from '../../core/viewer/render-budgets.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const assetRoot = resolve(repoRoot, 'web/src/views/3d-viewer/assets');

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push({
        path: relative(assetRoot, absolutePath).split(sep).join('/'),
        byteSize: (await stat(absolutePath)).size,
      });
    }
  }
  return files;
}

const files = (await listFiles(assetRoot)).sort((left, right) => left.path.localeCompare(right.path));
const errors = findAssetBudgetErrors(files);
const totalBytes = files.reduce((total, file) => total + file.byteSize, 0);

if (errors.length) {
  console.error('3D asset budget check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `3D assets within budget: ${files.length} files, ${formatBytes(totalBytes)} of ${formatBytes(ASSET_FILE_LIMITS.totalBytes)}.`,
  );
}
