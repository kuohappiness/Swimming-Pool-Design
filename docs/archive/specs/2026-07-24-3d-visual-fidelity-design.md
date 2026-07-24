# 3D Viewer 視覺擬真升級架構

- 日期：2026-07-24
- 類型：design
- 狀態：completed
- 完成日期：2026-07-24
- 任務：TASK-059～TASK-065
- 目標版本：0.8.0

## 1. 問題、目標與可行性

現行 `/3d-viewer/` 已能可信地表達 active geometry、圖層、固定場景與設計狀態，但大面積表面主要使用單色材質，環境反射、表面微細節、接觸陰影與真實尺度物件不足，因此畫面仍偏向概念模型。

0.8.0 的目標是讓 Inspect 與 Walkthrough 都接近高品質即時建築視覺化，同時維持手機可用性、資料可信度及 0.7.0 的移動／碰撞正確性。

本變更判定為 **conceptually feasible**。Three.js 現有 PBR、PMREM、色調映射、後製及 glTF 能力足以完成；但 Viewer 中的材料外觀仍是概念視覺代理，不代表實際材料樣板、施工構造、耐氯胺、防水、消防或專業核定。

## 2. 核准範圍與非目標

### 2.1 範圍

- 建立 semantic `MaterialRegistry`，統一清水模、安全玻璃、鋼構、池磚、池畔、鏡面、光電與植栽材質。
- 支援 base color、normal、roughness、ambient occlusion、metalness、transmission 等 PBR 通道。
- 建立 HDR／PMREM 或等價本地環境光、ACES 色調映射、曝光、穩定陰影及可降級環境遮蔽。
- 在不改 canonical geometry 與 collision 的前提下加入微倒角、分割縫、框料、壓頂及其他 visual-only 表面細節。
- 改善水面法線、反射／透射、水線與水下色調，使 Inspect 與 Walkthrough 共用同一水域狀態。
- 允許輕量 GLTF／程序化植栽、人物尺度與設備資產；所有資產必須本地封裝並登錄來源、授權、hash 與大小。
- 建立 `high | medium | low` 畫質階級；桌面以 high 為目標，手機依能力與 frame time 自動降級。
- 保留五場景、固定視角、泳池剖視、圖層、選取、資訊面板、真北、fallback 與 reduced motion。

### 2.2 非目標

- 不把 Viewer 變成照片測量、施工 BIM、結構或機電數位分身。
- 不虛構未核准的門、欄杆、結構、消防設備、家具配置或材料品牌。
- 不讓高細節 render mesh 驅動 0.7.0 collision；碰撞仍由 semantic proxy 擁有。
- 不新增第二個 Viewer URL、Vite app、package、canonical model 或部署流程。
- 不依賴執行階段第三方 CDN、遠端 HDRI、遠端材質或未記錄授權的資產。
- 不以重型光線追蹤、CFD 水體或只適用高階桌機的效果作為核心依賴。
- 不因純視覺材質與後製變更重跑 solar；只有既有 solar input contract 改變才重算。

## 3. 版本與平行開發邊界

0.7.0 與 0.8.0 採「平行開發、順序整合發布」：

```text
TASK-053 已驗證的 readonly Viewer data
                    │
              TASK-059 共用渲染接縫
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
0.7 walkthrough         0.8 enhanced rendering
input／collision        materials／environment
movement／swimming      visual assets／postprocess
          │                   │
          └─────────┬─────────┘
                    ▼
          0.7.0 發布 → 0.8.0 整合發布
```

- 0.7.0 擁有 `reference/src/3d-viewer/walkthrough/`、movement、collision、input 與 simulation state。
- 0.8.0 擁有 `reference/src/3d-viewer/rendering/enhanced/` 與 visual assets。
- `main.ts`、`scene-factory.ts`、共用 CSS、E2E、package／model version 與 Viewer contract 是 integration-owned files，不由兩條功能線同時修改。
- runtime 相容性以 schema、active revision、SITE-XY、adapter 與 hash 判定；開發分支不得為了目標版本提前改寫正式 package／modelVersion。
- 0.8.0 即使先完成本機預覽，也須在 0.7.0 發布後合併其正式基線，再執行完整回歸及發布。

