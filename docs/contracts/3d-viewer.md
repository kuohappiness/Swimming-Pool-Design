# 3D Viewer 契約

- 類型：output-contract
- 狀態：active／v0.9.7
- Owner：[模型契約](model.md)
- 入口：`/?view=3d-viewer`

## 資料來源與同步

Viewer 只接受：

- `web/src/generated/viewer-model.json`：由 active `GEO-0.10.0` 產生。
- `web/src/generated/concept-content.json`：由公開理念 Markdown 與 `{{active:...}}` token 產生。

兩者必須有相同 `modelVersion=0.10.0` 與 `modelHash`。viewer model 另須包含 `schemaVersion=1.5.0`、`activeGeometryRevisionId=GEO-0.10.0`、`geometryRevision=0.10.0`、`coordinateSystemId=SITE-XY`、唯一 `referenceSystem.siteOrientation`、`referenceSystem.siteLocation`（校址經緯度與時區，3D 太陽位置的輸入）及每個 bounded entity 的 canonical `entityBounds`。不得輸出第二份 world bearing 或 `northArrowPlanDirection`。L2 `splitAxisY` 必須存在、為有限數值、等於男女更衣淋浴區共用邊界 Y8，且不得與 Y0 玻璃或 Y2.5 樓梯分隔牆重疊；任何一項不符都必須直接失敗，不得回退為 Y0。hash、token、scene ID、geometry revision 或有限幾何不符時同樣直接失敗，不顯示 fallback 幾何。

`model/analysis-registry.json` 的 solar `inputHash` 只涵蓋校址／方位、池體、L3 旋轉與支點、鏡牆角度／高度、固定屋頂接收面、能量假設及氣象來源。這些分析輸入不符時才顯示 `stale`；立面材質、非接收面屋頂、天花或隔牆等非日照輸入改版，不要求重算。只有分析輸入改變並完成 solar 重算與既有回歸測試後才可更新為 `current`。

## 幾何與 transform

