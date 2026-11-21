# 資料夾架構與命名統一設計

- 日期：2026-11-21
- 類型：design
- 狀態：approved
- 任務：TASK-107～TASK-110
- 目標版本：repository structure（不另發版）
- 核准：使用者 2026-11-21 21:45（台北時間）於專案對話同意全部建議
- 決策：[DEC-147](../04_DECISIONS_AND_OPEN_ITEMS.md)
- 逐檔清單：[資料夾架構調整清單](2026-11-21-folder-structure-migration-inventory.md)

## 1. 目標

1. 每個頂層資料夾只有一種用途，名稱與實際內容一致。
2. 同一個功能在 repo 內只用一個名字；和使用者另一個 repo Essence 功能相同的文件使用相同檔名。
3. 現行檔名不帶版號；舊版成果從現行版本移除，但 Git 歷史完整保留。
4. 依賴方向可由檢查程式把關：`model/` → `core/` → `tools/` 與 `web/`。
5. 文件結構與工作流程對齊 Essence 2026-11-21 上線的寫法（`docs/agents/workflow.md`）。

## 2. 不變的事

- 建築設計、模型數值、幾何雜湊、日照分析結果。
- 公開網址與 view id：`/`、`?view=solar-study`、`?view=drawings`、`?view=3d-viewer`（[DEC-125](../04_DECISIONS_AND_OPEN_ITEMS.md)）。
- `DEC`、`OPEN`、`TASK`、`SRC` 編號；原始來源的檔名、內容與 SHA-256。
- Git 歷史：不改寫、不 force push。26 份發布紀錄記錄的 commit 編號必須持續有效。
- 封存文件（`docs/archive/`）與發布紀錄（`docs/releases/<version>.md`）的內文不改寫；只修正 `check:docs` 會驗證的 Markdown 連結。

## 3. 目標結構

四項任務全部合併後的結構如下。`source-materials/data/`、`source-materials/regulations/`、`web/public/` 等資料夾在第一個檔案出現時才建立。

```text
Swimming-Pool-Design/
├─ README.md                 入口與「想知道什麼、讀哪一份」導覽表
├─ LICENSE                   授權（由使用者選定）
├─ AGENTS.md                 給所有 AI 工具的規則：底線、開工前、Code Review Rules
├─ CLAUDE.md                 只有一行 @AGENTS.md
├─ package.json、package-lock.json、tsconfig.json、vite.config.ts
├─ .editorconfig、.gitattributes、.gitignore、.ignore、.node-version
├─ .github/                  workflows/（ci.yml、deploy-pages.yml）、pull_request_template.md
├─ .claude/                  settings.json（雲端開工自動安裝相依套件）、skills/swimming-pool-design/
├─ .agents/                  skills/swimming-pool-design/（與 .claude 版本內容相同，由檢查確認）
├─ model/                    唯一的設計模型與分析登錄
├─ core/                     純邏輯，網站與工具共用
│  ├─ geometry/              active-geometry、drawing-geometry、site-orientation
│  ├─ solar/                 solar-reflection、solar-angle-analysis、solar-energy-analysis
│  ├─ viewer/                viewer-data
│  └─ validation/            model-validation
├─ content/                  網站文案原始檔 design-concept.md、公開文字快照 website-copy.md
├─ drawings/
│  └─ current/               現行圖面 DRAW-*.svg，檔名不帶版號
├─ web/                      網站（Vite root），產出到 dist/web/
│  ├─ index.html
│  └─ src/
│     ├─ app/                bootstrap、app-shell、router、view-contract
│     ├─ design-system/      共用樣式
│     ├─ shared/             types.ts、assets/brand/
│     ├─ generated/          build:content 的產物（TASK-109 起不入庫）
│     └─ views/<view id>/    每個分頁一個資料夾：index.ts、view.css、template.html，加該頁自己的模組
├─ tools/                    命令列工具，不被網站匯入
│  ├─ build/                 build-content、build-drawings、render-drawing-png、build-copy、clean-dist
│  ├─ check/                 check-docs、check-model
│  ├─ analysis/              solar-optimize
│  └─ capture/               capture-viewer-baseline、capture-viewer-quality（程式碼品質工作之後取代）
├─ tests/
│  ├─ unit/                  core/、web/ 底下對應原始碼位置的子資料夾
│  ├─ e2e/                   web.e2e.mjs、3d-viewer.e2e.mjs
│  └─ fixtures/              仍在使用的測試資料
├─ source-materials/         原始來源，只增不改
│  ├─ site/                  衛星圖、標註圖、氣象資料、校徽；photos/ 校園場勘照片
│  └─ concepts/              概念圖與標註；hand-sketches/ 只放手繪稿
└─ docs/
   ├─ product.md             為什麼做、為誰做、範圍（原 01）
   ├─ site-and-sources.md    基地與來源登錄（原 02）
   ├─ design-basis.md        設計基準（原 03）
   ├─ decisions.md           DEC 與設計風險（原 04 §1、§3、§4）
   ├─ backlog.md             OPEN 與未排程問題（原 04 §2、07 §27）
   ├─ roadmap.md             進度（原 07）
   ├─ architecture.md        資料夾結構、每類檔案放哪裡、名詞對照、依賴規則（併入原 DOCUMENT_OWNERSHIP）
   ├─ agents/                workflow.md（原 06）、quality.md（檢查指令與模型分工）
   ├─ contracts/             model.md（原 05）、drawings.md、solar-study.md、3d-viewer.md
   ├─ analysis/              專題分析
   ├─ tasks/                 任務說明（原 specs/）
   ├─ releases/              發布紀錄
   └─ archive/               封存區：README.md（舊路徑對照、已刪除清單）、specs/、alternatives/、
                             analysis/、subprojects/、legacy-models/、deliverables/
```

