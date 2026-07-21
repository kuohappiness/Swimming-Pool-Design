import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  calculateSolarPosition,
  circularAngleDelta,
  deriveSolarPlanOrientation,
  evaluatePoolReflection,
  normalizeAzimuth,
  polygonIntersectsRectangle,
  projectMirrorReflectionFootprint,
  reflectSolarRay,
  reflectionDirectionInLocalCoordinates,
  solarDirectionInLocalCoordinates,
} from '../scripts/solar-reflection.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const site = model.referenceSystem.siteLocation;
const poolAzimuth = normalizeAzimuth(model.referenceSystem.localLongAxisBearingFromTrueNorth + 180);
const solarStudy = model.geometry.solarReflection;
const activeStudy = solarStudy.v050Study;
const workingAngles = activeStudy.optimization;
const closeTo = (actual, expected, tolerance = 0.15) => Math.abs(actual - expected) <= tolerance;

const solarAt = (month, day, hour) => calculateSolarPosition({
  year: 2026,
  month,
  day,
  hour,
  latitude: site.latitude.value,
  longitude: site.longitude.value,
  utcOffsetHours: site.utcOffsetHours,
});

const evaluateWorkingDesign = (solar) => {
  const reflection = reflectSolarRay({
    solarAltitude: solar.altitude,
    solarAzimuth: solar.azimuth,
    wallNormalAzimuth: poolAzimuth + workingAngles.planRotation.value,
    wallLeanFromVertical: workingAngles.mirrorLeanFromVertical.value,
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

test('calculates representative winter and summer solar positions for the model site', () => {
  const winter = solarAt(12, 21, 9);
  const summer = solarAt(6, 21, 9);
  assert.ok(closeTo(winter.altitude, 26.24));
  assert.ok(closeTo(winter.azimuth, 134.95));
  assert.ok(closeTo(summer.altitude, 49.32));
  assert.ok(closeTo(summer.azimuth, 81.51));
});

test('uses 366 days for leap-year solar positions', () => {
  const commonYear = calculateSolarPosition({
    year: 2027,
    month: 6,
    day: 1,
    hour: 12,
    latitude: site.latitude.value,
    longitude: site.longitude.value,
    utcOffsetHours: site.utcOffsetHours,
  });
  const leapYear = calculateSolarPosition({
    year: 2028,
    month: 6,
    day: 1,
    hour: 12,
    latitude: site.latitude.value,
    longitude: site.longitude.value,
    utcOffsetHours: site.utcOffsetHours,
  });
  assert.ok(closeTo(commonYear.altitude, 87.4934, 0.001));
  assert.ok(closeTo(leapYear.altitude, 87.5747, 0.001));
  assert.ok(Math.abs(leapYear.azimuth - commonYear.azimuth) > 0.4);
});

test('keeps the June 1 near-zenith 11:00 to 12:00 transition numerically reproducible', () => {
  const eleven = solarAt(6, 1, 11);
  const noon = solarAt(6, 1, 12);
  assert.ok(closeTo(eleven.altitude, 77.2235, 0.001));
  assert.ok(closeTo(eleven.azimuth, 97.1791, 0.001));
  assert.ok(closeTo(noon.altitude, 87.4934, 0.001));
  assert.ok(closeTo(noon.azimuth, 209.1322, 0.001));
  assert.ok(noon.altitude > eleven.altitude);
});

test('v0.5.0 working design sends winter noon toward the pool', () => {
  const { reflection, evaluation } = evaluateWorkingDesign(solarAt(12, 21, 12));
  assert.equal(evaluation.hitsPool, true);
  assert.ok(closeTo(reflection.reflectedAzimuth, 122.415, 0.25));
  assert.ok(closeTo(reflection.reflectedDownwardAngle, 47.818, 0.25));
});

test('v0.5.0 working design avoids the pool at summer 09:00', () => {
  const { reflection, evaluation } = evaluateWorkingDesign(solarAt(6, 21, 9));
  assert.equal(reflection.frontLit, true);
  assert.equal(evaluation.hitsPool, false);
  assert.ok(evaluation.azimuthDelta > 85);
});

test('converts the reflected world bearing into the model local coordinate system', () => {
  const direction = reflectionDirectionInLocalCoordinates({
    reflectedAzimuth: 307,
    reflectedDownwardAngle: 30,
  }, 307);
  assert.ok(closeTo(direction.x, Math.cos(Math.PI / 6), 1e-9));
  assert.ok(closeTo(direction.y, 0, 1e-9));
  assert.ok(closeTo(direction.z, -0.5, 1e-9));
});

test('converts the sun bearing into the same model local coordinate system', () => {
  const direction = solarDirectionInLocalCoordinates({ altitude: 30, azimuth: 307 }, 307);
  assert.ok(closeTo(direction.x, Math.cos(Math.PI / 6), 1e-9));
  assert.ok(closeTo(direction.y, 0, 1e-9));
  assert.ok(closeTo(direction.z, 0.5, 1e-9));
});

test('detects polygon overlap with a pool rectangle, including edge crossings', () => {
  const pool = { x1: 1.75, x2: 22.25, y1: 3, y2: 10.5 };
  assert.equal(polygonIntersectsRectangle([
    { x: 17, y: 11 },
    { x: 20, y: -2 },
    { x: 19, y: -4 },
    { x: 16, y: 9 },
  ], pool), true);
  assert.equal(polygonIntersectsRectangle([
    { x: 25, y: 12 },
    { x: 27, y: 12 },
    { x: 27, y: 14 },
    { x: 25, y: 14 },
  ], pool), false);
});

test('projects the v0.5.0 L3 mirror geometry onto the working pool plane', () => {
  const solar = solarAt(6, 21, 9);
  const reflection = reflectSolarRay({
    solarAltitude: solar.altitude,
    solarAzimuth: solar.azimuth,
    wallNormalAzimuth: poolAzimuth + workingAngles.planRotation.value,
    wallLeanFromVertical: workingAngles.mirrorLeanFromVertical.value,
  });
  const footprint = projectMirrorReflectionFootprint({
    reflection,
    localLongAxisBearingFromTrueNorth: model.referenceSystem.localLongAxisBearingFromTrueNorth,
    baseCenter: { x: activeStudy.mirror.baseCenterX, y: activeStudy.floorPlate.width / 2 },
    pivot: { x: activeStudy.planPivot.x, y: activeStudy.planPivot.y },
    width: activeStudy.mirror.width,
    verticalHeight: activeStudy.mirror.height,
    baseElevation: activeStudy.mirror.baseElevation,
    planRotation: workingAngles.planRotation.value,
    leanFromVertical: workingAngles.mirrorLeanFromVertical.value,
    poolRectangle: { x1: 1.75, x2: 22.25, y1: 3, y2: 10.5 },
  });
  assert.equal(footprint.reachesPoolPlane, true);
  assert.equal(footprint.hitsPool, false);
  assert.equal(footprint.footprint.length, 4);
  assert.ok(closeTo(footprint.footprint[0].x, 28.131, 0.001));
  assert.ok(closeTo(footprint.footprint[0].y, 4.724, 0.001));
});

test('azimuth helpers handle north wraparound', () => {
  assert.equal(normalizeAzimuth(-1), 359);
  assert.equal(normalizeAzimuth(361), 1);
  assert.equal(circularAngleDelta(359, 1), 2);
});

test('model owns the correct school identity and one solar location', () => {
  assert.equal(model.project.name, '國立臺中教育大學附設實驗國民小學游泳池改善概念設計');
  assert.ok(closeTo(site.latitude.value, 24.14434, 0.00001));
  assert.ok(closeTo(site.longitude.value, 120.67341, 0.00001));
  assert.equal(site.timeZone, 'Asia/Taipei');
  assert.equal(site.utcOffsetHours, 8);
  assert.equal(poolAzimuth, 127);
});

test('derives the fixed solar plan from the 307 degree world transform without swapping ends', () => {
  assert.deepEqual(deriveSolarPlanOrientation(model.referenceSystem), {
    buildingAzimuth: 307,
    poolFacingAzimuth: 127,
    svgRotationFromLocalX: 217,
  });
});

test('rejects a second fixed-building orientation answer', () => {
  const referenceSystem = structuredClone(model.referenceSystem);
  referenceSystem.worldTransform.rotationFromTrueNorth = 127;
  assert.throws(
    () => deriveSolarPlanOrientation(referenceSystem),
    /orientation fields must match/,
  );
});

test('solar-study consumer rotates the fixed plan from the shared world transform', async () => {
  const mainSource = await readFile(resolve(repoRoot, 'reference/src/solar-study/main.ts'), 'utf8');
  assert.match(
    mainSource,
    /deriveSolarPlanOrientation\(model\.referenceSystem\)/,
  );
  assert.match(
    mainSource,
    /buildingPlan\.setAttribute\([\s\S]*planOrientation\.svgRotationFromLocalX/,
  );
  assert.doesNotMatch(mainSource, /poolAzimuth\s*-\s*90/);
});

test('solar-study loads v0.5.0 working angles from the model and exposes the analysis summary', async () => {
  const [mainSource, html, styles] = await Promise.all([
    readFile(resolve(repoRoot, 'reference/src/solar-study/main.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/solar-study/index.html'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/src/solar-study/styles.css'), 'utf8'),
  ]);
  assert.match(mainSource, /model\.geometry\.solarReflection/);
  assert.match(mainSource, /study\.v050Study/);
  assert.match(html, /L3 新高度讓固定鏡面得到暖季零增量候選/);
  assert.match(html, /L3 水平旋轉[\s\S]*?<strong id="confirmed-plan">\+26\.5°<\/strong>/);
  assert.match(html, /鏡牆外傾[\s\S]*?<strong id="confirmed-lean">\+3\.1°<\/strong>/);
  assert.match(html, /鏡牆法線[\s\S]*?<strong id="confirmed-normal">153\.5°<\/strong>/);
  assert.match(html, /日照分析完整方法/);
  assert.match(html, /暖季池面新增為 0，冷季新增 \+1,022\.903 kWh/);
  assert.match(html, /\+673\.310～\+1,151\.973 kWh/);
  assert.match(html, /1,332\.850 kWh/);
  assert.match(html, /9,055\.633 kWh/);
  assert.doesNotMatch(html, /工作遮罩|高度 ≤22°|方位 88°～135°/);
  assert.match(mainSource, /原本已有直射仍須計入鏡面疊加能量/);
  assert.match(mainSource, /此夏季時刻方向診斷/);
  assert.doesNotMatch(mainSource, /夏季上午：未增加池面反射/);
  assert.match(styles, /\.decision-summary/);
});

test('solar-study exposes continuous year, date, time, and below-horizon interaction', async () => {
  const [mainSource, html] = await Promise.all([
    readFile(resolve(repoRoot, 'reference/src/solar-study/main.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/solar-study/index.html'), 'utf8'),
  ]);
  assert.match(html, /id="year"[\s\S]*?id="currentYear"/);
  assert.match(html, /id="date" type="range" min="0" max="13"/);
  assert.match(html, /每月 1 日，加上 6 月 21 日夏至與 12 月 21 日冬至/);
  assert.match(html, /id="time" type="range" min="7" max="18"/);
  assert.match(html, /id="planRotation" type="range" min="-20" max="40" value="26\.5" step="0\.1"/);
  assert.match(html, /id="rotationTicks"[\s\S]*value="-20"[\s\S]*value="0"[\s\S]*value="40"/);
  assert.doesNotMatch(html, /class="sun-path-index"/);
  assert.match(mainSource, /const dateStops = \[/);
  assert.match(mainSource, /42 \+ 136 \* Math\.cos/);
  assert.match(mainSource, /solar\.altitude <= 0/);
  assert.match(mainSource, /wallAzimuth = normalizeAzimuth\(poolAzimuth \+ rotation\)/);
  assert.match(mainSource, /upperBoxPlan\.setAttribute\('transform', 'rotate\(' \+ rotation/);
  assert.match(mainSource, /rotationControl\.setAttribute\('aria-valuetext'/);
  assert.match(mainSource, /rotationControl\.addEventListener\('input', update\)/);
  assert.match(mainSource, /window\.setInterval\(syncCurrentYear/);
});

test('solar-study panels can shrink without clipping controls on a 320px viewport', async () => {
  const styles = await readFile(resolve(repoRoot, 'reference/src/solar-study/styles.css'), 'utf8');
  assert.match(styles, /\.panel\s*\{[^}]*min-width:\s*0;/s);
});

test('solar-study keeps a sticky live diagram beside mobile controls', async () => {
  const [mainSource, html, styles] = await Promise.all([
    readFile(resolve(repoRoot, 'reference/src/solar-study/main.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/solar-study/index.html'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/src/solar-study/styles.css'), 'utf8'),
  ]);
  assert.match(html, /class="mobile-live-preview"[\s\S]*id="previewPlan"[\s\S]*id="previewSection"/);
  assert.match(mainSource, /bindMobilePreview\(dateControl, 'plan'\)/);
  assert.match(mainSource, /bindMobilePreview\(leanControl, 'section'\)/);
  assert.match(mainSource, /mobilePreviewViewport\.replaceChildren\(clonePreviewSvg/);
  assert.match(styles, /@media \(max-width: 920px\)[\s\S]*\.mobile-live-preview\s*\{[\s\S]*position:\s*sticky/);
});
