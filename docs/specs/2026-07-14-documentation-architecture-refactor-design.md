# 文件架構重構設計

- 日期：2026-07-14
- 類型：design
- 狀態：draft
- 審閱：設計方向已核准；書面規格待使用者審閱
- 任務：TASK-003
- 依據：使用者於 2026-07-14 核准文件架構重構方向
- 目標版本：0.2.0
- 範圍：README、權威文件、Active Work、契約、specs、release 記錄、legacy versions 與 repo-local skill 引用

## 1. 目的

建立一套能長期回答以下問題、且每個答案只有一個權威位置的文件系統：

1. 專案為什麼存在、包含什麼？
2. 目前有效的設計答案是什麼？
3. 為什麼做出這些決策，還有哪些問題沒有答案？
4. 模型、圖集及互動成果必須符合哪些契約？
5. 現在要做什麼、做到哪裡、下一步是什麼？
6. 已完成版本包含什麼、用什麼證據驗證？

本次重構不改變已確認的建築設計意圖、尺寸、模型幾何或輸出行為；它只重新建立文件責任、生命週期、導航與驗證。

## 2. 現況問題

現有 `01`～`06` 已建立良好的 owner 概念，但缺少執行狀態的唯一 owner，且部分文件混入其他生命週期的資訊：

- README 同時承擔入口、現況摘要、設計細節與所有 specs 導航，容易與 owner 文件漂移。
- `03_DESIGN_BASIS.md` 混入歷史數值與實作進度；其中「第一階段尚未實作」已與完成紀錄矛盾。
- `04_DECISIONS_AND_OPEN_ITEMS.md` 同時放置真正未決問題與修法已知但尚未執行的缺陷，例如 `OPEN-012`。
- `05_MODEL_AND_VIEWER_CONTRACT.md` 同時承擔模型、圖集、日照展示、未來 3D、DXF 與所有驗收，將隨輸出增加而持續膨脹。
- `06_WORKFLOW_AND_VERSIONING.md` 混合固定流程、文件治理、部署細節與近期里程碑。
- 已完成的服務核心實作計畫被追加新的第 11 節，使歷史紀錄重新變成 active plan。
- `docs/specs/` 平放 active、completed、superseded 與 release 文件，部分文件缺少日期或狀態欄。
- V02 Viewer 位於 repo 根目錄、DXF 位於 `downloads/`，但 V03 集中於 `versions/V03/`。
- 最新的 L1 入口標註圖尚未保存至 `source-materials/` 及來源清冊，`DEC-028` 缺少 repo 內可追溯的直接圖像證據。
- `.codex/skill/references/document-ownership.md` 與正式文件重複治理規則，存在雙重 owner。

## 3. 設計原則

### 3.1 一個問題、一個 owner

- 設計事實只在 design basis。
- 決策理由與未知問題只在 decisions/open items。
- 任務狀態只在 Active Work。
- 技術驗收只在 model/output contracts。
- 固定流程只在 workflow/releases。
- 已發布證據只在 release record。

其他文件只能保存穩定 ID、短上下文與連結，不複製完整內容。

### 3.2 分離內容類型與生命週期

- `DEC`：已確認或已被取代的決策。
- `OPEN`：答案尚未確定，仍需外部輸入或使用者決策。
- `TASK`：結果與修法已清楚、尚待執行或驗證的工作。
- `SPEC`：複雜任務的核准設計或實作計畫。
- `RELEASE`：發布後不可變的完成快照。

已知道怎麼修的缺陷不得繼續留在 `OPEN`；已完成的 implementation plan 不得重新追加 active 任務。

### 3.3 引用導航，不複製規格

`07_ACTIVE_WORK.md` 是薄型儀表板。它只擁有任務 ID、標題、狀態、目標版本、依賴、下一步及權威連結；設計內容與驗收細節仍由各 owner 文件負責。

### 3.4 只拆分已經具有獨立責任的內容

本次不建立一檔一 DEC、不導入外部任務系統，也不預先建立沒有實質內容的 3D／DXF 空文件。只有現行且已足夠複雜的圖集與日照展示契約會先拆出。

## 4. 目標結構

