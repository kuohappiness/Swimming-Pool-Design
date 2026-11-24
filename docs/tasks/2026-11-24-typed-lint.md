# 網站程式開啟 ESLint 型別規則

狀態：已合併｜完成：`web/src/` 開啟 typescript-eslint 的型別規則，原有 129 處全部改掉，網格判斷改用不外流 any 的 `isMesh`，畫面與行為不變｜等誰：—

- 日期：2026-11-24
- 類型：build
- 任務：TASK-182
- 核准：使用者 2026-11-22 在決定卡選「先做 4 和 6，5 和 7 等 3D 做完」；2026-11-23 說「好，你看一下目前正在跑的，等跑完你就去做」。協調者同日在 3D TASK-154 合併後放行，3D 串這段期間不動 `web/src/views/3d-viewer`

來自：[程式碼品質改善方案](https://claude.ai/artifact/Fb7Kq1AZeRKA5i3Huofpot)〈實作順序〉階段 5（ESLint 型別規則）

## 目的

原本的 ESLint 只看語法，看不到型別：three.js 的 `userData`、著色器 uniform 與 `instanceof THREE.Mesh` 收窄出來的 `Mesh<any, any, any>` 都是 any，any 一路外流後，型別檢查等於沒檢查。另外有 52 處型別斷言其實是多餘的。

## 範圍

- `eslint.config.js`：`web/src/**/*.ts` 加上 `recommendedTypeChecked`，以 `tsconfig.json` 取得型別。關掉 `unbound-method`：three.js 的 `onBeforeCompile`、`onBeforeRender` 等鉤子要先存下原本的函式，再以 `previous.call(this, …)` 串接或原樣放回，這條規則會把這種正確寫法全部當成錯（13 處都是）。
- 新增 `web/src/views/3d-viewer/rendering/three-guards.ts`：`isMesh`、`isLine`，執行時仍是 `instanceof`，型別收窄成預設的 `THREE.Mesh`、`THREE.Line`。3D 程式 12 處被規則抓到的網格與線段判斷改用它。
- 其餘改法：
  - 多餘的型別斷言與 `!` 拿掉（自動修正）；`Object.freeze(x) as 元組` 改寫成 `Object.freeze<元組>(x)`。
  - `userData` 讀出來的值先當 `unknown` 再判斷，或寫明型別；著色器 uniform 的 `.value` 寫明是 `Vector2`、`Matrix4` 或數字。
  - 水面高度的檢查由 `Number.isFinite(expected)` 改成先確認是數字，結果相同。
  - 模擬素材失敗的兩個載入函式由「沒有 await 的 async 函式丟錯」改成回傳 `Promise.reject(…)`，結果相同。
  - 進入漫遊按鈕的點擊處理改成 `() => void enterWalkthrough()`，明寫不等待（函式內已自行接住錯誤）。
  - 渲染類別錯誤訊息裡的值改用 `JSON.stringify` 顯示。
  - 設計概念頁拿掉多餘的 `ProjectModel` 轉型與引用。
- `docs/agents/workflow.md`：檢查說明補上型別規則。

不做：`tests/`、`core/`、`tools/` 的 `.mjs`（沒有型別資訊）；未用匯出清理（TASK-183 另開）。

## 驗收

- `npm run lint`（含型別規則，0 處）、`npm run build`（378 個單元測試）、`npm run test:e2e`、`git diff --check` 通過。
- 改動只在型別層或等價寫法，3D 畫面由 `test:e2e` 的冒煙測試與截圖涵蓋。
