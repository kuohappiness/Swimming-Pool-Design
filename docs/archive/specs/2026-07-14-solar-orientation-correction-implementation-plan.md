# 太陽研究方位修正實作計畫

- 日期：2026-07-14
- 類型：implementation-plan
- 狀態：completed
- 完成日期：2026-07-15
- 任務：TASK-001
- 目標版本：0.2.0
- 依據：`DEC-022`、`DEC-029`、[太陽研究契約](../../contracts/solar-study.md)

## 目標

修正太陽研究平面相對 `REF-001` 首尾顛倒的 180° 錯誤。固定 1F、建築外框與 2F 基準量體都使用模型本地 +X 307° transform；面池反方向 127° 只用於鏡牆法線、反射目標及命中判讀。

## 修改範圍

- `reference/solar-study/main.ts` 與必要的共用 geometry／solar helper。
- `tests/solar-reflection.test.mjs`，必要時增加 atlas／solar 方位整合測試。
- 與方位說明相關的頁面標籤，不修改正式 L2 角度或 `OPEN-011`。

## 步驟

1. 找出固定建築平面目前使用 127° 的轉換點，先加入會重現首尾顛倒的測試。
2. 讓固定建築與 2F 基準量體讀取同一 `worldTransform`／307° 本地 +X。
3. 將 127° 限縮在面池法線、反射目標或由 307° 明確推導的反方向。
4. 驗證 `CORE-01`、2F 與服務核心端一致，泳池遠端不互換。
5. 執行模型驗證、測試、build 及桌面／手機視覺 smoke。

## 驗收

- `REF-001` 與太陽研究對核心端、泳池遠端、2F 所在端及真北的判讀一致。
- 程式沒有另一個獨立硬編碼的建築世界方位。
- 既有冬至命中、夏至避開與反射向量測試仍通過。
- `npm run validate:reference`、`npm test`、`npm run build`、`git diff --check` 通過。
