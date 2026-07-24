# 3D Viewer 本地視覺資產

本目錄只存放 0.8.0 enhanced rendering 可選用的本地視覺資產。它不是建築材料、品牌、施工性能或 canonical geometry 的 owner；正式資產清單、hash、byte size、品質階級與 loading priority 由 `rendering/enhanced/asset-manifest.ts` 管理。

## 規則

- runtime 不得從 CDN、遠端 HDRI、遠端材質或未登錄 URL 載入資產。
- 所有檔案必須有可追溯 source、author、license、SHA-256 與 byte size。
- visual assets 不得進入 walkthrough collision，也不得改寫 `model/project-model.json`。
- 缺少 optional 資產時回復 baseline rendering；必要資產缺失則停用 enhanced mode 並顯示診斷。
- texture repeat 以公尺尺度設定；本目錄的圖樣只是概念視覺代理，不宣稱實際材料樣板或性能。

## 目前測試資產

- `materials/concrete-*`：專案自製的 CC0 清水模 base-color／normal／roughness 代理。
- `materials/pool-tile-*`、`materials/deck-*`：專案自製的 CC0 池磚與池畔 base-color／normal 代理。
- `materials/water-normal.svg`：專案自製的 CC0 可降級水面 normal 代理。
- `environments/courtyard-sky.svg`：專案自製的 CC0 等距長方形程序天空參照；TASK-062 可選擇轉為 PMREM environment，缺失時仍須回復 baseline。
- `models/`：留給 TASK-063 的輕量、已登錄尺度參照資產。

資產均為概念即時視覺化用途；清水模模板、玻璃、鋼材、防滑、防水、耐氯胺、鏡面與光電實際規格仍由既有 OPEN／專業驗證管理。
