# 02｜基地與來源

## 1. 基地識別

- 專案：國立臺中教育大學附設實驗國民小學游泳池翻修概念設計
- 位置判讀依據：Google Maps 衛星截圖、道路標示與校園配置
- 圖中道路：民權路、民生路、中山路 429 巷、原子街
- 黃色框：既有泳池基地
- 綠色框：既有廁所基地，拆除重建並納入新泳池規劃

基地名稱依公開地圖與圖面脈絡識別，不是地籍、都市計畫或測量成果。

## 2. 方位與比例

`SRC-SITE-001` 保留 Google Maps 20 公尺比例尺；`SRC-SITE-002` 另保留指南針與 20 公尺／50 英尺比例尺。本地 +X 必須由泳池遠端指向 `SRC-SITE-002` 綠框所示的原廁所／服務核心基地，因此圖集採 307° 的有向工作值；127° 是同一長軸的反方向，不再驅動模型。精確角度仍保留未來重新校準參數。

世界座標為 `+X` 東、`+Y` 北、`+Z` 上，長度公尺、角度度數。建築本地座標經單一 `worldTransform` 轉為世界座標；Viewer 不得另寫第二套北向。

太陽幾何研究使用校址的公開地圖中心工作值 `24.14434°N, 120.67341°E`，時區為 `Asia/Taipei`（UTC+8）。校名與地址由[學校官方英文頁](https://www.ntctcps.tc.edu.tw/english-version/)確認為國立臺中教育大學附設實驗國民小學、臺中市北區民權路 220 號；座標取自以 OpenStreetMap way 335710522 為基礎的[公開地圖位置](https://mapcarta.com/W335710522)。此座標只用於概念階段太陽位置計算，不是測量控制點。

## 3. 來源登錄表

| ID | 專案路徑 | 內容與用途 | 格式／規模 | SHA-256 |
| --- | --- | --- | --- | --- |
| SRC-SITE-001 | `source-materials/site/SRC-SITE-001_google-maps-satellite.png` | 衛星截圖；基地、周邊道路與校園配置、地圖比例尺 | 1612 × 1430 | `39D1933CAEFB91020AF10E72ADFDBD04980DA36FEDBF36ED14209F469DA4029D` |
| SRC-SITE-002 | `source-materials/site/SRC-SITE-002_entrance-location-annotated.png` | 衛星圖紅箭頭；確認 `EN-01` 位於兩基地交界的校園側 | 814 × 1146 | `7827DC99D33A1EF61470D19208EF58BF57C880420C94F903CC52BB63D5F2C327` |
| SRC-SITE-003 | `source-materials/site/SRC-SITE-003_pvgis-5-3-tmy.json` | European Commission JRC PVGIS 5.3；基地座標標準氣象年，用於 `TASK-013` 鏡牆能量差分析 | JSON；1,270,483 bytes；8760 hourly records | `1F9E251234F0C5451A77BC20A31C4E83545EC1BAE472CEB65566524E0E451633` |
| SRC-SITE-004 | `source-materials/site/SRC-SITE-004_current-pool-and-changing-rooms-annotated.png` | 現況衛星圖；紅框為泳池本體，上方綠框為廁所＋女生更衣室，下方綠框為男生更衣室 | 1612 × 1430 | `3DC23D224551E2DB9C6B267A479A3BE169589BA17B9AA3732EF917D9F9ACD9A8` |
| SRC-SITE-005 | `source-materials/site/SRC-SITE-005_school-emblem-transparent.png` | 校徽透明圖；頁首品牌識別來源 | 1315 × 1197 | `56D34494386D6FAFD35BF5C6BFAD2596E01A39E6A8432D19711E440FEF1B6CBE` |
| SRC-CONCEPT-001 | `source-materials/concepts/SRC-CONCEPT-001_side-section.jpeg` | 手繪側視／剖面；泳池大廳、男女空間與廁所關係 | 864 × 1536 | `525F52A2A166EBD056A1FAB0E2ED04515A591E5700C312B5F9CDE25659D869BA` |
| SRC-CONCEPT-002 | `source-materials/concepts/SRC-CONCEPT-002_roof-plan.jpeg` | 手繪屋頂平面；玻璃屋頂及男女空間關係 | 2267 × 2982 | `2344CFC87F2268F401194DA20C9AEF0315A072612CD3D2FC85846C9148465D49` |
| SRC-CONCEPT-003 | `source-materials/concepts/SRC-CONCEPT-003_l1-plan-v1.0.jpeg` | 使用者手繪「俯視圖－1F V1.0」；泳池、廁所、門與樓梯的早期想法 | 2210 × 2931 | `B39A97283AD36B39745E2A5D4C92A6D90CAB8AE8D142D3B06F1BCEC95E1CE543` |
| SRC-CONCEPT-004 | `source-materials/concepts/SRC-CONCEPT-004_perspective.jpeg` | 手繪室內透視；玻璃牆、泳池、挑高與服務中心 | 1064 × 1536 | `DBBB0D22F6C5BC8EE5197FF585EAA9014A13048DA158937AC5DFB6D52F8EF627` |
| SRC-CONCEPT-005 | `source-materials/concepts/SRC-CONCEPT-005_service-core-program-annotated.png` | 彩框概念；入口、原廁所重建、L2 更衣淋浴及屋頂坡向 | 1452 × 1042 | `B08B1781004983F2BEEFA1271361B9EB5A7C585F8BB59D3947FE83847059EE94` |
| SRC-CONCEPT-006 | `source-materials/concepts/SRC-CONCEPT-006_floating-stair-location-annotated.png` | 藍框概念；長邊玻璃外牆旁的懸空樓梯位置 | 2080 × 1466 | `157200EA2BE6C1EF1A213D4DE89589B0D18F9C184E490349F9E58919D6E16681` |
| SRC-CONCEPT-007 | `source-materials/concepts/SRC-CONCEPT-007_floating-stair-dual-stringer-annotated.png` | 紅線概念；雙厚鋼梯梁、懸空梯段及開放梯下 | 1430 × 920 | `D62448F0A987900F2C3208EE17D3B57FC2AE2DCDCE358002A294E4B54746F592` |
| SRC-CONCEPT-008 | `source-materials/concepts/SRC-CONCEPT-008_l1-outdoor-entries-annotated.png` | 使用者在現行 L1 圖面標註：紅框為男女廁、綠框為戶外、藍框為兩廁朝下的獨立戶外前門 | 2194 × 1120 | `BBAE9566DF0107810CFE3E499C0D32E0DB68A66B1CC846D3AD815F31FF7BDB0E` |
| SRC-CONCEPT-009 | `source-materials/concepts/SRC-CONCEPT-009_longitudinal-section-correction-annotated.png` | 使用者在 `REF-401` 圖面以紅色斜線標示屋頂概念位置、以綠框圈出入口戶外區；隨附文字另指出 `EXT-L2-01` 外牆為鏡面反射牆並應有一些傾斜 | 2216 × 1130 | `3CD710CEC62E32F2209EFA731FCF0EBFDA38A978BD0925A504481EE563175034` |
| SRC-CONCEPT-010 | `source-materials/concepts/SRC-CONCEPT-010_l1-plan-v2.0.jpeg` | 使用者手繪「俯視圖－1F V2.0」；標示 33 m 泳池主體、右側 8 m 機能翼、男女廁、戶外區、2 m 退縮、門與樓梯 | 3840 × 2110 | `467B4CFB573A5250FCF5D5D74D02AF4D696071B35FCA0C1D96817DFFCA99BD08` |
| SRC-CONCEPT-011 | `source-materials/concepts/SRC-CONCEPT-011_longitudinal-section-v2.0.jpeg` | 使用者手繪「剖面圖 V2.0」；表達 33 m 泳池主體、右側 8 m 機能翼、L1 廁所、L2 更衣室、外傾鏡牆、玻璃屋頂、雨水回收、2 m 退縮與 1F 至 2F 樓梯 | 3840 × 2747 | `3612C211F9AC06C6E9E8B40210C8282B7088DD81691D36F237C75E483329EB8B` |
| SRC-CONCEPT-012 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-012_campus-survey-01.jpeg` | 校園場勘 1；操場、校舍與基地周邊廣角現況；保存來源，不在 0.9.1 HTML 呈現 | image/jpeg；8064 × 4536；6,141,202 bytes | `484B5D2B066CE9EDA45316EBEE85E443EE7C4D9928679E30BAFE6D409BEE0E2C` |
| SRC-CONCEPT-013 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-013_campus-survey-02.jpeg` | 校園場勘 2；球場側既有泳池建物、樹木與入口；用於 0.9.1 ORIGIN 現場起點 | image/jpeg；8064 × 4536；6,091,749 bytes | `95EE7532DA5F45F82A2905D84496F602B1D4BE9517C192AF10333896FEE4EF29` |
| SRC-CONCEPT-014 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-014_campus-survey-03.jpeg` | 校園場勘 3；戶外樓梯、樹木與建物端部；保存來源，不在 0.9.1 HTML 呈現 | image/jpeg；8064 × 4536；8,024,325 bytes | `8A4596D3F36FAD00EFC4C787F973F6EAE1E6AA255A4484660BC39E965E59C37E` |
| SRC-CONCEPT-015 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-015_campus-survey-04.jpeg` | 校園場勘 4；鄰近校舍、連通棚架與建物端部；保存來源，不在 0.9.1 HTML 呈現 | image/jpeg；8064 × 4536；6,874,744 bytes | `E773D1A0AF3152AD5DCAEAE20C881DE2B87B3F3ED6A8A87546BD39DC6F5AF499` |
| SRC-CONCEPT-016 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-016_campus-survey-05.jpeg` | 校園場勘 5；既有建物、戶外樓梯、老樹與鋪面；用於 0.9.1 ORIGIN 現場起點 | image/jpeg；8064 × 4536；8,384,281 bytes | `ADB7A6F8F8D2AEDF31254F8FFEC204992B0B311DF3907E4484FB7E7A59863600` |
| SRC-CONCEPT-017 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-017_campus-survey-06.jpeg` | 校園場勘 6；老樹遮蔭下的既有泳池長向立面；用於 0.9.1 ORIGIN 現場起點 | image/jpeg；8064 × 4536；8,969,290 bytes | `E0FD617289DB8048E64C3A883480A1114CCDD7579FFC103D7D610F3BB2786809` |
| SRC-CONCEPT-018 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-018_overhead-plan-sketch.jpeg` | 早期手繪俯視圖；可見泳池、服務空間、戶外區、樓梯與手寫尺度；用於 0.9.1 ORIGIN | image/jpeg；1484 × 2701；EXIF 8；278,985 bytes | `66B1C3004ACF2EA94B3C3A6B265D891DCDFD4B89C1B79B5BF522B7CEF6F4F855` |
| SRC-CONCEPT-019 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-019_section-sketch.jpeg` | 早期手繪剖面；可見玻璃屋頂、鏡牆、泳池、雨水回收與服務空間；用於 0.9.1 ORIGIN | image/jpeg；1990 × 2782；EXIF 8；408,483 bytes | `A7FE1423B62A1B291DB11A8EFD5B60DB8BB1F793F5008D8EF541F803D3BFA865` |
| SRC-CONCEPT-020 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-020_early-3d-concept-sketch.jpeg` | 早期三維示意；使用者註記為哥哥協助，呈現泳池、入口、服務中心與傾斜屋頂；用於 0.9.1 ORIGIN | image/jpeg；1993 × 2830；EXIF 8；505,764 bytes | `14D424520AD7B9AB927C5697487F7840D2D7413A5C690A3A415E7A2004FF3390` |
| SRC-CONCEPT-021 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-021_solar-reflection-sketch.jpeg` | 手繪日照反射剖面；可見冬季／夏季光線、鏡面與水面；用於 0.9.1 ORIGIN | image/jpeg；1777 × 2525；EXIF 8；292,292 bytes | `505C257CE77913BF996A5C005FDBE4014679B27B5C180A2D085676F88971C109` |
| SRC-CONCEPT-022 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-022_solar-study-sketch.jpeg` | 粉紅紙張上的手繪日照研究；可見方位、季節、太陽與量體方向註記；用於 0.9.1 ORIGIN | image/jpeg；2772 × 1934；EXIF 3；369,294 bytes | `4E9A9BA11CCB56F29FD326CF97A92141AB8A157E30877E69D8B8047AFD3C62AF` |
| SRC-CONCEPT-023 | `source-materials/concepts/hand-sketches/SRC-CONCEPT-023_stair-concept-reference.png` | 樓梯概念參考截圖；依使用者指示只保存來源，不放入 HTML | image/png；237 × 512；257,988 bytes | `AD631A35040FEE34D88008B7459918F8B160406FA444CF80C9B4DA68607B9D83` |

`SRC-CONCEPT-009` 圖面可直接觀察到紅色斜線位於既有屋頂下方，以及綠框圈出 L1 右端灰色區域。使用者隨附文字指出 `EXT-L2-01` 外牆為鏡面反射牆並應有一些傾斜。設計上解讀為：`REF-401` 屋頂高端應靠近 L2 樓板、綠框是入口戶外區、`EXT-L2-01` 低 X 面池端牆是向泳池側外傾的鏡面牆；圖面與隨附文字都不提供正式標高、入口寬度或外傾角。

`SRC-CONCEPT-010` 於 2026-07-19 由使用者提供。圖面可直接觀察到 33 m、8 m、7 m、2 m 等手寫尺寸，以及泳池、女廁、男廁、戶外區、門與長邊樓梯。使用者隨附文字進一步確認：33 m 只計泳池主體且不含右側 8 m；戶外區為 8 × 7 m 且不與泳池大廳銜接；廁所 7 m 深度包含最上方與泳池相通的乾式走道，男女廁各有一個操場側開口及一個泳池側開口；原基地邊界內退縮 2 m，用於增加視覺開闊度並保留傾斜屋頂瀑布造景與雨水回收介面。廁所是否改切為對外／對泳池兩套獨立空間不是現行答案，留由 `OPEN-008` 討論。

`SRC-CONCEPT-011` 於 2026-07-20 由使用者提供。圖面可直接觀察到剖面左右端、33 m、8 m、2 m、玻璃屋頂、鏡牆、雨水回收、泳池、L1 男女廁與 L2 男女更衣室；圖上「深 1.4 公尺」不是最終設計值。使用者隨附文字進一步確認：向右上方延伸的兩條斜線代表 `ST-01` 由 1F 至 2F 的樓梯，不是鏡面反射光路；樓梯長度與角度仍需建議及確認；水深改為剖面左端（2 m 退縮／雨水回收端）1.2 m 淺水、剖面右端（8 m 機能翼／廁所端）1.5 m 深水。

`SRC-CONCEPT-012`～`SRC-CONCEPT-023` 於 2026-07-25 由使用者提供。原始位元組只改為穩定檔名，未縮放、旋轉、裁切、標註或重新壓縮；表內 SHA-256 即收件位元組。使用者指定 0.9.1 HTML 只使用校園場勘 2／5／6（`SRC-CONCEPT-013`／`016`／`017`）及除樓梯概念圖外的五張手稿（`SRC-CONCEPT-018`～`022`）；`SRC-CONCEPT-012`／`014`／`015`／`023` 仍保存但不被 HTML 引用。網站衍生檔另存於 `reference/src/views/design-concept/assets/`，只校正 EXIF 方向並縮放壓縮，沒有裁切或重繪。

這批資料的提供者為專案使用者；個別攝影者／繪圖者未另做完整權利登記，其中 `SRC-CONCEPT-020` 依原檔名與使用者敘述記為哥哥協助。使用者已在本輪明確指示上述八張影像放入公開 HTML。圖面中的線條與手寫文字只作為早期設計過程證據，不取代現行尺寸、active geometry 或專業設計確認。

`SRC-SITE-001` 於 2026-07-19 依使用者提供的新 Google Maps 衛星截圖置換；新版提高至 1612 × 1430 像素並擴大基地周邊視野，不含原黃色／綠色基地框。基地框與入口箭頭的既有標註證據仍由 `SRC-SITE-002` 保存。

`SRC-SITE-004` 於 2026-07-20 由使用者提供，原始檔完整保存，未裁切、縮放或重新壓縮。圖面可直接觀察到紅色框與上下兩個綠色框；框線語意依使用者隨附說明登錄為：紅框是目前泳池本體，上方綠框是廁所＋女生更衣室，下方綠框是男生更衣室。此圖已取代 `REF-001` HTML 內顯示的舊衛星空照圖；`SRC-SITE-001`／`SRC-SITE-002` 仍保留為歷史來源，不以新檔覆寫既有證據。彩框只確認現況位置與用途，不提供地籍邊界或精確尺寸。

`SRC-SITE-005` 於 2026-07-25 由使用者提供；原始透明 PNG 保留於來源資料夾，頁首使用 `reference/src/assets/site-emblem-header.png`（256 × 256、71,133 bytes、SHA-256 `2D0DD7CE869E3116E6EA1C8304640EF8E4C9151A15268AC0EFD704076706F77F`）衍生檔。

`SRC-SITE-003` 於 2026-07-16 由 PVGIS 5.3 TMY API 以 `24.14434°N, 120.67341°E` 取得；原始 metadata 記錄海拔 84 m、`PVGIS-ERA5`／ERA5、2005～2023、啟用 DEM horizon，12 個月份各選一個典型月份。觀察資料包含逐時 GHI `G(h)`、DNI `Gb(n)`、DHI `Gd(h)`、溫度、濕度、風與氣壓；本專案只解讀輻射欄位作概念能量比較。TMY 是長期典型月份的組合，不代表 2026 年實際天氣，也不是施工熱負荷保證。來源：[PVGIS 5.3 API](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en)、[PVGIS TMY 說明](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-tools/pvgis-typical-meteorological-year-tmy-generator_en)。

雜湊確認 repo 圖檔與各輪討論使用的原始檔一致。`SRC-CONCEPT-008` 直接支持 `DEC-028` 的入口語意，但它是在待修圖面上的使用者標註，不證明開口、通道或廁所隔間的精確尺寸；尺寸仍由 `OPEN-008` 管理。

## 4. 證據解讀規則

1. 使用者明確確認的文字決策。
2. 可讀取比例尺或方位的來源圖。
3. 經記錄的規劃數值與幾何推導。
4. 手繪圖表達的空間意圖。
5. 歷史 Viewer 或 DXF。

手繪不是按比例施工圖；標註圖只證明決策位置與意圖，精確尺寸由 [03_DESIGN_BASIS](03_DESIGN_BASIS.md) 管理。

## 5. 公開與署名

來源圖可直接存於公開 repo；個別影像是否在 HTML 呈現仍依來源登錄與使用者指示。Google Maps 截圖保留原有品牌、指南針及比例尺；地圖資料與影像權利歸 Google 及適用資料提供者，彩框與箭頭為使用者註記。本 repo 只把它保存為概念設計來源證據。

## 6. 已知限制

- 沒有正式地籍邊界、現況測量、CAD、結構或機電圖。
- 樹木、屋簷及影像透視影響邊界判讀。
- 307° 有向方位與基地外輪廓是工作值，未來可依新證據修訂；修訂不得再次交換泳池遠端與服務核心端。
- 新資料應新增修訂紀錄，再由單一模型切換至新值，不覆寫來源歷史。
- 校址中心座標不是泳池局部測量點；正式日照分析可用測量座標取代，但不得在頁面另寫第二套位置資料。

來源新增程序見 [06_WORKFLOW_AND_RELEASES](06_WORKFLOW_AND_RELEASES.md)。
