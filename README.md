# Swimming Pool Design

國立臺中教育大學附設實驗國民小學游泳池翻修的概念設計、空間參照圖集與可信即時 3D Viewer 專案。

本專案使用現有衛星圖、照片、手繪概念與明確設計數值建立可持續修正的規劃模型。所有成果均為概念設計用途，不作為施工、發包、結構或法規簽證文件。

## 目前成果

- `model/project-model.json` 是圖面、ID、尺寸、狀態與來源的單一權威模型。
- `reference/index.html` 提供六張可縮放、可點選 ID、支援手機的空間參照圖。
- `reference/solar-study/index.html` 提供固定 1F、2F 水平旋轉與鏡牆外傾的冬夏日照互動研究。
- 模型方位以本地長軸 307° 為單一答案；`CORE-01` 與入口 `EN-01` 已依衛星圖修正方向。
- L1 男廁在左、女廁在右，操場側各有前門，泳池側各有可於非使用時間關閉的後門；入口前室尺寸仍可調整。
- L2 男、女更衣淋浴區嚴格分離，各配置 15 間整合式單元，另保留 5 間擴充位置。
- L2 由原核心上方與 5.0 m 工作值擴建區整合，樓梯在中央分流，男左女右且入口錯開。
- 每間單元內設壁掛置物櫃，不設集中式置物櫃區。
- `ST-01` 採 A2 兩段同向懸空式樓梯、雙側厚鋼梯梁、透明欄杆與開放梯下。
- 10° 玻璃屋頂向泳池遠端左下傾斜，平面終止於 L2 擴建邊緣；最終標高與屋頂交界構造保留在 `OPEN-010` 第二階段討論。

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
- [服務核心第一階段修正設計](docs/specs/2026-07-14-service-core-first-revision-design.md)
- [服務核心第一階段修正實作紀錄](docs/specs/2026-07-14-service-core-first-revision-implementation-plan.md)
- [冬夏日照互動展示設計](docs/specs/2026-07-14-solar-reflection-explainer-design.md)
- [冬夏日照互動展示實作計畫](docs/specs/2026-07-14-solar-reflection-explainer-implementation-plan.md)
- [repo-local Codex skill](.codex/skill/SKILL.md)

## 歷史成果

- [V02 Viewer](index.html)
- [V03 Viewer](versions/V03/ZhongShiPool_V03_Viewer.html)

V02／V03 只代表當時版本。若歷史成果與 `docs/` 或 `model/project-model.json` 衝突，以目前模型及權威文件為準。
