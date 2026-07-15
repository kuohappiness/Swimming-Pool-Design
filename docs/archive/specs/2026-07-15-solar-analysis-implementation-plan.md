# 0.3.0 日照分析同步實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- 日期：2026-07-15
- 類型：implementation-plan
- 狀態：completed
- 完成日期：2026-07-15
- 任務：TASK-007
- 目標版本：0.3.0

**Goal:** 將已確認的 2F 水平旋轉 +9.5° 與鏡牆外傾 +8.5° 建立為單一模型答案，提供可重現的季節分析，並同步 REF-401、solar-study、測試與文件。

**Architecture:** `model/project-model.json` 新增唯一 `geometry.solarReflection` 物件，角度與判讀門檻由模型擁有；分析 CLI、REF-401 與 solar-study 都只讀這個物件。詳細方法與結果留在 `docs/analysis/solar-analysis.md`，HTML 只顯示手機可讀摘要與研究控制，不複製長表格。

**Tech Stack:** JSON model、TypeScript、Vite、Node.js ESM、`node:test`、SVG、HTML/CSS。

## Global Constraints

- 水平旋轉 confirmed 值是 +9.5°，以 1F／2F 長軸對齊為 0°，由上往下看順時針為正。
- 鏡牆外傾 confirmed 值是 +8.5°，以垂直為 0°，牆頂向泳池側為正。
- 固定建築世界 transform 維持 307°；未旋轉面池法線維持 127°；confirmed 鏡牆法線為 136.5°。
- 夏季避開比冬季反射更重要；幾何命中不得描述為實際蓄熱量、水溫、節能量或眩光安全結論。
- 旋轉支點、牆高、材料反射率、池面實際命中區、遮蔭、眩光、全年 3D 光線追蹤與熱負荷繼續留在 `OPEN-011`。
- 不新增 runtime dependency；分析與頁面共用 `scripts/solar-reflection.mjs`。
- 本計畫不處理 OPEN-010 屋頂接縫、雨簾與回收系統，也不建立 0.3.0 release；版本同步與 release 等其他 0.3.0 任務完成後另行執行。
- PowerShell 驗證使用 `npm.cmd`，避免 `npm.ps1` 執行原則阻擋。

---

## File Structure

| 檔案 | 責任 |
| --- | --- |
| `model/project-model.json` | 角度、方向與幾何判讀門檻的唯一機器可讀答案 |
| `reference/src/types.ts` | `ProjectModel.geometry.solarReflection` TypeScript 契約 |
| `scripts/reference-validation.mjs` | 阻止 confirmed 角度、方向或門檻漂移 |
| `scripts/solar-angle-analysis.mjs` | 重現日照文件的夏季／冬季角度統計與誤差包絡 |
| `tests/reference-model.test.mjs` | 模型 schema、值、狀態與 validator 負向案例 |
| `tests/solar-angle-analysis.test.mjs` | 分析統計與 +8.5° 誤差包絡回歸 |
| `reference/src/sheets.ts` | REF-401 使用 +8.5° 畫鏡牆並標示牆高仍未定 |
| `tests/solar-reflection.test.mjs` | confirmed 角度的冬至／夏至與 consumer 回歸 |
| `reference/src/solar-study/main.ts` | 從模型載入 confirmed 預設及即時反射判讀 |
| `reference/solar-study/index.html` | confirmed 摘要、研究控制與限制文字 |
| `reference/src/solar-study/styles.css` | 摘要區與 320 px 行動版排版 |
| `docs/05_MODEL_CONTRACT.md` | 新模型欄位與跨輸出不變條件 |
| `docs/contracts/solar-study.md` | 核准後的頁面行為與驗收 |
| `docs/analysis/solar-analysis.md` | 可重現命令、方法、結果與後續研究 owner |

### Task 1: 建立 canonical 太陽反射模型欄位

**Files:**
- Modify: `tests/reference-model.test.mjs:333-470`
- Modify: `model/project-model.json:5-56`
- Modify: `reference/src/types.ts:1-120`
- Modify: `scripts/reference-validation.mjs:6-90, 210-240`
- Modify: `docs/05_MODEL_CONTRACT.md:13-30, 68-82`

