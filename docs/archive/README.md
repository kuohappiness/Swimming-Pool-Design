# 封存區

本資料夾保存不再是現行真相的歷史資料。封存文件與發布紀錄內提到的舊路徑不改寫，只修正 `npm run check:docs` 會驗證的 Markdown 連結；要看舊路徑當時的檔案，用下方表格的 commit 連結。

| 子資料夾 | 內容 |
| --- | --- |
| `specs/` | 已完成或被取代的設計與實作計畫；`specs/assets/` 是規格內引用的圖 |
| `alternatives/` | 未採用的備選方案 |
| `analysis/` | 過時的專題分析 |
| `subprojects/` | 3D 擬真與 Walkthrough 兩個子專案的舊索引 |
| `legacy-models/` | V02、V03 早期模型與 Viewer（原 `versions/`） |
| `deliverables/` | 舊交付物 |

## 1. 舊路徑對照

2026-11-22 依 [DEC-147](../decisions.md) 調整資料夾結構。逐檔對照見 [搬移清單](../tasks/2026-11-21-folder-structure-migration-inventory.md)。

程式搬移（TASK-107），搬移前的版本是 [a568800](https://github.com/kuohappiness/Swimming-Pool-Design/tree/a568800a2418de6af486d34280f68f43b90333c3)：

| 舊路徑 | 新路徑 |
| --- | --- |
| `reference/index.html`、`reference/src/` | `web/index.html`、`web/src/`（各分頁在 `web/src/views/<view id>/`） |
| `reference/generated/` | `web/src/generated/` |
| `reference/drafts/v0.6.7/DRAW-*-v0.6.7.*` | `drawings/current/DRAW-*.*` |
| `scripts/` 的純邏輯 | `core/geometry/`、`core/solar/`、`core/viewer/`、`core/validation/` |
| `scripts/` 的命令列工具 | `tools/build/`、`tools/check/`、`tools/analysis/`、`tools/capture/` |
| `scripts/*-e2e.mjs` | `tests/e2e/*.e2e.mjs` |
| `tests/*.test.mjs` | `tests/unit/` 下對應原始碼位置的子資料夾 |
| `docs/public/swimming-pool-renovation-design-concept.md` | `content/design-concept.md` |
| `docs/public/website-copy-v1.0.md` | `content/website-copy.md` |
| `dist/reference/` | `dist/web/` |

文件與舊成果搬移（TASK-108），搬移前的版本是 [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/tree/c614023f662c8309f07ec9521cab7036aec67dde)：

| 舊路徑 | 新路徑 |
| --- | --- |
| `docs/01_PROJECT_BRIEF.md` | `docs/product.md` |
| `docs/02_SITE_AND_SOURCES.md` | `docs/site-and-sources.md` |
| `docs/03_DESIGN_BASIS.md` | `docs/design-basis.md` |
| `docs/04_DECISIONS_AND_OPEN_ITEMS.md` | `docs/decisions.md`；第 2 節「尚待精化」移到 `docs/backlog.md` |
| `docs/05_MODEL_CONTRACT.md` | `docs/contracts/model.md` |
| `docs/06_WORKFLOW_AND_RELEASES.md` | `docs/agents/workflow.md` |
| `docs/07_ACTIVE_WORK.md` | `docs/roadmap.md`；「未排程設計問題」的 OPEN 清單移到 `docs/backlog.md` |
| `docs/governance/DOCUMENT_OWNERSHIP.md` | 併入 `docs/architecture.md` |
| `docs/contracts/reference-atlas.md` | `docs/contracts/drawings.md` |
| `docs/specs/` | `docs/tasks/` |
| `docs/subprojects/` | `docs/archive/subprojects/` |
| `docs/archive/specs/*.svg` | `docs/archive/specs/assets/*.svg` |
| `versions/README.md`、`versions/V02/`、`versions/V03/` | `docs/archive/legacy-models/README.md`、`v02/`、`v03/` |
| `deliverables/游泳池改建設計理念介紹.docx` | `docs/archive/deliverables/design-concept-introduction.docx` |
| `.codex/skill/` | `.claude/skills/swimming-pool-design/`，另有相同的一份在 `.agents/skills/swimming-pool-design/` |
| `source-materials/concepts/hand-sketches/SRC-CONCEPT-012`～`017`（校園場勘照片） | `source-materials/site/photos/`，編號、檔名與雜湊不變 |

瘦身與資產（TASK-109），搬移前的版本是 [cb20ea8](https://github.com/kuohappiness/Swimming-Pool-Design/tree/cb20ea8d2d2db8754e83efb322669db1ab84a5b5)：

| 舊路徑 | 新路徑 |
| --- | --- |
| `tests/visual-baselines/v0.6.7/baseline-report.json` | `tests/fixtures/v0.6.7-viewer-baseline-report.json` |
| 圖面頁底圖直接讀 `source-materials/site/SRC-SITE-001_google-maps-satellite.png` | 衍生檔 `web/src/views/drawings/assets/site-satellite.jpg`，原始檔不動 |

## 2. 已刪除清單

下列檔案已從現行版本刪除，Git 歷史仍完整保存；連結指向刪除前最後一個含有它們的版本。

| 原路徑 | 檔數 | 刪除原因 | 刪除前版本 |
| --- | ---: | --- | --- |
| `reference/drafts/v0.5.0/` | 17 | 舊版圖面，已由現行圖面與發布紀錄取代 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/tree/c614023f662c8309f07ec9521cab7036aec67dde/reference/drafts/v0.5.0) |
| `reference/drafts/v0.6.0/` | 9 | 同上 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/tree/c614023f662c8309f07ec9521cab7036aec67dde/reference/drafts/v0.6.0) |
| `reference/drafts/v0.6.1/` | 9 | 同上 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/tree/c614023f662c8309f07ec9521cab7036aec67dde/reference/drafts/v0.6.1) |
| `reference/drafts/v0.6.2/` | 9 | 同上 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/tree/c614023f662c8309f07ec9521cab7036aec67dde/reference/drafts/v0.6.2) |
| `reference/drafts/v0.6.3/` | 11 | 同上 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/tree/c614023f662c8309f07ec9521cab7036aec67dde/reference/drafts/v0.6.3) |
| `reference/drafts/v0.6.4/` | 9 | 同上 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/tree/c614023f662c8309f07ec9521cab7036aec67dde/reference/drafts/v0.6.4) |
| `reference/drafts/v0.6.5/` | 9 | 同上 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/tree/c614023f662c8309f07ec9521cab7036aec67dde/reference/drafts/v0.6.5) |
| `reference/drafts/v0.6.6/` | 9 | 同上 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/tree/c614023f662c8309f07ec9521cab7036aec67dde/reference/drafts/v0.6.6) |
| `scripts/generate-v063-l2-review.mjs` | 1 | 0.6.3 一次性比較圖腳本 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/blob/c614023f662c8309f07ec9521cab7036aec67dde/scripts/generate-v063-l2-review.mjs) |
| `.nojekyll` | 1 | 網站改由 GitHub Actions 部署，不需要 | [c614023](https://github.com/kuohappiness/Swimming-Pool-Design/blob/c614023f662c8309f07ec9521cab7036aec67dde/.nojekyll) |
| `web/src/generated/` | 2 | 改為不入庫，由 `build:content` 在安裝、開發、測試、型別檢查與建置前自動產生 | [d30c049](https://github.com/kuohappiness/Swimming-Pool-Design/tree/d30c049ca7cd04a2605266d95f88c51972b847e1/web/src/generated) |
| `drawings/current/*.png` | 4 | 改為不入庫，由 `build:drawings` 自同名 SVG 轉出 | [d30c049](https://github.com/kuohappiness/Swimming-Pool-Design/tree/d30c049ca7cd04a2605266d95f88c51972b847e1/drawings/current) |
| `tests/visual-baselines/v0.6.7/` 的截圖 | 14 | 0.6.7 加強渲染前的 3D 截圖，只由一個測試比對雜湊，不檢查現行網站；該測試一併移除，現行畫面由 `test:e2e` 檢查 | [cb20ea8](https://github.com/kuohappiness/Swimming-Pool-Design/tree/cb20ea8d2d2db8754e83efb322669db1ab84a5b5/tests/visual-baselines/v0.6.7) |
| `tests/visual-baselines/v0.9.0-pre-unification/` | 7 | 0.9.0 單一入口改版前的截圖與幾何、日照雜湊，只能手動比對、不在 CI；之後由程式碼品質工作的鏡面與日照不變量測試取代 | [cb20ea8](https://github.com/kuohappiness/Swimming-Pool-Design/tree/cb20ea8d2d2db8754e83efb322669db1ab84a5b5/tests/visual-baselines/v0.9.0-pre-unification) |
| `tools/check/verify-v090-baseline.mjs` 與 `verify:v090-baseline`、`verify:v091-baseline` | 1 | 上一列基準的比對指令，隨基準退場 | [cb20ea8](https://github.com/kuohappiness/Swimming-Pool-Design/blob/cb20ea8d2d2db8754e83efb322669db1ab84a5b5/tools/check/verify-v090-baseline.mjs) |
| `tools/capture/capture-viewer-baseline.mjs` 與 `capture:viewer-baseline` | 1 | 重產 v0.6.7 基準的工具；基準已刪除，重跑會把現行畫面寫成舊版基準 | [cb20ea8](https://github.com/kuohappiness/Swimming-Pool-Design/blob/cb20ea8d2d2db8754e83efb322669db1ab84a5b5/tools/capture/capture-viewer-baseline.mjs) |