- SITE X／Y／Z 只在右手座標 `SITE-XYZ-TO-THREE-RH` adapter 對應 Three.js X／−Z／Y；SITE +Y 不得直接映到 Three +Z，避免 Y0／Y14 鏡射。
- `WORLD-BEARING-ROOT` 只讀 `referenceSystem.siteOrientation` 一次。canonical 307°是從真北順時針量到 SITE +X 的羅盤方位角；在 SITE Y→Three −Z adapter 下，root 的 Three.js Y 軸旋轉由共用函式推導為 `90°−307°=143°`，不得直接把羅盤值寫成 `−307°`或建立本地 override。
- L1／L2／屋頂固定；L3 主矩形在獨立 group 以 X35／Y6.75 水平旋轉 +25.5°，新增正交三角擴板與到達翼保持 SITE-XY 不旋轉。
- L3 面池承載牆與 `F-MIR-01` 共面，共同向池側外傾 +23.0°；顯示偏移只可小到避免 z-fighting。
- L1 表達 25 × 8.5 m 池體、1.2→1.5 m 斜底、四間獨立廁所、無障礙暨親子室、管理暨急救室、水處理、藥劑分間與右側緩坡。
- `DEC-157` 的一堂課動線由 `pool-use-details.ts` 表達：±0.00 換鞋玄關（Y0 玻璃與 `EN-01` 在此落到 ±0.00）、1:12 坡道與兩階、+0.30 m 乾式廊道與 1.1 m 低牆、梯底洗腳池與 3 支沖身、AED、集合區、救生椅、X31 兩室的門與面池窗、教具推車與移動式升降椅。Y0 帶的部分（`CUTAWAY-HIDE-Y0-POOL-DECK`、`CUTAWAY-HIDE-Y0-POOL-USE`）隨泳池剖視隱藏。漫遊時玄關是 ±0.00 的地面，坡道與兩階是由 ±0.00 到 +0.30 m 的斜面。
- `DEC-158` 的可移除教學平台 `POOL-PLAT-01` 在水面下 `topWaterDepth`，屬 `water` 圖層，泳池剖視可見。
- L1 西端外牆退至 X0.5，`EN-01` 位於 X1～X3；L1 Y0 的 X0.5～X31 為安全玻璃，只有 X31～X39 服務本體是自然灰清水模。X0～X0.5 顯示傾斜玻璃突出屋簷／雨水回收，X31～X39／Y13.5～Y14.5 顯示後側透明玻璃屋簷。四間廁所立面仍依 active `toiletEntrances` 切出 1.00 m 無門板洞口。
- 廁所內裝須可辨識具盆深、座圈／沖水五金或腳踏區的 WC、具盆深／龍頭／鏡面／排水的洗手槽、具沖水與感應細節的小便斗，以及具有門板、五金與離地腳座的 WC 隔間；四個入口不設遮擋版，可直接面向洗手台。全 L1 必須正好 8 座 WC、坐式 4 座／蹲式 4 座：泳池男廁依資料順序為坐式、蹲式；泳池女廁為坐式、蹲式、蹲式；操場男廁為坐式；操場女廁為蹲式、坐式，且靠 X39 入口者為坐式。男廁洗手台貼 Y0、女廁洗手台貼 Y7.5，所有 WC 隔間貼 Y3.5；泳池男廁其中一座小便斗位於 X31 且避開入口。操場男廁須顯示 1 WC＋2 小便斗＋2 洗手槽，操場女廁須顯示 2 WC＋2 洗手槽。
- L2／L3 基準板為 12 × 13.5 m；L2 +3.30 m、L3 +6.88 m。
- L2 顯示 Review A 的 L 形面池走道、X29 觀景窗、X32 男女 1.00 m 無門片入口、無座懸空站立桌／飲水機／盆栽，以及男女各 15 間含隔間 1.20 × 1.20 m 淋浴模組、1 WC 與 2 洗手槽。Y0 外牆須為 X29～X41 全寬安全玻璃，並與其他安全玻璃外牆共用同一材質、高光、邊框與豎梃系統；從 Y0／Y14 都須清楚讀成「前方玻璃＋後方牆面」，不得只靠資料標籤判定。Y2.5 清水模牆是後方獨立平面，須由 X32 連續封至 X41、不得留樓梯間通往更衣室的開口。L2 天花板須完整覆蓋 X29～X41／Y0～Y13.5。
- `ST-02` 由 X32.5 起步、固定在 Y0.5～Y2.0、朝 +X 上升至有頂的 3F 正交到達翼；須以薄踏步、封閉踢面、兩道連續鋼箱梯梁、懸空平台與開放梯下表達。梯下顯示 3 組可移除低矮植栽，不得以斜向樓梯、封閉梯下或戶外景觀區作唯一通路。
- L3 顯示固定正交三角擴板、約 2.964 m² 有頂到達翼及淨約 3.971 m² 受控景觀區；景觀區以鎖門／告示限制教師與維修人員使用，不開放學生、訪客、公眾聚集或作主要逃生。
- L3 須有隨主量體旋轉 +25.5° 的完整不透明屋頂，連續覆蓋至鏡牆上緣，鏡面牆兩端與相鄰直立牆間的三角缺口須封滿。屋頂在四周保留 0.25 m 概念退縮後以約 169.364 m²／92.74% 高密度太陽能板排布，資訊面板明示模組、容量與發電量 deferred；一般 L3 室內不得顯示電池，儲能策略須說明地面層獨立戶外機櫃優先。
- `ST-01` 為 X20.5～X29／Y0.5～Y2.0（Y0 側）、1.50 m 淨寬、20 級高／18 踏面、2.70＋3.10＋2.70 m，從 +0.30 m 直接接 L2；Viewer 只讀 active canonical bounds，不保留 `originY` fallback，且必須用薄踏步、封閉踢面、兩道連續鋼箱梯梁與開放梯下表達懸空設計，不得以逐階落地實心箱體代替。
- L1～L3 不透明服務中心使用自然灰清水模材質；玻璃屋頂與 L3 鏡牆維持獨立材質。
- 固定屋頂為 29 m／5°／+4.00→+6.537 m。
- 結構支承整合於 X34／X35.5 隔間／設備／立面帶（X34 由 `DEC-157` 從 X32.5 移來，待結構驗證），不使用孤立突兀核心柱；玻璃不承重。
- 高位設備只在固定支承帶，不隨旋轉 L3 懸挑。

23° 外傾、轉換結構、設備容量、避難與所有材料僅為概念工作值；Viewer 必須顯示專業驗證限制。

## 場景與操作

`scene-manifest.json` 固定提供 `overview`、`light`、`rain`、`people`、`time`。場景只改相機、visibility、environment、日照時刻（`lighting`：月、日、當地時刻與天氣）與展示摘要，不另建第二套幾何。0.9.1 起每個場景另有一段短摘要、恰好三個觀看重點及設計理念 anchor；這些欄位只屬 Viewer 展示層，不替代公開理念 Markdown 正本。

0.9.1 的 3D view 必須是共用 App Shell 內的 HTML fragment，不得再匯入含 `doctype`、`html`、`head`、`body` 或 runtime script 的舊完整頁面後以 DOMParser 拆解。右側 panel 只顯示模型構件資訊與當前場景摘要；完整 `concept-content.json` 仍參與 modelHash、modelVersion 與 scene ID 同步驗證，但不得以 `data-concept-content` 或等價容器把文章全文注入 3D 頁。完整敘事只能透過連結返回 `design-concept` view 閱讀。

