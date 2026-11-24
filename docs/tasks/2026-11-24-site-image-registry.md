# 網站衍生影像全數登錄雜湊，理念頁池深改讀模型

狀態：待審｜下一步：PR 等使用者合併｜等誰：使用者

- 日期：2026-11-24
- 類型：docs
- 任務：TASK-122
- 核准：使用者 2026-11-24 說「繼續」資料正確性第二輪檢查；本件只補登錄與檢查，不改設計

來自：資料正確性第二輪檢查（2026-11-22 之後新上線的內容）

## 目的

工作流程 2.1 要求網站衍生影像記下尺寸與雜湊，但設計理念頁的 16 張衍生檔（`web/src/views/design-concept/assets/origin-*.jpg`）只在來源說明寫了一句做法，沒有逐檔的位元組數與 SHA-256；之後換圖也沒有檢查會發現。理念頁「尚未處理」清單的池深與平台水深是手寫數字，模型改了不會跟著變。

## 範圍

- `docs/site-and-sources.md`：`SRC-CONCEPT-012`～`023` 那段補上 16 張衍生檔的像素、位元組數與 SHA-256，並註明來自哪一個來源。長寬比與轉正後的原始檔一致，確認沒有裁切。
- `tools/check/source-registry.mjs`：新增 `isDerivativeImage`、`validateDerivativeImages`；`check:docs` 列出 `web/` 底下的影像（3D 資產由 `check:assets` 管，產生檔不入庫，兩者排除），每一張都要在來源說明以「`檔名`（…、位元組數 bytes、SHA-256 `雜湊`）」登錄且與檔案相符。現有 28 張全部通過。
- `tests/unit/tools/check/source-registry.test.mjs`：兩個測試，涵蓋範圍判斷與未登錄、位元組數不符、雜湊不符三種錯誤。
- `content/design-concept.md`：池深與教學平台水深改用 `{{active:…|metre}}`，讀 `l1.pool.shallowDepth`、`deepDepth`、`teachingPlatform.topWaterDepth`；91 年版基準的 0.8 至 1.2 m 是法規原文，維持手寫。
- `docs/architecture.md`：`tools/check` 的 source-registry 說明加上衍生影像。

不做：3D 分頁程式裡寫死的「0.8.2 資料」「15 間」「30 間」等說明字串（屬 3D 分頁，已轉給負責的工作）；合規對照待認定條文的覆核（使用者 2026-11-22 指示往後排）。

## 驗收

- `npm run lint`、`npm run build`、`npm run test:e2e`、`git diff --check` 通過。
- 把任一張衍生檔的登錄改名或改雜湊，`check:docs` 會失敗並指出檔名。
- 設計理念頁那一項顯示「池深 1.2 m 至 1.5 m」「平台面水深 0.8 m」，與泳課頁同一種寫法。
