import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  WARM_SEASON_MONTHS,
  buildWaterCycleData,
  distanceKm,
  roofPlanArea,
  roofRainfall,
} from '../../../../core/water/roof-rainfall.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const source = JSON.parse(
  await readFile(
    resolve(
      repoRoot,
      'source-materials/data/SRC-DATA-001_cwa-taichung-climate-normals-1991-2020.json',
    ),
    'utf8',
  ),
);
const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );

test('one millimetre of rain on one square metre is one litre', () => {
  const result = roofRainfall({ roofAreaM2: 1, monthlyMm: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
  close(result.months[0].volumeM3, 0.001);
  close(result.annualVolumeM3, 0.001);
  // 100 m² under 250 mm is 25 m³, worked by hand.
  close(
    roofRainfall({ roofAreaM2: 100, monthlyMm: [250, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
      .annualVolumeM3,
    25,
  );
});

test('monthly volumes add up to the annual volume and scale with the roof area', () => {
  const monthlyMm = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const small = roofRainfall({ roofAreaM2: 50, monthlyMm });
  const large = roofRainfall({ roofAreaM2: 150, monthlyMm });
  close(
    small.months.reduce((total, { volumeM3 }) => total + volumeM3, 0),
    small.annualVolumeM3,
  );
  close(large.annualVolumeM3, small.annualVolumeM3 * 3);
  assert.equal(small.annualMm, 780);
  assert.equal(small.wettestMonth.month, 12);
  assert.equal(small.driestMonth.month, 1);
  assert.deepEqual(WARM_SEASON_MONTHS, [5, 6, 7, 8, 9]);
  close(small.warmSeasonShare, (50 + 60 + 70 + 80 + 90) / 780);
  assert.equal(small.warmSeasonMm + small.coolSeasonMm, 780);
  close(small.warmSeasonVolumeM3 + small.coolSeasonVolumeM3, small.annualVolumeM3);
});

test('roof rainfall refuses malformed input instead of guessing', () => {
  const monthlyMm = Array(12).fill(10);
  assert.throws(() => roofRainfall({ roofAreaM2: 0, monthlyMm }), /greater than zero/);
  assert.throws(
    () => roofRainfall({ roofAreaM2: 10, monthlyMm: monthlyMm.slice(1) }),
    /exactly 12 values/,
  );
  assert.throws(
    () => roofRainfall({ roofAreaM2: 10, monthlyMm: [-1, ...monthlyMm.slice(1)] }),
    /must not be negative/,
  );
  assert.throws(
    () => roofRainfall({ roofAreaM2: 10, monthlyMm: [Number.NaN, ...monthlyMm.slice(1)] }),
    /finite/,
  );
  // A transcription slip in one month must not pass silently against the published annual value.
  assert.throws(
    () => roofRainfall({ roofAreaM2: 10, monthlyMm, annualMm: 130 }),
    /adds up to 120\.0 mm/,
  );
  assert.throws(() => roofPlanArea({ x1: 0, x2: 0, y1: 0, y2: 5 }), /greater than zero/);
  assert.throws(() => roofPlanArea({ x1: 0, x2: 5, y1: 0 }), /finite/);
});

test('plan area and distance match hand calculations', () => {
  assert.equal(roofPlanArea({ x1: 2, x2: 12, y1: 1, y2: 5 }), 40);
  // One degree of latitude is about 111.2 km; zero distance to itself.
  close(
    distanceKm({ latitude: 24, longitude: 120 }, { latitude: 25, longitude: 120 }),
    111.195,
    0.01,
  );
  assert.equal(distanceKm({ latitude: 24, longitude: 120 }, { latitude: 24, longitude: 120 }), 0);
});

test('registered Taichung normals are internally consistent', () => {
  assert.equal(source.id, 'SRC-DATA-001');
  assert.equal(source.monthlyPrecipitation.values.length, 12);
  assert.equal(source.monthlyPrecipitationDays.values.length, 12);
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  close(sum(source.monthlyPrecipitation.values), source.monthlyPrecipitation.annual, 0.05);
  close(sum(source.monthlyPrecipitationDays.values), source.monthlyPrecipitationDays.annual, 0.05);
  for (const field of ['provider', 'retrievedOn', 'statisticalPeriod', 'terms', 'transcription']) {
    assert.ok(source[field], `source is missing ${field}`);
  }
  assert.match(source.station.number, /^\d+$/);
});

test('water cycle data applies the normals to the roof and compares with the pool', () => {
  const data = buildWaterCycleData({
    rainfallSource: source,
    roofBounds: { x1: 0, x2: 20, y1: 0, y2: 10 },
    poolVolumeM3: 150,
    site: { latitude: source.station.latitude, longitude: source.station.longitude },
  });
  assert.equal(data.roofAreaM2, 200);
  close(data.annualVolumeM3, (source.monthlyPrecipitation.annual * 200) / 1000);
  assert.equal(data.poolVolumeM3, 150);
  close(data.annualVolumeInPools, data.annualVolumeM3 / 150);
  assert.equal(data.stationDistanceKm, 0);
  assert.equal(data.wettestMonth.month, 8);
  assert.equal(data.driestMonth.month, 11);
  assert.ok(data.warmSeasonShare > 0.7 && data.warmSeasonShare < 0.85);
  assert.equal(data.unit, 'mm');
  assert.throws(
    () =>
      buildWaterCycleData({
        rainfallSource: source,
        roofBounds: { x1: 0, x2: 20, y1: 0, y2: 10 },
        poolVolumeM3: 0,
        site: source.station,
      }),
    /pool volume must be greater than zero/,
  );
});
