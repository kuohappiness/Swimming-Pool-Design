# core/ 的讀檔與命令列入口搬到 tools/

狀態：已合併｜完成：角度與能量報告改由 `tools/analysis/` 的兩支程式讀檔印出，來源檔雜湊比對移到 `tools/check/`，`core/` 不再讀檔，ESLint 擋下 `core/` 讀檔｜等誰：—

- 日期：2026-11-23
- 類型：refactor
- 任務：TASK-167
- 核准：使用者 2026-11-22 在決定卡選「先做 4 和 6，5 和 7 等 3D 做完」；2026-11-23 說「好，你看一下目前正在跑的，等跑完你就去做」。3D 寫實升級已結案

來自：[程式碼品質改善方案](https://claude.ai/artifact/Fb7Kq1AZeRKA5i3Huofpot)〈實作順序〉階段 5；[架構](../architecture.md) 第 4 節原本列為現存例外

## 目的

`core/` 是網站與工具共用的純邏輯，規則是不碰 Node 專屬 API。`core/solar/solar-angle-analysis.mjs` 與 `solar-energy-analysis.mjs` 卻在檔尾各帶一段「直接執行時讀模型、讀 PVGIS 氣象檔、印報告」的程式，靠架構文件的例外清單提醒網站不要引用它們。`core/validation/model-validation.mjs` 也自己讀來源檔核對雜湊。這次把讀檔與印報告都搬到 `tools/`，例外清單只剩用 `node:crypto` 算雜湊的 `viewer-data.mjs`。

## 範圍

- `core/solar/solar-angle-analysis.mjs`：拿掉讀檔與直接執行的段落，報告函式改名 `buildSolarAngleReport(model)` 並匯出。
- `core/solar/solar-energy-analysis.mjs`：同上，`buildSolarEnergyReport(model, pvgis)` 由呼叫端傳入已讀好的 PVGIS 資料。
- 新增 `tools/analysis/solar-angle-report.mjs`、`tools/analysis/solar-energy-report.mjs`：讀檔後印出同樣的 JSON。
- `validateSourceFiles`（讀模型 `sources` 的每個檔、比 SHA-256 與位元組數）從 `core/validation/model-validation.mjs` 搬到 `tools/check/source-registry.mjs`，和來源表比對放在一起；`check-model.mjs` 與模型測試改從那裡引用。
- `eslint.config.js`：`core/` 不得引用 `node:fs`、`node:fs/promises`、`node:path`、`node:url`、`node:child_process`、`node:process`，沒有例外。
- [架構](../architecture.md) 第 4 節加一條規則、例外清單更新（另記下 `core/viewer/viewer-data.mjs` 用 `node:crypto`，只供工具與測試）；目錄樹列出兩支新工具；[日照分析](../analysis/solar-analysis.md) 第 8 節的重現指令改成新路徑。

不做：分析與驗證的計算、數值與規則。

## 驗收

- 角度報告搬移前後的輸出逐位元組相同（`node core/solar/solar-angle-analysis.mjs` 對 `node tools/analysis/solar-angle-report.mjs`）。能量報告的密集角度掃描在雲端要跑半小時以上，沒有整份比對；它的計算函式本體沒有改，只是改由參數收下讀好的資料，單元測試照常涵蓋各項計算。
- 在 `core/` 檔案加一行 `import { readFile } from 'node:fs/promises'`，`npm run lint` 會報錯。
- `npm run lint`、`npm run build`、`npm run test:e2e`、`git diff --check` 通過。
