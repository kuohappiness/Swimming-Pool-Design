# ST-01 Stair Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch subagents unless the user explicitly authorizes delegation.

**Goal:** 將核准的 4.500 m／30 級高／28 踏面 S1 樓梯與 B 弦幕主案、A 玻璃備案同步至單一模型、幾何推導、REF-101／401／501、驗證與現行文件。

**Architecture:** `model/project-model.json` 只保存核准的基礎參數與 guard strategy；`scripts/reference-geometry.mjs` 以 `treadsPerRun × treadDepth` 推導梯段長度，並輸出級高、平台標高與 bounds。所有圖面只讀這個 derived geometry；B 弦幕以概念狀態呈現，不虛構材料、張力或結構簽證，失敗條件仍由 `OPEN-013` 導向 A 備案。

**Tech Stack:** JSON 單一模型、JavaScript geometry／validator、TypeScript SVG renderer、Node `node:test`、Vite、CSS。

- 日期：2026-07-16
- 類型：implementation-plan
- 狀態：completed
- 完成日期：2026-07-16
- 任務：`TASK-010`
- 目標版本：0.3.0
- 依據：[approved stair design](2026-07-16-stair-finalization-design.md)、`DEC-035`、`OPEN-013`
- 執行結果：模型、推導、validator、REF-101／401／501、文件與 desktop／526px smoke 已完成；使用者指示以單一 `release: v0.3.0` commit 收斂，因此下列分段 commit 保留為原計畫而未逐筆建立。320px 實機 smoke 仍是已知限制。

## Global Constraints

- 不重做或改寫 `TASK-007` 的 2F 水平 +9.5°、鏡牆外傾 +8.5° 與既有日照研究。
- `TASK-010` 依賴 `TASK-008`；屋頂 4.5°、+4.500 m、1.2 m 外挑與雨水系統由 `TASK-008` 先完成，不在本計畫另做第二套答案。
- `ST-01` 總升高 4.500 m、淨寬 1.800 m、30 級高、兩跑各 15 級高／14 踏面、級高 0.150 m、踏深 0.300 m、平台 1.800 m、每跑 4.200 m、總長 10.200 m、平台 +2.250 m、上端 X=27.000 m、下端 X=16.800 m。
- 採 S1 雙連續封閉箱型梯梁；踢面封閉但梯下完全開放；樓梯及弦幕都不得由玻璃屋頂承載。
- B 主案為最低 2.4 m 全高垂直弦幕與隱藏式集力梁；A 備案為 1.35 m 夾層安全玻璃。不得畫出完整外露的平行斜上框梁。
- `OPEN-013` 保持 open：鋼線材質、含氯腐蝕、張力、撓度、有效開口、頭部淨高、L2／梯廊集力節點與實尺寸樣段都不是本模型的施工定案。
- 版本仍維持 0.2.0，直到完整 0.3.0 release 任務統一更新；本計畫不 push、不 tag、不 release。
- 保留既有 dirty worktree，只 stage 每一 task 明列的檔案。
- 驗證只可宣稱 source regression、desktop 與 526px headless／browser smoke；320px 實機 smoke 未完成時必須明示，不得補寫為通過。

---

### Task 1: 將核准樓梯與 guard strategy 寫入單一模型 schema

**Files:**
- Modify: `tests/reference-model.test.mjs`
- Modify: `model/project-model.json`
- Modify: `reference/src/types.ts`

**Interfaces:**
- Consumes: `ProjectModel.geometry.stair` 既有 `ST-01` 物件。
- Produces: `treadsPerRun: number`、`riserClosure: 'closed'`、`supportSystem: 'S1-continuous-twin-box-stringers'` 與結構化 `guardrail`，供 geometry、validator 與 renderer 使用。

- [ ] **Step 1: 先加入會失敗的 authoritative model test**

在 `tests/reference-model.test.mjs` 的 authoritative model test 後加入：

