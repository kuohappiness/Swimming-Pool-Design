# 服務核心第一階段修正實作計畫

- 日期：2026-07-14
- 依據：[服務核心第一階段修正設計](2026-07-14-service-core-first-revision-design.md)
- 狀態：執行中
- 範圍：`DEC-022`～`DEC-026`、`DB-003`
- 排除：`OPEN-009` 專業結構／機電細節、`OPEN-010` 屋頂交界構造

## 1. 實作原則

1. `model/project-model.json` 只保存基礎參數、狀態、來源及穩定 ID；L2 起點、外框、中央分流軸、樓梯 X 定位及屋頂平面跨度由單一純函式推導。
2. `building.l2ExtensionLength = 5.0 m` 是可修改的 `working` 值。renderer 不得各自硬編碼 19.0、16.0、27.0 或 19.04。
3. 屋頂高低標高以 `deferred + OPEN-010` 表達，不使用數值 fallback。第一階段只畫 10° 坡向、平面終點及待決交界。
4. 每一項模型規則先加入會失敗的 Node test，再修改模型／validator／renderer 使其通過。
5. 六張圖只讀同一模型與同一推導結果；方位 transform 只套用一次。

## 2. 任務一：核准狀態與模型契約同步

**檔案**

- 修改：`docs/specs/2026-07-14-service-core-first-revision-design.md`
- 修改：`docs/05_MODEL_AND_VIEWER_CONTRACT.md`
- 修改：`docs/06_WORKFLOW_AND_VERSIONING.md`

**步驟**

1. 將設計規格狀態改為「已核准」。
2. 在模型契約加入 `working` 擴建基礎參數、可為 `deferred` 的無數值量測、`openItemId`、純推導幾何及新穩定 ID。
3. 將舊「屋頂固定 +6.000／+10.231 m」契約改為：10° 已確認、平面終點由擴建參數推導、垂直標高由 `OPEN-010` 管理。
4. 在工作流程補上「基礎參數變更時執行可變參數測試」與「deferred 不得以 fallback 代填」。

**驗證**

- `rg -n "10\.231|6\.000|127°" docs/05_MODEL_AND_VIEWER_CONTRACT.md docs/06_WORKFLOW_AND_VERSIONING.md`
- 搜尋結果只能出現在清楚標示的歷史／禁止沿用敘述。

## 3. 任務二：建立單一幾何推導層

**檔案**

- 新增：`scripts/reference-geometry.mjs`
- 新增：`scripts/reference-geometry.d.mts`
- 修改：`tests/reference-model.test.mjs`

**先寫失敗測試**

1. 首版 5.0 m 擴建應推導：L2 起點 19.0、L2 長度 16.0、中央軸 27.0、屋頂平面跨度 19.0、樓梯起點 19.04。
2. 將擴建值改成 4.0 m 時，上述結果必須一起改成 20.0、15.0、27.5、20.0、19.54，證明 renderer 不依賴首版結果常數。
3. 缺少或超出可用泳池大廳的擴建值必須回報錯誤，不產生合理-looking fallback。

**實作**

建立 `deriveReferenceGeometry(model)`，輸出：

- `l1ServiceStartX`
- `l2StartX`、`l2EndX`、`l2Length`
- `l2SplitAxisX`
- `maleL2Bounds`、`femaleL2Bounds`
- `stairTotalRun`、`stairStartX`、`stairEndX`
- `roofPlanStartX`、`roofPlanEndX`、`roofPlanRun`

所有輸出由模型基礎值計算並在非有限數、負值或越界時拋出具體錯誤。

**驗證**

- `node --test tests/reference-model.test.mjs`

## 4. 任務三：升級模型、穩定 ID 與 validator

**檔案**

- 修改：`model/project-model.json`
- 修改：`scripts/reference-validation.mjs`
- 修改：`tests/reference-model.test.mjs`

**模型變更**

1. 將 `modelVersion` 更新為 `0.1.0-atlas.2`、revision 更新為 `2026-07-14`。
2. `localLongAxisBearingFromTrueNorth` 與 `worldTransform.rotationFromTrueNorth` 同步改為 307。
3. 新增唯一基礎值 `geometry.building.l2ExtensionLength = 5.0 m`；不保存 L2 起點、長度或分流軸結果。
4. 樓梯模型保留 Y、Z 與踏步基礎參數，X 起點／終點改由推導層提供。
5. 屋頂高低標高改成 `{ value: null, status: "deferred", openItemId: "OPEN-010" }`；高邊語意改為 L2 擴建邊緣。
6. L1 男女廁加入 `side`、前門來源、泳池側後門時段管制及 `doorsDirectlyAligned: false`。
7. L2 男女區加入 lower-X／higher-X 分區語意。
8. 新增 `Z-L1-ENTRY-01`、`EXT-L2-01`、`J-RF-L2-01`，並把它們加入對應 sheet reference。

**validator 與失敗案例**

- 307° 兩欄不一致時失敗。
- 5.0 m 擴建無來源、非正值或超界時失敗。
- L1 不是男 lower-X／女 higher-X、缺少前後門、後門非時段管制或門正對時失敗。
- L2 不是左右嚴格分離、樓梯終點不等於中央分流軸時失敗。
- 屋頂高低標高不是 `deferred + OPEN-010`、仍含數值或高邊不是擴建邊緣時失敗。
- 新 entity 缺失或未被必要圖面引用時失敗。

**驗證**

- `npm run validate:reference`
- `npm test`

## 5. 任務四：TypeScript 型別與共用繪圖工具

**檔案**