```text
README.md

docs/
├── 01_PROJECT_BRIEF.md
├── 02_SITE_AND_SOURCES.md
├── 03_DESIGN_BASIS.md
├── 04_DECISIONS_AND_OPEN_ITEMS.md
├── 05_MODEL_CONTRACT.md
├── 06_WORKFLOW_AND_RELEASES.md
├── 07_ACTIVE_WORK.md
│
├── contracts/
│   ├── reference-atlas.md
│   └── solar-study.md
│
├── governance/
│   └── DOCUMENT_OWNERSHIP.md
│
├── specs/                  # 只保留 active 規格
├── archive/
│   └── specs/              # completed／superseded 規格
└── releases/               # 已發布版本的不可變紀錄

source-materials/
├── site/
└── concepts/

versions/
├── README.md
├── V02/
└── V03/
```

未來開始實作可信 3D Viewer 或 DXF 時，才分別新增 `docs/contracts/3d-viewer.md` 或 `docs/contracts/dxf.md`。

## 5. 文件責任

| 文件 | 唯一責任 | 不得包含 |
| --- | --- | --- |
| `README.md` | 專案入口、快速啟動、公開成果、現行版本與 `07` 連結 | 完整設計事實、spec 清單、待修細節 |
| `01_PROJECT_BRIEF.md` | 目的、範圍、需求、非目標、成功條件 | 實作進度、版本任務 |
| `02_SITE_AND_SOURCES.md` | 基地證據、來源清冊、雜湊、署名、限制 | 設計結論的實作狀態 |
| `03_DESIGN_BASIS.md` | 目前有效的數值、狀態與空間意圖 | 歷史 Viewer 敘事、實作進度、待修清單 |
| `04_DECISIONS_AND_OPEN_ITEMS.md` | confirmed／superseded DEC、真正未決 OPEN、設計風險 | 已知修正工作的進度 |
| `05_MODEL_CONTRACT.md` | schema、座標、共用硬性規則、跨輸出不變量與頂層驗證 | 各頁面詳細 UI 契約、版本任務 |
| `contracts/*.md` | 單一輸出的行為、可及性及輸出專屬驗收 | 共用設計事實、任務狀態 |
| `06_WORKFLOW_AND_RELEASES.md` | 收件、設計變更、驗證、部署、版本與發布流程 | 近期里程碑、當前任務 |
| `07_ACTIVE_WORK.md` | active TASK 狀態、順序、依賴、下一步與引用導航 | 完整設計規格、重複驗收條文 |
| `docs/specs/` | active 任務所需的核准設計或實作計畫 | 已完成或被取代文件 |
| `docs/archive/specs/` | 完成／被取代規格的不可變歷史 | active 狀態 |
| `docs/releases/` | 已發布版本、驗證結果、commit 與發布範圍 | 未完成任務 |
| `docs/governance/` | 文件 owner、狀態語言、搬移與封存規則 | 專案設計事實 |

## 6. Active Work 契約

### 6.1 任務 ID

任務使用與版本無關的穩定 ID：`TASK-001`、`TASK-002`。任務延期時只修改 `目標版本`，不得重新命名 ID。

### 6.2 任務狀態

| 狀態 | 定義 |
| --- | --- |
| `queued` | 已接受，但尚有前置工作或尚未排入立即執行 |
| `ready` | 設計、依賴與驗收均清楚，可立即開始 |
| `in_progress` | 當前正在執行；同一時間最多一項 |
| `blocked` | 無法繼續，必須記錄阻擋原因與解除條件 |
| `done` | 實作與驗證完成，等待納入 release record |

### 6.3 任務欄位

`07_ACTIVE_WORK.md` 每項任務至少包含：

- `TASK ID`
- 一行成果名稱
- 狀態
- 目標版本
- 依賴 TASK
- 下一步
- 設計依據連結（DEC／OPEN／DESIGN_BASIS／SPEC）
- 驗收連結（MODEL CONTRACT／OUTPUT CONTRACT／SPEC）

任務表不得複製尺寸、長篇設計描述或完整驗收清單。

### 6.4 首次建表

0.2.0 初始任務固定為：

| ID | 成果 | 初始狀態 | 依據 |
| --- | --- | --- | --- |
| `TASK-001` | 太陽研究 180° 方位修正 | `ready` | `OPEN-012` 的已確認修正方向；重構時轉成正式 DEC |
| `TASK-002` | L1 戶外入口與廁所雙動線 | `ready` | `DEC-028` |
| `TASK-003` | 文件架構重構 | `in_progress` | 本規格 |
| `TASK-004` | 套件、模型與現行文件同步至 0.2.0 | `queued` | 依賴 `TASK-001`～`TASK-003` |
| `TASK-005` | 完整驗證與本機 release commit | `queued` | 依賴 `TASK-001`～`TASK-004` |