0.9.2 公開展示預設隱藏場景敘事導覽與右側構件資訊，但保留其模板及 runtime，供後續修訂後恢復；圖層狀態以顏色圓點表示，攝影機控制採緊湊網格，第一人稱入口移至分頁導言並命名為「實境漫遊」。上述均為展示層調整，不得刪除資料、改寫場景語意或改變碰撞與幾何。

Viewer 必須由 `?view=3d-viewer` 的 view-level dynamic import 才載入 Three.js；離開頁面時停止 RAF、解除 listener／ResizeObserver、清除 canvas 並 dispose renderer／controls／selection／walkthrough runtime。反覆由導覽進入、離開再進入時，每個 document 只可有一個 canvas。

### Enhanced rendering

- 0.8.2 預設使用本地 PBR material registry、PMREM environment、ACES tone mapping、stable PCF shadow、可降級水面與純視覺人物／植栽／設備；另加入清水模分割／螺桿孔、玻璃收邊／膠條、屋面排水／轉接收邊、池畔溢流格柵／排水、池底水道線／焦散、室內磁磚／照明／通風、淋浴／置物櫃及 L1 衛浴器具。`?rendering=baseline` 是明確診斷 fallback，不形成第二套資料來源。
- necessary material／shader runtime 建立失敗時須自動回復 baseline rendering 並公開 diagnostic；optional water／environment／visual asset 失敗只停用對應視覺，不阻斷 Inspect、Walkthrough、選取或碰撞。
- high／medium／low 只可改 pixel ratio、shadow、texture anisotropy、environment、surface detail、水面、動畫與 postprocess 成本。新增細節以 `essential | reduced | full` 單調分級：low 只保留輪廓與必要辨識，medium 增加操作／構造層次，high 顯示全部五金、接縫、排水、焦散與可動視覺；quality 不得改 camera、scene ID、layer visibility、selection、canonical bounds、collision、player position、water simulation 或 movement mode。所有 quality-controlled detail 必須標示 `visualOnly=true` 與 `collisionExcluded=true`。
- 畫質分四級：極致（`ultra`）、高（`high`）、中（`medium`）、省電（`saver`），定義只在 `rendering/performance/realism-tiers.ts`，各級的繪製呼叫、三角形與下載量上限只在 `core/viewer/render-budgets.mjs`（[DEC-190](../decisions.md)）。幀率底線電腦 60 fps、手機 30 fps（目標 45 fps）。啟動選級的優先順序是網址 `quality` 參數、使用者在畫質選單選過的級別（存在這個瀏覽器的 localStorage）、軟體繪圖一律省電級、啟動檢測、保守預設；手機自動選級最高到中級。啟動檢測在中級連畫幾幀並逐幀等顯示卡做完，載入畫面期間完成；量不到時電腦用高級、手機用中級。舊連結的 `quality=low` 視為省電級。headless SwiftShader 量不到硬體幀率，檢查環境只斷言繪製呼叫與三角形，不得冒充硬體 FPS。繪圖管線內部仍以 high／medium／low 三種設定決定材質與貼圖版本（極致與高共用 high），公開在 `data-render-quality`；四級的級別與來源公開在 `data-realism-tier`、`data-realism-tier-source`。
- renderer 必須公開平均／p95 frame time、draw calls、triangles、shader programs／compile、drawing buffer、陰影更新模式與 context restore diagnostic；靜態陰影圖可在首次繪製後快取，但場景、圖層、剖視、畫質或 context 改變必須要求重算，context restore 不得重建 canonical 或 collision state。
- 所有 runtime asset 必須是 repository-local 且具有 manifest provenance、license、SHA-256、byte size、quality tier 與 required／optional 分類；正式頁面不得存取外部 asset origin。資產的單檔容量、資料夾總量、副檔名與命名由 `npm run check:assets` 檢查，上限寫在 `core/viewer/render-budgets.mjs`（[DEC-190](../decisions.md)）。資產清單的唯一來源是 `web/src/views/3d-viewer/assets/asset-manifest.json`；KTX2 壓縮貼圖須由 `npm run build:textures` 產生並記錄轉檔設定與來源雜湊，轉碼器隨網站打包，不得改由外部網域載入。
- 真實太陽（[DEC-191](../decisions.md)、TASK-152）：enhanced rendering 的主光源、天光、背景、霧與曝光由 `rendering/lighting/` 依「校址經緯度與時區（`referenceSystem.siteLocation`）、基地方位（`referenceSystem.siteOrientation`）、日期、時刻、天氣」算出來。太陽高度與方位只可呼叫 `core/solar/solar-reflection.mjs` 的 `calculateSolarPosition` 與 `solarDirectionInLocalCoordinates`，不得在網站端另寫一份天文計算；方向換到世界座標只經過場景自己的 SITE 座標根節點，不得另存第二份方位。時刻一律是校址當地時間（年月日與從午夜起算的分鐘），不得經過瀏覽器的時區。主光源一定在地平線以上：太陽落到地平線下之後改由月光接手，交接時兩者都接近全暗。陰影相機包住「基地範圍加外擴、建築全高」的一顆球，太陽移動時涵蓋範圍與解析度不變。拖動時刻時陰影每一格重畫，水面倒影取樣最快每 160 ms 重拍一次。陽光與天光的顏色、強度是視覺近似，不是日照量；3D 頁不得重算日照研究頁的能量數字。場景自帶的日照時刻寫在 `scene-manifest.json`；`time`、`weather` 網址參數只在剛開啟頁面時蓋過場景設定，選場景會回到場景設定，「重設視角」只重設相機。目前的時刻、天氣、太陽高度與方位、主光源是太陽或月光公開在 `data-lighting-moment`、`data-weather`、`data-sun-altitude`、`data-sun-azimuth`、`data-key-light`、`data-day-phase`。`?rendering=baseline` 沒有這條路徑（`data-real-sun` 為 `false`），維持各場景固定的環境，也不顯示「日照時刻」控制。
- 天空（TASK-152）：enhanced rendering 的天空是一顆只跟著鏡頭轉、不跟著鏡頭移動的天空球（`rendering/lighting/sky-dome.ts`，物件名稱 `SKY-DOME`），畫在所有不透明物件之後，每畫一次場景只多一次繪製呼叫，不寫深度、不受霧影響、不投影也不參與選取與碰撞。天空的每一個參數都由同一份光照狀態推出來（`sky-parameters.ts`），不得另存第二份太陽方向或天氣：大氣散射依太陽方向計算，雲量依天氣（晴天少雲，陰天與雨天滿天雲），雲與地平線以下的虛擬地面的亮度來自同一組陽光與天光，星星與月亮只在夜裡沒有雲的地方出現。雲的位置由日期與時刻決定，同一個時刻每次看到的雲都一樣，鏡頭不動時畫面是靜止的，倒影與平面倒影不必每幀重拍。天空輸出走和場景相同的色調映射與色彩空間。中級以上的倒影與間接光（環境貼圖）由這片天空產生，不含日面、月亮與星星（太陽與月光由方向光負責，放進環境貼圖會重複計算並產生雜點）；產生一次的成本遠高於其他更新，所以拖動時刻時只按天光強度的比例調整環境貼圖的亮度，停下 280 ms 之後才重新產生，換場景時立刻產生。省電級沒有環境貼圖，雲用簡化版。`environments/courtyard-sky.svg` 只在第一份光照狀態套用之前當作備援。天空球是否存在公開在 `data-sky`（`dome`、`none`），環境貼圖的來源公開在 `data-environment-source`（`sky`、`fixed`、`none`）。地面的參考格線已移除；方位標示（基地 +X 軸與指北）保留在標註圖層。天空是視覺近似，不是氣象或日照資料。
- 陰影與曝光（TASK-152）：只有不透明的構件投影；材質是透明的網格（玻璃、水面、半透明示意面）不得投影，否則池廳整個落在玻璃屋頂的影子裡。池底、池壁、水面的太陽反光、水下光束與懸浮微粒查的是同一張太陽陰影貼圖（`uSunShadowMap`），不得另畫第二張；沒有陰影貼圖時（省電級、第一個畫面）水的著色器仍要綁一張深度比較用的備用貼圖，水裡每一點視為照得到太陽。高畫質的影子邊緣隨遮蔽物的距離與光源大小變柔（`rendering/lighting/soft-shadows.ts` 換掉 three.js 陰影著色器裡 PCF 的 `getShadow`）：`shadow.radius` 為 0 以上時是固定半徑（和 three.js 原本相同），負值的絕對值是「遮蔽物每遠一公尺，半影半徑多幾格」；光源大小由天氣決定（晴天接近日面，陰雨天是一片發亮的雲）。three.js 的著色器對不上時不得硬換，維持固定半徑；裝上與否公開在 `data-shadow-filter`（`distance-soft`、`fixed`）。中畫質與 `?rendering=baseline` 用固定半徑。天光強度指「整片天空照在水平面上的量」，由半球光與環境貼圖一起提供，兩者加起來等於算出來的天光（高畫質環境貼圖佔 64%、中畫質 46%、省電級 0%），不得各給一份；水的著色器不吃環境貼圖，取 `ambient.userData.skyIrradiance`。朝下的面由半球光的地面色補光，地面色由照到地面的陽光與天光推出來。這些強度與曝光是視覺校正，不是照度計算。要同時開著好幾個圖層才畫的構件登記在場景的 `layerDependents`（目前只有 3F 屋頂：`roof` 與 `l3` 都開著才畫），圖層開關變動後一律呼叫 `syncLayerDependents`；目前藏起來幾件公開在 `data-layer-dependents-hidden`。
- 鏡牆（TASK-152）：鏡牆反射的日光只可由 `core/geometry/mirror-geometry.mjs` 的 `deriveMirrorGeometry` 與 `core/solar/solar-reflection.mjs` 的 `reflectSolarRay`、`projectMirrorReflectionFootprint` 推出，鏡牆的輸入取自網站的模型（`rendering/lighting/mirror-bounce.ts` 的 `mirrorWallFromViewerModel`），須與日照研究頁的 `activeMirrorFootprintGeometry` 逐項相同；網站端不得另寫一份鏡面幾何或反射計算，也不得在 3D 頁重算能量。畫面上反射光是一盞只從鏡面平行四邊形射出的平行光，亮度為陽光乘鏡面反射率（視覺用 0.75），只在太陽照到鏡面正面、反射光往下走時存在，月光不反射；標準材質在 three.js 光照之後加這一盞光，池底與池壁由水的著色器計算（`pool-basin.glsl` 的 `// #include mirror-bounce` 換入同一段遮罩），兩者讀同一份反射光（`scene.userData.mirrorBounce`）。3F 圖層關掉時鏡面不在畫面上，反射光一併消失。鏡面的倒影由鏡面前方的反射探針加盒狀視差修正提供（`rendering/enhanced/mirror-reflection.ts`，場景裡的鏡面網格名稱 `F-MIR-01-SURFACE`、不參與合併），與水面探針一樣只在光線、天候、圖層、剖視或畫質改變時重拍，拍照不計入當幀的繪製呼叫。拍倒影的相機（反射探針、平面倒影）標 `userData.reflectionCapture`，天空球在這些相機裡不畫日面、月面與星星。光斑落到池面時「日照時刻」的說明加註「概念示意」；反射率、平整度與眩光待 `OPEN-011` 專業驗證。反射光落在哪裡公開在 `data-mirror-bounce`（`pool`、`outside-pool`、`none`），入射角在 `data-mirror-incidence`，鏡面倒影來源在 `data-mirror-reflection`（`probe`、`environment`）。
- 池館燈具與室內反射（TASK-152 步驟 5）：燈具位置只來自 `fixture-layout.ts`，場景畫出來的燈具網格與燈光計算共用同一份；燈具配置、數量與光通量是視覺用的概念值，不是照度計算，機電設計待 `OPEN-009`。陰天、雨天整天開燈，晴天在太陽低於 6° 時開燈。燈光沒有陰影貼圖，每一區只照自己的盒子（池廳的玻璃牆外留一段溢光，朝服務核心的實牆不溢出；2F 只照 2F），標準材質在 three.js 光照之後加上這些燈的漫射（`rendering/lighting/fixture-lights.ts`），燈的高光只來自池廳探針照出的發光面，不重複計算；池底、池壁與水下燈由水的著色器計算，天花燈照進水裡用池面的平均照度、不逐盞計算，兩者讀同一份燈光（`scene.userData.fixtureLights`）。燈光照在構件上的強度依燈具照度相對於室外日光的比例漸變：白天開燈時只看得到發光面與水下燈的透鏡，不跑燈光迴圈；夜裡的換算與場景夜景的放大一致。省電級（軟體繪圖一律用這一級）在燈光照不到構件時，標準材質不編進燈具照明（照到時才重編），水裡也不算水下燈、透鏡不亮；其他級一直編著，開關燈不重編。燈具所在的圖層關掉時那一區的燈不亮。中、省電級把燈就近合併成較少盞，總光量不變。池廳裡受光的標準材質（不鏽鋼、玻璃、池畔）以水面那一個池廳中央探針取代環境貼圖的反射（`rendering/enhanced/hall-reflection.ts`，同一個盒狀視差修正、不另拍）；從池廳外看玻璃時維持環境貼圖。拍倒影的相機不讀這個探針。燈具開著時「日照時刻」的說明加註「燈具配置為概念示意」。燈具開關公開在 `data-fixture-lights`（`on`、`off`），照在構件上的強度在 `data-fixture-surface-lighting`（0 到 1），池廳反射來源在 `data-hall-reflection`（`probe`、`environment`）。
- 鏡頭效果（TASK-152 步驟 6）：極致與高級先把場景畫到多重取樣（最多 4 倍）的半浮點貼圖（`rendering/enhanced/frame-effect-pipeline.ts`），在線性亮度下依序做曝光測光、環境遮蔽與接觸陰影、曝光、暈光，最後由 `OutputPass` 做唯一一次色調映射與 sRGB 轉換；曝光已先乘進去，色調映射用 1，和材質內的色調映射同一套算法。中級與省電級照舊直接畫到畫面、在材質內做色調映射；顯示卡不能畫浮點貼圖時（`supportsFrameEffects`），極致與高級也直接畫。環境遮蔽（three.js 的 GTAO 著色器，法線由深度還原，不另畫一次場景）與接觸陰影（從每一點朝太陽走 0.35 m，查畫面深度有沒有被擋）在半解析度的同一個 pass 算（`screen-space-occlusion.ts`）；環境遮蔽只擋天光與燈具，接觸陰影只擋陽光，兩者各占多少由同一張太陽陰影貼圖與場景裡的太陽、天光、燈具強度估出（`frame-grade.ts`），陽光下的地面不得被環境遮蔽壓暗。水面（畫進浮點貼圖時輸出 alpha 0）與天空不套。曝光適應（`exposure-adaptation.ts`）：畫面的對數平均亮度在顯示卡上測、不讀回 CPU，和這一刻水平面照度（天光、陽光的垂直分量、燈具）的比值偏離目標時補其中 60%，最多 ±1.5 格；往亮處的時間常數 0.5 秒、往暗處 1.6 秒，換場景時直接用測到的值。雨天、黃昏與夜裡整體較暗是光線本來就弱，比值不變，不得被拉亮。暈光（`bloom.ts`）只暈曝光之後比門檻（線性亮度 2，遠比白色亮）亮出來的那一部分，每個像素有上限，不得把整個顏色拿去暈。分級：極致全開；高級有多重取樣、曝光適應與暈光，沒有環境遮蔽；中級與省電級都沒有。幀率吃緊時調節器先卸暈光、再卸環境遮蔽（連同接觸陰影），後製與曝光適應留著，曝光不會跟著跳。鏡頭在水裡時水下畫面畫回後製的場景貼圖，只有顏色、沒有深度，水下不套環境遮蔽。目前開著的效果公開在 `data-frame-effects`（`multisample`、`exposure-adaptation`、`bloom`、`ambient-occlusion`、`contact-shadows`，都沒有時為 `none`）。
- 水面（[DEC-190](../decisions.md)、TASK-151）：enhanced rendering 的水是一支不透明的著色器，折射後看到池底哪一點由池體形狀直接算出，不得為了折射把整個場景多畫一次。池體形狀與池底標線只從 `pool-state.ts` 的 `getViewerPoolBasinShape` 取得，啟用前須確認與場景裡的水面重合；實體池底、池壁與水面共用同一段著色與同一批 uniform。倒影取自池面中央的反射探針，只在光線、天候、圖層、剖視或畫質改變時重拍，並依模型的池廳大小（`getViewerPoolHallShape`）修正視差。高與極致級另有半解析度的平面倒影：場景靜態，所以鏡頭不動時不重畫，鏡頭在水面下時不畫；鏡頭移動時多畫的那一次仍須在該級的繪製呼叫上限內（e2e 以 `data-draw-calls-peak` 把關），幀率吃緊時由調節器先把它的解析度減半。中與省電級只用探針。水裡的構件（池梯踏板與扶手水下段）以方盒加進折射計算，位置與場景裡畫出來的同一個來源（`pool-state.ts`）。倒影來源公開在 `data-water-reflection`（`planar`、`probe`、`none`）。貼圖載入前與載入失敗時維持原本的水面呈現，不阻斷 Inspect 與 Walkthrough。目前的水面呈現公開在 `data-water-presentation`（`realistic`、`realistic-loading`、`legacy`、`legacy-fallback`、`baseline`）；`?water=legacy` 只供比對與除錯。基地地坪在泳池位置開口，池底到水面之間不得有水以外的幾何。
- 水下畫面（[DEC-190](../decisions.md)、TASK-151）：高與中級在鏡頭（近裁面任一角）進到池水裡時，場景先畫到一張貼圖，再由全螢幕著色器依每個像素到鏡頭的距離加上水的吸收與散射、光束與水線，最後才做色調映射；吸收、散射與焦散和水面、池體共用同一批 uniform。是否在水裡依鏡頭位置判斷，不依人物的移動狀態。這時漫遊不得再替場景加水下霧（`data-underwater-fog` 為 `false`）；省電級沒有水下畫面，水色仍由漫遊的場景霧近似。鏡頭不在水裡時這條路徑不得有任何成本。上一個畫面是否為水下畫面公開在 `data-underwater-view`。
- 玻璃與濕地面（[DEC-190](../decisions.md)、TASK-150）：enhanced rendering 的任何材質都不得使用 transmission，因為它會把整個不透明場景再畫一次。屋頂玻璃、安全玻璃與濕地面水膜共用 `rendering/enhanced/glossy-film-material.ts` 的薄膜材質：倒影不被不透明度打折，正看幾乎透明、斜看倒影變強；沒有環境貼圖的畫質級退回半透明色片。`?rendering=baseline` 的基準材質是診斷用途，不受此限。

