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
  reflectSolarRay,
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
  assert.match(html, /已確認日照角度/);
  assert.match(html, /2F 水平旋轉[\s\S]*?<strong id="confirmed-plan">\+9\.5°<\/strong>/);
  assert.match(html, /鏡牆外傾[\s\S]*?<strong id="confirmed-lean">\+8\.5°<\/strong>/);
  assert.match(html, /鏡牆法線[\s\S]*?<strong id="confirmed-normal">136\.5°<\/strong>/);
  assert.match(html, /日照分析完整方法/);
  assert.match(styles, /\.decision-summary/);
});

test('solar-study panels can shrink without clipping controls on a 320px viewport', async () => {
  const styles = await readFile(resolve(repoRoot, 'reference/src/solar-study/styles.css'), 'utf8');
  assert.match(styles, /\.panel\s*\{[^}]*min-width:\s*0;/s);
});
