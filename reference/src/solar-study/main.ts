import './styles.css';
import rawModel from '../../../model/project-model.json';
import type { ProjectModel } from '../types';
import {
  calculateSolarPosition,
  deriveSolarPlanOrientation,
  evaluatePoolReflection,
  normalizeAzimuth,
  reflectSolarRay,
} from '../../../scripts/solar-reflection.mjs';

const model = rawModel as ProjectModel;
const location = model.referenceSystem.siteLocation;
const planOrientation = deriveSolarPlanOrientation(model.referenceSystem);
const poolAzimuth = planOrientation.poolFacingAzimuth;
const study = model.geometry.solarReflection;
const defaultPlanRotation = study.planRotation.value;
const defaultWallLean = study.mirrorLeanFromVertical.value;
const sampleHours = Array.from({ length: 12 }, (_, index) => index + 7);
const sampleTimes = sampleHours.map((hour) => String(hour).padStart(2, '0') + ':00');
const dateStops = [
  { month: 1, day: 1 },
  { month: 2, day: 1 },
  { month: 3, day: 1 },
  { month: 4, day: 1 },
  { month: 5, day: 1 },
  { month: 6, day: 1 },
  { month: 6, day: 21, milestone: '夏至' },
  { month: 7, day: 1 },
  { month: 8, day: 1 },
  { month: 9, day: 1 },
  { month: 10, day: 1 },
  { month: 11, day: 1 },
  { month: 12, day: 1 },
  { month: 12, day: 21, milestone: '冬至' },
] as const;
const solstices = {
  winter: { name: '冬至', month: 12, day: 21, color: '#e5a23d' },
  summer: { name: '夏至', month: 6, day: 21, color: '#e15a4f' },
} as const;
type SolsticeKey = keyof typeof solstices;

function taipeiNow(): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: location.timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
  };
}

let studyYear = taipeiNow().year;
let followsCurrentYear = true;

function required<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error('Solar study shell is incomplete: ' + selector);
  return found;
}

const dateControl = required<HTMLInputElement>('#date');
const timeControl = required<HTMLInputElement>('#time');
const yearControl = required<HTMLInputElement>('#year');
const currentYearButton = required<HTMLButtonElement>('#currentYear');
const rotationControl = required<HTMLInputElement>('#planRotation');
const leanControl = required<HTMLInputElement>('#lean');
const dateValue = required<HTMLElement>('#dateValue');
const timeValue = required<HTMLElement>('#timeValue');
const yearValue = required<HTMLElement>('#yearValue');
const planRays = required<SVGGElement>('#planRays');
const selectedSun = required<SVGGElement>('#selectedSun');
const upperBoxPlan = required<SVGGElement>('#upperBoxPlan');
const buildingPlan = required<SVGGElement>('#buildingPlan');
const wallNormal = required<SVGLineElement>('#wallNormal');
const wallAzLabel = required<SVGTextElement>('#wallAzLabel');
const upperSection = required<SVGPolygonElement>('#upperSection');
const wall = required<SVGLineElement>('#wall');
const incoming = required<SVGLineElement>('#incoming');
const reflected = required<SVGLineElement>('#reflected');
const sunArrow = required<SVGPathElement>('#sunArrow');
const reflectedArrow = required<SVGPathElement>('#reflectedArrow');
const sunLabel = required<SVGTextElement>('#sunLabel');
const rayLabel = required<SVGTextElement>('#rayLabel');
const sideLabel = required<SVGTextElement>('#sideLabel');
const result = required<HTMLElement>('#result');
const resultTitle = required<HTMLElement>('#resultTitle');
const resultDetail = required<HTMLElement>('#resultDetail');

required<HTMLElement>('#project-name').textContent = model.project.name;
required<HTMLElement>('#model-version').textContent = 'MODEL ' + model.modelVersion;
required<HTMLElement>('#coord-fact').textContent =
  '基地 ' + location.latitude.value.toFixed(5) + '°N · ' + location.longitude.value.toFixed(5) + '°E';
required<HTMLElement>('#axis-fact').textContent =
  '建築本地 +X ' + model.referenceSystem.localLongAxisBearingFromTrueNorth.toFixed(0) + '°';
required<HTMLElement>('#pool-fact').textContent = '泳池方向 −X ' + poolAzimuth.toFixed(0) + '°';
required<HTMLElement>('#timezone-fact').textContent =
  location.timeZone + ' · UTC+' + location.utcOffsetHours;
