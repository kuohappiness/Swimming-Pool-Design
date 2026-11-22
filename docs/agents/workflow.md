# 工作流程與發布

這是一件事從點子到完成的唯一現行寫法，2026-11-22 起比照 Essence 的工作流程（[DEC-147](../decisions.md)）。檔案放在哪裡見 [架構](../architecture.md)；設計答案寫在各 owner 文件，這裡只寫怎麼做。

## 1. 路線

```text
點子、新來源、使用者的話
 │ 記下來
 ▼
backlog〈待處理〉……………… 還沒有答案的問題（OPEN）
 │ 談成答案或要動手：這一項搬到〈已轉出〉，下一行寫「→ 下一站（日期）」
 ▼
decisions.md（DEC）…………… 設計答案、改不回來或跨全專案的規則
 │ 可以交付實作
 ▼
docs/tasks/<任務>.md ……… 規格與驗收；標題下寫狀態行；roadmap〈現在在哪裡〉加一列
 │ 實作 → PR 自動檢查 → 使用者核准合併
 ▼
狀態行改「已合併｜完成：一句話」，roadmap 那一列移到〈已完成〉；形成版本時寫發布紀錄
```

- **一件事同一時間只有一個現在的位置**：沿著「→」走到的最下游那一站。
- 可以跳站（小事直接做成任務）、拆分（寫好幾行「→」）、合併（「來自」連好幾處）。
- 做完的任務說明不刪不搬，只改狀態行。
- 同一時間可以有好幾件工作在進行，各自一個分支與 PR；會改到同一批檔案時，先在任務說明寫好誰先合併，後合併的一方把 `main` 合進分支再解衝突。

## 2. 每類文件

### 2.1 新來源

1. 保留原始檔，不覆蓋既有來源。基地資料放 `source-materials/site/`（現場照片放 `photos/`），概念資料放 `source-materials/concepts/`（手繪稿放 `hand-sketches/`）。
2. 依 `SRC-<類型>-<序號>_<描述>.<副檔名>` 命名。
3. 記錄像素、格式、SHA-256、用途與限制。
4. 更新 [基地與來源](../site-and-sources.md) 與模型 `sources`。網站要用的影像另做衍生檔放在 `web/` 內，同樣記下尺寸與雜湊。
5. 若改變設計，另更新設計基準及 DEC、OPEN；若需要實作，開一份任務說明。

### 2.2 backlog

- **用途**：還沒有答案的問題（OPEN），在 [待決事項](../backlog.md)。保留原意與來源。
- **分區**：二級標題只有〈待處理〉、〈已轉出〉，依這個順序；其他分類降成三級放進這兩節（`check:docs` 擋）。開工只讀〈待處理〉。
- **轉出**：一項談成 DEC 或做成任務時，搬到〈已轉出〉，不刪；項目下一行寫 `→ <下一站的連結>（YYYY-MM-DD）`。〈待處理〉裡不能有「→」。
- 修法已知的缺陷不長期留在 OPEN：設計答案進 DEC，執行進任務說明。

### 2.3 決定（DEC）

- **什麼才寫成 DEC**：使用者確認的設計答案與空間意圖；改不回來的事（模型 schema、座標與單位、來源編號、公開網址與 `?view=` 路由）；跨全專案的規則。其他小事（工具、文件寫法、一次性的取捨），使用者同意後記在那件事的任務說明，寫「使用者 YYYY-MM-DD 同意」。拿不準就寫 DEC。
- **寫法**：[決策](../decisions.md) 第 1 節的表一條一列，只增不改；改變方向時另寫一條新的，在理由欄寫它取代哪一條。這張表本身就是索引。
- **查**：`node tools/section.mjs docs/decisions.md DEC-xxx` 只印那一列，不整份讀。

### 2.4 任務說明

- **用途**：交給實作的規格、驗收與結果，放 `docs/tasks/<YYYY-MM-DD>-<主題>.md`。先寫清楚和「不做」比起來好在哪裡。
- **寫法**：

  ```markdown
  # <標題>

  狀態：實作中｜下一步：<一句>｜等誰：Claude

  來自：[待決事項〈待處理〉](../backlog.md#待處理)、[DEC-xxx](../decisions.md)

  ## 目的
  ## 範圍
  ## 驗收
  ## 結果
  ```

