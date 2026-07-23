# 03｜設計基準

## 1. 使用方式

本文件是目前設計數值與空間意圖的權威來源。`model/project-model.json` 的 `activeGeometryRevisionId=GEO-0.6.5` 是唯一現行機器可讀幾何；圖面、分析與 Viewer 均以 `resolveActiveGeometry()` 解析，不由檔名、日期或最大版號猜測最新版。

狀態語意：

- `confirmed`：使用者已確認的概念輸入；不等於現況測量或專業簽證。
- `working`：v0.6.5 現行協調值，可供圖面與模型一致表達。
- `deferred`：仍須取得法規、結構、機電、消防、無障礙或材料專業答案。
- `legacy`：只供版本比較，不得驅動現行輸出。

## 2. 座標與版本

| 項目 | 現行值 | 狀態 |
| --- | --- | --- |
| 模型版本 | `0.6.5` | active |
| Active revision | `GEO-0.6.5` | active |
| 對外座標系 | `SITE-XY`；X0～X41、Y0～Y14、圖面 Y 向上 | active canonical |
| Three.js adapter | SITE X→Three X、SITE Y→Three −Z、SITE Z→Three Y | derived |
| 本地 +X 真北方位 | 307°；圖面向右為服務翼端 | working |
| 圖面真北 | 依上述 transform 指向圖面右下 | derived |

每個帶 bounds 的 active geometry 物件均須宣告 `entityId`、`coordinateSystemId=SITE-XY` 與唯一 canonical bounds。`originX`／`originY` 不得在 consumer 中形成第二套座標語意。

## 3. L1、池體與服務翼

| 項目 | SITE-XY／數值 | 狀態 |
| --- | --- | --- |
| 基地 `SITE-01` | X0～X41／Y0～Y14 | working |
| 建築 `BLDG-01` | X0.5～X39／Y0～Y14；西端外牆退縮 0.5 m | working |
| 泳池大廳 `Z-PH-01` | X0.5～X31／Y0～Y14 | working |
| 服務翼 `CORE-01` | X31～X39／Y0～Y14 | working |
| 右側到達／整坡帶 | X39～X41／Y0～Y14；2.0 m | working |
| 主入口 | X1.0～X3.0／Y0 邊 | confirmed／professional validation |
| L1 Y0 外牆 | X0.5～X31 泳池端安全玻璃；X31～X39 服務本體自然灰清水模 | confirmed／professional validation |
| 西端突出屋簷／雨水回收 | X0～X0.5／Y0～Y14；傾斜玻璃屋簷，下方連續承接並接入回用系統 | working／professional validation |
| 服務中心後側玻璃屋簷 | X31～X39／Y13.5～Y14.5，+3.30 m；Y14～Y14.5 為突出建築邊線 | working／professional validation |
| 操場側緩坡 | X39～X41／Y0～Y3.5；+0.00→+0.10 m，1:20 | working／professional validation |
| 池體 `POOL-01` | X3～X28／Y4～Y12.5；25.0 × 8.5 m | confirmed geometry |
| 池深 | 左／低 X 端 1.2 m → 右／高 X 端 1.5 m | confirmed |
| 池畔完成面 | +0.30 m | confirmed |
| 水道寬帶 | 0.5 m 緩衝＋2.5 m＋2.5 m＋3.0 m 混合教學帶 | confirmed program／working detail |

L1 池畔必須圍繞真實池口，不得以完整地板穿過池體。池體、水面、池壁與斜池底均須可辨識。

`SITE-XY` 仍固定為 X0～X41／Y0～Y14；後側玻璃屋簷跨出 Y14 只表示跨越建築邊線，不改寫 SITE-XY 或假設產權界線。西端與後側屋簷的支承、玻璃安全、防水、排水、回收容量、溢流及耐候由 `OPEN-014`／`OPEN-016` 管理。

### 3.1 四間獨立廁所與設備空間