```js
test('ST-01 stores the approved 4.5 m geometry and conditional guard strategy', () => {
  const stair = clone().geometry.stair;
  assert.equal(stair.totalRise, 4.5);
  assert.equal(stair.riserCount, 30);
  assert.equal(stair.risersPerRun, 15);
  assert.equal(stair.treadsPerRun, 14);
  assert.equal(stair.treadDepth, 0.3);
  assert.equal(stair.midLandingLength, 1.8);
  assert.equal(stair.supportSystem, 'S1-continuous-twin-box-stringers');
  assert.equal(stair.riserClosure, 'closed');
  assert.deepEqual(stair.guardrail, {
    primaryType: 'full-height-vertical-tension-screen',
    fallbackType: 'laminated-glass',
    minimumHeight: 2.4,
    fallbackHeight: 1.35,
    nominalLineSpacing: 0.04,
    collectorBeam: 'concealed-independent-l2-or-gallery-structure',
    materialStatus: 'deferred',
    openItemId: 'OPEN-013',
  });
});
```

- [ ] **Step 2: 執行 focused test 並確認舊模型失敗**

Run:

```powershell
node --test --test-name-pattern="ST-01 stores" tests/reference-model.test.mjs
```

Expected: FAIL；`totalRise` 仍為 3.6，且 `treadsPerRun`／結構化 `guardrail` 尚不存在。

- [ ] **Step 3: 以核准值取代 `model/project-model.json` 的 stair object**

```json
"stair": {
  "id": "ST-01",
  "type": "two-run-straight-with-floating-mid-landing",
  "originY": 0.5,
  "originZ": 0,
  "upperEndAlignment": "l2-split-axis",
  "width": 1.8,
  "totalRise": 4.5,
  "riserCount": 30,
  "runs": 2,
  "risersPerRun": 15,
  "treadsPerRun": 14,
  "treadDepth": 0.3,
  "midLandingLength": 1.8,
  "stringers": 2,
  "stringerDescription": "雙側連續封閉箱型鋼梯梁",
  "supportSystem": "S1-continuous-twin-box-stringers",
  "landingSupport": "integrated-torsion-box-no-column",
  "riserClosure": "closed",
  "guardrail": {
    "primaryType": "full-height-vertical-tension-screen",
    "fallbackType": "laminated-glass",
    "minimumHeight": 2.4,
    "fallbackHeight": 1.35,
    "nominalLineSpacing": 0.04,
    "collectorBeam": "concealed-independent-l2-or-gallery-structure",
    "materialStatus": "deferred",
    "openItemId": "OPEN-013"
  },
  "underStair": "fully-open",
  "enclosure": "dry-glass-gallery",
  "supportedByRoof": false
}
```

同時把 model `revision` 更新為實際執行日，但保留 `modelVersion: "0.2.0"`。

- [ ] **Step 4: 精確更新 TypeScript stair type**

在 `reference/src/types.ts` 用下列欄位取代 string guardrail：

```ts
treadsPerRun: number;
treadDepth: number;
midLandingLength: number;
stringers: number;
stringerDescription: string;
supportSystem: 'S1-continuous-twin-box-stringers';
landingSupport: 'integrated-torsion-box-no-column';
riserClosure: 'closed';
guardrail: {
  primaryType: 'full-height-vertical-tension-screen';
  fallbackType: 'laminated-glass';
  minimumHeight: number;
  fallbackHeight: number;
  nominalLineSpacing: number;
  collectorBeam: 'concealed-independent-l2-or-gallery-structure';
  materialStatus: 'deferred';
  openItemId: 'OPEN-013';
};
```

- [ ] **Step 5: 重新執行 focused test**

Run:

```powershell
node --test --test-name-pattern="ST-01 stores" tests/reference-model.test.mjs
```

Expected: PASS。

- [ ] **Step 6: 建立本地 schema commit**

```powershell
git add model/project-model.json reference/src/types.ts tests/reference-model.test.mjs
git commit -m "feat: encode approved ST-01 design"
```

不得 stage 其他既有 dirty docs。

---

