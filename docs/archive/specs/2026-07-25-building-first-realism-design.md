# 0.8.2 建築本體優先擬真設計

- 日期：2026-07-25
- 類型：design
- 狀態：completed
- 完成日期：2026-07-25
- 任務：TASK-067～TASK-074
- 目標版本：0.8.2

## 1. 問題與核准方向

現行 Viewer 已具 PBR、環境光、陰影、可降級水面與第一人稱漫遊，但主要量體仍偏向概念模型；衛浴器具以簡單幾何表示，外殼、泳池濕區與 L2 室內缺少足以建立真實尺度感的構造及使用細節。

使用者核准 0.8.2 採以下方向：

- 整體時間狀態為「剛完工但已投入使用」：乾淨、完整、材質新，只有少量合理水痕與使用跡象，不表達老舊、破損或髒污。
- 第一優先是建築本體，包含外觀、泳池大廳、池體、水面、L1 衛浴及 L2 更衣淋浴；校園景觀、街具與大範圍環境留到第二階段。
- 桌機以 high 顯示完整細節；手機可自動降為 medium／low，操作與空間辨識優先於全部小細節。
- L1 八座 WC 採坐式、蹲式各半；分間內的精確順序由 DEC-123 管理。

## 2. 範圍

### 建築外觀

- 清水模模板分割、低對比螺桿孔與轉角收邊。
- 安全玻璃底座、框料、膠條與轉接縫。
- 天溝、落水管、屋頂轉接泛水與封膠層次。

### 泳池與濕區

- 溢流格柵、池底水道線、池畔線性排水。
- 天花照明、通風口、少量濕痕與高階水下焦散。
- 水面 normal 與焦散只在允許動畫及 high 時更新。

### L1 衛浴

- 坐式 WC：盆體、底座、座圈、水箱、沖水按鈕、供水與鉸鏈。
- 蹲式 WC：蹲盆、開口、防滑腳踏、沖水管與沖水頭。
- 洗手槽：具盆深、緣口、基座、龍頭、鏡面、落水與排水管。
- 小便斗：具壁掛盆體、沖水、感應與排水細節。
- 隔間：門片、離地腳座、鎖件／鉸鏈、磁磚格線、地排、垃圾桶與標示。

### L2 室內

- 30 組淋浴頭、管線與排水；high 增加閥件。
- 置物櫃門縫與把手、室內磁磚、照明、通風與少量濕痕。

## 3. 資料與專業界線

- `project-model.json` 是 WC 類型、中心與朝向的唯一來源；不由 mesh 名稱或房間性別猜測器具。
- 八座 WC 必須正好 4 坐／4 蹲，fixture center 位於隔間內，朝向只接受四個 SITE 軸向列舉值。
- 擬真附件不加入 collision，不改 door opening、通行、player、water simulation、scene selection 或 solar input。
- 材質、器具、排水、防水、無障礙、法定數量、消防、結構與機電皆是概念代理；`professionalApprovals` 維持 false，OPEN-008／014／016／018 繼續有效。

## 4. 畫質分級

| 層級 | 顯示內容 | 主要裝置 |
| --- | --- | --- |
| essential | 器具與構件必要輪廓、基本水面、核心照明辨識 | low／軟體繪圖／低階手機 |
| reduced | 水箱、龍頭、鏡面、腳踏、主要接縫、排水與室內層次 | medium／一般手機與平板 |
| full | 小五金、管線、螺桿孔、膠條、焦散、濕痕與完整陰影 | high／桌機 |

所有可切換節點必須同時具有 `visualOnly=true`、`collisionExcluded=true` 與 `minimumVisualDetail`。切換只准單調隱藏較高層級；dispose 後回到 essential，不可殘留動畫或陰影。

## 5. 驗收條件

- 來源資料、generated viewer、validator 與測試一致為 schema 1.4.0、8 WC、4 坐／4 蹲及 DEC-123 順序。
- 桌機 high 可辨識新增外殼、泳池、衛浴與 L2 細節；手機 low 不載入／顯示 full 細節且無水平溢出。
- high／medium／low 切換不改 canonical bounds、selectables、collision source、player／water state 或 movement mode。
- reduced motion、medium 與 low 不執行 high-only 焦散動畫；low 關閉細節陰影。
- 文件、reference validation、全套測試、typecheck、production build、desktop／mobile E2E、視覺快照與 diff 檢查通過。
