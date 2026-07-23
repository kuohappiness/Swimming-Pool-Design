# v0.6.7 current drawings

本資料夾保存由 `GEO-0.6.7` 重現的三張 current 平面圖與一張縱向剖面圖。所有圖面均為概念設計、非施工圖。

- `DRAW-L1-PLAN-v0.6.7.svg`／`.png`
- `DRAW-L2-PLAN-v0.6.7.svg`／`.png`
- `DRAW-L3-PLAN-v0.6.7.svg`／`.png`
- `DRAW-LONGITUDINAL-SECTION-v0.6.7.svg`／`.png`
- model／active geometry：`0.6.7`／`GEO-0.6.7`
- owner：`TASK-052`

0.6.7 不變更建築設計或日照分析輸入。圖面內容沿用 0.6.6 定案；Viewer 修正 generated L2 資料漏傳 `splitAxisY=8` 所造成的實際錯置水泥牆，並把先前針對症狀加深的共用玻璃材質恢復為一般淡藍透明基準。

重現：

```powershell
npm run drawings:v067
```
