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
const times = ['08:00', '09:00', '10:00', '11:00', '12:00'] as const;
const seasons = {
  winter: { name: '冬至', year: 2026, month: 12, day: 21, color: '#e5a23d' },
  summer: { name: '夏至', year: 2026, month: 6, day: 21, color: '#e15a4f' },
} as const;
type SeasonKey = keyof typeof seasons;

function required<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error('Solar study shell is incomplete: ' + selector);
  return found;
}

const seasonControl = required<HTMLSelectElement>('#season');
const timeControl = required<HTMLSelectElement>('#time');
const rotationControl = required<HTMLInputElement>('#planRotation');
const leanControl = required<HTMLInputElement>('#lean');
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

function parseTime(value: string): { hour: number; minute: number } {
  const parts = value.split(':').map(Number);
  return { hour: parts[0], minute: parts[1] };
}

function solarAt(seasonKey: SeasonKey, time: string) {
  const season = seasons[seasonKey];
  const parsed = parseTime(time);
  return calculateSolarPosition({
    year: season.year,
    month: season.month,
    day: season.day,
    hour: parsed.hour,
    minute: parsed.minute,
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

function drawPlanPaths(): void {
  planRays.innerHTML = '';
  (Object.keys(seasons) as SeasonKey[]).forEach((seasonKey) => {
    const season = seasons[seasonKey];
    times.forEach((time, index) => {
      const solar = solarAt(seasonKey, time);
      const radius = 176 - index * 8;
      const point = polar(solar.azimuth, radius);
      const label = index === 0 || index === 2
        ? '<text x="' + (point[0] + (point[0] > 280 ? 9 : -9)).toFixed(1)
          + '" y="' + (point[1] - 7).toFixed(1)
          + '" text-anchor="' + (point[0] > 280 ? 'start' : 'end')
          + '" fill="' + season.color + '" class="solar-path-label">'
          + (seasonKey === 'winter' ? '冬' : '夏') + time.slice(0, 2) + '</text>'
        : '';
      planRays.insertAdjacentHTML(
        'beforeend',
        '<line x1="280" y1="235" x2="' + point[0].toFixed(1)
          + '" y2="' + point[1].toFixed(1)
          + '" stroke="' + season.color
          + '" class="solar-path-line" stroke-dasharray="' + (seasonKey === 'summer' ? '5 5' : '') + '"/>'
          + '<circle cx="' + point[0].toFixed(1)
          + '" cy="' + point[1].toFixed(1)
          + '" r="4.5" fill="' + season.color + '" class="solar-path-point"/>'
          + label,
      );
    });
  });
}

function drawSelectedSun(
  solar: ReturnType<typeof calculateSolarPosition>,
  seasonKey: SeasonKey,
  time: string,
): void {
  const season = seasons[seasonKey];
  const point = polar(solar.azimuth, 190);
  selectedSun.innerHTML =
    '<circle cx="' + point[0].toFixed(1)
      + '" cy="' + point[1].toFixed(1)
      + '" r="11" fill="' + season.color + '" class="selected-sun-point"/>'
      + '<text x="' + (point[0] + (point[0] > 280 ? 14 : -14)).toFixed(1)
      + '" y="' + (point[1] + 5).toFixed(1)
      + '" text-anchor="' + (point[0] > 280 ? 'start' : 'end')
      + '" fill="' + season.color + '" class="selected-sun-label">'
      + season.name + ' ' + time + '</text>';
}

function renderSolarTable(): void {
  const rows: string[] = [];
  (Object.keys(seasons) as SeasonKey[]).forEach((seasonKey) => {
    const season = seasons[seasonKey];
    const positions = times.map((time) => solarAt(seasonKey, time));
    rows.push(
      '<tr><td>' + season.name + '高度角</td>'
        + positions.map((position) => '<td>' + position.altitude.toFixed(1) + '°</td>').join('')
        + '</tr>',
    );
    rows.push(
      '<tr><td>' + season.name + '方位角</td>'
        + positions.map((position) => '<td>' + position.azimuth.toFixed(1) + '°</td>').join('')
        + '</tr>',
    );
  });
  required<HTMLElement>('#solar-table-body').innerHTML = rows.join('');
}

function update(): void {
  const seasonKey = seasonControl.value as SeasonKey;
  const time = timeControl.value;
  const rotation = Number(rotationControl.value);
  const lean = Number(leanControl.value);
  const season = seasons[seasonKey];
  const solar = solarAt(seasonKey, time);
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
  const summerSafe = seasonKey === 'summer' && !evaluation.hitsPool;

  required<HTMLElement>('#planValue').textContent = signed(rotation);
  required<HTMLElement>('#leanValue').textContent = lean.toFixed(1) + '°';

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
  drawSelectedSun(solar, seasonKey, time);

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

  const hitX = bottomX + (topX - bottomX) * 0.54;
  const hitY = bottomY + (topY - bottomY) * 0.54;
  const incomingLength = 310;
  const incomingX = hitX - Math.cos(solar.altitude * Math.PI / 180) * incomingLength;
  const incomingY = hitY - Math.sin(solar.altitude * Math.PI / 180) * incomingLength;
  incoming.setAttribute('x1', incomingX.toFixed(1));
  incoming.setAttribute('y1', Math.max(28, incomingY).toFixed(1));
  incoming.setAttribute('x2', hitX.toFixed(1));
  incoming.setAttribute('y2', hitY.toFixed(1));
  incoming.setAttribute('stroke', season.color);
  sunArrow.setAttribute('fill', season.color);

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

  sunLabel.textContent = season.name + ' ' + time + ' · 高度 ' + solar.altitude.toFixed(1) + '°';
  sunLabel.setAttribute('fill', season.color);
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

  required<HTMLElement>('#altitude').textContent = solar.altitude.toFixed(1) + '°';
  required<HTMLElement>('#azimuth').textContent = solar.azimuth.toFixed(1) + '°';
  required<HTMLElement>('#mirrorAz').textContent = wallAzimuth.toFixed(1) + '°';
  required<HTMLElement>('#downAngle').textContent = reflection.reflectedDownwardAngle.toFixed(1) + '°';

  result.classList.toggle('is-warn', (seasonKey === 'winter' && !evaluation.hitsPool) || (seasonKey === 'summer' && evaluation.hitsPool));
  if (seasonKey === 'winter' && evaluation.hitsPool) {
    resultTitle.textContent = '冬季上午：導向泳池';
    resultDetail.textContent = '平面方位與剖面下射角同時通過概念判讀。';
  } else if (summerSafe) {
    resultTitle.textContent = '夏季上午：未增加池面反射';
    resultDetail.textContent = reflection.frontLit
      ? '反射方向偏離泳池，可望由其他方向離開。'
      : '鏡牆背光，直接鏡面反射能力很低。';
  } else if (seasonKey === 'summer') {
    resultTitle.textContent = '夏季警示：反射仍可能進池';
    resultDetail.textContent = '此角度組合不符合夏季避熱目標，應再調整。';
  } else {
    resultTitle.textContent = '冬季上午：目前未命中';
    resultDetail.textContent = !reflection.frontLit
      ? '鏡牆未受正面日照。'
      : (!evaluation.planPass ? '平面反射方向偏離泳池。' : '剖面反射沒有向下進池。');
  }
}

drawPlanPaths();
renderSolarTable();
update();
seasonControl.addEventListener('change', update);
timeControl.addEventListener('change', update);
rotationControl.addEventListener('input', update);
leanControl.addEventListener('input', update);
