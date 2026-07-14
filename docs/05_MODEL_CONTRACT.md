# 05｜模型契約

## 1. 目的

`model/project-model.json` 是現行幾何、參照、程式需求、實體、圖面與來源的唯一機器可讀模型。renderer、validator、互動頁及未來輸出不得各自保存第二套尺寸、方位、版本或來源答案。

現行輸出契約分開管理：

- [空間參照圖集契約](contracts/reference-atlas.md)
- [太陽研究契約](contracts/solar-study.md)

3D Viewer 或 DXF 進入 active work 後才建立各自的正式輸出契約。

## 2. 模型結構

模型至少包含：

- `referenceSystem`：單位、世界軸、本地 transform、基地位置、樓層、格網與原點。
- `geometry`：building、pool、roof、stair、combinedCubicle。
- `program`：入口、L1 廁所、L2 男女配置與 15＋5 單元。
- `entities`：跨輸出的穩定 ID registry。
- `sheets`：現行參照圖及其引用 ID。
- `sources`：來源路徑、像素與 SHA-256。

`scripts/reference-geometry.mjs` 是 L2 起點、外框、中央分流軸、樓梯定位與屋頂平面跨度的唯一推導層。模型保存基礎參數，consumer 使用推導結果，不保存結果常數。

## 3. 狀態與溯源

```ts
type Status = 'confirmed' | 'working' | 'deferred' | 'legacy';
type NumericMeasure = {
  value: number;
  status: Exclude<Status, 'deferred'>;
  sourceIds: string[];
};
type DeferredMeasure = {
  value: null;
  status: 'deferred';
  sourceIds: string[];
  openItemId: string;
};
type Measure = NumericMeasure | DeferredMeasure;
```

有依據的值顯示明確數字；未定值必須以 `deferred` 與真正存在的 OPEN ID 表達，不得用看似合理的 fallback 代填。來源 ID 必須在 `sources` 存在，檔案像素與雜湊必須與登錄一致。

## 4. 座標與跨輸出不變條件

- 世界座標：`+X` 東、`+Y` 北、`+Z` 上。
- 建築本地長軸方位由 `localLongAxisBearingFromTrueNorth` 管理。
- `O-SITE-01` 與 `EN-01` 到達門檻中心共點，世界座標 `(0,0,0)`。
- 圖面使用 `L1/L2/RF`、格網 `A–F/1–4` 與穩定 entity ID。
- 任何圖形函式庫座標 adapter 只能存在一處，不改變業務資料的世界軸定義。
- 方位 transform 只能套用一次；固定建築、2F、圖集與互動頁使用同一基準。
- `modelVersion`、revision、單位、方位與來源不得由 consumer 另寫。

## 5. 空間硬性規則

- `EN-01` 是由校園／操場到達 L1 戶外前場的日常到達入口，不是室內共用前室入口。
- L1 戶外前場分別提供泳池大廳、男廁、女廁三個獨立開口。
- 男女廁各有戶外前門與泳池側時段管制後門；同一廁所前後門不得正對。
- 泳池側乾式通道必須由泳池大廳連續通達兩樘廁所後門。
- `Z-CS-M-01` 與 `Z-CS-F-01` 嚴格分離，男女各 15 間正式單元及 5 間擴充位置。
- 每間單元整合更衣、淋浴與壁掛櫃；`centralLockerArea` 必須為 `false`。
- `ST-01` 為兩段、雙鋼梯梁、透明欄杆、乾式玻璃廊、梯下開放，且不由屋頂承重。
- L2 外框由原核心與 `EXT-L2-01` 組成；擴建量體下方 L1 保持開放。
- `RF-GL-01` 由泳池遠端以 10° 上升至 L2 擴建邊緣，平面跨度由 `l2ExtensionLength` 推導。
- `RF-GL-01` 標高與 `J-RF-L2-01` 在 `OPEN-010` 關閉前維持 `deferred`，且與擴建量體結構獨立。

## 6. 模型驗證門檻

`npm run validate:reference` 至少確認：

1. entity、sheet、source ID 唯一且所有引用存在。
2. 來源檔案存在，像素與 SHA-256 符合登錄。
3. 建築長度等於泳池大廳加服務核心，池體位於泳池大廳內。
4. 男女 15＋5、整合機能、壁掛櫃及無集中櫃區成立。
5. 樓梯、屋頂、分區與結構獨立規則成立。
6. 修改 `l2ExtensionLength` 後，L2 起點、外框、分流軸、樓梯與屋頂跨度同步更新。
7. deferred 量測具有 OPEN ID 且沒有數值。
8. consumer 需要的 entity 與 sheet 引用完整。

尚未符合本契約的已知模型／輸出差異，不在本文件偽裝成另一套答案；其執行狀態由 [07｜Active Work](07_ACTIVE_WORK.md) 管理。
