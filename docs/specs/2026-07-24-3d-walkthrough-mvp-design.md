# 3D Walkthrough MVP 子專案架構

- 日期：2026-07-24
- 類型：design
- 狀態：approved
- 任務：TASK-053～TASK-058
- 目標版本：0.7.0

## 1. 問題、結果與可行性

現有 `/3d-viewer/` 採 Three.js `OrbitControls`，適合從外部檢視模型，但不能以人的尺度進入建築、上下樓梯或探索泳池。0.7.0 要在不破壞既有 Viewer、不複製 canonical model 的前提下，加入桌機與手機皆可使用的第一人稱漫遊。

本變更判定為 **conceptually feasible**。現有 active model 已提供池體、樓層、牆面、入口與兩座樓梯的必要概念幾何；碰撞與游泳屬 Viewer 模擬能力，不代表建築、結構、消防、無障礙、水處理或施工核定。

成功結果：

- 同一 `/3d-viewer/` 可在「模型檢視」與「第一人稱漫遊」間可逆切換。
- 桌機與 390 × 844 手機都能由 `EN-01` 外開始，行走、上下樓、抵達所有已建模區域。
- 玩家能進入泳池，在水面游泳、下潛、上浮、觀察斜底並安全返回池畔。
- walkthrough 全程只讀 active Viewer derived data；建置與執行後 canonical source 位元內容不變。
- 架構可增加手把、VR、GLB 視覺資產、導覽路線或新 movement mode，而不重寫核心狀態機。

## 2. 核准範圍

### 2.1 MVP 功能

- 第一人稱，不顯示完整人物模型。
- 人眼高度、步行、快走、重力、落地、牆面阻擋與安全重生。
- 兩座樓梯以不可見的連續坡面 collision proxy 支援平順上下。
- 開放所有已建模區域，不套用實際門禁；用途限制仍可作資訊提示。
- 無連續實體動線的屋頂或檢查區，以明確的區域選擇器跳轉，不提供飛行或穿牆。
- 泳池為 water volume：自動切換水面／水下狀態，具有浮力、上浮、下潛、池底碰撞、上岸與返回池畔。
- 桌機採鍵盤＋滑鼠，手機採左側移動區＋右側環視區及水中上下控制。
- 保留五組場景、圖層、固定視角、泳池剖視、構件選取、資訊面板與 WebGL fallback。
- 依裝置能力提供畫質階級，維持可用幀率與可辨識 UI。

### 2.2 非目標

- 可見人物、手腳、走路或游泳骨架動畫。
- 體力、氧氣、溺水、競速、多人或遊戲計分。
- 照片級材質、完整家具、氣象物理或 CFD 水體。
- VR／AR、手把、陀螺儀；只保留 adapter 介面。
- 將 SketchUp／GLB 設為新的設計 source of truth。
- 新增或核定建築實體、法定動線、泳池扶梯、欄杆或施工構造。

## 3. 所有權與資料隔離

### 3.1 單向資料流

```text
model/project-model.json
        │ read only
        ▼
resolveActiveGeometry()
        │ validated active revision
        ▼
reference/generated/viewer-model.json
        │ Readonly<ViewerModel>
        ▼
WalkthroughModelAdapter
        ├─ semantic collision descriptors
        ├─ water volume
        ├─ entity-anchored spawn descriptors
        └─ runtime capability flags
                 │
                 ▼
        browser memory only
```

`project-model.json` 不新增人眼高度、速度、浮力、按鍵或 UI 欄位。這些是 Viewer 體驗參數，放在 `walkthrough-config.ts`。只有未來確認新的實體建築構件時，才依既有 owner／DEC／TASK 流程修改 canonical model。

### 3.2 不可變契約