`OPEN-006`、`OPEN-008`～`OPEN-011` 維持未排程設計問題，只由 `07` 連回 `04`，不複製成 active TASK。

## 7. Specs 與 release 生命週期

### 7.1 規格 metadata

所有 active spec 開頭使用相同欄位：

```text
- 日期：YYYY-MM-DD
- 類型：design | implementation-plan
- 狀態：draft | approved | in_progress
- 任務：TASK-NNN
- 依據：DEC／OPEN／其他規格連結
```

封存規格的狀態只能是 `completed` 或 `superseded`，並需記錄完成／取代日期。

### 7.2 封存規則

- 任務完成後，design 與 implementation plan 一起移入 `docs/archive/specs/`。
- owner 文件吸收完成後仍有效的設計答案；archive spec 只保留理由與實作歷史。
- 完成文件移入 archive 後不可追加 active 章節。
- `2026-07-14-service-core-first-revision-implementation-plan.md` 的第 11 節移出成 0.2.0 active work／新 plan，原文件恢復為完成紀錄後封存。
- `2026-07-14-version-0.2.0-release-design.md` 的版本任務併入 `07_ACTIVE_WORK.md`；通用發布步驟由 `06` 管理，因此不保留第二份 active release checklist。

### 7.3 Release record

0.2.0 完成後建立 `docs/releases/0.2.0.md`，至少記錄：

- 發布日期
- package version、modelVersion、revision
- 完成的 TASK ID
- 主要 DEC／設計變更連結
- 驗證命令與結果
- release commit hash
- tag／push 狀態

release record 建立後，對應 `done` 任務由 `07` 移除；`07` 只保留下一個版本的 active work。

## 8. 現有文件遷移

### 8.1 README

- 保留專案一句話說明、概念用途聲明、快速啟動、公開 URL、現行 modelVersion／target version 及七份 owner 文件導航。
- 移除逐項設計現況與全部 specs 直連；active spec 從 `07` 進入，歷史規格從 release／archive 進入。

### 8.2 `01` 與 `02`

- `01_PROJECT_BRIEF.md` 原位保留，只移除任何未來出現的進度資訊。
- `02_SITE_AND_SOURCES.md` 原位保留。
- 將使用者最新的 1F 入口標註圖保存為 `SRC-CONCEPT-008_l1-outdoor-entries-annotated.png`，記錄像素、SHA-256、用途與限制，並讓 `DEC-028` 引用此來源。

### 8.3 `03`

- 保留當前幾何、L1、L2 及太陽研究基準。
- 移除實作進度敘述。
- 將已被取代的歷史數值移至 `04` 的 superseded／closed history；`03` 只保留目前有效答案。

### 8.4 `04`

- confirmed 與 superseded DEC 原位保留。
- OPEN 只保留答案尚未決定的項目。
- `OPEN-012` 的修正方向既已確定，重構時新增相應 DEC、將其移至 closed history，實作狀態由 `TASK-001` 管理。
- 風險表可保留，但控制方式必須引用 `02`、`03` 或 contracts，不重複完整規則。

### 8.5 `05` 與 contracts

- 將 `05_MODEL_AND_VIEWER_CONTRACT.md` 更名為 `05_MODEL_CONTRACT.md`。
- `05` 保留模型 schema、狀態、座標、跨輸出硬性規則及頂層 build gate。
- 圖集詳細契約移至 `docs/contracts/reference-atlas.md`。
- 日照展示詳細契約移至 `docs/contracts/solar-study.md`。
- 未來 3D／DXF 只在 `05` 保留最小介面承諾，直到各自成為 active TASK 才建立獨立 contract。

### 8.6 `06` 與 governance

- 更名為 `06_WORKFLOW_AND_RELEASES.md`。
- 保留來源收件、設計變更、Demo、CI、GitHub Pages、版本語意及發布門檻。
- 「近期里程碑」移至 `07`。
- 文件所有權細則移至 `docs/governance/DOCUMENT_OWNERSHIP.md`。
- `.codex/skill/SKILL.md` 改為引用正式 governance 文件，不再維護另一份規則。

### 8.7 specs

- 已完成的 foundation、atlas、GitHub Pages、solar-study design／plan 移入 `docs/archive/specs/`。
- 服務核心已完成 plan 在抽出第 11 節後移入 archive。
- 服務核心 design 在 `TASK-002` 完成前維持 active；完成後與新 plan 一起封存。
- 所有文件補齊一致 metadata。

