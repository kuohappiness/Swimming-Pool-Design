# Swimming Pool Design

國立臺中教育大學附設實驗國民小學游泳池改建的概念設計、圖面與互動研究專案。現有衛星圖、手繪概念、使用者標註與明確設計值共同形成可追溯、可修訂的單一規劃模型。

本專案為概念設計用途，不是施工、發包、結構、消防或法規簽證文件。

## 現行版本

- 套件版本：`0.10.0`
- 模型版本：`0.10.0`

## 公開網站

- [設計理念](https://kuohappiness.github.io/Swimming-Pool-Design/)
- [日照研究](https://kuohappiness.github.io/Swimming-Pool-Design/?view=solar-study)
- [圖面設計](https://kuohappiness.github.io/Swimming-Pool-Design/?view=drawings)
- [3D 展示](https://kuohappiness.github.io/Swimming-Pool-Design/?view=3d-viewer)

`main` 有新的合併後，GitHub Actions 會重新建置並更新網站。

## 想知道什麼、讀哪一份

| 想知道 | 讀這份 |
| --- | --- |
| 為什麼做、範圍與成功條件 | [專案簡報](docs/product.md) |
| 基地、方位與來源登錄 | [基地與來源](docs/site-and-sources.md) |
| 目前有效的設計數值 | [設計基準](docs/design-basis.md) |
| 已確認的決策與設計風險 | [決策](docs/decisions.md) |
| 還沒有答案的問題 | [待決事項](docs/backlog.md) |
| 現在在做什麼、下一步 | [進度與任務](docs/roadmap.md) |
| 模型規則與各輸出的契約 | [模型契約](docs/contracts/model.md)，其他在 `docs/contracts/` |
| 工作流程、檢查與發布 | [工作流程與發布](docs/agents/workflow.md) |
| 檔案放哪裡、資料夾結構、名詞對照 | [架構](docs/architecture.md) |
| 各版本做了什麼 | [發布紀錄](docs/releases/README.md) |
| 舊成果與舊路徑 | [封存區](docs/archive/README.md) |
| 給 AI 工具的規則 | [AGENTS.md](AGENTS.md) |

## 本機使用

```powershell
npm install
npm run dev
```

`npm run dev` 只聽本機；要用同一個 Wi-Fi 的手機測試時改用 `npm run dev:lan`。提交前執行 `npm run build`，完整的檢查清單見 [工作流程與發布](docs/agents/workflow.md)。

## 授權

程式採 MIT；文件、圖面與照片採 CC BY 4.0；Google 衛星圖與以它為底的標註圖、校徽與 PVGIS 氣象資料屬第三方，不在授權範圍內。詳見 [LICENSE](LICENSE)。
