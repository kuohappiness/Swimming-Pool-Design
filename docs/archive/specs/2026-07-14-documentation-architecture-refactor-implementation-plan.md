# 文件架構重構實作計畫

- 日期：2026-07-14
- 類型：implementation-plan
- 狀態：completed
- 任務：TASK-003
- 目標版本：0.2.0
- 完成日期：2026-07-14
- 依據：[文件架構重構設計](2026-07-14-documentation-architecture-refactor-design.md)

## 執行範圍

1. 將 README 縮為入口頁，建立 01～07 權威導航。
2. 建立 `07_ACTIVE_WORK.md`，遷移 `TASK-001`～`TASK-005` 的狀態、依賴與驗收。
3. 將模型契約與 atlas／solar 輸出契約拆分，將文件所有權移入 governance。
4. 統一 spec metadata；active 留在 `docs/specs/`，completed／superseded 移入 `docs/archive/specs/`。
5. 從舊服務核心完成紀錄抽出 L1 入口現行計畫；建立太陽方位現行計畫。
6. 將 V02 Viewer／DXF 集中至 `versions/V02/`，建立歷史版本索引。
7. 保存並登錄 `SRC-CONCEPT-008`，同步來源 owner 與模型 source registry。
8. 加入 `scripts/check-docs.mjs`、`npm run check:docs` 與 build 前置門檻。
9. 更新 repo-local skill，只引用正式 owner 與 governance。

## 不變條件

- 不修改泳池、服務核心、L2、樓梯或屋頂幾何。
- 不在本任務實作 `TASK-001` 或 `TASK-002`。
- 保留使用者現有且與本重構相關的未提交內容。
- Vite root 維持 `reference/`，V02 搬移不改變現行 build input。

## 完成門檻

- `npm run check:docs`
- `npm run validate:reference`
- `npm test`
- `npm run build`
- `git diff --check`
- 來源像素、SHA-256 與模型 registry 一致。
- active／archive spec、TASK 與所有本地 Markdown 連結通過自動檢查。

## 驗證結果

- `npm run check:docs`：通過。
- `npm run validate:reference`：18 entities、6 sheets、10 sources，通過。
- `npm test`：17 項通過。
- `npm run build`：文件、模型、測試與 Vite build 全部通過。
- `git diff --check`：通過。

設計規格與本計畫依生命週期一起移入 `docs/archive/specs/`。
