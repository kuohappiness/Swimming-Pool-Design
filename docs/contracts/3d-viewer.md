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
- 0.5.0 Viewer 的 active geometry 必須讀取 `geometry.solarReflection.v050Study`；0.4.0 的 L2 +9.5°／+8.5°只保留為歷史參照，不得進入現行 Viewer。
- L1／L2 保持固定正交，只有 L3 在 `L3-PLAN-ROTATION` group 以 X=35 m、Y=6.75 m 工作支點順時針旋轉 +26.5°。世界方位 307°與 L3 局部旋轉必須分層，禁止重複套用。
- L3 面池承載牆本體與外貼 `F-MIR-01` 鏡面覆層共同向池側外傾 +3.1°；兩者共面，只可保留避免 z-fighting 的極薄顯示偏移，不得表達成垂直牆前方的獨立斜板。
- L1 地坪由 `POOL-01` 開口外圍、完成面 +0.30 m 的池畔幾何組成，不得有地板穿越池體。`POOL-01` 同時表達 20.5 × 7.5 m 水面、三水道、池緣、池壁與斜池底；左側低 X 端為 1.2 m 淺端，右側服務量體端為 1.5 m 深端。
- L1 右側服務翼以 8.0 × 14.0 m 工作外框顯示：7 m 戶外區不與泳池大廳連接，7 m 廁所帶含池側乾式走道，男女廁均保留操場側與泳池側開口語意。L1 14.0 m 與 L2／L3 13.5 m 的收邊維持 `OPEN-016`，Viewer 不得偷偷對齊。
- L2／L3 樓板均為 12.0 × 13.5 m；L2 +3.30 m 固定，L3 +6.88 m 旋轉。固定核心、水塔、L2–L3 逃生梯與外挑只表達工作占位，不得冒充結構或避難核定。
- 屋頂固定為 29.0 m 水平跨度、低端 +4.000 m、高端 +6.537 m、5°。與 L3 +6.880 m 的 0.343 m 垂直轉接帶及中央剖面約 0.70 m 平面錯位必須可見並連結 `OPEN-016`。
- `ST-01` 從池畔 +0.30 m 升至 L2 +3.30 m，工作幾何為 1.50 m 淨寬、20 級高／18 踏面、兩跑各 2.70 m、1.80 m 平台、總長 7.20 m；位置沿長邊玻璃牆，荷重不得傳給玻璃帷幕或屋頂。
- 基地、L1、泳池、L2、L3、玻璃屋頂、樓梯、鏡牆與雨簾皆由同一 Viewer model 建立；五個場景不得另建第二套 mesh 幾何。

## 場景、圖層與狀態

`scene-manifest.json` 固定提供：

| Scene ID | 顯示重點 |
| --- | --- |
| `overview` | 完整建築、新舊量體與主要幾何 |
| `light` | L3 水平旋轉、鏡牆外傾與冬季工作光線關係 |
| `rain` | 玻璃屋頂、被動雨簾與概念回用路徑 |
| `people` | 長向玻璃牆、樓梯與公共動線 |
| `time` | 原建築與新增介入的辨識 |

每個場景只改 camera、visibility、environment 及理念內容。`site`、`l1`、`water`、`l2`、`l3`、`roof`、`circulation`、`rain`、`annotations` 圖層必須能獨立切換，且 UI checkbox 必須反映實際 visibility。

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
