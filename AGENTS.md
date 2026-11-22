# 給 AI 工具的規則

本檔是所有 AI 工具共用的規則；`CLAUDE.md` 只有一行 `@AGENTS.md`。回覆與文件一律用繁體中文。

## 底線

- 不直接推送到 `main`，所有修改都開 PR；`main` 的必要檢查是「全部檢查通過」，擁有者核准後才合併。
- 不改寫 Git 歷史，不 force push 已合併或別人的分支；發布紀錄記錄的 commit 編號必須持續有效。
- 不替使用者決定設計：沒有答案的問題記成 OPEN（[待決事項](docs/backlog.md)），不自行補值、不用 fallback。
- 原始來源只增不改：不覆蓋、不縮放、不重新壓縮 `source-materials/` 的檔案，網站要用的影像另做衍生檔。
- 不推翻公開網址與單一入口 `?view=<view id>`（DEC-125），除非擁有者同意。
- 金鑰、密碼不進 repo。

## 開工前

1. 讀 [README](README.md) 的導覽表，只讀這次工作需要的 owner 文件。
2. 檔案放哪裡、依賴方向、路由與名詞，以 [架構](docs/architecture.md) 為準；結構有變動時同一個 PR 更新它。
3. 先讀 [進度與任務](docs/roadmap.md) 的〈現在在哪裡〉。工作流程、檢查與發布照 [工作流程與發布](docs/agents/workflow.md)；每件工作的狀態只寫在它任務說明標題下的狀態行，roadmap 那一列同一個 commit 照抄。
4. 長文件只讀需要的那一段：`node tools/section.mjs <檔案> <標題或 ID>`。
5. repo 內的工作程序在 `.claude/skills/swimming-pool-design/`（`.agents/skills/` 有相同的一份，兩份要一起改）。

## 必跑的檢查

開 PR 前在 repo 根目錄執行：

```powershell
npm run lint
npm run build
npm run test:e2e
git diff --check
```

`npm run build` 會依序跑文案產生、`check:docs`、`check:model`、`check:assets`、單元測試、型別檢查與建置。`test:e2e` 需要 Chrome 或 Edge，Linux 或雲端環境以 `CHROME_PATH` 指定。

## Code Review Rules

審查 PR 時至少確認：

1. 依賴方向：`core/` 不引用 `web/`、`tools/`、`tests/`；網站不引用 `tools/`、`tests/`、`source-materials/`（見架構第 4 節）。
2. 單一真相：數值只來自 `model/`，文件只在 owner 寫一次，其他地方連過去。
3. 搬移或改名時 Git 認得出改名，現行文件與程式內沒有留下舊路徑。
4. 測試沒有被刪除或放寬；若有，PR 說明寫明原因。
5. 畫面有變動時附桌機與手機截圖；沒有預期變動時確認截圖沒變。
6. 新增或改名的檔案符合架構第 7 節的命名規則。

## 推理強度

- 自動使用足以可靠完成工作的最低推理強度。
- 簡單、範圍明確、低風險的工作用 Light；一般開發工作用 Medium。
- 有歧義、多步推理、跨檔修改、重要取捨、高風險決定或驗證失敗時，提高到 High 或 Extra High。
- 只有問題特別困難、正確性遠比速度或用量重要時才用 Max。
- 只有工作能拆成有意義、可平行的獨立部分時才用 Ultra。
- 不因輸入或輸出很長就提高推理強度。
- 這是預設值；使用者這次明確指定的推理模式、速度或品質偏好優先，暫時指示結束後回到本預設。
