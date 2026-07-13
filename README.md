# Swimming Pool Design

國立臺中教育大學附設實驗國民小學游泳池翻修的概念設計、空間參照圖集與可信即時 3D Viewer 專案。

本專案使用現有衛星圖、照片、手繪概念與明確設計數值建立可持續修正的規劃模型。所有成果均為概念設計用途，不作為施工、發包、結構或法規簽證文件。

## 目前成果

- `model/project-model.json` 是圖面、ID、尺寸、狀態與來源的單一權威模型。
- `reference/index.html` 提供六張可縮放、可點選 ID、支援手機的空間參照圖。
- L2 男、女更衣淋浴區嚴格分離，各配置 15 間整合式單元，另保留 5 間擴充位置。
- 每間單元內設壁掛置物櫃，不設集中式置物櫃區。
- `ST-01` 採 A2 兩段同向懸空式樓梯、雙側厚鋼梯梁、透明欄杆與開放梯下。
- 10° 玻璃屋頂只覆蓋泳池大廳，服務核心端高、泳池遠端低。

## 本機 Demo

```powershell
npm install
npm run dev
```

Vite 顯示的 Network URL 可直接由同一 Wi-Fi 的手機開啟。靜態成果與完整驗證：

```powershell
npm run build
```

## 專案導覽

- [專案簡報](docs/01_PROJECT_BRIEF.md)
- [基地與來源](docs/02_SITE_AND_SOURCES.md)
- [設計基準](docs/03_DESIGN_BASIS.md)
- [決策與待決事項](docs/04_DECISIONS_AND_OPEN_ITEMS.md)
- [模型與 Viewer 契約](docs/05_MODEL_AND_VIEWER_CONTRACT.md)
- [工作流程與版本規範](docs/06_WORKFLOW_AND_VERSIONING.md)
- [空間參照圖集設計規格](docs/specs/2026-07-13-spatial-reference-atlas-design.md)
- [空間參照圖集實作計畫](docs/specs/2026-07-13-spatial-reference-atlas-implementation-plan.md)
- [repo-local Codex skill](.codex/skill/SKILL.md)

## 歷史成果

- [V02 Viewer](index.html)
- [V03 Viewer](versions/V03/ZhongShiPool_V03_Viewer.html)

V02／V03 只代表當時版本。若歷史成果與 `docs/` 或 `model/project-model.json` 衝突，以目前模型及權威文件為準。
