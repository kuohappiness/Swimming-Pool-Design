# 架構

本文件說明 repo 的資料夾結構、每類檔案放哪裡、分層與路由、名詞對照與文件生命週期。資料夾或檔案位置有變動時，在同一個 PR 更新本文件（[DEC-147](decisions.md)）。

原 `docs/governance/DOCUMENT_OWNERSHIP.md` 的內容已於 2026-11-22 併入本文件第 2、8 節。

## 1. 資料夾結構

```text
Swimming-Pool-Design/
├─ README.md                 入口與「想知道什麼、讀哪一份」導覽表
├─ LICENSE                   程式 MIT；文件、圖面與照片 CC BY 4.0；第三方素材除外
├─ AGENTS.md                 給所有 AI 工具的規則；CLAUDE.md 只有一行 @AGENTS.md
├─ package.json、package-lock.json、tsconfig.json、vite.config.ts、eslint.config.js
├─ .stylelintrc.json、knip.json、.prettierrc.json、.prettierignore
├─ .editorconfig、.gitattributes、.gitignore、.ignore、.node-version
├─ .github/                  workflows/（ci.yml、deploy-pages.yml）、pull_request_template.md、dependabot.yml
├─ .claude/                  settings.json、skills/swimming-pool-design/
├─ .agents/                  skills/swimming-pool-design/（與 .claude 版本逐位元組相同）
├─ model/                    唯一的設計模型與分析登錄
├─ core/                     純邏輯，網站與工具共用
│  ├─ geometry/              active-geometry、drawing-geometry、site-orientation、mirror-geometry
│  ├─ solar/                 solar-reflection、pool-footprint、solar-angle-analysis、solar-energy-analysis
│  ├─ viewer/                viewer-data、render-budgets（3D 畫質分級與資產的成本上限）
│  └─ validation/            model-validation
├─ content/                  網站文案原始檔 design-concept.md、about.md；公開文字快照 website-copy.md
├─ drawings/
│  └─ current/               現行圖面 DRAW-*.svg，檔名不帶版號；PNG 由 build:drawings 產生，不入庫
├─ web/                      網站（Vite root），產出到 dist/web/
│  ├─ index.html             唯一的 HTML 入口
│  └─ src/
│     ├─ app/                bootstrap、app-shell、router、view-contract
│     ├─ design-system/      共用樣式
│     ├─ shared/             types.ts、assets/brand/
│     ├─ generated/          build:content 的產物，不入庫
│     └─ views/<view id>/    每個分頁一個資料夾；影像衍生檔放該頁的 assets/
├─ tools/                    命令列工具，不被網站匯入
│  ├─ section.mjs            只印文件的一節或一列（見 agents/workflow.md 第 5 節）
│  ├─ build/                 build-content、build-drawings、render-drawing-png、build-copy、clean-dist、
│  │                         build-textures；textures/ 放自製貼圖的產生程式，一張一檔
│  ├─ check/                 check-docs、check-model、check-assets；status-line、workflow-docs（狀態行與 roadmap、backlog 分節）、
│  │                         source-registry（來源表與模型 sources 一致）、
│  │                         legacy-status-docs.json（舊格式任務說明的凍結清單）
│  ├─ analysis/              solar-optimize
│  └─ capture/               capture-viewer-quality
├─ tests/
│  ├─ unit/                  core/、web/、tools/、docs/ 底下對應原始碼或文件位置的子資料夾
│  ├─ e2e/                   web.e2e.mjs、3d-viewer.e2e.mjs
│  └─ fixtures/              測試與工具讀取的固定資料
├─ source-materials/         原始來源，只增不改
│  ├─ site/                  衛星圖、標註圖、氣象資料、校徽；photos/ 校園場勘照片
│  └─ concepts/              概念圖與標註；hand-sketches/ 只放手繪稿
└─ docs/
   ├─ product.md             為什麼做、為誰做、範圍
   ├─ site-and-sources.md    基地與來源登錄
   ├─ design-basis.md        設計基準
   ├─ decisions.md           DEC、已關閉的舊 OPEN、設計風險
   ├─ backlog.md             待處理與已轉出的 OPEN
   ├─ roadmap.md             現在在哪裡、等觸發點、已完成
   ├─ architecture.md        本文件
   ├─ agents/                workflow.md（工作流程與發布）
   ├─ contracts/             model.md、drawings.md、solar-study.md、3d-viewer.md
   ├─ analysis/              專題分析
   ├─ tasks/                 任務說明，標題下寫狀態行；做完不搬
   ├─ releases/              發布紀錄
   └─ archive/               封存區：README.md（舊路徑對照、已刪除清單）、specs/、alternatives/、
                             analysis/、subprojects/、legacy-models/、deliverables/
```

