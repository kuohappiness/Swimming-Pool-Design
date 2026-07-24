# 3D Walkthrough MVP Implementation Plan

- 日期：2026-07-24
- 類型：implementation-plan
- 狀態：in_progress
- 任務：TASK-053～TASK-058
- 目標版本：0.7.0
- 依據：[核准設計](2026-07-24-3d-walkthrough-mvp-design.md)、[DEC-117／DEC-118](../04_DECISIONS_AND_OPEN_ITEMS.md)

## 1. Goal

在現有 `/3d-viewer/` 內加入可逆的第一人稱 walkthrough：桌機與手機共用固定步進移動、capsule collision、樓梯代理、全區域安全跳轉，以及水面／水下游泳；同時證明 canonical model 未被修改，既有 Inspect Viewer 無功能回歸。

## 2. Architecture

- `main.ts` 只負責 bootstrap 與組裝，不承載完整物理或輸入細節。
- `CameraModeManager` 管理 Inspect／Walkthrough 生命週期。
- `InputAdapter` 只產生 normalized intent。
- `PlayerController` 以固定步進更新 movement strategy。
- `CollisionWorld` 從 readonly Viewer model 建立 semantic proxy，並使用 Three.js capsule／octree 或等價低面數碰撞實作。
- `WaterVolume` 決定陸地／水面／水下 transition。
- `SafeSpawnRegistry` 以 entity anchor 定位，不保存第二套建築座標。
- scene、model、content、layers 與 selection 仍由既有 Viewer 擁有。

## 3. Global constraints

- 不直接讀 legacy study；只讀 `adaptViewerData()` 已驗證的 active Viewer model。
- 不把 walkthrough config 寫入 `model/project-model.json`。
- 不建立第二個 URL、Vite app、`package.json`、lockfile 或部署 workflow。
- 不依賴可見模型所有 triangles 作碰撞；門洞、樓梯、池壁與 rotated L3 必須使用可測試 proxy。
- 不以關閉測試、降低現有斷言或移除 fallback 換取完成。
- 不修改 solar input contract；若 0.7.0 只新增 Viewer capability，solar `inputHash` 應維持 current。
- 每個 TASK 完成後執行 focused test；`TASK-058` 才執行完整 build、E2E、視覺與發布門檻。
- 實作中若發現需要新增真實建築構件，停止該部分並建立 DEC／OPEN；不得由 Viewer 反向決定建築。

---

## TASK-053｜唯讀資料邊界、型別與模組骨架

**狀態目標：** `ready → done`

**執行結果（2026-07-24）：** 已建立穩定 public interface、deep-readonly／deep-freeze adapter、獨立 config 與資料隔離測試。adapter 由 active Viewer data 產生 13 個必要 entity、8 個 walk surfaces、2 座樓梯、池殼／水域、7 個 opening、6 個 safe spawn 與 capability flags；未知的主入口／L2 門洞高度保持 `unresolved`，未複製 scene factory 工作值。4 項 focused tests、44 項全套測試、typecheck、完整 build、docs／reference validation 與 diff check 通過；canonical source 建置前後 SHA-256 同為 `0ADC3DD2EA845C694C7475EF4587BABBBE73C8352FB326200BDC2DA58B1F6AAD`。

**Files**

- Create: `reference/src/3d-viewer/walkthrough/index.ts`
- Create: `reference/src/3d-viewer/walkthrough/types.ts`
- Create: `reference/src/3d-viewer/walkthrough/walkthrough-config.ts`
- Create: `reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts`
- Create: `tests/walkthrough-data.test.mjs`
- Modify: `scripts/viewer-data.mjs` only if an already canonical field is missing
- Modify: `reference/src/3d-viewer/model-adapter.ts` only for exported readonly types／validated access

### Steps