### Task 2: 修正級高／踏面語意與 10.2 m 幾何推導

**Files:**
- Modify: `tests/reference-model.test.mjs`
- Modify: `scripts/reference-geometry.mjs`
- Modify: `scripts/reference-geometry.d.mts`

**Interfaces:**
- Consumes: Task 1 的 `treadsPerRun`、`risersPerRun`、`treadDepth`、`totalRise`。
- Produces: `riserHeight`、`midLandingElevation`、`flightRun`、`stairTotalRun`、`stairStartX`、`stairEndX`。

- [ ] **Step 1: 把舊 7.96 m 預期值改成核准推導，並加入語意測試**

更新前兩個 geometry tests，並加入：

```js
test('derives ST-01 from 14 treads per run rather than 15 risers', () => {
  const derived = deriveReferenceGeometry(clone());
  assert.equal(derived.riserHeight, 0.15);
  assert.equal(derived.midLandingElevation, 2.25);
  assert.equal(derived.flightRun, 4.2);
  assert.equal(derived.stairTotalRun, 10.2);
  assert.equal(derived.stairStartX, 16.8);
  assert.equal(derived.stairEndX, 27);
});
```

既有 extension tests 的 stair 預期更新為：

```js
assert.equal(derived.stairStartX, 16.8); // l2ExtensionLength 5
assert.equal(derived.stairStartX, 17.3); // l2ExtensionLength 4
```

- [ ] **Step 2: 確認舊 helper 仍用 `risersPerRun × treadDepth` 而失敗**

Run:

```powershell
node --test --test-name-pattern="derives ST-01|approved 5 m extension|re-derives every" tests/reference-model.test.mjs
```

Expected: FAIL；舊 `flightRun` 為 4.5 m，不是 4.2 m。

- [ ] **Step 3: 在 geometry helper 分離級高與踏面**

在 `scripts/reference-geometry.mjs` 讀取並驗證：

```js
const risersPerRun = finiteNumber(stair.risersPerRun, 'stair.risersPerRun');
const treadsPerRun = finiteNumber(stair.treadsPerRun, 'stair.treadsPerRun');
const treadDepth = finiteNumber(stair.treadDepth, 'stair.treadDepth');
const totalRise = finiteNumber(stair.totalRise, 'stair.totalRise');

if (!Number.isInteger(risersPerRun) || !Number.isInteger(treadsPerRun)
  || treadsPerRun !== risersPerRun - 1) {
  throw new RangeError('stair.treadsPerRun must equal stair.risersPerRun - 1.');
}
```

以踏面數推導水平長度：

```js
const flightRun = treadsPerRun * treadDepth;
const stairTotalRun = flightRun * stair.runs + midLandingLength;
const riserHeight = totalRise / stair.riserCount;
const midLandingElevation = riserHeight * risersPerRun;
const stairStartX = l2SplitAxisX - stairTotalRun;
const stairEndX = l2SplitAxisX;
```

將 `riserHeight`、`midLandingElevation` 加入 return object。

- [ ] **Step 4: 同步 declaration interface**

在 `scripts/reference-geometry.d.mts` 的 `ReferenceGeometry` 加入：

```ts
riserHeight: number;
midLandingElevation: number;
```

- [ ] **Step 5: 執行 focused tests**

Run:

```powershell
node --test --test-name-pattern="derives ST-01|approved 5 m extension|re-derives every" tests/reference-model.test.mjs
```

Expected: 3 tests PASS。

- [ ] **Step 6: Commit geometry correction**

```powershell
git add scripts/reference-geometry.mjs scripts/reference-geometry.d.mts tests/reference-model.test.mjs
git commit -m "fix: derive stair runs from tread count"
```

---

### Task 3: 讓 validator 鎖定核准幾何與 B／A 狀態

**Files:**
- Modify: `tests/reference-model.test.mjs`
- Modify: `scripts/reference-validation.mjs`

