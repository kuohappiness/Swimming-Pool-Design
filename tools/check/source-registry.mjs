// 來源登錄的三方一致（TASK-121）：docs/site-and-sources.md 的來源表、模型 `sources` 與檔案本身。
// 文件表與模型由 validateSourceRegistry 逐列比；模型與檔案本身（雜湊、位元組數）由 validateSourceFiles 比，check:model 執行。

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// 有檔案的來源類別都要對上模型；SRC-REG 是法規登錄，沒有檔案也不進模型。
const sourceRowPattern = /^\|\s*(SRC-(?!REG-)[A-Z]+-\d{3})\s*\|/;

function stripCode(cell) {
  return cell.replace(/`/g, '').trim();
}

/** 讀出來源表每一列的編號、路徑、像素尺寸、位元組數與雜湊。 */
export function parseSourceTable(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => sourceRowPattern.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      const sizeCell = cells[3] ?? '';
      const pixels = sizeCell.match(/(\d+)\s*×\s*(\d+)/);
      const bytes = sizeCell.match(/([\d,]+)\s*bytes/);
      return {
        id: cells[0],
        path: stripCode(cells[1] ?? ''),
        pixelSize: pixels ? [Number(pixels[1]), Number(pixels[2])] : undefined,
        byteSize: bytes ? Number(bytes[1].replace(/,/g, '')) : undefined,
        sha256: stripCode(cells[4] ?? '').toUpperCase(),
      };
    });
}

/** 文件表與模型 `sources` 必須是同一組來源，且路徑、雜湊、尺寸與位元組數相同。 */
export function validateSourceRegistry({ text, source, model }) {
  const errors = [];
  const rows = parseSourceTable(text);
  const modelSources = new Map((model.sources ?? []).map((record) => [record.id, record]));
  const rowIds = new Set(rows.map((row) => row.id));

  for (const row of rows) {
    const record = modelSources.get(row.id);
    if (!record) {
      errors.push(
        `${source}: ${row.id} is listed in the source table but missing from model sources`,
      );
      continue;
    }
    if (record.path !== row.path)
      errors.push(
        `${source}: ${row.id} path differs from the model (${row.path} vs ${record.path})`,
      );
    if ((record.sha256 ?? '').toUpperCase() !== row.sha256)
      errors.push(`${source}: ${row.id} SHA-256 differs from the model`);
    if (row.pixelSize) {
      if (JSON.stringify(record.pixelSize) !== JSON.stringify(row.pixelSize)) {
        errors.push(
          `${source}: ${row.id} pixel size ${row.pixelSize.join(' × ')} differs from the model`,
        );
      }
    } else if (record.pixelSize) {
      errors.push(`${source}: ${row.id} has a model pixel size but the table does not state one`);
    }
    if (row.byteSize !== undefined) {
      if (record.byteSize !== row.byteSize)
        errors.push(`${source}: ${row.id} byte size ${row.byteSize} differs from the model`);
    } else if (record.byteSize !== undefined) {
      errors.push(`${source}: ${row.id} has a model byte size but the table does not state one`);
    }
  }

  for (const id of modelSources.keys()) {
    if (!rowIds.has(id))
      errors.push(`${source}: model source ${id} is missing from the source table`);
  }
  return errors;
}

/** 模型 `sources` 每一筆的檔案要讀得到，SHA-256 與位元組數要相符（TASK-167 由 core/validation 搬來）。 */
export async function validateSourceFiles(model, repoRoot) {
  const errors = [];
  for (const source of model.sources ?? []) {
    if (!source.path || !source.sha256) {
      errors.push(`${source.id} must declare path and sha256.`);
      continue;
    }
    try {
      const bytes = await readFile(resolve(repoRoot, source.path));
      const actualHash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
      if (actualHash !== source.sha256.toUpperCase())
        errors.push(`${source.id} SHA-256 does not match ${source.path}.`);
      if (Number.isFinite(source.byteSize) && source.byteSize !== bytes.byteLength)
        errors.push(`${source.id} byteSize does not match ${source.path}.`);
    } catch (error) {
      errors.push(
        `${source.id} cannot be read at ${source.path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return errors;
}

// 網站用的衍生影像（工作流程 2.1）；3D 資產另有容量清單（check:assets），產生檔不入庫。
const derivativeImagePattern = /\.(?:png|jpe?g|webp|gif|avif)$/i;
const derivativeExcluded = ['web/src/views/3d-viewer/', 'web/src/generated/'];

/** 是否算網站衍生影像：`web/` 底下的影像，排除 3D 資產與產生檔。 */
export function isDerivativeImage(filePath) {
  const normalized = filePath.split('\\').join('/');
  return (
    normalized.startsWith('web/') &&
    derivativeImagePattern.test(normalized) &&
    !derivativeExcluded.some((prefix) => normalized.startsWith(prefix))
  );
}

/**
 * 每個網站衍生影像都要在來源說明以「`檔名`（…、位元組數 bytes、SHA-256 `雜湊`）」登錄，
 * 且數字與檔案本身相符。`images` 是 { path, byteSize, sha256 }。
 */
export function validateDerivativeImages({ text, source, images }) {
  const errors = [];
  for (const image of images) {
    const name = image.path.split('/').pop();
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('`(?:[^`]*/)?' + escaped + '`（([^）]*)）', 'g');
    const notes = [...text.matchAll(pattern)].map((match) => match[1]);
    if (!notes.length) {
      errors.push(`${source}: ${image.path} is not registered with byte size and SHA-256`);
      continue;
    }
    const bytes = `${image.byteSize.toLocaleString('en-US')} bytes`;
    const hash = image.sha256.toUpperCase();
    if (!notes.some((note) => note.includes(bytes) && note.toUpperCase().includes(hash)))
      errors.push(`${source}: ${image.path} registration does not match ${bytes} and its SHA-256`);
  }
  return errors;
}