- adapter 輸入型別使用 deep readonly；不得把 `Object3D`、速度或 runtime flag 寫入 model object。
- 所有 derived descriptor 都由新物件建立；開發／測試環境對 adapted model deep-freeze。
- browser 沒有寫回 source 的 API；玩家位置只留在記憶體。偏好設定若持久化，只能使用 namespaced localStorage，且不得包含模型幾何。
- build script 的可寫目標限於 `reference/generated/`；MVP 優先在 runtime 建立碰撞資料，不新增第二份幾何 JSON。
- 若日後因效能必須預先產生 walkthrough artifact，必須帶 `modelVersion`、`activeGeometryRevisionId`、`coordinateSystemId`、`sourceModelHash`，且 mismatch 時 fail closed。
- 測試以建置前後 SHA-256 與 `git diff -- model/` 證明 source 未被修改。

## 4. 模組架構

```text
Viewer Bootstrap
├─ ViewerSceneGraph                 現有視覺模型
├─ CameraModeManager
│  ├─ InspectMode                   OrbitControls
│  └─ WalkthroughMode
│     ├─ InputAdapter
│     │  ├─ DesktopInput
│     │  └─ TouchInput
│     ├─ PlayerController
│     │  ├─ WalkMovement
│     │  └─ SwimMovement
│     ├─ CollisionWorld
│     ├─ WaterVolume
│     ├─ SafeSpawnRegistry
│     └─ UnderwaterEffects
└─ Shared UI / Scene / Layer / Selection
```

### 4.1 `CameraModeManager`

- 唯一擁有相機模式切換權，狀態為 `inspect | entering | walkthrough | exiting`。
- 切入時保存 Inspect camera position、target、FOV、active scene、layer visibility 與 cutaway 狀態。
- 切出時完整恢復保存狀態並重新啟用 OrbitControls。
- 模式轉換為 idempotent；重複點擊、失去 focus、頁面隱藏或 pointer lock 被拒絕不得產生雙重 listener。

### 4.2 `InputAdapter`

輸出統一的 frame intent，不直接移動相機：

```ts
interface MovementIntent {
  moveX: number;
  moveZ: number;
  lookYaw: number;
  lookPitch: number;
  ascend: number;
  descend: number;
  fast: boolean;
  exitRequested: boolean;
}
```

desktop 與 touch 只負責把輸入正規化為 `[-1, 1]`。PlayerController 不知道輸入來自鍵盤、滑鼠、觸控、未來手把或 VR。

### 4.3 `PlayerController`

- 唯一擁有玩家 capsule、position、velocity、yaw、pitch、grounded 與 movement mode。
- 使用固定時間步進，renderer 維持可變 frame rate。單幀延遲過大時限制累積時間與 substep 數，防止穿牆及 spiral of death。
- simulation state 與 camera presentation 分離；視角晃動、FOV 或水下效果不得改變 collision capsule。
- 狀態為 `walking | falling | swimming-surface | swimming-underwater | teleporting | recovering`。

## 5. 座標與碰撞

### 5.1 座標規則

- canonical descriptor 一律保存 `SITE-XY` 與 elevation。
- 只有既有 `SITE-XYZ-TO-THREE-RH` adapter 能轉換為 Three world coordinates。
- collision proxy 先在 `siteRoot` 下建立，再以完整 `matrixWorld` 烘焙到 physics world；不得另寫第二套 307°、Y 反向或 L3 +25.5°公式。
- L3 proxy 必須繼承與視覺 L3 相同的 pivot／rotation；正交到達翼維持未旋轉。

### 5.2 Collision world

- 玩家使用 capsule，不以 camera point 或單一 ray 代替人體。
- 牆、樓板、池壁、池底、必要欄阻與主要固定量體以低面數不可見 proxy 建立。
- 門洞由分段牆 proxy 留空；不得把關閉的視覺門片當成不可通行的永久阻擋。
- `ST-01`、`ST-02` 使用連續坡面＋平台 proxy；視覺踏階仍保留但不逐級碰撞。
- rotated L3、外挑區與屋頂使用實際 transform 後的 proxy，不以 axis-aligned SITE bounds 冒充旋轉後外形。
- 水體不加入 solid octree；由 WaterVolume 負責 mode transition，池壁與斜底仍屬 solid collision。
- 掉出安全高度、出現 NaN／Infinity 或連續碰撞無法解算時，回到最近 safe spawn 並清除速度。

