import rawModel from '../../../model/project-model.json';
import generatedViewerModel from '../../generated/viewer-model.json';
import type { ProjectModel } from '../types';
import { resolveActiveGeometry } from '../../../scripts/active-geometry.mjs';
import {
  calculateSolarPosition,
  deriveSolarPlanOrientation,
  evaluatePoolReflection,
  normalizeAzimuth,
  reflectSolarRay,
} from '../../../scripts/solar-reflection.mjs';
import { deriveMirrorNormalAzimuth } from '../../../scripts/site-orientation.mjs';

const model = rawModel as unknown as ProjectModel;

export function destroySolarStudy(): void {
  mobilePreviewMedia.removeEventListener('change', renderLivePreview);
  window.removeEventListener('focus', syncCurrentYear);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.clearInterval(currentYearInterval);
}
const location = model.referenceSystem.siteLocation;
const planOrientation = deriveSolarPlanOrientation(model.referenceSystem);
const poolAzimuth = planOrientation.poolFacingAzimuth;
const activeStudy = resolveActiveGeometry(model) as unknown as {
  id: string;
  revision: string;
  solar: {
    planRotation: { value: number };
    mirrorLeanFromVertical: { value: number };
    azimuthTolerance: { value: number };
    minimumDownwardAngle: { value: number };
    analysisMethodRevision: string;
    energyAssumptions: {
      mirrorReflectance: number;
      glazingSolarTransmittance: number;
      daylightStartHour: number;
      daylightEndHour: number;
    };
    workingResult: {
      warmPoolAddedKWh: number;
      coolPoolAddedKWh: number;
      coolPoolIncreasePercent: number;
    };
  };
};
const study = activeStudy.solar;
const optimization = study;
const defaultPlanRotation = optimization.planRotation.value;
const defaultWallLean = optimization.mirrorLeanFromVertical.value;
const diagnosticStartHour = 7;
const diagnosticEndHour = 18;
const sampleHours = Array.from(
  { length: diagnosticEndHour - diagnosticStartHour + 1 },
  (_, index) => index + diagnosticStartHour,
);
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
const planSvg = required<SVGSVGElement>('#plan');
const sectionSvg = required<SVGSVGElement>('#section');
const previewPlanButton = required<HTMLButtonElement>('#previewPlan');
const previewSectionButton = required<HTMLButtonElement>('#previewSection');
const desktopPlanPreviewViewport = required<HTMLElement>('#desktopPlanPreviewViewport');
const desktopSectionPreviewViewport = required<HTMLElement>('#desktopSectionPreviewViewport');
const mobilePreviewViewport = required<HTMLElement>('#mobilePreviewViewport');
const planRays = required<SVGGElement>('#planRays');
const selectedSun = required<SVGGElement>('#selectedSun');
const upperBoxPlan = required<SVGGElement>('#upperBoxPlan');
const buildingPlan = required<SVGGElement>('#buildingPlan');
const mirrorEdge = required<SVGLineElement>('.mirror-edge');
const studyPivot = required<SVGCircleElement>('.study-pivot');
const wallNormal = required<SVGLineElement>('#wallNormal');
const wallAzLabel = required<SVGTextElement>('#wallAzLabel');
const azimuthToleranceFan = required<SVGPathElement>('#azimuthToleranceFan');
const azimuthToleranceStart = required<SVGLineElement>('#azimuthToleranceStart');
const azimuthToleranceEnd = required<SVGLineElement>('#azimuthToleranceEnd');
const azimuthToleranceLabel = required<SVGTextElement>('#azimuthToleranceLabel');
const planIncomingArrow = required<SVGPathElement>('#planIncomingArrow');
const planReflectedArrow = required<SVGPathElement>('#planReflectedArrow');
const planIncidentPoint = required<SVGCircleElement>('#planIncidentPoint');
const upperSection = required<SVGPolygonElement>('#upperSection');
const wall = required<SVGLineElement>('#wall');
const minimumDownwardLine = required<SVGLineElement>('#minimumDownwardLine');
const minimumDownwardLabel = required<SVGTextElement>('#minimumDownwardLabel');
const incoming = required<SVGPolylineElement>('#incoming');
const reflected = required<SVGPolylineElement>('#reflected');
const sunArrow = required<SVGPathElement>('#sunArrow');
const reflectedArrow = required<SVGPathElement>('#reflectedArrow');
const sunLabel = required<SVGTextElement>('#sunLabel');
const rayLabel = required<SVGTextElement>('#rayLabel');
const sideLabel = required<SVGTextElement>('#sideLabel');
const result = required<HTMLElement>('#result');
const resultTitle = required<HTMLElement>('#resultTitle');
const resultDetail = required<HTMLElement>('#resultDetail');
const timeScope = required<HTMLElement>('#timeScope');
type MobilePreviewMode = 'plan' | 'section';
const mobilePreviewMedia = window.matchMedia('(max-width: 640px)');
let mobilePreviewMode: MobilePreviewMode = 'plan';