- **開工**：在 roadmap〈現在在哪裡〉加一列（〈2.5 roadmap〉）。
- **收尾**：狀態行改 `狀態：已合併｜完成：<一句話>｜等誰：—`，roadmap 那一列移到〈已完成〉。經過與驗證結果寫在〈結果〉，不寫在狀態行。
- 2026-11-22 以前的任務說明照舊格式（日期、類型、狀態、任務、目標版本五個欄位），已封存的留在 `docs/archive/specs/`，清單在 `tools/check/legacy-status-docs.json`，不再新增；改成新格式後就照新格式檢查。

### 2.5 roadmap

[進度與任務](../roadmap.md) 固定三節，依這個順序（`check:docs` 擋）：

1. **〈現在在哪裡〉**：狀態板，欄是 `工作｜狀態｜下一步｜等誰｜入口`。開工時加一列：「工作」寫 `TASK-<下一個編號> <一句話>`（編號接著用，不重複），「入口」剛好一個連結，連到有狀態行的任務說明；狀態、下一步、等誰照抄入口的狀態行。開工只讀這一節。
2. **〈等觸發點〉**：表 `工作｜觸發點｜入口`。入口的狀態是「等觸發點」時列在這裡，觸發點照抄狀態行的下一步；入口只有 DEC 編號的列手寫。
3. **〈已完成〉**：表 `日期｜工作`。入口的狀態變成已合併或已結案時，把那一列移到最上面，寫成粗體工作名稱、全形冒號、完成那一句，再用全形括號寫狀態值、全形逗號與入口連結。不設列數上限，不搬去封存。2026-11-22 以前的舊任務表原文留在這一節下方，舊表的狀態欄照舊用 `queued`、`ready`、`in_progress`、`blocked`、`done`。

**改了入口的狀態行，同一個 commit 也改 roadmap 那一列。** `check:docs` 會比對：狀態板的三欄要和狀態行一致、結束的要在〈已完成〉、等觸發點的要在〈等觸發點〉、每份有狀態行的任務說明剛好一列。對不上時錯誤訊息會印出應該寫成的那一列。自動產生這些列的工具等新格式用過幾件任務後再評估（列在〈等觸發點〉）。

### 2.6 發布紀錄

形成版本時建立 `docs/releases/<version>.md`，記錄範圍、包含的任務、驗證證據與 commit。發布紀錄不改寫，只修斷鏈。

## 3. 入口的狀態行

任務說明標題下第一個非空行，一般段落（不在引用框、程式碼區塊裡）：

```text
狀態：<狀態值>｜下一步：<一句>｜等誰：<值>
狀態：已合併｜完成：<一句>｜等誰：—
```

- 剛好三欄，用全形「｜」分；欄裡不能再有「｜」。
- **狀態值**：規劃中、討論中、實作中、待審、等觸發點、已合併、已結案、`已結案 → <DEC 編號或連結>`、`暫停（<原因>）`。箭頭只接在已結案後面，下一站要在 repo 裡；暫停一定要寫原因。
- **第二欄**：已合併、已結案是結束，寫「完成：」；其他寫「下一步：」。等觸發點的觸發點寫在下一步。都不能空。
- **等誰**：使用者、Claude、—；兩個都要時用「、」接，不重複；「—」只能單獨用。結束與等觸發點寫「—」。

解析與檢查在 `tools/check/status-line.mjs`、`tools/check/workflow-docs.mjs`。

## 4. 連結

- **站**：任務說明一份檔是一站；backlog 的一項是一站（檔加最近的標題）；決定是決策表裡的那一列。
- **來自**：新的一站在第一個二級標題之前寫一段 `來自：<連結>`；從好幾處合併來的用「、」接。
- **→ 下一站**：上一站加一行 `→ <連結>（YYYY-MM-DD）`，「→」後面直接接連結；backlog 寫在項目的下一行。拆成好幾站就寫好幾行。寫了不再改。
- `check:docs` 檢查每個本地連結都存在，以及 backlog 的「→」格式與日期；「來自」與「→」是否互相對應目前靠人工核對。