`tests/fixtures/`、`docs/agents/quality.md`、`web/public/`、`source-materials/data/` 等資料夾在第一個檔案出現時才建立，屆時更新本節。

## 2. 每類資訊放哪裡

每一類資訊只有一個 owner。其他文件可以摘要，但必須連回 owner，且不得另設可漂移的狀態或完整答案。每件工作的狀態只寫在它入口（任務說明）的狀態行，`roadmap.md` 的狀態板照抄並由檢查比對；roadmap 不是設計知識庫。

| 資訊 | 唯一 owner |
| --- | --- |
| 專案目的、範圍、成功條件 | [product.md](product.md) |
| 基地、方位證據、來源、像素、雜湊 | [site-and-sources.md](site-and-sources.md) |
| 當前有效數值與空間意圖 | [design-basis.md](design-basis.md) |
| DEC、取代歷史、已關閉的舊 OPEN 與設計風險 | [decisions.md](decisions.md) |
| 尚無答案的 OPEN 與已轉出的去向 | [backlog.md](backlog.md) |
| 模型 schema、座標、溯源與跨輸出不變條件 | [contracts/model.md](contracts/model.md) |
| 工作路線、狀態行、連結、收件、驗證、部署、版本與發布流程 | [agents/workflow.md](agents/workflow.md) |
| 現在在做什麼、等觸發點的工作、已完成的工作 | [roadmap.md](roadmap.md) |
| 一件工作的狀態、規格、驗收與結果 | `docs/tasks/<任務>.md` 的狀態行與內文 |
| 資料夾結構、檔案位置、分層、路由、名詞與文件生命週期 | 本文件 |
| 專題分析的輸入、方法、比較表與限制 | `docs/analysis/<topic>.md` |
| 個別現行輸出行為 | `docs/contracts/<output>.md` |
| 2026-11-22 以前完成或被取代的舊格式規格 | `docs/archive/specs/`，不再新增 |
| 已發布版本證據 | `docs/releases/<version>.md` |
| 公開設計理念的敘事文字 | `content/design-concept.md` |
| 關於頁的說明、名詞解釋與常見問題 | `content/about.md`；名詞與問答只摘要 owner 文件的答案並連回去，不另立設計答案 |
| 公開網站各分頁的可見文字版本快照 | `content/website-copy.md`；屬衍生備份，不取代各頁資料 owner |
| 唯一的設計模型 | `model/project-model.json` |
| 原始來源檔 | `source-materials/`，登錄在 site-and-sources.md |
| 舊成果、過時索引與舊交付物 | `docs/archive/`，對照見 [archive/README.md](archive/README.md) |

README 只放定位、入口網址、現行版號與導覽表。repo 內的 skill 只保存工作程序並引用本文件，不複製 owner 對照表。

`content/website-copy.md` 由 `npm run build:copy` 讀取實際渲染頁面後產生，一個版本一份：只在發版 PR 改了 `package.json` 版號後重產，功能 PR 不動它（[DEC-200](decisions.md)）；不得手動維護第二份可漂移的內容。

## 3. 新檔案放哪裡

