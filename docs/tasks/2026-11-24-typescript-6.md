# 型別檢查工具 TypeScript 由 5 升到 6

狀態：已合併｜完成：TypeScript 由 5.9 升到 6.0.3，型別檢查與型別規則照常通過，設定不用改；TypeScript 7 等 typescript-eslint 支援再升｜等誰：—

- 日期：2026-11-24
- 類型：build
- 任務：TASK-184
- 核准：使用者 2026-11-22 在決定卡選「先做 4 和 6，5 和 7 等 3D 做完」；2026-11-23 說「好，你看一下目前正在跑的，等跑完你就去做」。協調者 2026-11-24 放行共用檔

來自：[程式碼品質改善方案](https://claude.ai/artifact/Fb7Kq1AZeRKA5i3Huofpot)〈實作順序〉階段 7（大版本升級，一個套件一個 PR）

## 目的

TypeScript 6 是 7（改用 Go 重寫的版本）之前的最後一個 JavaScript 版本，先升到 6 才能看到 7 會拿掉的舊設定。本專案的 `tsconfig.json` 沒有用到 6 標為過時的設定（`moduleResolution: node`、`baseUrl` 等），升級後不用改。

## 範圍

- `package.json`、`package-lock.json`：`typescript` 由 `^5.8.3` 改為 `^6.0.3`。

不做：TypeScript 7。typescript-eslint 8.74 的相容範圍是 `>=4.8.4 <6.1.0`，裝 7 時 `npm run lint` 直接報不支援；等 typescript-eslint 支援後另開。網站由 Vite 轉譯、不經 `tsc`，建置產物不受影響。

## 驗收

- `npm run typecheck`、`npm run lint`（含網站程式的型別規則）、`npm run build`（378 個單元測試）、`npm run test:e2e`、`git diff --check` 通過。