### 8.8 legacy versions

- 新增 `versions/README.md`，說明 legacy 與 current model 的界線。
- 將根目錄 V02 `index.html` 與 `downloads/ZhongShiPool_V02_3D.dxf` 移至 `versions/V02/`。
- `versions/V03/` 保持原內容，只修正導航。
- Vite 現行 root 已是 `reference/`，因此 V02 搬移不得改變現行 build 輸入。

## 9. 文件驗證

新增 `scripts/check-docs.mjs` 與 `npm run check:docs`，至少驗證：

1. 所有本地 Markdown 連結存在。
2. `DEC`、`OPEN`、`TASK`、`SRC` ID 在各自命名空間唯一。
3. `07_ACTIVE_WORK.md` 任務狀態只使用核准集合，且最多一項 `in_progress`。
4. 每個 TASK 的設計依據與驗收連結存在。
5. `docs/specs/` 只包含 active 狀態；`docs/archive/specs/` 只包含 `completed`／`superseded`。
6. 每份 active spec 都被一個 TASK 引用。
7. README 只導航 owner 文件、Active Work、Demo、release／legacy 入口，不直接成為設計 owner。
8. source registry 與模型來源仍由既有 reference validator 驗證路徑、像素與 SHA-256。

`npm run build` 必須先執行 `npm run check:docs`，再執行模型驗證、測試與 Vite build。

## 10. 遷移順序

1. 保存本規格並取得使用者書面審閱核准。
2. 建立 governance、contracts、archive、releases 目錄與 `07_ACTIVE_WORK.md`。
3. 先填入 `TASK-001`～`TASK-005`，使所有後續動作都有 active owner。
4. 搬移 completed specs，抽出服務核心第 11 節，併入 0.2.0 release checklist。
5. 瘦身 README、`03`、`04`、`05`、`06`，更新所有引用。
6. 統一 V02／V03 legacy 位置。
7. 正式進件 `SRC-CONCEPT-008`，同步 source registry 與模型來源。
8. 建立 `check:docs`，修正所有斷鏈、metadata 與 ID 問題。
9. 執行 `npm run check:docs`、`npm run validate:reference`、`npm test`、`npm run build` 與 `git diff --check`。
10. 完成 `TASK-003` 後，再依 `07` 順序處理 0.2.0 的方位及 L1 入口實作。

## 11. 失敗與回復策略

- 每次搬移先確認所有引用來源，再使用 Git-aware move，避免複製後留下兩個 owner。
- 若某歷史 spec 仍是 live requirement 的唯一來源，先把有效內容移入 owner 文件再封存。
- 若 contract 拆分後無法判斷規則 owner，暫留 `05` 並記錄待分類，不得建立兩份相同規則。
- 若 `check:docs` 與既有 validator 對 source owner 判定衝突，以 `02_SITE_AND_SOURCES.md` 的證據責任及 `model/project-model.json` 的執行鏡像關係為準，修正 validator 而不複製資料。
- 文件重構不得修改幾何值；任何模型差異都視為失敗，必須在繼續 0.2.0 功能修正前排除。

## 12. 非目標

- 不把每個 DEC、OPEN 或 TASK 拆成單獨檔案。
- 不導入 Jira、Notion、資料庫或外部 issue tracker。
- 不為尚未開始的 3D／DXF 建立空白規格。
- 不在文件重構中修正太陽方位或 L1 幾何。
- 不刪除可解釋現有成果的歷史決策與完成紀錄。
- 不修改 source 原始圖像內容。

## 13. 完成條件

1. 回答「目前 0.2.0 還有哪些工作」只需讀取 `07_ACTIVE_WORK.md`。
2. 每一項 active TASK 都能沿連結到唯一設計 owner、規格及驗收契約。
3. README 不再重複設計現況或列出全部 specs。
4. `03` 不含實作進度，`04` 不含已知修正工作的進度。
5. `05` 與 output contracts 沒有重複條文。
6. completed specs 全部封存且不可被誤認為 active。
7. V02／V03 legacy 檔案位置一致且連結有效。
8. `SRC-CONCEPT-008` 可由 `DEC-028` 追溯。
9. `npm run check:docs`、完整 build 與 `git diff --check` 通過。
10. 文件重構前後的模型值與現行輸出行為完全相同。
