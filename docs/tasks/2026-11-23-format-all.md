# 全庫 Prettier 排版，格式檢查進 npm run lint

狀態：已合併｜完成：程式、測試與工具 197 個檔照 Prettier 排版，`npm run lint` 與 CI 加上格式檢查，排版 commit 記進 `.git-blame-ignore-revs`｜等誰：—

- 日期：2026-11-23
- 類型：chore
- 任務：TASK-166
- 核准：使用者 2026-11-23 說「好，你看一下目前正在跑的，等跑完你就去做」，排定在其他 PR 都合併後做；協調者 2026-11-23 確認沒有開著的 PR 後放行，並請其他串暫停開新 PR 到合併為止

來自：[程式碼品質改善方案](https://claude.ai/artifact/Fb7Kq1AZeRKA5i3Huofpot)〈實作順序〉階段 4；[TASK-162](2026-11-22-tooling.md) 只加了 Prettier 設定，全庫排版留到沒有 PR 進行的空檔

## 目的

TASK-162 之後 Prettier 已有設定但沒人強制，每個人的編輯器排出來的樣子不同，同一段程式常因為換行、引號不同而在合併時衝突。一次排完全庫，之後由 `npm run lint` 與 CI 檢查，排版就不會再出現在別人的 diff 裡。

## 範圍

分三個 commit，以一般合併（不 squash）進 main，讓排版 commit 的編號在 main 上保持有效：

1. 測試：三個單元測試原本直接比對原稿文字，換行與引號一改就失敗。設計理念與日照頁模板先照瀏覽器的方式合併空白再比對；bootstrap 的分頁載入鍵允許不加引號；3D 樣式的屬性選擇器允許單引號或雙引號。比對的內容沒有變少。
2. 排版：只跑 `npx prettier --write .`，沒有手動修改。web/src 103 檔、tests/unit 59 檔、tools 20 檔、core 13 檔、tests/e2e 2 檔，另有 `eslint.config.js`、`.stylelintrc.json`、`web/index.html`。
3. 檢查與文件：`npm run lint` 最後加 `npm run format:check`，CI 的步驟名稱跟著改；新增 `.git-blame-ignore-revs` 記第 2 個 commit；[工作流程](../agents/workflow.md) 與 [架構](../architecture.md) 目錄樹同步。

不排版的範圍照 `.prettierignore`：`docs/`、`model/`、`drawings/`、`source-materials/`、`web/src/generated/`、`tests/fixtures/`、Markdown 與 lock 檔。

不做：改 Prettier 設定（單引號、每行 100 字沿用 TASK-162）。

## 其他討論串

合併後協調者通知其他串接 main。各串自己的分支接上 main 後跑一次 `npm run format` 再提交，衝突時以自己的內容為準、再重排一次即可。

## 驗收

`npm run lint`（含格式檢查）、`npm run build`、`npm run test:e2e`、`git diff --check` 通過。HTML 模板只在原本就有空白的地方換行，瀏覽器顯示不變；以兩個建置版本截圖比對確認。