建議初始體驗值屬可逆 Viewer config：

| 參數 | 初始值 |
| --- | --- |
| 眼高 | 1.65 m |
| capsule 半徑 | 0.28 m |
| 一般速度 | 1.4 m/s |
| 快走速度 | 2.8 m/s |
| 重力 | 9.81 m/s² |
| 最大 pitch | ±85° |

## 6. 全區域探索與安全出生點

`SafeSpawnRegistry` 不手寫第二套絕對幾何，而以 `entityId + normalized anchor + elevation role` 定位。必要 anchors：

- `entrance`：`EN-01` 外側，預設開始點。
- `l1-pool-deck`：池畔安全點。
- `l2-arrival`：`ST-01` 上層到達。
- `l3-arrival`：`Z-L3-ARRIVAL-01`。
- `l3-terrace`：`Z-L3-TERRACE-01`。
- `roof-inspection`：屋頂／光電檢查位置。

跳轉流程固定為：停止輸入 → 淡出 → 驗證目標 capsule 不與 solid 重疊 → 搬移並清速度 → 淡入。目標無效時留在原地並顯示可恢復錯誤，不得將玩家放到 `(0,0,0)`。

## 7. 游泳與水下狀態

- `POOL-01` bounds、水面標高、X3／X28 深度與斜底都由 active model 衍生。
- capsule 中心跨入 water volume 時進入 swimming；離水後回到 falling／walking。
- 水面模式施加浮力與垂直阻尼，使相機保持接近水線；向下輸入或視線＋前進可轉入 underwater。
- underwater 支援三軸移動，但速度與加速度低於陸地快走；池壁和斜底仍阻擋。
- 接近可上岸池緣且上方 capsule clearance 足夠時執行 assisted climb；任何時候可使用「返回池畔」。
- 水下效果包含色調、霧距、低通感環境音與水面穿越過渡；`prefers-reduced-motion` 關閉 camera bob／強烈過渡。
- 第一版不計算氧氣、溺水、真實划水週期或流體阻力。

## 8. 輸入與 UI

| 行為 | 桌機 | 手機 |
| --- | --- | --- |
| 進入漫遊 | 按鈕後點擊 canvas | 按鈕直接進入 |
| 環視 | Pointer Lock 滑鼠；拒絕時 drag-look fallback | 右半畫面拖曳 |
| 移動 | WASD／方向鍵 | 左側虛擬搖桿 |
| 快走 | Shift | 搖桿外圈／快走按鈕 |
| 上浮／下潛 | Space／Ctrl 或 C | 右側上下按鈕 |
| 返回安全點 | R | 顯示按鈕 |
| 離開漫遊 | Esc／UI 按鈕 | 固定 UI 按鈕 |

進入 walkthrough 時：

- 暫停 OrbitControls、canvas 構件點選與鍵盤輪選，避免手勢衝突。
- 保留模型資訊但收合左右面板，提供「介面」按鈕暫時展開。
- 固定顯示 mode、操作提示、區域、返回安全點與退出控制。
- pointer lock、audio context 或 fullscreen 被瀏覽器拒絕時，核心行走仍可用。

## 9. 效能、可用性與無障礙

- 共用現有 scene，不建立第二份可見模型；碰撞 proxy 不渲染。
- collision world 在 model load 後建立一次，模式切換不得重建。
- desktop pixel ratio 上限維持 2；mobile quality tier 可降陰影解析、停用 camera bob、降低水下後處理與 pixel ratio。
- 以 frame-time hysteresis 降級，避免畫質在臨界值來回跳動；第一版不自動升級回最高品質。
- 目標：代表性 desktop 平均 50 FPS 以上、390 × 844 mobile 平均 30 FPS 以上；測試報告同時記錄 p95 frame time，不只看平均值。
- canvas、進入／退出、區域選擇、返回池畔都有鍵盤可達與可讀 label。
- reduced motion 模式保留完整移動能力，但關閉 head bob、FOV kick、長淡入淡出。
- 觸控按鈕避開安全區與瀏覽器底部手勢帶，最小 hit target 44 CSS px。

