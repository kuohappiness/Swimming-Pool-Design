# 05｜模型契約

## 1. 單一來源

`model/project-model.json` 是現行幾何、版本、程式需求、圖面與來源的唯一機器可讀模型。所有 consumer 必須先呼叫 `scripts/active-geometry.mjs` 的 `resolveActiveGeometry()`；不得直接讀取 `v050Study`／`v060Study`、依檔名或日期猜最新版，也不得在解析失敗時 fallback 到舊版。

現行版本契約：

- `schemaVersion = 1.3.0`
- `modelVersion = designTargetVersion = 0.6.1`
- `activeGeometryRevisionId = GEO-0.6.1`
- active revision 的 `id` 必須只出現一次，且 `revision`、`modelVersion` 均須等於頂層 `modelVersion`。
- legacy revision 可保存歷史，但不得有任何 `activeForViewer` 或隱含最新版語意。

## 2. SITE-XY

對外幾何只准使用 `SITE-XY`：X0～X41、Y0～Y14、圖面 Y 向上。每個帶 `bounds` 的 active 物件必須宣告：

```ts
type SiteBoundsEntity = {
  entityId: string;
  coordinateSystemId: 'SITE-XY';
  bounds: { x1: number; x2: number; y1: number; y2: number };
};
```

不變條件：

1. `bounds` 面積必須為正，所有數值必須有限。
2. 同一 active revision 內 `entityId` 不得重複。
3. `referenceSystem.coordinateSystems` 必須恰有一個 `SITE-XY`。
4. 圖面、Viewer、分析與驗證均由同一 bounds 推導，不得另存第二套 `originY`。
5. Three.js 只在右手座標 `SITE-XYZ-TO-THREE-RH` adapter 轉成 SITE X→Three X、SITE Y→Three −Z、SITE Z→Three Y；不得使用會鏡射 Y0／Y14 的 `SITE Y→Three +Z`。
6. 世界方位 307°只在 Viewer 最上層 root 套用一次；L3 +25.5°是獨立局部 transform。

Viewer 的 `ST-01` 只可攜帶 active canonical `bounds`；`startX`、`originY`、`width` 等可由 bounds 重建的欄位不得再輸出。Viewer adapter 必須逐次驗證 stair bounds 等於 `entityBounds.ST-01.bounds`，且 `ST-01.y2 <= POOL-01.y1`，否則 fail closed。

`resolveActiveGeometry()` 在 active ID 缺失／找不到／重複、版本不符、SITE-XY 缺失、entity ID 重複、coordinate system 缺失或 bounds 非法時必須直接失敗。

## 3. Active geometry 必要實體

| Entity | Canonical SITE-XY bounds |
| --- | --- |
| `SITE-01` | X0～X41／Y0～Y14 |
| `BLDG-01` | X0～X39／Y0～Y14 |
| `Z-PH-01` | X0～X31／Y0～Y14 |
| `POOL-01` | X3～X28／Y4～Y12.5 |
| `CORE-01` | X31～X39／Y0～Y14 |
| `Z-L1-SETBACK-01` | X39～X41／Y0～Y14 |
| `L2-PLATE-01` | X29～X41／Y0～Y13.5 |
| `L3-PLATE-01` | X29～X41／Y0～Y13.5 |
| `RF-GL-01` | X0～X29／Y0～Y14 |
| `ST-01` | X20.5～X29／Y0.5～Y2.0 |

四間廁所、儲物、水處理與藥劑分間的 bounds 以 [03｜設計基準](03_DESIGN_BASIS.md)為準。`geometryEntities()` 必須能由 active revision 建立唯一 entity map；任何輸出所報 bounds 必須與 map 一致。

## 4. 衍生層與輸出

- `scripts/reference-geometry.mjs`：從 active revision 衍生圖面與共用尺寸。
- `scripts/viewer-data.mjs`：產生 `reference/generated/viewer-model.json`，包含 `modelVersion`、`activeGeometryRevisionId`、`coordinateSystemId`、`modelHash` 與 `entityBounds`。
- `scripts/build-public-content.mjs`：只允許 `{{active:...}}` token 讀 active geometry；未解析 token 必須使 build 失敗。
- `scripts/generate-v060-drawings.mjs`：產生三張平面與一張縱剖 SVG，之後轉為 PNG。
- 日照角度與能量分析：由 active L3、鏡牆、屋頂與池體 bounds 推導，不得持有第二套池體或舊角度預設。

每次模型改動都會改變 canonical SHA-256 `modelHash`。`model/analysis-registry.json` 的 solar hash 不符時，Viewer 必須標成 `stale`；完成重算與測試後才能更新為 current。

## 5. 現行硬性規則

- `POOL-01` 為 25.0 × 8.5 m，完整位於泳池大廳內，且不與 `ST-01` 或服務翼重疊。
- L1 具有四間互不相通廁所；泳池組恰有兩個 X31 入口，操場組恰有兩個 X39 入口。四個入口皆為 1.00 m 無門板開口，男廁入口／洗手台靠低 Y，女廁入口／洗手台靠高 Y；所有 WC 個別隔間保留門板。
- 服務區 L1～L3 所有不透明量體採清水模材質意圖；玻璃屋頂與 L3 鏡牆不得被清水模材質覆蓋。
- 藥劑分間 `publicAccess=false` 且 `separateVentilation=true`。
- 結構策略 `isolatedColumnsAllowed=false`、`glassCarriesGravityLoad=false`。
- `ST-01` 是方案 E：2.70＋3.10＋2.70 m、20 級高／18 踏面，從 +0.30 m 在 X29 直接接 L2 +3.30 m。
- L2 固定；只有 L3 以 X35／Y6.75 水平旋轉 +25.5°。
- 鏡面覆層與 L3 面池承載牆共面，共同外傾 +23.0°；不得畫成垂直牆前的獨立斜板。
- 固定玻璃屋頂為 29 m／5°／+4.00→+6.537 m，不承擔 L2、L3 或樓梯荷重。
- 高位重物只放在固定核心或直接支承線，不放在旋轉懸挑或鏡牆。
- `integrationReview.professionalApprovals` 的建築、結構、機電、消防與無障礙在正式簽證前全部必須為 `false`。

## 6. 現行 sheet 契約

`model.sheets` 只保留：

1. `REF-001`
2. `V061-L1`
3. `V061-L2`
4. `V061-L3`
5. `V061-SECTION`

v0.5.0 圖檔可留在歷史資料夾，但不得出現在 current atlas 或 Viewer／solar-study 的最新圖面連結。

## 7. 驗證門檻

`npm run validate:reference` 至少檢查：

1. active selector、版本與 SITE-XY fail-closed 規則。
2. canonical entity bounds、空間包含與碰撞。
3. 四間廁所、入口方向、設備與結構整合旗標。
4. 樓層、屋頂、ST-01、L3／鏡牆角度及日照工作結果。
5. current sheet 清單與 entity／sheet／source ID 唯一。
6. 所有來源檔存在且 SHA-256、byteSize（若登錄）一致。
7. 概念整合狀態不得冒充任何專業核定。

`npm test` 另須以破壞性 clone 回歸 active ID 缺失、unknown、duplicate、version drift、SITE-XY 缺失、entity duplicate 與 coordinate frame 缺失；不得只做成功快照。

相關輸出契約：

- [空間參照圖集](contracts/reference-atlas.md)
- [太陽研究](contracts/solar-study.md)
- [3D Viewer](contracts/3d-viewer.md)

本契約管理概念資料一致性，不取代建築、結構、機電、消防、無障礙、材料或施工專業驗證。