圖層固定為 `site`、`l1`、`water`、`l2`、`l3`、`roof`、`circulation`、`rain`、`energy`、`annotations`。桌機與觸控支援 orbit、pan、zoom、一般固定視角、圖層切換與構件選取；canvas 與等價控制須可鍵盤操作。選取只更新下拉選單與右側資訊面板，3D 畫布不得顯示 `BoxHelper` 或其他外接選取框。390 × 844 不得水平溢出。

另須提供「泳池剖視」固定視角：相機由 SITE Y0 長邊觀看，隱藏鏡頭側地坪、池畔、L1 Y0 立面與近側池壁／壓頂，保留遠側池壁、透明水體、X3 淺端 1.20 m、X28 深端 1.50 m 及高差 0.30 m 斜底。剖視模式把最大極角放寬至約 120°，可稍微向下／越過水平旋轉；切換其他固定視角、場景或重設時，所有遮擋物與一般約 88.2°相機限制必須完整恢復。

Viewer 上須有固定螢幕方位提示，以清楚的 `N ↘` 箭頭表示真北指向畫面右下角；桌面與 390 × 844 行動視窗均須可見。3D 場景內的真北箭頭亦須由同一 307° transform 推導，並在箭頭尖端顯示可讀的 `N` 標記。提示不另寫第二套方位，不旋轉相機。

