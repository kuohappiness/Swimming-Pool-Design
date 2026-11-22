# 減少多個 PR 同時進行時的合併衝突

狀態：已合併｜完成：roadmap 與決策表在本機合併時自動保留兩邊新加的列，網站文字快照改為只在發版 PR 重產，Dependabot 一次只開一個 PR｜等誰：—

- 日期：2026-11-22
- 類型：chore
- 任務：TASK-163
- 決定：DEC-200
- 核准：使用者 2026-11-22 請協調者監督、減少合併衝突；協調者同日交辦並同意本方案

來自：協調者 2026-11-22 交辦（減少合併衝突）

## 目的

六個討論串同時開 PR，幾乎每個都會在 `docs/roadmap.md` 的〈已完成〉表頂端加一列、在 `docs/decisions.md` 的決策表尾端加一列，位置相同就衝突；改到網站文字的 PR 又各自重產整份 `content/website-copy.md`（含擷取時間與雜湊），兩個這樣的 PR 必定衝突。

## 範圍

| 項目 | 做法 |
| --- | --- |
| roadmap 與決策表 | `.gitattributes` 對兩檔設 `merge=union`：本機 `git merge` 時兩邊新加的列都保留 |
| union 的風險 | 兩邊改了同一列時 union 會留下兩個版本、不報衝突；`check:docs` 本來就會擋重複的 DEC 與 roadmap 列（一份入口只能一列、狀態要和入口一致），合併後跑它就會指出要刪哪一列 |
| GitHub 網頁端 | 不套用 `.gitattributes` 的合併設定（GitHub 社群討論 #9288 仍是功能請求），網頁上可能照樣顯示衝突。工作流程第 6 節改寫：接 main 一律在本機 `git merge origin/main` 再推，GitHub 合併已接上 main 的分支時不會再衝突 |
| 網站文字快照 | 修訂 DEC-137：快照一個版本一份，只在發版 PR（改了 `package.json` 版號）重產。`npm run build:copy` 在快照已是目前版本時拒絕執行（`-- --force` 例外）；`check:docs` 檢查快照版本與套件版本一致，發版 PR 忘了重產會被擋 |
| Dependabot | npm 與 GitHub Actions 都改成一次只開一個更新 PR，因為它會動 `package.json` 與 lock 檔 |

不做：

- 把 roadmap 或決策表拆成每列一檔：要改寫 `check:docs` 與所有連結，代價大於效益。
- 把網站文字快照移出 repo、改由 CI 產生：會失去版本之間的比對紀錄，部署流程也要多一個瀏覽器步驟。
- `docs/backlog.md`：項目下面有「→」續行，union 可能把續行接錯項目，先不設。

## 驗收

2026-11-22，在暫存複本實測：

- 兩個分支在〈已完成〉表頂端與決策表尾端各加一列，`git merge` 自動完成，兩邊的列都在。
- 兩個分支把同一列（TASK-150 的狀態板列、DEC-148）改成不同內容，`git merge` 不報衝突、留下兩個版本；`check:docs` 報出 `duplicate DEC declaration DEC-148`、`duplicate TASK declaration TASK-150` 與「一份入口只寫一列」。
- 把 `package.json` 暫改成 0.10.1，`check:docs` 報出快照版本不一致；版本相同時 `npm run build:copy` 拒絕執行並提示 `--force`。
