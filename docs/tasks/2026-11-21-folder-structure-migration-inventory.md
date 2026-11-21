# 資料夾架構調整清單

- 日期：2026-11-21
- 類型：inventory
- 狀態：approved
- 任務：TASK-107～TASK-109
- 目標版本：repository structure（不另發版）
- 設計：[資料夾架構與命名統一設計](2026-11-21-folder-structure-migration-design.md)

本清單以 `main` 的 `da7c571`（release v0.9.7）為準，由腳本讀取 `git ls-files` 與每個文字檔內的路徑字串產生。實作時若 `main` 已前進，先依同樣規則重產一次，再以 `npm run build` 與 `git grep` 確認沒有遺漏。

## 1. 檔案搬移

共 405 個追蹤檔：TASK-107 搬 167 檔、TASK-108 處理 114 檔（含刪除 84 檔）、TASK-109 處理 22 檔，其餘 102 檔不動。整個資料夾一起搬時只列一列，子資料夾與檔名不變。

### TASK-107 搬移 A：程式

| 舊路徑 | 新路徑 | 檔數 | 備註 |
| --- | --- | ---: | --- |
| `docs/public/swimming-pool-renovation-design-concept.md` | `content/design-concept.md` | 1 | 網站內容原始檔，由 build:content 讀取 |
| `docs/public/website-copy-v1.0.md` | `content/website-copy.md` | 1 | 由 build:copy 產生的快照，去版號 |
| `reference/drafts/v0.6.7/DRAW-L1-PLAN-v0.6.7.png` | `drawings/current/DRAW-L1-PLAN.png` | 1 | 檔名去版號；C 改為不入庫 |
| `reference/drafts/v0.6.7/DRAW-L1-PLAN-v0.6.7.svg` | `drawings/current/DRAW-L1-PLAN.svg` | 1 | 檔名去版號 |
| `reference/drafts/v0.6.7/DRAW-L2-PLAN-v0.6.7.png` | `drawings/current/DRAW-L2-PLAN.png` | 1 | 檔名去版號；C 改為不入庫 |
| `reference/drafts/v0.6.7/DRAW-L2-PLAN-v0.6.7.svg` | `drawings/current/DRAW-L2-PLAN.svg` | 1 | 檔名去版號 |
| `reference/drafts/v0.6.7/DRAW-L3-PLAN-v0.6.7.png` | `drawings/current/DRAW-L3-PLAN.png` | 1 | 檔名去版號；C 改為不入庫 |
| `reference/drafts/v0.6.7/DRAW-L3-PLAN-v0.6.7.svg` | `drawings/current/DRAW-L3-PLAN.svg` | 1 | 檔名去版號 |
| `reference/drafts/v0.6.7/DRAW-LONGITUDINAL-SECTION-v0.6.7.png` | `drawings/current/DRAW-LONGITUDINAL-SECTION.png` | 1 | 檔名去版號；C 改為不入庫 |
| `reference/drafts/v0.6.7/DRAW-LONGITUDINAL-SECTION-v0.6.7.svg` | `drawings/current/DRAW-LONGITUDINAL-SECTION.svg` | 1 | 檔名去版號 |
| `reference/drafts/v0.6.7/README.md` | `drawings/current/README.md` | 1 |  |
| `reference/generated/` | `web/src/generated/` | 2 | C 改為不入庫 |
| `reference/index.html` | `web/index.html` | 1 |  |
| `reference/src/3d-viewer/` | `web/src/views/3d-viewer/` | 64 | 與 views/3d-viewer 合併；子資料夾原樣保留 |
| `reference/src/app/` | `web/src/app/` | 4 |  |
| `reference/src/assets/site-emblem-header.png` | `web/src/shared/assets/brand/school-emblem-header.png` | 1 | site 只指基地 |
| `reference/src/design-system/` | `web/src/design-system/` | 4 |  |
| `reference/src/geometry.ts` | `web/src/views/drawings/geometry.ts` | 1 | 只服務圖面頁 |
| `reference/src/main.ts` | `web/src/views/drawings/main.ts` | 1 | 只服務圖面頁 |
| `reference/src/sheets.ts` | `web/src/views/drawings/sheets.ts` | 1 | 只服務圖面頁 |
| `reference/src/solar-study/` | `web/src/views/solar-study/` | 2 | 與 views/solar-study 合併 |
| `reference/src/styles.css` | `web/src/views/drawings/styles.css` | 1 | 只服務圖面頁；併入 view.css 由樣式串處理 |
| `reference/src/types.ts` | `web/src/shared/types.ts` | 1 | 跨分頁共用型別 |
| `reference/src/views/3d-viewer/` | `web/src/views/3d-viewer/` | 2 |  |
| `reference/src/views/3d-viewer/viewer-template.html` | `web/src/views/3d-viewer/template.html` | 1 | 固定檔名 |
| `reference/src/views/design-concept/` | `web/src/views/design-concept/` | 18 |  |
| `reference/src/views/drawings/` | `web/src/views/drawings/` | 2 |  |
| `reference/src/views/solar-study/` | `web/src/views/solar-study/` | 2 |  |
| `reference/src/views/solar-study/legacy-template.html` | `web/src/views/solar-study/template.html` | 1 | 固定檔名 |
| `reference/src/vite-env.d.ts` | `web/src/vite-env.d.ts` | 1 |  |
| `scripts/active-geometry.d.mts` | `core/geometry/active-geometry.d.mts` | 1 |  |
| `scripts/active-geometry.mjs` | `core/geometry/active-geometry.mjs` | 1 |  |
| `scripts/build-public-content.mjs` | `tools/build/build-content.mjs` | 1 |  |
| `scripts/capture-public-copy.mjs` | `tools/build/build-copy.mjs` | 1 | 產生類 |
| `scripts/capture-viewer-baseline.mjs` | `tools/capture/capture-viewer-baseline.mjs` | 1 | 程式碼串之後以 Playwright 取代 |
| `scripts/capture-viewer-quality-evidence.mjs` | `tools/capture/capture-viewer-quality.mjs` | 1 | 程式碼串之後以繪製預算取代 |
| `scripts/check-docs.mjs` | `tools/check/check-docs.mjs` | 1 |  |
| `scripts/clean-reference-dist.mjs` | `tools/build/clean-dist.mjs` | 1 | 程式碼串之後以 emptyOutDir 取代 |
| `scripts/generate-current-drawings.mjs` | `tools/build/build-drawings.mjs` | 1 |  |
| `scripts/public-site-e2e.mjs` | `tests/e2e/web.e2e.mjs` | 1 |  |
| `scripts/reference-geometry.d.mts` | `core/geometry/drawing-geometry.d.mts` | 1 |  |
| `scripts/reference-geometry.mjs` | `core/geometry/drawing-geometry.mjs` | 1 |  |
| `scripts/reference-validation.mjs` | `core/validation/model-validation.mjs` | 1 |  |
| `scripts/render-draft-svgs.mjs` | `tools/build/render-drawing-png.mjs` | 1 |  |
| `scripts/site-orientation.d.mts` | `core/geometry/site-orientation.d.mts` | 1 |  |
| `scripts/site-orientation.mjs` | `core/geometry/site-orientation.mjs` | 1 |  |
| `scripts/solar-angle-analysis.mjs` | `core/solar/solar-angle-analysis.mjs` | 1 |  |
| `scripts/solar-energy-analysis.mjs` | `core/solar/solar-energy-analysis.mjs` | 1 |  |
| `scripts/solar-optimize-current.mjs` | `tools/analysis/solar-optimize.mjs` | 1 |  |
| `scripts/solar-reflection.d.mts` | `core/solar/solar-reflection.d.mts` | 1 |  |
| `scripts/solar-reflection.mjs` | `core/solar/solar-reflection.mjs` | 1 |  |
| `scripts/validate-reference-model.mjs` | `tools/check/check-model.mjs` | 1 |  |
| `scripts/verify-v090-immutable-baseline.mjs` | `tools/check/verify-v090-baseline.mjs` | 1 | C 退場 |
| `scripts/viewer-data.mjs` | `core/viewer/viewer-data.mjs` | 1 |  |
| `scripts/viewer-e2e.mjs` | `tests/e2e/3d-viewer.e2e.mjs` | 1 |  |
| `tests/public-router.test.mjs` | `tests/unit/web/app/router.test.mjs` | 1 |  |
| `tests/reference-model.test.mjs` | `tests/unit/core/validation/model.test.mjs` | 1 |  |
| `tests/site-orientation.test.mjs` | `tests/unit/core/geometry/site-orientation.test.mjs` | 1 |  |
| `tests/solar-angle-analysis.test.mjs` | `tests/unit/core/solar/solar-angle-analysis.test.mjs` | 1 |  |
| `tests/solar-energy-analysis.test.mjs` | `tests/unit/core/solar/solar-energy-analysis.test.mjs` | 1 |  |
| `tests/solar-reflection.test.mjs` | `tests/unit/core/solar/solar-reflection.test.mjs` | 1 |  |
| `tests/viewer-building-details.test.mjs` | `tests/unit/web/views/3d-viewer/building-details.test.mjs` | 1 |  |
| `tests/viewer-data.test.mjs` | `tests/unit/core/viewer/viewer-data.test.mjs` | 1 |  |
| `tests/viewer-detail-level.test.mjs` | `tests/unit/web/views/3d-viewer/detail-level.test.mjs` | 1 |  |
| `tests/viewer-environment.test.mjs` | `tests/unit/web/views/3d-viewer/environment.test.mjs` | 1 |  |
| `tests/viewer-materials.test.mjs` | `tests/unit/web/views/3d-viewer/materials.test.mjs` | 1 |  |
| `tests/viewer-quality-profile.test.mjs` | `tests/unit/web/views/3d-viewer/quality-profile.test.mjs` | 1 |  |
| `tests/viewer-rendering-contract.test.mjs` | `tests/unit/web/views/3d-viewer/rendering-contract.test.mjs` | 1 |  |
| `tests/viewer-sanitary.test.mjs` | `tests/unit/web/views/3d-viewer/sanitary.test.mjs` | 1 |  |
| `tests/viewer-scene.test.mjs` | `tests/unit/web/views/3d-viewer/scene.test.mjs` | 1 |  |
| `tests/viewer-visual-adapter.test.mjs` | `tests/unit/web/views/3d-viewer/visual-adapter.test.mjs` | 1 |  |
| `tests/viewer-visual-assets.test.mjs` | `tests/unit/web/views/3d-viewer/visual-assets.test.mjs` | 1 |  |
| `tests/walkthrough-collision.test.mjs` | `tests/unit/web/views/3d-viewer/walkthrough/collision.test.mjs` | 1 |  |
| `tests/walkthrough-controller.test.mjs` | `tests/unit/web/views/3d-viewer/walkthrough/controller.test.mjs` | 1 |  |
| `tests/walkthrough-data.test.mjs` | `tests/unit/web/views/3d-viewer/walkthrough/data.test.mjs` | 1 |  |
| `tests/walkthrough-swimming.test.mjs` | `tests/unit/web/views/3d-viewer/walkthrough/swimming.test.mjs` | 1 |  |