**Interfaces:**
- Consumes: 現有 `NumericMeasure`、`validateModel(model)`。
- Produces: `model.geometry.solarReflection`，供 Task 2～4 共同讀取。

- [x] **Step 1: 先寫 canonical 模型與漂移的失敗測試**

在 `tests/reference-model.test.mjs` 將「without a formal angle」測試改成以下測試，並保留舊的 ambiguous field 禁止測試：

```js
test('owns the confirmed solar reflection geometry in one model object', () => {
  const solar = clone().geometry.solarReflection;
  assert.deepEqual(solar, {
    planRotation: { value: 9.5, status: 'confirmed', sourceIds: [] },
    mirrorLeanFromVertical: { value: 8.5, status: 'confirmed', sourceIds: [] },
    rotationDirection: 'clockwise-from-above',
    mirrorLeanDirection: 'toward-pool',
    azimuthTolerance: { value: 28, status: 'working', sourceIds: [] },
    minimumDownwardAngle: { value: 8, status: 'working', sourceIds: [] },
    openItemId: 'OPEN-011',
  });
});

test('rejects drift in confirmed solar reflection geometry', () => {
  for (const [field, value, error] of [
    ['planRotation', { value: 9, status: 'confirmed', sourceIds: [] }, /plan rotation must remain confirmed at 9.5 degrees/],
    ['mirrorLeanFromVertical', { value: 9.5, status: 'confirmed', sourceIds: [] }, /mirror lean must remain confirmed at 8.5 degrees/],
    ['rotationDirection', 'counter-clockwise-from-above', /rotation direction must remain clockwise-from-above/],
    ['mirrorLeanDirection', 'away-from-pool', /mirror lean direction must remain toward-pool/],
    ['azimuthTolerance', { value: 30, status: 'working', sourceIds: [] }, /azimuth tolerance must remain working at 28 degrees/],
    ['minimumDownwardAngle', { value: 6, status: 'working', sourceIds: [] }, /minimum downward angle must remain working at 8 degrees/],
    ['openItemId', 'OPEN-010', /solar reflection must remain linked to OPEN-011/],
  ]) {
    const model = clone();
    model.geometry.solarReflection[field] = value;
    assert.match(validateModel(model).join('\n'), error);
  }
});
```

- [x] **Step 2: 執行測試確認因缺少欄位而失敗**

Run:

```powershell
node --test --test-name-pattern="solar reflection geometry" tests/reference-model.test.mjs
```

Expected: FAIL；`model.geometry.solarReflection` 是 `undefined` 或 validator 尚未回報漂移。

- [x] **Step 3: 寫入模型與 TypeScript 契約**

在 `model/project-model.json` 的 `geometry` 內、`combinedCubicle` 後加入：

```json
"solarReflection": {
  "planRotation": { "value": 9.5, "status": "confirmed", "sourceIds": [] },
  "mirrorLeanFromVertical": { "value": 8.5, "status": "confirmed", "sourceIds": [] },
  "rotationDirection": "clockwise-from-above",
  "mirrorLeanDirection": "toward-pool",
  "azimuthTolerance": { "value": 28, "status": "working", "sourceIds": [] },
  "minimumDownwardAngle": { "value": 8, "status": "working", "sourceIds": [] },
  "openItemId": "OPEN-011"
}
```

在 `reference/src/types.ts` 增加並掛入 `ProjectModel.geometry`：

```ts
export interface SolarReflectionGeometry {
  planRotation: NumericMeasure;
  mirrorLeanFromVertical: NumericMeasure;
  rotationDirection: 'clockwise-from-above';
  mirrorLeanDirection: 'toward-pool';
  azimuthTolerance: NumericMeasure;
  minimumDownwardAngle: NumericMeasure;
  openItemId: 'OPEN-011';
}
```

```ts
solarReflection: SolarReflectionGeometry;
```

- [x] **Step 4: 實作 exact validator**

在 `scripts/reference-validation.mjs` 方位檢查後加入：

