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

## 4. 未排程設計問題

下列項目是真正尚無完整答案的 OPEN，不是已知修法的工作：

- [OPEN-006](04_DECISIONS_AND_OPEN_ITEMS.md)：基地精確旋轉角與像素校準。
- [OPEN-008](04_DECISIONS_AND_OPEN_ITEMS.md)：廁所、開口與乾式通道精確尺寸。
- [OPEN-009](04_DECISIONS_AND_OPEN_ITEMS.md)：逃生、無障礙、結構與機電。
- [OPEN-011](04_DECISIONS_AND_OPEN_ITEMS.md)：水平 +9.5° 與鏡牆外傾 +8.5° 已確認；結構支點、牆高、材料與最終性能仍待完成。
- [OPEN-013](04_DECISIONS_AND_OPEN_ITEMS.md)：全高弦幕材料、集力節點、張力／撓度及專業安全驗證。
- [OPEN-014](04_DECISIONS_AND_OPEN_ITEMS.md)：屋頂接縫、雨簾與雨水回用的施工尺度、容量與機電／建築物理驗證。

這些 OPEN 在取得新輸入、形成可核准設計並建立 TASK 前，不列入執行順序。

0.3.0 的 `TASK-007`～`TASK-010` 均已完成，驗證與發布證據見 [Release 0.3.0](releases/0.3.0.md)；下一階段只從上述未排程 OPEN 另立設計與任務，不回寫已封存的 0.3.0 規格。

`TASK-011`～`TASK-014` 已完成並收斂為 [Release 0.3.1](releases/0.3.1.md)；tag 仍依專案慣例不建立，push／部署狀態以 release 記錄及 GitHub workflow 為準。
