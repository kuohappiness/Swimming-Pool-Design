# 現行圖面

本資料夾保存由 `GEO-0.11.0` 重現的三張平面圖與一張縱向剖面圖。所有圖面均為概念設計、非施工圖。

- `DRAW-L1-PLAN.svg`
- `DRAW-L2-PLAN.svg`
- `DRAW-L3-PLAN.svg`
- `DRAW-LONGITUDINAL-SECTION.svg`
- model／active geometry：`0.11.0`／`GEO-0.11.0`
- owner：`TASK-131`

0.10.0 的 1F 平面圖加入 `DEC-157` 的一堂課動線（換鞋玄關、坡道與兩階、乾式廊道與低牆、梯底沖身區、集合區、救生椅、AED、X31 兩間服務室與面池窗、教具推車、移動式升降椅，以及編號 1～5 的路線），以及 `DEC-158` 的可移除教學平台；水處理機房縮為 X34～X39，支承候選線移到 X34。四張圖同時改用 TASK-113 更正後的真北方向（圖面旋轉 143°）。

0.11.0 的 3F 平面圖加入 `DEC-173` 的分區：觀課與環境教育室 66 m²、設備區 96 m²、隔音玻璃隔間與上鎖維修門，三者隨 L3 一起旋轉；其他三張圖只更新版本字樣。

重現：

```powershell
npm run build:drawings
```

這個指令會重寫四張 SVG，並在同一資料夾轉出同名 PNG。PNG 需要 Chrome 或 Edge（Linux 以 `CHROME_PATH` 指定），自 TASK-109 起不入庫。