```js
const solar = model.geometry?.solarReflection;
const exactMeasure = (measure, value, status) => measure?.value === value
  && measure?.status === status
  && Array.isArray(measure?.sourceIds)
  && measure.sourceIds.length === 0;

if (!exactMeasure(solar?.planRotation, 9.5, 'confirmed')) {
  errors.push('solar plan rotation must remain confirmed at 9.5 degrees');
}
if (!exactMeasure(solar?.mirrorLeanFromVertical, 8.5, 'confirmed')) {
  errors.push('solar mirror lean must remain confirmed at 8.5 degrees');
}
if (solar?.rotationDirection !== 'clockwise-from-above') {
  errors.push('solar rotation direction must remain clockwise-from-above');
}
if (solar?.mirrorLeanDirection !== 'toward-pool') {
  errors.push('solar mirror lean direction must remain toward-pool');
}
if (!exactMeasure(solar?.azimuthTolerance, 28, 'working')) {
  errors.push('solar azimuth tolerance must remain working at 28 degrees');
}
if (!exactMeasure(solar?.minimumDownwardAngle, 8, 'working')) {
  errors.push('solar minimum downward angle must remain working at 8 degrees');
}
if (solar?.openItemId !== 'OPEN-011') {
  errors.push('solar reflection must remain linked to OPEN-011');
}
```

保留 `FORBIDDEN_FORMAL_GEOMETRY_FIELDS`，它只阻止 `mirrorFacade`、裸 `leanAngle` 與 `displayRoofElevation` 等第二套模糊答案；新的明確 `solarReflection` 物件不在禁止集合中。

- [x] **Step 5: 更新模型契約並跑 focused validation**

在 `docs/05_MODEL_CONTRACT.md`：

- 將模型結構的 `geometry` 列表加入 `solarReflection`。
- 將 `F-MIR-01` 規則改為：「水平 +9.5° 與外傾 +8.5° 由 `geometry.solarReflection` confirmed；牆高與性能仍 deferred」。
- 在模型驗證門檻加入角度、方向、門檻與 `OPEN-011` 連結檢查。

Run:

```powershell
node --test --test-name-pattern="solar reflection geometry" tests/reference-model.test.mjs
npm.cmd run validate:reference
```

Expected: focused tests PASS；reference validation PASS。

- [x] **Step 6: Commit model contract**

```powershell
git add model/project-model.json reference/src/types.ts scripts/reference-validation.mjs tests/reference-model.test.mjs docs/05_MODEL_CONTRACT.md
git commit -m "feat: register confirmed solar geometry"
```

### Task 2: 建立可重現的日照分析 runner

**Files:**
- Create: `scripts/solar-angle-analysis.mjs`
- Create: `tests/solar-angle-analysis.test.mjs`
- Modify: `docs/analysis/solar-analysis.md:20-125`

**Interfaces:**
- Consumes: `model.geometry.solarReflection`、`calculateSolarPosition()`、`deriveSolarPlanOrientation()`、`reflectSolarRay()`、`evaluatePoolReflection()`。
- Produces: `evaluateSolarCandidate(model, options)` 與 `evaluateMirrorEnvelope(model, options)`；CLI 輸出 JSON，供文件更新與回歸測試。

- [x] **Step 1: 寫 runner 的失敗測試**

建立 `tests/solar-angle-analysis.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  evaluateMirrorEnvelope,
  evaluateSolarCandidate,
} from '../scripts/solar-angle-analysis.mjs';

const model = JSON.parse(await readFile(resolve('model/project-model.json'), 'utf8'));

test('reproduces the approved one-minute mirror comparison', () => {
  const result = evaluateSolarCandidate(model, {
    planRotation: 9.5,
    mirrorLeanFromVertical: 8.5,
    stepMinutes: 1,
  });
  assert.equal(result.summer.total, 2404);
  assert.equal(result.summer.hits, 0);
  assert.equal(result.winter.total, 964);
  assert.equal(result.winter.hits, 684);
  assert.equal(result.winter.hitRatePercent, 71.0);
});

test('keeps 8.5 degrees safe across the approved error envelope', () => {
  const safe = evaluateMirrorEnvelope(model, { nominalLean: 8.5 });
  const unsafe = evaluateMirrorEnvelope(model, { nominalLean: 8.0 });
  assert.equal(safe.maximumSummerHits, 0);
  assert.deepEqual(safe.winterHitRange, [665, 699]);
  assert.equal(unsafe.maximumSummerHits, 6);
});
```

- [x] **Step 2: 執行測試確認 module 尚不存在**

Run:

```powershell
node --test tests/solar-angle-analysis.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`。

