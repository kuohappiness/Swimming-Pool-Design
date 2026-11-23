import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebModuleServer } from '../../../../support/web-modules.mjs';

const vite = await createWebModuleServer();
test.after(async () => vite.close());
const calendar = await vite.ssrLoadModule('/src/views/solar-study/study-calendar.ts');

test('diagnostic samples cover every whole hour from 07:00 to 18:00', () => {
  assert.equal(calendar.sampleTimes.length, 12);
  assert.equal(calendar.sampleTimes[0], '07:00');
  assert.equal(calendar.sampleTimes.at(-1), '18:00');
  assert.equal(calendar.initialHour(3), 7);
  assert.equal(calendar.initialHour(12), 12);
  assert.equal(calendar.initialHour(23), 18);
});

test('the date slider opens on the solstice itself or on the first of the month', () => {
  const stopAt = (month, day) => calendar.dateStops[calendar.initialDateStopIndex(month, day)];
  assert.deepEqual(stopAt(6, 21), { month: 6, day: 21, milestone: '夏至' });
  assert.deepEqual(stopAt(12, 21), { month: 12, day: 21, milestone: '冬至' });
  assert.deepEqual(stopAt(6, 22), { month: 6, day: 1 });
  assert.deepEqual(stopAt(1, 15), { month: 1, day: 1 });
});

test('seasons follow the analysis: May to September is warm', () => {
  const season = (month) => calendar.periodFor(calendar.studyDate(2026, month)).key;
  assert.deepEqual(
    Array.from({ length: 12 }, (_, index) => season(index + 1)),
    [
      'cool',
      'cool',
      'cool',
      'cool',
      'warm',
      'warm',
      'warm',
      'warm',
      'warm',
      'cool',
      'cool',
      'cool',
    ],
  );
});

test('dates and times read the way the page shows them', () => {
  assert.equal(calendar.minutesFromTime('07:30'), 450);
  assert.equal(calendar.formatTime(450), '07:30');
  assert.equal(calendar.formatTime(18 * 60), '18:00');
  const summer = calendar.studyDate(2026, 6, 21);
  assert.equal(calendar.formatStudyDate(summer), '6月21日（夏至）');
  assert.equal(calendar.formatStudyDate(summer, 2026), '2026年6月21日（夏至）');
  assert.equal(calendar.formatStudyDate(calendar.studyDate(2026, 3, 1)), '3月1日');
});

test('the current local date is read in the site time zone, not the machine time zone', () => {
  // 2026-06-20 16:30 UTC is already 2026-06-21 00:30 in Taipei.
  const instant = new Date(Date.UTC(2026, 5, 20, 16, 30));
  assert.deepEqual(calendar.zonedNow('Asia/Taipei', instant), {
    year: 2026,
    month: 6,
    day: 21,
    hour: 0,
  });
});
