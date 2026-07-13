# 06｜工作流程與版本規範

## 1. 工作原則

每次設計修改都遵循同一條路徑：來源先入庫、決策先記錄、模型只改一處、Viewer 即時預覽、驗證通過後才形成版本。

```text
來源／使用者決策
        ↓
權威文件與 OPEN／DEC ID
        ↓
model/project-model.json
        ↓
幾何建置器
   ↙           ↘
3D Viewer      DXF
        ↓
自動驗證＋人工視覺檢查
```

## 2. 新來源資料

收到影像、尺寸、CAD 或文字決策時：

1. 保留原始檔，不直接覆蓋既有來源。
2. 依 `SRC-<類型>-<序號>_<描述>.<副檔名>` 命名。
3. 記錄像素／格式、SHA-256、來源、用途與限制。
4. 更新 [02_SITE_AND_SOURCES](02_SITE_AND_SOURCES.md)。
5. 若來源改變設計，另更新 DESIGN_BASIS 或 DECISIONS；來源文件本身不宣布設計定案。

細節見 [source-intake reference](../.codex/skill/references/source-intake.md)。

## 3. 設計變更

每個設計變更依序完成：

1. 判斷是新決策、工作值修訂、待決事項或歷史資料。
2. 更新正確 owner 文件，不在多份文件複製同一份狀態表。
3. 若 OPEN 項目得到答案，新增或更新 DEC 記錄，保留被取代說法。
4. 修改單一模型資料及 provenance revision。
5. 啟動本機 dev server，立即檢查 Viewer。
6. 產生靜態 Viewer 與 DXF。
7. 執行自動驗證與人工視覺檢查。
8. 提交一個範圍清楚的 Git commit。

## 4. 即時 Demo 流程

新 Viewer 實作後，標準開發介面應為：

```powershell
npm install
npm run dev
```

Vite dev server 在模型或程式變更後自動刷新，讓每次修改都能立即看到 3D 結果。可分享版本則使用：

```powershell
npm run build
npm run test
```

`build` 必須產生可直接靜態部署的 Viewer，`test` 必須包含資料與瀏覽器 smoke test。這些命令會在 Viewer 實作里程碑加入；本次文件基礎重構不先放置假的 package scripts。

## 5. 版本語意

模型版號與 repository tag 分工：

- `modelVersion`：模型資料語意版本，例如 `0.1.0`。
- Git commit：每次可追溯的文件或程式變更。
- Git tag：可供他人穩定查看的完整里程碑，例如 `v0.1.0`。
- `versions/V02`、`versions/V03`：既有歷史快照命名，保留但不延續為新系統的版號規則。

建議升版規則：

- PATCH：不改幾何意義的文字、樣式或修正。
- MINOR：加入已決策空間、Viewer 功能或新的相容資料欄位。
- MAJOR：座標、單位或 schema 的不相容變更。

## 6. 文件所有權

| 內容 | 唯一 owner |
| --- | --- |
| 目的、範圍、成功條件 | `01_PROJECT_BRIEF.md` |
| 基地、方位、來源、雜湊 | `02_SITE_AND_SOURCES.md` |
| 當前數值與空間意圖 | `03_DESIGN_BASIS.md` |
| DEC、OPEN、取代與風險 | `04_DECISIONS_AND_OPEN_ITEMS.md` |
| schema、Viewer、DXF、驗證契約 | `05_MODEL_AND_VIEWER_CONTRACT.md` |
| 收件、修改、發布及版本流程 | 本文件 |

跨文件只使用連結和短摘要。詳細規則見 [document-ownership reference](../.codex/skill/references/document-ownership.md)。

## 7. 提交與發布門檻

每次提交前：

- `git diff --check` 無錯誤。
- 文件連結有效，且沒有互相矛盾的 confirmed 狀態。
- 來源圖雜湊與登錄表一致。
- skill validator 通過。
- 若有模型或 Viewer：schema、單元測試、Playwright smoke 及 build 通過。
- 人工確認北向、玻璃屋頂範圍、主要尺寸及待決區域標示。

GitHub Pages 只發布通過上述門檻的靜態 `dist/`。公開 Demo 顯示對應 commit 與 modelVersion，避免使用者看到無法追溯的畫面。

## 8. 近期里程碑

1. Foundation：權威文件、來源圖、repo-local skill 與歷史版本標示。
2. Spatial decisions：完成入口、樓梯、更衣室及服務量體決策。
3. Model core：schema、單一 JSON、幾何 builder 與測試。
4. Trusted viewer：即時 3D、圖層、視角、北向、標註與錯誤狀態。
5. Shared outputs：DXF、靜態 build、GitHub Pages 與端對端驗證。