| 新增的東西 | 放在 |
| --- | --- |
| 網站與工具都會用到的運算 | `core/<領域>/` |
| 命令列工具 | `tools/build/`、`tools/check/`、`tools/analysis/` 或 `tools/capture/`；查文件的 `tools/section.mjs` 是唯一放在 `tools/` 根目錄的工具 |
| 新分頁 | `web/src/views/<view id>/`，步驟見第 5 節 |
| 分頁專用的影像 | `web/src/views/<view id>/assets/`，由 `source-materials/` 衍生 |
| 3D 的貼圖、模型、光照圖與音效 | `web/src/views/3d-viewer/assets/` 下的 `materials/<材質名>/`、`models/`、`lightmaps/`、`audio/`、`environments/`；只收轉檔後的 `.ktx2`、`.glb` 等格式，容量與命名由 `npm run check:assets` 把關（[DEC-190](decisions.md)）。每個檔都要登錄在同資料夾的 `asset-manifest.json` |
| 自製貼圖的產生程式 | `tools/build/textures/<貼圖名>.mjs`，並加進同資料夾的 `index.mjs`；`npm run build:textures` 轉成 `.ktx2` 後連同資產清單一起提交 |
| 共用的品牌素材 | `web/src/shared/assets/brand/` |
| 網站文案 | `content/<view id>.md` |
| 單元測試 | `tests/unit/` 下對應原始碼位置的子資料夾，檔名是受測模組名加 `.test.mjs` |
| 瀏覽器測試 | `tests/e2e/<對象>.e2e.mjs` |
| 使用者提供的原始來源 | `source-materials/site/` 或 `source-materials/concepts/`，命名與登錄見 [agents/workflow.md](agents/workflow.md) 第 2 節 |
| 任務說明 | `docs/tasks/<YYYY-MM-DD>-<主題>.md`，寫法見 [agents/workflow.md](agents/workflow.md) 第 2.4 節 |
| 專題分析 | `docs/analysis/<主題>.md` |

## 4. 分層與依賴方向

本專案分四層，依賴方向固定為 model → core → tools 與 web，上游不得反向引用下游。

| 層 | 資料夾 | 放什麼 | 可以引用 | 不得引用 |
| --- | --- | --- | --- | --- |
| 資料 | `model/` | 唯一機器可讀真相：`project-model.json`、`analysis-registry.json` | 無 | 任何程式 |
| 純邏輯 | `core/` | 幾何、日照、驗證、3D 資料等領域運算，不碰 DOM | `model/` | `web/`、`tools/`、`tests/` |
| 工具 | `tools/` | 命令列入口：build、check、analysis、capture | `core/`、`model/` | `web/`、`tests/` |
| 網站 | `web/` | 公開網站，Vite root，產出 `dist/web` | `core/`、`model/`、`drawings/current/`、`web/src/generated/` | `tools/`、`tests/`、`source-materials/` |

三個輸入與衍生資料夾：

- `content/`：公開文案的 Markdown 原始檔。由 `tools/build/build-content.mjs` 編譯到 `web/src/generated/`（`concept-content.json`、`about-content.json`），網站只讀編譯結果。文案裡的站內連結寫 `./` 或 `?view=<view id>`，`check:docs` 會比對路由登錄表。編譯結果不入庫，`npm install`、`dev`、`test`、`typecheck` 與 `build` 都會先自動產生。
- `drawings/current/`：現行圖面，由 `npm run build:drawings` 自模型產生，網站以原始 SVG 內嵌。SVG 入庫；同時產生的 PNG 需要瀏覽器才能轉出，不入庫。
- `source-materials/`：原始來源，只有 `tools/` 可讀。網站需要的影像必須先成為 `web/` 內的衍生檔，並在[基地與來源](site-and-sources.md)記下對應的來源編號、尺寸與雜湊。

規則：

1. 網站與工具都會用到的運算放 `core/`；只要用到 DOM 就不屬於 `core/`。
2. 會被 `web/` 引用的 `core/` 模組不得使用 Node 專屬 API。
3. 公開頁面上的數字一律由 `model/` 經 `core/` 或文案 token 取得，不在 `web/` 內手寫。
4. 依賴方向由 `eslint.config.js` 的 `no-restricted-imports` 把關，`npm run lint` 與 CI 會擋下違規。

現存例外：

- `core/solar/solar-angle-analysis.mjs`、`core/solar/solar-energy-analysis.mjs`、`core/validation/model-validation.mjs` 內含讀檔程式，只供 `tools/` 與 `tests/` 使用，不得被 `web/` 引用。

## 5. 路由與頁面

