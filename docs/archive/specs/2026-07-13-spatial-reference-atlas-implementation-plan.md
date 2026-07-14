# 空間參照圖集實作計畫

- 日期：2026-07-13
- 類型：implementation-plan
- 狀態：completed
- 任務：legacy
- 目標版本：0.1.0-atlas.1
- 完成日期：2026-07-13
- 依據：[空間參照圖集設計規格](2026-07-13-spatial-reference-atlas-design.md)

## 1. 本輪成果

建立第一版可立即瀏覽的空間參照圖集，包含：

- `REF-001` 基地與方位圖
- `REF-101` L1 平面參照圖
- `REF-201` L2 平面參照圖
- `REF-301` 屋頂參照圖
- `REF-401` A–A 剖面參照圖
- `REF-501` 3D 軸測參照圖

所有圖面由 `model/project-model.json` 驅動，使用相同的 ID、尺寸、狀態、來源與 modelVersion。圖集入口為 `reference/index.html`，開發時使用 `npm run dev`，靜態成果由 `npm run build` 產生。

## 2. 首版工作幾何

以下數值直接用於首版圖集，狀態為 `working`，未來可由新證據修訂：

| 項目 | 數值 |
| --- | --- |
| 整體建築 | 35.0 × 13.5 m |
| 泳池大廳 | 24.0 × 13.5 m |
| 服務核心 | 11.0 × 13.5 m |
| 主泳池 | 20.5 × 7.5 m |
| L2 完成面 | 3.6 m |
| 玻璃屋頂低側 | 6.0 m |
| 玻璃屋頂坡度 | 10° |
| 玻璃屋頂高側 | 10.23 m |
| 懸浮樓梯淨寬 | 1.8 m |
| 樓梯 | 22 階、踏面 0.28 m、兩段各 11 階、中間平台 1.8 m |
| 整合式更衣淋浴單元 | 1.0 × 1.8 m |
| 男女基本單元數 | 各 15 間 |
| 男女擴充上限 | 各 20 間 |
| 單元壁掛櫃 | 0.45 × 0.35 × 0.45 m，底部高度 0.9 m |

## 3. 已確認空間規則

- `EN-01` 是唯一日常人員入口；其他門只供逃生、設備維修或後勤。
- L1 原廁所基地拆除重建為男女廁所及服務核心。
- L2 男、女更衣淋浴區完全分離，沒有內部串通動線。
- 每一間整合式單元同時提供更衣、淋浴與壁掛置物櫃。
- 不設集中式置物櫃區。
- `ST-01` 為共用樓梯，沿長向玻璃牆設於透明乾式樓梯廊。
- `ST-01` 使用兩根較厚鋼梯梁、懸浮中間平台、透明欄杆，梯下完全開放。
- 玻璃屋頂只覆蓋泳池大廳；服務核心端為高側、泳池遠端為低側。

## 4. 檔案與責任

| 檔案 | 責任 |
| --- | --- |
| `model/project-model.json` | 單一模型、referenceSystem、尺寸、program、entities、sources |
| `scripts/reference-validation.mjs` | 可重用的模型與 ID 驗證函式 |
| `scripts/validate-reference-model.mjs` | 命令列驗證入口 |
| `tests/reference-model.test.mjs` | 正常資料及失敗案例測試 |
| `reference/index.html` | 圖集頁面骨架與無障礙結構 |
| `reference/src/types.ts` | Atlas 使用的 TypeScript 型別 |
| `reference/src/geometry.ts` | SVG 座標、比例、圖形與 cubicle 產生器 |
| `reference/src/sheets.ts` | 六張圖面 renderer |
| `reference/src/main.ts` | 分頁、圖層、選取與 detail panel 狀態 |
| `reference/src/styles.css` | 桌面、手機與列印樣式 |
| `vite.config.ts` | 以 `reference/` 為 root 的 dev/build 設定 |

## 5. 執行順序

1. 保存四張新增標註圖，登錄像素、SHA-256、用途與限制。
2. 更新 DESIGN_BASIS 與 DECISIONS，關閉入口、樓梯、樓層與屋頂坡向的舊 OPEN 項目。
3. 建立 `project-model.json`、entity registry、格網與六張 sheet 定義。
4. 完成 validator 與 Node tests，先證明資料一致。
5. 實作六張 SVG 圖面及手機導覽。
6. 安裝 Vite／TypeScript，執行 test、build 與瀏覽器 smoke。
7. 視覺檢查真北、男女分區、15＋5 單元、樓梯、屋頂及 ID 對應。
8. 更新 README 與工作流程，提交一個可追溯的圖集里程碑。

## 6. 驗證門檻

- entity ID 與 sheet ID 唯一。
- 所有圖面引用的 ID 都存在於 registry。
- 建築長度等於泳池大廳加服務核心。
- 池體位於泳池大廳內且池畔尺寸為正數。
- 男女更衣淋浴 zone 不重疊，基本單元各 15，擴充上限各 20。
- `integratedChangingShower` 與 `wallMountedCabinet` 為真，`centralLockerArea` 為假。
- 玻璃屋頂範圍只等於泳池大廳，高低差符合 10°。
- 樓梯兩段、平台、雙鋼梯梁及開放梯下設定完整。
- `npm test`、`npm run build`、`git diff --check` 通過。
- 手機與桌面均能切換六張圖、閱讀 ID 並查看物件資料。
