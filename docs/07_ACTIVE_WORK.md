# 07｜Active Work

本文件只管理「目前做什麼、狀態、依賴與驗收」。設計答案留在 01～05 owner 文件，流程留在 06，詳細作法留在 active spec。

允許狀態：`queued`、`ready`、`in_progress`、`blocked`、`done`。同一時間最多一項 `in_progress`；任務延期只修改目標版本，不更換 TASK ID。

## 1. 0.2.0 任務

| ID | 工作 | 狀態 | 目標版本 | Owner／規格 | 依賴 | 完成條件 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-001 | 太陽研究 180° 方位修正 | done | 0.2.0 | [DEC-029](04_DECISIONS_AND_OPEN_ITEMS.md)、[修正計畫](archive/specs/2026-07-14-solar-orientation-correction-implementation-plan.md)、[solar contract](contracts/solar-study.md) | TASK-003 | 固定建築與 2F 使用本地 +X 307° transform；127° 只作面池法線／反射目標；方位一致性測試通過 |
| TASK-002 | L1 戶外入口與廁所雙動線 | done | 0.2.0 | [DEC-028](04_DECISIONS_AND_OPEN_ITEMS.md)、[服務核心設計](archive/specs/2026-07-14-service-core-first-revision-design.md)、[入口修正計畫](archive/specs/2026-07-14-l1-outdoor-entry-correction-implementation-plan.md) | TASK-003 | 綠框為戶外；泳池、男廁、女廁三個獨立戶外開口；兩廁可由泳池側乾式通道進入；模型、圖集與測試一致 |
| TASK-003 | 文件架構重構 | done | 0.2.0 | [設計](archive/specs/2026-07-14-documentation-architecture-refactor-design.md)、[實作紀錄](archive/specs/2026-07-14-documentation-architecture-refactor-implementation-plan.md) | — | 07 成為唯一 task status；owner、contracts、spec archive、versions、來源與文件檢查完成 |
| TASK-006 | REF-401 屋頂、入口戶外區與鏡牆概念修正 | done | 0.2.0 | [縱剖面修正設計](archive/specs/2026-07-15-longitudinal-section-concept-correction-design.md)、[實作計畫](archive/specs/2026-07-15-longitudinal-section-concept-correction-implementation-plan.md)、[DEC-030](04_DECISIONS_AND_OPEN_ITEMS.md) | TASK-002 | 屋頂接近 L2 樓板且維持 deferred；入口區開放；面池端鏡牆外傾示意；來源、模型、圖集與測試一致 |
| TASK-004 | 套件、模型與現行文件同步至 0.2.0 | done | 0.2.0 | [版本流程](06_WORKFLOW_AND_RELEASES.md) | TASK-001、TASK-002、TASK-003、TASK-006 | `package.json`、lockfile、modelVersion、revision 與現行文件一致為 0.2.0 |
| TASK-005 | 完整驗證與本機 release commit | done | 0.2.0 | [0.2.0 release](releases/0.2.0.md)、[發布門檻](06_WORKFLOW_AND_RELEASES.md) | TASK-001～TASK-004、TASK-006 | 文件、模型、測試、build、視覺 smoke 與 diff 檢查通過；建立 release 記錄與本機 `release: v0.2.0` commit；不 tag、不 push |

0.2.0 的 `TASK-001`～`TASK-005` 與 `TASK-006` 均已完成；後續工作由 0.3.0 任務接續。

## 2. 0.3.0 任務

| ID | 工作 | 狀態 | 目標版本 | Owner／規格 | 依賴 | 完成條件 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-007 | 日照分析、2F 水平旋轉、鏡牆外傾與 `solar-study` 同步 | done | 0.3.0 | [日照分析](analysis/solar-analysis.md)、[completed design](archive/specs/2026-07-15-solar-analysis-design.md)、[completed implementation plan](archive/specs/2026-07-15-solar-analysis-implementation-plan.md)、[DEC-031／DEC-032](04_DECISIONS_AND_OPEN_ITEMS.md)、[solar contract](contracts/solar-study.md) | DEC-027、DEC-029、DEC-030 | 水平 +9.5° 與鏡牆外傾 +8.5° 已建立可重現分析；03／04、模型、REF-401、solar contract、HTML、測試與行動版說明一致；幾何結果未被誤述為實際熱效益或眩光安全結論 |
| TASK-008 | `OPEN-010` 玻璃屋頂、L2 分層交界、雨簾與雨水回用設計 | done | 0.3.0 | [completed design](archive/specs/2026-07-15-open-010-roof-rainwater-design.md)、[completed implementation plan](archive/specs/2026-07-16-open-010-implementation-plan.md)、[DEC-033～DEC-036](04_DECISIONS_AND_OPEN_ITEMS.md) | TASK-007、TASK-009 | 4.5°、+4.500 m、1.2 m 外挑、獨立接縫、被動雨簾與屋頂水沖廁流程已同步模型與 HTML；docs、validator、58 項測試、build、desktop／526px smoke 與 diff 檢查通過，`OPEN-010` 關閉並移交 `OPEN-014` |
| TASK-009 | `ST-01` 樓梯幾何、S1 鋼梯、B 弦幕主案與 A 玻璃備案定案 | done | 0.3.0 | [completed design](archive/specs/2026-07-16-stair-finalization-design.md)、[DEC-035](04_DECISIONS_AND_OPEN_ITEMS.md)、[OPEN-013](04_DECISIONS_AND_OPEN_ITEMS.md) | DEC-017～DEC-019 | 書面規格與示意圖已由使用者核准；30 級高／28 踏面、10.2 m 總長、S1、封閉踢面但梯下開放、深色懸浮切線、2.4 m B 弦幕主案、1.35 m A 玻璃備案及隱藏集力梁均有明確 owner，專業驗證仍保持 open |
| TASK-010 | 將核准的 `ST-01` 設計同步至單一模型、REF-101／401／501 與驗證 | done | 0.3.0 | [completed design](archive/specs/2026-07-16-stair-finalization-design.md)、[completed implementation plan](archive/specs/2026-07-16-stair-finalization-implementation-plan.md)、[DEC-035](04_DECISIONS_AND_OPEN_ITEMS.md) | TASK-008、TASK-009 | 模型正確區分級高與踏面並推導 4.20＋1.80＋4.20 m；圖集表達 S1、B 主案／A 備案與隱藏集力梁且不虛構材料定案；schema、validator、58 項測試、build、desktop／526px smoke 與文件檢查通過；320px 實機 smoke 仍保留為已知限制 |

