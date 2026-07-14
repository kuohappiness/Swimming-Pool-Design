# 空間參照圖集契約

- 類型：output-contract
- 狀態：active
- Owner：[05｜模型契約](../05_MODEL_CONTRACT.md)

## 必要輸出

`reference/index.html` 必須由 `model/project-model.json` 與共用 geometry helper 產生：

- `REF-001` 基地與方位圖。
- `REF-101` L1 平面參照圖。
- `REF-201` L2 平面參照圖。
- `REF-301` 屋頂參照圖。
- `REF-401` A–A 縱剖面參照圖。
- `REF-501` 3D 軸測參照圖。

每張圖顯示 modelVersion、revision、單位、北向與概念用途；entity／cubicle ID 可點選且不依賴 hover；320 px 以上手機可閱讀與操作。

## L1 表達

`REF-101` 的目標狀態依 `DEC-028`：

1. 操場側標示為戶外空間，不出現室內「共用前室」。
2. 泳池大廳、男廁、女廁各有面向戶外的獨立開口。
3. 男女廁各有戶外前門與泳池側後門，前後門錯位。
4. 泳池大廳與兩樘後門之間有連續可辨識的乾式通道幾何。
5. `ST-01` 不阻斷戶外開口、前後門或乾式通道。
6. `EN-01`／`O-SITE-01` 共點門檻精確維持本地原點 `[27, 0, 0]`；`RTE-L1-ARRIVAL-01` 由該門檻出發、完整留在戶外前場 bounds 內，並在樓梯開始前偏向 `ST-01` 外側。路徑 bounds 與樓梯 bounds 之間須有大於 `0.002 m` 的淨空，且路徑在 renderer 疊放順序中不被樓梯遮住。
7. 每個 TASK-002 entity 在 SVG 中只有一個可鍵盤聚焦的 `<g data-entity>` 互動目標；該 group 具有 `tabindex="0"`、`role="button"` 與以 entity ID 開頭的 `aria-label`，其子圖形不重複宣告 `data-entity`。

`Z-L1-ENTRY-01` 保留為跨輸出的穩定 ID，但已遷移為 `outdoor-forecourt`。到達路徑、泳池入口、男女廁前門、男女廁後門與乾式通道分別使用 `RTE-L1-ARRIVAL-01`、`OP-L1-PH-01`、`DR-L1-WC-M-FRONT-01`、`DR-L1-WC-F-FRONT-01`、`DR-L1-WC-M-REAR-01`、`DR-L1-WC-F-REAR-01`、`PSG-L1-DRY-01`。`OPEN-008` 尚未關閉，因此圖面位置只表達拓撲、正淨空與錯位關係，不標示精確路徑寬、門寬、通道寬或前場深度。

目前輸出尚未完全符合本節，由 [TASK-002](../07_ACTIVE_WORK.md) 管理；本契約仍是唯一目標答案。

## 驗收

- 六張 sheet 與必要 entity 引用存在。
- 真北只使用模型 transform。
- `l2ExtensionLength` 修改時，L2、樓梯及屋頂相關圖面一起更新。
- deferred 幾何具有可辨識狀態，不顯示偽精確 fallback。
- `REF-101` 的戶外前場、三個開口、兩套廁所雙入口及乾式通道具有模型、renderer 與文字測試。
- validator 鎖定 `[27, 0, 0]` 本地原點、門檻連接、路徑位於戶外前場內、路徑與樓梯的大於容差淨空，以及 TASK-002 entity registry contract；registry 的實際 `sourceIds` 必須是 expected sources 的唯一且雙向相等集合，順序可忽略但不得增加或重複。
- 實際 renderer 測試逐一確認 TASK-002 entity 只有一個可聚焦、可啟用且帶有可讀標籤的 SVG group。
- build 產生 `dist/reference/index.html`，桌面與手機 smoke 通過。