## 4. 命名規則

| 對象 | 規則 |
| --- | --- |
| 資料夾與程式檔 | 英文小寫加連字號；同一個功能只用一個名字 |
| 文件檔 | 英文小寫加連字號，內容用繁體中文；功能與 Essence 相同的文件用相同檔名 |
| 現行檔案 | 檔名不帶版號；版號只出現在發布紀錄、封存與已刪除清單 |
| 版號寫法 | 一律 `v0.6.7`（小寫 v 加三段數字） |
| npm 指令 | 標準四項 `lint`、`typecheck`、`test`、`build` 不加前綴；檢查類一律 `check:`，產生類一律 `build:`，不帶版號 |
| 分頁 | `web/src/views/<view id>/`，固定 `index.ts`、`view.css`、`template.html`；原本各頁的 `main.ts`、`styles.css` 保留原名 |
| 測試 | 放在 `tests/unit/` 對應原始碼位置的子資料夾，檔名是受測模組名加 `.test` |
| 原始來源 | `SRC-<類別>-<三位序號>_<英文描述>.<副檔名>`；既有檔不改名，新檔副檔名用 `.jpg` |
| 圖面 | `DRAW-<圖號>.svg`，不帶版號 |
| 「site」一詞 | 只指基地（`SITE-XY`、`SRC-SITE-*`、`site-orientation`），不指網站 |

### 4.1 同一功能、不同名稱的統一

| 功能 | 現在的名字 | 統一為 |
| --- | --- | --- |
| 網站 | `reference`、reference atlas、`public`、`site` | `web` |
| 圖面頁 | `drawings`、`reference-atlas`、`drafts`、空間參照圖集 | `drawings`，中文「圖面」 |
| 模型檢查 | `validate:reference`、`validate-reference-model`、`reference-validation`、`reference-model.test` | `check:model`、`check-model`、`model-validation`、`model.test` |
| 圖面幾何 | `reference-geometry` | `drawing-geometry` |
| 檢查類指令 | `check:`、`validate:`、`verify:` | `check:` |
| 產生類指令 | `build:`、`generate-`、`render-`、`drawings:`、`analyze:`、`capture:copy` | `build:` |
| 網站文案 | `docs/public`、`website-copy-v1.0`、`build-public-content`、`capture-public-copy` | `content/`、`website-copy`、`build-content`、`build-copy` |
| 3D 分頁 | `3d-viewer`、`viewer-*`、`walkthrough-*` | 資料夾與測試用 view id `3d-viewer`，漫遊在它底下的 `walkthrough/` |
| 分頁範本 | `viewer-template.html`、`legacy-template.html` | `template.html` |
| 端對端測試 | `scripts/*-e2e.mjs` | `tests/e2e/*.e2e.mjs` |
| 校徽 | `site-emblem-header.png` | `school-emblem-header.png` |

