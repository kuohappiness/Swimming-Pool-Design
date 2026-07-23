# 空間參照圖集契約

- 類型：output-contract
- 狀態：active／v0.6.5
- Owner：[05｜模型契約](../05_MODEL_CONTRACT.md)
- 入口：`/`

## 必要輸出

`reference/src/sheets.ts` 只顯示：

- `REF-001`：`SRC-SITE-001` 原始衛星底圖、MODEL 0.6.5、ACTIVE GEO-0.6.5、SITE-XY 與北向。
- `V065-L1`：內嵌 `DRAW-L1-PLAN-v0.6.5.svg`。
- `V065-L2`：內嵌 `DRAW-L2-PLAN-v0.6.5.svg`。
- `V065-L3`：內嵌 `DRAW-L3-PLAN-v0.6.5.svg`。
- `V065-SECTION`：內嵌 `DRAW-LONGITUDINAL-SECTION-v0.6.5.svg`。

現行 HTML 不得出現 V2.1、V2.2、V2.3 或其他 v0.5.0 current tab。舊圖可留在歷史資料夾，不由 current atlas 載入。

## 圖面語意

- L1：25 × 8.5 m 池體、四間獨立廁所、儲物、水處理、獨立藥劑分間、右側 2 m 到達／整坡帶、ST-01 方案 E、Y0 泳池端玻璃／服務本體清水模、X0.5 西端牆、X1～X3 玻璃入口、X0～X0.5 玻璃屋簷／雨水回收與 Y14～Y14.5 後側突出玻璃屋簷。
- L2：X29～X41／Y0～Y13.5 固定樓板，2 m 池廳重疊、2 m 右側外挑、Y0 全寬玻璃及 X32～X41 的無開口 Y2.5 分隔牆。
- L3：X35／Y6.75 支點、水平 +25.5°、面池牆與鏡面共面外傾 +23.0°、完整屋頂及淡藍透明高覆蓋率太陽能排布；L3／屋頂／鏡牆／光電只用一個共同 transform，0.5 m／2.5 m SITE-XY 格線須在填色上方保持可讀。
- 剖面：X／Z 同尺度；0.5 m／2.5 m SITE-XZ 格線及數值標籤、池畔 +0.30 m、L2 +3.30 m／完整天花、L3 +6.88 m／完整屋頂、X0.5／X29／X41 牆、投影 `EN-01`、玻璃屋簷／雨水回收及 ST-01 方案 E。

每張圖須保留 `v0.6.5`、`GEO-0.6.5`、`SITE-XY` 與「非施工圖」聲明。SVG 由 `npm run drawings:v065` 重現，PNG 必須由同一 SVG render 產生。現行 HTML 必須內嵌 SVG，不得以 PNG `<image>` 取代；`V065-L3` 另提供獨立、預設勾選的「太陽能板」控制，取消時隱藏整個 `RF-PV-RES-01` group。

## 驗收

- model sheet registry 恰為 `REF-001`、`V065-L1`、`V065-L2`、`V065-L3`、`V065-SECTION`。
- 四張 SVG／PNG 均存在，SVG metadata 與 active model 一致。
- Viewer 與 solar-study 最新圖面連結都指向 `#V065-L1`。
- 320 px 以上可操作；圖片以 `preserveAspectRatio` 顯示且不裁掉圖框。
- `npm test`、`npm run typecheck`、`npm run build` 與桌機／手機 smoke 通過。

衛星底圖不是地籍或測量成果；所有圖面均為概念協調用途。
