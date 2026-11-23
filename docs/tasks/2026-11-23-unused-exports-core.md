# 清掉 core 與網站共用程式裡沒人用的匯出

狀態：已合併｜完成：core 與網站共用程式 23 個沒人引用的匯出改為檔內私有或刪除，型別宣告檔同步｜等誰：—

- 日期：2026-11-23
- 類型：refactor
- 任務：TASK-169
- 核准：使用者 2026-11-22 在決定卡選「先做 4 和 6，5 和 7 等 3D 做完」；2026-11-23 說「好，你看一下目前正在跑的，等跑完你就去做」。協調者同日同意先做 3D、日照、圖面以外的部分

來自：[程式碼品質改善方案](https://claude.ai/artifact/Fb7Kq1AZeRKA5i3Huofpot)〈實作順序〉階段 5；[TASK-162](2026-11-22-tooling.md) 讓 knip 暫時不查匯出，留下這份清單

## 目的

匯出代表「別的檔會用」。沒人用的匯出讓人以為改了會影響別處，也讓 knip 的清單長到看不出新問題。這次先清 3D、日照頁、圖面頁以外的部分；那三處等各自的工作告一段落再清，清完 knip 才能把匯出檢查打開。

## 範圍

- `core/geometry/active-geometry.mjs`：`SITE_COORDINATE_SYSTEM_ID`、`normalizeBounds` 改為檔內私有；`boundsEqual` 沒有任何地方呼叫，刪除。`.d.mts` 同步。
- `core/geometry/site-orientation.mjs`：`SITE_ORIENTATION_COORDINATE_SYSTEM`、`SITE_POSITIVE_X_DIRECTION` 改為私有，`.d.mts` 同步。
- `core/viewer/render-budgets.mjs`：`ASSET_EXTENSION_KINDS` 改為私有，`.d.mts` 同步。`core/viewer/viewer-data.mjs`：`solarAnalysisInput` 改為私有。
- `core/solar/solar-angle-analysis.mjs`：四個日期常數與三個只給報告用的評估函式改為私有；舊名 `buildL2VolumeCorners`（`buildReflectingVolumeCorners` 的別名）沒人用，刪除。`core/solar/solar-energy-analysis.mjs`：`WARM_MONTHS` 改為私有。
- `web/src/app/router.ts`：`isViewId` 改為私有；`NavigationGroupId` 直接寫成型別，拿掉只為推導型別而存在的陣列。`web/src/shared/types.ts`：五個只在檔內組成 `ProjectModel` 的型別改為不匯出。

保留：`web/src/app/router.ts` 的 `viewIds`。knip 看不到引用，但 `check:docs` 會讀這個檔的原始碼比對路由登錄表，拿掉 `export` 會讓檢查失效。

不做：3D 分頁（172 個）、圖面頁（15 個）、日照頁的匯出；計算與數值。

## 驗收

- `npx knip --include exports,types,duplicates` 在 3D、日照頁、圖面頁以外只剩 `viewIds`。
- 角度報告輸出與改前逐位元組相同。
- `npm run lint`、`npm run build`、`npm run test:e2e`、`git diff --check` 通過。
