# 縱剖面概念關係修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- 日期：2026-07-15
- 類型：implementation-plan
- 狀態：in_progress
- 任務：TASK-006
- 目標版本：0.2.0
- 依據：[縱剖面概念關係修正設計](2026-07-15-longitudinal-section-concept-correction-design.md)

**Goal:** 讓 `REF-401` 正確表達較低的 10° 玻璃屋頂、L1 入口戶外區及 `EXT-L2-01` 面池端外傾鏡牆，同時保留所有未定標高、寬度與角度的 deferred 狀態。

**Architecture:** 來源及設計答案先進 owner 文件，再把已確認的鏡牆語意與來源加入單一模型。`REF-401` 只使用明確命名為 display-only 的 SVG 顯示偏移表達概念關係；正式模型不新增屋頂標高、入口寬度或鏡牆傾角。

**Tech Stack:** Markdown owner 文件、JSON 單一模型、Node.js ESM validator／`node:test`、TypeScript SVG renderer、CSS、Vite。

## Global Constraints

- `TASK-002` 必須先為 `done`；`TASK-006` 在此之前保持 `queued`。
- 原始標註圖必須逐 byte 保留為 `SRC-CONCEPT-009`，SHA-256 必須是 `3CD710CEC62E32F2209EFA731FCF0EBFDA38A978BD0925A504481EE563175034`。
- `RF-GL-01` 維持 10°；`roof.lowElevation` 與 `roof.highElevation` 繼續為 `OPEN-010` 的 deferred measure。
- `F-MIR-01` 的存在、位置語意及鏡面用途為 confirmed；正式外傾角、牆高及性能繼續由 `OPEN-011` 管理。
- `Z-L1-ENTRY-01` 是入口戶外區；精確幾何繼續由 `OPEN-008` 管理。
- 不得把太陽研究的 `9.5°` 或 `+4.5°` 操作預設寫入正式模型或 `REF-401`。
- 不修改太陽反射演算法，不重畫 `REF-101`、`REF-201`、`REF-301` 或 `REF-501`。
- Windows 指令使用 `npm.cmd`，避免 PowerShell execution-policy 阻擋 `npm.ps1`。

---

## File Map

| 檔案 | 責任 |
| --- | --- |
| `source-materials/concepts/SRC-CONCEPT-009_longitudinal-section-correction-annotated.png` | 不可變的使用者標註來源 |
| `docs/02_SITE_AND_SOURCES.md` | 來源身份、觀察與限制 |
| `docs/03_DESIGN_BASIS.md` | 當前有效空間意圖 |
| `docs/04_DECISIONS_AND_OPEN_ITEMS.md` | `DEC-030` 與仍開放的 `OPEN-008/010/011` |
| `docs/05_MODEL_CONTRACT.md` | `F-MIR-01`、confirmed 語意與 deferred 幾何不變條件 |
| `docs/contracts/reference-atlas.md` | `REF-401` 個別輸出行為 |
| `docs/07_ACTIVE_WORK.md` | `TASK-006` 狀態、依賴、規格與完成條件 |
| `model/project-model.json` | `SRC-CONCEPT-009`、`F-MIR-01` 與 `REF-401` references |
| `scripts/reference-validation.mjs` | 模型與 sheet reference 的拒絕規則 |
| `tests/reference-model.test.mjs` | 模型、renderer token 與 deferred 防回歸測試 |
| `reference/src/sheets.ts` | `REF-401` SVG 幾何與文字 |
| `reference/src/styles.css` | 入口戶外區、鏡牆及概念狀態的視覺語彙 |

---

### Task 1: 啟動任務、保存來源並同步 owner 文件

**Files:**
- Create: `source-materials/concepts/SRC-CONCEPT-009_longitudinal-section-correction-annotated.png`
- Modify: `docs/02_SITE_AND_SOURCES.md`
- Modify: `docs/03_DESIGN_BASIS.md`
- Modify: `docs/04_DECISIONS_AND_OPEN_ITEMS.md`
- Modify: `docs/05_MODEL_CONTRACT.md`
- Modify: `docs/contracts/reference-atlas.md`
- Modify: `docs/07_ACTIVE_WORK.md`
- Modify: `docs/specs/2026-07-15-longitudinal-section-concept-correction-design.md`
- Modify: `docs/specs/2026-07-15-longitudinal-section-concept-correction-implementation-plan.md`

