# 06｜工作流程與版本規範

## 1. 工作原則

```text
來源／使用者決策
        ↓
SITE_AND_SOURCES + DESIGN_BASIS + DECISIONS
        ↓
model/project-model.json
        ↓
 validator + tests
        ↓
參照圖集 → 可信 3D Viewer → DXF
        ↓
自動驗證＋手機／桌面視覺檢查
```

來源先入庫、決策先記錄、模型只改一處、Demo 即時預覽，驗證通過後才形成版本。

## 2. 新來源資料

1. 保留原始檔，不覆蓋既有來源。
2. 依 `SRC-<類型>-<序號>_<描述>.<副檔名>` 命名。
3. 記錄像素、格式、SHA-256、用途與限制。
4. 更新 [02_SITE_AND_SOURCES](02_SITE_AND_SOURCES.md)。
5. 若改變設計，另更新 DESIGN_BASIS 或 DECISIONS。

## 3. 設計變更

1. 判斷為 confirmed、working、deferred 或 legacy。
2. 更新唯一 owner 文件。
3. 關閉或新增 DEC／OPEN 記錄。
4. 修改 `model/project-model.json`。
5. 啟動本機 Demo 查看六張圖及 3D 軸測。
6. 執行驗證、測試及 build。
7. 人工檢查手機、北向、ID、男女分區、15＋5、樓梯與屋頂。
8. 提交一個範圍清楚的 Git commit。

## 4. 即時 Demo

首次安裝：

```powershell
npm install
```

啟動可由同網路手機查看的開發伺服器：

```powershell
npm run dev
```

只驗證模型與來源：

```powershell
npm run validate:reference
```

完整提交前檢查：

```powershell
npm run build
git diff --check
```

`npm run build` 已包含模型驗證及 `npm test`，靜態成果輸出至 `dist/reference/`。

## 5. 版本語意

- `modelVersion`：模型資料語意版本，例如 `0.1.0-atlas.1`。
- Git commit：每次可追溯的文件或程式變更。
- Git tag：可供他人穩定查看的完整里程碑。
- `versions/V02`、`versions/V03`：歷史快照，不延續為新模型版號。

PATCH 用於不改幾何意義的修正；MINOR 用於新空間或相容欄位；MAJOR 用於座標、單位或 schema 的不相容變更。

## 6. 文件所有權

| 內容 | 唯一 owner |
| --- | --- |
| 目的、範圍、成功條件 | `01_PROJECT_BRIEF.md` |
| 基地、方位、來源、雜湊 | `02_SITE_AND_SOURCES.md` |
| 當前數值與空間意圖 | `03_DESIGN_BASIS.md` |
| DEC、OPEN、取代與風險 | `04_DECISIONS_AND_OPEN_ITEMS.md` |
| schema、圖集、Viewer、DXF 契約 | `05_MODEL_AND_VIEWER_CONTRACT.md` |
| 收件、修改、發布與版本流程 | 本文件 |

## 7. 提交與發布門檻

- `npm run build` 通過。
- `git diff --check` 無錯誤。
- 文件連結有效、來源雜湊一致、confirmed 狀態沒有矛盾。
- 手機與桌面能切換六張圖、點選 ID 並閱讀資料。
- 人工確認真北、男女各 15＋5、樓梯雙梁與開放梯下、屋頂範圍與坡向。

## 8. 近期里程碑

1. Foundation：權威文件、來源圖與 repo-local skill。
2. Reference atlas：單一模型、六張參照圖、手機互動與驗證。
3. Trusted 3D viewer：Three.js 即時幾何、視角、圖層及 ID 定位。
4. Shared outputs：DXF、GitHub Pages 與端對端驗證。