**Interfaces:**
- Consumes: Task 1 的 stair schema 與 Task 2 的 derived geometry。
- Produces: 可觀察的 ST-01 contract errors；材料保持 `deferred` 並連結 `OPEN-013`。

- [ ] **Step 1: 新增 mutation-based failing tests**

```js
test('rejects stale ST-01 rise, tread semantics, and guard strategy', () => {
  const staleRise = clone();
  staleRise.geometry.stair.totalRise = 3.6;
  assert.match(validateModel(staleRise).join('\n'), /ST-01 approved geometry/);

  const staleTreads = clone();
  staleTreads.geometry.stair.treadsPerRun = 15;
  assert.match(validateModel(staleTreads).join('\n'), /treadsPerRun must equal/);

  const unsafeGuard = clone();
  unsafeGuard.geometry.stair.guardrail.materialStatus = 'confirmed';
  assert.match(validateModel(unsafeGuard).join('\n'), /OPEN-013/);

  const roofLoad = clone();
  roofLoad.geometry.stair.guardrail.collectorBeam = 'glass-roof';
  assert.match(validateModel(roofLoad).join('\n'), /independent L2 or gallery structure/);
});
```

- [ ] **Step 2: 執行並確認 validator 尚未拒絕 mutation**

Run:

```powershell
node --test --test-name-pattern="rejects stale ST-01" tests/reference-model.test.mjs
```

Expected: FAIL；至少一個 mutation 回傳空 errors。

- [ ] **Step 3: 用 exact contract 取代舊 string guard 檢查**

在 `scripts/reference-validation.mjs` 的 stair 區段加入：

```js
const approvedStairGeometry = stair.totalRise === 4.5
  && stair.width === 1.8
  && stair.riserCount === 30
  && stair.runs === 2
  && stair.risersPerRun === 15
  && stair.treadsPerRun === 14
  && stair.treadDepth === 0.3
  && stair.midLandingLength === 1.8;
if (!approvedStairGeometry) errors.push('ST-01 approved geometry must remain 4.5 m / 30 risers / 28 treads / 10.2 m');

if (stair.treadsPerRun !== stair.risersPerRun - 1) {
  errors.push('ST-01 treadsPerRun must equal risersPerRun - 1');
}
if (stair.supportSystem !== 'S1-continuous-twin-box-stringers'
  || stair.landingSupport !== 'integrated-torsion-box-no-column'
  || stair.riserClosure !== 'closed') {
  errors.push('ST-01 must retain the approved S1 structure and closed risers');
}
```

並驗證 guard object：

```js
const guard = stair.guardrail;
if (guard?.primaryType !== 'full-height-vertical-tension-screen'
  || guard?.fallbackType !== 'laminated-glass'
  || guard?.minimumHeight !== 2.4
  || guard?.fallbackHeight !== 1.35
  || guard?.nominalLineSpacing !== 0.04) {
  errors.push('ST-01 guard must retain B tension-screen primary and A laminated-glass fallback');
}
if (guard?.collectorBeam !== 'concealed-independent-l2-or-gallery-structure') {
  errors.push('ST-01 guard collector must use independent L2 or gallery structure');
}
if (guard?.materialStatus !== 'deferred' || guard?.openItemId !== 'OPEN-013') {
  errors.push('ST-01 guard material must remain deferred under OPEN-013');
}
```

保留 `supportedByRoof === false` 驗證；刪除 `guardrail === 'transparent'` 的舊 string 判斷。

- [ ] **Step 4: 執行 focused validation tests**

Run:

```powershell
node --test --test-name-pattern="rejects stale ST-01|authoritative reference model" tests/reference-model.test.mjs
```

Expected: 2 tests PASS。

- [ ] **Step 5: Commit validator contract**

```powershell
git add scripts/reference-validation.mjs tests/reference-model.test.mjs
git commit -m "test: enforce approved ST-01 contract"
```

---

### Task 4: 修正 REF-101／401 階梯幾何並表達隱藏集力弦幕

**Files:**
- Modify: `tests/reference-model.test.mjs`
- Modify: `reference/src/sheets.ts`
- Modify: `reference/src/styles.css`