- [x] 先建立資料隔離測試：adapt/build 前後 source SHA-256 相同，輸出物件不與 source 共用可變 nested references。
- [x] 定義 `WalkthroughSource`、`CollisionDescriptor`、`WaterVolumeDescriptor`、`SpawnDescriptor`、`MovementIntent`、`MovementMode` 與 capability types。
- [x] 實作 `adaptWalkthroughSource(model)`：只讀已驗證的 `ViewerModel`，使用 entity IDs、bounds、elevations 與既有 transform metadata。
- [x] 對必要 entity、有限數值、SITE-XY、adapter ID、model hash 與 stair／pool 關係 fail closed。
- [x] 建立 deep-freeze development/test guard，證明 runtime 寫入會失敗或無法編譯。
- [x] 建立 config defaults；人眼、速度、capsule、重力、游泳參數只存在 Viewer module。
- [x] 匯出穩定 public interface；禁止 UI 或 `main.ts` 直接依賴內部 collision 實作。

### Focused validation

```powershell
node --test tests/walkthrough-data.test.mjs
npm run typecheck
git diff --check
```

### Done when

- source hash 不變。
- adapter 能從 0.6.7 active Viewer data 建立完整 descriptors。
- 破壞 version/hash/coordinate/entity/bounds 的 clone 都會失敗。
- `model/project-model.json` 沒有 walkthrough 專用欄位。

---

## TASK-054｜Camera mode 與桌機／手機輸入

**依賴：** `TASK-053`

**Files**

- Create: `reference/src/3d-viewer/walkthrough/camera-mode-manager.ts`
- Create: `reference/src/3d-viewer/walkthrough/fixed-step-loop.ts`
- Create: `reference/src/3d-viewer/walkthrough/input/input-adapter.ts`
- Create: `reference/src/3d-viewer/walkthrough/input/desktop-input.ts`
- Create: `reference/src/3d-viewer/walkthrough/input/touch-input.ts`
- Create: `reference/src/3d-viewer/walkthrough/player-controller.ts`
- Modify: `reference/3d-viewer/index.html`
- Modify: `reference/src/3d-viewer/main.ts`
- Modify: `reference/src/3d-viewer/interactions.ts`
- Modify: `reference/src/3d-viewer/styles.css`
- Add tests under: `tests/walkthrough-controller.test.mjs`

### Steps

- [ ] 以純邏輯測試建立 mode state machine、重入保護與完整 restore snapshot。
- [ ] 把 selection setup 改成可 suspend／resume，不在 walkthrough 累積 listener。
- [ ] 實作 desktop normalized intent、Pointer Lock 與 drag-look fallback。
- [ ] 實作 touch 左移動／右環視 pointer ownership；多指、pointercancel、orientation change 與 blur 必須清空 intent。
- [ ] 實作固定步進 accumulator、最大 frame delta 與 substep cap。
- [ ] 加入「進入漫遊」「退出」「返回安全點」與 touch controls DOM；Inspect 預設不變。
- [ ] 模式切換保存並恢復 camera、FOV、Orbit target、scene、layers、cutaway 與 panel state。
- [ ] 為 reduced motion 關閉 head bob／FOV kick，但保留所有控制。

### Focused validation

```powershell
node --test tests/walkthrough-controller.test.mjs
npm run typecheck
```

### Done when

- desktop 與 touch adapter 對相同 intent 產生同一 controller 行為。
- 連續進出 20 次 listener 數與輸入結果不變。
- Pointer Lock 拒絕、blur、頁面隱藏及手機旋轉不造成黏鍵。
- 退出後既有 Orbit、selection、固定視角與剖視可繼續使用。

---

## TASK-055｜陸地碰撞、樓梯與全區域移動

**依賴：** `TASK-053`、`TASK-054`

**Files**

- Create: `reference/src/3d-viewer/walkthrough/collision/collision-world.ts`
- Create: `reference/src/3d-viewer/walkthrough/collision/collision-proxies.ts`
- Create: `reference/src/3d-viewer/walkthrough/collision/safe-spawn-registry.ts`
- Create: `reference/src/3d-viewer/walkthrough/movement/walk-movement.ts`
- Modify: `reference/src/3d-viewer/scene-factory.ts` only to expose shared transform roots／semantic helpers
- Add: `tests/walkthrough-collision.test.mjs`
- Add diagnostic coverage to: `scripts/viewer-e2e.mjs`