- **單一入口：** `web/index.html` 是唯一 HTML，建置產出 `dist/web/index.html`。CI 與部署流程會檢查 `dist/web/` 下不得出現各分頁自己的 `index.html`（DEC-125）。
- **網址：** `?view=<view id>`。首頁不帶參數；缺少或無效的 view 一律回到 `design-concept` 並移除無效參數。
- **路由登錄表：** `web/src/app/router.ts` 的 `viewIds` 與 `viewDefinitions` 是 view id、導覽標籤、分頁標題與順序的唯一來源，主導覽與 `document.title` 都由它產生。
- **殼層：** `web/src/app/app-shell.ts` 擁有頁首、主導覽、頁尾與主要內容容器。view 不得自行產生第二組導覽或頁尾。
- **頁面模組契約：** 每個 view 在 `web/src/views/<view id>/index.ts` 匯出 `mount(container)` 並回傳 `destroy()`。`bootstrap.ts` 以動態 import 載入，一次只掛載一個 view；切換分頁是整頁重新載入。

現行五個 view：

| view id | 導覽標籤 | 網址 |
| --- | --- | --- |
| `design-concept` | 設計理念 | `./` |
| `solar-study` | 日照研究 | `?view=solar-study` |
| `drawings` | 圖面設計 | `?view=drawings` |
| `3d-viewer` | 3D 展示 | `?view=3d-viewer` |
| `about` | 關於 | `?view=about` |

頁內狀態目前放在 hash：

- 設計理念：章節錨點，例如 `#concept-light`；載入後會扣掉頁首高度再捲動。
- 圖面：圖號，例如 `#REF-001`、`#V067-L1`。
- 3D：場景 id，`#overview`、`#light`、`#rain`、`#people`、`#time`。另接受 `quality`（`ultra`、`high`、`medium`、`saver`，舊連結的 `low` 視為 `saver`；優先於畫質選單記住的選擇），以及診斷用參數 `adaptive`、`rendering`、`water`、`batch`、`forceFallback`。
- 關於：章節錨點 `#about-<節 id>`（`project`、`reading`、`sources`、`glossary`、`faq`、`downloads`）與項目錨點 `#about-<節 id>-<序號>`；指到常見問題的某一題時會自動展開。

新增分頁的步驟：

1. 在 `router.ts` 的 `viewIds` 與 `viewDefinitions` 登錄。
2. 在 `bootstrap.ts` 的 `loaders` 加入動態 import。
3. 建立 `web/src/views/<view id>/`，含 `index.ts` 與 `view.css`；頁面有大段靜態 HTML 時另放 `template.html`（目前 `solar-study`、`3d-viewer` 有）。
4. 文案放 `content/<view id>.md`；分節的說明頁用 `<!-- section:id -->` 寫法，由 `compileSectionedContent` 編譯（關於頁是第一個例子）。
5. 更新測試與本文件的名詞對照表。

規則：

1. view id 用語意化的 kebab-case、不含版號，發布後不改名。
2. 站內連結一律用 `hrefForView()` 或相對的 `?view=` 連結，不寫死絕對網址。
3. 同一頁在導覽、標題與文件中只用一個名稱，以路由登錄表為準。

## 6. 名詞對照

頁名與 view id 以 `web/src/app/router.ts` 為準；`tests/unit/web/app/glossary.test.mjs` 會比對下表與路由登錄表。停用舊稱不再用於新文件、介面與程式。

頁名指路由登錄表的 `label`。`title` 是瀏覽器分頁的主標（例如重新定向、向光而轉、建築圖冊、走入建築、關於這個專案），不是頁名，文件與介面不得用它指稱頁面。

| 中文頁名 | 英文小標 | view id | 資料夾 | 停用舊稱 |
| --- | --- | --- | --- | --- |
| 設計理念 | DESIGN NARRATIVE | `design-concept` | `web/src/views/design-concept/` | — |
| 日照研究 | SOLAR STUDY | `solar-study` | `web/src/views/solar-study/` | 冬夏日照互動研究、日照互動研究 |
| 圖面設計 | DRAWING ATLAS | `drawings` | `web/src/views/drawings/` | 空間參照圖集、Reference Atlas、reference atlas、圖集、建築圖集 |
| 3D 展示 | SPATIAL EXPERIENCE | `3d-viewer` | `web/src/views/3d-viewer/` | 3D Viewer（僅指頁名；view id 與 `contracts/3d-viewer.md` 檔名不變） |
| 關於 | ABOUT | `about` | `web/src/views/about/` | 關於與資料 |

