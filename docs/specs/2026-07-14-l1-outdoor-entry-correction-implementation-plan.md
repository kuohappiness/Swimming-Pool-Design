# L1 戶外入口與廁所雙動線修正實作計畫

- 日期：2026-07-14
- 類型：implementation-plan
- 狀態：in_progress
- 任務：TASK-002
- 目標版本：0.2.0
- 依據：`DEC-028`、`SRC-CONCEPT-008`、[服務核心設計](2026-07-14-service-core-first-revision-design.md)、[圖集契約](../contracts/reference-atlas.md)

## 目標

把 `REF-101` 與模型從錯誤的室內共用前室修正為戶外到達空間，並完整表達三個獨立戶外開口與男女廁的戶外／泳池雙動線。

## 修改範圍

- `model/project-model.json`
- `scripts/reference-validation.mjs`
- `reference/src/sheets.ts`
- `reference/src/styles.css`
- `tests/reference-model.test.mjs`
- 與入口語意相關的型別或 geometry helper（若契約需要）

## 模型與圖面

1. 移除 `Z-L1-ENTRY-01` 的室內方形共用前室語意；若保留 ID，只能改為戶外前場並留下遷移記錄。
2. `EN-01` 表達從校園／操場到達戶外前場，不再畫成直接進入室內共用前室。
3. 分別畫出泳池大廳、男廁、女廁三個獨立戶外開口；男女廁前門對應 `SRC-CONCEPT-008` 藍框並朝向圖面下方戶外空間。
4. 男女廁各保留泳池側時段管制後門，並完整畫出由泳池大廳連至兩樘後門的上方乾式通道。
5. 同一廁所前後門錯位並設短遮擋牆；`ST-01` 不得阻斷戶外開口、前後門或乾式通道。
6. 刪除「共用前室」標籤、虛線室內框及會把綠框誤認為室內的填色／邊界。

## 測試與驗收

- validator 拒絕 shared vestibule／室內共用前室語意，要求三個獨立戶外開口、兩樘廁所前門、兩樘後門及完整乾式通道；另鎖定 `[27, 0, 0]` 本地原點、門檻連接、路徑位於戶外前場內、路徑與樓梯的大於 `0.002 m` 淨空，以及新 entity 的 registry contract。每個 registry `sourceIds` 必須唯一且與 expected sources 雙向集合相等，順序可忽略、不得增加或重複。
- renderer 測試直接執行 `renderSheets()`，確認 `REF-101` 不含「共用前室」，並包含戶外空間、泳池入口、男廁入口、女廁入口及泳池側乾式通道；每個新 entity 僅有一個具 `tabindex="0"`、`role="button"` 與 `aria-label` 的 SVG group。
- 視覺檢查確認綠框為戶外、紅框為男女廁、兩廁前門朝下，泳池入口不與廁所入口合併。
- `npm run validate:reference`、`npm test`、`npm run build`、瀏覽器 smoke、`git diff --check` 通過。