required<HTMLElement>('#confirmed-plan').textContent = signed(defaultPlanRotation);
required<HTMLElement>('#confirmed-lean').textContent = signed(defaultWallLean);
required<HTMLElement>('#confirmed-normal').textContent =
  normalizeAzimuth(poolAzimuth + defaultPlanRotation).toFixed(1) + '°';

rotationControl.value = String(defaultPlanRotation);
leanControl.value = String(defaultWallLean);
yearControl.value = String(studyYear);

function initialDateStopIndex(month: number, day: number): number {
  const exactSolstice = dateStops.findIndex((stop) => stop.month === month && stop.day === day);
  if (exactSolstice >= 0) return exactSolstice;
  return Math.max(0, dateStops.findIndex((stop) => stop.month === month && stop.day === 1));
}

const initialNow = taipeiNow();
dateControl.value = String(initialDateStopIndex(initialNow.month, initialNow.day));
timeControl.value = String(Math.max(7, Math.min(18, initialNow.hour)));

function dateAt(month: number, day = 1): Date {
  return new Date(Date.UTC(studyYear, month - 1, day));
}

function minutesFromTime(value: string): number {
  const parts = value.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

function periodFor(date: Date): { key: 'warm' | 'cool'; name: '暖季' | '冷季'; color: string } {
  const month = date.getUTCMonth() + 1;
  return month >= 5 && month <= 9
    ? { key: 'warm', name: '暖季', color: '#e15a4f' }
    : { key: 'cool', name: '冷季', color: '#e5a23d' };
}

function dateMilestone(date: Date): string {
  const key = String(date.getUTCMonth() + 1).padStart(2, '0')
    + '-' + String(date.getUTCDate()).padStart(2, '0');
  const milestones: Record<string, string> = {
    '03-20': '春分',
    '06-21': '夏至',
    '09-23': '秋分',
    '12-21': '冬至',
  };
  return milestones[key] ?? '';
}

function formatDate(date: Date, includeYear = false): string {
  const base = (includeYear ? studyYear + '年' : '')
    + (date.getUTCMonth() + 1) + '月' + date.getUTCDate() + '日';
  const milestone = dateMilestone(date);
  return base + (milestone ? '（' + milestone + '）' : '');
}

function solarAt(month: number, day: number, totalMinutes: number) {
  return calculateSolarPosition({
    year: studyYear,
    month,
    day,
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
    latitude: location.latitude.value,
    longitude: location.longitude.value,
    utcOffsetHours: location.utcOffsetHours,
  });
}

function polar(azimuth: number, radius: number): [number, number] {
  const radians = azimuth * Math.PI / 180;
  return [280 + radius * Math.sin(radians), 235 - radius * Math.cos(radians)];
}

function signed(value: number): string {
  return (value > 0 ? '+' : '') + value.toFixed(1) + '°';
}

function skyPoint(solar: ReturnType<typeof calculateSolarPosition>): [number, number] {
  const altitude = Math.max(0, Math.min(90, solar.altitude));
  const radius = 42 + 136 * Math.cos(altitude * Math.PI / 180);
  return polar(solar.azimuth, radius);
}

function drawPlanPath(date: Date, selectedMinutes: number, color: string): void {
  const fragments: string[] = [];
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const dateLabel = formatDate(date);
  const samples = Array.from({ length: 23 }, (_, index) => 7 * 60 + index * 30)
    .map((minutes) => ({ minutes, solar: solarAt(month, day, minutes) }))
    .filter(({ solar }) => solar.altitude > 0);
  if (samples.length > 1) {
    const points = samples.map(({ solar }) => skyPoint(solar));
    fragments.push(
      '<polyline points="' + points.map((point) => point.map((value) => value.toFixed(1)).join(',')).join(' ')
        + '" stroke="' + color + '" class="solar-path-track current-date"/>',
    );
  }
  sampleTimes.forEach((time) => {
    const minutes = minutesFromTime(time);
    const solar = solarAt(month, day, minutes);
    if (solar.altitude <= 0) return;
    const point = skyPoint(solar);
    const isSelected = minutes === selectedMinutes;
      fragments.push(
        '<g class="solar-hour-point' + (isSelected ? ' is-selected' : '') + '">'
          + '<title>' + dateLabel + ' ' + time + '｜高度 ' + solar.altitude.toFixed(1)
          + '°｜方位 ' + solar.azimuth.toFixed(1) + '°</title>'
          + '<circle cx="' + point[0].toFixed(1) + '" cy="' + point[1].toFixed(1)
          + '" r="' + (isSelected ? '7' : '4') + '" fill="' + color + '" class="solar-path-point"/>'
          + '</g>',
      );
  });
  planRays.innerHTML = fragments.join('');
}

function drawSelectedSun(
  solar: ReturnType<typeof calculateSolarPosition>,
  dateLabel: string,
  time: string,
  color: string,
): void {
  if (solar.altitude <= 0) {
    selectedSun.innerHTML = '<text x="280" y="422" text-anchor="middle" class="sun-below-label">'
      + dateLabel + ' ' + time + ' · 太陽在地平線下</text>';
    return;
  }
  const point = skyPoint(solar);
  const pointRadius = Math.hypot(point[0] - 280, point[1] - 235);
  const labelPoint = polar(solar.azimuth, Math.max(112, pointRadius + 20));
  const placeLabelOnRight = labelPoint[0] < 405;
  const labelX = labelPoint[0] + (placeLabelOnRight ? 12 : -12);
  selectedSun.innerHTML =
    '<line x1="280" y1="235" x2="' + point[0].toFixed(1)
      + '" y2="' + point[1].toFixed(1) + '" stroke="' + color
      + '" class="selected-sun-ray"/>'
      + '<circle cx="' + point[0].toFixed(1)
      + '" cy="' + point[1].toFixed(1)
      + '" r="11" fill="' + color + '" class="selected-sun-point"/>'
      + '<text x="' + labelX.toFixed(1)
      + '" y="' + (labelPoint[1] + 5).toFixed(1)
      + '" text-anchor="' + (placeLabelOnRight ? 'start' : 'end')
      + '" fill="' + color + '" class="selected-sun-label">'
      + dateLabel + ' ' + time + '</text>';
}

function renderSolarTable(): void {
  const rows: string[] = [];
  required<HTMLElement>('#solar-table-head').innerHTML = '<th>季節／時間</th>'
    + sampleTimes.map((time) => '<th>' + time + '</th>').join('');
  (Object.keys(solstices) as SolsticeKey[]).forEach((solsticeKey) => {
    const solstice = solstices[solsticeKey];
    const positions = sampleTimes.map((time) => solarAt(
      solstice.month,
      solstice.day,
      minutesFromTime(time),
    ));
    rows.push(
      '<tr><td>' + solstice.name + '高度角</td>'
        + positions.map((position) => '<td' + (position.altitude <= 0 ? ' class="is-below-horizon"' : '')
          + '>' + position.altitude.toFixed(1) + '°</td>').join('')
        + '</tr>',
    );
    rows.push(
      '<tr><td>' + solstice.name + '方位角</td>'
        + positions.map((position) => '<td>' + position.azimuth.toFixed(1) + '°</td>').join('')
        + '</tr>',
    );
  });
  required<HTMLElement>('#solar-table-body').innerHTML = rows.join('');
}

function update(): void {
  const stop = dateStops[Number(dateControl.value)] ?? dateStops[0];
  const month = stop.month;
  const day = stop.day;
  const hour = Number(timeControl.value);
  const totalMinutes = hour * 60;
  const time = formatTime(totalMinutes);
  const date = dateAt(month, day);
  const period = periodFor(date);
  const rotation = Number(rotationControl.value);
  const lean = Number(leanControl.value);
  const solar = solarAt(month, day, totalMinutes);
  const wallAzimuth = normalizeAzimuth(poolAzimuth + rotation);
  const reflection = reflectSolarRay({
    solarAltitude: solar.altitude,
    solarAzimuth: solar.azimuth,
    wallNormalAzimuth: wallAzimuth,
    wallLeanFromVertical: lean,
  });
  const evaluation = evaluatePoolReflection(reflection, {
    poolTargetAzimuth: poolAzimuth,
    azimuthTolerance: study.azimuthTolerance.value,
    minimumDownwardAngle: study.minimumDownwardAngle.value,
  });

  required<HTMLElement>('#planValue').textContent = signed(rotation);
  required<HTMLElement>('#leanValue').textContent = lean.toFixed(1) + '°';
  yearValue.textContent = (followsCurrentYear ? '自動 · ' : '比較 · ') + studyYear;
  dateValue.textContent = period.name + ' · ' + formatDate(date, true);
  timeValue.textContent = time;
  yearControl.setAttribute('aria-valuetext', studyYear + '年' + (followsCurrentYear ? '，自動跟隨今年' : '，手動比較'));
  dateControl.setAttribute('aria-valuetext', formatDate(date, true) + '，' + period.name);
  timeControl.setAttribute('aria-valuetext', time);
  currentYearButton.disabled = followsCurrentYear;

  buildingPlan.setAttribute(
    'transform',
    'translate(280 235) rotate(' + planOrientation.svgRotationFromLocalX.toFixed(3) + ')',
  );
  upperBoxPlan.setAttribute('transform', 'rotate(' + rotation + ' 60 0)');

  const normalEnd = polar(wallAzimuth, 190);
  wallNormal.setAttribute('x2', normalEnd[0].toFixed(1));
  wallNormal.setAttribute('y2', normalEnd[1].toFixed(1));
  wallAzLabel.setAttribute('x', (normalEnd[0] + (normalEnd[0] > 280 ? 8 : -8)).toFixed(1));
  wallAzLabel.setAttribute('y', (normalEnd[1] + (normalEnd[1] > 235 ? 28 : -16)).toFixed(1));
  wallAzLabel.setAttribute('text-anchor', normalEnd[0] > 280 ? 'start' : 'end');
  wallAzLabel.textContent = '鏡牆法線 ' + wallAzimuth.toFixed(1) + '°';
  drawPlanPath(date, totalMinutes, period.color);
  drawSelectedSun(solar, formatDate(date), time, period.color);

  const bottomX = 495;
  const bottomY = 363;
  const height = 258;
  const topX = bottomX - Math.tan(lean * Math.PI / 180) * height;
  const topY = 105;
  wall.setAttribute('x2', topX.toFixed(1));
  wall.setAttribute('y2', String(topY));
  upperSection.setAttribute(
    'points',
    bottomX + ',' + bottomY + ' 690,' + bottomY + ' 690,' + topY + ' ' + topX.toFixed(1) + ',' + topY,
  );

  required<HTMLElement>('#altitude').textContent = solar.altitude.toFixed(1) + '°';
  required<HTMLElement>('#azimuth').textContent = solar.azimuth.toFixed(1) + '°';
  required<HTMLElement>('#mirrorAz').textContent = wallAzimuth.toFixed(1) + '°';

  if (solar.altitude <= 0) {
    incoming.style.opacity = '0';
    reflected.style.opacity = '0';
    sunLabel.textContent = formatDate(date) + ' ' + time + ' · 太陽在地平線下（高度 '
      + solar.altitude.toFixed(1) + '°）';
    sunLabel.setAttribute('fill', '#6b7f87');
    rayLabel.textContent = '此時無直射太陽光';
    rayLabel.setAttribute('fill', '#6b7f87');
    sideLabel.textContent = '停止繪製入射與反射光；請改選日出後至日落前時刻。';
    required<HTMLElement>('#downAngle').textContent = '—';
    result.classList.remove('is-warn');
    resultTitle.textContent = '此時刻方向診斷：太陽已在地平線下';
    resultDetail.textContent = '沒有可用直射日光，因此不計算鏡面反射命中；年度性能仍以 PVGIS TMY 能量分析為準。';
    return;
  }

  incoming.style.opacity = '1';

  const hitX = bottomX + (topX - bottomX) * 0.54;
  const hitY = bottomY + (topY - bottomY) * 0.54;
  const incomingLength = 310;
  const incomingX = hitX - Math.cos(solar.altitude * Math.PI / 180) * incomingLength;
  const incomingY = hitY - Math.sin(solar.altitude * Math.PI / 180) * incomingLength;
  incoming.setAttribute('x1', incomingX.toFixed(1));
  incoming.setAttribute('y1', Math.max(28, incomingY).toFixed(1));
  incoming.setAttribute('x2', hitX.toFixed(1));
  incoming.setAttribute('y2', hitY.toFixed(1));
  incoming.setAttribute('stroke', period.color);
  sunArrow.setAttribute('fill', period.color);

  const displayDown = Math.max(5, Math.min(78, Math.abs(reflection.reflectedDownwardAngle)));
  const outgoingLength = 250;
  const outgoingX = hitX - Math.cos(displayDown * Math.PI / 180) * outgoingLength;
  const outgoingY = hitY + Math.sin(displayDown * Math.PI / 180) * outgoingLength;
  const reflectedColor = evaluation.hitsPool ? '#1769d2' : '#6b7f87';
  reflected.setAttribute('x1', hitX.toFixed(1));
  reflected.setAttribute('y1', hitY.toFixed(1));
  reflected.setAttribute('x2', outgoingX.toFixed(1));
  reflected.setAttribute('y2', Math.min(332, outgoingY).toFixed(1));
  reflected.setAttribute('stroke', reflectedColor);
  reflected.setAttribute('stroke-dasharray', evaluation.hitsPool ? '' : '8 7');
  reflected.style.opacity = reflection.frontLit ? '1' : '.24';
  reflectedArrow.setAttribute('fill', reflectedColor);

  sunLabel.textContent = formatDate(date) + ' ' + time + ' · 高度 ' + solar.altitude.toFixed(1) + '°';
  sunLabel.setAttribute('fill', period.color);
  rayLabel.textContent = evaluation.hitsPool
    ? '反射朝向池面'
    : (reflection.frontLit ? '反射避開池面' : '鏡牆背光');
  rayLabel.setAttribute('fill', reflectedColor);
  sideLabel.textContent =
    '3D 反射方位 ' + reflection.reflectedAzimuth.toFixed(1)
      + '° · 與池向偏差 ' + evaluation.azimuthDelta.toFixed(1)
      + '° · ' + (evaluation.sectionPass
        ? '向下 ' + reflection.reflectedDownwardAngle.toFixed(1) + '°'
        : '未形成有效下射');

  required<HTMLElement>('#downAngle').textContent = reflection.reflectedDownwardAngle.toFixed(1) + '°';

  const diagnosticPrefix = period.key === 'warm'
    ? '此夏季時刻方向診斷'
    : '此冬季時刻方向診斷';
  result.classList.toggle('is-warn', period.key === 'warm' && evaluation.hitsPool);
  if (!reflection.frontLit) {
    resultTitle.textContent = diagnosticPrefix + '：鏡牆背光';
    resultDetail.textContent = '此方向代理沒有形成正面鏡射；暖冷季性能仍以 PVGIS TMY 有鏡／無鏡能量差為準。';
  } else if (evaluation.hitsPool) {
    resultTitle.textContent = diagnosticPrefix + '：反射朝向池面';
    resultDetail.textContent = period.key === 'warm'
      ? '原本已有直射仍須計入鏡面疊加能量；這是單點方向代理，不是整季 kWh 或熱效益結論。'
      : '平面方位與剖面下射角同時通過方向代理門檻；這不是 kWh、照度或熱效益定量。';
  } else {
    resultTitle.textContent = evaluation.planPass
      ? diagnosticPrefix + '：未形成有效下射'
      : diagnosticPrefix + '：偏離池心';
    resultDetail.textContent = period.key === 'warm'
      ? '此時刻未通過方向代理門檻，但不能直接推論整個暖季零增量；仍須看年度能量分析。'
      : (evaluation.planPass ? '平面方向通過，但剖面反射沒有向下進池。' : '平面反射方向偏離泳池。');
  }
}

renderSolarTable();
update();
dateControl.addEventListener('input', update);
timeControl.addEventListener('input', update);
rotationControl.addEventListener('input', update);
leanControl.addEventListener('input', update);
yearControl.addEventListener('input', () => {
  const nextYear = Number(yearControl.value);
  if (!Number.isInteger(nextYear) || nextYear < 2000 || nextYear > 2100) return;
  studyYear = nextYear;
  followsCurrentYear = false;
  renderSolarTable();
  update();
});
currentYearButton.addEventListener('click', () => {
  studyYear = taipeiNow().year;
  followsCurrentYear = true;
  yearControl.value = String(studyYear);
  renderSolarTable();
  update();
});

function syncCurrentYear(): void {
  if (!followsCurrentYear) return;
  const currentYear = taipeiNow().year;
  if (currentYear === studyYear) return;
  studyYear = currentYear;
  yearControl.value = String(studyYear);
  renderSolarTable();
  update();
}

window.addEventListener('focus', syncCurrentYear);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncCurrentYear();
});
window.setInterval(syncCurrentYear, 60 * 60 * 1000);
