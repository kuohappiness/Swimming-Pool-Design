import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
test.after(async () => vite.close());

const {
  SOLAR_TERMS,
  assertSolarMoment,
  dateFromDayOfYear,
  dayOfYear,
  daysInYear,
  describeSolarMoment,
  formatSolarMoment,
  parseSolarMoment,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/solar-moment.ts');
const {
  SUN_ZENITH_INTENSITY,
  WEATHERS,
  atmosphericTransmittance,
  compassPoint,
  computeSunLighting,
  describeSunLighting,
  relativeAirMass,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/sun-lighting.ts');
const { calculateSolarPosition } = await import('../../../../../../../core/solar/solar-reflection.mjs');

const model = JSON.parse(readFileSync(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const siteLocation = model.referenceSystem.siteLocation;
const location = {
  latitude: siteLocation.latitude.value,
  longitude: siteLocation.longitude.value,
  utcOffsetHours: siteLocation.utcOffsetHours,
};
const bearing = model.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth;
const at = (month, day, time, weather = 'clear') => {
  const [hour, minute] = time.split(':').map(Number);
  return computeSunLighting({
    moment: { year: 2026, month, day, minutes: hour * 60 + minute },
    location,
    positiveXAxisBearingFromTrueNorth: bearing,
    weather,
  });
};
const length = (vector) => Math.hypot(vector.x, vector.y, vector.z);
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test('a solar moment round-trips through the URL form and rejects impossible dates', () => {
  const moment = { year: 2026, month: 12, day: 21, minutes: 9 * 60 + 30 };
  assert.equal(formatSolarMoment(moment), '2026-12-21T09:30');
  assert.deepEqual(parseSolarMoment('2026-12-21T09:30'), moment);
  for (const bad of [null, '', '2026-12-21', '2026-02-30T10:00', '2026-13-01T10:00', '2026-12-21T24:00', '2026-12-21T09:60', '2026-12-21T09:30Z']) {
    assert.equal(parseSolarMoment(bad), null, String(bad));
  }
  assert.throws(() => assertSolarMoment({ ...moment, minutes: 1440 }), RangeError);
  assert.throws(() => assertSolarMoment({ ...moment, day: 21.5 }), TypeError);
  assert.deepEqual(describeSolarMoment(moment), { date: '12月21日（冬至）', time: '09:30' });
  assert.deepEqual(describeSolarMoment({ ...moment, day: 20, minutes: 5 }), { date: '12月20日', time: '00:05' });
});

test('day-of-year conversion covers every day of a normal and a leap year', () => {
  for (const year of [2026, 2028]) {
    assert.equal(daysInYear(year), year === 2028 ? 366 : 365);
    for (let ordinal = 1; ordinal <= daysInYear(year); ordinal += 1) {
      const date = dateFromDayOfYear(year, ordinal);
      assert.equal(dayOfYear({ year, ...date }), ordinal);
    }
  }
  assert.deepEqual(dateFromDayOfYear(2026, 0), { month: 1, day: 1 });
  assert.deepEqual(dateFromDayOfYear(2026, 999), { month: 12, day: 31 });
  assert.deepEqual(SOLAR_TERMS.map(({ label, month, day }) => [label, month, day]), [
    ['春分', 3, 20], ['夏至', 6, 21], ['秋分', 9, 23], ['冬至', 12, 21],
  ]);
});

test('the sun position is the solar study function, not a second calculation', () => {
  const lighting = at(12, 21, '09:30');
  const solar = calculateSolarPosition({ year: 2026, month: 12, day: 21, hour: 9, minute: 30, ...location });
  assert.equal(lighting.altitude, solar.altitude);
  assert.equal(lighting.azimuth, solar.azimuth);
  assert.equal(lighting.phase, 'day');
  assert.equal(lighting.key.source, 'sun');
  assert.ok(Math.abs(length(lighting.sunDirection) - 1) < 1e-9);
  assert.ok(Math.abs(lighting.sunDirection.z - Math.sin(solar.altitude * Math.PI / 180)) < 1e-9);
});

test('noon altitudes at this latitude follow the seasons', () => {
  // 正午太陽高度 ≈ 90° − 緯度 ± 23.44°；校址當地的正午（太陽過中天）約在 12:00 前後幾分鐘。
  const highest = (month, day) => {
    let altitude = -90;
    for (let minutes = 11 * 60 + 30; minutes <= 12 * 60 + 30; minutes += 1) {
      altitude = Math.max(altitude, computeSunLighting({
        moment: { year: 2026, month, day, minutes },
        location,
        positiveXAxisBearingFromTrueNorth: bearing,
        weather: 'clear',
      }).altitude);
    }
    return altitude;
  };
  assert.ok(Math.abs(highest(12, 21) - (90 - location.latitude - 23.44)) < 0.3);
  assert.ok(Math.abs(highest(6, 21) - (90 - location.latitude + 23.44)) < 0.3);
  assert.ok(Math.abs(highest(3, 20) - (90 - location.latitude)) < 0.5);
});

test('the sun rises on the east side and sets on the west side of true north', () => {
  const morning = at(3, 20, '07:00');
  const evening = at(3, 20, '17:00');
  assert.ok(morning.azimuth > 60 && morning.azimuth < 120, `morning azimuth ${morning.azimuth}`);
  assert.ok(evening.azimuth > 240 && evening.azimuth < 300, `evening azimuth ${evening.azimuth}`);
  // SITE +X 指向方位 307°（西北）。東方 90° 與它夾 143°，所以早上的太陽在 −X 那一側。
  assert.ok(morning.sunDirection.x < 0);
  assert.ok(evening.sunDirection.x > 0);
  assert.equal(compassPoint(morning.azimuth), '東');
  assert.equal(compassPoint(359), '北');
  assert.equal(compassPoint(-45), '西北');
});

test('low sun is warmer and dimmer than high sun, and never brighter than the zenith limit', () => {
  const noon = at(6, 21, '12:00');
  const low = at(6, 21, '17:45');
  assert.ok(low.altitude > 0 && low.altitude < 15, `low altitude ${low.altitude}`);
  assert.ok(noon.key.intensity > low.key.intensity * 1.5);
  assert.ok(noon.key.intensity <= SUN_ZENITH_INTENSITY);
  assert.ok(noon.key.intensity > SUN_ZENITH_INTENSITY * 0.9);
  const warmth = (color) => color[0] / color[2];
  assert.ok(warmth(low.key.color) > warmth(noon.key.color) * 1.3);
  assert.equal(Math.max(...low.key.color), 1);
  // 空氣質量：天頂 1，30° 約 2，地平線附近數十。
  assert.ok(Math.abs(relativeAirMass(90) - 1) < 0.001);
  assert.ok(Math.abs(relativeAirMass(30) - 2) < 0.01);
  assert.ok(relativeAirMass(0) > 30);
  const [red, green, blue] = atmosphericTransmittance(10);
  assert.ok(red > green && green > blue);
});

test('night switches the key light to a dim moon above the horizon', () => {
  const night = at(12, 21, '22:00');
  assert.equal(night.phase, 'night');
  assert.equal(night.key.source, 'moon');
  assert.ok(night.sunDirection.z < 0);
  assert.ok(night.key.direction.z > 0.5);
  assert.ok(night.key.intensity > 0 && night.key.intensity < 0.4);
  assert.ok(night.sky.intensity < 0.35);
  assert.ok(luminance(night.horizon) < 0.03);
  assert.ok(night.exposure > at(12, 21, '12:00').exposure);
  assert.equal(describeSunLighting(night), '夜間，太陽在地平線下');
  const dawn = at(12, 21, '06:20');
  assert.equal(dawn.phase, 'twilight');
  assert.match(describeSunLighting(dawn), /^天剛亮，太陽在地平線下 \d+°$/);
  assert.match(describeSunLighting(at(12, 21, '09:30')), /^太陽高度 \d+°，在東南方$/);
});

test('the key light never points from below the horizon or grazes it', () => {
  for (let minutes = 0; minutes < 1440; minutes += 10) {
    for (const [month, day] of [[3, 20], [6, 21], [12, 21]]) {
      const lighting = computeSunLighting({
        moment: { year: 2026, month, day, minutes },
        location,
        positiveXAxisBearingFromTrueNorth: bearing,
        weather: 'clear',
      });
      assert.ok(lighting.key.direction.z >= Math.sin(2 * Math.PI / 180) - 1e-9);
      assert.ok(Math.abs(length(lighting.key.direction) - 1) < 1e-9);
      assert.ok(lighting.key.intensity >= 0);
      assert.ok(lighting.sky.intensity > 0);
      for (const channel of [...lighting.key.color, ...lighting.sky.color, ...lighting.horizon]) {
        assert.ok(Number.isFinite(channel) && channel >= 0 && channel <= 1.0001);
      }
    }
  }
});

test('lighting changes smoothly through the day, with no jump at sunrise or sunset', () => {
  let previous = null;
  for (let minutes = 0; minutes < 1440; minutes += 5) {
    const lighting = computeSunLighting({
      moment: { year: 2026, month: 9, day: 23, minutes },
      location,
      positiveXAxisBearingFromTrueNorth: bearing,
      weather: 'clear',
    });
    if (previous) {
      assert.ok(Math.abs(lighting.sky.intensity - previous.sky.intensity) < 0.2, `sky jump at ${minutes}`);
      assert.ok(Math.abs(luminance(lighting.horizon) - luminance(previous.horizon)) < 0.15, `horizon jump at ${minutes}`);
      if (lighting.key.source === previous.key.source) {
        assert.ok(Math.abs(lighting.key.intensity - previous.key.intensity) < 0.5, `key jump at ${minutes}`);
      } else {
        // 太陽與月光交接時兩者都很暗，畫面上看不到切換。
        assert.ok(lighting.key.intensity < 0.35 && previous.key.intensity < 0.35, `handover at ${minutes}`);
      }
    }
    previous = lighting;
  }
});

test('overcast and rain cut the direct sun far more than the sky light', () => {
  assert.deepEqual(WEATHERS, ['clear', 'overcast', 'rain']);
  const clear = at(6, 21, '12:00', 'clear');
  const overcast = at(6, 21, '12:00', 'overcast');
  const rain = at(6, 21, '12:00', 'rain');
  assert.ok(overcast.key.intensity < clear.key.intensity * 0.15);
  assert.ok(rain.key.intensity < overcast.key.intensity);
  assert.ok(overcast.sky.intensity > clear.sky.intensity * 0.7);
  assert.ok(rain.sky.intensity < overcast.sky.intensity);
  assert.ok(rain.fog.far < clear.fog.far);
  assert.ok(luminance(rain.horizon) < luminance(overcast.horizon));
  // 雲把顏色洗成灰白：紅藍差距比晴天小。
  const spread = (color) => Math.max(...color) - Math.min(...color);
  assert.ok(spread(overcast.sky.color) < spread(clear.sky.color));
  // 天氣不影響太陽位置。
  assert.equal(rain.altitude, clear.altitude);
  assert.equal(rain.azimuth, clear.azimuth);
  assert.throws(() => at(6, 21, '12:00', 'snow'), TypeError);
});

test('direct sun outweighs the sky by a few times, so shade reads as shade', () => {
  // 晴天正午：直射光是天光的三到六倍（實際的晴天約四到六倍），陰影裡才明顯比陽光下暗。
  const noon = at(6, 21, '12:00');
  const ratio = noon.key.intensity / noon.sky.intensity;
  assert.ok(ratio > 3 && ratio < 6, `sun to sky ratio was ${ratio}`);
  // 天光強度指的是整片天空照在水平面上的量：晴天正午是 1，陰雨天不會比晴天亮。
  assert.equal(noon.sky.intensity, 1);
  assert.ok(at(6, 21, '12:00', 'overcast').sky.intensity <= 1);
  // 陰雨天畫面整體較暗，曝光往上補；入夜後再補一段，像眼睛適應暗處。
  assert.ok(at(6, 21, '12:00', 'overcast').exposure > noon.exposure);
  assert.ok(at(6, 21, '12:00', 'rain').exposure > noon.exposure);
  assert.ok(at(6, 21, '22:00').exposure > noon.exposure * 2);
});

test('the light source grows from the sun disc to a glowing patch of cloud', () => {
  const degrees = (lighting) => lighting.key.angularRadius * 180 / Math.PI;
  // 晴天的光源比真實的日面（半徑 0.27°）略大一點，邊緣的半影才大於一格陰影貼圖。
  const clear = degrees(at(6, 21, '12:00'));
  assert.ok(clear > 0.27 && clear < 0.6, `clear source radius was ${clear}`);
  const overcast = degrees(at(6, 21, '12:00', 'overcast'));
  const rain = degrees(at(6, 21, '12:00', 'rain'));
  assert.ok(overcast > clear * 5);
  assert.ok(rain > overcast);
  // 月光沿用同一個天氣的光源大小。
  assert.ok(Math.abs(degrees(at(6, 21, '22:00')) - clear) < 1e-9);
});

test('surfaces facing down are lit by the ground the sun and sky light up', () => {
  const noon = at(6, 21, '12:00');
  const morning = at(6, 21, '07:00');
  const overcast = at(6, 21, '12:00', 'overcast');
  const night = at(6, 21, '22:00');
  // 半球光把地面顏色乘上天光強度，所以乘回去才是朝下的面收到的光。
  const bounce = (lighting) => luminance(lighting.sky.groundColor) * lighting.sky.intensity;
  assert.ok(bounce(noon) > bounce(morning), 'a high sun lights the ground more');
  assert.ok(bounce(noon) > bounce(overcast));
  assert.ok(bounce(overcast) > bounce(night));
  assert.ok(bounce(night) > 0);
  // 地面只反射一部分：朝下的面一定比朝上的面暗。
  for (const lighting of [noon, morning, overcast, night]) {
    const facingUp = lighting.sky.intensity * luminance(lighting.sky.color)
      + lighting.key.intensity * luminance(lighting.key.color) * Math.max(0, lighting.key.direction.z);
    assert.ok(bounce(lighting) < facingUp * 0.35, `bounce ${bounce(lighting)} of ${facingUp}`);
    assert.ok(bounce(lighting) > facingUp * 0.2);
  }
});