## 3. 0.3.1 任務

| ID | 工作 | 狀態 | 目標版本 | Owner／規格 | 依賴 | 完成條件 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-011 | 修正夏季抽樣缺口，建立連續暖季方向篩檢與工作池面交點分析 | done | 0.3.1 | [日照分析](analysis/solar-analysis.md)、[completed implementation plan](archive/specs/2026-07-16-continuous-solar-analysis-correction-plan.md)、[DEC-037／OPEN-011](04_DECISIONS_AND_OPEN_ITEMS.md) | TASK-007 | 119,364 個日光樣本、27 組誤差包絡及 9 組工作池面情境可重現；文件與 HTML 已撤回整季零命中說法；64 項測試、完整 build 與 diff 檢查通過 |
| TASK-012 | 依增量日照定義排除原本已有直射的池面，重算鏡牆是否增加暖季入射 | done | 0.3.1 | [日照分析](analysis/solar-analysis.md)、[completed implementation plan](archive/specs/2026-07-16-incremental-solar-gain-analysis-plan.md)、[DEC-038／OPEN-011](04_DECISIONS_AND_OPEN_ITEMS.md) | TASK-011 | 119,364 個日光樣本逐一比較反射池面足跡與同時刻 L2 陰影；9 組工作情境新增樣本／面積皆為 0；文件、HTML、67 項測試、完整 build 與 diff 檢查一致 |
| TASK-013 | 依修正後目標建立有鏡／無鏡能量差、暖冷季選擇性與天花板採光分析 | done | 0.3.1 | [日照分析](analysis/solar-analysis.md)、[completed implementation plan](archive/specs/2026-07-16-mirror-energy-and-daylight-analysis-plan.md)、[DEC-039／OPEN-011](04_DECISIONS_AND_OPEN_ITEMS.md) | TASK-012 | 8,760 筆 PVGIS TMY 逐時資料與 3,111 組固定角度掃描可重現；含閏年日數修正後，現行裸露鏡面暖季／冷季增量為 +786.673／+3,445.526 kWh，工作遮罩降為 0／+597.502 kWh，並分列上部採光潛力；現行 owner、HTML、測試、完整 build 與 diff 檢查一致，舊新增受光面積不再作現行性能結論 |
| TASK-014 | 完成太陽研究互動控制、版本同步與 0.3.1 發布 | done | 0.3.1 | [solar contract](contracts/solar-study.md)、[Release 0.3.1](releases/0.3.1.md) | TASK-011～TASK-013 | 年份自動跟隨台北今年且可手動比較；日期採每月 1 日加冬夏至共 14 點，時間採 07～18 整點；目前日期路徑依高度縮放，地平線下不畫反射；平／閏年、2026/6/1 近天頂轉向與行動版來源回歸皆有測試，套件、模型、README 與發布記錄同步為 0.3.1 |

## 4. 0.3.2 任務

| ID | 工作 | 狀態 | 目標版本 | Owner／規格 | 依賴 | 完成條件 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-015 | 修正手機滑桿與互動圖距離過遠，完成 0.3.2 發布 | done | 0.3.2 | [solar contract](contracts/solar-study.md)、[Release 0.3.2](releases/0.3.2.md) | TASK-014 | 920 px 以下控制區提供 sticky 即時預覽；年份、日期、時間與水平旋轉顯示平面，外傾角顯示剖面並可手動切換；390 × 844 Chrome smoke、73 項測試、完整 build 與 diff 檢查通過 |

## 5. 0.3.3 任務

| ID | 工作 | 狀態 | 目標版本 | Owner／規格 | 依賴 | 完成條件 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-016 | 擴充 2F 水平旋轉互動範圍並完成 0.3.3 發布 | done | 0.3.3 | [solar contract](contracts/solar-study.md)、[Release 0.3.3](releases/0.3.3.md) | TASK-015 | 水平旋轉可於 −20°～+40° 以 0.5° 拖曳；平面量體、鏡牆法線、反射診斷、即時讀值及手機 sticky 預覽同步更新；初始與 confirmed 模型仍為 +9.5°；測試、build、手機 smoke 與 diff 檢查通過 |

## 6. 0.4.0～0.5.0 任務