**Interfaces:**
- Consumes: `deriveReferenceGeometry(model)` 的 `flightRun`、`riserHeight`、`midLandingElevation` 與 stair guard strategy。
- Produces: REF-101 的 28 條 plan tread lines；REF-401 的 30 risers／28 treads、S1 梯梁、封閉踢面、B 主案示意與 A 備案標籤。

- [ ] **Step 1: 先建立 renderer regression test**

```js
test('REF-101 and REF-401 render the approved ST-01 geometry and guard hierarchy', async () => {
  const { renderSheets } = await importRendererModule();
  const sheets = renderSheets(clone());
  const plan = sheets.find((sheet) => sheet.id === 'REF-101')?.markup ?? '';
  const section = sheets.find((sheet) => sheet.id === 'REF-401')?.markup ?? '';

  assert.equal((plan.match(/data-stair-tread-plan=/g) ?? []).length, 28);
  assert.equal((section.match(/data-stair-riser=/g) ?? []).length, 30);
  assert.equal((section.match(/data-stair-tread=/g) ?? []).length, 28);
  assert.match(section, /B 主案 · 2\.4 m 垂直弦幕/);
  assert.match(section, /A 備案 · 1\.35 m 夾層玻璃/);
  assert.match(section, /集力梁隱藏於 L2／梯廊獨立結構/);
  assert.doesNotMatch(section, /exposed-upper-frame|外露平行上框梁/);
});
```

- [ ] **Step 2: 執行並確認舊 renderer 失敗**

Run:

```powershell
node --test --test-name-pattern="REF-101 and REF-401 render" tests/reference-model.test.mjs
```

Expected: FAIL；舊 plan 依 `riserCount` 畫 30 條線，section 沒有 data attributes 或 B／A 語意。

- [ ] **Step 3: REF-101 依兩跑各 14 踏面繪製，平台留空**

在 `renderL1` 建立：

```ts
const planStairTreads = [0, 1].flatMap((runIndex) => {
  const runStart = derived.stairStartX
    + runIndex * (derived.flightRun + model.geometry.stair.midLandingLength);
  return Array.from({ length: model.geometry.stair.treadsPerRun }, (_, index) => {
    const x = runStart + (index + 1) * model.geometry.stair.treadDepth;
    return `<line class="stair-tread" data-stair-tread-plan="${runIndex + 1}-${index + 1}"
      x1="${planX(x)}" y1="${planY(stairY2 - .12)}"
      x2="${planX(x)}" y2="${planY(stairY1 + .12)}"/>`;
  });
}).join('');
```

以 `${planStairTreads}` 取代原本依 `riserCount` 均分總長的 markup。

- [ ] **Step 4: REF-401 分別繪製 risers 與 treads**

在 `renderSection` 內加入本地 helper：

```ts
const renderFlight = (baseX: number, baseZ: number, flightIndex: number) => {
  const risers = Array.from({ length: stair.risersPerRun }, (_, index) => {
    const x = baseX + Math.min(index, stair.treadsPerRun) * stair.treadDepth;
    const z0 = baseZ + index * derived.riserHeight;
    const z1 = z0 + derived.riserHeight;
    return `<line class="section-riser closed-riser" data-stair-riser="${flightIndex}-${index + 1}"
      x1="${sx(x)}" y1="${sz(z0)}" x2="${sx(x)}" y2="${sz(z1)}"/>`;
  }).join('');
  const treads = Array.from({ length: stair.treadsPerRun }, (_, index) => {
    const x1 = baseX + index * stair.treadDepth;
    const x2 = x1 + stair.treadDepth;
    const z = baseZ + (index + 1) * derived.riserHeight;
    return `<line class="section-tread" data-stair-tread="${flightIndex}-${index + 1}"
      x1="${sx(x1)}" y1="${sz(z)}" x2="${sx(x2)}" y2="${sz(z)}"/>`;
  }).join('');
  return risers + treads;
};
```