### Steps

- [ ] 先以 geometry tests 鎖定 entrance opening、solid walls、floor elevations、pool opening、stair endpoints、L3 transform 與 safe spawn clearance。
- [ ] 建立 low-poly solid proxies；不可把透明度、render layer 或 material 當碰撞語意。
- [ ] 以 capsule sweep／penetration resolution 實作牆面滑動、grounded、重力與落地。
- [ ] 為 `ST-01`、`ST-02` 建立坡面＋平台 proxy，檢查上／下行及側面阻擋。
- [ ] 烘焙 siteRoot、WORLD-BEARING-ROOT 與 L3 transform，加入 proxy／visible reference 點一致性測試。
- [ ] 建立入口、L1 池畔、L2、L3、露台與屋頂 safe spawns。
- [ ] 實作 out-of-bounds／non-finite／stuck recovery；恢復時清除 velocity。
- [ ] 加入區域跳轉 state，不允許飛行或穿牆作為一般移動。

### Focused validation

```powershell
node --test tests/walkthrough-collision.test.mjs
npm run typecheck
```

### Done when

- EN-01 可由外向內通過，非門洞牆面不可穿。
- ST-01／ST-02 可雙向完成且不在踏階邊緣卡住。
- rotated L3、正交到達翼、露台與屋頂 spawn 均有效。
- 不同 render delta 的固定步進路徑結果保持容許誤差內一致。
- 任何掉出場景狀態都能在一次 recovery 內回到安全點。

---

## TASK-056｜泳池、水面與水下探索

**依賴：** `TASK-055`

**Files**

- Create: `reference/src/3d-viewer/walkthrough/environment/water-volume.ts`
- Create: `reference/src/3d-viewer/walkthrough/environment/underwater-effects.ts`
- Create: `reference/src/3d-viewer/walkthrough/movement/swim-movement.ts`
- Modify: `reference/src/3d-viewer/walkthrough/player-controller.ts`
- Modify: `reference/src/3d-viewer/scene-factory.ts` for water presentation hooks only
- Modify: `reference/src/3d-viewer/styles.css`
- Add: `tests/walkthrough-swimming.test.mjs`

### Steps

- [ ] 由 active pool bounds、水面、淺／深端及斜底建立 WaterVolume descriptor 測試。
- [ ] 實作 walking／falling／surface／underwater transition，加入 hysteresis 防止水線抖動。
- [ ] 實作浮力、垂直阻尼、三軸水中移動、上浮／下潛及速度限制。
- [ ] 讓 solid collision world 保持池壁／斜底，但排除水面本身。
- [ ] 實作 assisted climb：只有池緣目標 clearance 足夠時才上岸。
- [ ] 實作「返回池畔」使用最近安全點，不硬編碼 world 座標。
- [ ] 加入水線穿越、水下霧化／色調／聲音 hooks；音訊失敗不得影響移動。
- [ ] 實作 mobile low-quality 水下效果與 reduced-motion 過渡。

### Focused validation

```powershell
node --test tests/walkthrough-swimming.test.mjs
npm run typecheck
```

### Done when

- X3 為 1.20 m、X28 為 1.50 m 的池底碰撞方向正確。
- 玩家能入水、浮於水面、下潛、上浮、碰到底／壁、上岸及返回池畔。
- 水線附近不在 walk/swim 間逐幀抖動。
- 手機低品質模式不移除水下可辨識性或核心游泳能力。

---

## TASK-057｜整合 UI、效能階級、可用性與擴充介面

**依賴：** `TASK-054`～`TASK-056`

**Files**

- Modify: `reference/3d-viewer/index.html`
- Modify: `reference/src/3d-viewer/main.ts`
- Modify: `reference/src/3d-viewer/styles.css`
- Modify: `reference/src/3d-viewer/walkthrough/index.ts`
- Add: `reference/src/3d-viewer/walkthrough/performance-profile.ts`
- Add or modify: `tests/walkthrough-controller.test.mjs`
- Modify: `scripts/viewer-e2e.mjs`