### 4.2 文件改名

| 現在 | 改為 | 對照 |
| --- | --- | --- |
| `01_PROJECT_BRIEF.md` | `product.md` | Essence、ArchiSitus 同名 |
| `02_SITE_AND_SOURCES.md` | `site-and-sources.md` | 本 repo 特有 |
| `03_DESIGN_BASIS.md` | `design-basis.md` | 本 repo 特有 |
| `04_DECISIONS_AND_OPEN_ITEMS.md` | `decisions.md` 與 `backlog.md` | Essence 同名 |
| `05_MODEL_CONTRACT.md` | `contracts/model.md` | 與其他輸出契約放在一起 |
| `06_WORKFLOW_AND_RELEASES.md` | `agents/workflow.md` | Essence 同名同位置 |
| `07_ACTIVE_WORK.md` | `roadmap.md` | Essence 同名 |
| `governance/DOCUMENT_OWNERSHIP.md` | 併入 `architecture.md` | Essence、ArchiSitus 同名 |
| `contracts/reference-atlas.md` | `contracts/drawings.md` | 與 view id 一致 |
| `specs/` | `tasks/` | Essence 同名 |

閱讀順序原本由 01～07 的編號提供，改由 README 的導覽表與 `architecture.md` 提供。

## 5. 分四次合併

每項任務一個 PR，依序合併。使用者核准後才合併；合併前若 `main` 有新的提交，先把 `main` 併進分支並重跑檢查。四項都合併前，其他工作不對現有檔案開大型 PR，以免衝突。

### 5.1 TASK-107 搬移 A：程式

開工前提：程式碼品質工作的「PR 自動檢查」已合併到 `main`，搬移 A 的 PR 才有自動檢查可依。

範圍：[清單](2026-11-21-folder-structure-migration-inventory.md)「TASK-107」一節列出的 167 個檔案，以及指向它們的程式字串、設定與現行文件。

commit 切法：

1. **只搬**：全部用 `git mv`，不改內容，讓 Git 能認出每個檔案的歷史。
2. **修路徑**：import 路徑、程式內計算 repo 根目錄的層數（`tools/check/` 比 `scripts/` 深一層）、`vite.config.ts` 的 root 與 outDir（`dist/web`）、`tsconfig.json` 的 include、`package.json` 指令（改名見 §4）、`.github/workflows/` 內的路徑、`model/analysis-registry.json` 內的測試路徑，以及現行文件內提到的路徑與 Markdown 連結。
3. **依賴方向規則**：留給程式碼品質工作加入 ESLint `no-restricted-imports`，規則與搬移同時生效。`web/src/views/drawings/sheets.ts` 以 `new URL` 讀取 `source-materials/site/SRC-SITE-001` 是目前唯一的違規，先列為暫時例外，TASK-109 改用衍生檔後移除。

不做：拆分混合型檔案、改成 TypeScript、路徑別名、合併樣式檔、刪除任何檔案、任何會改變畫面或輸出的修改。

驗收：

- `npm run build` 通過，包含文件連結、模型雜湊、單元測試與型別檢查；通過的測試數與搬移前相同。
- `git diff -M --stat main` 顯示每個搬移的檔案都被認成改名。
- 搬移前後各 build 一次，`dist/web/` 與原 `dist/reference/` 的檔案數相同；除檔名與雜湊外，內容只有路徑字串不同。
- 四個分頁在桌機（1440 × 900）與手機（390 × 844）寬度的截圖，與搬移前逐像素相同。
- 部署後首頁與三個 `?view=` 網址逐一開啟正常。

