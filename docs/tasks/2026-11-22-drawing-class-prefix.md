# 圖面 SVG 的 class 加上 dw- 前綴

狀態：已合併｜完成：四張現行圖面的 class 全部改成 dw- 前綴，內嵌樣式不再外溢到網頁，畫面逐像素不變｜等誰：—

- 日期：2026-11-22
- 類型：refactor
- 任務：TASK-165
- 核准：網頁樣式串 2026-11-22 交付前綴清單（TASK-170 的後續），協調者同日排入

來自：[網頁樣式打底](2026-11-22-style-foundation.md)

## 目的

四張現行圖面 SVG 內嵌一段 `<style>`，裡面是 `text{…}`、`.title{…}`、`.small{…}` 這類通用名稱。圖面頁與設計理念頁把 SVG 直接內嵌到網頁，這段樣式就變成全頁規則，任何叫 `title`、`label`、`small` 的元素都會被改字級。網頁樣式串在 TASK-170 立了「分頁樣式不得外溢」的規則，圖面這段是最後一個缺口。

## 範圍

| 項目 | 做法 |
| --- | --- |
| class 名稱 | 照樣式串的對照表一律加 `dw-`，駝峰改連字號（`titleBox` → `dw-title-box`、`gridMajor` → `dw-grid-major`）。`tools/build/build-drawings.mjs` 寫檔前統一轉換，程式內仍用短名稱；遇到清單外的名稱就停止建置，不產生沒有樣式的元素 |
| 文字規則 | 圖面內容外包一層 `dw-sheet` 群組，`text{…}` 改成 `:where(.dw-sheet) text{…}`，權重和原本一樣低，只是不再外溢。不掛在 `svg` 根元素上，因為圖面頁與設計理念頁會在根元素插入自己的 class |
| 圖面 | 重產 `drawings/current/` 四張 SVG。去掉 class、樣式與外包群組後，和改前逐字相同 |
| 測試 | 新增 `tests/unit/tools/build/drawing-classes.test.mjs`：每個 class 都要 `dw-` 開頭，內嵌樣式只能有 `dw-` class 規則與 `:where(.dw-sheet) text` |
| 契約 | [圖面契約](../contracts/drawings.md) 記下前綴規則 |

不做：

- 圖面頁 `.drawing text` 把圖內文字一律設成 13px 的規則。刪掉後 `dw-tiny` 會變 10px，在補上最小字級之前多數標註會比現在小。網頁樣式串同意留到它的階段四（圖面檢視器補上圖內最小 12px）時一起改。
- 樣式串建議的網站字型名稱：目前 `main` 上還沒有這個字型，等它加入時再一起改字型順序。

## 驗收

2026-11-22，本機：

- 圖面頁四張圖與設計理念頁 L3 圖，桌機（1440 × 900）與手機（390 × 844）改前改後截圖逐像素相同；四張 SVG 單獨開啟的畫面也逐像素相同。
- 新測試在改前的 SVG 上失敗、改後通過。
- `npm run lint`、`npm run build`、`npm run test:e2e`、`git diff --check` 通過。