第一跑使用 `renderFlight(derived.stairStartX, 0, 1)`；第二跑使用 `renderFlight(secondStart, derived.midLandingElevation, 2)`。stringer 與平台端點只使用 `derived.midLandingElevation`、`stair.totalRise`，移除 `1.88`、`3.68`、`1.8`、`3.6` 等硬編碼高度。

- [ ] **Step 5: 以概念 sampling 畫 B 弦幕，不畫平行上框梁**

加入只供圖面辨識、不是 40 mm 施工排線的 sampling helper：

```ts
const renderTensionScreen = (baseX: number, baseZ: number, flightIndex: number) =>
  Array.from({ length: 8 }, (_, index) => {
    const ratio = index / 7;
    const x = baseX + ratio * derived.flightRun;
    const z = baseZ + ratio * (derived.midLandingElevation);
    return `<line class="tension-screen-line" data-guard-primary="B-${flightIndex}-${index + 1}"
      x1="${sx(x)}" y1="${sz(z)}" x2="${sx(x)}" y2="${sz(z + stair.guardrail.minimumHeight)}"/>`;
  }).join('');
```

第二跑的 z 增量使用 `stair.totalRise - derived.midLandingElevation`。在 L2／梯廊結構帶內畫 `concealed-collector-zone` 虛線區，而不是沿梯段畫 top beam；markup 明示：

```html
<text class="stair-guard-label">B 主案 · 2.4 m 垂直弦幕</text>
<text class="stair-guard-note">集力梁隱藏於 L2／梯廊獨立結構 · 材料待 OPEN-013</text>
<text class="stair-guard-fallback">A 備案 · 1.35 m 夾層玻璃</text>
```

- [ ] **Step 6: 加入可辨識但低調的 CSS**

```css
.section-riser { stroke: #253f4c; stroke-width: 2.1; }
.section-tread { stroke: #6f7d82; stroke-width: 2.4; }
.closed-riser { fill: none; }
.tension-screen-line { stroke: #7f969e; stroke-width: 1.05; opacity: .78; }
.concealed-collector-zone { fill: rgba(189,138,34,.1); stroke: #bd8a22; stroke-width: 1.4; stroke-dasharray: 6 5; }
.stair-guard-label { fill: #153449 !important; font-size: 11px !important; font-weight: 850; }
.stair-guard-note, .stair-guard-fallback { fill: #607482 !important; font-size: 9px !important; }
```

保留既有 `.stringer` 深色語彙；平台與第二條梯梁使用相同色系。不得新增 `.exposed-upper-frame`。

- [ ] **Step 7: 執行 focused renderer test**

```powershell
node --test --test-name-pattern="REF-101 and REF-401 render" tests/reference-model.test.mjs
```

Expected: PASS，且數量精確為 plan 28、section risers 30、section treads 28。

- [ ] **Step 8: Commit plan／section renderer**

```powershell
git add reference/src/sheets.ts reference/src/styles.css tests/reference-model.test.mjs
git commit -m "feat: render approved ST-01 section"
```

---

### Task 5: 修正 REF-501 硬編碼高度並加入 B 主案透明層

**Files:**
- Modify: `tests/reference-model.test.mjs`
- Modify: `reference/src/sheets.ts`
- Modify: `reference/src/styles.css`

**Interfaces:**
- Consumes: Task 2 的 `midLandingElevation`／`totalRise` 與 Task 4 的 B/A semantics。
- Produces: REF-501 兩側雙箱型梯梁與概念垂直弦幕；不使用 1.8／3.6 legacy 高度。

- [ ] **Step 1: 新增 isometric regression**

```js
test('REF-501 derives ST-01 elevations and shows the B primary guard without a roof load', async () => {
  const { renderSheets } = await importRendererModule();
  const markup = renderSheets(clone()).find((sheet) => sheet.id === 'REF-501')?.markup ?? '';
  assert.match(markup, /data-stair-mid-elevation="2\.25"/);
  assert.match(markup, /data-stair-top-elevation="4\.5"/);
  assert.match(markup, /data-guard-primary="B"/);
  assert.match(markup, /data-supported-by-roof="false"/);
  assert.doesNotMatch(markup, /data-stair-top-elevation="3\.6"/);
});
```

