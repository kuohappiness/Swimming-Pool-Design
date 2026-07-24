# 3D Viewer Visual Fidelity Implementation Plan

- 日期：2026-07-24
- 類型：implementation-plan
- 狀態：completed
- 完成日期：2026-07-24
- 任務：TASK-059～TASK-065
- 目標版本：0.8.0
- 依據：[核准設計](2026-07-24-3d-visual-fidelity-design.md)、[DEC-119／DEC-120](../../04_DECISIONS_AND_OPEN_ITEMS.md)

## 1. Goal

在不改 canonical geometry、0.7.0 collision 或既有 Viewer 操作的前提下，建立可替換、可降級且可驗證的擬真渲染層；0.7.0 與 0.8.0 可在隔離工作區平行實作，但正式發布維持 0.7.0→0.8.0。

## 2. Global constraints

- 只讀 `adaptViewerData()` 已驗證的 Viewer model；不直接讀 legacy revision。
- 不以目標版本字串判斷 runtime 相容性；使用 schema／revision／coordinate／hash。
- 不把 texture、exposure、quality、asset URL 或 postprocess 設定寫入 `model/project-model.json`。
- enhanced visual mesh 不得加入 walkthrough collision world。
- 不從 CDN 或未登錄來源於 runtime 下載材質、HDRI 或 GLTF。
- 共用整合檔案只在 TASK-059 與 TASK-065 修改；中間 0.8 tasks 只實作已核准的 enhanced interfaces。
- 每個 task 完成後執行 focused validation；TASK-065 才同步正式版本與執行完整發布門檻。

---

## TASK-059｜共用渲染接縫與平行 validator

**狀態目標：** `ready → done`

**Files**

- Create: `reference/src/3d-viewer/rendering/contracts.ts`
- Create: `reference/src/3d-viewer/rendering/quality-profile.ts`
- Create: `reference/src/3d-viewer/rendering/baseline-material-registry.ts`
- Create: `reference/src/3d-viewer/rendering/baseline-environment.ts`
- Create: `reference/src/3d-viewer/rendering/baseline-frame-pipeline.ts`
- Create: `reference/src/3d-viewer/rendering/baseline-visual-assets.ts`
- Create: `reference/src/3d-viewer/rendering/index.ts`
- Modify: `reference/src/3d-viewer/scene-factory.ts`
- Modify: `reference/src/3d-viewer/main.ts`
- Modify: `scripts/check-docs.mjs`
- Add: `tests/viewer-rendering-contract.test.mjs`
- Modify: `tests/viewer-data.test.mjs` only to replace brittle source-text assertions with semantic contract assertions

### Steps

- [x] 先鎖定 baseline scene graph、材質名稱、五場景、環境值、selection、cutaway 與 deterministic camera 證據。
- [x] 定義 `MaterialRegistry`、`EnvironmentEffect`、`FrameEffectPipeline`、`VisualAssetAdapter` 與 `RenderQualityProfile` 窄介面。
- [x] 把目前材質／環境／直接 render loop 搬到 baseline implementation，數值與畫面保持不變。
- [x] `scene-factory.ts` 只依賴 material／asset contracts；`main.ts` 只組裝 environment／frame pipeline／quality。
- [x] 所有介面提供 idempotent setup、resize、quality change 與 dispose；不持有或修改 Viewer model。
- [x] docs validator 在 active DEC／spec 已核准時，允許不同目標版本各一項 `in_progress`；同版本重複、缺少隔離條件或共享 integration 任務衝突仍失敗。
- [x] 以破壞性 fixture 驗證兩個同版本 `in_progress`、未知 target 與缺少平行核准均被拒絕。

### Focused validation

```powershell
node --test tests/viewer-rendering-contract.test.mjs tests/viewer-data.test.mjs
npm run check:docs
npm run typecheck
npm run build
git diff --check
```

### Done when

- baseline before／after 畫面與操作無可觀察回歸。
- TASK-054 與 TASK-060 可在獨立工作區只透過 contracts 開發。
- validator 能允許合法的 0.7／0.8 平行狀態，並拒絕同版本或未核准平行。

---

## TASK-060｜視覺基準、資產 manifest 與預算

**依賴：** `TASK-059`

**Files**

- Create: `reference/src/3d-viewer/rendering/enhanced/asset-manifest.ts`
- Create: `reference/src/3d-viewer/rendering/enhanced/quality-profiles.ts`
- Create: `reference/src/3d-viewer/assets/README.md`
- Add: licensed texture／HDRI test assets under `reference/src/3d-viewer/assets/`
- Add: `tests/viewer-visual-assets.test.mjs`
- Modify: `scripts/viewer-e2e.mjs` only through an isolated visual-evidence helper if integration ownership allows

### Steps

