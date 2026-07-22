# 3D Viewer 契約

- 類型：output-contract
- 狀態：active／v0.6.1
- Owner：[05｜模型契約](../05_MODEL_CONTRACT.md)
- 入口：`/3d-viewer/`

## 資料來源與同步

Viewer 只接受：

- `reference/generated/viewer-model.json`：由 active `GEO-0.6.1` 產生。
- `reference/generated/concept-content.json`：由公開理念 Markdown 與 `{{active:...}}` token 產生。

兩者必須有相同 `modelVersion=0.6.1` 與 `modelHash`。viewer model 另須包含 `activeGeometryRevisionId=GEO-0.6.1`、`coordinateSystemId=SITE-XY` 及每個 bounded entity 的 canonical `entityBounds`。hash、token、scene ID 或有限幾何不符時直接失敗，不顯示 fallback 幾何。

`model/analysis-registry.json` 的 solar hash 不符時顯示 `stale`；只有確認 v0.6.1 未改變日照輸入幾何並完成既有 solar 測試後才可更新為 `current`。

## 幾何與 transform

- SITE X／Y／Z 只在右手座標 `SITE-XYZ-TO-THREE-RH` adapter 對應 Three.js X／−Z／Y；SITE +Y 不得直接映到 Three +Z，避免 Y0／Y14 鏡射。
- 307° 世界方位只套在 `WORLD-BEARING-ROOT` 一次。
- L1／L2／屋頂固定；只有 L3 在獨立 group 以 X35／Y6.75 水平旋轉 +25.5°。
- L3 面池承載牆與 `F-MIR-01` 共面，共同向池側外傾 +23.0°；顯示偏移只可小到避免 z-fighting。
- L1 表達 25 × 8.5 m 池體、1.2→1.5 m 斜底、四間獨立廁所、儲物、水處理、藥劑分間與右側緩坡。
- 泳池大廳 Y0 玻璃牆必須切出 `EN-01` 並可辨識玻璃入口；四間廁所立面必須依 active `toiletEntrances` 切出 1.00 m 無門板洞口，不得以實心牆或門扇遮蔽。
- 廁所內裝須可辨識洗手台、隱私屏風與具有門板的 WC 隔間；男廁洗手台貼 Y0，女廁洗手台貼 Y7.5。
- L2／L3 基準板為 12 × 13.5 m；L2 +3.30 m、L3 +6.88 m。
- `ST-01` 為 X20.5～X29／Y0.5～Y2.0（Y0 側）、1.50 m 淨寬、20 級高／18 踏面、2.70＋3.10＋2.70 m，從 +0.30 m 直接接 L2；Viewer 只讀 active canonical bounds，不保留 `originY` fallback，且必須用薄踏步、封閉踢面、兩道連續鋼箱梯梁與開放梯下表達懸空設計，不得以逐階落地實心箱體代替。
- L1～L3 不透明服務量體使用自然灰清水模材質；玻璃屋頂與 L3 鏡牆維持獨立材質。
- 固定屋頂為 29 m／5°／+4.00→+6.537 m。
- 結構支承整合於 X32.5／X35.5 隔間／設備／立面帶，不使用孤立突兀核心柱；玻璃不承重。
- 高位設備只在固定支承帶，不隨旋轉 L3 懸挑。

23° 外傾、轉換結構、設備容量、避難與所有材料僅為概念工作值；Viewer 必須顯示專業驗證限制。

## 場景與操作

`scene-manifest.json` 固定提供 `overview`、`light`、`rain`、`people`、`time`。場景只改相機、visibility、environment 與理念內容，不另建第二套幾何。

圖層固定為 `site`、`l1`、`water`、`l2`、`l3`、`roof`、`circulation`、`rain`、`annotations`。桌機與觸控支援 orbit、pan、zoom、四個固定視角、圖層切換與構件選取；canvas 與等價控制須可鍵盤操作。390 × 844 不得水平溢出。

WebGL 不可用或 `?forceFallback=1` 時提供靜態總覽、五場景內容與最新 v0.6.1 圖集連結。

## 驗收

- `npm run build:content`：hash、token、scene ID、active revision 與有限幾何通過。
- `npm test`：SITE-XY bounds、右手座標 adapter、ST-01 active Y bounds、current／stale hash、五場景與 transform 分層通過。
- `npm run typecheck`、`npm run build`、`npm run test:e2e` 通過。
- 桌機、手機與 fallback 截圖確認池體、四廁、樓梯、L3／鏡牆、屋頂、控制區與限制文字可讀。
