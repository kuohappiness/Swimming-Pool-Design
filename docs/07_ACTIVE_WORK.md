# 07｜Active Work

本文件只管理「目前做什麼、狀態、依賴與驗收」。設計答案留在 01～05 owner 文件，流程留在 06，詳細作法留在 active spec。

允許狀態：`queued`、`ready`、`in_progress`、`blocked`、`done`。同一時間最多一項 `in_progress`；任務延期只修改目標版本，不更換 TASK ID。

## 1. 0.2.0 任務

| ID | 工作 | 狀態 | 目標版本 | Owner／規格 | 依賴 | 完成條件 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-001 | 太陽研究 180° 方位修正 | ready | 0.2.0 | [DEC-029](04_DECISIONS_AND_OPEN_ITEMS.md)、[修正計畫](specs/2026-07-14-solar-orientation-correction-implementation-plan.md)、[solar contract](contracts/solar-study.md) | TASK-003 | 固定建築與 2F 使用本地 +X 307° transform；127° 只作面池法線／反射目標；方位一致性測試通過 |
| TASK-002 | L1 戶外入口與廁所雙動線 | ready | 0.2.0 | [DEC-028](04_DECISIONS_AND_OPEN_ITEMS.md)、[服務核心設計](specs/2026-07-14-service-core-first-revision-design.md)、[入口修正計畫](specs/2026-07-14-l1-outdoor-entry-correction-implementation-plan.md) | TASK-003 | 綠框為戶外；泳池、男廁、女廁三個獨立戶外開口；兩廁可由泳池側乾式通道進入；模型、圖集與測試一致 |
| TASK-003 | 文件架構重構 | done | 0.2.0 | [設計](archive/specs/2026-07-14-documentation-architecture-refactor-design.md)、[實作紀錄](archive/specs/2026-07-14-documentation-architecture-refactor-implementation-plan.md) | — | 07 成為唯一 task status；owner、contracts、spec archive、versions、來源與文件檢查完成 |
| TASK-006 | REF-401 屋頂、入口戶外區與鏡牆概念修正 | queued | 0.2.0 | [縱剖面修正設計](specs/2026-07-15-longitudinal-section-concept-correction-design.md)、[實作計畫](specs/2026-07-15-longitudinal-section-concept-correction-implementation-plan.md)、`DEC-030`（實作時登錄） | TASK-002 | 屋頂接近 L2 樓板且維持 deferred；入口區開放；面池端鏡牆外傾示意；來源、模型、圖集與測試一致 |
| TASK-004 | 套件、模型與現行文件同步至 0.2.0 | queued | 0.2.0 | [版本流程](06_WORKFLOW_AND_RELEASES.md) | TASK-001、TASK-002、TASK-003、TASK-006 | `package.json`、lockfile、modelVersion、revision 與現行文件一致為 0.2.0 |
| TASK-005 | 完整驗證與本機 release commit | queued | 0.2.0 | [發布門檻](06_WORKFLOW_AND_RELEASES.md) | TASK-001～TASK-004、TASK-006 | 文件、模型、測試、build、視覺 smoke 與 diff 檢查通過；建立 release 記錄與本機 `release: v0.2.0` commit；不 tag、不 push |

下一項可開始的工作是 `TASK-001`。完成後依序處理 `TASK-002`、`TASK-006`、`TASK-004`、`TASK-005`。

## 2. 未排程設計問題

下列項目是真正尚無完整答案的 OPEN，不是已知修法的工作：

- [OPEN-006](04_DECISIONS_AND_OPEN_ITEMS.md)：基地精確旋轉角與像素校準。
- [OPEN-008](04_DECISIONS_AND_OPEN_ITEMS.md)：廁所、開口與乾式通道精確尺寸。
- [OPEN-009](04_DECISIONS_AND_OPEN_ITEMS.md)：逃生、無障礙、結構與機電。
- [OPEN-010](04_DECISIONS_AND_OPEN_ITEMS.md)：玻璃屋頂與 L2 量體交界。
- [OPEN-011](04_DECISIONS_AND_OPEN_ITEMS.md)：2F 旋轉／鏡牆最終幾何與性能。

這些 OPEN 在取得新輸入、形成可核准設計並建立 TASK 前，不列入 0.2.0 執行順序。