- [ ] **Step 2: 執行並確認舊 1.8／3.6 幾何失敗**

```powershell
node --test --test-name-pattern="REF-501 derives ST-01" tests/reference-model.test.mjs
```

Expected: FAIL；markup 尚無 data contract 且使用 hard-coded 1.8／3.6。

- [ ] **Step 3: 以 derived elevation 重建四條梯梁線**

在 `renderIsometric` 先定義：

```ts
const stairMidZ = derived.midLandingElevation;
const stairTopZ = stair.totalRise;
const firstEndX = derived.stairStartX + derived.flightRun;
const secondStartX = firstEndX + stair.midLandingLength;
```

把所有 `1.8`、`3.6` 取代為 `stairMidZ`、`stairTopZ`，並讓 ST-01 group 帶出：

```html
<g class="iso-stair" data-entity="ST-01"
  data-stair-mid-elevation="${stairMidZ}"
  data-stair-top-elevation="${stairTopZ}"
  data-supported-by-roof="${stair.supportedByRoof}">
```

- [ ] **Step 4: 加入低密度垂直弦幕示意**

以每跑 6 條 sampling line 表達 B 主案；每條由梯梁／平台向 +Z 延伸 `stair.guardrail.minimumHeight`，group 使用 `data-guard-primary="B"`。線條不連至 `RF-GL-01` 的任何 point，也不畫上方平行梁。CSS：

```css
.iso-tension-screen line { stroke: #76919a; stroke-width: 1.1; opacity: .72; }
.iso-stair .secondary-stringer { stroke: #405965; stroke-width: 4; }
```

- [ ] **Step 5: 執行 focused isometric test**

```powershell
node --test --test-name-pattern="REF-501 derives ST-01" tests/reference-model.test.mjs
```

Expected: PASS。

- [ ] **Step 6: Commit isometric correction**

```powershell
git add reference/src/sheets.ts reference/src/styles.css tests/reference-model.test.mjs
git commit -m "feat: sync ST-01 isometric geometry"
```

---

### Task 6: 同步 contracts、完成完整驗證與封存

**Files:**
- Modify: `docs/03_DESIGN_BASIS.md`
- Modify: `docs/04_DECISIONS_AND_OPEN_ITEMS.md`
- Modify: `docs/05_MODEL_CONTRACT.md`
- Modify: `docs/07_ACTIVE_WORK.md`
- Modify: `docs/contracts/reference-atlas.md`
- Move: `docs/specs/2026-07-16-stair-finalization-design.md` → `docs/archive/specs/2026-07-16-stair-finalization-design.md`
- Move: `docs/specs/2026-07-16-stair-finalization-implementation-plan.md` → `docs/archive/specs/2026-07-16-stair-finalization-implementation-plan.md`
- Move: `docs/specs/st-01-hidden-tension-wall-concept.svg` → `docs/archive/specs/st-01-hidden-tension-wall-concept.svg`

**Interfaces:**
- Consumes: Tasks 1–5 已通過的模型、validator 與 renderer。
- Produces: owner 文件不再把 0.2.0 樓梯視為 stale；`TASK-010` done；`OPEN-013` 繼續 open；completed specs 回到 archive。

- [ ] **Step 1: 先更新 reference atlas contract**

在 `docs/contracts/reference-atlas.md` 加入 ST-01 輸出契約：

```markdown
## ST-01 樓梯輸出

- REF-101 使用兩跑各 14 踏面的平面節奏，中間保留 1.8 m 平台，不得以 30 級高均分 10.2 m。
- REF-401 使用 30 個級高與 28 個踏面，平台為 +2.250 m；梯梁、踢面、弦幕與扶手須分層表達。
- REF-501 的兩跑高度只讀 `midLandingElevation` 與 `totalRise`，不得保存 1.8／3.6 legacy 常數。
- B 主案以垂直弦幕與隱藏集力語意呈現，不畫完整外露平行上框梁；A 備案保留於文字／狀態層。
- 所有輸出明示 `OPEN-013`，不得把含氯材料、張力或節點標為 confirmed construction。
```