| ID | 工作 | 狀態 | 目標版本 | Owner／規格 | 依賴 | 完成條件 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-017 | 盤點 3D Viewer 資訊完整度並確認 Markdown／模型雙 owner 同步架構 | done | 0.4.0 | [資訊完整度分析](analysis/3d-viewer-information-readiness.md)、[公開理念文字](public/swimming-pool-renovation-design-concept.md) | TASK-016 | confirmed／working／deferred 範圍、現有硬編碼、缺少的 3D 工作幾何、分析失效規則與後續任務邊界已記錄；文件檢查及 diff 檢查通過 |
| TASK-018 | 建立模型單一來源補強與 3D Viewer MVP | done | 0.4.0 | [completed 3D Viewer MVP design](archive/specs/2026-07-18-3d-viewer-mvp-design.md)、[Release 0.4.0](releases/0.4.0.md) | TASK-017 | `/3d-viewer/` 由統一模型及 Markdown 編譯內容建立，五組場景、狀態圖例、WebGL fallback、桌機／手機操作與同步測試通過 |
| TASK-021 | 修正 `ST-01` 樓梯側位，並依剖面 V2.0 建立 0.5.0 工作幾何 | done | 0.5.0 | [DEC-046／DEC-056／DEC-060／OPEN-017](04_DECISIONS_AND_OPEN_ITEMS.md)、[模型契約](05_MODEL_CONTRACT.md)、[3D Viewer 契約](contracts/3d-viewer.md)、[Release 0.5.0](releases/0.5.0.md) | TASK-018、DEC-044、DEC-047 | Viewer 已將樓梯移到長邊玻璃牆旁的獨立乾式透明廊，池畔 +0.30 m 至 L2 +3.30 m 總升高 3.00 m，採 1.50 m 工作淨寬、20 級高／18 踏面、兩跑各 2.70 m、1.80 m 平台及 7.20 m 總長；樓梯與玻璃牆、屋頂荷重分離。法定淨寬、逐點淨高、頂端接點及材料仍由 `OPEN-017` 專業驗證，不把概念模型冒充施工定案 |
| TASK-022 | 依 L1 V2.0 重建戶外區、廁所雙向開口與入口動線 | done | 0.5.0 | [DEC-043／DEC-044](04_DECISIONS_AND_OPEN_ITEMS.md)、[設計基準](03_DESIGN_BASIS.md)、[模型契約](05_MODEL_CONTRACT.md)、[3D Viewer 契約](contracts/3d-viewer.md)、[Release 0.5.0](releases/0.5.0.md) | TASK-018、DEC-043 | 0.5.0 active Viewer／V2.3 圖面表達 8.0 × 7.0 m 戶外區且不連接泳池大廳、7.0 m 廁所帶、泳池側乾式走道及雙向開口；分拆為對外／對池兩套獨立廁所仍保留 `OPEN-008`，未擅自畫入現行方案 |
| TASK-023 | 修正 Viewer 將垂直牆與獨立斜鏡面分離的構造錯誤 | done | 0.5.0 | [DEC-041／DEC-057／DEC-058](04_DECISIONS_AND_OPEN_ITEMS.md)、[設計基準](03_DESIGN_BASIS.md)、[3D Viewer 契約](contracts/3d-viewer.md)、[Release 0.5.0](releases/0.5.0.md) | TASK-018、TASK-025 | Viewer 已把鏡牆移到旋轉 L3，承載牆本身與外貼鏡面共同向泳池側外傾 +3.1°，鏡面只保留 0.012 m 顯示偏移；日照 HTML 及模型同步 +26.5°／+3.1°／X=35 m。材料、固定、分格與眩光仍由 `OPEN-011` 驗證 |
| TASK-024 | 補回 Viewer 缺漏的 L1 池畔地坪與 `POOL-01` 池體 | done | 0.5.0 | [DEC-045／DEC-060](04_DECISIONS_AND_OPEN_ITEMS.md)、[設計基準](03_DESIGN_BASIS.md)、[3D Viewer 契約](contracts/3d-viewer.md)、[Release 0.5.0](releases/0.5.0.md) | TASK-018、DEC-044 | Viewer 已用四塊池畔板圍出真實池口，完成面為 +0.30 m，水池可辨識水面、三水道、池緣、池壁與左 1.2 m 淺端至右 1.5 m 深端的斜底；屋頂低端淨高 3.70 m。工作坡道、門檻、防水、溢流與排水仍由 `OPEN-016`／`OPEN-017` 深化 |
| TASK-025 | 依 L3 新高度重跑日照角度、支點敏感度並同步模型、文件與 solar-study HTML | done | 0.5.0 study | [DEC-054～DEC-057](04_DECISIONS_AND_OPEN_ITEMS.md)、[日照分析](analysis/solar-analysis.md)、[solar contract](contracts/solar-study.md) | TASK-013、DEC-048～DEC-054 | `geometry.solarReflection.v050Study` 保存 12 × 13.5 m、L3 +6.88 m、29 m／5°屋頂、0.343 m 轉接帶與 X=33～41 m 支點；8,760 小時 PVGIS TMY 粗掃 3,111 組並局部細化，工作值為 +26.5°／+3.1°，X=37 m 暖季池面 0、冷季 +910.020 kWh，五支點均暖季 0；模型、analysis registry、owner 文件、HTML、28 項日照測試、typecheck、直接 Vite build 及桌機／手機 browser smoke 通過。完整 `npm run build` 仍被既有 SRC-CONCEPT-001～004 SHA 不一致阻擋 |
| TASK-026 | 將 L3 工作支點轉為 X=35 m，記錄結構／日照折衷並製作三層 V2.1 檢討圖 | done | 0.5.0 review | [DEC-058](04_DECISIONS_AND_OPEN_ITEMS.md)、[日照分析](analysis/solar-analysis.md)、[v0.5.0 圖面](../reference/drafts/v0.5.0/README.md) | TASK-025、OPEN-011、OPEN-016 | X=35 m 對應 L3 幾何中心，重疊 138.099 m²／85.25%、幾何偏心 0 m；同角度下暖季池面 0、冷季 +1,022.903 kWh。模型、HTML、契約、分析與測試同步；新增 1F～3F 平面及縱剖面 V2.1 SVG／PNG 檢討圖，明示旋轉 L3 與固定屋頂的平面錯位、外挑、核心及池畔地坪抬高待確認，3D Viewer 暫不修改 |
| TASK-027 | 修正平面方位並確認池畔 +0.30 m，發布 V2.2 檢討圖 | done | 0.5.0 review | [DEC-059／DEC-060](04_DECISIONS_AND_OPEN_ITEMS.md)、[v0.5.0 圖面](../reference/drafts/v0.5.0/README.md) | TASK-026、OPEN-016、OPEN-017 | V2.2 曾正確標示圖面向右＝服務量體端＝西北 307°並確認池畔 +0.30 m，但把北箭頭誤畫成右上；此錯誤已由 `DEC-061`／`TASK-028` 的 V2.3 取代，V2.2 只保留歷史檢討用途 |
| TASK-028 | 發布 V2.3 圖面，完成 0.5.0 Viewer、圖集、日照 HTML 與最新來源置換 | done | 0.5.0 | [DEC-061](04_DECISIONS_AND_OPEN_ITEMS.md)、[v0.5.0 圖面](../reference/drafts/v0.5.0/README.md)、[Release 0.5.0](releases/0.5.0.md) | TASK-019、TASK-021～TASK-027 | V2.3 北箭頭改指右下而不旋轉建築；Viewer 完成 41 × 14 m L1、三層服務量體、L3 旋轉鏡牆、固定 5°屋頂、+0.30 m 池畔、池體、樓梯、雨水路徑與未決轉接帶；空間圖集直接載入最新衛星圖及 V2.3 平／剖面，日照 HTML 與 Viewer 同步 0.5.0；模型、文件、測試、桌機／手機瀏覽驗證與 production build 全數通過 |
| TASK-019 | 完成 Viewer 材質、環境、理念細節、固定鏡位及高解析擷取 | done | 0.5.0 | [3D Viewer 契約](contracts/3d-viewer.md)、[Release 0.5.0](releases/0.5.0.md) | TASK-021～TASK-024 | 向光、向雨、向人、向時間及總覽五場景可重現；圖層、構件選取、四固定鏡位、工作材質、雨簾／光感、WebGL fallback、版本 hash 與桌機／手機高解析擷取均通過；效果不冒充施工性能 |
| TASK-020 | 建立理念介紹 HTML，輸出 PDF／DOCX 並淘汰舊版文件 | queued | 0.5.0 | [公開理念文字](public/swimming-pool-renovation-design-concept.md)、[completed 3D Viewer MVP design](archive/specs/2026-07-18-3d-viewer-mvp-design.md) | TASK-019 | 理念 HTML 直接讀取 Markdown 內容與 Viewer畫面；PDF及DOCX分別由共同來源產生並通過視覺驗收；替代檔案確認可開啟後才刪除舊版 DOCX |

