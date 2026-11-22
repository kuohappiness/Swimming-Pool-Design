// 來源登錄的三方一致（TASK-121）：docs/site-and-sources.md 的來源表、模型 `sources` 與檔案本身。
// 檔案雜湊與位元組數由 check:model 的 validateSourceFiles 對檔案比；這裡比文件表與模型，兩邊必須逐列一致。

const sourceRowPattern = /^\|\s*(SRC-(?:SITE|CONCEPT)-\d{3})\s*\|/;

function stripCode(cell) {
  return cell.replace(/`/g, '').trim();
}

/** 讀出來源表每一列的編號、路徑、像素尺寸、位元組數與雜湊。 */
export function parseSourceTable(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => sourceRowPattern.test(line))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
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
      errors.push(`${source}: ${row.id} is listed in the source table but missing from model sources`);
      continue;
    }
    if (record.path !== row.path) errors.push(`${source}: ${row.id} path differs from the model (${row.path} vs ${record.path})`);
    if ((record.sha256 ?? '').toUpperCase() !== row.sha256) errors.push(`${source}: ${row.id} SHA-256 differs from the model`);
    if (row.pixelSize) {
      if (JSON.stringify(record.pixelSize) !== JSON.stringify(row.pixelSize)) {
        errors.push(`${source}: ${row.id} pixel size ${row.pixelSize.join(' × ')} differs from the model`);
      }
    } else if (record.pixelSize) {
      errors.push(`${source}: ${row.id} has a model pixel size but the table does not state one`);
    }
    if (row.byteSize !== undefined) {
      if (record.byteSize !== row.byteSize) errors.push(`${source}: ${row.id} byte size ${row.byteSize} differs from the model`);
    } else if (record.byteSize !== undefined) {
      errors.push(`${source}: ${row.id} has a model byte size but the table does not state one`);
    }
  }

  for (const id of modelSources.keys()) {
    if (!rowIds.has(id)) errors.push(`${source}: model source ${id} is missing from the source table`);
  }
  return errors;
}