### 靜態合併與繪製類別（TASK-160）

- 場景建好、視覺細節掛上之前，`scene-batcher.ts` 把同一個切換單位（模型圖層、泳池剖視要隱藏的物件、同一細節等級）裡、材質與陰影設定相同的靜態網格與線條合併成一個繪製。合併不跨圖層、不跨剖視物件、不跨細節等級，所以圖層開關、剖視與畫質分級的行為不變。
- 不合併：`POOL-01-WATER-SURFACE`（水面由 rendering 換材質）、會動的焦散、剖視標註、虛線、輔助線，以及標了 `userData.batchExclude = true` 的物件。新幾何需要被程式找到、移動或換材質時就標 `batchExclude`。
- 選取：合併後每個三角形（線條是每一段）在 `userData.faceOwners` 記得自己屬於哪個構件，點選時以命中的三角形決定構件；選取框位置用合併前記下的 `SelectableInfo.bounds`。
- 繪製類別：每個網格保留 Three 圖層 0，另加一個類別圖層：structure 1、water-surface 2、small-furnishing 3、people 4、vegetation 5、glass 6、mirror 7、emissive-fixture 8、site-context 9（`RENDER_CATEGORY_LAYERS`）。類別預設由材質推得（玻璃、鏡面、水、發光、植栽、地坪），細節物件預設 small-furnishing，其他為 structure；新增幾何可在自己或上層設 `userData.renderCategory` 指定，寫錯名稱會直接報錯。只畫部分類別的 pass（倒影、陰影層、AO）在自己的相機關掉圖層 0、打開需要的類別。
- 幀時間統計：`frame-statistics.ts` 的 `FrameStatistics` 以最近 120 幀算出 `FrameObservation`（`timeSeconds`、`samples`、相鄰兩幀間隔的 p95 `intervalP95Milliseconds`、每幀更新加送出繪製的 CPU 時間 p95 `workP95Milliseconds`），公開為 `data-frame-interval-p95-ms`、`data-frame-work-p95-ms`，供 3D 串的畫質調節器使用。尚未含 GPU 計時，GPU 吃緊時工作時間會偏低，調節器仍須同時看間隔。
- `?batch=off` 關閉合併，只供比對與除錯。合併前後的網格數公開在 `data-static-batch-source-meshes`、`data-static-batch-meshes`。
- 繪製預算（與 3D 串約定，DEC-154）：桌機 high 每幀 500 次繪製、80 萬三角形；手機 medium 25 萬三角形，繪製次數暫為 250，3D 階段移除透射 pass 後收緊為 200。e2e 以這些數字當硬上限；幀時間在雲端量不準，不做硬斷言。