- [x] 保存 desktop／390 × 844 deterministic baseline screenshots 與 frame-time／下載量紀錄。
- [x] 定義 high／medium／low 的 texture、shadow、AO、水面、pixel ratio 與資產預算。
- [x] 建立 manifest 欄位：ID、用途、local path、source、author、license、SHA-256、byte size、quality tiers。
- [x] 驗證所有正式資產可重新追溯且不需要 runtime 外部網路。
- [x] 建立 loading priority；首屏材質不可被 optional 人物／植栽阻塞。

### Done when

- 所有 asset manifest 欄位與檔案 hash 通過。
- 基準畫面與效能報告足以比較後續 TASK。
- TASK-061／TASK-062 可只新增 enhanced implementations，不修改 baseline。

---

## TASK-061｜PBR 材質與 visual-only 建築細節

**依賴：** `TASK-060`

**Files**

- Create: `reference/src/3d-viewer/rendering/enhanced/pbr-material-registry.ts`
- Create: `reference/src/3d-viewer/rendering/enhanced/texture-loader.ts`
- Create: `reference/src/3d-viewer/rendering/enhanced/surface-details.ts`
- Add: material assets under `reference/src/3d-viewer/assets/materials/`
- Add: `tests/viewer-materials.test.mjs`

### Steps

- [x] 先以 semantic IDs 測試必要材質、PBR 通道、color space、repeat scale 與 tier fallback。
- [x] 實作清水模、玻璃、鋼、池磚／池畔、鏡面與光電材質。
- [x] 共用 texture／material instances，避免每個 mesh 重複載入與編譯。
- [x] 建立不改 bounds 的微倒角、分割縫、框料、壓頂與邊緣細節 adapter。
- [x] 明確排除未核准門、欄杆、結構、設備與會改 collision／通行的細節。

### Done when

- 必要表面在 deterministic scenes 中可直接辨識。
- UV 無明顯拉伸或尺度跳變；透明排序、z-fighting 與 shader error 為零。
- walkthrough data／collision tests 不因 visual details 改變。

---

## TASK-062｜環境光、色調映射、陰影與後製

**依賴：** `TASK-060`

**Files**

- Create: `reference/src/3d-viewer/rendering/enhanced/environment-effect.ts`
- Create: `reference/src/3d-viewer/rendering/enhanced/frame-effect-pipeline.ts`
- Create: `reference/src/3d-viewer/rendering/enhanced/tone-mapping.ts`
- Add: licensed environment assets under `reference/src/3d-viewer/assets/environments/`
- Add: `tests/viewer-environment.test.mjs`

### Steps

- [x] 實作本地 HDR／程序天空、PMREM、ACES、曝光與場景環境 profiles。
- [x] 調整 directional／hemisphere lighting 與 shadow bias，消除 acne、peter-panning 及不穩定閃動。
- [x] high profile 加入適量 AO／接觸陰影；medium／low 可安全停用。
- [x] 所有 render targets 可 resize、dispose、context restore。
- [x] 雨天／柔光／冬季光仍由既有 scene manifest 選擇，不建立第二套 scene IDs。

### Done when

- 五場景曝光一致、玻璃／金屬／水面有可信環境反射且不過曝。
- quality 切換不改 camera、layers、selection 或 movement state。
- baseline fallback 在 enhanced pipeline 建立失敗時仍可使用。

---

## TASK-063｜水面、基地環境與視覺資產

**依賴：** `TASK-056`、`TASK-061`、`TASK-062`

**Files**

- Create: `reference/src/3d-viewer/rendering/enhanced/water-presentation.ts`
- Create: `reference/src/3d-viewer/rendering/enhanced/visual-asset-adapter.ts`
- Add: licensed visual assets under `reference/src/3d-viewer/assets/models/`
- Add: `tests/viewer-visual-adapter.test.mjs`

### Steps

- [x] 由 0.7 WaterVolume／movement mode 讀取視覺狀態，不建立第二套水域 bounds。
- [x] 實作可降級水面 normal、反射／透射、水線與水下色調。
- [x] 以 entity anchor 放置輕量植栽、人物尺度與設備資產；不得把 GLTF transform 當設計資料。
- [x] optional asset 失敗時移除該 visual group、釋放資源並保留 baseline Viewer。
- [x] 驗證 Inspect／Walkthrough／泳池剖視切換不殘留水下或 asset state。

### Done when

- 水面、水下、斜底與池壁方向一致，沒有雙重 water state。
- visual assets 不進 collision world，且 dispose 後無 listener／GPU resource 累積。
- mobile low 保持水域可辨識但可停用昂貴反射。

---

## TASK-064｜效能、視覺回歸與相容性

**依賴：** `TASK-057`、`TASK-061`、`TASK-062`、`TASK-063`

**Files**

- Modify: enhanced quality／asset modules
- Modify: `scripts/viewer-e2e.mjs` through integration ownership
- Add: `tests/viewer-quality-profile.test.mjs`
- Add: deterministic visual/performance evidence output ignored from Git where appropriate

