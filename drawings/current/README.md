# 現行圖面

本資料夾保存由現行模型重現的三張平面圖與一張縱向剖面圖。所有圖面均為概念設計、非施工圖。

- `DRAW-L1-PLAN.svg`
- `DRAW-L2-PLAN.svg`
- `DRAW-L3-PLAN.svg`
- `DRAW-LONGITUDINAL-SECTION.svg`
- model／active geometry：`0.9.7`／`GEO-0.8.2`（圖框與 SVG 屬性由模型帶出）
- 北向箭頭：`rotate(143)`，由 `positiveXAxisBearingFromTrueNorth = 307°` 推導，與 3D 檢視器一致
- 最近一次重產：TASK-120（2026-11-22）；舊版圖框寫 v0.6.7、北向箭頭 `rotate(127)`，幾何內容與現行相同


重現：

```powershell
npm run build:drawings
```

這個指令會重寫四張 SVG，並在同一資料夾轉出同名 PNG。PNG 需要 Chrome 或 Edge（Linux 以 `CHROME_PATH` 指定），自 TASK-109 起不入庫。
