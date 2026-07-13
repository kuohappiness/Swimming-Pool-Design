# 05｜模型與 Viewer 契約

## 1. 目的

新的 Viewer 不是一張看起來像建築的 3D 圖，而是設計資料的可驗證呈現。模型、3D 場景、尺寸標註及 DXF 必須共享同一份資料與版號。

第一階段技術組合：

- TypeScript
- Three.js
- Vite
- Playwright
- 靜態 HTML／JavaScript 成果，可部署到 GitHub Pages
- 不使用 React

## 2. 單一模型資料

權威資料預定存放於 `model/project-model.json`，並由 TypeScript schema 在建置時驗證。不得在 Viewer 或 DXF 產生器內另寫一套尺寸常數。

概念結構：

```json
{
  "schemaVersion": "1.0.0",
  "modelVersion": "0.1.0",
  "units": "m",
  "coordinateSystem": { "x": "east", "y": "north", "z": "up" },
  "site": {
    "northRotationDeg": null,
    "satelliteCalibration": null,
    "sourceIds": ["SRC-SITE-001"]
  },
  "building": {},
  "pool": {},
  "program": {},
  "zones": {},
  "decisions": {},
  "provenance": {}
}
```

`null` 可以代表尚未完成的待決或校準資料，但必須在 `decisions` 或驗證訊息中對應到一個 OPEN ID。禁止以 `0`、空字串或歷史值冒充已決定資料。

## 3. 數值溯源

每個會影響幾何或標註的欄位，必須能追溯：

```ts
type Provenance = {
  status: 'confirmed' | 'working' | 'deferred' | 'legacy';
  sourceIds: string[];
  basis: string;
  revision: string;
};
```

使用者看到的是清楚的尺寸；開發者與驗證程序看到的是尺寸為何存在、何時修訂、能否進入正式場景。

## 4. 座標與方位

- Three.js 場景的資料座標採 `+X` 東、`+Y` 北、`+Z` 上。
- 若 Three.js 內部實作採 `Y-up`，必須集中在一個轉換模組處理，業務資料不得改變定義。
- Viewer 必須顯示北向指標。
- 標準頂視圖必須使北向可辨識，不能只以螢幕上方作為未說明的北。
- DXF 的座標方向與模型資料一致，輸出標題區註明單位為公尺。

## 5. 幾何模組邊界

建議程式結構：

```text
src/
├─ model/schema.ts
├─ model/load-project-model.ts
├─ geometry/build-site.ts
├─ geometry/build-pool.ts
├─ geometry/build-building.ts
├─ geometry/build-roof.ts
├─ geometry/build-program-zones.ts
├─ viewer/create-viewer.ts
├─ viewer/layers.ts
├─ viewer/annotations.ts
├─ viewer/north-indicator.ts
└─ export/build-dxf.ts
```

每個 geometry builder 只接收已驗證的模型資料並回傳場景物件，不讀 DOM、不自行讀 JSON，也不保存另一套預設尺寸。

## 6. Viewer 必備功能

第一個可信 Viewer 必須提供：

- Orbit 旋轉、平移與縮放。
- `Home`／重設標準視角。
- 頂視、透視與至少一個主要立面視角。
- 北向、比例參考、模型版號及資料載入狀態。
- 建築外殼、池體、水面、玻璃屋頂、服務區域、尺寸與來源底圖的圖層切換。
- 主要尺寸與水深標註。
- 全域「概念設計，非施工用途」說明。
- 待決區域使用獨立圖層與明顯不同的視覺語言。
- 載入或驗證失敗時顯示可理解的錯誤，不渲染一個看似正常的錯誤模型。

Viewer 必須支援桌面與手機寬度；控制列不能遮住主要畫面或北向指標。

## 7. 信任指標

畫面至少顯示：

- `modelVersion`
- 模型資料最後修訂 ID
- 單位
- 北向
- 當前啟用圖層
- 是否包含待決區域

Debug 模式可顯示物件 ID、座標與 provenance，但一般模式不必把內部狀態塞進每個尺寸標籤。

## 8. 玻璃屋頂契約

玻璃屋頂必須由 `poolHall` zone 產生：

- 平面投影不得超出泳池大廳定義範圍。
- 不得覆蓋 `toilet`、`changing`、`shower` 或其他 service zones。
- 屋頂坡度使用 `roof.pitch = 10°`。
- 在 OPEN-004 決定前，不生成假定高低側的正式屋面；可顯示不帶坡向承諾的待決體塊。

## 9. DXF 契約

DXF 與 Viewer 在同一次建置中由同一模型產生，至少包含：

- 基地／建築外輪廓
- 池體外輪廓
- 空間分區
- 主要尺寸
- 北向
- 圖名、模型版號、單位及概念用途聲明

建議圖層：`SITE`、`BUILDING`、`POOL`、`PROGRAM`、`ROOF`、`DIMENSIONS`、`ANNOTATIONS`、`DEFERRED`。

## 10. 驗證門檻

每次可發布變更至少通過：

1. JSON schema 驗證。
2. 所有有效尺寸為有限正數，深端深度大於淺端。
3. pool 位於建築／泳池大廳允許邊界內。
4. 玻璃屋頂只覆蓋 pool hall。
5. deferred 欄位均對應 OPEN ID，沒有隱藏預設值。
6. Viewer 載入成功、標準視角可用、圖層切換可用。
7. Viewer 與 DXF 顯示相同 modelVersion。
8. 手機與桌面 smoke test 通過。

完整檢查表見 [model-validation reference](../.codex/skill/references/model-validation.md)。