錯誤記錄（2026-07-18）：本次只登錄 `TASK-021`～`TASK-024` 並釐清 `DEC-041`～`DEC-042`，不修改程式、模型或已發布的 0.4.0 Viewer。

修訂記錄（2026-07-19）：新增 `SRC-CONCEPT-010` 與 `DEC-043`，並依 L1 V2.0 更新 `TASK-022`；本次只保存來源與 owner 決策，不修改 0.4.0 幾何、程式或已發布 Viewer。跨樓層幾何先由 `OPEN-016` 協調。

修訂收集模式（2026-07-19）：依 `DEC-044`，`TASK-021`～`TASK-024` 與後續新增修訂先維持 `queued`。待使用者確認清單完整後，再以 0.4.0 為共同基準協調實作、驗證與發布；不得覆寫 0.4.0 歷史成果。目標版本已由 `DEC-047` 改為 0.5.0。

剖面修訂記錄（2026-07-20）：新增 `SRC-CONCEPT-011`、`DEC-045`～`DEC-046` 與 `OPEN-017`。確認兩條斜線為 1F 至 2F 樓梯，重新檢核其長度／角度；水深方向改為剖面左端 1.2 m、右端 1.5 m。本次只保存來源、目標決策與建議，不修改 0.4.0 幾何、程式或已發布 Viewer。

樓梯與版本修訂記錄（2026-07-20）：使用者將整批實作目標改為 0.5.0；提出樓梯 1.500 m 有效淨寬候選值，概念可行但仍需使用人數、逃生寬度與施工完成面專業驗證。最新位置仍沿長邊玻璃牆旁平行向上，但樓梯與玻璃帷幕結構獨立。平台保留 1.800 m 或改為 1.500 m、樓梯上下端方向、玻璃交界與屋頂淨高仍由 `OPEN-017` 繼續確認。本次不修改 0.4.0 模型、程式或已發布 Viewer。

V2.0 專業重繪記錄（2026-07-20）：依 `SRC-CONCEPT-010`／`011` 與當前 owner 文件，新增 [1F 概念平面圖 V2.0](../reference/drafts/v0.5.0/DRAW-L1-PLAN-V2.0.svg) 與 [縱向概念剖面圖 V2.0](../reference/drafts/v0.5.0/DRAW-LONGITUDINAL-SECTION-V2.0.svg)，並在同資料夾保存 PNG 預覽與版本說明。兩圖均標示圖面版本 V2.0、專案目標 v0.5.0 working draft 及「非施工圖」；已確認數值、工作建議與待確認幾何以不同圖例區分。這是修訂討論圖，不改動 0.4.0 模型、Viewer 或發布成果，`TASK-021`～`TASK-024` 仍維持 queued。

V2.3／0.5.0 實作記錄（2026-07-21）：使用者啟動整批實作後，`TASK-019`、`TASK-021`～`TASK-024` 及 `TASK-028` 已完成。V2.3 修正真北箭頭至圖面右下；0.5.0 active Viewer、最新衛星圖、平／剖面、日照研究與三個 HTML 入口已同步。早期「不修改 0.4.0」及「queued」文字只描述當時的收集階段，不是目前狀態；0.4.0 成果仍保留作歷史比較。

## 7. 0.6.0 任務