| 空間 | SITE-XY | 完成面 | 概念器具／要求 |
| --- | --- | --- | --- |
| 泳池男廁 | X31～X35.5／Y0～Y3.5 | +0.30 m | 2 WC、2 小便斗、2 洗面盆；只由 X31 進出 |
| 泳池女廁 | X31～X35.5／Y3.5～Y7.5 | +0.30 m | 3 WC、2 洗面盆；只由 X31 進出 |
| 操場男廁 | X35.5～X39／Y0～Y3.5 | +0.10 m | 1 WC、2 小便斗、2 洗面盆；只由 X39 進出 |
| 操場女廁 | X35.5～X39／Y3.5～Y7.5 | +0.10 m | 2 WC、2 洗面盆；只由 X39 進出 |
| 儲物間 | X31～X32.5／Y7.5～Y14 | working | 受控服務動線 |
| 水處理機房 | X32.5～X39／Y7.5～Y14 | working | 水處理、維修與搬運路徑待 MEP 深化 |
| 獨立藥劑分間 | X37.5～X39／Y11～Y14 | working | 不供公眾進入、獨立通風待 MEP 深化 |

四間廁所彼此不得互通；泳池組與操場組不可共用穿越式空間。左右均由到達側面向廁所立面判斷：泳池側男右女左，操場側男左女右。兩個男廁入口均為 Y0.5～Y1.5、洗手台貼 Y0；兩個女廁入口均為 Y6.0～Y7.0、洗手台貼 Y7.5。四個主入口為 1.00 m 無門板開口且不設遮擋版，可直接面對洗手台；WC 個別隔間保留門板，8 座 WC 均沿 Y3.5 集中管線牆排列。泳池男廁其中一座小便斗移至 X31 且避開入口。0.6.3 在操場男女廁各於原洗手槽旁增設 1 座洗手槽，操場男廁另於原小便斗旁增設 1 座小便斗；既有器具不搬移。器具數與位置是概念程序，隔間厚度、管道間、實際淨空、無障礙廁所與法定數量仍由 `OPEN-008`／`OPEN-009` 驗證。

## 4. 樓層、屋頂與旋轉量體

| 項目 | 現行值 | 狀態 |
| --- | --- | --- |
| L1 基準 | +0.00 m | working datum |
| L2 | +3.30 m | working／professional validation |
| L3 | +6.88 m | confirmed geometry／professional validation |
| L2 樓板 | X29～X41／Y0～Y13.5；12.0 × 13.5 m；固定 | working |
| L2 池廳重疊 | X29～X31；2.0 m | working |
| L2 右退縮外挑 | X39～X41；2.0 m | working |
| L2 Review A | L 形面池走道 41.75 m²；樓梯區 X32.5～X41／Y0～Y2.5；男區 Y2.5～8、女區 Y8～13.5 | working／professional validation |
| L2 Y0 外牆 | X29～X41 全寬安全玻璃；不設不透明外牆段 | confirmed／professional validation |
| L2 Y0 Viewer 表達 | 淡藍透明雙面材質、反射高光、上下框與豎梃；Y0／Y14 視角均須清楚辨識，Y2.5 清水模牆維持後方獨立平面 | confirmed output intent |
| L2 Y2.5 分隔牆 | X32～X41 連續清水模牆；無門洞，不由樓梯區直通更衣室 | confirmed／professional validation |
| L2 天花板 | X29～X41／Y0～Y13.5，+6.88 m 連續封閉 | confirmed／professional validation |
| L2 淋浴間 | 男 15 間＋女 15 間；每間含隔間 1.20 × 1.20 m；各區 1 WC＋2 洗手槽 | working／professional validation |
| `ST-02` 懸空樓梯 | X32.5～X41／Y0.5～Y2.0；朝 +X；+3.30→+6.88 m；梯下 3 組輕量可移除植栽 | working／professional validation |
| L3 未旋轉基準板 | X29～X41／Y0～Y13.5；12.0 × 13.5 m | working |
| L3 支點 | X35／Y6.75／Z6.88；樓板幾何中心代理 | working structural proxy |
| L3 水平旋轉 | 由上往下看順時針 +25.5° | working optimized |
| L3 固定正交三角擴板 | X38.428～X41／Y0～Y5.392；毛面積約 6.935 m²；不旋轉 | working／professional validation |
| L3 有頂到達翼 | 約 2.964 m²；ST-02 至室內 L3 的有遮蔽通路 | working／professional validation |
| L3 受控景觀區 | 淨約 3.971 m²；只限教師與維修人員；上鎖／告示；非主要逃生 | working／professional validation |
| L3 現行功能 | 低使用密度設備／維修；教師觀察、泳姿分析、環境教育只保留未來彈性；乾式維修儲藏列考慮 | confirmed strategy |
| 3F 完整屋頂 | 未旋轉座標 X27.472～X41／Y0～Y13.5；底 +10.48 m；約 182.628 m²；隨 L3 旋轉並接到外傾鏡牆上緣 | working／professional validation |
| 3F 屋頂太陽能排布 | 未旋轉座標 X27.722～X40.75／Y0.25～Y13.25；與 L3／屋頂／鏡牆共用單一 +25.5° transform；周邊退縮 0.25 m；約 169.364 m²／92.74% 概念覆蓋率 | working／professional validation |
| 儲能策略 | 地面層獨立戶外機櫃優先；3F 一般室內不放電池，只留電力／EMS 介面 | confirmed strategy／professional validation |
| 面池鏡牆 | 高 3.60 m；底 +6.88 m；牆體與鏡面共面，向池側外傾 +23.0° | working optimized／professional validation |
| 鏡牆端部收邊 | 兩端與相鄰直立側牆之間的三角縫填滿，並連接完整 L3 屋頂 | confirmed geometry／professional validation |
| 固定玻璃屋頂 | X0～X29；29.0 m；5°；低端 +4.00 m、高端 +6.537 m | confirmed geometry／professional validation |
| 屋頂至 L3 轉接帶 | 約 0.343 m | working interface |