- [x] **Step 3: 實作分析 module**

建立 `scripts/solar-angle-analysis.mjs`，介面與預設固定如下：

```js
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  calculateSolarPosition,
  deriveSolarPlanOrientation,
  evaluatePoolReflection,
  normalizeAzimuth,
  reflectSolarRay,
} from './solar-reflection.mjs';

export const SUMMER_DATES = [[2026, 5, 21], [2026, 6, 21], [2026, 7, 21], [2026, 8, 21]];
export const WINTER_DATES = [[2026, 11, 21], [2026, 12, 21], [2027, 1, 21], [2027, 2, 21]];

const round = (value, digits = 1) => Number(value.toFixed(digits));

function evaluateWindow(model, input) {
  const location = model.referenceSystem.siteLocation;
  const poolAzimuth = deriveSolarPlanOrientation(model.referenceSystem).poolFacingAzimuth + input.bearingOffset;
  const wallAzimuth = normalizeAzimuth(poolAzimuth + input.planRotation);
  let hits = 0;
  let directionWeight = 0;
  let total = 0;

  for (const [year, month, day] of input.dates) {
    for (let minute = input.startMinute; minute <= input.endMinute; minute += input.stepMinutes) {
      const solar = calculateSolarPosition({
        year, month, day,
        hour: Math.floor(minute / 60),
        minute: minute % 60,
        latitude: location.latitude.value,
        longitude: location.longitude.value,
        utcOffsetHours: location.utcOffsetHours,
      });
      const reflection = reflectSolarRay({
        solarAltitude: solar.altitude,
        solarAzimuth: solar.azimuth,
        wallNormalAzimuth: wallAzimuth,
        wallLeanFromVertical: input.mirrorLeanFromVertical,
      });
      const evaluation = evaluatePoolReflection(reflection, {
        poolTargetAzimuth: poolAzimuth,
        azimuthTolerance: model.geometry.solarReflection.azimuthTolerance.value,
        minimumDownwardAngle: model.geometry.solarReflection.minimumDownwardAngle.value,
      });
      total += 1;
      if (evaluation.hitsPool) {
        hits += 1;
        directionWeight += reflection.facingFactor;
      }
    }
  }
  return { total, hits, hitRatePercent: round(hits / total * 100), directionWeight: round(directionWeight, 3) };
}

export function evaluateSolarCandidate(model, options = {}) {
  const solar = model.geometry.solarReflection;
  const common = {
    planRotation: options.planRotation ?? solar.planRotation.value,
    mirrorLeanFromVertical: options.mirrorLeanFromVertical ?? solar.mirrorLeanFromVertical.value,
    bearingOffset: options.bearingOffset ?? 0,
    stepMinutes: options.stepMinutes ?? 1,
  };
  return {
    input: common,
    summer: evaluateWindow(model, { ...common, dates: SUMMER_DATES, startMinute: 7 * 60, endMinute: 17 * 60 }),
    winter: evaluateWindow(model, { ...common, dates: WINTER_DATES, startMinute: 8 * 60, endMinute: 12 * 60 }),
  };
}

export function evaluateMirrorEnvelope(model, { nominalLean }) {
  const results = [];
  for (const lean of [nominalLean - 0.5, nominalLean, nominalLean + 0.5]) {
    for (const planRotation of [9.0, 9.5, 10.0]) {
      for (const bearingOffset of [-1, 0, 1]) {
        results.push(evaluateSolarCandidate(model, {
          mirrorLeanFromVertical: lean,
          planRotation,
          bearingOffset,
          stepMinutes: 1,
        }));
      }
    }
  }
  return {
    nominalLean,
    maximumSummerHits: Math.max(...results.map((result) => result.summer.hits)),
    winterHitRange: [
      Math.min(...results.map((result) => result.winter.hits)),
      Math.max(...results.map((result) => result.winter.hits)),
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const model = JSON.parse(await readFile(new URL('../model/project-model.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify({
    confirmed: evaluateSolarCandidate(model),
    mirrorEnvelope: evaluateMirrorEnvelope(model, {
      nominalLean: model.geometry.solarReflection.mirrorLeanFromVertical.value,
    }),
  }, null, 2));
}
```

- [x] **Step 4: 跑分析測試與 CLI**

