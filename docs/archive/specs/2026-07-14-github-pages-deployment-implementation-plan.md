# GitHub Pages 自動部署實作計畫

- 日期：2026-07-14
- 類型：implementation-plan
- 狀態：completed
- 任務：legacy
- 目標版本：pre-0.2.0
- 完成日期：2026-07-14

## 1. 文件與入口

- 在 `README.md` 加入正式 Pages 首頁及日照研究網址。
- 在 `docs/06_WORKFLOW_AND_VERSIONING.md` 登錄 Pages 發布流程、同步條件與故障行為。
- 將部署設計與本實作計畫加入專案導覽。

## 2. GitHub Actions workflow

- 新增 `.github/workflows/deploy-pages.yml`。
- `main` push 與 `workflow_dispatch` 觸發部署。
- build job 使用 Node 22、`npm ci` 與 `npm run build`。
- build job 額外驗證圖集首頁及日照研究兩個 HTML 產物。
- 只上傳 `dist/reference/` 為 Pages artifact。
- deploy job 使用 `github-pages` environment 與最小 Pages／OIDC 權限。
- concurrency 保證新 commit 不會被較舊部署覆蓋。

## 3. Repository 設定

- 將 Pages publishing source 設為 GitHub Actions。
- 不建立 PAT、custom domain、`gh-pages` 分支或已編譯成品 commit。

## 4. 本機驗證

- 執行 `npm run build`。
- 確認 `dist/reference/index.html` 與 `dist/reference/solar-study/index.html` 存在。
- 檢查 workflow 結構、文件連結、placeholder 與 `git diff --check`。
- 只 stage 本次部署文件與 workflow，保留既有 service-core 未提交變更。

## 5. 發布與線上驗證

- commit 並推送目前 `main`。
- 監看 Pages workflow 的 build 與 deploy job 至終態。
- 驗證正式首頁及 `/solar-study/` 的 HTTPS、資產載入、互相導覽與手機寬度。
- 若 workflow 失敗，依 Actions log 修正後重新執行，直到正式 URL 可用。