### 第一人稱漫遊

- Inspect 是預設且可完整使用；「第一人稱漫遊」從 `EN-01` semantic safe spawn 進入，退出必須恢復原相機、場景、圖層、選取、固定視角／泳池剖視、panel scroll 與焦點。
- simulation 只接受由 active Viewer model 經 read-only adapter 衍生的 `WalkthroughSource`；不得回寫 `project-model.json`，不得另建第二份建築 bounds。`siteRoot.matrixWorld` 是 visual／collision 共用 transform。
- player 使用固定 1/120 秒步進、1.65 m 人眼與 0.28 m capsule；桌機與 touch input 只產生共同 `MovementIntent`。frame-time 或 quality 改變不得修改 movement／collision state。
- solid world 包含建築邊界、池壁、池底與 ST-01／ST-02 連續坡面；`EN-01` 保持可通行。七個 area jump 只可使用 `entrance`、`l1-pool-deck`、`l1-sanitary`、`l2-arrival`、`l3-arrival`、`l3-terrace`、`roof-inspection` 的 clear＋supported semantic spawn，不得硬編碼 world 座標；`l1-sanitary` 必須位於泳池側男廁入口內的清楚、受支承位置，讓桌機與手機可直接檢查衛浴細節。
- `POOL-01` 可見水面、WaterVolume、X3 1.20 m→X28 1.50 m 斜底與碰撞共用同一 surface elevation。walking／falling／surface／underwater transition 須有 hysteresis；支援浮力、下潛、上浮、池壁／池底、clearance 上岸與「返回池畔」。
- 桌機使用 WASD／方向鍵、滑鼠拖曳或 pointer lock、Shift、Space、C 與 Esc；帶 Ctrl、Cmd 或 Alt 的按鍵交給瀏覽器，焦點在畫面控制項時由控制項處理自己的按鍵（[DEC-149](../decisions.md)）；pointer lock 拒絕時保留 drag-look。390 × 844 使用雙觸控面、44 CSS px 上浮／下潛、區域、返回與退出控制，並遵守 safe-area inset、ARIA、鍵盤路徑與 reduced motion。
- 幀率調節（[DEC-190](../decisions.md)）：幀間隔的 p95 持續超過底線時，先把繪製解析度逐步降到該級的最低比例（70%），再依固定順序關閉已接上畫面的效果，都用完才自動降一級；有餘裕一段時間後依相反順序恢復解析度與效果。級別自動只降不升，升級由使用者在畫質選單選；唯一的例外是降到最低一級仍無改善、而每幀工作時間很短時，判定更新率是被螢幕或瀏覽器限制，回到自動降級前的級別並把底線放寬到實際的更新間隔。載入期間量到的螢幕更新間隔比底線長時（例如 50 Hz 螢幕），底線同樣放寬。調節只改繪製成本（像素比、陰影、水下效果、鏡頭阻尼與各級效果），不得改動移動、碰撞、選取或任何語意狀態。`adaptive=off` 與軟體繪圖不做自動調整，畫質選單仍可使用。平均與 p95 frame time、目前的解析度比例（`data-resolution-scale`）須保留為 diagnostic。
- `InputAdapter`、`MovementStrategy`、`VisualAssetAdapter`、`AreaRegistry` 與 `EnvironmentEffect` 保持窄介面；不得對 SketchUp／GLB 或未採用的未來格式硬編碼。

