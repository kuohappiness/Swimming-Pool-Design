# 文件所有權與生命週期

## 1. 原則

每一類資訊只有一個 owner。其他文件可以摘要，但必須連回 owner，且不得另設可漂移的狀態或完整答案。`07_ACTIVE_WORK.md` 是 TASK 狀態唯一來源，不是設計知識庫。

## 2. Owner 對照

| 資訊 | 唯一 owner |
| --- | --- |
| 專案目的、範圍、成功條件 | `01_PROJECT_BRIEF.md` |
| 基地、方位證據、來源、像素、雜湊 | `02_SITE_AND_SOURCES.md` |
| 當前有效數值與空間意圖 | `03_DESIGN_BASIS.md` |
| DEC、真正 OPEN、取代歷史與設計風險 | `04_DECISIONS_AND_OPEN_ITEMS.md` |
| 模型 schema、座標、溯源與跨輸出不變條件 | `05_MODEL_CONTRACT.md` |
| 收件、變更、驗證、部署、版本與發布流程 | `06_WORKFLOW_AND_RELEASES.md` |
| TASK 狀態、依賴、目標版本與驗收入口 | `07_ACTIVE_WORK.md` |
| 專題分析的輸入、方法、比較表與限制 | `docs/analysis/<topic>.md` |
| 個別現行輸出行為 | `docs/contracts/<output>.md` |
| 子專案範圍索引、owner 導航與目前階段 | `docs/subprojects/<id>/README.md`；只作索引，不重複 DEC、TASK、SPEC 或契約內容 |
| 核准設計及實作步驟 | `docs/specs/` |
| 已完成／被取代規格 | `docs/archive/specs/` |
| 已發布版本證據 | `docs/releases/<version>.md` |
| 公開設計理念的敘事文字 | `docs/public/swimming-pool-renovation-design-concept.md` |

README 只保留定位、quickstart、URL、版本與 01～07 導航。repo-local skill 只保存工作程序並引用本文件，不複製 owner 規則表。

子專案 README 也只保留入口、固定邊界、預定檔案位置與 owner 連結。設計答案仍進 DEC／design spec，執行狀態仍只進 `07_ACTIVE_WORK.md`，已發布行為仍由 output contract 管理。

## 3. 分類

- `DEC`：已確認或已被取代的設計答案。
- `OPEN`：尚缺關鍵輸入，無法形成唯一答案的問題。
- `TASK`：答案或修法已知，等待執行與驗證的工作。
- `SPEC`：核准的設計或實作計畫。
- `RELEASE`：已發布版本的不可變證據。

修法已知的缺陷不得長期留在 OPEN。設計答案進 DEC，執行進 TASK。

## 4. Task 狀態

允許 `queued`、`ready`、`in_progress`、`blocked`、`done`。預設同一時間最多一項 `in_progress`。

只有在 DEC 與 active specs 明確核准平行工作流、不同目標版本使用獨立 branch／worktree、檔案所有權互斥，且共用整合檔案仍由單一 integration task 管理時，才可改為「每個目標版本最多一項 `in_progress`」。平行例外必須由文件檢查器驗證；在相應 validator task 完成前仍沿用全域單一 `in_progress`。

- `queued`：依賴尚未完成。
- `ready`：可直接開始。
- `in_progress`：目前主動執行工作；若使用已核准平行例外，須屬不同目標版本與隔離工作區。
- `blocked`：已有明確阻塞證據。
- `done`：驗收條件已通過；不得只因寫完規格而完成。

## 5. Spec metadata 與封存

active spec 必須有固定欄位：

```text
- 日期：YYYY-MM-DD
- 類型：design | implementation-plan
- 狀態：draft | approved | in_progress
- 任務：TASK-NNN
- 目標版本：x.y.z
```

archive spec 必須使用 `completed` 或 `superseded`，並增加 `完成日期`。任務完成後，design 與 implementation plan 一起封存；封存文件只允許修正斷鏈或明顯文字錯誤，不改寫當時決策。

## 6. 檢查

`npm run check:docs` 檢查本地 Markdown 連結、ID 宣告、TASK 狀態、spec metadata 與 active spec 引用。模型來源檔案與雜湊另由 `npm run validate:reference` 檢查。