只有 L3 主矩形做水平旋轉；L1、L2、屋頂與新增三角擴板／到達翼保持 SITE-XY 正交。旋轉主體相對固定 L2 的投影重疊仍為 138.589 m²（85.55%），新增擴板全在 L2 投影內。三角擴板使 L3 概念總面積由 162 m²增至約 168.935 m²；其中到達翼約 2.964 m²、剩餘受控景觀區約 3.971 m²。這些只是平面幾何代理，不是正式質心、剛心或結構容量。

23.0° 外傾幅度大：概念光學計算可成立，但構件水平推力、抗震、抗風、撓度、鏡面分格固定、防水、排水、維修、墜落物與眩光均未核定。任何圖面與 HTML 都必須明示「需專業驗證」，不得說成已核定構造。

高位水箱、除濕熱回收、熱泵與控制設備只能落在固定核心或直接支承線上，不置於旋轉懸挑端或鏡牆。結構柱牆優先整合進隔間、設備牆、管道牆與立面豎框；不得設突兀孤柱，玻璃不得承擔樓層重力荷載。

## 5. ST-01 方案 E

| 項目 | 現行值 | 狀態 |
| --- | --- | --- |
| SITE-XY | X20.5～X29／Y0.5～Y2.0 | working |
| 起訖標高 | 池畔 +0.30 m → L2 +3.30 m | working |
| 有效淨寬 | 1.50 m | working／professional validation |
| 總升高 | 3.00 m | derived |
| 級高／踏面 | 20 級高、18 踏面；R=0.150 m、T=0.300 m | working |
| 兩跑 | 各 10 級高／9 踏面；各 2.70 m | derived |
| 中繼平台 | 3.10 m；約 +1.80 m | working／professional validation |
| 總平面長度 | 8.50 m | derived |
| L2 接點 | X29 直接接板；不設短橋 | working |

樓梯、玻璃牆與玻璃屋頂採獨立荷重路徑。1.50 m 必須以完成面、扶手與防墜構件安裝後的有效淨寬檢核；3.10 m 平台的扭轉、振動、群聚荷重、逐點淨高、防墜、排水與 S1 梯梁接點仍由 `OPEN-017` 專業驗證。

## 5.1 ST-02 懸空樓梯與梯下植栽

