# Swimming Pool Design

國立臺中教育大學附設實驗國民小學游泳池翻修的概念設計與可信即時 3D Viewer 專案。

本專案使用現有衛星圖、照片、手繪概念與明確的設計數值建立可持續修正的規劃模型。所有成果均為概念設計用途，不作為施工、發包、結構或法規簽證文件。

## 目前狀態

- 已確認基地、方位、來源圖與核心空間意圖。
- 既有廁所基地將拆除重建，納入新的泳池整體規劃。
- 玻璃屋頂只覆蓋泳池大廳。
- 入口與樓梯的精確位置，以及男女更衣室的樓層、大小與進出方式，保留為下一輪設計決策。
- 現有 V02／V03 Viewer 與 DXF 保留為歷史成果；下一個實作里程碑才會建立新的參數化 Viewer。

## 專案導覽

- [專案簡報](docs/01_PROJECT_BRIEF.md)
- [基地與來源](docs/02_SITE_AND_SOURCES.md)
- [設計基準](docs/03_DESIGN_BASIS.md)
- [決策與待決事項](docs/04_DECISIONS_AND_OPEN_ITEMS.md)
- [模型與 Viewer 契約](docs/05_MODEL_AND_VIEWER_CONTRACT.md)
- [工作流程與版本規範](docs/06_WORKFLOW_AND_VERSIONING.md)
- [本次基礎架構設計規格](docs/specs/2026-07-13-project-foundation-design.md)
- [repo-local Codex skill](.codex/skill/SKILL.md)

## 歷史 Demo

- [V02 Viewer](index.html)
- [V03 Viewer](versions/V03/ZhongShiPool_V03_Viewer.html)

歷史 Demo 只代表當時版本，不等於目前權威設計。若歷史 Viewer 與 `docs/` 衝突，以現行權威文件為準。

## 下一步

先完成入口／樓梯及更衣室配置決策，再建立單一參數模型，從同一份資料產生即時 3D Viewer 與 DXF，並加入自動驗證與 GitHub Pages 預覽。