### Steps

- [x] 測量 high／medium／low 的 transferred bytes、平均 FPS、p95 frame time、draw calls、triangles 與 shader compile。
- [x] 實作單向 frame-time hysteresis 降級；本 session 不反覆升降。
- [x] 驗證 desktop、390 × 844 mobile、reduced motion、fallback、context restore 及 asset failure。
- [x] 比較五場景、兩側立面、俯視、剖視、人眼高度與水下 before／after。
- [x] 修正所有 UV、透明排序、陰影、閃爍、z-fighting、過曝及 mobile controls 遮擋。

### Done when

- 具硬體加速的 desktop／mobile 以 50／30 FPS 為裝置端目標；SwiftShader CI 不冒充硬體結果，改以同機 0.6.7 baseline 的 80% 為防退化門檻並記錄 p95。
- high／medium／low 符合資產預算或以證據修訂 spec 後再驗收。
- 0.7 walkthrough、Inspect、selection、layers、cutaway、fallback 與 orientation 無回歸。

**執行結果（2026-07-24）：** `capture:viewer-quality` 以 1440 × 900 high／medium／low 與 390 × 844 adaptive 逐頁量測，總 transfer 均為 214,109 bytes，遠低於 24／12／6 MiB。SwiftShader high／medium／low 分別為 1.68／1.76／14.89 FPS，p95 610.5／587.5／73.2 ms；mobile adaptive 維持 high，為 4.04 FPS、p95 260.9 ms，均高於同機 0.6.7 baseline 的 80%。low 將 draw calls 1,678→638、triangles 59,416→27,118、shader programs 38→22；真實 `WEBGL_lose_context` restore 保留 scene／cutaway／selection／layers，dependency-injected optional environment failure 維持 enhanced runtime。14 張 after 與既有 14 張 before hash 均寫入 ignored evidence report；人工抽查五場景、兩側、俯視、剖視、L1／L2／L3、人眼、水下與 mobile，未見新增 UV 拉伸、透明排序、陰影閃爍、z-fighting、過曝或 controls 遮擋。自我優化依 1.35 FPS 證據取消正式 high 的全畫面 SSAO，保留 PBR／PMREM／ACES／PCF shadow 與可選半解析度 AO pipeline。

---

## TASK-065｜0.7 基線整合與 0.8.0 發布

**依賴：** `TASK-058`、`TASK-060`～`TASK-064`

**Files**

- Modify: shared integration files only after merging released 0.7.0
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `model/project-model.json` only for normal release metadata
- Modify: `docs/contracts/3d-viewer.md`
- Modify: `docs/07_ACTIVE_WORK.md`
- Create: `docs/releases/0.8.0.md`
- Move completed visual specs to: `docs/archive/specs/`

### Steps

- [x] 將 0.8 branch 合併／rebase 到已發布 0.7.0 基線，解決 integration-owned files。
- [x] 啟用 enhanced implementation，保留 baseline fallback。
- [x] 執行 Inspect／Walkthrough／泳池／水下／五場景／圖層／選取／fallback 完整回歸。
- [x] 確認 canonical geometry、collision descriptors 與 solar inputHash 未被純視覺變更修改。
- [x] 只有此 task 同步 package／modelVersion／generated data 至 0.8.0。
- [x] 更新 Viewer contract、release 證據與 spec lifecycle。

### Final validation

```powershell
npm run check:docs
npm run validate:reference
npm test
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```

### Done when

- 0.7.0 全部行為在 enhanced rendering 下通過。
- desktop／mobile 視覺、效能、fallback、asset provenance 與 source isolation 全數通過。
- 只有在使用者另行要求時才 commit、push 或部署。

**執行結果（2026-07-24）：** 0.8.0 正式預設啟用 enhanced runtime，software renderer 由 low、窄螢幕硬體由 medium、desktop hardware 由 high 啟動；`?rendering=baseline`、necessary material failure→baseline 及 WebGL static fallback 均保留。package／model／active `GEO-0.8.0`／generated data 已同步，model diff 只含 release metadata，solar inputHash 維持 `3f9ae69b4dcde4e2dc88894f6e441b878a8b242a938f4f568419275282ddb999`。82 項完整測試與 production build 通過；53 秒 E2E 在 enhanced 預設下覆蓋 desktop／390 × 844 的 Inspect、六區、物理入水、水下、touch、snapshot restore、explicit baseline、required fallback、static fallback、solar-study 與 V067 atlas。自我檢查修正 underwater movement／overlay 在放開控制後的高速 race，改為按住時同步驗證並截圖。Viewer contract、Release 0.8.0 與 spec lifecycle 已更新；依使用者明確要求，所有 0.7／0.8 變更在最終驗證後一次 commit 並 push。
