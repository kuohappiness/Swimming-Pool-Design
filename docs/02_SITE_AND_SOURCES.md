# 02｜基地與來源

## 1. 基地識別

- 專案：國立臺中教育大學附設實驗國民小學游泳池翻修概念設計
- 位置判讀依據：使用者提供的 Google Maps 衛星截圖、道路標示與校園配置
- 圖中道路：民權路、民生路、中山路 429 巷、原子街
- 黃色框：既有泳池基地
- 綠色框：既有廁所基地，將拆除重建並納入新的泳池規劃

基地名稱是依公開地圖與圖面脈絡所做的專案識別，不是地籍、都市計畫或測量成果。

## 2. 方位與比例

`SRC-SITE-001` 保留 Google Maps 的指南針與 20 公尺／50 英尺比例尺。截圖中的北向箭頭指向畫面上方略偏左；正式建立模型時，必須以圖上的北向箭頭校準，而不是假設影像上方等於正北。

模型採世界座標：

- `+X`：東
- `+Y`：北
- `+Z`：上
- 長度單位：公尺
- 角度單位：度

衛星圖校準、基地旋轉角與裁切座標將寫入單一模型資料，Viewer 不得各自硬編碼另一套北向。

## 3. 來源登錄表

| ID | 專案路徑 | 內容與用途 | 原始像素 | SHA-256 |
| --- | --- | --- | --- | --- |
| SRC-SITE-001 | `source-materials/site/SRC-SITE-001_google-maps-satellite-annotated.jpeg` | Google Maps 衛星截圖；含使用者黃色／綠色註記、指南針與比例尺 | 812 × 1536 | `46EB14BE28E419999F664D43920BF6717CEA2558F25700735C5078A9EB1107C2` |
| SRC-CONCEPT-001 | `source-materials/concepts/SRC-CONCEPT-001_side-section.jpeg` | 手繪側視／剖面概念；泳池大廳、男女空間與廁所的關係 | 864 × 1536 | `43640E5A1821AA406682A32F421934C6FA75821C07435BD2744DF5AE2BA1F9EC` |
| SRC-CONCEPT-002 | `source-materials/concepts/SRC-CONCEPT-002_roof-plan.jpeg` | 手繪屋頂平面；玻璃屋頂及男女更衣空間的概念關係 | 2267 × 2982 | `59DE06D8B6A82935E772A8B6B61CD92BD7FFB1DA02AF5737B36ABD7F8588A11F` |
| SRC-CONCEPT-003 | `source-materials/concepts/SRC-CONCEPT-003_ground-floor-plan.jpeg` | 手繪一樓平面；泳池、廁所、門與樓梯的早期想法 | 2210 × 2931 | `F7666FED2DC1CDA77B0C7CE8C41FD369E40DA5A5DBCBAA5BF0449E377174F87D` |
| SRC-CONCEPT-004 | `source-materials/concepts/SRC-CONCEPT-004_perspective.jpeg` | 手繪室內透視；玻璃牆、泳池、挑高與服務量體概念 | 1064 × 1536 | `7636BA4EBB3CB4B094DA62631EBDE7B29FB410BF775AA217434E01508F507C5C` |

雜湊用來確認 repo 中的圖檔與本次討論所依據的原始檔一致。

## 4. 證據解讀規則

來源的優先順序不是單純依日期，而是依證據性質：

1. 使用者明確確認的文字決策。
2. 可讀取比例尺或方位的來源圖。
3. 經記錄的規劃數值與幾何推導。
4. 手繪圖所表達的空間意圖。
5. 歷史 Viewer 或 DXF 的舊版本實作。

手繪圖不是按比例施工圖。它們能確認空間意圖，但不能單獨確認入口、樓梯、樓層、尺寸或結構可行性。

## 5. 公開與署名

五張來源圖可直接存放於公開 repo。`SRC-SITE-001` 是 Google Maps 截圖，保留畫面上的原有品牌、指南針及比例尺；地圖資料與影像權利歸 Google 及適用的資料提供者，黃色與綠色框為使用者註記。本 repo 保存它作為概念設計來源證據，不主張地圖影像權利。

## 6. 已知限制

- 沒有正式地籍邊界、現況測量、CAD、結構或機電圖。
- 樹木、屋簷及影像透視會影響衛星圖的邊界判讀。
- 相鄰廁所的現況內部配置未由圖面確認。
- 未來新資料不會讓舊數值消失；應新增修訂紀錄，再由權威模型切換至新值。

來源新增與校驗程序見 [06_WORKFLOW_AND_VERSIONING](06_WORKFLOW_AND_VERSIONING.md) 與 [source-intake reference](../.codex/skill/references/source-intake.md)。