Run:

```powershell
node --test tests/solar-angle-analysis.test.mjs
node scripts/solar-angle-analysis.mjs
```

Expected: 2 tests PASS；JSON 顯示 confirmed summer hits `0`、winter hits `684`、8.5° envelope maximum summer hits `0`。

- [x] **Step 5: 把重現命令寫回日照分析**

在 `docs/analysis/solar-analysis.md` 的方法章節加入：

```markdown
重現命令：`node scripts/solar-angle-analysis.mjs`。輸出以模型中的 confirmed 角度與 working 判讀門檻為準；更新比較表前必須先讓 `tests/solar-angle-analysis.test.mjs` 通過。
```

Run:

```powershell
npm.cmd run check:docs
```

Expected: PASS。

- [x] **Step 6: Commit reproducible analysis**

```powershell
git add scripts/solar-angle-analysis.mjs tests/solar-angle-analysis.test.mjs docs/analysis/solar-analysis.md
git commit -m "feat: make solar angle analysis reproducible"
```

### Task 3: 讓 REF-401 顯示 confirmed 鏡牆外傾

**Files:**
- Modify: `tests/reference-model.test.mjs:473-525`
- Modify: `reference/src/sheets.ts:262-295`
- Modify: `docs/contracts/reference-atlas.md`

**Interfaces:**
- Consumes: `model.geometry.solarReflection.mirrorLeanFromVertical.value`。
- Produces: REF-401 鏡牆線、+8.5° 標籤與仍 deferred 的牆高說明。

- [x] **Step 1: 將 REF-401 測試改成 exact angle contract**

在 `tests/reference-model.test.mjs` 的 REF-401 測試中：

```js
for (const token of [
  'entry-outdoor-section',
  'mirror-facade-section',
  'section-concept-note',
  '入口戶外區',
  '位置示意；標高／交界待 OPEN-010',
  '外傾 +8.5°；牆高待 OPEN-011',
]) assert.match(markup, new RegExp(token));

const mirrorHeight = Number(mirror[4]) - Number(mirror[2]);
const mirrorOffset = Number(mirror[3]) - Number(mirror[1]);
assert.ok(closeTo(
  Math.atan2(mirrorOffset, mirrorHeight) * 180 / Math.PI,
  sourceModel.geometry.solarReflection.mirrorLeanFromVertical.value,
  0.05,
));
```

刪除 `assert.doesNotMatch(markup, /9\.5°|\+4\.5°/)` 中對正式鏡牆角度的一概禁止，改成只禁止舊角度與舊文案：

```js
assert.doesNotMatch(markup, /外傾示意；角度待 OPEN-011|9\.5°|\+4\.5°/);
```

- [x] **Step 2: 執行失敗測試**

```powershell
node --test --test-name-pattern="REF-401" tests/reference-model.test.mjs
```

Expected: FAIL，因 renderer 仍使用 18 px 偏移及「角度待 OPEN-011」。

- [x] **Step 3: 由模型角度推導 SVG display angle**

在 `reference/src/sheets.ts` 取代固定 `-18`：

```ts
const mirrorLean = model.geometry.solarReflection.mirrorLeanFromVertical.value;
const mirrorPixelHeight = l2FloorY - volumeTopY;
const mirrorTopX = sx(derived.l2StartX)
  - Math.tan(mirrorLean * Math.PI / 180) * mirrorPixelHeight;
```

將標籤改成：

```ts
<text class="mirror-label section-concept-note" x="${sx(derived.l2StartX) + 18}" y="${volumeTopY + 82}">外傾 +${mirrorLean.toFixed(1)}°；牆高待 OPEN-011</text>
```

保留「SVG 高度是 display-only、不得換算正式牆高」的註解。

- [x] **Step 4: 更新 atlas contract 並驗證**

在 `docs/contracts/reference-atlas.md` 的 REF-401 規則加入：鏡牆顯示 confirmed +8.5°，牆高與性能仍連 `OPEN-011`。

Run:

```powershell
node --test --test-name-pattern="REF-401" tests/reference-model.test.mjs
npm.cmd run check:docs
```

Expected: PASS。

- [x] **Step 5: Commit atlas sync**

