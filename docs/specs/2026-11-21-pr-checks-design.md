# PR 自動檢查設計

- 日期：2026-11-21
- 類型：design
- 狀態：in_progress
- 任務：TASK-111
- 目標版本：repository tooling（不另發版）
- 核准：使用者 2026-11-21 23:26（台北時間）於專案對話同意開工
- 決策：[DEC-148](../04_DECISIONS_AND_OPEN_ITEMS.md)

## 1. 目標

1. 每個 PR 在合併前自動跑完與部署相同的建置，以及目前只能手動執行的瀏覽器測試與金鑰掃描。
2. `main` 的分支保護只認一項彙總檢查，之後增減檢查項目不必改 GitHub 設定。
3. 在 [DEC-147](../04_DECISIONS_AND_OPEN_ITEMS.md) 的搬移開工前，先讓 `main` 上所有檢查都是綠燈，搬移才有可信的對照基準。

## 2. 不變的事

- 網站行為、設計、模型數值、公開網址與部署流程（`deploy-pages.yml`）。
- 檔案位置與名稱。搬移、改名與指令名稱統一屬於 `TASK-107`～`TASK-110`。
- `npm run build` 的內容。它仍串接文件檢查、模型檢查、單元測試與型別檢查，部署因此維持原有門檻。

## 3. 檢查項目

`.github/workflows/ci.yml` 在每個 PR、`main` push 與手動觸發時執行：

| Job | 內容 |
| --- | --- |
| Lint | `npm run lint`（ESLint） |
| Type check | `npm run typecheck` |
| Docs, model and unit tests | `check:docs`、`validate:reference`、`npm test`，並確認重新產生的 `reference/generated/` 與已提交的版本相同 |
| Build | `npm run build`、單一入口檢查（與部署相同），並保存產出給瀏覽器測試 |
| Browser tests | 以建置產出執行 `npm run test:e2e`；失敗時保存截圖 |
| Secret scan | gitleaks 8.30.1，下載後驗證 SHA-256，掃完整 Git 歷史與目前檔案；`gitleaks:allow` 註解不算數 |
| 全部檢查通過 | 上列六項都成功才通過；任何一項失敗、取消或略過都判定失敗 |

第三方 Actions 以 commit 編號鎖定並在註解標示版本。checkout 不保留 token。同一個 PR 有新推送時取消舊的執行；`main` 上的執行不取消。

## 4. 同時修正的既有問題

1. **viewer e2e 在 `main` 上失敗。** 0.9.7 的日照研究改版移除了頁首版本標籤與「已確認角度、研究基線、方法」面板，並把光線移到建築框線上層，e2e 仍在找舊元素。改為檢查研究修訂版、頁尾的模型版本、研究結論的五個數值（由 active geometry 推導，不寫死），以及 0.9.7 的圖層順序。
2. **相依套件弱點。** `npm audit fix` 只更新 lockfile：vite 6.4.6 與其 postcss、nanoid、source-map-js。
3. **開發伺服器對整個區域網路開放。** `npm run dev` 改為只聽本機；手機測試用 `npm run dev:lan`。
4. **ESLint 最小基準。** JavaScript 與 typescript-eslint 的建議規則；Playwright 腳本另加瀏覽器全域變數。基準找到的 8 處無用程式碼一併移除，不改變行為。依賴方向規則留給 `TASK-107`，因為目前網站仍直接引用 `scripts/`。
5. **Node 版本。** `.node-version` 固定 Node 22 供 CI 讀取；`engines` 要求 22.13 以上（ESLint 10 的需求）。

## 5. 使用者需要做的設定

PR 合併後，於 GitHub 的 Settings → Branches 為 `main` 新增保護規則，勾選「Require status checks to pass before merging」並指定「全部檢查通過」。這一步只有 repo 擁有者能做。

## 6. 驗收

- 本 PR 上七項檢查全部通過。
- 本機 `npm run lint`、`npm run build`、`npm run test:e2e` 通過；`npm audit` 為 0；`git diff --check` 通過。
- `main` 合併後，`TASK-107` 的前置條件成立。
