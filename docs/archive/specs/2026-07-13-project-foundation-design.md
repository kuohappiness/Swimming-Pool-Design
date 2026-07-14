# 中教大實小游泳池改建｜專案基礎架構設計

- 日期：2026-07-13
- 類型：design
- 狀態：completed
- 任務：legacy
- 目標版本：pre-0.2.0
- 完成日期：2026-07-13
- 適用範圍：文件治理、來源資料、專案 skill、參數模型、即時 3D Viewer 與版本流程

## 1. 目的

本設計建立專案後續工作的共同基礎，解決目前文件重複、狀態互相矛盾、DXF 與 HTML 各自保存幾何，以及舊版成果被誤當現行設計真相等問題。

專案採「資料驅動、單一幾何來源、Demo 優先、版本可追溯」原則。現階段以可取得的衛星圖、比例尺、手繪概念圖與使用者決策建立明確的概念設計基準，不等待正式丈量或 CAD。

## 2. 已確認的專案決策

1. 專案對象是國立臺中教育大學附設實驗國民小學游泳池翻修改建。
2. Google Maps 衛星圖中的黃色範圍是現有泳池基地。
3. 綠色範圍是既有廁所基地；既有設施不原樣保留，該基地納入新泳池規劃並重新改建。
4. 衛星圖中的指南針與比例尺是現階段基地方位和尺度基準。
5. 泳池大廳維持挑高，主要泳池面積優先。
6. 玻璃屋頂只覆蓋泳池大廳，不覆蓋端部服務量體。
7. 長邊玻璃牆、端部集中服務空間與公共空間可看見泳池，是手繪概念圖要保留的核心意圖。
8. 入口與樓梯的精確位置延後討論。
9. 男女更衣室的樓層、大小與進出方式延後討論。
10. Viewer、DXF 與尺寸表直接顯示明確的概念設計基準數字，不在每個數字旁標示「約」或「暫估」。
11. 來源、推導方式與修訂歷史保存在內部 metadata、來源清冊與版本紀錄。
12. 專案僅作個人概念規劃，不作施工、簽證或法規符合性聲明。
13. 第一階段只做可信的唯讀即時 3D Viewer，不做網頁內參數編輯器。
14. 第一階段使用 TypeScript、Three.js 與 Vite，不引入 React。

## 3. 非目標

第一階段不處理下列事項：

- 正式建照、施工圖或專業簽證成果。
- 在 Viewer 中直接修改尺寸或保存設計。
- 登入、多人協作、專案管理或雲端資料庫。
- BIM 編輯器、結構分析或機電模擬。
- 未經討論便固定入口、樓梯與更衣室配置。
- 因缺少正式 CAD 而停止概念設計。

## 4. 資料權威與衝突處理

### 4.1 權威順序

當資料互相衝突時，依下列順序處理：

1. 使用者最新明確決策。
2. 使用者確認過的專案設計基準。
3. 原始來源中可直接觀察的事實。
4. 由比例尺、方位或圖像推導的幾何。
5. 為完成概念模型而選定的設計基準值。

較新決策取代舊決策時，舊資料標記為 `superseded`，不可靜默刪除其歷史理由。

### 4.2 概念數字政策

對外顯示使用單一明確值，例如 `20.5 m`。內部參數同時保存：

- `value`：模型使用值。
- `unit`：單位。
- `source`：來源 ID。
- `basis`：user-confirmed、satellite-scale、image-inference 或 design-baseline。
- `revision`：首次採用或最後修改版本。

數字更新時只修改權威參數並重新產生所有輸出，不直接手改 DXF 或 Viewer 中的副本。

### 4.3 不合理概念的處理

手繪圖用來表達設計意圖，不視為精確比例。若空間、動線、屋頂、結構或使用關係不合理，先保留核心意圖，再提出可落實的修正版。涉及使用者尚未決定的重大空間關係，不自行定案。

## 5. 來源資料架構

原始圖檔可直接保存在公開 repo，保持原始位元內容，不裁切、不壓縮、不覆蓋：

```text
source-materials/
├─ site/
│  └─ SRC-SITE-001_google-maps-satellite-annotated.jpeg
└─ concepts/
   ├─ SRC-CONCEPT-001_side-section.jpeg
   ├─ SRC-CONCEPT-002_roof-plan.jpeg
   ├─ SRC-CONCEPT-003_ground-floor-plan.jpeg
   └─ SRC-CONCEPT-004_perspective.jpeg
```

