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
- `geometry`：building、pool、roof、stair、combinedCubicle、solarReflection。
- `program`：入口、L1 廁所、L2 男女配置與 15＋5 單元。
- `entities`：跨輸出的穩定 ID registry。
- `sheets`：現行參照圖及其引用 ID。
- `sources`：來源路徑、像素與 SHA-256。

`scripts/reference-geometry.mjs` 是 L2 起點、外框、中央分流軸、樓梯定位與屋頂平面跨度的唯一推導層。模型保存基礎參數，consumer 使用推導結果，不保存結果常數。

`geometry.solarReflection` 是日照分析與各輸出的單一角度契約：`planRotation` 為由上往下看順時針 +9.5°、`mirrorLeanFromVertical` 為向泳池側外傾 +8.5°，兩者皆為 confirmed。概念掃描的 `azimuthTolerance` 28° 與 `minimumDownwardAngle` 8° 維持 working；整個物件連結 `OPEN-011`，表示旋轉支點、鏡牆牆高、材料與最終性能仍未解決。角度 consumer 不得另存預設答案。

`program.entrance` 以 `outdoorForecourtZoneId`、`arrivalPathEntityId` 與 `outdoorOpeningEntityIds` 表達戶外到達；不得再出現 `sharedVestibuleZoneId`。`referenceSystem.worldTransform.localOrigin` 必須精確維持 `[27, 0, 0]`，使 `RTE-L1-ARRIVAL-01` 從仍與 `O-SITE-01` 共點的 `EN-01` 門檻出發，在 `ST-01` 前轉至樓梯外側；validator 必須確認門檻連接、路徑 bounds 完整位於戶外前場內，並以路徑與樓梯 bounds 證明存在大於 `0.002 m` 的淨空，不得只信任 `accessConflicts` 布林值。`program.l1.dryPassage` 保存泳池大廳至兩樘後門的拓撲。`Z-L1-ENTRY-01` 為保留既有跨輸出引用而遷移的穩定 ID，其現行類型是 `outdoor-forecourt`，不再代表室內前室。

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
- `RTE-L1-ARRIVAL-01` 必須由 `[27, 0, 0]` 的 `EN-01`／`O-SITE-01` 共點門檻出發、完整位於戶外前場 bounds 內，並以大於 `0.002 m` 的淨空繞至 `ST-01` 外側；相切或次容差間距視為不合格，renderer 必須在樓梯之後繪製路徑，使其不被疊壓。
- 男女廁各有戶外前門與泳池側時段管制後門；同一廁所前後門不得正對。
- 泳池側乾式通道必須由泳池大廳連續通達兩樘廁所後門。
- 三個戶外開口使用 `OP-L1-PH-01`、`DR-L1-WC-M-FRONT-01`、`DR-L1-WC-F-FRONT-01`；泳池側後門使用 `DR-L1-WC-M-REAR-01`、`DR-L1-WC-F-REAR-01`，乾式通道使用 `PSG-L1-DRY-01`。
- validator 必須逐一鎖定 TASK-002 新增 entity 的 `type`、`level`、`status` 與完整 expected `sourceIds`。實際來源必須唯一、長度相等且與 expected 雙向集合相等（順序可忽略）；任何 entity 不得漂移成屋頂、RF、legacy、無來源記錄、額外來源或重複來源。
- `REF-101` 中每個 TASK-002 entity 只能對應一個 `<g data-entity>` 互動目標；該 group 必須具有 `tabindex="0"`、`role="button"` 與以 entity ID 開頭的 `aria-label`，子圖形不得重複宣告 `data-entity`。
- `OPEN-008` 關閉前，`REF-101` 的前場、通道與門位置只表達已確認拓撲，不宣稱精確尺寸；示意 bounds 統一由 geometry helper 推導。
- `Z-CS-M-01` 與 `Z-CS-F-01` 嚴格分離，男女各 15 間正式單元及 5 間擴充位置。
- 每間單元整合更衣、淋浴與壁掛櫃；`centralLockerArea` 必須為 `false`。
- `ST-01` 為兩段、雙鋼梯梁、透明欄杆、乾式玻璃廊、梯下開放，且不由屋頂承重。
- L2 外框由原核心與 `EXT-L2-01` 組成；擴建量體下方 L1 保持開放。
- `RF-GL-01` 由泳池遠端以 10° 上升至 L2 擴建邊緣，平面跨度由 `l2ExtensionLength` 推導。
- `RF-GL-01` 標高與 `J-RF-L2-01` 在 `OPEN-010` 關閉前維持 `deferred`，且與擴建量體結構獨立。
- `F-MIR-01` 是 `EXT-L2-01` 低 X 面池端鏡面反射牆；2F 由上往下看順時針 +9.5°、牆面由垂直向泳池側外傾 +8.5°，兩者由 `geometry.solarReflection` 保存為 confirmed。旋轉支點、牆高、材料、分格與最終性能仍由 `OPEN-011` 管理，不得以角度確認取代這些待決事項。
- `REF-401` 可使用明確標示為 display-only 的 SVG 偏移表達屋頂、入口戶外區與鏡牆概念關係；consumer 不得把偏移換算為設計尺寸。

## 6. 模型驗證門檻

`npm run validate:reference` 至少確認：

1. entity、sheet、source ID 唯一且所有引用存在。
2. 來源檔案存在，像素與 SHA-256 符合登錄。
3. 建築長度等於泳池大廳加服務核心，池體位於泳池大廳內。
4. 男女 15＋5、整合機能、壁掛櫃及無集中櫃區成立。
5. 樓梯、屋頂、分區與結構獨立規則成立；入口路徑與樓梯 bounds 不相交也不相切，且淨空大於零。
6. 修改 `l2ExtensionLength` 後，L2 起點、外框、分流軸、樓梯與屋頂跨度同步更新。
7. deferred 量測具有 OPEN ID 且沒有數值。
8. consumer 需要的 entity 與 sheet 引用完整。
9. `geometry.solarReflection` 精確保存 confirmed +9.5°／+8.5°、方向、working 判讀門檻及 `OPEN-011` 關聯；legacy `mirrorFacade`、`leanAngle` 或 display-only geometry 欄位仍不得成為第二套答案。

尚未符合本契約的已知模型／輸出差異，不在本文件偽裝成另一套答案；其執行狀態由 [07｜Active Work](07_ACTIVE_WORK.md) 管理。