### TASK-108 搬移 B：文件與舊成果

| 舊路徑 | 新路徑 | 檔數 | 備註 |
| --- | --- | ---: | --- |
| `.codex/skill/` | `.claude/skills/swimming-pool-design/` | 4 | 另複製一份到 .agents/skills/swimming-pool-design/ |
| `.nojekyll` | 刪除 | 1 | Actions 部署不需要 |
| `deliverables/游泳池改建設計理念介紹.docx` | `docs/archive/deliverables/design-concept-introduction.docx` | 1 | 英文檔名 |
| `docs/01_PROJECT_BRIEF.md` | `docs/product.md` | 1 |  |
| `docs/02_SITE_AND_SOURCES.md` | `docs/site-and-sources.md` | 1 |  |
| `docs/03_DESIGN_BASIS.md` | `docs/design-basis.md` | 1 |  |
| `docs/04_DECISIONS_AND_OPEN_ITEMS.md` | `docs/decisions.md` | 1 | §2 尚待精化（OPEN）拆到 docs/backlog.md |
| `docs/05_MODEL_CONTRACT.md` | `docs/contracts/model.md` | 1 |  |
| `docs/06_WORKFLOW_AND_RELEASES.md` | `docs/agents/workflow.md` | 1 |  |
| `docs/07_ACTIVE_WORK.md` | `docs/roadmap.md` | 1 | §27 未排程設計問題拆到 docs/backlog.md |
| `docs/archive/specs/open-010-layered-envelope-concept.svg` | `docs/archive/specs/assets/open-010-layered-envelope-concept.svg` | 1 | 圖檔與規格分開 |
| `docs/archive/specs/st-01-hidden-tension-wall-concept.svg` | `docs/archive/specs/assets/st-01-hidden-tension-wall-concept.svg` | 1 | 圖檔與規格分開 |
| `docs/contracts/reference-atlas.md` | `docs/contracts/drawings.md` | 1 |  |
| `docs/governance/DOCUMENT_OWNERSHIP.md` | `docs/architecture.md` | 1 | 併入新的 architecture.md |
| `docs/subprojects/` | `docs/archive/subprojects/` | 2 | 過時索引 |
| `reference/drafts/` | 刪除 | 82 | 舊版圖面，刪除；列入 docs/archive/README.md 的已刪除清單 |
| `scripts/generate-v063-l2-review.mjs` | 刪除 | 1 | 0.6.3 一次性腳本，刪除；列入 docs/archive/README.md 的已刪除清單 |
| `source-materials/concepts/hand-sketches/SRC-CONCEPT-012_campus-survey-01.jpeg` | `source-materials/site/photos/SRC-CONCEPT-012_campus-survey-01.jpeg` | 1 | 場勘照片，編號、檔名、雜湊不變 |
| `source-materials/concepts/hand-sketches/SRC-CONCEPT-013_campus-survey-02.jpeg` | `source-materials/site/photos/SRC-CONCEPT-013_campus-survey-02.jpeg` | 1 | 場勘照片，編號、檔名、雜湊不變 |
| `source-materials/concepts/hand-sketches/SRC-CONCEPT-014_campus-survey-03.jpeg` | `source-materials/site/photos/SRC-CONCEPT-014_campus-survey-03.jpeg` | 1 | 場勘照片，編號、檔名、雜湊不變 |
| `source-materials/concepts/hand-sketches/SRC-CONCEPT-015_campus-survey-04.jpeg` | `source-materials/site/photos/SRC-CONCEPT-015_campus-survey-04.jpeg` | 1 | 場勘照片，編號、檔名、雜湊不變 |
| `source-materials/concepts/hand-sketches/SRC-CONCEPT-016_campus-survey-05.jpeg` | `source-materials/site/photos/SRC-CONCEPT-016_campus-survey-05.jpeg` | 1 | 場勘照片，編號、檔名、雜湊不變 |
| `source-materials/concepts/hand-sketches/SRC-CONCEPT-017_campus-survey-06.jpeg` | `source-materials/site/photos/SRC-CONCEPT-017_campus-survey-06.jpeg` | 1 | 場勘照片，編號、檔名、雜湊不變 |
| `versions/README.md` | `docs/archive/legacy-models/README.md` | 1 |  |
| `versions/V02/` | `docs/archive/legacy-models/v02/` | 2 |  |
| `versions/V03/` | `docs/archive/legacy-models/v03/` | 3 |  |

