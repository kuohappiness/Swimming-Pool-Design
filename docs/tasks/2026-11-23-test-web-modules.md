# 單元測試共用一份 Vite 載入設定

狀態：已合併｜完成：39 個 3D 單元測試檔改用 `tests/support/web-modules.mjs` 建立 Vite 載入器，關掉 WebSocket，平行跑時不再印出 26 行埠被占用的錯誤｜等誰：—

- 日期：2026-11-23
- 類型：test
- 任務：TASK-168
- 核准：使用者 2026-11-22 在決定卡選「先做 4 和 6，5 和 7 等 3D 做完」；2026-11-23 說「好，你看一下目前正在跑的，等跑完你就去做」。3D 寫實升級已結案

來自：[程式碼品質改善方案](https://claude.ai/artifact/Fb7Kq1AZeRKA5i3Huofpot)〈實作順序〉階段 5「單元測試不經 Vite」

## 目的

3D 的單元測試要載入網站的 TypeScript 模組，每個檔各自用 Vite 的 `createServer` 建一個載入器，設定抄了 43 次。測試檔平行跑時，這些載入器都去開同一個 WebSocket 埠（24678），每次 `npm test` 印出約 26 行「Port 24678 is already in use」，看起來像出錯，真正的失敗反而不好找。

## 決定：保留 Vite，只統一設定

方案原本寫「單元測試不經 Vite」。實測整套單元測試 21 秒，Vite 不是瓶頸；網站程式用到 `?raw` 模板、JSON 與不寫副檔名的引用，Node 直接載入要另寫載入器，換來的時間很少。所以改成把設定集中到一處、關掉不需要的 WebSocket。

## 範圍

- 新增 `tests/support/web-modules.mjs`：`createWebModuleServer()`，設定 `hmr: false` 與 `ws: false`。
- `tests/unit/web/views/3d-viewer/` 底下 39 個測試檔改用它，拿掉各自的設定與用不到的 `repoRoot`、`resolve`。測試內容與斷言不變。
- [架構](../architecture.md) 目錄樹加上 `tests/support/`。

## 驗收

- `npm test` 357 項通過，輸出沒有「WebSocket server error」（改前 26 到 27 行），耗時仍約 21 秒。
- `npm run lint`、`npm run build`、`git diff --check` 通過。這次沒動網站程式，`npm run test:e2e` 照常跑一次。