## 10. 擴充界面

- `InputAdapter`：未來手把、陀螺儀、WebXR。
- `MovementStrategy`：未來 crouch、電梯、自由導覽或無障礙路徑模式。
- `VisualAssetAdapter`：程序化 mesh 與未來 GLB 可替換；碰撞仍由 semantic descriptor 產生。
- `AreaRegistry`：未來導覽路線、書籤、分享深連結。
- `EnvironmentEffect`：未來雨天、夜間、聲景或更高品質水面。
- `InteractionProvider`：未來門扇、資訊熱點、設備操作；不得讓互動物件直接修改 canonical model。

## 11. 錯誤與相容行為

- model/version/hash/coordinate adapter 不符：整個 Viewer 維持既有 fail-closed；不建立 walkthrough。
- walkthrough adapter 無法建立：Inspect mode 仍可使用，漫遊按鈕 disabled 並顯示可診斷錯誤。
- WebGL fallback：不顯示漫遊入口，既有靜態場景與內容照常提供。
- pointer lock 不支援或被拒絕：使用 drag-look fallback。
- 音訊被拒絕：靜音運作，不阻止移動。
- localStorage 不可用：使用 session defaults。
- resize、orientation change、visibility change、blur：清除輸入 intent，避免黏鍵或持續移動。

## 12. 驗收與發布

### 12.1 自動驗收

- source immutability：build 前後 `model/project-model.json` SHA-256 相同。
- adapter：缺失 entity、非法 bounds、版本／hash／座標不符均 fail closed。
- fixed-step：不同 render delta 下移動結果在容許誤差內一致。
- collision：入口可通行、牆不可穿、兩梯可上下、L3 rotation proxy 一致、跌落可恢復。
- swimming：入水／出水、surface／underwater、上浮／下潛、池底／池壁、上岸／返回池畔狀態正確。
- mode lifecycle：反覆進出不累積 listener，Inspect camera／scene／layers／cutaway 完整恢復。
- desktop E2E：由入口走至 L1、L2、L3，跳轉屋頂，進入泳池並水下探索後返回。
- mobile E2E：390 × 844 無水平溢出，左右觸控區不互搶，能完成同等核心路徑。
- fallback、reduced motion、pointer-lock rejection 與低品質 tier 回歸。

### 12.2 人工驗收

- 人眼尺度、入口通行、牆面阻擋及兩梯體感合理。
- 手機直向不因手指遮擋而失去主要視野。
- 水線穿越、水下辨識與斜底方向正確。
- 所有區域可到達且沒有明顯卡點、穿模或無法返回狀態。
- 現有五場景、固定視角、泳池剖視、圖層與選取在退出漫遊後無回歸。

### 12.3 發布策略

0.7.0 採相容 MINOR release。功能完成前 `/3d-viewer/` 預設仍進入 Inspect mode；walkthrough 不以實驗 query 或隱藏路徑形成第二套永久入口。完整驗收通過後才更新 package/model/generated data、Viewer contract、release 記錄並部署。

## 13. 已知風險與控制

| 風險 | 控制 |
| --- | --- |
| 可見 mesh 不適合作碰撞 | 建立低面數 semantic proxy，不直接碰撞全部 render mesh |
| SITE／Three／307°／L3 rotation 再次分裂 | 只使用既有 adapter 與完整 matrixWorld，加入 transformed proxy 測試 |
| 手機 touch 與頁面捲動衝突 | walkthrough 時鎖定 viewport gesture，退出後完整恢復 |
| 水下效果拖慢手機 | capability tier、簡化霧化、限制 pixel ratio，不把後處理列為核心依賴 |
| 全區域包含沒有實體路徑的位置 | 使用顯式區域跳轉，不加入飛行或假樓梯 |
| 模擬被誤認為安全／施工驗證 | Viewer 持續顯示概念與專業驗證限制 |
