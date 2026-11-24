# 班級人數約 30 人定為已確認

狀態：待審｜下一步：PR 等使用者合併｜等誰：使用者

- 日期：2026-11-24
- 類型：docs
- 任務：TASK-123
- 核准：使用者 2026-11-24 回覆未確認的問題「一班人數約30人」；決定記為 `DEC-161`

## 目的

一堂游泳課頁把「一班多少人」列為還沒有答案的問題，`DEC-182` 也把班級人數記為假設。使用者確認一班約 30 人，與 `DEC-157` 已採用的集合區人數相同，所以設計數字不變，只把它從假設改成已確認，並讓模型檢查守住這個人數。

## 範圍

- `docs/decisions.md`：新增 `DEC-161`。
- `docs/design-basis.md`：池畔集合區那一列註明人數已確認。
- `content/swim-class.md`：〈還沒有答案的問題〉的「一班多少人」改為「換班與課表」，只留兩班交接與課表待學校確認。
- `core/validation/model-validation.mjs`、`tests/unit/core/validation/model.test.mjs`：集合區座位少於 30 時模型檢查失敗。
- `docs/roadmap.md`：TASK-122 改為已合併並移到〈已完成〉。

不動：玄關鞋櫃 60 雙（兩班交接，`DEC-157`）、3D 分頁的說明文字（讀模型，數字本來就是 30）、`content/website-copy.md` 快照（只在發版 PR 重產，`DEC-200`）。

## 驗收

- `npm run lint`、`npm run build`、`npm run test:e2e`、`git diff --check` 通過。
- 把集合區座位改成 25，模型檢查會失敗並指出 `DEC-161`。