WebGL 不可用或 `?forceFallback=1` 時不建立 3D／漫遊 runtime；enhanced necessary asset 失敗時建立 baseline 3D runtime；walkthrough adapter 驗證失敗時只停用漫遊。三種情況都須保留可用的 Inspect 或靜態總覽、五場景短摘要、完整理念連結與 V067 圖集連結，不得以 fallback 為由重新顯示整篇理念文章。

## 驗收

- `npm run build:content`：hash、token、scene ID、active revision 與有限幾何通過。
- `npm test`：SITE-XY bounds、右手座標 adapter、307° 羅盤方位→Three 143°換算、SITE +X 世界西北、場景真北右下與 N 標記、ST-01／ST-02 active bounds、30 間淋浴、到達翼／受控景觀區、右下真北提示、current／stale hash、五場景、transform 分層、source isolation、camera lifecycle、input、collision、safe spawn、游泳、水下與效能 hysteresis 通過。
- `npm run typecheck`、`npm run build`、`npm run test:e2e` 通過。
- 靜態合併：合併前後每個三角形的世界座標、繞向、所屬構件、圖層、剖視物件與細節等級逐一相同；e2e 的繪製次數與三角形不超過上一節的預算。
- 0.9.1 source／E2E 另須確認 Viewer template 不含 document-level element 或 script、3D DOM 不含 `data-concept-content`，WebGL 與 fallback 都能切換五個短摘要。
- 桌機、手機與 fallback 截圖確認池體、四廁、樓梯、L3／鏡牆、屋頂、控制區與限制文字可讀；桌機／手機另截「泳池剖視」，並驗證離開剖視後模型恢復。
- 選取 `WT-01` 與 `F-L2-Y0-01` 後畫布不得出現黃色外接框；另以 Y0／Y14 兩側截圖直接確認 L2 全寬玻璃的淡藍透明面、高光、上下框與豎梃可辨識。
- desktop／390 × 844 E2E 必須覆蓋七區跳轉（含一樓衛浴）、入口移動、兩梯到達區、L3／屋頂、池畔入水、水面、水下、返回池畔與退出；退出後 Inspect snapshot 完整恢復，且 mobile 無水平溢出。
- 0.9.1 E2E 預設須實際載入 enhanced runtime，另驗證 desktop high、390 × 844 low／adaptive、反覆進出、explicit baseline、necessary enhanced failure→baseline、optional asset degradation 與 WebGL static fallback；全部路徑不得新增 page error。
