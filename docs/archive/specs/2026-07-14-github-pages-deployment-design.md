# GitHub Pages 自動部署設計

- 日期：2026-07-14
- 類型：design
- 狀態：completed
- 任務：legacy
- 目標版本：pre-0.2.0
- 完成日期：2026-07-14

## 1. 目標

將 `kuohappiness/Swimming-Pool-Design` 發布為公開 GitHub Pages 網站，讓外部手機 Chrome 不需連接開發電腦即可瀏覽。空間參照圖集是專案入口首頁；冬夏日照互動研究保留為首頁可到達的子頁。

正式路徑預期為：

- 專案首頁：`https://kuohappiness.github.io/Swimming-Pool-Design/`
- 日照研究：`https://kuohappiness.github.io/Swimming-Pool-Design/solar-study/`

## 2. 核准方案

採 GitHub Actions 自訂 Pages workflow。每次 `main` 更新時，由 CI 重新安裝鎖定依賴、執行完整驗證、建置 `dist/reference/`，再把該目錄作為 Pages artifact 發布。

不採用：

- 人工維護 `gh-pages` 分支：容易與單一模型及文件失去同步。
- 把 `dist/` 納入版本控制：會讓編譯產物污染原始碼歷史並產生過期檔案。
- 直接由 `main` 根目錄或 `docs/` 發布：目前網站需要 Vite 建置，不能把原始 TypeScript 當成靜態成品。

## 3. 發布架構

workflow 放在 `.github/workflows/deploy-pages.yml`，包含兩個相依工作：

1. `build`
   - checkout `main` 的確切 commit。
   - 使用目前支援的 Node LTS。
   - 以 `npm ci` 安裝 `package-lock.json` 鎖定依賴。
   - 執行 `npm run build`；此命令已包含模型驗證與單元測試。
   - 確認 `dist/reference/index.html` 與 `dist/reference/solar-study/index.html` 存在。
   - 上傳 `dist/reference/` 為 Pages artifact，因此圖集 `index.html` 位於 artifact 根層。
2. `deploy`
   - 僅在 `build` 成功後執行。
   - 使用 `github-pages` environment、`pages: write` 與 `id-token: write`。
   - 部署前一步產生的 artifact，並輸出正式 Pages URL。

workflow 由 `main` push 自動觸發，也提供 `workflow_dispatch` 供人工重新部署。使用 concurrency 取消同一群組的舊部署，避免較舊 commit 晚於新版本上線。

## 4. 首頁與連結契約

- Pages artifact 根層的 `index.html` 必須是空間參照圖集。
- 圖集的「冬夏日照互動研究」連結使用相對路徑 `./solar-study/`。
- 日照頁的「返回空間參照圖集」連結使用相對路徑 `../`。
- Vite `base: './'` 維持相對資產路徑，使本機、repository Pages 子路徑與下載後靜態伺服器共用同一份輸出。
- 不建立另一份 Pages 專用模型或頁面；部署一律使用 `model/project-model.json` 與目前 renderer。

## 5. 未來同步規則

未來修改設計細節時，只要依現行 owner 文件與單一模型流程完成變更、commit 並 push 到 `main`，Pages 就會自動重新建置及更新。同步包含：

- `model/project-model.json` 的版本、標籤、尺寸及狀態。
- 空間參照圖集的 SVG 與互動資訊。
- 日照研究的座標、方位、計算、圖示與說明。
- 未來納入 Vite 多頁輸出的其他專案展示頁。

只有尚未 push 的本機變更不會出現在公開網站。若驗證或建置失敗，部署工作不執行，線上網站保留上一個成功版本。

## 6. 安全與範圍

- repository 與 Pages 網站皆為公開資訊；workflow 不上傳 `source-materials/`、repo 歷史、`.git` 或本機暫存檔，只上傳 `dist/reference/`。
- workflow 使用 GitHub 提供的短效 `GITHUB_TOKEN` 權限，不新增 personal access token 或 repository secret。
- 本次不設定自訂網域、分析碼、登入、表單、資料庫或第三方追蹤。
- GitHub Pages 是展示環境，不改變「概念設計、非施工圖」的專案聲明。

## 7. 驗證與完成條件

1. 本機 `npm run build` 與 `git diff --check` 通過。
2. workflow YAML 可被 GitHub Actions 讀取，build 與 deploy 皆成功。
3. Pages 設定的 publishing source 為 GitHub Actions。
4. 正式首頁可載入圖集、模型版本及專案名稱。
5. 正式 `/solar-study/` 可載入平面、剖面與四項互動控制。
6. 外部網路的手機 Chrome 可使用 HTTPS 開啟兩個網址。
7. 線上頁面沒有 404 資產、模組載入錯誤或水平版面溢位。

## 8. 官方依據

- [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