## 4. 渲染架構

```text
Readonly ViewerModel
        │
        ▼
ViewerSceneGraph ──────────────── CollisionWorld
        │                              │
        │ visual only                  │ semantic only
        ▼                              ▼
MaterialRegistry                 0.7 PlayerController
VisualAssetAdapter
EnvironmentEffect
FrameEffectPipeline
        │
        ▼
WebGLRenderer / quality profile
```

### 4.1 共用窄介面

- `MaterialRegistry`：以 semantic material ID 提供共用材質；不得由 entity label 或顏色猜材料。
- `EnvironmentEffect`：套用場景環境、燈光與霧；不得改 camera、layer 或 movement state。
- `FrameEffectPipeline`：擁有 resize、render、quality change 與 dispose；baseline 仍直接呼叫 `renderer.render()`。
- `VisualAssetAdapter`：把 visual-only 細節掛到既有 scene graph，並可完整 dispose；不得修改 Viewer model 或 collision descriptor。
- `RenderQualityProfile`：集中 pixel ratio、shadow、texture tier、AO、水面與後製能力；不得改幾何與操作語意。

`TASK-059` 先建立 baseline implementation，畫面與 0.6.7 保持等價。0.8.0 只替換 enhanced implementation，不重寫 Viewer bootstrap。

## 5. 材質與細節策略

| Semantic material | 視覺目標 | 專業邊界 |
| --- | --- | --- |
| exposed-concrete | 自然灰、模板尺度、微法線、粗糙度差異與低對比接縫 | 實際模板、螺桿孔、防水及耐氯胺仍由 OPEN-016 驗證 |
| safety-glass | 正確環境反射、厚度感、透射、框料與內外層次 | 不宣稱玻璃規格、防撞、防窺、熱濕或消防性能 |
| structural-steel | 深色塗裝鋼、適量金屬度與邊緣高光 | 不虛構斷面、節點或防火塗裝 |
| pool-tile／deck | 可讀尺度、防滑粗糙感、池壁／池底／壓頂分層 | 不宣稱實際磁磚品牌、防滑等級或防水系統 |
| mirror | 鏡面反射語彙與正確牆面共面關係 | 不宣稱戶外鏡材、反射率、固定或眩光已核定 |
| photovoltaic | 模組表面、玻璃高光與格線 | 不虛構品牌、容量、接線或發電量 |

所有 texture repeat 以公尺尺度設定，避免不同 mesh 出現不一致紋理比例。視覺倒角與接縫不可改變 canonical bounds、門洞、通行淨寬、樓梯尺寸或 pool depth。

## 6. 環境、水面與資產

- 五個 scene ID 仍只改 camera、visibility、environment 與內容；不得建立第二套建築幾何。
- environment 使用本地 HDR／程序天空並透過 PMREM 產生反射；資產缺失時回復 baseline environment。
- 水面使用可降級 normal animation、反射／透射與適度深度色；water volume、池壁與斜底仍由 0.7.0 simulation／collision 擁有。
- 人物與植栽只提供尺度、景深與環境參照；不得遮蔽重要動線、設計狀態或真北提示。
- GLTF／texture 載入失敗不得破壞 Viewer；正式視覺驗收仍視缺失資產為未完成。

## 7. 效能、資產與相容性

初始可調整預算：

