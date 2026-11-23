// 單元測試以 Vite 的 SSR 載入網站的 TypeScript 模組：網站程式用到 ?raw 模板、JSON 與不寫副檔名的引用，
// Node 不能直接載入。所有測試檔共用這一份設定。
import { resolve } from 'node:path';
import { createServer } from 'vite';

const webRoot = resolve(import.meta.dirname, '../../web');

/**
 * 建一個只給測試用的 Vite 伺服器，用 `ssrLoadModule` 載入模組，用完呼叫 `close()`。
 * 不開 HMR 也不開 WebSocket：測試檔是平行跑的，開了會搶同一個埠（24678）而印出錯誤。
 */
export function createWebModuleServer() {
  return createServer({
    root: webRoot,
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false },
  });
}