```powershell
git add reference/src/sheets.ts tests/reference-model.test.mjs docs/contracts/reference-atlas.md
git commit -m "feat: sync confirmed mirror lean to REF-401"
```

### Task 4: 最後一次同步 solar-study HTML

**Files:**
- Modify: `tests/solar-reflection.test.mjs:15-112`
- Modify: `reference/src/solar-study/main.ts:12-75, 168-285`
- Modify: `reference/solar-study/index.html:20-177`
- Modify: `reference/src/solar-study/styles.css:80-260`
- Modify: `docs/contracts/solar-study.md`

**Interfaces:**
- Consumes: Task 1 的 `geometry.solarReflection`；Task 2 的分析結論只作摘要，不在 browser 重跑全年掃描。
- Produces: 載入時使用 +9.5°／+8.5° 的互動頁、confirmed 摘要、分析文件連結與手機排版。

- [x] **Step 1: 先把 preset 測試改讀模型 confirmed 值**

在 `tests/solar-reflection.test.mjs`：

```js
const solarStudy = model.geometry.solarReflection;

const evaluateConfirmedDesign = (solar) => {
  const reflection = reflectSolarRay({
    solarAltitude: solar.altitude,
    solarAzimuth: solar.azimuth,
    wallNormalAzimuth: poolAzimuth + solarStudy.planRotation.value,
    wallLeanFromVertical: solarStudy.mirrorLeanFromVertical.value,
  });
  return {
    reflection,
    evaluation: evaluatePoolReflection(reflection, {
      poolTargetAzimuth: poolAzimuth,
      azimuthTolerance: solarStudy.azimuthTolerance.value,
      minimumDownwardAngle: solarStudy.minimumDownwardAngle.value,
    }),
  };
};
```

冬、夏測試改為：

```js
test('confirmed design sends winter 09:00 toward the pool', () => {
  const { reflection, evaluation } = evaluateConfirmedDesign(solarAt(12, 21, 9));
  assert.equal(evaluation.hitsPool, true);
  assert.ok(closeTo(reflection.reflectedAzimuth, 138.41, 0.25));
  assert.ok(closeTo(reflection.reflectedDownwardAngle, 43.23, 0.25));
});

test('confirmed design avoids the pool at summer 09:00', () => {
  const { reflection, evaluation } = evaluateConfirmedDesign(solarAt(6, 21, 9));
  assert.equal(reflection.frontLit, true);
  assert.equal(evaluation.hitsPool, false);
  assert.ok(evaluation.azimuthDelta > 85);
});
```

再加入 source contract：

```js
test('solar-study loads confirmed angles from the model and exposes the analysis summary', async () => {
  const [mainSource, html, styles] = await Promise.all([
    readFile(resolve(repoRoot, 'reference/src/solar-study/main.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/solar-study/index.html'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/src/solar-study/styles.css'), 'utf8'),
  ]);
  assert.match(mainSource, /model\.geometry\.solarReflection/);
  assert.doesNotMatch(mainSource, /defaultPlanRotation:\s*4\.5|defaultWallLean:\s*9\.5/);
  assert.match(html, /已確認日照角度/);
  assert.match(html, /水平旋轉 <strong id="confirmed-plan">\+9\.5°<\/strong>/);
  assert.match(html, /鏡牆外傾 <strong id="confirmed-lean">\+8\.5°<\/strong>/);
  assert.match(html, /日照分析完整方法/);
  assert.match(styles, /\.decision-summary/);
});
```

- [x] **Step 2: 執行 solar tests 確認舊預設造成失敗**

```powershell
node --test tests/solar-reflection.test.mjs
```

Expected: confirmed design tests PASS only after model Task 1，source contract FAIL until HTML/TS/CSS sync。

- [x] **Step 3: 讓 TypeScript 只讀模型預設與門檻**

在 `reference/src/solar-study/main.ts` 取代硬編碼 `study`：

```ts
const study = model.geometry.solarReflection;
const defaultPlanRotation = study.planRotation.value;
const defaultWallLean = study.mirrorLeanFromVertical.value;
```

控制器初始化：

```ts
rotationControl.value = String(defaultPlanRotation);
leanControl.value = String(defaultWallLean);
```

判讀門檻：