| ID | 工作 | 狀態 | 目標版本 | Owner／規格 | 依賴 | 完成條件 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-029 | 將最新 1F～3F 合併平面拆成三張獨立樓層圖，建立 0.6.0 圖面版本標示 | done | 0.6.0 | [DEC-062／DEC-063／DEC-077](04_DECISIONS_AND_OPEN_ITEMS.md)、[v0.6.0 圖面](../reference/drafts/v0.6.0/README.md) | TASK-028 | 已建立 L1、L2、L3 及縱剖各自的 1920 × 1080 SVG／PNG；檔名、SVG title、頁首與圖框均顯示 v0.6.0、GEO-0.6.0、SITE-XY 與非施工圖。L2／L3 保留 41 × 14 m 參照；v0.5.0 歷史圖未覆寫且不出現在 current HTML |
| TASK-030 | 建立跨樓層討論用數值座標軸與定位規則 | done | 0.6.0 | [DEC-065／DEC-074](04_DECISIONS_AND_OPEN_ITEMS.md)、[v0.6.0 圖面座標規則](../reference/drafts/v0.6.0/README.md) | TASK-029、OPEN-016 | 平面 SVG／PNG 使用 SITE-XY 數值軸：最小格線 0.5 m、每 2.5 m 顯示標籤、端點補標 X41／Y14；L2、L3 座標網固定對齊 L1 基地，不隨 L3 旋轉。0.5 m 只供概念讀圖，不代表施工放樣精度 |
| TASK-031 | 收斂 1F 泳池、四間獨立廁所、儲藏室、水處理與右側退縮的 0.6.0 重排方案 | done | 0.6.0 | [DEC-068～075](04_DECISIONS_AND_OPEN_ITEMS.md)、OPEN-008／009／016／018 | TASK-030、TASK-034 | `GEO-0.6.0`、L1 平面與 Viewer 已同步 25 × 8.5 m 池體、X31～X39 服務翼、X39～X41 退縮、四間互不相通廁所、9.75 m²儲物、42.25 m²水處理／藥劑分間及 +0.10／+0.30 m 高差；施工級牆厚、管道、器具淨空與設備選型保留於 OPEN，不冒充專業核定 |
| TASK-032 | 實作已定案的 ST-01 方案 E，修正與 L2 樓板未接合 | done | 0.6.0 | [DEC-066](04_DECISIONS_AND_OPEN_ITEMS.md)、OPEN-017 | TASK-031、TASK-034 | 模型、L1、等比例剖面與 Viewer 已統一 ST-01＝X20.5～X29／Y0.5～Y2.0、2.70＋3.10＋2.70 m、20 級高／18 踏面，由 +0.30 m 在 X29 直接接 L2 +3.30 m；測試鎖定不侵入池體，結構、避難與平台專業驗證保留於 OPEN-017 |
| TASK-033 | 依「結構生成空間」原則建立旋轉 L3 的積木式量體、隔間與陰影方案 | done | 0.6.0 | [DEC-067／DEC-075～076](04_DECISIONS_AND_OPEN_ITEMS.md)、OPEN-009／011／014／016 | TASK-031、TASK-032 | active model、L2／L3 圖面、剖面與 Viewer 已同步固定支承帶、非孤柱原則、玻璃不承重、固定高位設備、L3 +25.5°／鏡牆 +23°、重疊 138.589 m²與外挑 23.411 m²；結構計算與 23°構造專業驗證仍保留於 OPEN |
| TASK-034 | 消除舊版選取與重複／相反 Y 語意，建立 0.6.0 active 模型、座標單一來源及跨輸出防呆 | done | 0.6.0 | [DEC-074](04_DECISIONS_AND_OPEN_ITEMS.md)、[模型契約](05_MODEL_CONTRACT.md) | TASK-030 | 已建立 `activeGeometryRevisionId=GEO-0.6.0`、唯一 SITE-XY bounds、具名 Three adapter、共用 resolver 與 fail-closed 驗證；consumer 不再硬編碼具名舊 study。測試覆蓋 selector 缺失／unknown／duplicate、版本不符、SITE-XY 缺失、entity duplicate、frame 缺失及 ST-01＝X20.5～X29／Y0.5～Y2.0；產物帶 active revision 與 model hash |
| TASK-035 | 完成 0.6.0 結構與設備整合總檢核 | done | 0.6.0 | [DEC-067／DEC-072～076](04_DECISIONS_AND_OPEN_ITEMS.md)、OPEN-008／009／011／014／016～018 | TASK-031～TASK-034 | active model 已記錄隔間／設備／立面整合支承、四廁入口與高差、藥劑公眾分離、固定高位設備與 ST-01 接點；圖面與 Viewer 同步。`integrationReview` 明示概念協調完成，但建築、結構、機電、消防、無障礙核定均為 false，施工級衝突與容量留在 OPEN |

0.6.0 圖面啟動記錄（2026-07-21，歷史）：當時先完成拆圖與版本標示，模型仍為 0.5.0；該暫態已由 2026-07-22 的 0.6.0 整批實作取代。

### 0.6.0 修正討論批次 A（2026-07-21）

本節保存實作前的討論脈絡；使用者已於 2026-07-22 啟動整批實作，`TASK-031`～`TASK-035` 現已完成，不再是執行限制。

1. 服務區由 X33～X41 左移 2 m 至 X31～X39；基地 X0～X41／Y0～Y14 不變，右側 X39～X41 成為 2 m 退縮保留空間。使用者所稱「取消乾式走道」精確指原 X33～X41／Y12.5～Y14 區塊；「取消戶外區」指取消原戶外前場的獨立空間節目，不代表可刪除操場側必要室外到達及無障礙通路。
2. X31～X39／Y0～Y11 暫作男女廁帶，X31～X39／Y11～Y14 暫作儲藏室。為使男、女廁都能同時接觸 X31 與 X39，優先檢討沿 Y 方向上下分區，而不是沿 X 方向左右分區；確切分界須依學生人數、器具數、無障礙廁間、管道間與清潔空間決定。
3. 每一間男女廁均設 X31 泳池側門與 X39 操場側門，服務游泳與球場學生；兩側入口須以錯位門、前室或視線屏風避免直視廁間，並以門禁／管理方式避免把廁所變成操場直通泳池的穿越捷徑。
4. 儲藏室候選範圍為 X31～X39／Y11～Y14，面積約 24 m²。須先定義其為一般器材、泳具、清潔用品或泳池藥劑；泳池藥劑不得與一般器材混放，若納入此區須另設專用分間、獨立通風、外部補貨動線、洩漏承接與專業機電／消防驗證。
5. 泳池候選外框修正為 X5～X28，上界可到 Y12.5；與 X31 廁所牆之間保留完整 3 m。下界尚未由本輪指示改定；若暫沿用現況 Y3.5，水體為 23.0 × 9.0 m，並非 25 m 標準水長。下一輪須先決定是以教學最大面積為優先，或改以 25 m 有效水長為優先；上側 1.5 m 與右側 3 m 仍須連同溢水溝、池岸結構、救生巡視、無障礙入水、排水與避難淨寬檢核。
6. L3 採旋轉積木語彙、局部外挑及陰影漸層在概念上可行；服務中心牆交叉處只有在其被設計為連續柱、剪力牆或核心筒並落至基礎時，才可成為結構支點。建議以少數清楚主支點加可計算的轉換構架塑造懸挑，而非讓每道隔間牆都看似承重。
7. ST-01 圖面位置確認為 Y0.5～Y2.0；先前把內部 `originY=11.875` 直接視為圖面座標是錯誤，且已更正。泳池若沿用下界 Y3.5，兩者之間仍有 1.5 m，不構成碰撞。真正未解問題仍是樓梯上端約 X26.7、L2 樓板起於 X29，X 方向約差 2.3 m；後續應保留樓梯 Y 帶並重做上平台／接板，不應以錯誤 Y 座標要求整座樓梯搬移。
8. 建議的決策順序修正為：先定泳池是否要 25 m 水長與下界；再在保留 ST-01＝Y0.5～Y2.0 的前提下解決 X26.7～X29 接板；接著定男女廁 Y 向分界／器具數與儲藏類型；最後才以新的 L1／L2 支承中心發展 L3 旋轉、外挑與日照。這個順序可避免先做 3F 造型後又因樓梯、核心或泳池改動而整批重算。