`ST-02` 由 2F 的 X32.5 起步，固定在 Y0.5～Y2.0 的 1.50 m 水平帶內，兩跑均朝 +X 上升；概念採 22 級高、20 踏面、R≈0.163 m、T=0.275 m、兩跑各 2.75 m、1.50 m 中平台與 1.50 m 上平台，於 X41 接 3F 有頂正交到達翼。造型語彙與 ST-01 一致，以薄踏步、封閉踢面、兩道連續深色鋼箱梯梁與懸空平台表達，梯下保持開放。梯下 X33.2～X34.6／Y0.72～Y1.78 放置 3 組低矮、耐陰、低落葉、可移除的輕量盆栽；不得設深土槽、水景、固定於梯梁的灌溉或封閉量體。不得改畫成斜向樓梯，也不得以戶外景觀區作唯一到達路線。正式淨寬、梯級、樓板開口、支承、差動接縫、防火避難、防水與無障礙由 `OPEN-019` 專業驗證。

## 6. 日照工作結果

分析使用 `SRC-SITE-003` 的 8,760 小時 PVGIS TMY、等效鏡面反射率 `ρ=0.75`、玻璃太陽透射率 `τ=0.60`，目標為「暖季池面新增嚴格為零，再最大化冷季池面新增」。

| 項目 | X=35 m 工作支點 |
| --- | --- |
| 工作角度 | L3 +25.5°／鏡牆外傾 +23.0° |
| 暖季池面新增 | 0 kWh |
| 冷季池面新增 | +1,036.829 kWh（+0.962%） |
| 暖季屋頂／上部轉向 | 289.797 kWh |
| 冷季屋頂／上部轉向 | 4,857.203 kWh |

支點敏感度：X33 為暖季 +0.125／冷季 +1,199.844 kWh；X35 為 0／+1,036.829；X37 為 0／+876.599；X39 為 0／+732.206；X41 為 0／+596.158 kWh。X33 不符合嚴格暖季零增量，因此 X35 是現行工作支點。

0.5.0 的 +26.5°／+3.1°套入現行池體後會造成暖季 +200.722 kWh，故已淘汰，不得靜默沿用。0.6.5 未改變池體、鏡牆角度、旋轉主矩形、支點、固定屋頂接收面或其他日照分析輸入；solar `inputHash` 與 0.6.4／0.6.3 相同，因此沿用 2026-07-23 已驗證工作值，不重新執行完整最佳化。新增屋簷明確是非接收面雨棚，完整 L3 屋頂與高覆蓋率太陽能排布仍未納入遮蔭、上部接收、眩光或發電分析。以上仍是概念階段能量篩檢，不是 lux、眩光、水溫、設備節能、光電發電或施工性能保證；`OPEN-011`／`OPEN-022` 繼續管理材料、構造與專業光熱驗證。

## 7. 現行輸出

- 空間圖集只顯示 `REF-001`、`V065-L1`、`V065-L2`、`V065-L3`、`V065-SECTION`。
- v0.6.5 SVG／PNG 由 `npm run drawings:v065` 從 active geometry 重現；HTML 直接內嵌 SVG，L3 另有預設勾選的「太陽能板」控制。
- 3D Viewer 提供獨立「泳池剖視」：固定由 Y0 長邊觀察並允許稍微向下旋轉，暫時隱藏近側立面／地坪，以斜底、水體剖面及 X3 淺水 1.20 m → X28 深水 1.50 m 標示呈現深度變化；離開剖視後須完整恢復一般場景。
- 3D Viewer、日照 HTML、圖面與圖集皆顯示 model version、active revision、SITE-XY 或 model hash。
- v0.5.0 舊圖可留在歷史資料夾，但不得出現在現行 HTML current tab。

## 8. 專業驗證邊界

v0.6.5 已完成概念層級結構—空間—設備整合檢查，但建築、結構、機電、消防與無障礙的 `professionalApprovals` 全為 `false`。未決事項包含 `OPEN-008`、`OPEN-009`、`OPEN-011`、`OPEN-014`、`OPEN-016`～`OPEN-022`；本成果不是施工、發包、結構計算或法規簽證文件。
