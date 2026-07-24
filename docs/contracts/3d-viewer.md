# 3D Viewer 契約

- 類型：output-contract
- 狀態：active／v0.8.0
- Owner：[05｜模型契約](../05_MODEL_CONTRACT.md)
- 入口：`/3d-viewer/`

## 資料來源與同步

Viewer 只接受：

- `reference/generated/viewer-model.json`：由 active `GEO-0.8.0` 產生。
- `reference/generated/concept-content.json`：由公開理念 Markdown 與 `{{active:...}}` token 產生。

兩者必須有相同 `modelVersion=0.8.0` 與 `modelHash`。viewer model 另須包含 `activeGeometryRevisionId=GEO-0.8.0`、`coordinateSystemId=SITE-XY` 及每個 bounded entity 的 canonical `entityBounds`。0.8.0 只在 0.7.0 Walkthrough 上啟用 enhanced visual layer；active 建築幾何與 V067 圖面基線不變。L2 `splitAxisY` 必須存在、為有限數值、等於男女更衣淋浴區共用邊界 Y8，且不得與 Y0 玻璃或 Y2.5 樓梯分隔牆重疊；任何一項不符都必須直接失敗，不得回退為 Y0。hash、token、scene ID 或有限幾何不符時同樣直接失敗，不顯示 fallback 幾何。

`model/analysis-registry.json` 的 solar `inputHash` 只涵蓋校址／方位、池體、L3 旋轉與支點、鏡牆角度／高度、固定屋頂接收面、能量假設及氣象來源。這些分析輸入不符時才顯示 `stale`；立面材質、非接收面屋頂、天花或隔牆等非日照輸入改版，不要求重算。只有分析輸入改變並完成 solar 重算與既有回歸測試後才可更新為 `current`。

## 幾何與 transform

- SITE X／Y／Z 只在右手座標 `SITE-XYZ-TO-THREE-RH` adapter 對應 Three.js X／−Z／Y；SITE +Y 不得直接映到 Three +Z，避免 Y0／Y14 鏡射。
- 307° 世界方位只套在 `WORLD-BEARING-ROOT` 一次。
- L1／L2／屋頂固定；L3 主矩形在獨立 group 以 X35／Y6.75 水平旋轉 +25.5°，新增正交三角擴板與到達翼保持 SITE-XY 不旋轉。
- L3 面池承載牆與 `F-MIR-01` 共面，共同向池側外傾 +23.0°；顯示偏移只可小到避免 z-fighting。
- L1 表達 25 × 8.5 m 池體、1.2→1.5 m 斜底、四間獨立廁所、儲物、水處理、藥劑分間與右側緩坡。
- L1 西端外牆退至 X0.5，`EN-01` 位於 X1～X3；L1 Y0 的 X0.5～X31 為安全玻璃，只有 X31～X39 服務本體是自然灰清水模。X0～X0.5 顯示傾斜玻璃突出屋簷／雨水回收，X31～X39／Y13.5～Y14.5 顯示後側透明玻璃屋簷。四間廁所立面仍依 active `toiletEntrances` 切出 1.00 m 無門板洞口。
- 廁所內裝須可辨識洗手台與具有門板的 WC 隔間；四個入口不設遮擋版，可直接面向洗手台。男廁洗手台貼 Y0、女廁洗手台貼 Y7.5，所有 WC 隔間貼 Y3.5；泳池男廁其中一座小便斗位於 X31 且避開入口。操場男廁須顯示 1 WC＋2 小便斗＋2 洗手槽，操場女廁須顯示 2 WC＋2 洗手槽。
- L2／L3 基準板為 12 × 13.5 m；L2 +3.30 m、L3 +6.88 m。
- L2 顯示 Review A 的 L 形面池走道、X29 觀景窗、X32 男女 1.00 m 無門片入口、無座懸空站立桌／飲水機／盆栽，以及男女各 15 間含隔間 1.20 × 1.20 m 淋浴模組、1 WC 與 2 洗手槽。Y0 外牆須為 X29～X41 全寬安全玻璃，並與其他安全玻璃外牆共用同一材質、高光、邊框與豎梃系統；從 Y0／Y14 都須清楚讀成「前方玻璃＋後方牆面」，不得只靠資料標籤判定。Y2.5 清水模牆是後方獨立平面，須由 X32 連續封至 X41、不得留樓梯間通往更衣室的開口。L2 天花板須完整覆蓋 X29～X41／Y0～Y13.5。
- `ST-02` 由 X32.5 起步、固定在 Y0.5～Y2.0、朝 +X 上升至有頂的 3F 正交到達翼；須以薄踏步、封閉踢面、兩道連續鋼箱梯梁、懸空平台與開放梯下表達。梯下顯示 3 組可移除低矮植栽，不得以斜向樓梯、封閉梯下或戶外景觀區作唯一通路。
- L3 顯示固定正交三角擴板、約 2.964 m² 有頂到達翼及淨約 3.971 m² 受控景觀區；景觀區以鎖門／告示限制教師與維修人員使用，不開放學生、訪客、公眾聚集或作主要逃生。
- L3 須有隨主量體旋轉 +25.5° 的完整不透明屋頂，連續覆蓋至鏡牆上緣，鏡面牆兩端與相鄰直立牆間的三角缺口須封滿。屋頂在四周保留 0.25 m 概念退縮後以約 169.364 m²／92.74% 高密度太陽能板排布，資訊面板明示模組、容量與發電量 deferred；一般 L3 室內不得顯示電池，儲能策略須說明地面層獨立戶外機櫃優先。
- `ST-01` 為 X20.5～X29／Y0.5～Y2.0（Y0 側）、1.50 m 淨寬、20 級高／18 踏面、2.70＋3.10＋2.70 m，從 +0.30 m 直接接 L2；Viewer 只讀 active canonical bounds，不保留 `originY` fallback，且必須用薄踏步、封閉踢面、兩道連續鋼箱梯梁與開放梯下表達懸空設計，不得以逐階落地實心箱體代替。
- L1～L3 不透明服務量體使用自然灰清水模材質；玻璃屋頂與 L3 鏡牆維持獨立材質。
- 固定屋頂為 29 m／5°／+4.00→+6.537 m。
- 結構支承整合於 X32.5／X35.5 隔間／設備／立面帶，不使用孤立突兀核心柱；玻璃不承重。
- 高位設備只在固定支承帶，不隨旋轉 L3 懸挑。

