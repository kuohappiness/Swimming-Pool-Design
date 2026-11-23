// 3D 寫實版的成本上限（DEC-190）。網站的畫質分級與 tools/check 的資產檢查共用這一份，
// 兩邊都不得另寫數字。這裡不使用 Node 專屬 API，網站可以直接引用。

const MEBIBYTE = 1024 * 1024;

/** 畫質分級由高到低；順序本身就是降級方向。 */
export const REALISM_TIER_IDS = Object.freeze(['ultra', 'high', 'medium', 'saver']);

/**
 * 每一級在固定鏡位下的硬上限。繪製呼叫與三角形由 e2e 斷言，下載量由資產清單加總後比對。
 * 幀時間不在這裡：雲端的軟體繪圖量不到真實幀率，只做診斷不做硬斷言。
 */
export const RENDER_BUDGETS = Object.freeze({
  ultra: Object.freeze({ drawCalls: 500, triangles: 800_000, downloadBytes: 40 * MEBIBYTE }),
  high: Object.freeze({ drawCalls: 500, triangles: 800_000, downloadBytes: 20 * MEBIBYTE }),
  medium: Object.freeze({ drawCalls: 200, triangles: 250_000, downloadBytes: 8 * MEBIBYTE }),
  saver: Object.freeze({ drawCalls: 200, triangles: 250_000, downloadBytes: 4 * MEBIBYTE }),
});

/** 資產入庫的容量上限：單檔與整個 3D 資產資料夾。 */
export const ASSET_FILE_LIMITS = Object.freeze({
  textureBytes: 4 * MEBIBYTE,
  modelBytes: 2 * MEBIBYTE,
  audioBytes: 1 * MEBIBYTE,
  otherBytes: 1 * MEBIBYTE,
  totalBytes: 70 * MEBIBYTE,
});

/**
 * 副檔名對應的資產種類。不在表內的副檔名一律不得入庫；
 * 原始貼圖（PNG、JPEG、EXR、HDR、TIFF）只留轉檔後的 .ktx2，來源記在資產清單。
 * .svg 是 0.8 版自製的代理圖樣，換成 .ktx2 後移除。
 */
export const ASSET_EXTENSION_KINDS = Object.freeze({
  '.ktx2': 'texture',
  '.svg': 'texture',
  '.glb': 'model',
  '.ogg': 'audio',
  '.mp3': 'audio',
  '.json': 'other',
  '.md': 'other',
});

const KIND_LIMIT_KEYS = Object.freeze({
  texture: 'textureBytes',
  model: 'modelBytes',
  audio: 'audioBytes',
  other: 'otherBytes',
});

const SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE_PATTERN = /^(?:README\.md|[a-z0-9]+(?:[-.][a-z0-9]+)*)$/;

export function isRealismTierId(value) {
  return REALISM_TIER_IDS.includes(value);
}

export function assertRenderBudgets(budgets = RENDER_BUDGETS) {
  let previous = null;
  for (const tier of REALISM_TIER_IDS) {
    const budget = budgets[tier];
    if (!budget) throw new TypeError(`Render budget is missing: ${tier}`);
    for (const key of ['drawCalls', 'triangles', 'downloadBytes']) {
      if (!Number.isSafeInteger(budget[key]) || budget[key] <= 0) {
        throw new TypeError(`Render budget ${tier}.${key} must be a positive integer.`);
      }
      if (previous && budget[key] > previous[key]) {
        throw new TypeError(`Render budget ${key} must not grow from a higher tier to ${tier}.`);
      }
    }
    previous = budget;
  }
  return budgets;
}

/**
 * 檢查一批資產檔。`files` 是 `{ path, byteSize }`，path 以資產根目錄為準、用正斜線。
 * 回傳錯誤訊息陣列；空陣列代表通過。
 */
export function findAssetBudgetErrors(files, limits = ASSET_FILE_LIMITS) {
  const errors = [];
  let totalBytes = 0;

  for (const file of files) {
    const segments = file.path.split('/');
    const name = segments.pop();
    const extensionStart = name.lastIndexOf('.');
    const extension = extensionStart > 0 ? name.slice(extensionStart).toLowerCase() : '';
    const kind = ASSET_EXTENSION_KINDS[extension];
    totalBytes += file.byteSize;

    for (const segment of segments) {
      if (!SEGMENT_PATTERN.test(segment)) {
        errors.push(`${file.path}：資料夾「${segment}」須為英文小寫加連字號。`);
        break;
      }
    }
    if (!FILE_PATTERN.test(name)) {
      errors.push(`${file.path}：檔名須為英文小寫加連字號。`);
    }
    if (!kind) {
      errors.push(
        `${file.path}：副檔名「${extension || '（無）'}」不得入庫；貼圖只收 .ktx2，原始檔的來源記在資產清單。`,
      );
      continue;
    }
    const limit = limits[KIND_LIMIT_KEYS[kind]];
    if (file.byteSize > limit) {
      errors.push(
        `${file.path}：${formatBytes(file.byteSize)} 超過單檔上限 ${formatBytes(limit)}。`,
      );
    }
  }

  if (totalBytes > limits.totalBytes) {
    errors.push(
      `3D 資產合計 ${formatBytes(totalBytes)} 超過上限 ${formatBytes(limits.totalBytes)}。`,
    );
  }
  return errors;
}

export function formatBytes(bytes) {
  if (bytes >= MEBIBYTE) return `${(bytes / MEBIBYTE).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} bytes`;
}
