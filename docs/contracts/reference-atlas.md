# 空間參照圖集契約

- 類型：output-contract
- 狀態：active／v0.6.3
- Owner：[05｜模型契約](../05_MODEL_CONTRACT.md)
- 入口：`/`

## 必要輸出

`reference/src/sheets.ts` 只顯示：

- `REF-001`：`SRC-SITE-001` 原始衛星底圖、MODEL 0.6.3、ACTIVE GEO-0.6.3、SITE-XY 與北向。
- `V063-L1`：`DRAW-L1-PLAN-v0.6.3.png`。
- `V063-L2`：`DRAW-L2-PLAN-v0.6.3.png`。
- `V063-L3`：`DRAW-L3-PLAN-v0.6.3.png`。
- `V063-SECTION`：`DRAW-LONGITUDINAL-SECTION-v0.6.3.png`。

現行 HTML 不得出現 V2.1、V2.2、V2.3 或其他 v0.5.0 current tab。舊圖可留在歷史資料夾，不由 current atlas 載入。

## 圖面語意

- L1：25 × 8.5 m 池體、四間獨立廁所、儲物、水處理、獨立藥劑分間、右側 2 m 到達／整坡帶及 ST-01 方案 E。
- L2：X29～X41／Y0～Y13.5 固定樓板，2 m 池廳重疊、2 m 右側外挑及 ST-01 直接接板。
- L3：X35／Y6.75 支點、水平 +25.5°、面池牆與鏡面共面外傾 +23.0°，並標示需專業驗證。
- 剖面：X／Z 同尺度；池畔 +0.30 m、L2 +3.30 m、L3 +6.88 m、29 m／5°固定屋頂及 ST-01 方案 E。

每張圖須保留 `v0.6.3`、`GEO-0.6.3`、`SITE-XY` 與「非施工圖」聲明。SVG 由 `npm run drawings:v063` 重現，PNG 必須由同一 SVG render 產生。

## 驗收

- model sheet registry 恰為 `REF-001`、`V063-L1`、`V063-L2`、`V063-L3`、`V063-SECTION`。
- 四張 SVG／PNG 均存在，SVG metadata 與 active model 一致。
- Viewer 與 solar-study 最新圖面連結都指向 `#V063-L1`。
- 320 px 以上可操作；圖片以 `preserveAspectRatio` 顯示且不裁掉圖框。
- `npm test`、`npm run typecheck`、`npm run build` 與桌機／手機 smoke 通過。

衛星底圖不是地籍或測量成果；所有圖面均為概念協調用途。