**Interfaces:**
- Consumes: `TASK-002=done`、核准設計規格、暫存來源 `C:\Users\kuo\AppData\Local\Temp\codex-clipboard-9068f7eb-8222-437e-ad0d-88228f91d57c.png`。
- Produces: `SRC-CONCEPT-009` 原始檔、`DEC-030`、owner 契約文字及唯一 `in_progress` 的 `TASK-006`。

- [ ] **Step 1: 驗證依賴與工作樹**

Run:

```powershell
rg -n '^\| TASK-002 .*\| done \|' docs/07_ACTIVE_WORK.md
git status --short --branch
```

Expected: 第一個命令只命中 `TASK-002` 的 `done` 列；沒有其他 `in_progress` 任務。若沒有命中，停止本計畫並先執行 `docs/specs/2026-07-14-l1-outdoor-entry-correction-implementation-plan.md`。

- [ ] **Step 2: 將 TASK 與兩份規格切為 in_progress**

Use `apply_patch` to make these exact metadata/state changes:

```diff
-| TASK-006 | REF-401 屋頂、入口戶外區與鏡牆概念修正 | ready |
+| TASK-006 | REF-401 屋頂、入口戶外區與鏡牆概念修正 | in_progress |
```

```diff
-- 狀態：approved
+- 狀態：in_progress
```

Apply the metadata change to both TASK-006 specs. Run `npm.cmd run check:docs`; expected: PASS and exactly one `in_progress` task.

- [ ] **Step 3: 保存來源原始 bytes 並驗證身份**

Run:

```powershell
$source = 'C:\Users\kuo\AppData\Local\Temp\codex-clipboard-9068f7eb-8222-437e-ad0d-88228f91d57c.png'
$destination = 'source-materials\concepts\SRC-CONCEPT-009_longitudinal-section-correction-annotated.png'
Copy-Item -LiteralPath $source -Destination $destination
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash
$item = Get-Item -LiteralPath $destination
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile((Resolve-Path $destination))
[pscustomobject]@{ Bytes = $item.Length; Width = $image.Width; Height = $image.Height; Sha256 = $hash }
$image.Dispose()
```

Expected: `Bytes=312250`、`Width=2216`、`Height=1130`、SHA-256 為 `3CD710CEC62E32F2209EFA731FCF0EBFDA38A978BD0925A504481EE563175034`。任何值不同都必須刪除錯誤副本並停止，不得重新壓縮修補。

- [ ] **Step 4: 寫入來源、決策與契約 owner**

Use `apply_patch` to add the following exact source row to `docs/02_SITE_AND_SOURCES.md`:

```markdown
| SRC-CONCEPT-009 | `source-materials/concepts/SRC-CONCEPT-009_longitudinal-section-correction-annotated.png` | 使用者在 `REF-401` 圖面以紅色斜線標示屋頂概念位置、以綠框圈出入口戶外區；隨附文字另指出 `EXT-L2-01` 外牆為鏡面反射牆並應有一些傾斜 | 2216 × 1130 | `3CD710CEC62E32F2209EFA731FCF0EBFDA38A978BD0925A504481EE563175034` |
```

Add this observation/interpretation paragraph after the source table:

```markdown
`SRC-CONCEPT-009` 圖面可直接觀察到紅色斜線位於既有屋頂下方，以及綠框圈出 L1 右端灰色區域。使用者隨附文字指出 `EXT-L2-01` 外牆為鏡面反射牆並應有一些傾斜。設計上解讀為：`REF-401` 屋頂高端應靠近 L2 樓板、綠框是入口戶外區、`EXT-L2-01` 低 X 面池端牆是向泳池側外傾的鏡面牆；圖面與隨附文字都不提供正式標高、入口寬度或外傾角。
```

Add this decision row to the confirmed table in `docs/04_DECISIONS_AND_OPEN_ITEMS.md`:

```markdown
| DEC-030 | `REF-401` 的 10° 玻璃屋頂改為高端靠近 L2 樓板的概念位置；L1 右端綠框為入口戶外區；`EXT-L2-01` 低 X 面池端為向泳池側外傾的鏡面反射牆 | 依 `SRC-CONCEPT-009` 修正剖面關係；正式標高、入口尺寸、鏡牆角度與性能分別保留於 `OPEN-010`、`OPEN-008`、`OPEN-011` | confirmed |
```

Add these exact bullets to their owners:

```markdown
# docs/03_DESIGN_BASIS.md §3
- `REF-401` 的玻璃屋頂以高端靠近 L2 樓板的概念關係顯示；10° 維持 confirmed，正式高低標高仍為 deferred。
- `EXT-L2-01` 低 X 面池端牆是鏡面反射牆，牆頂向泳池側外傾；正式角度、牆高與性能仍未定。

# docs/05_MODEL_CONTRACT.md §5
- `F-MIR-01` 是 `EXT-L2-01` 低 X 面池端鏡面反射牆；存在、用途與外傾方向為 confirmed，正式角度、牆高與性能不得在 `OPEN-011` 關閉前寫入模型。
- `REF-401` 可使用明確標示為 display-only 的 SVG 偏移表達屋頂、入口戶外區與鏡牆概念關係；consumer 不得把偏移換算為設計尺寸。

# docs/contracts/reference-atlas.md 新增「REF-401 縱剖面」小節
- 屋頂維持 10° 並下移至高端靠近 L2 樓板，附 `OPEN-010` 概念位置標示。
- `Z-L1-ENTRY-01` 顯示為無灰色實體填色的入口戶外區，精確寬度不標尺寸。
- `F-MIR-01` 顯示於 `EXT-L2-01` 低 X 面池端，牆頂向泳池側外傾並使用鏡面視覺語彙；不得顯示正式角度。
```

- [ ] **Step 5: 驗證文件並提交 Task 1**

Run:

```powershell
npm.cmd run check:docs
git diff --check
git status --short
```

Expected: documentation PASS；只有本 Task 列出的文件與 `SRC-CONCEPT-009` 有變更。

Commit:

```powershell
git add -- source-materials/concepts/SRC-CONCEPT-009_longitudinal-section-correction-annotated.png docs/02_SITE_AND_SOURCES.md docs/03_DESIGN_BASIS.md docs/04_DECISIONS_AND_OPEN_ITEMS.md docs/05_MODEL_CONTRACT.md docs/contracts/reference-atlas.md docs/07_ACTIVE_WORK.md docs/specs/2026-07-15-longitudinal-section-concept-correction-design.md docs/specs/2026-07-15-longitudinal-section-concept-correction-implementation-plan.md
git commit -m "docs: register REF-401 concept correction"
```

---

### Task 2: 以測試鎖定模型與 validator 契約

**Files:**
- Modify: `tests/reference-model.test.mjs`
- Modify: `model/project-model.json`
- Modify: `scripts/reference-validation.mjs`

**Interfaces:**
- Consumes: `SRC-CONCEPT-009`、`DEC-030`、現有 `Entity`／`Sheet` schema。
- Produces: confirmed entity `F-MIR-01`、`REF-401` required references、來源雜湊驗證；不產生任何 formal mirror angle。

- [ ] **Step 1: 寫入模型契約的 failing tests**

Append these tests to `tests/reference-model.test.mjs`:

```js
test('registers the confirmed pool-facing mirror facade without a formal angle', () => {
  const model = clone();
  const mirror = model.entities.find((entity) => entity.id === 'F-MIR-01');
  assert.deepEqual(mirror, {
    id: 'F-MIR-01',
    name: 'EXT-L2-01 面池端鏡面反射牆',
    type: 'mirror-facade',
    level: 'L2',
    grid: 'D/1-4',
    status: 'confirmed',
    sourceIds: ['SRC-CONCEPT-009'],
  });
  assert.equal(Object.hasOwn(model.geometry, 'mirrorFacade'), false);
  assert.equal(model.geometry.roof.highElevation.value, null);
  assert.equal(model.geometry.roof.lowElevation.value, null);
});

test('requires REF-401 to reference the outdoor entry and mirror facade', () => {
  const model = clone();
  const section = model.sheets.find((sheet) => sheet.id === 'REF-401');
  assert.ok(section.referencedEntityIds.includes('Z-L1-ENTRY-01'));
  assert.ok(section.referencedEntityIds.includes('F-MIR-01'));
  section.referencedEntityIds = section.referencedEntityIds.filter((id) => id !== 'F-MIR-01');
  assert.match(validateModel(model).join('\n'), /REF-401 must reference F-MIR-01/);
});

test('registers SRC-CONCEPT-009 with the approved immutable identity', () => {
  const source = clone().sources.find((item) => item.id === 'SRC-CONCEPT-009');
  assert.deepEqual(source, {
    id: 'SRC-CONCEPT-009',
    path: 'source-materials/concepts/SRC-CONCEPT-009_longitudinal-section-correction-annotated.png',
    kind: 'annotated-concept',
    pixelSize: [2216, 1130],
    sha256: '3CD710CEC62E32F2209EFA731FCF0EBFDA38A978BD0925A504481EE563175034',
  });
});
```

- [ ] **Step 2: 執行測試並確認預期失敗**

Run:

```powershell
node --test --test-name-pattern="mirror facade|REF-401|SRC-CONCEPT-009" tests/reference-model.test.mjs
```

Expected: FAIL because `F-MIR-01` and `SRC-CONCEPT-009` are not yet in the model and `REF-401` does not reference them.

- [ ] **Step 3: 更新單一模型**

Use `apply_patch` to add this source object to `model.sources`:

```json
{ "id": "SRC-CONCEPT-009", "path": "source-materials/concepts/SRC-CONCEPT-009_longitudinal-section-correction-annotated.png", "kind": "annotated-concept", "pixelSize": [2216, 1130], "sha256": "3CD710CEC62E32F2209EFA731FCF0EBFDA38A978BD0925A504481EE563175034" }
```

Add this entity to `model.entities`:

```json
{ "id": "F-MIR-01", "name": "EXT-L2-01 面池端鏡面反射牆", "type": "mirror-facade", "level": "L2", "grid": "D/1-4", "status": "confirmed", "sourceIds": ["SRC-CONCEPT-009"] }
```

Ensure the existing entry entity has this post-`TASK-002` name:

```json
{ "id": "Z-L1-ENTRY-01", "name": "操場側入口戶外區", "type": "zone", "level": "L1", "grid": "E-F/1", "status": "deferred", "sourceIds": ["SRC-CONCEPT-003", "SRC-CONCEPT-005", "SRC-CONCEPT-008", "SRC-CONCEPT-009"] }
```

Replace the `REF-401` sheet definition with:

```json
{ "id": "REF-401", "title": "A–A 縱剖面參照圖", "level": "SECTION", "referencedEntityIds": ["BLDG-01", "POOL-01", "Z-L1-ENTRY-01", "EXT-L2-01", "F-MIR-01", "ST-01", "RF-GL-01", "J-RF-L2-01"] }
```

Do not add `mirrorFacade`, `leanAngle`, `displayRoofElevation`, `9.5` or `4.5` to `geometry`.

- [ ] **Step 4: 讓 validator 拒絕遺失的 entity／reference**

Update the exact validator declarations to:

```js
const requiredEntityIds = ['Z-L1-ENTRY-01', 'EXT-L2-01', 'F-MIR-01', 'J-RF-L2-01'];
```

```js
const requiredSheetReferences = {
  'REF-101': ['Z-L1-ENTRY-01'],
  'REF-201': ['EXT-L2-01'],
  'REF-301': ['EXT-L2-01', 'J-RF-L2-01'],
  'REF-401': ['Z-L1-ENTRY-01', 'EXT-L2-01', 'F-MIR-01', 'J-RF-L2-01'],
  'REF-501': ['EXT-L2-01', 'J-RF-L2-01'],
};
```

After the `requiredEntityIds` check, add:

```js
const mirrorFacade = entities.find((entity) => entity.id === 'F-MIR-01');
if (mirrorFacade?.type !== 'mirror-facade'
  || mirrorFacade?.level !== 'L2'
  || mirrorFacade?.status !== 'confirmed'
  || !mirrorFacade?.sourceIds?.includes('SRC-CONCEPT-009')) {
  errors.push('F-MIR-01 must remain the confirmed L2 mirror facade sourced by SRC-CONCEPT-009');
}
```

- [ ] **Step 5: 驗證測試轉綠並提交 Task 2**

Run:

```powershell
node --test tests/reference-model.test.mjs
npm.cmd run validate:reference
git diff --check
```

Expected: all reference-model tests PASS；validator reports 18 entities, 6 sheets and 9 sources unless `TASK-002` legitimately added more entities/sources, in which case counts may be higher but errors must be zero.

Commit:

```powershell
git add -- tests/reference-model.test.mjs model/project-model.json scripts/reference-validation.mjs
git commit -m "feat: register REF-401 mirror facade"
```

---

### Task 3: 以 display-only 幾何重畫 REF-401

**Files:**
- Modify: `tests/reference-model.test.mjs`
- Modify: `reference/src/sheets.ts`
- Modify: `reference/src/styles.css`

**Interfaces:**
- Consumes: `deriveReferenceGeometry(model)`、entity IDs `Z-L1-ENTRY-01`／`F-MIR-01`、10° roof pitch。
- Produces: SVG classes `entry-outdoor-section`、`mirror-facade-section`、`section-concept-note` 及可點選的 `data-entity` elements。

- [ ] **Step 1: 寫入 renderer 的 failing test**

Append this test to `tests/reference-model.test.mjs`:

```js
test('REF-401 renders the approved conceptual section language', async () => {
  const [renderer, styles] = await Promise.all([
    readFile(resolve(repoRoot, 'reference/src/sheets.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/src/styles.css'), 'utf8'),
  ]);
  for (const token of [
    'entry-outdoor-section',
    'mirror-facade-section',
    'section-concept-note',
    'data-entity="Z-L1-ENTRY-01"',
    'data-entity="F-MIR-01"',
    '位置示意；標高／交界待 OPEN-010',
    '外傾示意；角度待 OPEN-011',
  ]) {
    assert.match(renderer, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(styles, /\.entry-outdoor-section/);
  assert.match(styles, /\.mirror-facade-section/);
  assert.doesNotMatch(renderer, /9\.5°|\+4\.5°/);
});
```

- [ ] **Step 2: 執行測試並確認預期失敗**

Run:

```powershell
node --test --test-name-pattern="conceptual section language" tests/reference-model.test.mjs
```

Expected: FAIL because the new classes and labels do not exist.

- [ ] **Step 3: 建立明確的 display-only 剖面座標**

In `renderSection`, replace the existing `roofLowY`／`roofHighY`／`volumeTopY` declarations with:

```ts
  // SVG-only concept offsets. They are not architectural elevations or angles.
  const l2FloorY = sz(stair.totalRise);
  const roofHighY = l2FloorY - 16;
  const roofLowY = roofHighY
    + derived.roofPlanRun * 27 * Math.tan(model.geometry.roof.pitch.value * Math.PI / 180);
  const volumeTopY = 236;
  const mirrorTopX = sx(derived.l2StartX) - 18;
  const entryOutdoorWidth = 128;
  const entryOutdoorX = sx(derived.l2EndX) - entryOutdoorWidth;
```

These numbers are viewBox pixels only. Do not move them to `project-model.json` or report them as metres/degrees.

- [ ] **Step 4: Replace the REF-401 volume/roof block with semantic SVG**

Replace the markup from the existing `level-line` through the second deferred label with this exact block:

```ts
    <line class="level-line" x1="${sx(derived.l2StartX)}" y1="${l2FloorY}" x2="${sx(derived.l2EndX)}" y2="${l2FloorY}"/>
    <rect class="service-section l1-core" x="${sx(derived.l1ServiceStartX)}" y="${l2FloorY}" width="${model.geometry.building.serviceCoreLength.value * 27}" height="${groundY - l2FloorY}" data-entity="CORE-01"/>
    <rect class="entry-outdoor-section" x="${entryOutdoorX}" y="${l2FloorY}" width="${entryOutdoorWidth}" height="${groundY - l2FloorY}" data-entity="Z-L1-ENTRY-01"/>
    <text class="entry-outdoor-label" x="${entryOutdoorX + entryOutdoorWidth / 2}" y="${sz(1.35)}" text-anchor="middle">入口戶外區</text>
    <polygon class="l2-section-volume" points="${mirrorTopX},${volumeTopY} ${sx(derived.l2EndX)},${volumeTopY} ${sx(derived.l2EndX)},${l2FloorY} ${sx(derived.l2StartX)},${l2FloorY}" data-entity="EXT-L2-01"/>
    <line class="extension-boundary-plan" x1="${sx(derived.l1ServiceStartX)}" y1="${volumeTopY}" x2="${sx(derived.l1ServiceStartX)}" y2="${l2FloorY}"/>
    <rect class="open-below-extension" x="${sx(derived.l2StartX)}" y="${l2FloorY}" width="${model.geometry.building.l2ExtensionLength.value * 27}" height="${groundY - l2FloorY}"/>
    <text class="void-label" x="${sx((derived.l2StartX + derived.l1ServiceStartX) / 2)}" y="${sz(1.4)}" text-anchor="middle">L1 開放</text>
    <polygon class="glass-roof-section" points="${sx(derived.roofPlanStartX)},${roofLowY} ${sx(derived.roofPlanEndX)},${roofHighY} ${sx(derived.roofPlanEndX)},${roofHighY + 7} ${sx(derived.roofPlanStartX)},${roofLowY + 7}" data-entity="RF-GL-01"/>
    <line class="glass-wall" x1="${sx(0)}" y1="${groundY}" x2="${sx(0)}" y2="${roofLowY}"/>
    <line class="mirror-facade-section" x1="${mirrorTopX}" y1="${volumeTopY}" x2="${sx(derived.l2StartX)}" y2="${l2FloorY}" data-entity="F-MIR-01"/>
    <line class="deferred-joint" x1="${sx(derived.roofPlanEndX)}" y1="${roofHighY}" x2="${sx(derived.l2StartX)}" y2="${l2FloorY}" data-entity="J-RF-L2-01"/>
    <text class="deferred-label" x="${sx(derived.roofPlanEndX) + 12}" y="${roofHighY - 14}">J-RF-L2-01</text>
    <text class="deferred-label small section-concept-note" x="${sx(derived.roofPlanEndX) + 12}" y="${roofHighY + 2}">位置示意；標高／交界待 OPEN-010</text>
    <text class="mirror-label section-concept-note" x="${sx(derived.l2StartX) + 18}" y="${volumeTopY + 82}">外傾示意；角度待 OPEN-011</text>
```

Keep the existing stair block unchanged. Add this badge after the existing `EXT-L2-01` badge:

```ts
    ${badge('F-MIR-01', sx(derived.l2StartX) + 64, volumeTopY + 110, 'mirror')}
```

Replace the returned section note with:

```ts
    note: 'REF-401 為概念關係：玻璃屋頂維持 10° 並下移接近 L2 樓板；入口端為戶外區；F-MIR-01 向泳池側外傾。正式標高、交界與鏡牆角度仍待 OPEN-010／011。',
```

- [ ] **Step 5: Add the exact visual language**

Add these rules next to the existing section styles in `reference/src/styles.css`:

```css
.entry-outdoor-section { fill: var(--paper); stroke: #2f9c6d; stroke-width: 3; stroke-dasharray: 9 6; cursor: pointer; }
.entry-outdoor-label { fill: #287d59 !important; font-size: 13px !important; font-weight: 850; }
.mirror-facade-section { stroke: #4f91a5; stroke-width: 9; stroke-linecap: round; cursor: pointer; }
.mirror-label { fill: #397b8f !important; font-size: 10px !important; font-weight: 850; }
.section-concept-note { letter-spacing: .01em; }
.entity-badge.mirror rect { fill: #3f7e91; }
```

- [ ] **Step 6: Run focused tests and commit Task 3**