function clonePreviewSvg(source: SVGSVGElement, idPrefix: string): SVGSVGElement {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('id');
  clone.removeAttribute('role');
  clone.removeAttribute('aria-labelledby');
  clone.removeAttribute('aria-describedby');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('focusable', 'false');

  const idMap = new Map<string, string>();
  Array.from(clone.querySelectorAll<SVGElement>('[id]')).forEach((element) => {
    const oldId = element.id;
    const newId = idPrefix + '-' + oldId;
    idMap.set(oldId, newId);
    element.id = newId;
  });

  Array.from(clone.querySelectorAll<SVGElement>('*')).forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      let value = attribute.value;
      idMap.forEach((newId, oldId) => {
        value = value.replaceAll('url(#' + oldId + ')', 'url(#' + newId + ')');
        if (value === '#' + oldId) value = '#' + newId;
        if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') {
          value = value.split(/\s+/).map((token) => token === oldId ? newId : token).join(' ');
        }
      });
      if (value !== attribute.value) element.setAttribute(attribute.name, value);
    });
  });

  return clone;
}

function renderLivePreview(): void {
  if (mobilePreviewMedia.matches) {
    desktopPlanPreviewViewport.replaceChildren();
    desktopSectionPreviewViewport.replaceChildren();
    const source = mobilePreviewMode === 'plan' ? planSvg : sectionSvg;
    mobilePreviewViewport.replaceChildren(
      clonePreviewSvg(source, 'mobile-preview-' + mobilePreviewMode),
    );
    previewPlanButton.setAttribute('aria-pressed', String(mobilePreviewMode === 'plan'));
    previewSectionButton.setAttribute('aria-pressed', String(mobilePreviewMode === 'section'));
    return;
  }
  mobilePreviewViewport.replaceChildren();
  desktopPlanPreviewViewport.replaceChildren(
    clonePreviewSvg(planSvg, 'desktop-preview-plan'),
  );
  desktopSectionPreviewViewport.replaceChildren(
    clonePreviewSvg(sectionSvg, 'desktop-preview-section'),
  );
}

function setMobilePreview(mode: MobilePreviewMode): void {
  mobilePreviewMode = mode;
  renderLivePreview();
}

required<HTMLElement>('#tableStudyVersion').textContent = 'STUDY ' + activeStudy.revision;
if (
  generatedViewerModel.modelVersion !== model.modelVersion
  || generatedViewerModel.activeGeometryRevisionId !== activeStudy.id
) {
  throw new Error('Generated solar analysis status does not match the active model.');
}
required<HTMLElement>('#coord-fact').textContent =
  '基地 ' + location.latitude.value.toFixed(5) + '°N · ' + location.longitude.value.toFixed(5) + '°E';
required<HTMLElement>('#axis-fact').textContent =
  '建築本地 +X ' + planOrientation.buildingAzimuth.toFixed(0) + '°';
