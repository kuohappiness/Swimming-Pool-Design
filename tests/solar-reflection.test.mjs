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

test('projects the confirmed mirror geometry onto the working pool surface', () => {
  const solar = solarAt(6, 21, 9);
  const reflection = reflectSolarRay({
    solarAltitude: solar.altitude,
    solarAzimuth: solar.azimuth,
    wallNormalAzimuth: poolAzimuth + solarStudy.planRotation.value,
    wallLeanFromVertical: solarStudy.mirrorLeanFromVertical.value,
  });
  const footprint = projectMirrorReflectionFootprint({
    reflection,
    localLongAxisBearingFromTrueNorth: model.referenceSystem.localLongAxisBearingFromTrueNorth,
    baseCenter: { x: 19, y: 6.75 },
    pivot: { x: 19, y: 6.75 },
    width: 13.5,
    verticalHeight: 3,
    baseElevation: 4.5,
    planRotation: solarStudy.planRotation.value,
    leanFromVertical: solarStudy.mirrorLeanFromVertical.value,
    poolRectangle: { x1: 1.75, x2: 22.25, y1: 3, y2: 10.5 },
  });
  assert.equal(footprint.reachesPoolPlane, true);
  assert.equal(footprint.hitsPool, true);
  assert.equal(footprint.footprint.length, 4);
  assert.ok(closeTo(footprint.footprint[0].x, 17.638, 0.001));
  assert.ok(closeTo(footprint.footprint[0].y, 10.447, 0.001));
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

test('solar-study loads confirmed angles from the model and exposes the analysis summary', async () => {
  const [mainSource, html, styles] = await Promise.all([
    readFile(resolve(repoRoot, 'reference/src/solar-study/main.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/solar-study/index.html'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/src/solar-study/styles.css'), 'utf8'),
  ]);
  assert.match(mainSource, /model\.geometry\.solarReflection/);
  assert.doesNotMatch(mainSource, /defaultPlanRotation:\s*4\.5|defaultWallLean:\s*9\.5/);
  assert.match(html, /已確認角度，性能需季節遮罩/);
  assert.match(html, /2F 水平旋轉[\s\S]*?<strong id="confirmed-plan">\+9\.5°<\/strong>/);
  assert.match(html, /鏡牆外傾[\s\S]*?<strong id="confirmed-lean">\+8\.5°<\/strong>/);
  assert.match(html, /鏡牆法線[\s\S]*?<strong id="confirmed-normal">136\.5°<\/strong>/);
  assert.match(html, /日照分析完整方法/);
  assert.match(html, /暖季增加 786\.673 kWh、冷季增加 3,445\.526 kWh/);
  assert.match(html, /高度 ≤22°、方位 88°～135°/);
  assert.match(html, /工作遮罩冷季收益[\s\S]*?\+597\.5 kWh/);
  assert.match(html, /2,124\.036 kWh/);
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
  assert.doesNotMatch(html, /class="sun-path-index"/);
  assert.match(mainSource, /const dateStops = \[/);
  assert.match(mainSource, /42 \+ 136 \* Math\.cos/);
  assert.match(mainSource, /solar\.altitude <= 0/);
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
