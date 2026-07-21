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

## 7. 未排程設計問題

下列項目是真正尚無完整答案的 OPEN，不是已知修法的工作：

- [OPEN-006](04_DECISIONS_AND_OPEN_ITEMS.md)：基地精確旋轉角與像素校準。
- [OPEN-008](04_DECISIONS_AND_OPEN_ITEMS.md)：廁所內部、主入口／到達路徑對應，以及雙向廁所或分拆廁所方案。
- [OPEN-009](04_DECISIONS_AND_OPEN_ITEMS.md)：逃生、無障礙、結構與機電。
- [OPEN-011](04_DECISIONS_AND_OPEN_ITEMS.md)：0.5.0 工作值為 L3 水平 +26.5°、鏡牆外傾 +3.1°、X=35 m；實際質心／剛心、轉換構造、材料、眩光與最終性能仍待完成。
- [OPEN-013](04_DECISIONS_AND_OPEN_ITEMS.md)：全高弦幕材料、集力節點、張力／撓度及專業安全驗證。
- [OPEN-014](04_DECISIONS_AND_OPEN_ITEMS.md)：屋頂接縫、雨簾與雨水回用的施工尺度、容量與機電／建築物理驗證。
- [OPEN-016](04_DECISIONS_AND_OPEN_ITEMS.md)：0.5.0 概念模型已完成 33＋8 m、12 × 13.5 m 樓板與固定屋頂遷移；施工級柱網、轉換構造、0.70 m 平面錯位、0.343 m 垂直接帶及池畔高差節點仍待完成。
- [OPEN-017](04_DECISIONS_AND_OPEN_ITEMS.md)：0.5.0 已建立樓梯工作幾何；有效淨寬、逐點淨高、頂端接點、逃生與材料仍待專業定案。

這些 OPEN 在取得新輸入、形成可核准設計並建立 TASK 前，不列入執行順序。

0.3.0 的 `TASK-007`～`TASK-010` 均已完成，驗證與發布證據見 [Release 0.3.0](releases/0.3.0.md)；下一階段只從上述未排程 OPEN 另立設計與任務，不回寫已封存的 0.3.0 規格。

`TASK-011`～`TASK-014` 已完成並收斂為 [Release 0.3.1](releases/0.3.1.md)；tag 仍依專案慣例不建立，push／部署狀態以 release 記錄及 GitHub workflow 為準。

`TASK-015` 已完成並收斂為 [Release 0.3.2](releases/0.3.2.md)；不建立 tag，推送 `main` 後由既有 GitHub Pages workflow 部署。

`TASK-016` 已完成並收斂為 [Release 0.3.3](releases/0.3.3.md)；不建立 tag，推送 `main` 後由既有 GitHub Pages workflow 部署。

`TASK-017`～`TASK-018` 已完成並收斂為 [Release 0.4.0](releases/0.4.0.md)；不建立 tag，推送 `main` 後由既有 GitHub Pages workflow 部署，後續主動工作由 `TASK-019` 接續。
