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

目前輸出尚未完全符合本節，由 [TASK-002](../07_ACTIVE_WORK.md) 管理；本契約仍是唯一目標答案。

## 驗收

- 六張 sheet 與必要 entity 引用存在。
- 真北只使用模型 transform。
- `l2ExtensionLength` 修改時，L2、樓梯及屋頂相關圖面一起更新。
- deferred 幾何具有可辨識狀態，不顯示偽精確 fallback。
- `REF-101` 的戶外前場、三個開口、兩套廁所雙入口及乾式通道具有模型、renderer 與文字測試。
- build 產生 `dist/reference/index.html`，桌面與手機 smoke 通過。
