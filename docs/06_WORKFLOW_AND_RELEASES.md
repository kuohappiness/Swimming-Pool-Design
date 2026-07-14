# 06｜工作流程與發布

## 1. 工作鏈

```text
來源／使用者決策
        ↓
owner 文件與 DEC／OPEN
        ↓
TASK 與核准規格
        ↓
model/project-model.json
        ↓
validator + tests + build
        ↓
現行輸出與 release 記錄
```

來源先入庫、設計答案先進 owner、執行狀態只進 [07｜Active Work](07_ACTIVE_WORK.md)。文件責任與生命週期見 [DOCUMENT_OWNERSHIP](governance/DOCUMENT_OWNERSHIP.md)。

## 2. 新來源資料

1. 保留原始檔，不覆蓋既有來源。
2. 依 `SRC-<類型>-<序號>_<描述>.<副檔名>` 命名。
3. 記錄像素、格式、SHA-256、用途與限制。
4. 更新 [02｜基地與來源](02_SITE_AND_SOURCES.md) 與模型 `sources`。
5. 若改變設計，另更新設計基準及 DEC／OPEN；若需要實作，建立或更新 TASK。

## 3. 設計與實作變更

1. 先判斷內容是 DEC、OPEN、TASK、SPEC 或 RELEASE。
2. 更新唯一 owner，不在 README 或規格另建第二份狀態。
3. 設計答案確認後，更新 DEC、設計基準及模型契約。
4. 需要執行時，於 `07_ACTIVE_WORK.md` 建立穩定 TASK ID，連結 owner、核准規格與驗收。
5. 只有 `in_progress` 任務可以主動修改實作；同一時間最多一項。
6. 修改模型或 consumer，執行相稱的 validator、測試、build 與視覺檢查。
7. 驗證完成後將 TASK 設為 `done`，規格移至 `docs/archive/specs/`。
8. 形成版本時建立 `docs/releases/<version>.md`，記錄範圍、驗證證據與 commit。

## 4. 本機操作

```powershell
npm install
npm run dev
npm run check:docs
npm run validate:reference
npm test
npm run build
git diff --check
```

`npm run build` 是提交前完整自動門檻；靜態成果輸出至 `dist/reference/`。瀏覽器與手機 smoke 仍屬需要人工確認的視覺門檻。

## 5. GitHub Pages

公開首頁是 `https://kuohappiness.github.io/Swimming-Pool-Design/`，日照研究位於 `/solar-study/`。`.github/workflows/deploy-pages.yml` 在 `main` push 或人工觸發時：

- 以 lockfile 安裝依賴並執行 `npm run build`。
- 只上傳 `dist/reference/`；`dist/` 不納入 Git 歷史。
- build 成功後才部署；失敗時保留上一個成功網站。

## 6. 版本語意

- 套件版本與正式模型版本在 release TASK 中同步。
- Git commit 是可追溯變更；Git tag 只在明確要求時建立。
- `versions/V02`、`versions/V03` 是不可變歷史快照，不延續為現行模型版號。
- PATCH：不改幾何語意；MINOR：新增相容能力或完成一組新設計；MAJOR：座標、單位或 schema 的不相容變更。

## 7. 提交與發布門檻

- `npm run build` 與 `git diff --check` 通過。
- 文件連結、ID、來源雜湊、spec lifecycle 與 task state 通過 `npm run check:docs`。
- confirmed 答案無矛盾；deferred 欄位連結真正 OPEN 且沒有 fallback。
- owner、模型、renderer 與測試對同一設計規則一致。
- 相稱的桌面／手機視覺 smoke 已完成。
- release 記錄列出版本、包含 TASK、驗證命令、結果、已知限制與 commit。
