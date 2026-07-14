# Swimming Pool Design

國立臺中教育大學附設實驗國民小學游泳池翻修的概念設計、空間參照圖集與互動研究專案。現有衛星圖、手繪概念、使用者標註與明確設計值共同形成可追溯、可修訂的單一規劃模型。

本專案為概念設計用途，不是施工、發包、結構、消防或法規簽證文件。

## 目前版本

- 套件版本：`0.2.0`
- 模型版本：`0.2.0`
- 下一個目標版本：待排定
- 當前工作與待修順序：[07｜Active Work](docs/07_ACTIVE_WORK.md)

## 本機使用

```powershell
npm install
npm run dev
```

Vite 顯示的 Network URL 可由同一 Wi-Fi 的手機開啟。提交前完整驗證：

```powershell
npm run build
```

## 公開成果

- [空間參照圖集](https://kuohappiness.github.io/Swimming-Pool-Design/)
- [冬夏日照互動研究](https://kuohappiness.github.io/Swimming-Pool-Design/solar-study/)

每次 `main` 通過驗證並推送後，GitHub Actions 會重新建置及更新公開網站；本機尚未 push 的變更不會上線。

## 權威文件

1. [專案簡報](docs/01_PROJECT_BRIEF.md)
2. [基地與來源](docs/02_SITE_AND_SOURCES.md)
3. [設計基準](docs/03_DESIGN_BASIS.md)
4. [決策與待決事項](docs/04_DECISIONS_AND_OPEN_ITEMS.md)
5. [模型契約](docs/05_MODEL_CONTRACT.md)
6. [工作流程與發布](docs/06_WORKFLOW_AND_RELEASES.md)
7. [Active Work](docs/07_ACTIVE_WORK.md)

文件責任與生命週期見 [DOCUMENT_OWNERSHIP](docs/governance/DOCUMENT_OWNERSHIP.md)。已完成規格保存在 `docs/archive/specs/`，歷史成果集中於 [versions](versions/README.md)；兩者都不是現行設計真相。
