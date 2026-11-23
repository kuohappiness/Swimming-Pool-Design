import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createWebModuleServer } from '../../../../../../support/web-modules.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createWebModuleServer();
test.after(async () => vite.close());

const {
  NIGHT_ALIAS_MINUTES,
  lightingStateFromPreset,
  parseClockTime,
  readLightingParameters,
  sameLightingState,
  siteMomentAt,
  withDate,
  withMinutes,
  withWeather,
  writeLightingParameters,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/lighting-state.ts');
const { computeSunLighting } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/lighting/sun-lighting.ts',
);

const manifest = JSON.parse(
  readFileSync(resolve(repoRoot, 'web/src/views/3d-viewer/scene-manifest.json'), 'utf8'),
);
const model = JSON.parse(readFileSync(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const preset = { month: 12, day: 21, time: '09:30', weather: 'clear' };
const base = lightingStateFromPreset(preset, 2026);

test('a scene preset becomes a moment in the given year', () => {
  assert.deepEqual(base, {
    moment: { year: 2026, month: 12, day: 21, minutes: 570 },
    weather: 'clear',
  });
  assert.equal(parseClockTime('00:00'), 0);
  assert.equal(parseClockTime('23:59'), 1439);
  for (const bad of ['9:30', '24:00', '12:60', '', '12:3', 'noon']) {
    assert.throws(() => parseClockTime(bad), TypeError, bad);
  }
  assert.throws(() => lightingStateFromPreset({ ...preset, weather: 'snow' }, 2026), TypeError);
  assert.throws(() => lightingStateFromPreset({ ...preset, month: 2, day: 30 }, 2026), RangeError);
});

test('every scene carries a valid date, time and weather, and the sun is up unless it rains', () => {
  const siteLocation = model.referenceSystem.siteLocation;
  assert.deepEqual(
    manifest.scenes.map((scene) => scene.id),
    ['overview', 'light', 'rain', 'people', 'time'],
  );
  for (const scene of manifest.scenes) {
    assert.deepEqual(
      Object.keys(scene.lighting).sort(),
      ['day', 'month', 'time', 'weather'],
      scene.id,
    );
    const state = lightingStateFromPreset(scene.lighting, 2026);
    const lighting = computeSunLighting({
      moment: state.moment,
      location: {
        latitude: siteLocation.latitude.value,
        longitude: siteLocation.longitude.value,
        utcOffsetHours: siteLocation.utcOffsetHours,
      },
      positiveXAxisBearingFromTrueNorth:
        model.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
      weather: state.weather,
    });
    assert.equal(lighting.phase, 'day', scene.id);
    // 場景預設的太陽要夠高，影子才讀得出形狀。
    assert.ok(lighting.altitude >= 12, `${scene.id} sun altitude ${lighting.altitude}`);
  }
  const byId = Object.fromEntries(manifest.scenes.map((scene) => [scene.id, scene.lighting]));
  // 「向光」講的是冬季日照；「向雨」是雨天。
  assert.deepEqual([byId.light.month, byId.light.day, byId.light.weather], [12, 21, 'clear']);
  assert.equal(byId.rain.weather, 'rain');
});

test('URL parameters override the scene preset only when they are well formed', () => {
  const read = (query) => readLightingParameters(new URLSearchParams(query), base);
  assert.deepEqual(read(''), base);
  assert.deepEqual(read('time=2026-06-21T12:05&weather=overcast'), {
    moment: { year: 2026, month: 6, day: 21, minutes: 725 },
    weather: 'overcast',
  });
  assert.deepEqual(read('weather=rain'), { moment: base.moment, weather: 'rain' });
  // 寫法不對的值一律忽略，不猜。
  assert.deepEqual(read('time=2026-02-30T10:00&weather=snow'), base);
  assert.deepEqual(read('time=noon'), base);
  // night 是夜景的簡寫：晴天晚上九點；另外給了 time 就以 time 為準。
  assert.deepEqual(read('weather=night'), {
    moment: { ...base.moment, minutes: NIGHT_ALIAS_MINUTES },
    weather: 'clear',
  });
  assert.deepEqual(read('weather=night&time=2026-12-21T05:00'), {
    moment: { ...base.moment, minutes: 300 },
    weather: 'clear',
  });
});

test('the URL stays clean on the scene preset and carries time and weather after a change', () => {
  const parameters = new URLSearchParams(
    'view=3d-viewer&quality=high&time=2026-01-01T00:00&weather=rain',
  );
  writeLightingParameters(parameters, base, base);
  assert.equal(parameters.toString(), 'view=3d-viewer&quality=high');
  const changed = withWeather(withMinutes(base, 16 * 60 + 40), 'overcast');
  writeLightingParameters(parameters, changed, base);
  assert.equal(parameters.get('time'), '2026-12-21T16:40');
  assert.equal(parameters.get('weather'), 'overcast');
  assert.equal(parameters.get('quality'), 'high');
  // 寫出去的網址讀回來是同一個狀態。
  assert.ok(sameLightingState(readLightingParameters(parameters, base), changed));
  assert.equal(sameLightingState(changed, base), false);
});

test('state changes clamp the time and reject impossible dates', () => {
  assert.equal(withMinutes(base, -30).moment.minutes, 0);
  assert.equal(withMinutes(base, 5000).moment.minutes, 1439);
  assert.equal(withMinutes(base, 600.4).moment.minutes, 600);
  assert.deepEqual(withDate(base, { month: 6, day: 21 }).moment, {
    year: 2026,
    month: 6,
    day: 21,
    minutes: 570,
  });
  assert.throws(() => withDate(base, { month: 2, day: 29 }), RangeError);
  assert.throws(() => withWeather(base, 'night'), TypeError);
  assert.equal(withWeather(base, 'rain').moment, base.moment);
});

test('"now" is the wall clock at the school, whatever time zone the browser is in', () => {
  // 2026-12-31T16:30Z 在校址（UTC+8）已經是 2027 年元旦凌晨。
  assert.deepEqual(siteMomentAt(Date.UTC(2026, 11, 31, 16, 30), 8), {
    year: 2027,
    month: 1,
    day: 1,
    minutes: 30,
  });
  assert.deepEqual(siteMomentAt(Date.UTC(2026, 5, 21, 4, 0, 59), 8), {
    year: 2026,
    month: 6,
    day: 21,
    minutes: 720,
  });
});