23° 外傾、轉換結構、設備容量、避難與所有材料僅為概念工作值；Viewer 必須顯示專業驗證限制。

## 場景與操作

`scene-manifest.json` 固定提供 `overview`、`light`、`rain`、`people`、`time`。場景只改相機、visibility、environment 與理念內容，不另建第二套幾何。

### Enhanced rendering

- 0.8.0 預設使用本地 PBR material registry、PMREM environment、ACES tone mapping、stable PCF shadow、可降級水面與純視覺人物／植栽／設備；`?rendering=baseline` 是明確診斷 fallback，不形成第二套資料來源。
- necessary material／shader runtime 建立失敗時須自動回復 baseline rendering 並公開 diagnostic；optional water／environment／visual asset 失敗只停用對應視覺，不阻斷 Inspect、Walkthrough、選取或碰撞。
- high／medium／low 只可改 pixel ratio、shadow、texture anisotropy、environment、surface detail、水面與 postprocess 成本。quality 不得改 camera、scene ID、layer visibility、selection、canonical bounds、collision、player position 或 movement mode。
- hardware desktop／mobile 的 runtime 目標為平均 50／30 FPS；software renderer 從 low 啟動。headless SwiftShader 只用同機 v0.6.7 baseline 的 80% 作相對防退化門檻，不得冒充硬體 FPS。
- renderer 必須公開平均／p95 frame time、draw calls、triangles、shader programs／compile、drawing buffer 與 context restore diagnostic；context restore 不得重建 canonical 或 collision state。
- 所有 runtime asset 必須是 repository-local 且具有 manifest provenance、license、SHA-256、byte size、quality tier 與 required／optional 分類；正式頁面不得存取外部 asset origin。

圖層固定為 `site`、`l1`、`water`、`l2`、`l3`、`roof`、`circulation`、`rain`、`energy`、`annotations`。桌機與觸控支援 orbit、pan、zoom、一般固定視角、圖層切換與構件選取；canvas 與等價控制須可鍵盤操作。選取只更新下拉選單與右側資訊面板，3D 畫布不得顯示 `BoxHelper` 或其他外接選取框。390 × 844 不得水平溢出。

另須提供「泳池剖視」固定視角：相機由 SITE Y0 長邊觀看，隱藏鏡頭側地坪、池畔、L1 Y0 立面與近側池壁／壓頂，保留遠側池壁、透明水體、X3 淺端 1.20 m、X28 深端 1.50 m 及高差 0.30 m 斜底。剖視模式把最大極角放寬至約 120°，可稍微向下／越過水平旋轉；切換其他固定視角、場景或重設時，所有遮擋物與一般約 88.2°相機限制必須完整恢復。