### TASK-109 瘦身與資產

| 舊路徑 | 新路徑 | 檔數 | 備註 |
| --- | --- | ---: | --- |
| `tests/visual-baselines/v0.6.7/baseline-report.json` | `tests/fixtures/v0.6.7-viewer-baseline-report.json` | 1 | 程式碼串改用繪製預算後刪除 |
| `tests/visual-baselines/v0.6.7/` | 刪除 | 14 | 刪除，讀取它們的兩個測試同 PR 移除 |
| `tests/visual-baselines/v0.9.0-pre-unification/` | 刪除 | 7 | 刪除，verify:v090／v091 指令退場 |

## 2. 需要檢查與更新的引用

下表列出每個檔案內指向上述舊路徑的字串，分三種：

- **程式字串**：程式、設定或 JSON 裡的路徑與 import，包含相對路徑在檔案搬家後需要重算的情況。
- **文件連結**：Markdown 連結與圖片，`check:docs` 會驗證，搬移後必須修正。
- **文件提及**：現行文件裡用程式碼格式寫出的路徑，搬移後更新為新路徑。封存文件與發布紀錄內的提及不改寫，改由 `docs/archive/README.md` 的舊路徑對照表說明。

同一個 PR 內一起搬家、彼此用相對路徑引用的檔案也會列出，實作時確認相對路徑仍然成立即可。

