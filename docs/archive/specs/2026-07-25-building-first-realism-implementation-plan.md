# 0.8.2 建築本體優先擬真實作計畫

- 日期：2026-07-25
- 類型：implementation-plan
- 狀態：completed
- 完成日期：2026-07-25
- 任務：TASK-067～TASK-074
- 目標版本：0.8.2
- 依據：[核准設計](2026-07-25-building-first-realism-design.md)、[DEC-122～DEC-124](../../04_DECISIONS_AND_OPEN_ITEMS.md)

## 1. 全域限制

- 只讀 active `GEO-0.8.2` 與 generated Viewer model，不建立第二套房間或器具資料。
- 新增擬真 detail 一律 visual-only／collision-excluded；不得修改 walkthrough collision、player、water volume 或 scene 語意。
- 桌機 high、手機可降階；任何高階細節須可在 runtime 可逆移除。
- 每一階段先跑 focused validation，再檢查畫面與效能並自動修正可證實的問題。
- 不把概念器具與材料冒充施工、法規或專業定案。

## 2. 執行階段

### TASK-067｜契約與狀態基線

- [x] 將「剛完工但已投入使用」、「建築外觀／室內優先」與「校園第二階段」寫入 active presentation。
- [x] 將 Viewer schema 升為 1.4.0，adapter 對舊 schema fail closed。
- [x] 記錄 DEC-122／DEC-124 與驗收邊界。

自我檢查：確認 occupancy／priority 只是 presentation contract，不改 solar input 或 professional approval。

### TASK-068｜衛浴資料與程序器具

- [x] 為八個隔間加入 `fixtureType`、`fixtureCenter`、`fixtureFacing`。
- [x] 驗證 4 坐／4 蹲、各房順序、中心位於隔間及合法朝向。
- [x] 建立坐式／蹲式 WC、洗手槽、小便斗、隔間門／五金、磁磚、地排與少量使用細節。
- [x] 建立專屬測試，確認器具數量、分級切換與 collision source 不變。

自我檢查：從只驗總數收緊為四間房逐一驗證順序，避免 4／4 正確但位置錯誤。

### TASK-069｜外殼細節

- [x] 加入清水模分割／螺桿孔、玻璃底座／膠條、天溝／落水管與轉接泛水／封膠。
- [x] 以 semantic material registry 管理五金、濕面、磁磚、填縫、照明、標示與焦散材質。
- [x] 所有新增 detail 標記畫質層級並排除碰撞。

### TASK-070｜泳池與水面

- [x] 加入溢流格柵、池底水道線、池畔排水、天花燈／通風、濕痕及 10 組焦散。
- [x] 以同一 frame state 更新 water normal 與焦散；low／medium／reduced motion 停止 high-only 動畫。
- [x] 測試切換畫質後 water state、collision 與座標不變。

### TASK-071｜L2 室內

- [x] 加入 30 組淋浴頭／管線／排水與 high 閥件。
- [x] 加入置物櫃縫／把手、磁磚、照明、通風與少量濕痕。
- [x] 保持既有更衣／淋浴數量、男女分界與入口資料不變。

### TASK-072｜畫質降階

- [x] 建立 `EnhancedDetailLevelAdapter`，將 low／medium／high 對應 essential／reduced／full。
- [x] 驗證所有 quality-controlled nodes 都是 visual-only／collision-excluded。
- [x] high／medium 開啟符合材質條件的細節陰影；low 關閉陰影及高階細節。
- [x] dispose 恢復 essential 並停止 animation。

### TASK-073｜視覺、效能與自動優化

- [x] 執行資料、衛浴、建築細節、畫質、動畫、collision 與型別 focused tests。
- [x] 產出 desktop high 的五場景、固定視角及 L1／L2／L3 人眼快照並人工檢查。
- [x] 分離快速視覺快照與較慢的 SwiftShader high／medium／low／mobile 相對量測；所有預覽由腳本在 `finally` 自行關閉，不使用常駐外部程序。
- [x] 自我檢查先以 explicit caster 補上主要衛浴器具陰影並在 low 關閉，再將衛浴 mesh 由 272 批次化為 160、加入 180 上限回歸測試，並把靜態陰影圖改為場景狀態改變時按需更新。
- [x] SwiftShader high／medium／low 為 0.86／0.86／8.55 FPS，390 × 844 自動 low 為 18.2 FPS；14 張 hash 視覺證據與相對效能門檻全部通過。

### TASK-074｜版本與發布

- [x] 同步 package／lockfile／model／active revision／generated data／README／contracts 至 0.8.2。
- [x] 完成 release 記錄與 completed specs。
- [x] 執行 docs、reference、tests、typecheck、production build、E2E、quality evidence 與 `git diff --check`。
- [x] 依使用者指示一次 stage、commit `release: v0.8.2` 並 push `main`。

## 3. 最終驗證命令

```powershell
npm run build
npm run test:e2e
$env:REUSE_VIEWER_QUALITY_SCREENSHOTS='1'; node scripts/capture-viewer-quality-evidence.mjs
git diff --check
```

視覺檢查與效能量測分開執行；若 SwiftShader 量測需要較長時間，必須持續回報進度，且腳本無論成功或失敗都關閉 browser 與 preview process。
