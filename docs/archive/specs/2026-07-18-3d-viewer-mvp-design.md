# 3D Viewer MVP 與理念內容同步架構

- 日期：2026-07-18
- 類型：design
- 狀態：completed
- 完成日期：2026-07-18
- 任務：TASK-018
- 目標版本：0.4.0

## 1. 問題與目標

現有輸出包含 SVG 空間參照圖集及日照互動頁，但沒有可自由探索的 WebGL 3D Viewer；公開理念 Markdown、模型數值與顯示文字也尚未形成自動同步鏈。

0.4.0 的目標是建立概念設計級 3D Viewer MVP，並確立兩個不可混淆的 source of truth：

- [公開理念 Markdown](../../public/swimming-pool-renovation-design-concept.md)：所有對外敘事文字的 owner。
- `model/project-model.json`、03～05及分析 owner：建築幾何、狀態、性能與限制的 owner。

Viewer 同時讀取兩者；後續理念介紹 HTML 再整合 Markdown 內容、Viewer 場景與固定鏡位畫面。

## 2. 範圍與非目標

### 2.1 0.4.0 範圍

- 建立 `/3d-viewer/` 獨立入口，不取代現有圖集及 `/solar-study/`。
- 採 Three.js、TypeScript與既有 Vite build。
- 所有建築 mesh 由模型與單一 derived geometry 產生。
- 支援 orbit、pan、zoom、重設視角與預設敘事鏡位。
- 支援建築圖層、狀態圖例、選取資訊與 WebGL fallback。
- 建立 `overview`、`light`、`rain`、`people`、`time` 五個穩定 scene ID。
- 建立 Markdown 內容編譯、模型 token 注入及場景引用驗證。
- 為後續高解析擷取保留 deterministic camera 與 scene manifest。

### 2.2 非目標

- 施工級 BIM、結構節點、機電設備、法規簽證或精密基地測量。
- 專業 Radiance／EnergyPlus 全年驗證。
- 未核准季節控制表皮或鏡面分格。
- 最終理念介紹 HTML、PDF與 DOCX；這些由後續 TASK-020 完成。
- 刪除既有 DOCX；只有新輸出全數驗收後才執行。

## 3. 資料流與所有權

```text
公開理念 Markdown ──→ content compiler ──→ concept-content.json ──┐
                                                                  ├─→ 3D Viewer
project-model.json ──→ geometry derivation ──→ viewer-model.json ─┘

3D Viewer ──→ scene manifest／高解析畫面 ──┐
Markdown content ───────────────────────────┼─→ 後續理念介紹 HTML
project model tokens ───────────────────────┘
```

同步規則：

- 公開文字不得另寫在 Viewer TypeScript 或理念 HTML。
- 重要數值不得在 Markdown、renderer 或 CSS 重複寫死。
- Markdown 只引用穩定 scene ID，不保存相機座標或材料參數。
- 相機、圖層與環境狀態由 Viewer scene config 管理。
- 分析輸出帶入其 model hash；不相符時標示 stale 並阻擋正式性能結論。

## 4. 模型補強

### 4.1 Canonical elevation

以 `referenceSystem.levels.L2.elevation` 作為 L2 高度的 canonical input。以下值改為推導或一致性關係：

- `roof.highElevation = L2.elevation`
- `stair.totalRise = L2.elevation - L1.elevation`
- `roofFarWallElevation` 由高端、跨度與坡度推導
- `roofLowElevation` 由高端、總長與坡度推導

設計變更仍需更新 DEC；同步架構只消除重複輸入，不繞過設計核准。

### 4.2 3D working geometry

模型需新增或明確化：

- `l2VolumeHeight`：Viewer 使用的上層量體高度；初始沿用現有剖面 3.6 m 視覺工作值。
- `planPivot`：2F 工作旋轉支點；初始採現有分析的 L2 起點 X=19 m、建築寬度中心，status=`working`、openItemId=`OPEN-011`。
- `mirrorVisualWallHeight` 與能量分析 `mirrorHeight` 分離；Viewer 不把整面外牆面積冒充有效反射面積。
- Viewer 材質只保存視覺 palette 與狀態，不宣稱為施工材料。

## 5. Viewer 結構

建議檔案邊界：

```text
reference/3d-viewer/index.html
reference/src/3d-viewer/main.ts
reference/src/3d-viewer/model-adapter.ts
reference/src/3d-viewer/scene-factory.ts
reference/src/3d-viewer/scenes.ts
reference/src/3d-viewer/interactions.ts
reference/src/3d-viewer/styles.css
reference/generated/concept-content.json
scripts/build-public-content.mjs
```

Three.js 採 Y-up；模型本地座標對應為：

- 模型 +X → Three +X
- 模型 +Y → Three +Z
- 模型 +Z → Three +Y

整棟建築的世界方位只在最高層 group 套用一次；不得在各 mesh 重複套用 307° transform。2F 的 +9.5°旋轉只套用 L2 group，鏡牆 +8.5°外傾只套用鏡牆本身。

## 6. 場景與互動

| Scene ID | 用途 | 初始圖層／環境 |
| --- | --- | --- |
| `overview` | 完整建築與新舊關係 | 全部主要量體、一般日光 |
| `light` | 2F 旋轉與鏡牆外傾 | 平面方向、冬季工作光線、角度標示 |
| `rain` | 屋頂、雨簾與回用 | 雨天、屋頂與水路圖層 |
| `people` | 玻璃外牆與樓梯 | 玻璃牆、樓梯、公共動線 |
| `time` | 原建築與新增介入比較 | 原建築／新增量體分色或切換 |

所有場景必須共用同一模型，只調整 camera、visibility、environment 與 annotations，不建立第二套幾何。

## 7. 狀態與錯誤處理

- `confirmed`：正常材質與完整資訊。
- `working`：顯示工作值徽章，可選擇工作色邊框。
- `deferred`：省略精密細節或以概念半透明表達，資訊面板連回 OPEN。
- Markdown scene ID 不存在、模型 token 無法解析、derived geometry 非有限值或模型 hash 不一致時，build 失敗。
- WebGL 不可用時顯示可閱讀的靜態總覽與前往空間參照圖集的連結。
- Viewer 不得以畫面效果掩蓋未決性能，也不得將分析 stale 結果顯示為現行結論。

## 8. 驗收條件

1. `/3d-viewer/` 可由桌機與 390 × 844 行動裝置載入。
2. 主要量體、泳池、屋頂、L2、鏡牆、樓梯與雨簾均由模型建立。
3. 2F +9.5°及鏡牆 +8.5°只作用於正確 group／surface。
4. 五個 scene ID 可重現固定 camera、圖層與文字。
5. Viewer 的所有公開文字來自 Markdown 編譯結果或模型 formatter。
6. 修改一個 canonical 測試參數時，derived geometry、Viewer標籤及內容 token同步改變；安全／性能依賴則被標示 stale 或阻擋。
7. confirmed／working／deferred 可被使用者辨識。
8. WebGL fallback、鍵盤操作、reduced motion及基本替代文字成立。
9. focused tests、完整 `npm test`、`npm run build`、desktop／mobile smoke與 `git diff --check` 通過。

## 9. 後續任務接口

- TASK-019 在同一 Viewer 上完成材質、環境、細節、固定鏡位與高解析擷取，不重建模型。
- TASK-020 使用 Markdown、scene manifest及 Viewer畫面建立理念介紹 HTML，再分別產生PDF與DOCX；不得以 PDF 反轉成 Word。
- 舊版 `deliverables/游泳池改建設計理念介紹.docx` 只在 TASK-020 全部驗收且確認替代檔案可開啟後刪除。