### 5.2 TASK-108 搬移 B：文件與舊成果

範圍：[清單](2026-11-21-folder-structure-migration-inventory.md)「TASK-108」一節，以及：

1. **文件改名**：照 §4.2。04 的 §2（尚待精化）與 07 的 §27（未排程設計問題）移到 `backlog.md`；其餘內容原文保留。
2. **`architecture.md`**：新增，內容是目標結構、「每類檔案放哪裡」、「新檔案放哪裡」、名詞對照表與依賴規則。原 `DOCUMENT_OWNERSHIP.md` 的 owner 對照表併入。分層與路由兩節由設計架構工作撰寫；名詞對照表的欄位是中文頁名、英文小標、view id、資料夾、停用舊稱，頁名與 view id 以程式內的路由登錄表為準。
3. **檢查程式**：`tools/check/check-docs.mjs` 內寫死的文件路徑、OPEN 的宣告位置（改讀 `backlog.md`）、規格資料夾（`docs/tasks/`）同步修改；讀取文件路徑的測試一起修改。另加一項檢查：`.claude/skills/` 與 `.agents/skills/` 兩份 skill 逐位元組相同。
4. **舊成果**：`versions/` 搬到 `docs/archive/legacy-models/`，`deliverables/` 搬到 `docs/archive/deliverables/` 並改英文檔名，`docs/subprojects/` 搬到 `docs/archive/subprojects/`，封存規格內的兩張 SVG 搬到 `docs/archive/specs/assets/`。
5. **刪除**：舊版圖面 `reference/drafts/v0.5.0`～`v0.6.6`（82 檔、約 7.0 MB）、一次性腳本 `generate-v063-l2-review.mjs`、`.nojekyll`。每一項在 `docs/archive/README.md` 的已刪除清單寫下原路徑與刪除前的 commit 連結。
6. **場勘照片**：`SRC-CONCEPT-012`～`017` 搬到 `source-materials/site/photos/`，編號、檔名、雜湊不變；`site-and-sources.md` 的登錄路徑同步修改。
7. **入口**：README 改成導覽表，只寫現行版號；`AGENTS.md` 改寫（底線置頂、開工前、資料夾與依賴規則的連結、必跑的檢查、Code Review Rules，原推理強度設定保留為一節），`CLAUDE.md` 只有一行 `@AGENTS.md`；`.codex/skill/` 改為 `.claude/skills/swimming-pool-design/` 與 `.agents/skills/swimming-pool-design/`；`docs/releases/README.md` 加各版索引並註明 0.8.1 跳號。
8. **設定檔**：`.editorconfig`、`.gitattributes`、`.ignore`（讓搜尋工具略過 `docs/archive/`）、`.gitignore` 清理、`.github/pull_request_template.md`（含「結構有變動時已更新 docs/architecture.md」）、`.claude/settings.json`（雲端開工自動 `npm ci`）、`LICENSE`（使用者選定授權後加入）。
9. **`docs/archive/README.md`**：舊路徑對照表與搬移前的 commit 連結，註明封存文件內的舊路徑不改寫。

驗收：`npm run build` 通過；`git grep` 在現行文件與程式內找不到 01～07、`DOCUMENT_OWNERSHIP`、`reference/`、`scripts/`、`versions/` 等舊路徑（封存與發布紀錄除外）；兩份 skill 一致。

### 5.3 TASK-109 瘦身與資產

範圍與分工：

1. 刪除 `tests/visual-baselines/v0.6.7/` 的 14 張 PNG；讀取它們的兩個測試在同一個 PR 移除（程式碼品質工作撰寫）。`baseline-report.json` 先搬到 `tests/fixtures/`，等 3D 的幀率比較改用繪製次數預算後再刪。
2. 刪除 `tests/visual-baselines/v0.9.0-pre-unification/`（7 檔），`verify:v090-baseline`、`verify:v091-baseline` 與 `tools/check/verify-v090-baseline.mjs` 一起退場，由鏡面與日照的不變量測試取代（程式碼品質工作確認）。
3. `web/src/generated/` 與 `drawings/current/*.png` 改為不入庫，由 `prepare`、`predev`、`pretest` 與 `build:drawings` 產生。
4. 圖面頁的衛星底圖改用壓縮後的衍生檔，放在 `web/src/views/drawings/assets/`，並記錄對應的 `SRC-SITE-001`；網站不再直接讀取 `source-materials/`，依賴規則的暫時例外移除。
5. 每一項刪除都記入 `docs/archive/README.md` 的已刪除清單。