Viewer 上須有固定螢幕方位提示，以清楚的 `N ↘` 箭頭表示真北指向畫面右下角；桌面與 390 × 844 行動視窗均須可見。提示不旋轉模型、相機或世界方位。

### 第一人稱漫遊

- Inspect 是預設且可完整使用；「第一人稱漫遊」從 `EN-01` semantic safe spawn 進入，退出必須恢復原相機、場景、圖層、選取、固定視角／泳池剖視、panel scroll 與焦點。
- simulation 只接受由 active Viewer model 經 read-only adapter 衍生的 `WalkthroughSource`；不得回寫 `project-model.json`，不得另建第二份建築 bounds。`siteRoot.matrixWorld` 是 visual／collision 共用 transform。
- player 使用固定 1/120 秒步進、1.65 m 人眼與 0.28 m capsule；桌機與 touch input 只產生共同 `MovementIntent`。frame-time 或 quality 改變不得修改 movement／collision state。
- solid world 包含建築邊界、池壁、池底與 ST-01／ST-02 連續坡面；`EN-01` 保持可通行。六個 area jump 只可使用 `entrance`、`l1-pool-deck`、`l2-arrival`、`l3-arrival`、`l3-terrace`、`roof-inspection` 的 clear＋supported semantic spawn，不得硬編碼 world 座標。
- `POOL-01` 可見水面、WaterVolume、X3 1.20 m→X28 1.50 m 斜底與碰撞共用同一 surface elevation。walking／falling／surface／underwater transition 須有 hysteresis；支援浮力、下潛、上浮、池壁／池底、clearance 上岸與「返回池畔」。
- 桌機使用 WASD／方向鍵、滑鼠拖曳或 pointer lock、Shift、Space、C／Ctrl 與 Esc；pointer lock 拒絕時保留 drag-look。390 × 844 使用雙觸控面、44 CSS px 上浮／下潛、區域、返回與退出控制，並遵守 safe-area inset、ARIA、鍵盤路徑與 reduced motion。
- capability profile 只可單向 high→medium→low；至少兩個持續超標觀測窗才降級 pixel ratio、shadow、水下效果與 camera motion，本 session 不反覆升級。平均與 p95 frame time 應保留為 diagnostic。
- `InputAdapter`、`MovementStrategy`、`VisualAssetAdapter`、`AreaRegistry` 與 `EnvironmentEffect` 保持窄介面；不得對 SketchUp／GLB 或未採用的未來格式硬編碼。

WebGL 不可用或 `?forceFallback=1` 時不建立 3D／漫遊 runtime；enhanced necessary asset 失敗時建立 baseline 3D runtime；walkthrough adapter 驗證失敗時只停用漫遊。三種情況都須保留可用的 Inspect 或靜態總覽、五場景內容與 V067 圖集連結。

## 驗收

- `npm run build:content`：hash、token、scene ID、active revision 與有限幾何通過。
- `npm test`：SITE-XY bounds、右手座標 adapter、ST-01／ST-02 active bounds、30 間淋浴、到達翼／受控景觀區、右下真北提示、current／stale hash、五場景、transform 分層、source isolation、camera lifecycle、input、collision、safe spawn、游泳、水下與效能 hysteresis 通過。
- `npm run typecheck`、`npm run build`、`npm run test:e2e` 通過。
- 桌機、手機與 fallback 截圖確認池體、四廁、樓梯、L3／鏡牆、屋頂、控制區與限制文字可讀；桌機／手機另截「泳池剖視」，並驗證離開剖視後模型恢復。
- 選取 `WT-01` 與 `F-L2-Y0-01` 後畫布不得出現黃色外接框；另以 Y0／Y14 兩側截圖直接確認 L2 全寬玻璃的淡藍透明面、高光、上下框與豎梃可辨識。
- desktop／390 × 844 E2E 必須覆蓋六區跳轉、入口移動、兩梯到達區、L3／屋頂、池畔入水、水面、水下、返回池畔與退出；退出後 Inspect snapshot 完整恢復，且 mobile 無水平溢出。
- 0.8.0 E2E 預設須實際載入 enhanced runtime，另驗證 explicit baseline、necessary enhanced failure→baseline、optional asset degradation 與 WebGL static fallback；全部路徑不得新增 page error。