```ts
const evaluation = evaluatePoolReflection(reflection, {
  poolTargetAzimuth: poolAzimuth,
  azimuthTolerance: study.azimuthTolerance.value,
  minimumDownwardAngle: study.minimumDownwardAngle.value,
});
```

並設定摘要讀值，防止 HTML fallback 漂移：

```ts
required<HTMLElement>('#confirmed-plan').textContent = signed(defaultPlanRotation);
required<HTMLElement>('#confirmed-lean').textContent = signed(defaultWallLean);
required<HTMLElement>('#confirmed-normal').textContent = normalizeAzimuth(poolAzimuth + defaultPlanRotation).toFixed(1) + '°';
```

- [x] **Step 4: 更新 HTML confirmed 摘要與控制器 fallback**

在 facts 後新增：

```html
<section class="decision-summary" aria-labelledby="decision-title">
  <div>
    <p class="eyebrow">CONFIRMED · 0.3.0</p>
    <h2 id="decision-title">已確認日照角度</h2>
    <p>先滿足夏季避開，再提高冬季上午反射機會；控制器仍可用來研究其他組合。</p>
  </div>
  <dl>
    <div><dt>2F 水平旋轉</dt><dd><strong id="confirmed-plan">+9.5°</strong></dd></div>
    <div><dt>鏡牆外傾</dt><dd><strong id="confirmed-lean">+8.5°</strong></dd></div>
    <div><dt>鏡牆法線</dt><dd><strong id="confirmed-normal">136.5°</strong></dd></div>
  </dl>
  <a href="https://github.com/kuohappiness/Swimming-Pool-Design/blob/main/docs/analysis/solar-analysis.md">日照分析完整方法</a>
</section>
```

精確修改以下四個 fallback 屬性／讀值；不改動它們之間的既有 SVG 與 control markup：

```html
<g id="upperBoxPlan" transform="rotate(9.5 60 0)">
<span>2F 水平旋轉 <b id="planValue">+9.5°</b></span>
<input id="planRotation" type="range" min="-12" max="18" value="9.5" step="0.5" />
<span>鏡牆外傾角（相對垂直） <b id="leanValue">8.5°</b></span>
<input id="lean" type="range" min="0" max="30" value="8.5" step="0.5" />
```

將 OPEN-011 note 改成：「水平 +9.5° 與外傾 +8.5° 已確認；旋轉支點、牆高、材料、池面實際命中區、眩光、遮蔭、3D 與熱效益仍待驗證。」

- [x] **Step 5: 加入 desktop／mobile CSS**

在 `reference/src/solar-study/styles.css` 加入：

```css
.decision-summary {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(360px, 1.35fr) auto;
  gap: 18px;
  align-items: center;
  margin: 0 0 24px;
  padding: 18px 20px;
  border: 1px solid #b9d8cb;
  border-radius: 14px;
  background: #edf6f1;
}
.decision-summary h2, .decision-summary p { margin: 0; }
.decision-summary p { color: var(--muted); line-height: 1.55; }
.decision-summary dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
.decision-summary dl div { padding: 10px; border-radius: 9px; background: white; }
.decision-summary dt { color: var(--muted); font-size: 11px; }
.decision-summary dd { margin: 3px 0 0; font-size: 19px; }
.decision-summary a { color: var(--wall); font-weight: 800; }

@media (max-width: 920px) {
  .decision-summary { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .decision-summary { padding: 14px; }
  .decision-summary dl { grid-template-columns: 1fr; }
}
```

- [x] **Step 6: 更新 solar contract 並跑 tests/build**

在 `docs/contracts/solar-study.md`：

- 要求從模型載入 +9.5°／+8.5°，不得在 consumer 另寫第二套預設。
- 要求頁面摘要 confirmed 值、136.5° 法線、夏季優先、完整分析連結與 OPEN-011 剩餘項目。
- 驗收改為 confirmed 組合冬至 09:00 命中、夏至 09:00 避開。

Run:

```powershell
node --test tests/solar-reflection.test.mjs
npm.cmd run build
git diff --check
```

Expected: solar tests PASS；完整 build PASS；`dist/reference/solar-study/index.html` 產生；diff check 無錯誤。

- [x] **Step 7: 進行桌面與 320 px smoke**

Run:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

在桌面與 320 px viewport 驗證：