required<HTMLElement>('#pool-fact').textContent = '泳池方向 −X ' + poolAzimuth.toFixed(0) + '°';
required<HTMLElement>('#timezone-fact').textContent =
  location.timeZone + ' · UTC+' + location.utcOffsetHours;
const energyFormatter = new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});
required<HTMLElement>('#conclusion-plan-rotation').textContent = signed(defaultPlanRotation);
required<HTMLElement>('#conclusion-wall-lean').textContent = signed(defaultWallLean);
required<HTMLElement>('#conclusion-cool-gain').textContent =
  '+' + energyFormatter.format(study.workingResult.coolPoolAddedKWh) + ' kWh';
required<HTMLElement>('#conclusion-cool-percent').textContent =
  '+' + study.workingResult.coolPoolIncreasePercent.toFixed(3) + '%';
required<HTMLElement>('#conclusion-warm-gain').textContent =
  energyFormatter.format(study.workingResult.warmPoolAddedKWh) + ' kWh';

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
timeControl.value = String(
  Math.max(diagnosticStartHour, Math.min(diagnosticEndHour, initialNow.hour)),
);

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
  return pointFromAzimuth([280, 235], azimuth, radius);
}

function pointFromAzimuth(
  origin: [number, number],
  azimuth: number,
  radius: number,
): [number, number] {
  const radians = azimuth * Math.PI / 180;
  return [
    origin[0] + radius * Math.sin(radians),
    origin[1] - radius * Math.cos(radians),
  ];
}

function pointFromOriginToward(
  origin: [number, number],
  target: [number, number],
  distance: number,
): [number, number] {
  const deltaX = target[0] - origin[0];
  const deltaY = target[1] - origin[1];
  const length = Math.hypot(deltaX, deltaY);
  if (length <= 1e-9) return origin;
  return [
    origin[0] + deltaX / length * distance,
    origin[1] + deltaY / length * distance,
  ];
}

function rotateSvgPoint(
  point: [number, number],
  pivot: [number, number],
  degrees: number,
): [number, number] {
  const radians = degrees * Math.PI / 180;
  const x = point[0] - pivot[0];
  const y = point[1] - pivot[1];
  return [
    pivot[0] + x * Math.cos(radians) - y * Math.sin(radians),
    pivot[1] + x * Math.sin(radians) + y * Math.cos(radians),
  ];
}

function mirrorWallCenter(rotation: number): [number, number] {
  const localCenter: [number, number] = [
    (Number(mirrorEdge.getAttribute('x1')) + Number(mirrorEdge.getAttribute('x2'))) / 2,
    (Number(mirrorEdge.getAttribute('y1')) + Number(mirrorEdge.getAttribute('y2'))) / 2,
  ];
  const pivot: [number, number] = [
    Number(studyPivot.getAttribute('cx')),
    Number(studyPivot.getAttribute('cy')),
  ];
  const rotatedCenter = rotateSvgPoint(localCenter, pivot, rotation);
  const siteOrientedCenter = rotateSvgPoint(
    rotatedCenter,
    [0, 0],
    planOrientation.svgRotationFromLocalX,
  );
  return [280 + siteOrientedCenter[0], 235 + siteOrientedCenter[1]];
}