批次 A 座標更正（2026-07-21）：使用者確認 ST-01 位於圖面 Y0.5～Y2.0，並將泳池右界由 X28.5 退至 X28，使其與 X31 廁所牆保持 3 m；本次只修正討論紀錄，尚未改圖或模型。

### 批次 A 第二輪確認與樓梯比較（2026-07-21）

- 儲藏室：使用者同意 X31 泳池側與 X39 操場側兩個出口的規劃。
- 泳池：使用者已明確確認 25 m 方案 X3～X28／Y4～Y12.5＝25 × 8.5 m，不再保留 23 m 方案歧義。
- 結構／隔間：使用者同意一般隔間牆不能直接作結構支撐，但要求結構支撐巧妙成為隔間牆的一部分。後續以「結構先成立、隔間包覆整合」為原則：將柱、剪力牆或核心筒對齊廁所分界、儲藏室邊界、管道間或設備牆，利用同一牆厚完成空間分隔；不得反向把任意輕隔間假定為承重牆。

樓梯候選均維持 SITE-XY 的 Y0.5～Y2.0、L1 池畔 +0.30 m 至 L2 +3.30 m 總升高 3.00 m：

| 方案 | X 範圍／接板 | 初步級數與尺度 | 視覺與取捨 |
| --- | --- | --- | --- |
| A 原位短橋 | 樓梯 X19.5～X26.7；短橋 2.3 m 接 X29 | 維持 20 級高、R=0.150 m、T=0.300 m、兩跑各 2.70 m | 改動最少，但 2.3 m 橋段較明顯，樓梯本體沒有更延伸 |
| B 右移 1 m＋短橋 | 樓梯 X20.5～X27.7；短橋縮為 1.3 m | 維持 20 級高、R=0.150 m、T=0.300 m、兩跑各 2.70 m | 比 A 更接近 L2、橋較短，外觀仍是原坡度；須重驗下端到達與支承點 |
| C 原位放緩至接板 | 樓梯 X19.5～X29，無獨立短橋 | 建議改 24 級高、R=0.125 m；兩跑各 12 級高／11 踏面，T=0.350 m；兩跑各 3.85 m＋1.80 m 平台＝9.50 m | 最修長、坡度約 21.3°，延伸感最強；步數最多、占地最長 |
| D 右移 1 m＋適度放緩（優先建議） | 樓梯 X20.5～X29，直接接板，無獨立短橋 | 建議 22 級高、R≈0.136 m；兩跑各 11 級高／10 踏面，T≈0.335 m；兩跑各 3.35 m＋1.80 m 平台＝8.50 m | 同時得到較長視覺、較舒緩坡度與直接接板，步數／占地介於 B、C；仍須專業驗證淨高、平台、門洞、逃生與結構 |
| E 右移 1 m＋加長中繼平台（已由 DEC-066 定案） | 樓梯 X20.5～X29，直接接板，無獨立短橋 | 維持 20 級高、R=0.150 m、T=0.300 m；兩跑各 2.70 m，中繼平台由 1.80 m 延長至 3.10 m，總長 8.50 m | 完整形成「斜跑—長水平平台—斜跑」；不改步行節奏，延伸感與陰影層次強於 B，且比 C／D 少改級數；3.10 m 懸浮平台的扭轉、振動與群聚荷重須重新計算 |

若只把原 20 級樓梯拉長到 9.50 m，踏面會增至約 0.428 m，`2R+T≈0.728 m`，步距過深且不符合本階段採用的舒適比例檢核，因此「放緩」必須連級數一起調整，不可只拉長踏面。上述 C／D 均為概念候選，最後仍須由建築師依實際用途、法規與避難計算確認。

第三輪確認（2026-07-21）：使用者正式確認泳池採 X3～X28／Y4～Y12.5；另提出樓梯起點右移 1 m、延長中繼平台的示意。幾何檢核顯示方案 E 可用 2.70＋3.10＋2.70＝8.50 m 從 X20.5 直接到 X29，在保持原 20 級與 R15／T30 的同時取消短橋。

第四輪定案（2026-07-21）：使用者正式核准樓梯方案 E，由 `DEC-066` 管理；其他 A～D 只保留為比較歷史，不再驅動 0.6.0。使用者並再次確認 `DEC-067` 的「結構生成空間」理念：結構規劃必須同步考慮空間，讓真正的結構構件成為隔間或立面秩序的一部分，避免為結構目的事後插入突兀孤柱。將柱融入 Y0 玻璃牆實體分格、讓樓梯平台受力與柱線結合僅為說明理念的例子，不代表指定構造或固定座標。

### 批次 A 第五輪：1F 機房、廁所、入口與水道（2026-07-21）