### Steps

- [ ] 完成 desktop／mobile HUD、操作說明、目前區域、區域選擇器、返回與退出控制。
- [ ] 以 44 CSS px、安全區 inset、直向／橫向 layout 驗收 touch targets。
- [ ] 實作 capability profile：pixel ratio、shadow、underwater effect、camera motion；核心 collision 不因畫質變更。
- [ ] 記錄平均與 p95 frame time，以 hysteresis 單向降級本次 session。
- [ ] 暫停／恢復頁面 panel、selection、scene navigation 與 layer controls，不刪除既有功能。
- [ ] 確認 fallback 不建立 walkthrough，錯誤只 disable 漫遊而不破壞 Inspect。
- [ ] 保留 `InputAdapter`、`MovementStrategy`、`VisualAssetAdapter`、`AreaRegistry` 與 `EnvironmentEffect` 的窄介面，移除任何對未來 SketchUp／GLB 格式的硬編碼。
- [ ] 補齊 aria label、keyboard path、reduced motion 與 focus restore。

### Focused validation

```powershell
npm run typecheck
node --test tests/walkthrough-controller.test.mjs
```

### Done when

- 390 × 844 與桌機 UI 無水平溢出、控制互不遮擋。
- 低效能降級不改變玩家位置、碰撞或 movement state。
- Inspect／Walkthrough 切換後焦點與操作提示正確。
- WebGL fallback、pointer-lock rejection、audio rejection、localStorage rejection 都能降級運作。

---

## TASK-058｜回歸、契約、版本與 0.7.0 發布

**依賴：** `TASK-053`～`TASK-057`

**Files**

- Modify: `scripts/viewer-e2e.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `model/project-model.json` only for normal release version metadata
- Modify: `docs/contracts/3d-viewer.md`
- Modify: `docs/05_MODEL_CONTRACT.md` only if a derived artifact contract was actually added
- Modify: `docs/07_ACTIVE_WORK.md`
- Create: `docs/releases/0.7.0.md`
- Move completed specs to: `docs/archive/specs/`

### Steps

- [ ] 建立 deterministic E2E hooks，不以不穩定滑鼠像素路徑作唯一斷言。
- [ ] desktop E2E 完成入口、L1、ST-01、L2、ST-02、L3、屋頂跳轉、入水、水下及返回。
- [ ] mobile E2E 在 390 × 844 完成移動、環視、游泳、上浮／下潛、退出與無溢出檢查。
- [ ] 驗證反覆 mode lifecycle、fallback、reduced motion、pointer-lock rejection 與 quality downgrade。
- [ ] 執行 source immutability guard，確認 `model/project-model.json` 除 release metadata 外無 walkthrough 欄位或幾何變化。
- [ ] 更新 3D Viewer contract 為已發布行為，保留概念／專業驗證界線。
- [ ] 同步 package／modelVersion／active revision／generated Viewer data 至 0.7.0；solar inputs 未變時沿用 current registry，不跑最佳化。
- [ ] 產生 release 記錄；TASK 完成後將 design 與 plan 狀態改為 completed 並一起移入 archive。

### Final validation

```powershell
npm run check:docs
npm run validate:reference
npm test
npm run typecheck
npm run build
npm run test:e2e
git diff --check
git diff -- model/project-model.json
```

### Visual acceptance

- [ ] Desktop：入口、兩座樓梯、L3、屋頂、池畔、水面、水下各至少一張證據截圖。
- [ ] Mobile 390 × 844：陸地控制、水中控制、退出後 Inspect 各至少一張。
- [ ] 人工走查所有 safe spawn 與主要牆角，不存在已知穿牆／永久卡死。
- [ ] 退出漫遊後五場景、圖層、構件選取、固定視角與泳池剖視完整恢復。

### Done when

- focused、完整 build、desktop／mobile E2E、fallback、視覺與 source-isolation 全數通過。
- 3D Viewer contract、release、TASK 與 archive spec lifecycle 一致。
- 只有在使用者另行要求時才 commit、push 或部署；本計畫本身不授權外部發布。