function renderPlanTolerance(): void {
  const radius = 172;
  const tolerance = study.azimuthTolerance.value;
  const startAzimuth = normalizeAzimuth(poolAzimuth - tolerance);
  const endAzimuth = normalizeAzimuth(poolAzimuth + tolerance);
  const start = polar(startAzimuth, radius);
  const end = polar(endAzimuth, radius);
  const label = polar(poolAzimuth, 146);
  const largeArc = tolerance * 2 > 180 ? 1 : 0;

  azimuthToleranceFan.setAttribute(
    'd',
    'M 280 235 L ' + start[0].toFixed(1) + ' ' + start[1].toFixed(1)
      + ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 '
      + end[0].toFixed(1) + ' ' + end[1].toFixed(1) + ' Z',
  );
  for (const [line, point] of [
    [azimuthToleranceStart, start],
    [azimuthToleranceEnd, end],
  ] as const) {
    line.setAttribute('x1', '280');
    line.setAttribute('y1', '235');
    line.setAttribute('x2', point[0].toFixed(1));
    line.setAttribute('y2', point[1].toFixed(1));
  }
  azimuthToleranceLabel.setAttribute('x', label[0].toFixed(1));
  azimuthToleranceLabel.setAttribute('y', label[1].toFixed(1));
  azimuthToleranceLabel.setAttribute('text-anchor', label[0] >= 280 ? 'start' : 'end');
  azimuthToleranceLabel.textContent = '池向方位容許 ±' + tolerance.toFixed(0) + '°';
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
  reflection: ReturnType<typeof reflectSolarRay>,
  dateLabel: string,
  time: string,
  color: string,
  incidentPoint: [number, number],
): void {
  planIncidentPoint.setAttribute('cx', incidentPoint[0].toFixed(1));
  planIncidentPoint.setAttribute('cy', incidentPoint[1].toFixed(1));
  if (solar.altitude <= 0) {
    selectedSun.dataset.reflectionState = 'below-horizon';
    selectedSun.innerHTML = '<text x="280" y="422" text-anchor="middle" class="sun-below-label">'
      + dateLabel + ' ' + time + ' · 太陽在地平線下</text>';
    return;
  }
  const point = skyPoint(solar);
  const pointRadius = Math.hypot(point[0] - 280, point[1] - 235);
  const labelPoint = polar(solar.azimuth, Math.max(112, pointRadius + 20));
  const placeLabelOnRight = labelPoint[0] < 405;
  const labelX = labelPoint[0] + (placeLabelOnRight ? 12 : -12);
  const reflectedPoint = pointFromAzimuth(incidentPoint, reflection.reflectedAzimuth, 164);
  const rayGap = 10;
  const incomingEnd = pointFromOriginToward(incidentPoint, point, rayGap);
  const reflectedStart = pointFromOriginToward(incidentPoint, reflectedPoint, rayGap);
  const reflectionExtendsRight = reflectedPoint[0] >= incidentPoint[0];
  const reflectedLabelX = reflectedPoint[0] + (reflectionExtendsRight ? -9 : 9);
  const reflectedLabelY = reflectedPoint[1] + (reflectedPoint[1] >= 235 ? 18 : -10);
  const incomingMidpoint = [
    (point[0] + incomingEnd[0]) / 2,
    (point[1] + incomingEnd[1]) / 2,
  ];
  const reflectedMidpoint = [
    (reflectedStart[0] + reflectedPoint[0]) / 2,
    (reflectedStart[1] + reflectedPoint[1]) / 2,
  ];
  const validReflection = reflection.frontLit && reflection.reflectedFrontSide;
  planIncomingArrow.setAttribute('fill', color);
  planReflectedArrow.setAttribute('fill', color);
  selectedSun.dataset.reflectionState = validReflection
    ? 'front-lit'
    : (reflection.frontLit ? 'invalid-reflection' : 'back-lit');
  selectedSun.dataset.frontHalfSpaceDot = reflection.frontHalfSpaceDot.toFixed(6);
  const reflectedMarkup = validReflection
    ? '<polyline points="' + reflectedStart.map((value) => value.toFixed(1)).join(',') + ' '
      + reflectedMidpoint.map((value) => value.toFixed(1)).join(',') + ' '
      + reflectedPoint.map((value) => value.toFixed(1)).join(',')
      + '" stroke="' + color
      + '" class="selected-reflected-ray" marker-end="url(#plan-arrow-reflected)"'
      + ' aria-label="3D 反射光水平投影，方位 '
      + reflection.reflectedAzimuth.toFixed(1) + ' 度，下射角 '
      + reflection.reflectedDownwardAngle.toFixed(1) + ' 度"/>'
      + '<text x="' + reflectedLabelX.toFixed(1)
      + '" y="' + reflectedLabelY.toFixed(1)
      + '" text-anchor="' + (reflectionExtendsRight ? 'end' : 'start')
      + '" fill="' + color + '" class="selected-reflection-label">反射方位投影 '
      + reflection.reflectedAzimuth.toFixed(1) + '° · 下射角 '
      + reflection.reflectedDownwardAngle.toFixed(1) + '°</text>'
    : '';
  selectedSun.innerHTML =
    reflectedMarkup
      + '<polyline points="' + point.map((value) => value.toFixed(1)).join(',') + ' '
      + incomingMidpoint.map((value) => value.toFixed(1)).join(',') + ' '
      + incomingEnd.map((value) => value.toFixed(1)).join(',')
      + '" stroke="' + color
      + '" class="selected-sun-ray" marker-end="url(#plan-arrow-incoming)"/>'
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
  const wallAzimuth = deriveMirrorNormalAzimuth(model.referenceSystem, rotation);
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
  rotationControl.setAttribute('aria-valuetext', '3F 水平旋轉 ' + signed(rotation));
  leanControl.setAttribute('aria-valuetext', '鏡牆外傾 ' + lean.toFixed(1) + '°');
  currentYearButton.disabled = followsCurrentYear;
  const energyStart = study.energyAssumptions.daylightStartHour;
  const energyEnd = study.energyAssumptions.daylightEndHour;
  const inEnergyWindow = hour >= energyStart && hour <= energyEnd;
  timeScope.textContent =
    '方向診斷 ' + String(diagnosticStartHour).padStart(2, '0') + ':00–'
      + String(diagnosticEndHour).padStart(2, '0') + ':00 · 年度能量 '
      + String(energyStart).padStart(2, '0') + ':00–'
      + String(energyEnd).padStart(2, '0') + ':00'
      + (inEnergyWindow ? '' : ' · 本時刻僅供方向診斷，不納入年度能量時段');

  buildingPlan.setAttribute(
    'transform',
    'translate(280 235) rotate(' + planOrientation.svgRotationFromLocalX.toFixed(3) + ')',
  );
  upperBoxPlan.setAttribute('transform', 'rotate(' + rotation + ' 60 0)');

  const incidentPoint = mirrorWallCenter(rotation);
  const normalEnd = pointFromAzimuth(incidentPoint, wallAzimuth, 190);
  wallNormal.setAttribute('x1', incidentPoint[0].toFixed(1));
  wallNormal.setAttribute('y1', incidentPoint[1].toFixed(1));
  wallNormal.setAttribute('x2', normalEnd[0].toFixed(1));
  wallNormal.setAttribute('y2', normalEnd[1].toFixed(1));
  wallAzLabel.setAttribute('x', (normalEnd[0] + (normalEnd[0] > 280 ? 8 : -8)).toFixed(1));
  wallAzLabel.setAttribute('y', (normalEnd[1] + (normalEnd[1] > 235 ? 28 : -16)).toFixed(1));
  wallAzLabel.setAttribute('text-anchor', normalEnd[0] > 280 ? 'start' : 'end');
  wallAzLabel.textContent = '鏡牆法線 ' + wallAzimuth.toFixed(1) + '°';
  drawPlanPath(date, totalMinutes, period.color);
  drawSelectedSun(solar, reflection, formatDate(date), time, period.color, incidentPoint);

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
  const minimumDownwardRadians = study.minimumDownwardAngle.value * Math.PI / 180;
  const minimumDownwardLength = 225;
  const minimumDownwardX = hitX - Math.cos(minimumDownwardRadians) * minimumDownwardLength;
  const minimumDownwardY = hitY + Math.sin(minimumDownwardRadians) * minimumDownwardLength;
  minimumDownwardLine.setAttribute('x1', hitX.toFixed(1));
  minimumDownwardLine.setAttribute('y1', hitY.toFixed(1));
  minimumDownwardLine.setAttribute('x2', minimumDownwardX.toFixed(1));
  minimumDownwardLine.setAttribute('y2', minimumDownwardY.toFixed(1));
  minimumDownwardLabel.setAttribute('x', (minimumDownwardX + 5).toFixed(1));
  minimumDownwardLabel.setAttribute('y', (minimumDownwardY - 8).toFixed(1));
  minimumDownwardLabel.textContent =
    '最低下射 ' + study.minimumDownwardAngle.value.toFixed(0) + '°（方向代理）';

  required<HTMLElement>('#altitude').textContent = solar.altitude.toFixed(1) + '°';
  required<HTMLElement>('#azimuth').textContent = solar.azimuth.toFixed(1) + '°';
  required<HTMLElement>('#mirrorAz').textContent = wallAzimuth.toFixed(1) + '°';

  if (solar.altitude <= 0) {
    incoming.style.opacity = '0';
    reflected.style.opacity = '0';
    reflected.dataset.reflectionState = 'below-horizon';
    reflected.setAttribute('aria-label', '此時無反射光');
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
    renderLivePreview();
    return;
  }

  incoming.style.opacity = '1';

  const incomingLength = 310;
  const incomingX = hitX - Math.cos(solar.altitude * Math.PI / 180) * incomingLength;
  const incomingY = hitY - Math.sin(solar.altitude * Math.PI / 180) * incomingLength;
  const incomingStartY = Math.max(28, incomingY);
  incoming.setAttribute(
    'points',
    incomingX.toFixed(1) + ',' + incomingStartY.toFixed(1) + ' '
      + ((incomingX + hitX) / 2).toFixed(1) + ','
      + ((incomingStartY + hitY) / 2).toFixed(1) + ' '
      + hitX.toFixed(1) + ',' + hitY.toFixed(1),
  );
  incoming.setAttribute('stroke', period.color);
  sunArrow.setAttribute('fill', period.color);

  const displayDown = Math.max(5, Math.min(78, Math.abs(reflection.reflectedDownwardAngle)));
  const displayVerticalDirection = reflection.reflectedDownwardAngle >= 0 ? 1 : -1;
  const outgoingLength = 250;
  const outgoingX = hitX - Math.cos(displayDown * Math.PI / 180) * outgoingLength;
  const outgoingY = hitY
    + displayVerticalDirection * Math.sin(displayDown * Math.PI / 180) * outgoingLength;
  const outgoingEndY = Math.max(28, Math.min(332, outgoingY));
  const reflectedColor = period.color;
  const hasValidReflection = reflection.frontLit && reflection.reflectedFrontSide;
  const sectionReflectionState = !reflection.frontLit
    ? 'back-lit'
    : (!reflection.reflectedFrontSide
      ? 'invalid-reflection'
      : (evaluation.hitsPool ? 'hits-pool' : 'misses-pool'));
  reflected.setAttribute(
    'points',
    hitX.toFixed(1) + ',' + hitY.toFixed(1) + ' '
      + ((hitX + outgoingX) / 2).toFixed(1) + ','
      + ((hitY + outgoingEndY) / 2).toFixed(1) + ' '
      + outgoingX.toFixed(1) + ',' + outgoingEndY.toFixed(1),
  );
  reflected.setAttribute('stroke', reflectedColor);
  reflected.setAttribute('stroke-dasharray', '8 7');
  reflected.style.opacity = hasValidReflection ? '1' : '0';
  reflected.dataset.reflectionState = sectionReflectionState;
  reflected.setAttribute(
    'aria-label',
    sectionReflectionState === 'hits-pool'
      ? '反射光，命中池面'
      : (sectionReflectionState === 'misses-pool'
        ? '反射光，未命中池面'
        : (sectionReflectionState === 'invalid-reflection'
          ? '反射向量未位於鏡面正面，已停止繪製'
          : '鏡牆背光，無有效反射')),
  );
  reflectedArrow.setAttribute('fill', reflectedColor);

  sunLabel.textContent = formatDate(date) + ' ' + time + ' · 高度 ' + solar.altitude.toFixed(1) + '°';
  sunLabel.setAttribute('fill', period.color);
  rayLabel.textContent = evaluation.hitsPool
    ? '反射光（命中池面）'
    : (hasValidReflection
      ? '反射光（未命中池面）'
      : (reflection.frontLit ? '反射向量無效（停止繪製）' : '鏡牆背光（無有效反射）'));
  rayLabel.setAttribute('fill', reflectedColor);
  sideLabel.textContent =
    '3D 反射方位 ' + reflection.reflectedAzimuth.toFixed(1)
      + '° · 方位偏差 ' + evaluation.azimuthDelta.toFixed(1)
      + '°／容許 ≤' + study.azimuthTolerance.value.toFixed(1)
      + '° · 下射 ' + reflection.reflectedDownwardAngle.toFixed(1)
      + '°／最低 ≥' + study.minimumDownwardAngle.value.toFixed(1) + '°';

  required<HTMLElement>('#downAngle').textContent = reflection.reflectedDownwardAngle.toFixed(1) + '°';
  const thresholdReadout =
    '實際方位偏差 ' + evaluation.azimuthDelta.toFixed(1)
      + '°（門檻 ≤' + study.azimuthTolerance.value.toFixed(1)
      + '°）；反射向下角 ' + reflection.reflectedDownwardAngle.toFixed(1)
      + '°（門檻 ≥' + study.minimumDownwardAngle.value.toFixed(1) + '°）。';

  const diagnosticPrefix = period.key === 'warm'
    ? '此夏季時刻方向診斷'
    : '此冬季時刻方向診斷';
  result.classList.toggle('is-warn', period.key === 'warm' && evaluation.hitsPool);
  if (!reflection.frontLit) {
    resultTitle.textContent = diagnosticPrefix + '：鏡牆背光';
    resultDetail.textContent = '入射方向位於鏡面背側，方向代理不進入方位與下射門檻判讀；暖冷季性能仍以 PVGIS TMY 有鏡／無鏡能量差為準。';
  } else if (!reflection.reflectedFrontSide) {
    resultTitle.textContent = diagnosticPrefix + '：反射向量未通過 3D 正面檢查';
    resultDetail.textContent = '反射向量不在鏡面正面半空間，已停止繪製反射光並排除池面命中，避免把座標或方向錯誤顯示成穿牆光線。';
  } else if (evaluation.hitsPool) {
    resultTitle.textContent = diagnosticPrefix + '：反射朝向池面';
    resultDetail.textContent = period.key === 'warm'
      ? thresholdReadout + ' 原本已有直射仍須計入鏡面疊加能量；這是單點方向代理，不是整季 kWh 或熱效益結論。'
      : thresholdReadout + ' 平面方位與剖面下射角同時通過方向代理門檻；這不是 kWh、照度或熱效益定量。';
  } else {
    const diagnosticResult = evaluation.planPass ? '未形成有效下射' : '偏離池心';
    resultTitle.innerHTML = diagnosticPrefix + '：<br>' + diagnosticResult;
    if (period.key === 'warm') {
      resultDetail.innerHTML = thresholdReadout
        + '<br>此時刻未通過方向代理門檻，但不能直接推論整個暖季零增量；仍須看年度能量分析。';
    } else {
      resultDetail.textContent = thresholdReadout + (evaluation.planPass
        ? ' 平面方向通過，但剖面反射沒有達到最低下射門檻。'
        : ' 平面反射方向超出泳池方位容許範圍。');
    }
  }
  renderLivePreview();
}

renderPlanTolerance();
renderSolarTable();
update();
previewPlanButton.addEventListener('click', () => setMobilePreview('plan'));
previewSectionButton.addEventListener('click', () => setMobilePreview('section'));
mobilePreviewMedia.addEventListener('change', renderLivePreview);
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

function handleVisibilityChange(): void {
  if (!document.hidden) syncCurrentYear();
}

window.addEventListener('focus', syncCurrentYear);
document.addEventListener('visibilitychange', handleVisibilityChange);
const currentYearInterval = window.setInterval(syncCurrentYear, 60 * 60 * 1000);