- [ ] **Step 2: 清除 stale-artifact 說明但保留 OPEN-013**

在 `03` 移除「目前 0.2.0 模型仍保存 22 級高」段落；在 `05` 把「TASK-009 待修」改為「模型、helper 與圖集已同步 DEC-035」。`04` 保留 `OPEN-013` 與退回 A 案條件，不得關閉。

- [ ] **Step 3: 封存已完成 specs 並修正相對連結**

使用 PowerShell `Move-Item -LiteralPath`，三個來源及目標都先以 `Resolve-Path`／父目錄檢查仍位於 repo 的 `docs` 內。移動後：

- design status 改為 `completed` 並加 `完成日期：2026-07-16`。
- implementation plan status 改為 `completed` 並加 `完成日期：2026-07-16`。
- design 的 SVG 相對連結仍維持同資料夾檔名。
- `03`、`07` 及其他引用改指向 `archive/specs/`。

- [ ] **Step 4: 將 TASK-010 標為 done，不改變 TASK-008 的真實狀態**

`07` 的完成條件記錄實際通過的 checks。若 TASK-008 尚未完成，維持其真實狀態，且 0.3.0 release 仍不得開始。

- [ ] **Step 5: 執行完整靜態驗證**

```powershell
npm.cmd run check:docs
npm.cmd run validate:reference
npm.cmd test
npm.cmd run build
git diff --check
```

Expected:

- Documentation checks 0 errors，active／archive spec metadata 正確。
- Reference model valid。
- 全部 Node tests PASS。
- Vite production build 成功。
- `git diff --check` 無 whitespace errors。

- [ ] **Step 6: 執行 desktop 與 526px 視覺 smoke**

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

以 browser 開啟 Vite 顯示的 localhost URL，檢查 REF-101／401／501：

- desktop：30 級高／28 踏面、平台與 B/A 文字均可辨識；弦幕未連到屋頂；無外露平行上框梁。
- 526px：tab、圖面水平捲動、entity focus、ST-01 標籤與說明均可操作，沒有裁切主要標籤。
- 320px 實機 smoke 若仍因工具超時未完成，在 TASK／release 記錄寫明「未通過／未執行」，不得以 526px 取代。

- [ ] **Step 7: 建立本地 completion commit**

只 stage 本 task 明列檔案及三個 archive 目標：

```powershell
git add docs/03_DESIGN_BASIS.md docs/04_DECISIONS_AND_OPEN_ITEMS.md docs/05_MODEL_CONTRACT.md docs/07_ACTIVE_WORK.md docs/contracts/reference-atlas.md docs/archive/specs/2026-07-16-stair-finalization-design.md docs/archive/specs/2026-07-16-stair-finalization-implementation-plan.md docs/archive/specs/st-01-hidden-tension-wall-concept.svg
git commit -m "docs: complete ST-01 model synchronization"
```

不得 push、tag、release，也不得 stage `TASK-008` 尚未核准的模型變更。

## Self-Review Result

- Spec coverage：幾何、級高／踏面語意、S1、封閉踢面／梯下開放、B 主案、A 備案、隱藏集力、OPEN-013、三張相關圖面與 526px／320px 驗證邊界均有對應 task。
- Placeholder scan：無未填值、模糊延後敘述或未定義 function 名稱。
- Type consistency：`treadsPerRun`、`riserHeight`、`midLandingElevation`、`guardrail.primaryType`、`guardrail.collectorBeam` 於 model、types、helper、validator、renderer 與 tests 使用同一命名。
- Scope：本計畫只處理 ST-01；屋頂／雨水仍由 TASK-008，版本與 release 另由完整 0.3.0 任務管理。
