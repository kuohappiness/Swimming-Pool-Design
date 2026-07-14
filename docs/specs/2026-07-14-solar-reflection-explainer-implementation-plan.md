# 冬夏日照互動展示實作計畫

日期：2026-07-14

## 1. 模型與文件

- 校正模型校名。
- 在 `referenceSystem` 加入唯一校址座標與時區。
- 更新 `02`、`03`、`04`、`05` owner 文件，建立 `DEC-027` 與 `OPEN-011`。

## 2. 共用計算核心

- 新增無 DOM 依賴的太陽位置與三維鏡面反射模組。
- 加入 TypeScript 宣告及 Node 單元測試。

## 3. 正式頁面

- 建立 `reference/solar-study/index.html`。
- 建立頁面專用 TypeScript 與 CSS。
- 由模型及共用計算核心驅動平面、剖面、控制、讀值與冬夏表格。
- 在圖集加入互相導覽連結。

## 4. 建置與驗證

- 將 Vite 改為多頁輸出。
- 執行 `npm run validate:reference`、`npm test`、`npm run build` 與 `git diff --check`。
- 檢查桌面及手機 viewport、鍵盤控制、冬夏預設判讀與 build 產物。

## 5. 發布

- 只 stage 本次列出的文件、模型、頁面、計算與測試檔。
- 保留既有未提交檔案。
- 建立範圍清楚的 commit 並推送目前 `main` 到 `origin`。