1. 首屏可讀 `+9.5°`、`+8.5°`、`136.5°`。
2. controls 載入值與摘要一致，拖動後只改研究結果，不改 confirmed 摘要。
3. 冬至 09:00 顯示導向泳池；夏至 09:00 顯示未增加池面反射。
4. 320 px 無水平頁面溢出；表格只在自己的 scroll container 橫向滾動。
5. 分析連結指向 GitHub 的 `docs/analysis/solar-analysis.md`。

完成證據與限制（2026-07-15）：desktop 與 526 px headless 視覺載入已通過；computer-use 的 320 px smoke 因工具逾時，未取得 320 px 實機通過證據。320 px 部分改以 `solar-study panels can shrink without clipping controls on a 320px viewport` source regression，加上 media query 與 overflow 規則的人工審查作為 fallback 驗收。此 Step 的 `[x]` 表示 fallback 驗收完成，不代表 320 px 實機 smoke 已通過。

- [x] **Step 8: Commit solar-study sync**

```powershell
git add tests/solar-reflection.test.mjs reference/src/solar-study/main.ts reference/solar-study/index.html reference/src/solar-study/styles.css docs/contracts/solar-study.md
git commit -m "feat: sync confirmed solar angles to study"
```

### Task 5: 完成 TASK-007 文件生命週期與總驗證

**Files:**
- Modify: `docs/analysis/solar-analysis.md`
- Modify: `docs/03_DESIGN_BASIS.md`
- Modify: `docs/04_DECISIONS_AND_OPEN_ITEMS.md`
- Modify: `docs/07_ACTIVE_WORK.md`
- Move: `docs/specs/2026-07-15-solar-analysis-design.md` → `docs/archive/specs/2026-07-15-solar-analysis-design.md`
- Move: `docs/specs/2026-07-15-solar-analysis-implementation-plan.md` → `docs/archive/specs/2026-07-15-solar-analysis-implementation-plan.md`

**Interfaces:**
- Consumes: Task 1～4 已通過的 model、analysis、atlas、HTML 與測試。
- Produces: `TASK-007 done`、completed specs 與可供 0.3.0 release task引用的驗證證據。

- [x] **Step 1: 同步最終文件狀態**

更新文件：

- `docs/analysis/solar-analysis.md` 加入重現命令與實作完成狀態；保留所有 OPEN-011 限制。
- `docs/03_DESIGN_BASIS.md` 確認 +9.5°／+8.5° 與模型欄位名稱一致。
- `docs/04_DECISIONS_AND_OPEN_ITEMS.md` 保持 `DEC-031`／`DEC-032` confirmed，`OPEN-011` 只保留尚未完成的支點、牆高與性能。
- `docs/07_ACTIVE_WORK.md` 將 `TASK-007` 改為 `done`，並把 design／implementation-plan 連結改指向 `docs/archive/specs/` 的封存路徑。

封存兩份 spec 時，metadata 必須改為：

```markdown
- 狀態：completed
- 完成日期：2026-07-15
```

- [x] **Step 2: 執行完整驗證**

```powershell
npm.cmd run check:docs
npm.cmd run validate:reference
npm.cmd test
npm.cmd run build
git diff --check
git status --short --branch
```

Expected:

- docs check PASS，0 active specs，TASK-007 done。
- reference validation PASS。
- 全部 Node tests PASS。
- Vite build PASS 並產生 atlas 與 solar-study。
- diff check 無 whitespace error。
- status 只包含 TASK-007 計畫內檔案；沒有 `.superpowers/`、`dist/` 或其他暫存檔。

- [x] **Step 3: Commit task completion**

```powershell
git add docs/analysis/solar-analysis.md docs/03_DESIGN_BASIS.md docs/04_DECISIONS_AND_OPEN_ITEMS.md docs/07_ACTIVE_WORK.md docs/archive/specs/2026-07-15-solar-analysis-design.md docs/archive/specs/2026-07-15-solar-analysis-implementation-plan.md
git commit -m "docs: complete TASK-007"
```

- [x] **Step 4: 停在 release 前**

本計畫完成後不修改 `package.json`、`package-lock.json`、`modelVersion` 或 release notes。等 OPEN-010／雨簾等其他 0.3.0 任務完成，再由獨立 release task 統一升版、commit 與 push。
