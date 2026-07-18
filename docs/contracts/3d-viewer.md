# 3D Viewer 契約

- 類型：output-contract
- 狀態：active
- Owner：[05｜模型契約](../05_MODEL_CONTRACT.md)
- 入口：`/3d-viewer/`

## 資料來源與同步

Viewer 只接受兩個編譯產物：

- `reference/generated/viewer-model.json`：由 `model/project-model.json` 與 `scripts/reference-geometry.mjs` 產生的 Viewer 幾何資料包。
- `reference/generated/concept-content.json`：由[公開理念文字正本](../public/swimming-pool-renovation-design-concept.md)經模型 token 注入後產生的五場景內容。

兩者必須具有相同 `modelVersion` 與 `modelHash`；不相符、token 無法解析、scene ID 不存在或幾何出現非有限值時，編譯或 runtime 必須失敗，不得顯示合理化 fallback 幾何。`contentHash` 與 `modelHash` 必須在 Viewer 上可見。

日照分析的 `recordedModelHash` 與現行模型不符時，Viewer 標示 `stale` 並顯示需重新驗證，不得把既有分析文字當作現行性能結論。

## 幾何與 transform

- 模型 +X／+Y／+Z 只在一個 adapter 對應 Three.js +X／+Z／+Y。
- 建築世界方位 307°只套在最上層 `WORLD-BEARING-ROOT` 一次。
- 2F confirmed +9.5°水平旋轉只套在 `L2-PLAN-ROTATION` group，支點由 `l2-start-width-center` 策略推導並保持 `working`／`OPEN-011`。
- 鏡牆 confirmed +8.5°外傾只改變 `F-MIR-01` surface；`mirrorVisualWallHeight` 是 Viewer 的 `working` 視覺牆高，不得冒充日照能量分析的有效鏡面高或面積。
- 屋頂高端、遠端牆與滴水端標高，以及樓梯總升高，只能由 L1／L2 標高、坡度、跨度與外挑推導。
- 原建築、泳池、L2、玻璃屋頂、樓梯、鏡牆與雨簾皆由同一 Viewer model 建立；五個場景不得另建第二套 mesh 幾何。

## 場景、圖層與狀態

`scene-manifest.json` 固定提供：

| Scene ID | 顯示重點 |
| --- | --- |
| `overview` | 完整建築、新舊量體與主要幾何 |
| `light` | 2F 水平旋轉、鏡牆外傾與冬季工作光線關係 |
| `rain` | 玻璃屋頂、被動雨簾與概念回用路徑 |
| `people` | 長向玻璃牆、樓梯與公共動線 |
| `time` | 原建築與新增介入的辨識 |

每個場景只改 camera、visibility、environment 及理念內容。`original`、`new`、`water`、`roof`、`stair`、`rain`、`annotations` 圖層必須能獨立切換，且 UI checkbox 必須反映實際 visibility。

- `confirmed`：藍色狀態與正常完整資訊，只表示已確認的設計幾何。
- `working`：橘色狀態，明示概念工作值與來源限制。
- `deferred`：紫色狀態或概念線條，連回真正 OPEN，不填入施工尺度。

材質只是一致的 Viewer palette，不代表施工材料、透反射率、結構或防水性能。

## 互動、無障礙與 fallback

- 桌機及觸控裝置支援 orbit、pan、zoom、重設與五個敘事鏡位。
- 提供透視、俯視、池側及校側相反立面快捷視角。
- canvas 可鍵盤聚焦；方向鍵平移，Enter／Space 依序選取構件；下拉選單提供等價的鍵盤構件選取。
- 點選構件顯示 entity ID、名稱、狀態、限制及 OPEN；不得只靠 hover。
- `prefers-reduced-motion` 下不使用場景動畫轉場。
- 390 × 844 不得產生頁面水平溢出，五個 scene ID、圖層、相機與理念內容仍可操作。
- WebGL 不可用或 `?forceFallback=1` 時顯示可閱讀的靜態總覽、五組理念內容與空間參照圖集連結。

## 驗收

- `npm run build:content`：token、scene ID、hash 與有限幾何通過。
- `npm test`：canonical／derived 同步、分析 stale、五 scene ID、hash 及 transform 分層通過。
- `npm run typecheck` 與 `npm run build`：Three.js／Vite production bundle 通過並產生 `dist/reference/3d-viewer/index.html`。
- `npm run test:e2e`：1440 × 900、390 × 844 與 WebGL fallback smoke 通過；場景、圖層、構件、相機、版本及內容可觀察。
- 手動檢查透視、俯視、池側、校側與手機畫面，確認屋頂範圍、透明排序、相機裁切、圖例與控制區可讀。
