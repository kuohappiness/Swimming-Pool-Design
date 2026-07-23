# v0.6.3 current drawings

本資料夾保存由 `GEO-0.6.3` 重現的三張 current 平面圖與一張縱向剖面圖，另保留核准前的 2F Review A 作為歷史審閱證據。所有圖面均為概念設計、非施工圖。

## Current

- `DRAW-L1-PLAN-v0.6.3.svg`／`.png`
- `DRAW-L2-PLAN-v0.6.3.svg`／`.png`
- `DRAW-L3-PLAN-v0.6.3.svg`／`.png`
- `DRAW-LONGITUDINAL-SECTION-v0.6.3.svg`／`.png`
- model／active geometry：`0.6.3`／`GEO-0.6.3`
- owner：`TASK-044`～`TASK-048`

重現：

```powershell
npm run drawings:v063
```

## 2F Review A

- `DRAW-L2-PLAN-v0.6.3-REVIEW-A.svg`／`.png`
- target：`0.6.3`
- model base：`0.6.2`／`GEO-0.6.2`
- owner：`DEC-095`／`TASK-045`
- 狀態：working review／非施工圖

圖面依使用者指定建立獨立樓梯區、Y0 大面玻璃、Y2.5 分隔牆、X29～X32 面池走道與觀景窗、女上男下更衣室、X32 靠上方的 1.00 m 無門片入口，以及男女各 15 間含隔間 1.20 × 1.20 m 淋浴。

Review A 的可逆工作假設為：男區 X32～X41／Y2.5～Y8、女區 X32～X41／Y8～Y13.5；淋浴採 3 排 × 5 間、排間工作通道 0.90 m；每側另試放 1 間一般 WC＋2 座洗手槽。

核准記錄（2026-07-23）：使用者已同意 Review A，包含每側新增 1 間一般 WC＋2 座洗手槽。圖中的紫色虛線仍保存「審閱當時為建議」的歷史狀態；current 0.6.3 已依 `DEC-095` 將這些器具視為確認需求。家具、植栽與入口已協調進 canonical model；施工級淨空、排水、結構、消防與無障礙仍須專業驗證。

重現：

```powershell
node scripts/generate-v063-l2-review.mjs
node scripts/render-draft-svgs.mjs reference/drafts/v0.6.3/DRAW-L2-PLAN-v0.6.3-REVIEW-A.svg
```
