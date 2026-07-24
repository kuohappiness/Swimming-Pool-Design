# 3D Walkthrough 子專案

這是現有 `/3d-viewer/` 內的第一人稱漫遊子專案入口。它提供文件導航與模組邊界，不另存建築設計答案、TASK 狀態或第二套模型資料。

## 目前狀態

- 目標版本：`0.7.0`
- 階段：`TASK-053` 資料邊界與模組骨架已完成；`TASK-054` camera mode／雙平台輸入可開始
- 任務：[TASK-053～TASK-058](../../07_ACTIVE_WORK.md)
- 決策：[DEC-117／DEC-118](../../04_DECISIONS_AND_OPEN_ITEMS.md)
- 核准設計：[3D Walkthrough MVP 子專案架構](../../archive/specs/2026-07-24-3d-walkthrough-mvp-design.md)
- 實作計畫：[3D Walkthrough MVP Implementation Plan](../../archive/specs/2026-07-24-3d-walkthrough-mvp-implementation-plan.md)
- 現行輸出契約：[3D Viewer 契約](../../contracts/3d-viewer.md)

## 固定邊界

- 入口仍為 `/3d-viewer/`，以「模型檢視／第一人稱漫遊」切換。
- `model/project-model.json` 維持唯一機器可讀建築模型；walkthrough 只讀 active derived Viewer data。
- 不建立第二套 `package.json`、lockfile、建築模型、版本選取或發布流程。
- 桌機與手機共用移動／碰撞狀態機，只替換輸入 adapter。
- MVP 開放所有已建模區域，包含水面與水下探索；無連續實體動線的區域使用明確的區域跳轉。
- SketchUp、Revit、Blender 或 GLB／glTF 只可作為未來視覺資產來源，不取代 canonical model 或碰撞語意。

## 預定程式結構

```text
reference/src/3d-viewer/walkthrough/
├─ index.ts
├─ types.ts
├─ walkthrough-config.ts
├─ camera-mode-manager.ts
├─ player-controller.ts
├─ fixed-step-loop.ts
├─ input/
│  ├─ input-adapter.ts
│  ├─ desktop-input.ts
│  └─ touch-input.ts
├─ collision/
│  ├─ collision-world.ts
│  ├─ collision-proxies.ts
│  └─ safe-spawn-registry.ts
├─ movement/
│  ├─ walk-movement.ts
│  └─ swim-movement.ts
├─ environment/
│  ├─ water-volume.ts
│  └─ underwater-effects.ts
└─ adapters/
   └─ viewer-model-adapter.ts
```

測試分為純邏輯／資料隔離測試與瀏覽器行為測試；可重新產生的衍生資料只能放在 `reference/generated/`，不得寫回 `model/`。

## 文件所有權

| 資訊 | 唯一 owner |
| --- | --- |
| 建築幾何、版本、active revision | `model/project-model.json` 與 `docs/05_MODEL_CONTRACT.md` |
| 核准的 walkthrough 架構 | active design spec；完成後移至 `docs/archive/specs/` |
| 實作順序與驗收 | active implementation plan；完成後移至 `docs/archive/specs/` |
| TASK 狀態與依賴 | `docs/07_ACTIVE_WORK.md` |
| 已發布 Viewer 行為 | `docs/contracts/3d-viewer.md` |
| 本頁 | 只負責導航、固定邊界與檔案位置 |
