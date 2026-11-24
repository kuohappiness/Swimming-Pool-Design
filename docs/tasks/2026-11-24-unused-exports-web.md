# 網站程式清掉未用匯出，knip 開始檢查匯出

狀態：已合併｜完成：網站程式 114 個沒人在外面用的匯出改成檔內私有或刪除，圖面頁死掉的繪圖函式檔刪除，79 個只給單元測試的匯出標 `@internal`，knip 起改檢查匯出；3D 進階繪圖恢復另成一包｜等誰：—

- 日期：2026-11-24
- 類型：refactor
- 任務：TASK-183
- 核准：使用者 2026-11-22 在決定卡選「先做 4 和 6，5 和 7 等 3D 做完」；2026-11-23 說「好，你看一下目前正在跑的，等跑完你就去做」。協調者 2026-11-24 放行（含 `package.json`），3D 串這段期間不動 `web/src/views/3d-viewer`

來自：[程式碼品質改善方案](https://claude.ai/artifact/Fb7Kq1AZeRKA5i3Huofpot)〈實作順序〉階段 5（knip 未用匯出）；接 [TASK-169](2026-11-23-unused-exports-core.md)（core 與共用程式）與 [TASK-181](2026-11-23-vite-8.md)（Vite 8 分包）

## 目的

`npm run lint:unused` 原本以 `--exclude exports,types,duplicates` 略過匯出，網站程式累積了近兩百個「看起來沒人用」的匯出。其中一部分真的沒人用，一部分只給單元測試：測試以 `vite.ssrLoadModule('/src/…')` 字串載入，knip 追不到。兩種混在一起，就分不出哪個能刪。

## 範圍

- 只在檔內用到的 63 個匯出（常數、函式、型別）拿掉 `export`；完全沒人用的刪除：`formatMetres`、`getRealismTier`、`ZERO_MOVEMENT_INTENT`、`CollisionDescriptor`、`orientation.ts` 轉呼叫 core 的 `normalizeBearingDegrees` 與重複匯出的 `NorthPlanDirection`。
- `web/src/views/drawings/geometry.ts` 刪除：15 個繪圖函式與常數是圖面改用 `drawings/current/` 的 SVG 之後留下的死碼，唯一還在用的 `escapeHtml` 移進 `drawings/main.ts`。
- `walkthrough/index.ts` 拿掉沒人經由它取用的 3 個值與 26 個型別轉匯出，`viewer-model-adapter.ts` 拿掉 `deepFreezeWalkthroughData` 別名。
- 只給單元測試的 79 個匯出加 `@internal` 說明；`router.ts` 的 `viewIds` 由 `check:docs` 讀原始碼核對，也標 `@internal`。`knip.json` 設 `"tags": ["-@internal"]`。
- `package.json`：`lint:unused` 改成 `knip --no-progress`，匯出、型別與重複匯出都檢查。
- `rendering/index.ts` 拿掉 `export * from './enhanced'`：Vite 8 的 Rolldown 因為它把進階繪圖併進 3D 主程式包並印出 `INEFFECTIVE_DYNAMIC_IMPORT`（見 TASK-181）。用到進階繪圖的 4 個測試本來就直接載入 `rendering/enhanced/index.ts`，不用改。
- `docs/agents/workflow.md`：檢查說明補上匯出與 `@internal` 的用法。

不做：`tests/`、`core/`、`tools/` 的匯出（TASK-169 已清）；改測試的載入方式。

## 打包結果

3D 主程式包 1,131 kB → 867 kB，進階繪圖另成 272 kB 一包，在 3D 頁開起來後才載入；建置不再出現 `INEFFECTIVE_DYNAMIC_IMPORT`。

## 驗收

- `npm run lint`（knip 含匯出檢查，0 處）、`npm run build`（378 個單元測試）、`npm run test:e2e`、`git diff --check` 通過。
- 在任一網站檔案加一個沒人用的匯出，`npm run lint:unused` 會報錯（試過後移除）。
