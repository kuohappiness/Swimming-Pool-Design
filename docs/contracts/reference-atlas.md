# 空間參照圖集契約

- 類型：output-contract
- 狀態：active／v0.6.4
- Owner：[05｜模型契約](../05_MODEL_CONTRACT.md)
- 入口：`/`

## 必要輸出

`reference/src/sheets.ts` 只顯示：

- `REF-001`：`SRC-SITE-001` 原始衛星底圖、MODEL 0.6.4、ACTIVE GEO-0.6.4、SITE-XY 與北向。
- `V064-L1`：`DRAW-L1-PLAN-v0.6.4.png`。
- `V064-L2`：`DRAW-L2-PLAN-v0.6.4.png`。
- `V064-L3`：`DRAW-L3-PLAN-v0.6.4.png`。
- `V064-SECTION`：`DRAW-LONGITUDINAL-SECTION-v0.6.4.png`。

現行 HTML 不得出現 V2.1、V2.2、V2.3 或其他 v0.5.0 current tab。舊圖可留在歷史資料夾，不由 current atlas 載入。

## 圖面語意

- L1：25 × 8.5 m 池體、四間獨立廁所、儲物、水處理、獨立藥劑分間、右側 2 m 到達／整坡帶、ST-01 方案 E，以及 Y0 清水模外牆／玻璃主入口。
- L2：X29～X41／Y0～Y13.5 固定樓板，2 m 池廳重疊、2 m 右側外挑、Y0 全寬玻璃及 X32～X41 的無開口 Y2.5 分隔牆。
- L3：X35／Y6.75 支點、水平 +25.5°、面池牆與鏡面共面外傾 +23.0°、完整屋頂及高覆蓋率太陽能排布；0.5 m／2.5 m SITE-XY 格線須在填色上方保持可讀。
- 剖面：X／Z 同尺度；0.5 m／2.5 m SITE-XZ 格線及數值標籤、池畔 +0.30 m、L2 +3.30 m／完整天花、L3 +6.88 m／完整屋頂、29 m／5°固定玻璃屋頂及 ST-01 方案 E。

每張圖須保留 `v0.6.4`、`GEO-0.6.4`、`SITE-XY` 與「非施工圖」聲明。SVG 由 `npm run drawings:v064` 重現，PNG 必須由同一 SVG render 產生。

## 驗收

- model sheet registry 恰為 `REF-001`、`V064-L1`、`V064-L2`、`V064-L3`、`V064-SECTION`。
- 四張 SVG／PNG 均存在，SVG metadata 與 active model 一致。
- Viewer 與 solar-study 最新圖面連結都指向 `#V064-L1`。
- 320 px 以上可操作；圖片以 `preserveAspectRatio` 顯示且不裁掉圖框。
- `npm test`、`npm run typecheck`、`npm run build` 與桌機／手機 smoke 通過。

衛星底圖不是地籍或測量成果；所有圖面均為概念協調用途。