- 修改：`reference/src/types.ts`
- 修改：`reference/src/geometry.ts`
- 修改：`reference/src/styles.css`

**步驟**

1. 將量測型別改為數值量測與 deferred 量測的 discriminated union；deferred 必須帶 `openItemId`。
2. 從 `scripts/reference-geometry.mjs` 取得同一推導結果，renderer 不重算第二套公式。
3. 將 `cubicleMarkup` 改為接受男女 zone bounds，使 15＋5 單元可配置在左右兩區，而不是依賴固定 `serviceStart=24`。
4. 新增共用的門扇、視線遮擋、時段管制、L2-only extension、deferred joint 標記及圖例樣式。
5. `deferred` 元素在畫面上有明顯虛線／待決色彩，並能沿用工作值顯示開關邏輯。

**驗證**

- `npm run build`

## 6. 任務五：修正基地與 L1 圖面

**檔案**

- 修改：`reference/src/sheets.ts`
- 修改：`tests/reference-model.test.mjs`

**REF-001**

- 使用模型 307° transform 旋轉整棟建築，不個別鏡射核心或入口。
- `CORE-01` 對準綠色原廁所基地，`EN-01` 對準紅箭頭，說明文字不得再硬編碼 127°。

**REF-101**

- L1 核心仍為 X=24.0～35.0 m，男女廁改為沿 X 左右分區：男 lower-X、女 higher-X。
- `Z-L1-ENTRY-01` 以 deferred 方形共用前室表示，不標註未確認尺寸。
- 男女各畫一樘操場側前門與一樘泳池側時段管制後門；同一廁所的兩門錯位並以短遮擋牆阻斷直視。
- `ST-01` 由推導位置繪製，與四樘門及共用前室保持可辨識的獨立動線。

**測試／檢查**

- renderer 輸出包含三個新 ID、四樘門語意、時段管制及 deferred 標記。
- 以 4.0 m 擴建 clone 渲染時，樓梯與 L2 衍生位置同步改變。

## 7. 任務六：修正 L2 左右分流與 15＋5 配置

**檔案**

- 修改：`reference/src/sheets.ts`
- 修改：`reference/src/geometry.ts`
- 修改：`reference/src/styles.css`
- 修改：`tests/reference-model.test.mjs`

**步驟**

1. `REF-201` 畫出 `EXT-L2-01` 與原核心上方整合的 X=19.0～35.0 m L2 外框；X=19.0～24.0 m 以視覺語彙標示為二樓專用擴建。
2. 男區使用 lower-X bounds、女區使用 higher-X bounds；E 軸中央配置 `Z-L2-LOBBY-01` 與 `ST-01` 上端。
3. 男女入口錯位，不能互相或由樓梯正視更衣空間。
4. 每區重新排入 15 個正式單元與 5 個擴充位置，維持壁掛櫃、無集中櫃區。
5. 圖面尺寸由推導結果產生，5.0 m 改變時外框、分界及樓梯同步更新。

**驗證**

- Node 測試檢查每性別 15＋5 ID 完整且不重複。
- renderer 測試檢查男女 zone bounds 不重疊、面積相等、樓梯終點位於分界。

## 8. 任務七：修正屋頂、剖面與 3D

**檔案**

- 修改：`reference/src/sheets.ts`
- 修改：`reference/src/styles.css`
- 修改：`tests/reference-model.test.mjs`

**REF-301**

- 玻璃屋頂平面只畫 X=0～`l2StartX`；擴建量體從 `l2StartX` 開始。
- 移除 +6.000／+10.231 標籤，改標「標高待 OPEN-010」。
- 在高邊加入 `J-RF-L2-01` deferred 標記。

**REF-401**

- 畫出 X=`l2StartX`～35.0 的 L2 量體與其下方 L1 開放區。
- 屋頂以 10° 向左下的示意線終止於擴建邊緣；接點使用 deferred 樣式，不輸出施工密封細節或最終標高。
- 樓梯由推導位置到達中央分流軸。

**REF-501**

- 分開顯示綠色原核心與紅色 L2-only 擴建量體。
- 玻璃屋頂只到擴建邊緣，擴建與屋頂結構視覺上獨立。
- 3D 點位全部使用推導 bounds，禁止 19、24、27、35 的重複布局常數（整體 building end 除外）。

**驗證**

- 測試確認三張圖都引用 `EXT-L2-01`、`RF-GL-01` 與 `J-RF-L2-01`。
- 測試確認輸出不含 `LOW 6.000`、`HIGH 10.231` 或把交界描述為已密封。

## 9. 任務八：整體驗收與文件收尾

**檔案**

- 修改：`README.md`
- 修改：`docs/specs/2026-07-14-service-core-first-revision-implementation-plan.md`
- 視需要修改：`reference/src/styles.css`

**自動檢查**

```powershell
npm run validate:reference
npm test
npm run build
git diff --check
```

**瀏覽器 smoke**

1. 桌面與手機寬度逐張開啟 `REF-001`～`REF-501`。
2. 確認圖面切換、ID 點選、工作值開關、捲動及 detail panel 正常。
3. 視覺核對 307°、L1 左右廁所與雙向門、L2 擴建與中央分流、10° 屋頂邊界、L1 開放區及 deferred joint。
4. 特別確認沒有舊 127°、上下男女分區、24.0 m 屋頂跨度或 +6.000／+10.231 當前標高。

**完成條件**

- 把本計畫狀態改為「已完成」，記錄驗證結果與 Demo：`npm run dev` → `reference/index.html`。
- `OPEN-009`、`OPEN-010` 保持未決，第一階段不新增施工式屋頂接縫細節。