`docs/02_SITE_AND_SOURCES.md` 保存每個來源的原檔名、來源、接收日期、SHA-256、影像尺寸、內容摘要、可支持的決策及限制。Google Maps 來源須保留鄰近且可讀的 attribution；未來若專案授權程式碼，第三方來源影像不自動受程式碼授權涵蓋。

## 6. 文件資訊架構

### 6.1 目標結構

```text
README.md
docs/
├─ 01_PROJECT_BRIEF.md
├─ 02_SITE_AND_SOURCES.md
├─ 03_DESIGN_BASIS.md
├─ 04_DECISIONS_AND_OPEN_ITEMS.md
├─ 05_MODEL_AND_VIEWER_CONTRACT.md
├─ 06_WORKFLOW_AND_VERSIONING.md
└─ specs/
   └─ 2026-07-13-project-foundation-design.md
```

### 6.2 唯一責任

| 文件 | 唯一責任 |
|---|---|
| `README.md` | 專案入口、目前狀態、最新 Demo、常用命令與文件導覽 |
| `01_PROJECT_BRIEF.md` | 目的、範圍、使用需求、非目標與成功標準 |
| `02_SITE_AND_SOURCES.md` | 基地、學校、方位、比例尺、來源清冊與證據限制 |
| `03_DESIGN_BASIS.md` | 已確認設計意圖、空間需求與現行概念基準值 |
| `04_DECISIONS_AND_OPEN_ITEMS.md` | confirmed、deferred、superseded 決策，待討論事項與仍相關風險 |
| `05_MODEL_AND_VIEWER_CONTRACT.md` | 參數 schema、座標、幾何、Viewer、DXF 與驗收契約 |
| `06_WORKFLOW_AND_VERSIONING.md` | 資料進件、修改、即時 Demo、驗證、版本封存與發布流程 |
| `docs/specs/` | 已核准的一次性設計與變更規格，不取代上列現行 owner 文件 |

同一項現行事實只能有一個 owner。其他文件只能連結，不得複製並各自維護狀態。

### 6.3 舊文件處理

現有七份規劃文件在內容完整遷移後移除，不另建立重複 archive；Git 歷史是舊文件的封存來源。現有 V02 根目錄／`downloads/` 成果與 `versions/V03` 成果保持原樣並標示為 legacy exploration，不再作為現行設計真相。

## 7. Repo-local 專案 Skill

### 7.1 結構

```text
.codex/
└─ skill/
   ├─ SKILL.md
   └─ references/
      ├─ source-intake.md
      ├─ document-ownership.md
      └─ model-validation.md
```

### 7.2 SKILL.md 責任

`SKILL.md` 保持精簡，只規定：

- 何時觸發專案工作流。
- 開始工作前的必讀順序。
- 資料權威與衝突處理。
- 不可靜默猜測重大未決空間關係。
- 所有幾何輸出必須來自單一模型來源。
- 修改後必須啟動或建置 Demo 並執行驗證。
- 文件、參數、版本紀錄與成果同步閘門。

詳細操作放入 references，設計事實留在 `docs/`，不得在 skill 中重複保存。

## 8. 參數模型與幾何架構

### 8.1 單一來源

```text
model/project-model.json
        ↓ schema validation
src/domain/model-schema.ts
        ↓
src/geometry/build-model.ts
        ↓ semantic scene model
        ├─ src/viewer/          → Three.js 即時 Viewer
        ├─ src/exporters/dxf/   → DXF
        ├─ src/exporters/data/  → 尺寸與版本資料
        └─ tests/visual/        → 固定視角截圖
```

`project-model.json` 保存設計值與 provenance。`build-model.ts` 是所有空間與幾何公式的唯一實作。Viewer 與 exporter 不得重新計算不同版本的屋頂、池底或空間位置。

### 8.2 座標

- 模型運算單位統一使用公尺。
- X、Y、Z 的正式方向必須在 `02_SITE_AND_SOURCES.md` 與模型 schema 中一致定義。
- 真北向量由 `SRC-SITE-001` 指南針校正後記錄。
- 畫面左、右不可作為屋頂方向的權威描述；使用方位、模型軸與入口關係描述。
- 在屋頂方向尚未校正前，現有 V03 的左低右高只屬 legacy 結果。

## 9. 即時 3D Viewer