Run:

```powershell
node --test tests/reference-model.test.mjs
npm.cmd run validate:reference
npm.cmd run build
git diff --check
```

Expected: tests, validator, TypeScript/Vite build and diff check all PASS; no `9.5°` or `+4.5°` appears in `reference/src/sheets.ts`.

Commit:

```powershell
git add -- tests/reference-model.test.mjs reference/src/sheets.ts reference/src/styles.css
git commit -m "feat: correct REF-401 conceptual section"
```

---

### Task 4: 視覺驗證、任務完成與規格封存

**Files:**
- Modify: `docs/07_ACTIVE_WORK.md`
- Move: `docs/specs/2026-07-15-longitudinal-section-concept-correction-design.md` → `docs/archive/specs/2026-07-15-longitudinal-section-concept-correction-design.md`
- Move: `docs/specs/2026-07-15-longitudinal-section-concept-correction-implementation-plan.md` → `docs/archive/specs/2026-07-15-longitudinal-section-concept-correction-implementation-plan.md`

**Interfaces:**
- Consumes: passing full build and generated `REF-401`.
- Produces: visual evidence, `TASK-006=done`, completed archived specs and a clean task commit.

- [ ] **Step 1: Run the full automated gate from a clean process**

Run:

```powershell
npm.cmd run check:docs
npm.cmd run validate:reference
npm.cmd test
npm.cmd run build
git diff --check
```

Expected: all five commands exit 0. `validate:reference` verifies the new source hash; build produces `dist/reference/index.html`.

- [ ] **Step 2: Start the atlas and inspect desktop REF-401**

Run:

```powershell
$server = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev','--','--host','127.0.0.1','--port','4173') -WindowStyle Hidden -PassThru
$server.Id
```

Open `http://127.0.0.1:4173/#REF-401` with the computer-use workflow. At desktop width verify all of the following:

1. The roof is substantially lower than the previous version, keeps the 10° label, and its high end is near but not claimed equal to the L2 floor.
2. The right-hand entrance zone has paper/open fill and a green dashed boundary; no gray `CORE-01` fill is visible inside it.
3. `F-MIR-01` is the low-X face of `EXT-L2-01`; its top is left of its bottom, so it outward-leans toward the pool.
4. `OPEN-010` and `OPEN-011` labels are readable and do not overlap `ST-01`, badges or dimensions.
5. Clicking the mirror wall shows `F-MIR-01`, status「已確認」and source `SRC-CONCEPT-009` in the detail panel.

Expected: all five visual checks pass. Any mismatch remains a defect; do not mark the task done.

- [ ] **Step 3: Inspect the mobile layout**

Set the browser viewport to 390 × 844 and reload `http://127.0.0.1:4173/#REF-401`. Verify horizontal scrolling still exposes the entire drawing, labels remain inside the 1200 × 740 SVG, and selecting `F-MIR-01` scrolls to a readable detail card.

Stop the server:

```powershell
Stop-Process -Id $server.Id
```

Expected: mobile smoke passes and the Vite process stops.

- [ ] **Step 4: Mark done and archive both specs**

Use `apply_patch` to change both spec headers to:

```markdown
- 狀態：completed
- 完成日期：2026-07-15
```

Use `apply_patch` `Move to:` operations to relocate both files to `docs/archive/specs/`. Update the `TASK-006` owner cell to the two archive paths, change state from `in_progress` to `done`, and leave its completion condition unchanged. Do not remove `TASK-006` from `TASK-004` or `TASK-005` dependencies.

- [ ] **Step 5: Re-run lifecycle checks and commit completion**

Run:

```powershell
npm.cmd run check:docs
git diff --check
git status --short
```

Expected: documentation reports two additional archived specs and no active orphan; worktree changes are limited to lifecycle files.

Commit:

```powershell
git add -- docs/07_ACTIVE_WORK.md docs/specs docs/archive/specs
git commit -m "docs: complete TASK-006"
```

Final evidence:

```powershell
git status --short --branch
git log -4 --oneline
```

Expected: clean worktree; the four TASK-006 commits appear in order: source/owners, model, renderer, completion.