設計狀態用語：

| 介面與文件用語 | 模型與程式值 | 意思 |
| --- | --- | --- |
| 已確認 | `confirmed` | 使用者已確認的概念輸入，不代表已測量或經專業簽證 |
| 設計中 | `working` | 現行協調值，可供圖面與模型一致表達，仍可能修改 |
| 待專業確認 | `deferred` | 仍須取得法規、結構、機電、消防、無障礙或材料的專業答案，連到 backlog.md 的 OPEN |
| 歷史 | `legacy` | 只供版本比較，不得驅動現行輸出 |

定義以 [設計基準](design-basis.md) 第 1 節為準。

四個設計方向：

| 方向 | 設計理念頁錨點 | 3D 場景 id |
| --- | --- | --- |
| 向光而轉 | `concept-light` | `light` |
| 向雨而生 | `concept-rain` | `rain` |
| 向人而開 | `concept-people` | `people` |
| 向時間延續 | `concept-time` | `time` |

另有總覽場景 `overview`，對應錨點 `concept-title`。

同一功能只用一個名字的對照（網站、檢查與產生指令、檔名等）見 [資料夾架構規格](tasks/2026-11-21-folder-structure-migration-design.md) 第 4.1 節。

## 7. 命名規則

| 對象 | 規則 |
| --- | --- |
| 資料夾與程式檔 | 英文小寫加連字號；同一個功能只用一個名字 |
| 文件檔 | 英文小寫加連字號，內容用繁體中文 |
| 現行檔案 | 檔名不帶版號；版號只出現在發布紀錄、封存與已刪除清單 |
| 版號寫法 | 一律 `v0.6.7`（小寫 v 加三段數字） |
| npm 指令 | `lint`、`typecheck`、`test`、`build` 不加前綴；檢查類一律 `check:`，產生類一律 `build:`，不帶版號 |
| 原始來源 | `SRC-<類別>-<三位序號>_<英文描述>.<副檔名>`；既有檔不改名 |
| 圖面 | `DRAW-<圖號>.svg`，不帶版號 |
| 「site」一詞 | 只指基地（`SITE-XY`、`SRC-SITE-*`、`site-orientation`），不指網站 |

## 8. 文件生命週期

一件事從點子到完成的路線、每類文件的寫法、狀態行與連結，見 [工作流程與發布](agents/workflow.md)。本節只列分類與檢查。

### 8.1 分類

- `DEC`：已確認或已被取代的設計答案，以及改不回來、跨全專案的規則，在 decisions.md。
- `OPEN`：尚缺關鍵輸入，無法形成唯一答案的問題，在 backlog.md 的〈待處理〉；談成或做成任務後搬到〈已轉出〉。
- 任務說明：答案或修法已知、交付實作的工作，在 `docs/tasks/`，狀態寫在標題下的狀態行，做完不搬；roadmap 的狀態板照抄。`TASK-NNN` 編號接著用，寫在 roadmap 那一列的「工作」欄。
- `RELEASE`：已發布版本的不可變證據，在 `docs/releases/`。

修法已知的缺陷不得長期留在 OPEN。設計答案進 DEC，執行進任務說明。

### 8.2 2026-11-22 以前的舊格式

- roadmap〈已完成〉下方的舊任務表保留原文，狀態欄只用 `queued`、`ready`、`in_progress`、`blocked`、`done`；舊的平行開發例外（DEC-120）仍由檢查器驗證舊表。
- `docs/archive/specs/` 的舊規格保留日期、類型、狀態、任務、目標版本、完成日期等欄位，只修斷鏈或明顯文字錯誤，不改寫當時決策；清單在 `tools/check/legacy-status-docs.json`，不再新增。

### 8.3 檢查

`npm run check:docs` 檢查本地 Markdown 連結、ID 宣告（OPEN 只能在 backlog.md，TASK 編號不重複）、任務說明的狀態行、roadmap 三節與狀態板是否和狀態行一致、backlog 兩節與「→」的格式、舊格式規格的欄位，以及 `.claude/skills/` 與 `.agents/skills/` 兩份 skill 是否逐位元組相同。模型來源檔案與雜湊另由 `npm run check:model` 檢查。
