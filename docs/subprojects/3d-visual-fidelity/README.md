# 3D Viewer 視覺擬真子專案

這是現有 `/3d-viewer/` 的 0.8.0 enhanced rendering 子專案索引。它只提供文件導航與固定模組邊界，不另存建築設計答案、TASK 狀態、資產授權明細或第二套模型資料。

## 目前狀態

- 目標版本：`0.8.0`
- 階段：`TASK-059`～`TASK-065` 已完成並發布為 0.8.0
- 任務：[TASK-059～TASK-065](../../07_ACTIVE_WORK.md)
- 決策：[DEC-119／DEC-120](../../04_DECISIONS_AND_OPEN_ITEMS.md)
- 完成設計：[3D Viewer 視覺擬真升級架構](../../archive/specs/2026-07-24-3d-visual-fidelity-design.md)
- 完成計畫：[Visual Fidelity Implementation Plan](../../archive/specs/2026-07-24-3d-visual-fidelity-implementation-plan.md)
- 發布紀錄：[Release 0.8.0](../../releases/0.8.0.md)
- 0.7 依賴：[3D Walkthrough 子專案](../3d-walkthrough/README.md)
- 現行輸出契約：[3D Viewer 契約](../../contracts/3d-viewer.md)

## 固定邊界

- 0.8.0 與 0.7.0 可在獨立 branch／worktree 平行開發，但正式發布維持 0.7.0→0.8.0。
- `model/project-model.json` 維持唯一 canonical geometry；視覺設定、材質、HDR、後製與資產不得寫回模型。
- enhanced render mesh 與 GLTF 不驅動 walkthrough collision；碰撞仍使用 semantic descriptors。
- runtime 相容性使用 schema、active revision、SITE-XY、adapter 與 hash，不以目標版號硬編碼。
- 不建立第二個 Viewer URL、Vite app、package、lockfile 或部署流程。
- 所有 texture／HDRI／GLTF 必須本地封裝並在 asset manifest 記錄來源、授權、hash 與大小。
- 共用 `main.ts`、`scene-factory.ts`、CSS、E2E、version 與 Viewer contract 只由 integration task 修改。

## 預定程式結構

```text
reference/src/3d-viewer/rendering/
├─ contracts.ts
├─ quality-profile.ts
├─ baseline-*.ts
├─ index.ts
└─ enhanced/
   ├─ asset-manifest.ts
   ├─ quality-profiles.ts
   ├─ pbr-material-registry.ts
   ├─ texture-loader.ts
   ├─ surface-details.ts
   ├─ environment-effect.ts
   ├─ frame-effect-pipeline.ts
   ├─ tone-mapping.ts
   ├─ water-presentation.ts
   └─ visual-asset-adapter.ts

reference/src/3d-viewer/assets/
├─ README.md
├─ materials/
├─ environments/
└─ models/
```

## 文件所有權

| 資訊 | 唯一 owner |
| --- | --- |
| 建築幾何、版本、active revision | `model/project-model.json` 與 `docs/05_MODEL_CONTRACT.md` |
| 0.8 視覺架構與品質目標 | active design spec；完成後移至 `docs/archive/specs/` |
| 實作順序與驗收 | active implementation plan；完成後移至 `docs/archive/specs/` |
| TASK 狀態與依賴 | `docs/07_ACTIVE_WORK.md` |
| 資產來源／授權／hash／大小 | 0.8 asset manifest |
| 已發布 Viewer 行為 | `docs/contracts/3d-viewer.md` |
| 本頁 | 只負責導航、固定邊界與預定檔案位置 |
