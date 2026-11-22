# 3D Viewer 本地視覺資產

本目錄只存放 0.8.0 enhanced rendering 可選用的本地視覺資產。它不是建築材料、品牌、施工性能或 canonical geometry 的 owner；正式資產清單、hash、byte size、品質階級與 loading priority 只寫在本目錄的 `asset-manifest.json`；`rendering/enhanced/asset-manifest.ts` 讀它並檢查內容。

## 規則

- runtime 不得從 CDN、遠端 HDRI、遠端材質或未登錄 URL 載入資產。
- 所有檔案必須有可追溯 source、author、license、SHA-256 與 byte size。
- visual assets 不得進入 walkthrough collision，也不得改寫 `model/project-model.json`。
- 缺少 optional 資產時回復 baseline rendering；必要資產缺失則停用 enhanced mode 並顯示診斷。
- 入庫上限由 `npm run check:assets` 檢查（DEC-190）：整個資料夾 70 MB、單張貼圖 4 MB、單一模型 2 MB；只收 `.ktx2`、`.glb`、`.ogg`、`.mp3`、`.json`、`.md` 與既有的 `.svg` 代理圖樣；資料夾與檔名用英文小寫加連字號。上限數字只寫在 `core/viewer/render-budgets.mjs`。
- texture repeat 以公尺尺度設定；本目錄的圖樣只是概念視覺代理，不宣稱實際材料樣板或性能。

## 壓縮貼圖（KTX2）

寫實版的貼圖一律是 KTX2 壓縮格式（DEC-190）：在顯示卡記憶體裡維持壓縮，同樣解析度只占未壓縮的四分之一到八分之一。

- 自製貼圖由 `tools/build/textures/` 的程式產生像素，`npm run build:textures` 轉檔並把雜湊、大小與轉檔設定寫回 `asset-manifest.json`。`.ktx2` 與清單一起提交；CI 不重新轉檔，只檢查「產生程式或設定改了卻沒重轉」。
- 授權以 `SPDX-License-Identifier` 寫進 `.ktx2` 檔內的中繼資料。
- 網站用 `rendering/textures/ktx2-texture-source.ts` 載入，轉碼器是 three.js 內附的 Basis 轉碼器，和網站一起打包、同源提供。
- `materials/water/ripple-normal.ktx2`：水面細波紋的無縫法線貼圖（512 × 512），供階段二的水面著色器使用，目前尚未接上畫面。
- `materials/water/caustics.ktx2`：池底焦散的明暗圖樣（512 × 512）。讓陽光垂直穿過上面那片波紋、折射後落在池底，統計每一格收到的光量而成；灰階 255 代表平均照度的 4 倍。

## 目前測試資產

- `materials/concrete-*`：專案自製的 CC0 清水模 base-color／normal／roughness 代理。
- `materials/pool-tile-*`、`materials/deck-*`：專案自製的 CC0 池磚與池畔 base-color／normal 代理。
- `materials/water-normal.svg`：專案自製的 CC0 可降級水面 normal 代理。
- `environments/courtyard-sky.svg`：專案自製的 CC0 等距長方形程序天空參照；TASK-062 可選擇轉為 PMREM environment，缺失時仍須回復 baseline。TASK-152 起，倒影與間接光改由程式算出來的天空產生（`rendering/lighting/`，沒有檔案資產），這張圖只在第一份光照狀態算出來之前當作備援。
- `models/`：留給 TASK-063 的輕量、已登錄尺度參照資產。

資產均為概念即時視覺化用途；清水模模板、玻璃、鋼材、防滑、防水、耐氯胺、鏡面與光電實際規格仍由既有 OPEN／專業驗證管理。
