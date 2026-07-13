# 05｜模型與 Viewer 契約

## 1. 現行成果與技術

新的成果不是一張外觀示意圖，而是設計資料的可驗證呈現。現行第一步為可縮放 SVG／HTML 空間參照圖集；下一步可信即時 3D Viewer 必須沿用相同 ID、尺寸、來源與 `modelVersion`。

- TypeScript
- Vite
- 原生 HTML／SVG／CSS，不使用 React
- Node 內建 test runner
- 靜態 build，可部署至 GitHub Pages

## 2. 單一模型資料

`model/project-model.json` 是現行唯一幾何與參照模型。圖面 renderer、驗證器與未來 3D／DXF 不得另寫一套尺寸常數。

模型至少包含：

- `referenceSystem`：世界軸、本地 transform、levels、grids、origin。
- `geometry`：building、pool、roof、stair、combinedCubicle。
- `program`：L1 廁所、L2 男女配置、15＋5 單元。
- `entities`：跨圖穩定 ID registry。
- `sheets`：六張圖與引用 ID。
- `sources`：來源路徑、像素與 SHA-256。

## 3. 狀態與溯源

影響幾何的數值使用以下狀態：

```ts
type Status = 'confirmed' | 'working' | 'deferred' | 'legacy';
type Measure = { value: number; status: Status; sourceIds: string[] };
```

使用者看到清楚數字；驗證程序能知道數值是否已確認、來自何處、能否修訂。

## 4. 座標與空間參照

- 世界座標：`+X` 東、`+Y` 北、`+Z` 上。
- 建築本地長軸與真北夾角由 `localLongAxisBearingFromTrueNorth` 管理。
- `O-SITE-01` 與 `EN-01` 門檻中心共點，世界座標 `(0,0,0)`。
- 圖面使用 `L1/L2/RF`、格網 `A–F/1–4` 及 entity ID。
- 任何 Three.js `Y-up` 轉換只存在於單一 adapter，不改業務資料定義。

## 5. 參照圖集契約

`reference/index.html` 必須提供：

- `REF-001` 基地與方位。
- `REF-101` L1 平面。
- `REF-201` L2 平面與男女各 15＋5 單元。
- `REF-301` 玻璃屋頂範圍及坡向。
- `REF-401` 樓梯與屋頂縱剖面。
- `REF-501` 3D 軸測。
- modelVersion、revision、單位、北向及概念用途聲明。
- 點選 entity／cubicle ID 顯示資料，不依賴 hover。
- 手機橫向捲動與清楚標籤。

## 6. 空間硬性規則

- `EN-01` 是唯一日常人員入口。
- `Z-CS-M-01` 與 `Z-CS-F-01` 嚴格分離。
- 男女各 15 間正式整合單元，各 5 間擴充位置。
- 每間整合更衣、淋浴與壁掛櫃；`centralLockerArea` 必須為 `false`。
- `ST-01` 兩段、雙鋼梯梁、透明欄杆、乾式玻璃廊、梯下開放，不由屋頂承重。
- `RF-GL-01` 只覆蓋 `Z-PH-01`，坡度 10°，服務核心端高。

## 7. 未來可信 3D Viewer

3D Viewer 在圖集模型穩定後加入，至少提供 Orbit、平移、縮放、Home、頂視／透視／主要立面、北向、圖層、尺寸、ID 選取、模型版本與載入錯誤狀態。它不得把圖集 SVG 反向解析成幾何；應直接讀同一 model。

## 8. DXF 契約

DXF 在後續里程碑由同一模型產生，至少包含基地／建築、池體、分區、屋頂、主要尺寸、北向、圖名、modelVersion 與單位。建議圖層：`SITE`、`BUILDING`、`POOL`、`PROGRAM`、`ROOF`、`DIMENSIONS`、`ANNOTATIONS`、`DEFERRED`。

## 9. 驗證門檻

`npm run build` 依序執行模型驗證、單元測試及 Vite build，必須確認：

1. entity、sheet、source ID 唯一且引用存在。
2. 來源圖檔存在且 SHA-256 一致。
3. 建築長度等於泳池大廳加服務核心。
4. 池體完整位於泳池大廳內。
5. 男女 15＋5、整合機能、壁掛櫃及無集中櫃區成立。
6. 樓梯與屋頂硬性規則成立。
7. 六張必要圖面存在。
8. 手機與桌面人工 smoke 通過。
