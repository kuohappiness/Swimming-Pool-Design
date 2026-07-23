# v0.6.6 current drawings

本資料夾保存由 `GEO-0.6.6` 重現的三張 current 平面圖與一張縱向剖面圖。所有圖面均為概念設計、非施工圖。

- `DRAW-L1-PLAN-v0.6.6.svg`／`.png`
- `DRAW-L2-PLAN-v0.6.6.svg`／`.png`
- `DRAW-L3-PLAN-v0.6.6.svg`／`.png`
- `DRAW-LONGITUDINAL-SECTION-v0.6.6.svg`／`.png`
- model／active geometry：`0.6.6`／`GEO-0.6.6`
- owner：`TASK-051`

0.6.6 不變更建築幾何或日照分析輸入。圖面內容沿用 0.6.5 定案；本版同步 Viewer 選取不再顯示黃色外接框，並使 L2 Y0 外牆使用與其他玻璃帷幕相同的淡藍透明材質系統。

重現：

```powershell
npm run drawings:v066
```