## 5. 只讀需要的那一段

- 讀長文件（roadmap、backlog、決策、設計基準）只取需要的那一段：`node tools/section.mjs <檔案> <標題>` 印那一節與行號；`node tools/section.mjs <檔案>` 列出每個標題的行號與字數；`node tools/section.mjs <檔案> <ID>` 印表格第一欄是那個 ID 的列（DEC、OPEN、TASK、SRC 都可以）。
- 入口文件只讀上面那一節：roadmap 的〈現在在哪裡〉、backlog 的〈待處理〉。
- 決定用 ID 查，不整份讀決策表。

## 6. 本機操作與檢查

```powershell
npm install
npm run dev
npm run lint
npm run check:docs
npm run check:model
npm run check:assets
npm test
npm run build
npm run test:e2e
git diff --check
```

`npm run lint` 依序跑 ESLint（含依賴方向）、stylelint（CSS）與 knip（沒人用的檔案與套件）。Prettier 已有設定（`npm run format`、`npm run format:check`），但全庫還沒格式化、CI 也還不檢查；在那之前不要用它重排既有檔案，免得和其他 PR 衝突（[TASK-162](../tasks/2026-11-22-tooling.md)）。依賴更新由 Dependabot 每週一開一個合併 PR，大版本不自動提。

`npm run build` 是提交前完整自動門檻；靜態成果輸出至 `dist/web/`。`npm run dev` 只聽本機；要用手機連線測試時改用 `npm run dev:lan`。`npm run test:e2e` 需要本機的 Chrome 或 Edge，Linux 或雲端環境以 `CHROME_PATH` 指定瀏覽器路徑。瀏覽器與手機 smoke 仍屬需要人工確認的視覺門檻。

每個 PR 由 `.github/workflows/ci.yml` 自動執行上列檢查與金鑰掃描，彙總檢查「全部檢查通過」是合併前的必要條件（[DEC-148](../decisions.md)）。

## 7. GitHub Pages

公開首頁是 `https://kuohappiness.github.io/Swimming-Pool-Design/`；設計理念使用根網址，日照研究、設計歷程、圖面設計、3D 展示與關於分別使用 `?view=solar-study`、`?view=design-process`、`?view=drawings`、`?view=3d-viewer`、`?view=about`。`.github/workflows/deploy-pages.yml` 在 `main` push 或人工觸發時：

- 以 lockfile 安裝依賴並執行 `npm run build`。
- 只上傳 `dist/web/`；`dist/` 不納入 Git 歷史。
- build 成功後才部署；失敗時保留上一個成功網站。

## 8. 版本語意

- 套件版本與正式模型版本在發版任務中同步。
- 發布版號可在 presentation-only release 高於 active geometry revision；此時 active revision 的 ID、revision、幾何 modelVersion 與不可變雜湊必須保持彼此一致，且 release 不得把既有幾何重新命名成不存在的新 revision。
- 開發中的後續版本不得預先改寫正式套件／模型版本；runtime 相容性以 schema、active revision、coordinate system 與 hash 契約判定，不以尚未發布的目標版號硬編碼。
- 不同目標版本可以在隔離分支平行開發，但正式發布保持版本順序；後續版本在前一版本發布後合併其正式基線，再執行完整回歸。
- Git commit 是可追溯變更；Git tag 只在明確要求時建立。
- `docs/archive/legacy-models/` 的 V02、V03 是不可變歷史快照，不延續為現行模型版號。
- PATCH：不改幾何語意；MINOR：新增相容能力或完成一組新設計；MAJOR：座標、單位或 schema 的不相容變更。

## 9. 提交與發布門檻

- `npm run build` 與 `git diff --check` 通過。
- 文件連結、ID、來源雜湊、狀態行、roadmap 三節與 backlog 兩節通過 `npm run check:docs`。
- confirmed 答案無矛盾；deferred 欄位連結真正 OPEN 且沒有 fallback。
- owner、模型、renderer 與測試對同一設計規則一致。
- 相稱的桌面／手機視覺 smoke 已完成。
- 發布紀錄列出版本、包含的任務、驗證命令、結果、已知限制與 commit。