- high：初始視覺資產傳輸量不超過 24 MiB；具硬體加速的 desktop 裝置目標平均 50 FPS 以上。
- medium：不超過 12 MiB；停用高成本 AO 或降低陰影／水面解析度。
- low：不超過 6 MiB；具硬體加速的 390 × 844 mobile 裝置目標平均 30 FPS 以上並記錄 p95 frame time。
- CI／headless 若只能使用 SwiftShader，不得把 software-rendered FPS 冒充硬體驗收；改以同機 0.6.7 deterministic baseline 的 80% 為防退化門檻，仍完整記錄平均 FPS、p95、draw calls、triangles、shader programs／compile 與 drawing buffer。裝置端 50／30 FPS 仍是 runtime adaptive quality 的目標。
- 0.8.0 正式 high 採 PBR、PMREM、ACES 與 PCF shadow 直接渲染；全畫面 SSAO pipeline 保留為可選能力，但 TASK-064 的 1440 × 900 SwiftShader 證據顯示即使半解析度仍只有 1.35 FPS，因此不在正式 profile 啟用。
- texture 優先使用 KTX2／WebP 或等價壓縮；同材質共用 texture 與 material instance。
- 高細節資產按需求載入；首屏必要材質優先，非必要人物／植栽不得阻塞 Viewer ready。
- quality 降級不得移動玩家、重建 collision、改 scene ID、切換圖層或使選取失效。
- WebGL fallback 維持既有靜態內容，不嘗試載入 0.8.0 3D 資產。

## 8. 錯誤與信任邊界

- 必要 shader／材質 registry 無法建立：回復 baseline rendering，顯示診斷狀態，不建立看似完整的部分 enhanced mode。
- optional GLTF／environment asset 失敗：保留建築與操作，記錄缺失並停用該 visual layer。
- context lost／restore：材質、render target 與 asset adapter 必須可重新建立，不重建 canonical／collision data。
- model、hash、SITE-XY 或 adapter 不符：沿用既有 Viewer fail-closed；視覺層不得掩蓋資料錯誤。
- confirmed／working／deferred 的資訊語意及專業驗證文字不得因寫實材質而消失。

## 9. 驗收

### 9.1 自動驗收

- baseline implementation 與 TASK-059 前的 scene graph、材質 semantic IDs、相機、圖層與互動等價。
- material registry 不存在重複 semantic ID，所有必要材質與資產 manifest 可解析。
- asset 檔案存在，授權／來源／hash／byte size 完整；build 不存取外部 runtime URL。
- high／medium／low profile 的功能差異只影響視覺成本。
- context restore、asset failure、WebGL fallback、reduced motion 與 quality downgrade 可恢復。
- 0.7.0 collision、movement、swimming、safe spawn 與 mode lifecycle 測試完全不依賴 enhanced render mesh。
- `npm run check:docs`、validator、tests、typecheck、build、E2E 與 `git diff --check` 通過。

### 9.2 視覺與效能驗收

- 保存同一 deterministic camera 的 before／after：五場景、池側、校側、俯視、泳池剖視、L1／L2／L3 人眼高度及水下。
- 清水模、玻璃、鋼、池磚、水、鏡面與光電在日光、柔光及雨天都能直接辨識，不只依賴資訊標籤。
- 大面積表面沒有明顯 UV 拉伸、紋理比例跳變、閃爍、z-fighting、透明排序或過曝。
- desktop high 與 mobile adaptive 在硬體裝置以 50／30 FPS 為目標；SwiftShader CI 至少維持同機 0.6.7 baseline 的 80%、記錄 p95，且裝置不足時穩定單向降級，不在階級間反覆震盪。
- 退出 Walkthrough 後 Inspect、五場景、圖層、選取、固定視角及泳池剖視完整恢復。

## 10. 已知風險

| 風險 | 控制 |
| --- | --- |
| 材質看似真實但不是實際選材 | 明示 visual intent；精確樣板仍連回 OPEN-016 |
| 0.7 與 0.8 同改共享檔案 | TASK-059 先抽介面；共享檔只由 integration task 修改 |
| 手機資產或後製過重 | 三階畫質、壓縮、lazy load、frame-time hysteresis |
| GLTF 與程序幾何不一致 | 以 entity anchor 掛載；canonical geometry 與 collision 不變 |
| 寫實效果掩蓋 working／deferred | 狀態資訊與限制文字保持獨立 UI channel |
| 0.8 提前改版號造成資料漂移 | 只在 TASK-065 release gate 同步正式版本 |