### 9.1 第一階段能力

- 滑鼠與觸控旋轉、平移、縮放。
- 固定視角：透視、基地、入口、長邊、屋頂與剖面。
- 圖層開關：基地、泳池、池岸、屋頂、玻璃、服務量體、樓梯與註記。
- 顯示方位、比例、版本與明確設計尺寸。
- 桌面與手機均可使用。
- 修改參數或幾何程式後由 Vite 立即重新載入。
- 可建置為 GitHub Pages 使用的靜態 Demo。

### 9.2 第一階段限制

- Viewer 是唯讀呈現層，不擁有設計資料。
- 不在 Viewer 中編輯或保存參數。
- 不把 camera、UI visibility 等暫時狀態寫回模型。
- 不使用 React；介面以小型、獨立 TypeScript 模組實作。

### 9.3 錯誤處理

- schema 或幾何驗證失敗時顯示可讀的錯誤畫面，不渲染看似正常的舊模型。
- 缺少必要參數時停止建置並指出參數路徑。
- 非必要圖層失敗時可降級顯示，但必須在 Viewer 診斷區標示。
- GitHub Pages 只發布通過 build 與瀏覽器 smoke test 的成果。

## 10. 開發與版本流程

### 10.1 日常修改

1. 登錄新來源或決策。
2. 更新 owner 文件與權威參數。
3. 執行 schema、單元與幾何 invariant 檢查。
4. 以本機 Vite Viewer 即時檢視。
5. 執行固定視角 screenshot smoke。
6. 同步決策、open items 與變更摘要。

### 10.2 版本封存

日常小改不必每次產生完整平、立、剖 DXF 套件。只有建立可供比較的設計里程碑時才封存版本，版本內容至少包含：

- 參數快照與來源 revision。
- 靜態 Viewer build。
- 固定視角截圖。
- 變更摘要。
- 當期需要的 DXF 輸出。
- 已知限制與延後決策。

### 10.3 舊版相容

V02、V03 不回寫成新架構。第一個採新架構的版本另立里程碑，並在 README 清楚區分 legacy viewer 與 current viewer。

## 11. 驗證策略

### 11.1 文件

- 每個現行事實只有一個 owner。
- 連結有效，沒有指向已移除舊文件。
- 不保留與現行決策衝突的「暫估必須顯示」或「必須等待 CAD」規則。
- deferred 項目沒有被寫成 confirmed。

### 11.2 資料與幾何

- JSON schema 驗證單位、必要欄位、正值與 ID 格式。
- invariant 驗證屋頂只覆蓋泳池大廳、泳池在基地內、池岸不為負、玻璃與服務量體不互相穿透。
- 方位測試驗證真北、基地軸、入口與屋頂方向使用同一組座標定義。
- 所有 exporter 使用同一 semantic scene model。

### 11.3 Viewer

- TypeScript typecheck 與 production build 通過。
- 桌面與手機 viewport smoke 通過。
- Orbit、pan、zoom、固定視角與圖層開關可操作。
- 重要固定視角可產生 Playwright 截圖。
- GitHub Pages base path 下資源可正確載入。

### 11.4 Skill

- frontmatter、名稱與檔案結構通過 skill validator。
- 以真實任務驗證 skill 能正確讀取 owner 文件、拒絕舊版事實、要求 Demo 驗證並同步變更紀錄。

## 12. 遷移順序

1. 提交本 foundation design spec。
2. 使用者審閱並核准書面規格。
3. 匯入五張原始來源圖並建立來源清冊。
4. 建立六份 owner 文件並遷移仍有效內容。
5. 建立 repo-local skill 與三份 references。
6. 更新 README 並移除已完成遷移的舊七份文件。
7. 檢查連結、狀態、重複事實與 Git diff。
8. 建立 Viewer 與單一幾何來源的實作計畫。
9. 實作新架構並產生第一個 current milestone。

## 13. 完成標準

基礎架構完成時必須同時滿足：

- 五張來源圖已以固定 ID 保存並登錄。
- 六份 owner 文件沒有責任重疊。
- 已確認、延後與被取代事項可清楚區分。
- repo-local skill 通過驗證並能導引後續工作。
- 明確概念數字可追溯到來源或設計基準。
- Viewer、DXF 與尺寸資料可由同一模型來源產生。
- 修改後能立即看到本機 3D Demo。
- 穩定版本能建置並發布為 GitHub Pages。