1. 水處理規模：泳池 X3～X28／Y4～Y12.5 的池面為 212.5 m²；平均深度暫按 1.35 m，水量約 286.9 m³。依 [Sport England 泳池建築服務設計指南](https://sportengland-production-files.s3.eu-west-2.amazonaws.com/s3fs-public/swimming-pools-2013-appendix-2-servicing-the-building.pdf?VersionId=E7Icoi3F4WCodG39.Vpt5zBGp9UjJun1)，一般游泳池概念換水週期為 2.5～4 小時，循環量約 72～115 m³/h；水處理機房通常以池面積 15～30% 初估，本案約 31.9～63.8 m²。現有 24 m² 儲藏帶全部使用仍低於概念下限，左右對分後的 12 m² 更不能稱為完整水處理機房。
2. 機房工作首選：保留「左側乾式雜物儲藏、右側由 X39 獨立維修進出」的水平分區意圖，但右側 L1 只先作受管制的藥劑／維修入口；主要過濾器、泵浦及平衡槽另在鄰池且接近池底標高的 32～40 m² 下層或擴大機房處理。藥劑須和雜物分間、獨立通風、止液堤／排水並防止學生進入。若不接受下層機房，下一輪必須挪用廁所或其他服務面積，不能硬塞進 12 m²。
3. 廁所分區：使用者確認男廁靠 Y0、女廁靠 Y11；X31／X39 雙側入口的精確位置下一輪討論。若先以 Y5.5 等分，男女各約 44 m²。30 人且男女各 15 人時，法規最低約為男 1 WC＋1 小便斗、女 2 WC、洗面盆至少各 1；空間可容納的較舒適工作案為男 3 WC＋3 小便斗＋3 洗面盆、女 5 WC＋3 洗面盆，須在雙入口隱私前室與管道間畫入後再確認。
4. 無障礙廁所：使用者提出不設置，但[建築技術規則第 167-3 條](https://www.nlma.gov.tw/ch/legislation/law%26regusw/6175)對三層以下且應設衛生設備的非住宅建築原則上要求每幢至少一處。此偏好只記錄為待建築師／主管機關檢核，不能作可施工刪除；可研議在男女廁之外設一間獨立共用，避免同時壓縮兩間廁所。
5. 入口：使用者確認主入口約在 X0.5～X2.5／Y0。室內游泳池通常屬 D-1，[建築技術規則第 90-1 條](https://www.nlma.gov.tw/ch/legislation/law%26regusw/6175)要求每處避難層屋外出入口不小於 2.00 m；因此 30 人規模仍建議有效淨寬 2.00 m。現有 2.00 m 座標跨度若包含門框會不足，正式圖應放大結構開口，採雙扇門並讓常用扇具至少 0.90 m 無障礙淨寬。
6. 高差改由本輪最新的四間獨立廁所方案控制：泳池側廁所與池畔同為 +0.30 m，操場側廁所為 +0.10 m；不在泳池大廳或廁所內設主要標高轉換坡道。
7. 水道：8.5 m 池寬的首選是 3 條 2.5 m 標準水道，兩側各留 0.5 m 緩衝，剛好 8.5 m。這與[教育部體育署學校游泳池規劃資料](https://www.sa.gov.tw/Resource/Attachment/f1425280791177.pdf)所列 2.5 m 標準水道及最外側至少 0.5 m 緩衝一致。30 人同時下水約為每道 10 人，適合分組教學；四道只能縮成非標準約 2.0 m，較不建議。
8. 結構與設備整合的整體檢核已新增為 `TASK-035`，涵蓋柱牆／核心、樓梯平台、水處理／平衡槽／藥劑間、空調除濕、雨水回用、四間廁所管道、設備搬運、標高銜接、排水、防水、避難與無障礙衝突；須在唯一 active 模型與 0.6.0 幾何更新後執行。

### 批次 A 第六輪：機房樓層分工、廁所面積與混合水道（2026-07-21）

1. 整套水處理設備移到 3F 在空間上做得到，但在水力與維修上不是首選。Sport England 指南建議循環泵接近最深池底標高並維持淹沒吸水；把泵、過濾器、平衡槽與反沖洗系統抬至 3F，會增加揚程、吸水風險、長立管、噪振、漏水影響與樓板集中水重。酸／氯藥劑也須獨立通風、受管制並避免與空調、電氣及人員動線混合；[CDC 2024 MAHC](https://www.cdc.gov/model-aquatic-health-code/media/pdfs/2024/11/5th-Ed-MAHC-Code-508.pdf)另要求化學儲藏專用空間、阻止未授權進入、控制逸散並和設備房分開。
2. 3F 建議只承擔「適合高層」的設備：水塔／生活或雨水回用儲水、泳池大廳空調除濕與熱回收、熱泵室外機／冷凝端及 BMS 控制。水塔每 1 m³ 水即約 1 t，所有水塔、機組與維修通道須集中在固定結構核心或直落柱線上，避開 L3 旋轉懸挑、鏡牆與薄弱出挑端；進排風與藥劑排氣不得互相短路。
3. L1 廁所面積與標高已由後續「四間獨立廁所重新規劃」取代；本節只保留池水設備留在 L1、3F 承擔適合高層設備的分工原則。
4. 無障礙廁所依使用者指示延後專題規劃，不視為刪除；目前 60 m²四間廁所工作面積未計入獨立無障礙廁所。
5. 8.5 m 池寬沒有「三條 2.5 m 標準道後再加寬」的餘量；依使用者意圖定為 0.5 m 外側緩衝＋2.5 m 標準道＋2.5 m 標準道＋3.0 m 正常／教學混合區。3.0 m 從最外水道繩量至池壁，內含靠牆 0.5 m 安全帶，可作一般游泳，也能容納教師下水、初學者並排或自救教學；由 `DEC-070` 管理。

第七輪確認（2026-07-21）：水處理設備仍以 L1 鄰池配置為主，3F 配置水塔與適合高層的空調／熱回收／熱泵／控制設備；無障礙廁所延後專題規劃，兩標準水道＋3.0 m 混合教學區維持定案。舊廁所面積與高差提案已依使用者要求刪除，不再作文件、模型或圖面依據。

### 批次 A 第八輪：四間獨立廁所與六區塊彈性分割（2026-07-22）

1. L1 服務翼 X31～X39／Y0～Y14 改由六個功能區組成：儲物間、水處理機房、泳池男廁、泳池女廁、操場男廁、操場女廁。泳池組與操場組完全不互通，不設共用內部走道或借道門；泳池組只朝 X31 進出，操場組只朝 X39 進出。
2. 已確認器具與標高：泳池男廁 +0.30 m，2 WC＋2 小便斗＋2 洗面盆；泳池女廁 +0.30 m，3 WC＋2 洗面盆；操場男廁 +0.10 m，1 WC＋1 小便斗＋1 洗面盆；操場女廁 +0.10 m，2 WC＋1 洗面盆。泳池大廳、池畔與泳池側廁所連續同高，不在廁所內設主要高差轉換。
3. 面積工作建議：泳池男廁 X31～X35.5／Y0～Y3.5＝15.75 m²；泳池女廁 X31～X35.5／Y3.5～Y7.5＝18.00 m²；操場男廁 X35.5～X39／Y0～Y3.5＝12.25 m²；操場女廁 X35.5～X39／Y3.5～Y7.5＝14.00 m²，四間合計 60.00 m²。這些是概念毛面積，尚須扣除牆柱與管道間；正式圖以 1.00 × 1.50 m WC 模組、0.80 m 小便斗／洗面盆中心距、1.20 m 洗面盆前淨空及入口視線遮擋檢核。
4. 六區塊不要求共用同一條垂直分割線。廁所依人數先以 X35.5 分成泳池側 4.5 m與操場側 3.5 m；上方 Y7.5～Y14 的服務帶則依設備需求以 X32.5 分成 9.75 m²儲物間與 42.25 m²水處理／獨立藥劑分間。非對齊分界可提高面積效率，但隔間端點須落在可整合柱、設備牆或管道牆的位置；水處理主區仍優先保持完整矩形，不為造型切成零碎凹角。
5. L2 +3.30 m、既有屋頂與天花標高維持不變。泳池廁所由 +0.30 m至 L2 為 3.00 m幾何層高，操場廁所由 +0.10 m至 L2 為 3.20 m；實際淨高須扣除樓板、梁、風管與排水管。X39～X41 的 2 m 退縮優先檢討由 +0.00 緩升到 +0.10 m的 1:20 外部整坡，避免操場廁所門口產生 10 cm階差。
6. 本輪只更新 owner 文件與 Active Task；舊廁所提案及其專用示意已刪除。在使用者確認面積工作值且 `TASK-034` 完成前，不修改正式 SVG／PNG、模型、Viewer 或分析成果。

### 座標誤判事件與防再犯門檻（2026-07-21）

- 事件：先前檢核直接把 `geometry.solarReflection.v050Study.stairFromRaisedPoolDeck.originY=11.875` 當成使用者圖面 Y 座標，錯誤判定樓梯位於上側並與泳池衝突；使用者指出 ST-01 正確圖面範圍為 Y0.5～Y2.0。先前衝突結論已撤銷，不得再引用。
- 根因：同一 `ST-01` 同時存在 `geometry.stair.originY=0.5` 與 v0.5.0 工作幾何 `originY=11.875`，欄位同名但座標方向／原點語意不同；`viewer-data.mjs` 直接轉送後者，測試也只做數值快照，沒有驗證圖面 bounds。這違反單一來源原則，現行模型在此項應視為不安全。
- 修法：依 `TASK-034` 建立唯一 `SITE-XY` canonical bounds，其他 SVG／Canvas／Three.js 座標只能透過具名 adapter 推導；禁止 consumer 或人工檢核直接解讀未帶座標系的 `originX`／`originY`。
- 版本選取：使用者要求固定抓取最新版模型。此處的「最新版」定義為模型頂層唯一 `activeGeometryRevisionId` 所指的版本，而不是最大版號、最新檔案時間或資料夾名稱。共同 `resolveActiveGeometry()` 必須檢查 active ID 存在且與 `modelVersion` 相符；找不到、出現多個 active、版本不一致或 consumer 試圖直接讀 `v050Study` 等具體舊版名稱時立即失敗，絕不靜默套用舊資料。0.6.0 討論圖可標示 `designTargetVersion=0.6.0`，但在整批實作與驗證完成前，仍不得冒充 active model。
- 強制驗證：斷言 ST-01＝X20.5～X29／Y0.5～Y2.0、泳池／服務區／L2 邊界的 SITE-XY bounds，並逐一比對單一模型、產生資料、SVG 與 Viewer。任何 frame 缺失、同 ID 多套 bounds 或跨輸出不一致都使 build／test 失敗。
- 執行結果：`TASK-034` 的 resolver、adapter 與破壞性回歸測試已先完成，之後才實作 `TASK-031`～`TASK-033`；此閘門現已通過。

## 8. 未排程設計問題

下列項目是真正尚無完整答案的 OPEN，不是已知修法的工作：

- [OPEN-006](04_DECISIONS_AND_OPEN_ITEMS.md)：基地精確旋轉角與像素校準。
- [OPEN-008](04_DECISIONS_AND_OPEN_ITEMS.md)：四間獨立廁所的隔間、門位、管道、實際淨空與主入口／到達路徑對應。
- [OPEN-009](04_DECISIONS_AND_OPEN_ITEMS.md)：逃生、無障礙、結構與機電。
- [OPEN-011](04_DECISIONS_AND_OPEN_ITEMS.md)：0.6.0 工作值為 L3 水平 +25.5°、鏡牆外傾 +23.0°、X=35 m；23°幅度大，實際質心／剛心、轉換構造、固定、材料、維修、眩光與最終性能仍待專業完成。
- [OPEN-013](04_DECISIONS_AND_OPEN_ITEMS.md)：全高弦幕材料、集力節點、張力／撓度及專業安全驗證。
- [OPEN-014](04_DECISIONS_AND_OPEN_ITEMS.md)：屋頂接縫、雨簾與雨水回用的施工尺度、容量與機電／建築物理驗證。
- [OPEN-016](04_DECISIONS_AND_OPEN_ITEMS.md)：0.6.0 概念模型已完成 SITE-XY、12 × 13.5 m 樓板、固定屋頂與四廁高差遷移；施工級柱網、轉換構造、0.343 m 轉接帶與防排水節點仍待完成。
- [OPEN-017](04_DECISIONS_AND_OPEN_ITEMS.md)：0.6.0 已建立 ST-01 方案 E；有效淨寬、3.10 m 平台結構、逐點淨高、防墜、逃生與材料仍待專業定案。

這些 OPEN 在取得新輸入、形成可核准設計並建立 TASK 前，不列入執行順序。

0.3.0 的 `TASK-007`～`TASK-010` 均已完成，驗證與發布證據見 [Release 0.3.0](releases/0.3.0.md)；下一階段只從上述未排程 OPEN 另立設計與任務，不回寫已封存的 0.3.0 規格。

`TASK-011`～`TASK-014` 已完成並收斂為 [Release 0.3.1](releases/0.3.1.md)；tag 仍依專案慣例不建立，push／部署狀態以 release 記錄及 GitHub workflow 為準。

`TASK-015` 已完成並收斂為 [Release 0.3.2](releases/0.3.2.md)；不建立 tag，推送 `main` 後由既有 GitHub Pages workflow 部署。

`TASK-016` 已完成並收斂為 [Release 0.3.3](releases/0.3.3.md)；不建立 tag，推送 `main` 後由既有 GitHub Pages workflow 部署。

`TASK-017`～`TASK-018` 已完成並收斂為 [Release 0.4.0](releases/0.4.0.md)；不建立 tag，推送 `main` 後由既有 GitHub Pages workflow 部署，後續主動工作由 `TASK-019` 接續。

`TASK-019`、`TASK-021`～`TASK-028` 已完成並收斂為 [Release 0.5.0](releases/0.5.0.md)。

`TASK-029`～`TASK-035` 已完成並收斂為 [Release 0.6.0](releases/0.6.0.md)；不建立 tag，推送 `main` 後由既有 GitHub Pages workflow 部署。
