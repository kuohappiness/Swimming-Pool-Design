# 02｜基地與來源

## 1. 基地識別

- 專案：國立臺中教育大學附設實驗國民小學游泳池翻修概念設計
- 位置判讀依據：Google Maps 衛星截圖、道路標示與校園配置
- 圖中道路：民權路、民生路、中山路 429 巷、原子街
- 黃色框：既有泳池基地
- 綠色框：既有廁所基地，拆除重建並納入新泳池規劃

基地名稱依公開地圖與圖面脈絡識別，不是地籍、都市計畫或測量成果。

## 2. 方位與比例

`SRC-SITE-001` 保留 Google Maps 指南針與 20 公尺／50 英尺比例尺。本地 +X 必須由泳池遠端指向綠色原廁所／服務核心基地，因此圖集採 307° 的有向工作值；127° 是同一長軸的反方向，不再驅動模型。精確角度仍保留未來重新校準參數。

世界座標為 `+X` 東、`+Y` 北、`+Z` 上，長度公尺、角度度數。建築本地座標經單一 `worldTransform` 轉為世界座標；Viewer 不得另寫第二套北向。

太陽幾何研究使用校址的公開地圖中心工作值 `24.14434°N, 120.67341°E`，時區為 `Asia/Taipei`（UTC+8）。校名與地址由[學校官方英文頁](https://www.ntctcps.tc.edu.tw/english-version/)確認為國立臺中教育大學附設實驗國民小學、臺中市北區民權路 220 號；座標取自以 OpenStreetMap way 335710522 為基礎的[公開地圖位置](https://mapcarta.com/W335710522)。此座標只用於概念階段太陽位置計算，不是測量控制點。

## 3. 來源登錄表

| ID | 專案路徑 | 內容與用途 | 原始像素 | SHA-256 |
| --- | --- | --- | --- | --- |
| SRC-SITE-001 | `source-materials/site/SRC-SITE-001_google-maps-satellite-annotated.jpeg` | 衛星截圖；黃色／綠色基地、指南針與比例尺 | 812 × 1536 | `46EB14BE28E419999F664D43920BF6717CEA2558F25700735C5078A9EB1107C2` |
| SRC-SITE-002 | `source-materials/site/SRC-SITE-002_entrance-location-annotated.png` | 衛星圖紅箭頭；確認 `EN-01` 位於兩基地交界的校園側 | 814 × 1146 | `7827DC99D33A1EF61470D19208EF58BF57C880420C94F903CC52BB63D5F2C327` |
| SRC-CONCEPT-001 | `source-materials/concepts/SRC-CONCEPT-001_side-section.jpeg` | 手繪側視／剖面；泳池大廳、男女空間與廁所關係 | 864 × 1536 | `43640E5A1821AA406682A32F421934C6FA75821C07435BD2744DF5AE2BA1F9EC` |
| SRC-CONCEPT-002 | `source-materials/concepts/SRC-CONCEPT-002_roof-plan.jpeg` | 手繪屋頂平面；玻璃屋頂及男女空間關係 | 2267 × 2982 | `59DE06D8B6A82935E772A8B6B61CD92BD7FFB1DA02AF5737B36ABD7F8588A11F` |
| SRC-CONCEPT-003 | `source-materials/concepts/SRC-CONCEPT-003_ground-floor-plan.jpeg` | 手繪一樓平面；泳池、廁所、門與樓梯的早期想法 | 2210 × 2931 | `F7666FED2DC1CDA77B0C7CE8C41FD369E40DA5A5DBCBAA5BF0449E377174F87D` |
| SRC-CONCEPT-004 | `source-materials/concepts/SRC-CONCEPT-004_perspective.jpeg` | 手繪室內透視；玻璃牆、泳池、挑高與服務量體 | 1064 × 1536 | `7636BA4EBB3CB4B094DA62631EBDE7B29FB410BF775AA217434E01508F507C5C` |
| SRC-CONCEPT-005 | `source-materials/concepts/SRC-CONCEPT-005_service-core-program-annotated.png` | 彩框概念；入口、原廁所重建、L2 更衣淋浴及屋頂坡向 | 1452 × 1042 | `B08B1781004983F2BEEFA1271361B9EB5A7C585F8BB59D3947FE83847059EE94` |
| SRC-CONCEPT-006 | `source-materials/concepts/SRC-CONCEPT-006_floating-stair-location-annotated.png` | 藍框概念；長邊玻璃外牆旁的懸空樓梯位置 | 2080 × 1466 | `157200EA2BE6C1EF1A213D4DE89589B0D18F9C184E490349F9E58919D6E16681` |
| SRC-CONCEPT-007 | `source-materials/concepts/SRC-CONCEPT-007_floating-stair-dual-stringer-annotated.png` | 紅線概念；雙厚鋼梯梁、懸空梯段及開放梯下 | 1430 × 920 | `D62448F0A987900F2C3208EE17D3B57FC2AE2DCDCE358002A294E4B54746F592` |
| SRC-CONCEPT-008 | `source-materials/concepts/SRC-CONCEPT-008_l1-outdoor-entries-annotated.png` | 使用者在現行 L1 圖面標註：紅框為男女廁、綠框為戶外、藍框為兩廁朝下的獨立戶外前門 | 2194 × 1120 | `BBAE9566DF0107810CFE3E499C0D32E0DB68A66B1CC846D3AD815F31FF7BDB0E` |

雜湊確認 repo 圖檔與各輪討論使用的原始檔一致。`SRC-CONCEPT-008` 直接支持 `DEC-028` 的入口語意，但它是在待修圖面上的使用者標註，不證明開口、通道或廁所隔間的精確尺寸；尺寸仍由 `OPEN-008` 管理。

## 4. 證據解讀規則

1. 使用者明確確認的文字決策。
2. 可讀取比例尺或方位的來源圖。
3. 經記錄的規劃數值與幾何推導。
4. 手繪圖表達的空間意圖。
5. 歷史 Viewer 或 DXF。

手繪不是按比例施工圖；標註圖只證明決策位置與意圖，精確尺寸由 [03_DESIGN_BASIS](03_DESIGN_BASIS.md) 管理。

## 5. 公開與署名

十張來源圖可直接存於公開 repo。Google Maps 截圖保留原有品牌、指南針及比例尺；地圖資料與影像權利歸 Google 及適用資料提供者，彩框與箭頭為使用者註記。本 repo 只把它保存為概念設計來源證據。

## 6. 已知限制

- 沒有正式地籍邊界、現況測量、CAD、結構或機電圖。
- 樹木、屋簷及影像透視影響邊界判讀。
- 307° 有向方位與基地外輪廓是工作值，未來可依新證據修訂；修訂不得再次交換泳池遠端與服務核心端。
- 新資料應新增修訂紀錄，再由單一模型切換至新值，不覆寫來源歷史。
- 校址中心座標不是泳池局部測量點；正式日照分析可用測量座標取代，但不得在頁面另寫第二套位置資料。

來源新增程序見 [06_WORKFLOW_AND_RELEASES](06_WORKFLOW_AND_RELEASES.md)。