### 由 TASK-107 搬移 A：程式 更新（72 檔）

| 檔案 | 種類 | 指向的舊路徑 |
| --- | --- | --- |
| `docs/02_SITE_AND_SOURCES.md` | 文件提及 | `reference/src/assets/site-emblem-header.png`、`reference/src/views/design-concept/assets` |
| `docs/04_DECISIONS_AND_OPEN_ITEMS.md` | 文件提及 | `docs/public/website-copy-v1.0.md`、`reference/src/3d-viewer/walkthrough` |
| `docs/05_MODEL_CONTRACT.md` | 文件提及 | `reference/generated/viewer-model.json`、`scripts/active-geometry.mjs`、`scripts/build-public-content.mjs`、`scripts/generate-current-drawings.mjs`、`scripts/reference-geometry.mjs`、`scripts/site-orientation.mjs`、`scripts/solar-angle-analysis.mjs`、`scripts/solar-energy-analysis.mjs`、`scripts/viewer-data.mjs` |
| `docs/07_ACTIVE_WORK.md` | 文件連結 | `docs/public/swimming-pool-renovation-design-concept.md`、`docs/public/website-copy-v1.0.md` |
| `docs/07_ACTIVE_WORK.md` | 文件提及 | `reference/src/3d-viewer/walkthrough` |
| `docs/archive/analysis/3d-viewer-information-readiness-v0.4.0.md` | 文件連結 | `docs/public/swimming-pool-renovation-design-concept.md` |
| `docs/archive/specs/2026-07-18-3d-viewer-mvp-design.md` | 文件連結 | `docs/public/swimming-pool-renovation-design-concept.md` |
| `docs/contracts/3d-viewer.md` | 文件提及 | `reference/generated/concept-content.json`、`reference/generated/viewer-model.json` |
| `docs/contracts/reference-atlas.md` | 文件提及 | `reference/src/sheets.ts` |
| `docs/governance/DOCUMENT_OWNERSHIP.md` | 文件提及 | `docs/public/swimming-pool-renovation-design-concept.md`、`docs/public/website-copy-v1.0.md` |
| `docs/subprojects/3d-walkthrough/README.md` | 文件提及 | `reference/generated` |
| `model/analysis-registry.json` | 程式字串 | `tests/solar-angle-analysis.test.mjs`、`tests/solar-energy-analysis.test.mjs`、`tests/solar-reflection.test.mjs` |
| `package.json` | 程式字串 | `scripts` |
| `reference/drafts/v0.6.7/README.md` | 文件提及 | `reference/drafts/v0.6.7/DRAW-L1-PLAN-v0.6.7.svg`、`reference/drafts/v0.6.7/DRAW-L2-PLAN-v0.6.7.svg`、`reference/drafts/v0.6.7/DRAW-L3-PLAN-v0.6.7.svg`、`reference/drafts/v0.6.7/DRAW-LONGITUDINAL-SECTION-v0.6.7.svg` |
| `reference/src/3d-viewer/assets/README.md` | 文件提及 | `reference/src/3d-viewer/assets/environments/courtyard-sky.svg`、`reference/src/3d-viewer/assets/materials/water-normal.svg`、`reference/src/3d-viewer/assets/models` |
| `reference/src/3d-viewer/main.ts` | 程式字串 | `reference/generated/concept-content.json`、`reference/generated/viewer-model.json`、`reference/src/3d-viewer/rendering`、`reference/src/3d-viewer/rendering/enhanced`、`reference/src/3d-viewer/walkthrough` |
| `reference/src/3d-viewer/orientation.ts` | 程式字串 | `scripts/site-orientation.mjs` |
| `reference/src/3d-viewer/rendering/enhanced/asset-manifest.ts` | 程式字串 | `reference/src/3d-viewer/rendering` |
| `reference/src/3d-viewer/rendering/enhanced/environment-effect.ts` | 程式字串 | `reference/src/3d-viewer/assets/environments/courtyard-sky.svg` |
| `reference/src/3d-viewer/rendering/enhanced/texture-loader.ts` | 程式字串 | `reference/src/3d-viewer/assets/materials/concrete-detail.svg`、`reference/src/3d-viewer/assets/materials/concrete-normal.svg`、`reference/src/3d-viewer/assets/materials/concrete-roughness.svg`、`reference/src/3d-viewer/assets/materials/deck-grain.svg`、`reference/src/3d-viewer/assets/materials/deck-normal.svg`、`reference/src/3d-viewer/assets/materials/pool-tile-grid.svg`、`reference/src/3d-viewer/assets/materials/pool-tile-normal.svg`、`reference/src/3d-viewer/assets/materials/water-normal.svg` |
| `reference/src/3d-viewer/rendering/index.ts` | 程式字串 | `reference/src/3d-viewer/rendering/enhanced` |
| `reference/src/3d-viewer/scenes.ts` | 程式字串 | `reference/src/3d-viewer/scene-manifest.json` |
| `reference/src/3d-viewer/styles.css` | 程式字串 | `reference/src/3d-viewer/walkthrough` |
| `reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts` | 程式字串 | `reference/src/3d-viewer/pool-state.ts` |
| `reference/src/app/app-shell.ts` | 程式字串 | `model/project-model.json`、`reference/src/assets/site-emblem-header.png` |
| `reference/src/app/bootstrap.ts` | 程式字串 | `reference/src/design-system/components.css`、`reference/src/design-system/layout.css`、`reference/src/design-system/tokens.css`、`reference/src/design-system/typography.css`、`reference/src/views/3d-viewer`、`reference/src/views/design-concept`、`reference/src/views/drawings`、`reference/src/views/solar-study` |
| `reference/src/geometry.ts` | 程式字串 | `scripts/reference-geometry.mjs` |
| `reference/src/main.ts` | 程式字串 | `model/project-model.json` |
| `reference/src/sheets.ts` | 程式字串 | `reference/drafts/v0.6.7/DRAW-L1-PLAN-v0.6.7.svg`、`reference/drafts/v0.6.7/DRAW-L2-PLAN-v0.6.7.svg`、`reference/drafts/v0.6.7/DRAW-L3-PLAN-v0.6.7.svg`、`reference/drafts/v0.6.7/DRAW-LONGITUDINAL-SECTION-v0.6.7.svg`、`scripts/site-orientation.mjs`、`source-materials/site/SRC-SITE-001_google-maps-satellite.png` |
| `reference/src/solar-study/main.ts` | 程式字串 | `model/project-model.json`、`reference/generated/viewer-model.json`、`scripts/active-geometry.mjs`、`scripts/site-orientation.mjs`、`scripts/solar-reflection.mjs` |
| `reference/src/views/3d-viewer/index.ts` | 程式字串 | `reference/src/3d-viewer/styles.css`、`reference/src/views/3d-viewer/view.css`、`reference/src/views/3d-viewer/viewer-template.html` |
| `reference/src/views/design-concept/index.ts` | 程式字串 | `model/project-model.json`、`reference/drafts/v0.6.7/DRAW-L3-PLAN-v0.6.7.svg`、`reference/generated/concept-content.json`、`reference/src/views/design-concept/assets/origin-campus-02-1920.jpg`、`reference/src/views/design-concept/assets/origin-campus-02-960.jpg`、`reference/src/views/design-concept/assets/origin-campus-05-1920.jpg`、`reference/src/views/design-concept/assets/origin-campus-05-960.jpg`、`reference/src/views/design-concept/assets/origin-campus-06-1920.jpg`、`reference/src/views/design-concept/assets/origin-campus-06-960.jpg`、`reference/src/views/design-concept/assets/origin-early-3d-1920.jpg`、`reference/src/views/design-concept/assets/origin-early-3d-960.jpg`、`reference/src/views/design-concept/assets/origin-overhead-plan-1920.jpg`、`reference/src/views/design-concept/assets/origin-overhead-plan-960.jpg`、`reference/src/views/design-concept/assets/origin-section-1920.jpg`、`reference/src/views/design-concept/assets/origin-section-960.jpg`、`reference/src/views/design-concept/assets/origin-solar-reflection-1920.jpg`、`reference/src/views/design-concept/assets/origin-solar-reflection-960.jpg`、`reference/src/views/design-concept/assets/origin-solar-study-1920.jpg`、`reference/src/views/design-concept/assets/origin-solar-study-960.jpg`、`reference/src/views/design-concept/view.css`、`scripts/active-geometry.mjs` |
| `reference/src/views/drawings/index.ts` | 程式字串 | `model/project-model.json`、`reference/src/styles.css`、`reference/src/views/drawings/view.css` |
| `reference/src/views/solar-study/index.ts` | 程式字串 | `reference/src/solar-study/styles.css`、`reference/src/views/solar-study/legacy-template.html`、`reference/src/views/solar-study/view.css` |
| `reference/src/views/solar-study/legacy-template.html` | 程式字串 | `reference/src/views`、`reference/src/views/3d-viewer` |
| `scripts/active-geometry.mjs` | 程式字串 | `scripts` |
| `scripts/build-public-content.mjs` | 程式字串 | `docs/public/swimming-pool-renovation-design-concept.md`、`reference/generated`、`reference/src/3d-viewer/scene-manifest.json`、`scripts`、`scripts/active-geometry.mjs`、`scripts/reference-geometry.mjs`、`scripts/viewer-data.mjs` |
| `scripts/capture-public-copy.mjs` | 程式字串 | `docs/public/website-copy-v1.0.md` |
| `scripts/clean-reference-dist.mjs` | 程式字串 | `reference` |
| `scripts/generate-current-drawings.mjs` | 程式字串 | `reference`、`scripts/active-geometry.mjs`、`scripts/site-orientation.mjs` |
| `scripts/reference-geometry.mjs` | 程式字串 | `scripts/active-geometry.mjs` |
| `scripts/reference-validation.mjs` | 程式字串 | `scripts/active-geometry.mjs`、`scripts/site-orientation.mjs` |
| `scripts/solar-angle-analysis.mjs` | 程式字串 | `model/project-model.json`、`scripts/active-geometry.mjs`、`scripts/reference-geometry.mjs`、`scripts/solar-reflection.mjs` |
| `scripts/solar-energy-analysis.mjs` | 程式字串 | `model/project-model.json`、`scripts/active-geometry.mjs`、`scripts/solar-angle-analysis.mjs`、`scripts/solar-reflection.mjs`、`source-materials/site/SRC-SITE-003_pvgis-5-3-tmy.json` |
| `scripts/solar-optimize-current.mjs` | 程式字串 | `scripts/solar-energy-analysis.mjs` |
| `scripts/solar-reflection.mjs` | 程式字串 | `scripts/site-orientation.mjs` |
| `scripts/validate-reference-model.mjs` | 程式字串 | `scripts/reference-validation.mjs` |
| `scripts/verify-v090-immutable-baseline.mjs` | 程式字串 | `reference/generated/concept-content.json`、`reference/generated/viewer-model.json`、`scripts/active-geometry.mjs` |
| `scripts/viewer-data.mjs` | 程式字串 | `scripts/active-geometry.mjs`、`scripts/site-orientation.mjs` |
| `scripts/viewer-e2e.mjs` | 程式字串 | `scripts`、`scripts/site-orientation.mjs` |
| `source-materials/concepts/hand-sketches/README.md` | 文件提及 | `reference/src/views/design-concept/assets` |
| `tests/public-router.test.mjs` | 程式字串 | `reference/index.html`、`reference/src/app/app-shell.ts`、`reference/src/app/bootstrap.ts`、`reference/src/app/router.ts` |
| `tests/reference-model.test.mjs` | 程式字串 | `reference/drafts/v0.6.7`、`reference/src/sheets.ts`、`scripts/active-geometry.mjs`、`scripts/generate-current-drawings.mjs`、`scripts/reference-geometry.mjs`、`scripts/reference-validation.mjs`、`scripts/solar-angle-analysis.mjs`、`scripts/solar-energy-analysis.mjs`、`scripts/viewer-data.mjs`、`tests` |
| `tests/site-orientation.test.mjs` | 程式字串 | `model/project-model.json`、`scripts/site-orientation.mjs` |
| `tests/solar-angle-analysis.test.mjs` | 程式字串 | `scripts/active-geometry.mjs`、`scripts/solar-angle-analysis.mjs` |
| `tests/solar-energy-analysis.test.mjs` | 程式字串 | `scripts/solar-energy-analysis.mjs`、`scripts/solar-reflection.mjs` |
| `tests/solar-reflection.test.mjs` | 程式字串 | `scripts/solar-reflection.mjs` |
| `tests/viewer-building-details.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts`、`scripts/viewer-data.mjs` |
| `tests/viewer-data.test.mjs` | 程式字串 | `docs/public/swimming-pool-renovation-design-concept.md`、`reference/generated/concept-content.json`、`reference/generated/viewer-model.json`、`reference/src/3d-viewer/interactions.ts`、`reference/src/3d-viewer/rendering/baseline-material-registry.ts`、`reference/src/3d-viewer/scene-factory.ts`、`reference/src/3d-viewer/scene-manifest.json`、`reference/src/views/3d-viewer/viewer-template.html`、`reference/src/views/solar-study/legacy-template.html`、`scripts/build-public-content.mjs`、`scripts/viewer-data.mjs` |
| `tests/viewer-detail-level.test.mjs` | 程式字串 | `reference` |
| `tests/viewer-environment.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer/rendering/enhanced/frame-effect-pipeline.ts` |
| `tests/viewer-materials.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts`、`scripts/viewer-data.mjs` |
| `tests/viewer-quality-profile.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer/main.ts` |
| `tests/viewer-rendering-contract.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer/main.ts`、`reference/src/3d-viewer/scene-factory.ts`、`scripts/check-docs.mjs` |
| `tests/viewer-sanitary.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts`、`scripts/viewer-data.mjs` |
| `tests/viewer-scene.test.mjs` | 程式字串 | `reference`、`reference/generated/concept-content.json`、`scripts/viewer-data.mjs` |
| `tests/viewer-visual-adapter.test.mjs` | 程式字串 | `reference`、`scripts/viewer-data.mjs` |
| `tests/viewer-visual-assets.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer` |
| `tests/walkthrough-collision.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts`、`reference/src/3d-viewer/walkthrough/walkthrough-config.ts`、`scripts/viewer-data.mjs` |
| `tests/walkthrough-controller.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer/interactions.ts`、`reference/src/3d-viewer/main.ts`、`reference/src/3d-viewer/styles.css`、`reference/src/views/3d-viewer/index.ts`、`reference/src/views/3d-viewer/viewer-template.html` |
| `tests/walkthrough-data.test.mjs` | 程式字串 | `model/analysis-registry.json`、`model/project-model.json`、`reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts`、`reference/src/3d-viewer/walkthrough/walkthrough-config.ts`、`scripts/viewer-data.mjs` |
| `tests/walkthrough-swimming.test.mjs` | 程式字串 | `reference`、`reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts`、`reference/src/3d-viewer/walkthrough/walkthrough-config.ts`、`scripts/viewer-data.mjs` |
| `vite.config.ts` | 程式字串 | `reference` |