驗收：`npm run build` 與 e2e 通過；網站產出由約 8.3 MB 降到 5 MB 以下；圖面頁底圖由使用者目視確認可接受。

### 5.4 TASK-110 工作流程對齊

比照 Essence 的 `docs/agents/workflow.md`：

1. `docs/agents/workflow.md` 改寫成路線、每類文件、入口的狀態行、連結、只讀需要的那一段五節。
2. 新的任務說明在標題下第一行寫 `狀態：<值>｜下一步：<一句>｜等誰：<值>`；完成時寫 `狀態：已合併｜完成：<一句>｜等誰：—`。2026-11-21 以前的文件列入凍結清單，照舊格式。
3. `roadmap.md` 固定三節：現在在哪裡、等觸發點、已完成。105 筆舊任務原文留在〈已完成〉下方，不搬、不改。
4. `backlog.md` 固定兩節：待處理、已轉出；轉出的項目不刪，加一行 `→ <下一站>（日期）`。
5. 新的任務說明完成後不搬到封存，只改狀態行；只有改不回來或跨全專案的事才編 DEC，其他小事記在任務說明並寫「使用者某日同意」。
6. 移植 Essence 的 `section` 工具（印出單一標題的內容與行號）與狀態行檢查；`AGENTS.md` 加上「長文件只讀需要的那一段」。決策索引由工具從條目產生。`roadmap-sync`（自動產生〈已完成〉）等新格式實際用過幾件任務後再評估。

驗收：`check:docs` 檢查狀態行格式、roadmap 三節與 backlog 兩節；`node tools/section.mjs docs/decisions.md <標題>` 可印出單一節。

## 6. 風險與處理

| 風險 | 處理 |
| --- | --- |
| 搬移期間其他工作修改同一批檔案，產生大量衝突 | TASK-107、TASK-108 合併前，其他工作不對現有檔案開大型 PR |
| 搬移被誤認成內容修改，失去檔案歷史 | 「只搬」與「修路徑」分開 commit；驗收要求 Git 認出改名 |
| 程式計算 repo 根目錄的層數改變後讀錯檔 | 每支搬到不同深度的程式逐一檢查；`npm run build` 與 e2e 會讀到所有路徑 |
| 開發機是 Windows：大小寫或中文檔名在不同系統表現不同 | 只用全新的小寫英文路徑，不做只改大小寫的改名；skill 兩份實體檔加一致性檢查，不用符號連結 |
| 外部連到 GitHub 檔案頁的網址失效 | 網站內唯一的此類連結指向 `docs/analysis/solar-analysis.md`，路徑不變 |
| Git 歷史仍保留已刪除的大檔，repo 下載量不會變小 | 已知限制；不改寫歷史是為了保住發布紀錄的 commit 連結 |

## 7. 分工

| 工作 | 與本規格的關係 |
| --- | --- |
| 資料夾架構（本規格） | TASK-107～TASK-110 的實作與 PR |
| 程式碼品質 | PR 自動檢查（TASK-107 開工前提）、依賴方向規則、TASK-109 的測試刪除與指令退場、`docs/agents/quality.md` |
| 整體設計架構 | `architecture.md` 的分層與路由兩節、名詞對照表的用語審查 |
| 資料正確性 | 來源登錄的路徑變更確認 |
| 網頁樣式、3D、新增主題 | 在新結構上進行；路徑以本規格為準 |

開工模型：任務說明用 Opus 5.5 xhigh；實作用 Opus 5.5 high；照清單的機械工作用 medium。