### 由 TASK-108 搬移 B：文件與舊成果 更新（28 檔）

| 檔案 | 種類 | 指向的舊路徑 |
| --- | --- | --- |
| `.codex/skill/SKILL.md` | 文件連結 | `.codex/skill/references/document-ownership.md`、`.codex/skill/references/model-validation.md`、`.codex/skill/references/source-intake.md`、`docs/governance/DOCUMENT_OWNERSHIP.md` |
| `.codex/skill/SKILL.md` | 文件提及 | `docs/01_PROJECT_BRIEF.md`、`docs/02_SITE_AND_SOURCES.md`、`docs/03_DESIGN_BASIS.md`、`docs/04_DECISIONS_AND_OPEN_ITEMS.md`、`docs/05_MODEL_CONTRACT.md`、`docs/06_WORKFLOW_AND_RELEASES.md`、`docs/07_ACTIVE_WORK.md`、`docs/contracts` |
| `.codex/skill/references/document-ownership.md` | 文件連結 | `docs/governance/DOCUMENT_OWNERSHIP.md` |
| `.codex/skill/references/document-ownership.md` | 文件提及 | `docs/07_ACTIVE_WORK.md`、`docs/archive/specs` |
| `.codex/skill/references/source-intake.md` | 文件提及 | `docs/02_SITE_AND_SOURCES.md`、`docs/05_MODEL_CONTRACT.md`、`docs/contracts`、`source-materials/concepts` |
| `README.md` | 文件連結 | `docs/01_PROJECT_BRIEF.md`、`docs/02_SITE_AND_SOURCES.md`、`docs/03_DESIGN_BASIS.md`、`docs/04_DECISIONS_AND_OPEN_ITEMS.md`、`docs/05_MODEL_CONTRACT.md`、`docs/06_WORKFLOW_AND_RELEASES.md`、`docs/07_ACTIVE_WORK.md`、`docs/governance/DOCUMENT_OWNERSHIP.md`、`versions/README.md` |
| `README.md` | 文件提及 | `docs/archive/specs` |
| `docs/01_PROJECT_BRIEF.md` | 文件連結 | `docs/02_SITE_AND_SOURCES.md`、`docs/03_DESIGN_BASIS.md`、`docs/04_DECISIONS_AND_OPEN_ITEMS.md` |
| `docs/02_SITE_AND_SOURCES.md` | 文件連結 | `docs/03_DESIGN_BASIS.md`、`docs/06_WORKFLOW_AND_RELEASES.md` |
| `docs/02_SITE_AND_SOURCES.md` | 文件提及 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-012_campus-survey-01.jpeg`、`source-materials/concepts/hand-sketches/SRC-CONCEPT-013_campus-survey-02.jpeg`、`source-materials/concepts/hand-sketches/SRC-CONCEPT-014_campus-survey-03.jpeg`、`source-materials/concepts/hand-sketches/SRC-CONCEPT-015_campus-survey-04.jpeg`、`source-materials/concepts/hand-sketches/SRC-CONCEPT-016_campus-survey-05.jpeg`、`source-materials/concepts/hand-sketches/SRC-CONCEPT-017_campus-survey-06.jpeg` |
| `docs/04_DECISIONS_AND_OPEN_ITEMS.md` | 文件連結 | `docs/03_DESIGN_BASIS.md`、`docs/05_MODEL_CONTRACT.md`、`docs/07_ACTIVE_WORK.md` |
| `docs/04_DECISIONS_AND_OPEN_ITEMS.md` | 文件提及 | `docs/subprojects/3d-walkthrough`、`source-materials/concepts/hand-sketches` |
| `docs/05_MODEL_CONTRACT.md` | 文件連結 | `docs/03_DESIGN_BASIS.md`、`docs/contracts/reference-atlas.md` |
| `docs/06_WORKFLOW_AND_RELEASES.md` | 文件連結 | `docs/02_SITE_AND_SOURCES.md`、`docs/07_ACTIVE_WORK.md`、`docs/governance/DOCUMENT_OWNERSHIP.md` |
| `docs/06_WORKFLOW_AND_RELEASES.md` | 文件提及 | `docs/07_ACTIVE_WORK.md`、`docs/archive/specs`、`versions/V02`、`versions/V03` |
| `docs/07_ACTIVE_WORK.md` | 文件連結 | `docs/02_SITE_AND_SOURCES.md`、`docs/03_DESIGN_BASIS.md`、`docs/04_DECISIONS_AND_OPEN_ITEMS.md`、`docs/05_MODEL_CONTRACT.md`、`docs/06_WORKFLOW_AND_RELEASES.md`、`docs/contracts/reference-atlas.md`、`docs/subprojects/3d-visual-fidelity/README.md`、`docs/subprojects/3d-walkthrough/README.md`、`reference/drafts/v0.5.0/DRAW-L1-PLAN-V2.0.svg`、`reference/drafts/v0.5.0/DRAW-LONGITUDINAL-SECTION-V2.0.svg`、`reference/drafts/v0.5.0/README.md`、`reference/drafts/v0.6.0/README.md`、`reference/drafts/v0.6.3/README.md` |
| `docs/analysis/solar-analysis.md` | 文件連結 | `docs/03_DESIGN_BASIS.md`、`docs/04_DECISIONS_AND_OPEN_ITEMS.md` |
| `docs/archive/specs/2026-07-14-l1-outdoor-entry-correction-implementation-plan.md` | 文件連結 | `docs/contracts/reference-atlas.md` |
| `docs/archive/specs/2026-07-15-open-010-roof-rainwater-design.md` | 文件連結 | `docs/archive/specs/open-010-layered-envelope-concept.svg` |
| `docs/archive/specs/2026-07-16-stair-finalization-design.md` | 文件連結 | `docs/archive/specs/st-01-hidden-tension-wall-concept.svg` |
| `docs/archive/specs/2026-07-24-3d-visual-fidelity-implementation-plan.md` | 文件連結 | `docs/04_DECISIONS_AND_OPEN_ITEMS.md` |
| `docs/archive/specs/2026-07-24-3d-walkthrough-mvp-implementation-plan.md` | 文件連結 | `docs/04_DECISIONS_AND_OPEN_ITEMS.md` |
| `docs/archive/specs/2026-07-25-building-first-realism-implementation-plan.md` | 文件連結 | `docs/04_DECISIONS_AND_OPEN_ITEMS.md` |
| `docs/contracts/3d-viewer.md` | 文件連結 | `docs/05_MODEL_CONTRACT.md` |
| `docs/contracts/reference-atlas.md` | 文件連結 | `docs/05_MODEL_CONTRACT.md` |
| `docs/contracts/solar-study.md` | 文件連結 | `docs/05_MODEL_CONTRACT.md` |
| `docs/governance/DOCUMENT_OWNERSHIP.md` | 文件提及 | `docs/archive/specs` |
| `docs/releases/README.md` | 文件連結 | `docs/07_ACTIVE_WORK.md` |
| `docs/subprojects/3d-visual-fidelity/README.md` | 文件連結 | `docs/04_DECISIONS_AND_OPEN_ITEMS.md`、`docs/07_ACTIVE_WORK.md`、`docs/archive/specs/2026-07-24-3d-visual-fidelity-design.md`、`docs/archive/specs/2026-07-24-3d-visual-fidelity-implementation-plan.md`、`docs/contracts/3d-viewer.md`、`docs/releases/0.8.0.md`、`docs/subprojects/3d-walkthrough/README.md` |
| `docs/subprojects/3d-visual-fidelity/README.md` | 文件提及 | `docs/05_MODEL_CONTRACT.md`、`docs/07_ACTIVE_WORK.md`、`docs/archive/specs` |
| `docs/subprojects/3d-walkthrough/README.md` | 文件連結 | `docs/04_DECISIONS_AND_OPEN_ITEMS.md`、`docs/07_ACTIVE_WORK.md`、`docs/archive/specs/2026-07-24-3d-walkthrough-mvp-design.md`、`docs/archive/specs/2026-07-24-3d-walkthrough-mvp-implementation-plan.md`、`docs/contracts/3d-viewer.md` |
| `docs/subprojects/3d-walkthrough/README.md` | 文件提及 | `docs/05_MODEL_CONTRACT.md`、`docs/07_ACTIVE_WORK.md`、`docs/archive/specs` |
| `scripts/check-docs.mjs` | 程式字串 | `docs`、`docs/07_ACTIVE_WORK.md`、`versions` |
| `scripts/generate-current-drawings.mjs` | 程式字串 | `reference/drafts` |
| `source-materials/concepts/hand-sketches/README.md` | 文件提及 | `docs/02_SITE_AND_SOURCES.md` |
| `versions/README.md` | 文件連結 | `README.md`、`versions/V02/ZhongShiPool_V02_3D.dxf`、`versions/V02/index.html`、`versions/V03/ZhongShiPool_V03_RoofCorrected_3D.dxf`、`versions/V03/ZhongShiPool_V03_Viewer.html` |

### 由 TASK-109 瘦身與資產 更新（5 檔）

| 檔案 | 種類 | 指向的舊路徑 |
| --- | --- | --- |
| `scripts/capture-viewer-baseline.mjs` | 程式字串 | `tests/visual-baselines/v0.6.7` |
| `scripts/capture-viewer-quality-evidence.mjs` | 程式字串 | `tests/visual-baselines/v0.6.7/baseline-report.json` |
| `scripts/verify-v090-immutable-baseline.mjs` | 程式字串 | `tests/visual-baselines/v0.9.0-pre-unification/baseline-report.json` |
| `tests/viewer-visual-assets.test.mjs` | 程式字串 | `tests/visual-baselines/v0.6.7` |
| `tests/visual-baselines/v0.6.7/baseline-report.json` | 程式字串 | `tests/visual-baselines/v0.6.7/desktop-1440x900-scene-light.png`、`tests/visual-baselines/v0.6.7/desktop-1440x900-scene-overview.png`、`tests/visual-baselines/v0.6.7/desktop-1440x900-scene-people.png`、`tests/visual-baselines/v0.6.7/desktop-1440x900-scene-rain.png`、`tests/visual-baselines/v0.6.7/desktop-1440x900-scene-time.png`、`tests/visual-baselines/v0.6.7/desktop-1440x900-view-pool-side.png`、`tests/visual-baselines/v0.6.7/desktop-1440x900-view-school-side.png`、`tests/visual-baselines/v0.6.7/desktop-1440x900-walkthrough-entrance.png`、`tests/visual-baselines/v0.6.7/mobile-390x844-scene-light.png`、`tests/visual-baselines/v0.6.7/mobile-390x844-scene-overview.png`、`tests/visual-baselines/v0.6.7/mobile-390x844-scene-people.png`、`tests/visual-baselines/v0.6.7/mobile-390x844-scene-rain.png`、`tests/visual-baselines/v0.6.7/mobile-390x844-scene-time.png`、`tests/visual-baselines/v0.6.7/mobile-390x844-walkthrough-entrance.png` |
