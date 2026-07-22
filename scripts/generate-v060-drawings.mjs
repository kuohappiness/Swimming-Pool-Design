import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveActiveGeometry } from './active-geometry.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const model = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const active = resolveActiveGeometry(model);
const versionSlug = `v${model.modelVersion}`;
const outputRoot = resolve(repoRoot, 'reference/drafts', versionSlug);
const scale = 36;
const originX = 105;
const originY = 790;
const planX = (x) => originX + x * scale;
const planY = (y) => originY - y * scale;
const n = (value) => Number(value.toFixed(3));
const boundsData = (entity) => `${entity.bounds.x1},${entity.bounds.x2},${entity.bounds.y1},${entity.bounds.y2}`;

const style = `<style>
  text{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;fill:#263746}.title{font-size:31px;font-weight:800}.subtitle{font-size:15px;fill:#536b75}.label{font-size:14px;font-weight:700}.small{font-size:12px}.tiny{font-size:10px}.grid{stroke:#cbd7da;stroke-width:.55}.gridMajor{stroke:#9fb2b8;stroke-width:.9}.outline{fill:none;stroke:#263746;stroke-width:2}.reference{fill:#eef2f2;stroke:#97a8ad;stroke-width:1.2;stroke-dasharray:7 5}.pool{fill:#bfe4ef;stroke:#227698;stroke-width:2}.lane{stroke:#f8fbfc;stroke-width:2;stroke-dasharray:8 5}.working{fill:#f1dfbe;stroke:#a96f28;stroke-width:1.6}.confirmed{fill:#d8ece4;stroke:#237c64;stroke-width:1.6}.service{fill:#dbe5e6;stroke:#5b7278;stroke-width:1.6}.chemical{fill:#ead9e8;stroke:#8e5a88;stroke-width:1.6}.deferred{fill:#e4dbed;stroke:#7c5c98;stroke-width:1.5;stroke-dasharray:6 4}.stair{fill:#d7dde0;stroke:#263746;stroke-width:1.6}.structure{fill:#c3793c;fill-opacity:.18;stroke:#a95c25;stroke-width:2.2;stroke-dasharray:8 4}.dim{stroke:#536b75;stroke-width:1;fill:none}.titleBox{fill:#f6f8f8;stroke:#263746;stroke-width:1.2}.note{fill:#f7f8f8;stroke:#a8b6ba;stroke-width:1}.mirror{stroke:#4f8792;stroke-width:7}.roof{fill:#d8eef2;fill-opacity:.7;stroke:#4f95a8;stroke-width:2}.level{stroke:#8b9ba0;stroke-width:1;stroke-dasharray:7 5}.water{fill:#8fd2e6;fill-opacity:.75;stroke:#227698;stroke-width:2}.wall{fill:#c9d3d4;stroke:#536b75;stroke-width:1.5}
</style>`;

function shell(title, subtitle, body, drawingId) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="title desc" data-model-version="${model.modelVersion}" data-active-geometry="${active.id}" data-coordinate-system="SITE-XY">
  <title id="title">${title} ${versionSlug}</title><desc id="desc">${subtitle}。概念設計，非施工圖。</desc>${style}
  <rect width="1920" height="1080" fill="#fff"/><text x="72" y="66" class="title">${title}</text><text x="74" y="98" class="subtitle">${subtitle}</text>
  ${body}
  <g transform="translate(60 962)"><rect width="1800" height="78" class="titleBox"/><line x1="1020" y1="0" x2="1020" y2="78" stroke="#263746"/><line x1="1320" y1="0" x2="1320" y2="78" stroke="#263746"/><line x1="1570" y1="0" x2="1570" y2="78" stroke="#263746"/><text x="20" y="27" class="small">國立臺中教育大學附設實驗國民小學游泳池翻修</text><text x="20" y="58" class="label">${title}</text><text x="1040" y="25" class="tiny">圖號</text><text x="1040" y="55" class="label">${drawingId}</text><text x="1340" y="25" class="tiny">模型／幾何</text><text x="1340" y="55" class="label">${model.modelVersion}／${active.id}</text><text x="1590" y="25" class="tiny">狀態</text><text x="1590" y="55" class="label">概念設計 · 非施工圖</text></g>
  </svg>`;
}

function grid() {
  const lines = [];
  for (let x = 0; x <= 41.0001; x += 0.5) {
    const major = Math.abs((x / 2.5) - Math.round(x / 2.5)) < 1e-6;
    lines.push(`<line x1="${planX(x)}" y1="${planY(14)}" x2="${planX(x)}" y2="${planY(0)}" class="${major ? 'gridMajor' : 'grid'}"/>`);
    if (major || x === 41) lines.push(`<text x="${planX(x)}" y="${planY(0) + 20}" text-anchor="middle" class="tiny">X${n(x)}</text>`);
  }
  for (let y = 0; y <= 14.0001; y += 0.5) {
    const major = Math.abs((y / 2.5) - Math.round(y / 2.5)) < 1e-6;
    lines.push(`<line x1="${planX(0)}" y1="${planY(y)}" x2="${planX(41)}" y2="${planY(y)}" class="${major ? 'gridMajor' : 'grid'}"/>`);
    if (major || y === 14) lines.push(`<text x="${planX(0) - 12}" y="${planY(y) + 4}" text-anchor="end" class="tiny">Y${n(y)}</text>`);
  }
  return `<g aria-label="SITE-XY 0.5 m grid">${lines.join('')}</g>`;
}

function rect(entity, className, label = '') {
  const b = entity.bounds;
  const text = label ? `<text x="${planX((b.x1 + b.x2) / 2)}" y="${planY((b.y1 + b.y2) / 2) + 4}" text-anchor="middle" class="small">${label}</text>` : '';
  return `<g data-entity="${entity.entityId}" data-coordinate-system="SITE-XY" data-bounds="${boundsData(entity)}"><rect x="${planX(b.x1)}" y="${planY(b.y2)}" width="${n((b.x2 - b.x1) * scale)}" height="${n((b.y2 - b.y1) * scale)}" class="${className}"/>${text}</g>`;
}

function northArrow() {
  return `<g data-north-plan-direction="lower-right" data-north-rotation="127" transform="translate(1690 190) rotate(127)"><line x1="0" y1="52" x2="0" y2="-38" stroke="#c4553f" stroke-width="4"/><path d="M0 -58L-10 -34H10Z" fill="#c4553f"/><text x="0" y="-70" text-anchor="middle" class="label">N</text></g><text x="1540" y="286" class="tiny">真北＝圖面右下；圖面右＝+X＝西北 307°</text>`;
}

function stairPlan() {
  const s = active.stair;
  const b = s.bounds;
  const parts = [rect(s, 'stair', 'ST-01 方案 E')];
  for (let i = 1; i <= s.treadsPerRun; i += 1) {
    const x1 = b.x1 + i * s.treadDepth;
    const x2 = b.x2 - i * s.treadDepth;
    parts.push(`<line x1="${planX(x1)}" y1="${planY(b.y2)}" x2="${planX(x1)}" y2="${planY(b.y1)}" stroke="#263746" stroke-width=".8"/>`);
    parts.push(`<line x1="${planX(x2)}" y1="${planY(b.y2)}" x2="${planX(x2)}" y2="${planY(b.y1)}" stroke="#263746" stroke-width=".8"/>`);
  }
  const platformX1 = b.x1 + s.runLengthPerFlight;
  const platformX2 = platformX1 + s.midLandingLength;
  parts.push(`<rect x="${planX(platformX1)}" y="${planY(b.y2)}" width="${s.midLandingLength * scale}" height="${(b.y2 - b.y1) * scale}" fill="#bfc9cd" fill-opacity=".55"/><text x="${planX((platformX1 + platformX2) / 2)}" y="${planY(b.y1) - 8}" text-anchor="middle" class="tiny">3.10 m 長平台</text>`);
  return parts.join('');
}

function fixtureMarks(zone) {
  if (!zone.layout) return '';
  const marks = [];
  for (const cubicle of zone.layout.toiletCubicles) {
    const b = cubicle.planBounds;
    const doorY1 = b.y1 + 0.16;
    const doorY2 = Math.min(b.y2 - 0.16, doorY1 + 0.7);
    const frontX = Number(cubicle.doorSide.slice(1));
    marks.push(`<g data-wc-door-leaf="true"><rect x="${planX(b.x1)}" y="${planY(b.y2)}" width="${(b.x2 - b.x1) * scale}" height="${(b.y2 - b.y1) * scale}" fill="none" stroke="#536b75" stroke-width="1.2"/><line x1="${planX(frontX)}" y1="${planY(doorY1)}" x2="${planX(frontX + (frontX < (b.x1 + b.x2) / 2 ? 0.62 : -0.62))}" y2="${planY(doorY2)}" stroke="#263746" stroke-width="1.4"/><rect x="${planX((b.x1 + b.x2) / 2) - 7}" y="${planY((b.y1 + b.y2) / 2) - 5}" width="14" height="10" rx="3" fill="#fff" stroke="#536b75"/></g>`);
  }
  for (const basin of zone.layout.washbasins) {
    const [x, y] = basin.center;
    marks.push(`<g data-fixture="washbasin"><ellipse cx="${planX(x)}" cy="${planY(y)}" rx="11" ry="6" fill="#d9edf2" stroke="#367486"/><line x1="${planX(x) - 12}" y1="${planY(y + (basin.facing === 'positive-y' ? -0.14 : 0.14))}" x2="${planX(x) + 12}" y2="${planY(y + (basin.facing === 'positive-y' ? -0.14 : 0.14))}" stroke="#536b75"/></g>`);
  }
  for (const urinal of zone.layout.urinals) {
    const [x, y] = urinal.center;
    marks.push(`<ellipse data-fixture="urinal" cx="${planX(x)}" cy="${planY(y)}" rx="6" ry="9" fill="#fff" stroke="#536b75"/>`);
  }
  const screen = zone.layout.privacyScreen.planBounds;
  marks.push(`<rect data-privacy-screen="true" x="${planX(screen.x1)}" y="${planY(screen.y2)}" width="${(screen.x2 - screen.x1) * scale}" height="${(screen.y2 - screen.y1) * scale}" fill="#66777d"/>`);
  return `<g aria-label="${zone.entityId} detailed fixtures">${marks.join('')}</g>`;
}

function l1Plan() {
  const z = active.l1.zones;
  const zoneViews = [
    [z.poolMaleToilet, 'confirmed', '泳池男廁 +0.30'],
    [z.poolFemaleToilet, 'confirmed', '泳池女廁 +0.30'],
    [z.playgroundMaleToilet, 'working', '操場男廁 +0.10'],
    [z.playgroundFemaleToilet, 'working', '操場女廁 +0.10'],
    [z.storage, 'service', '儲物 9.75 m²'],
    [z.waterTreatment, 'service', '水處理 42.25 m²'],
    [z.chemicalRoom, 'chemical', '獨立藥劑'],
  ];
  const pool = active.l1.pool;
  const ropes = pool.laneBands.slice(0, -1).map((band) => `<line x1="${planX(pool.bounds.x1)}" y1="${planY(band.y2)}" x2="${planX(pool.bounds.x2)}" y2="${planY(band.y2)}" class="lane"/>`).join('');
  const fixtures = zoneViews.slice(0, 4).map(([zone]) => fixtureMarks(zone)).join('');
  const entrances = active.l1.toiletEntrances.map((entrance) => {
    const [x, y] = entrance.center;
    const y1 = y - entrance.clearWidth / 2;
    const y2 = y + entrance.clearWidth / 2;
    const labelX = planX(x) + (entrance.side === 'x31' ? -8 : 8);
    const anchor = entrance.side === 'x31' ? 'end' : 'start';
    return `<g data-entity="${entrance.entityId}" data-opening-type="${entrance.openingType}" data-door-leaf="false" data-clear-width="${entrance.clearWidth}"><line x1="${planX(x)}" y1="${planY(y1)}" x2="${planX(x)}" y2="${planY(y2)}" stroke="#fff" stroke-width="6"/><line x1="${planX(x) - 5}" y1="${planY(y1)}" x2="${planX(x) + 5}" y2="${planY(y1)}" stroke="#263746" stroke-width="1.3"/><line x1="${planX(x) - 5}" y1="${planY(y2)}" x2="${planX(x) + 5}" y2="${planY(y2)}" stroke="#263746" stroke-width="1.3"/><text x="${labelX}" y="${planY(y) - 5}" text-anchor="${anchor}" class="tiny">1.00 m 無門板</text></g>`;
  }).join('');
  return shell('1F 概念平面圖', `PROJECT / MODEL ${versionSlug} · SITE-XY · 0.5 m 最小讀圖格 · ACTIVE ${active.id}`, `${grid()}${northArrow()}
    ${rect(active.l1.building, 'outline')}${rect(active.l1.pool, 'pool', '25 × 8.5 m · 左淺 1.2 → 右深 1.5')}${ropes}
    ${zoneViews.map(([zone, cls, label]) => rect(zone, cls, label)).join('')}${fixtures}${entrances}${stairPlan()}
    ${rect(active.l1.rightSetback, 'reference', '2 m 退縮／整坡')}${rect(active.l1.mainEntrance, 'confirmed', '主入口')}${rect(active.l1.playgroundRamp, 'deferred')}
    <g class="structure"><rect x="${planX(32.5) - 5}" y="${planY(14)}" width="10" height="${6.5 * scale}"/><rect x="${planX(35.5) - 5}" y="${planY(7.5)}" width="10" height="${7.5 * scale}"/></g>
    <text x="${planX(35)}" y="${planY(13.2)}" text-anchor="middle" class="tiny">結構候選整合於設備牆／隔間；非結構定案</text>
    <rect x="60" y="845" width="1370" height="82" rx="9" class="note"/><text x="82" y="875" class="small">四間廁所主入口均為 1.00 m 無門板開口；男廁洗手台貼 Y0、女廁洗手台貼 Y7.5；WC 隔間保留門板並以入口屏風阻斷直視。</text><text x="82" y="902" class="small">ST-01＝X20.5～X29／Y0.5～Y2.0；懸空薄踏步＋雙連續鋼箱梯梁、梯下開放；20 級高／18 踏面，直接接 L2。</text>`, 'DRAW-L1-PLAN');
}

function l2Plan() {
  const plate = active.l2.floorPlate;
  const male = { entityId: 'Z-CS-M-01', coordinateSystemId: 'SITE-XY', bounds: { x1: 29, x2: 35, y1: 0, y2: 13.5 } };
  const female = { entityId: 'Z-CS-F-01', coordinateSystemId: 'SITE-XY', bounds: { x1: 35, x2: 41, y1: 0, y2: 13.5 } };
  return shell('2F 概念平面圖', `PROJECT / MODEL ${versionSlug} · 固定正交樓板 +3.30 m · SITE-XY`, `${grid()}${northArrow()}${rect(active.site, 'reference', '1F 基地參照')}${rect(plate, 'outline')}${rect(male, 'working', '男更衣／淋浴 15＋5')}${rect(female, 'confirmed', '女更衣／淋浴 15＋5')}
    <rect x="${planX(29)}" y="${planY(2)}" width="${2 * scale}" height="${2 * scale}" class="deferred"/><text x="${planX(30)}" y="${planY(1) + 4}" text-anchor="middle" class="tiny">ST-01 到達</text>
    <rect x="${planX(29)}" y="${planY(13.5)}" width="${2 * scale}" height="${13.5 * scale}" fill="#bfe4ef" fill-opacity=".25"/><text x="${planX(30)}" y="${planY(7)}" text-anchor="middle" class="tiny" transform="rotate(-90 ${planX(30)} ${planY(7)})">伸入泳池挑高 2 m</text>
    <rect x="${planX(39)}" y="${planY(13.5)}" width="${2 * scale}" height="${13.5 * scale}" fill="#e4dbed" fill-opacity=".42"/><text x="${planX(40)}" y="${planY(7)}" text-anchor="middle" class="tiny" transform="rotate(-90 ${planX(40)} ${planY(7)})">右退縮上方外挑 2 m</text>
    <line x1="${planX(32.5)}" y1="${planY(13.5)}" x2="${planX(32.5)}" y2="${planY(7.5)}" class="structure"/><line x1="${planX(35.5)}" y1="${planY(7.5)}" x2="${planX(35.5)}" y2="${planY(0)}" class="structure"/>
    <rect x="60" y="845" width="1170" height="82" rx="9" class="note"/><text x="82" y="877" class="small">L2 標高 +3.30 m；12 × 13.5 m 固定樓板。ST-01 在 X29 直接接板，不設短橋。</text><text x="82" y="904" class="small">橙色線為與 L1 隔間／設備牆協同的支承候選；柱牆尺寸、梁深與逃生仍需專業驗證。</text>`, 'DRAW-L2-PLAN');
}

function rotatePoint(x, y, angle, pivot) {
  const radians = -angle * Math.PI / 180;
  const dx = x - pivot.x;
  const dy = y - pivot.y;
  return { x: pivot.x + dx * Math.cos(radians) - dy * Math.sin(radians), y: pivot.y + dx * Math.sin(radians) + dy * Math.cos(radians) };
}

function l3Plan() {
  const b = active.l3.floorPlate.bounds;
  const pivot = active.l3.planPivot;
  const corners = [[b.x1,b.y1],[b.x2,b.y1],[b.x2,b.y2],[b.x1,b.y2]].map(([x,y]) => rotatePoint(x,y,active.l3.planRotation,pivot));
  const points = corners.map((p) => `${planX(p.x)},${planY(p.y)}`).join(' ');
  return shell('3F 概念平面圖', `PROJECT / MODEL ${versionSlug} · L3 +6.88 m · +${active.l3.planRotation.toFixed(1)}°／+${active.l3.mirror.leanFromVertical.toFixed(1)}° 工作值 · SITE-XY`, `${grid()}${northArrow()}${rect(active.site, 'reference', '1F 基地參照')}${rect(active.l2.floorPlate, 'reference', '固定 L2 投影')}
    <g data-entity="L3-PLATE-01" data-coordinate-system="SITE-XY" data-bounds="${boundsData(active.l3.floorPlate)}"><polygon points="${points}" class="working"/><text x="${planX(pivot.x)}" y="${planY(pivot.y)}" text-anchor="middle" class="label">旋轉 L3 +${active.l3.planRotation.toFixed(1)}°</text></g>
    <line x1="${planX(corners[0].x)}" y1="${planY(corners[0].y)}" x2="${planX(corners[3].x)}" y2="${planY(corners[3].y)}" class="mirror"/><circle cx="${planX(pivot.x)}" cy="${planY(pivot.y)}" r="7" fill="#a95c25"/><text x="${planX(pivot.x)+10}" y="${planY(pivot.y)-12}" class="tiny">支點 X35／Y6.75</text>
    <g class="structure"><rect x="${planX(32.5)-5}" y="${planY(12)}" width="10" height="${4 * scale}"/><rect x="${planX(35.5)-5}" y="${planY(7.5)}" width="10" height="${7.5 * scale}"/></g>
    <g><rect x="${planX(33)}" y="${planY(10)}" width="${2.2*scale}" height="${1.6*scale}" class="service"/><circle cx="${planX(34)}" cy="${planY(6.8)}" r="22" class="service"/><text x="${planX(34.1)}" y="${planY(11)}" text-anchor="middle" class="tiny">除濕／熱回收</text><text x="${planX(34)}" y="${planY(6.8)+4}" text-anchor="middle" class="tiny">水塔</text></g>
    <rect x="60" y="845" width="1320" height="82" rx="9" class="note"/><text x="82" y="875" class="small">高位設備固定在直落支承帶，不跟隨旋轉懸挑端；鏡牆本體與外貼鏡面共同外傾 ${active.l3.mirror.leanFromVertical.toFixed(1)}°。</text><text x="82" y="902" class="small">23° 大幅外傾為日照工作最佳值，整體牆體、扭轉、風震、排水與設備荷重必須由結構／機電專業驗證。</text>`, 'DRAW-L3-PLAN');
}

function sectionDrawing() {
  const sx = (x) => 100 + x * 36;
  const sz = (z) => 760 - z * 36;
  const pool = active.l1.pool;
  const stair = active.stair;
  const flight = (x0, z0, reverse = false) => Array.from({ length: stair.treadsPerRun }, (_, i) => {
    const x = reverse ? x0 + (stair.treadsPerRun - i) * stair.treadDepth : x0 + (i + 1) * stair.treadDepth;
    const z = z0 + (i + 1) * stair.riserHeight;
    return `${sx(x)},${sz(z)}`;
  }).join(' ');
  const l3Min = 26.7;
  const l3Max = 43.3;
  const roof = active.roof;
  const mirrorTopX = 29 - Math.tan(active.l3.mirror.leanFromVertical * Math.PI / 180) * active.l3.mirror.height;
  const body = `<g><line x1="${sx(0)}" y1="${sz(0)}" x2="${sx(41)}" y2="${sz(0)}" class="outline"/>${[0.1,0.3,3.3,6.88].map((z) => `<line x1="${sx(0)}" y1="${sz(z)}" x2="${sx(43.5)}" y2="${sz(z)}" class="level"/><text x="${sx(43.7)}" y="${sz(z)+4}" class="tiny">+${z.toFixed(2)} m</text>`).join('')}</g>
    <g data-entity="POOL-01" data-coordinate-system="SITE-XY" data-bounds="${boundsData(pool)}"><path d="M${sx(pool.bounds.x1)} ${sz(0.22)}L${sx(pool.bounds.x2)} ${sz(0.22)}L${sx(pool.bounds.x2)} ${sz(-1.28)}L${sx(pool.bounds.x1)} ${sz(-0.98)}Z" class="water"/><text x="${sx(15.5)}" y="${sz(-0.4)}" text-anchor="middle" class="label">25 m 泳池 · 左 1.2 m → 右 1.5 m</text></g>
    <g data-entity="RF-GL-01" data-coordinate-system="SITE-XY" data-bounds="${boundsData(roof)}"><path d="M${sx(0)} ${sz(roof.lowElevation)}L${sx(29)} ${sz(roof.highElevation)}L${sx(29)} ${sz(roof.highElevation+0.12)}L${sx(0)} ${sz(roof.lowElevation+0.12)}Z" class="roof"/><text x="${sx(13)}" y="${sz(5.35)}" class="label" transform="rotate(-5 ${sx(13)} ${sz(5.35)})">29.0 m 玻璃屋頂 · 5°</text></g>
    <g><rect x="${sx(29)}" y="${sz(3.3)}" width="${12*36}" height="9" class="wall"/><rect x="${sx(l3Min)}" y="${sz(6.88)}" width="${(l3Max-l3Min)*36}" height="9" class="working"/><line x1="${sx(29)}" y1="${sz(6.88)}" x2="${sx(mirrorTopX)}" y2="${sz(10.48)}" class="mirror"/><text x="${sx(34.5)}" y="${sz(3.55)}" class="small">L2 固定更衣層 +3.30</text><text x="${sx(34)}" y="${sz(7.16)}" class="small">L3 旋轉服務層 +6.88</text><text x="${sx(27.5)}" y="${sz(9)}" class="tiny">鏡牆外傾 ${active.l3.mirror.leanFromVertical.toFixed(1)}°</text></g>
    <g data-entity="ST-01" data-coordinate-system="SITE-XY" data-bounds="${boundsData(stair)}" data-design-intent="suspended-floating-stair"><line x1="${sx(stair.bounds.x1+0.15)}" y1="${sz(stair.lowerElevation+0.02)}" x2="${sx(stair.bounds.x1+stair.runLengthPerFlight-0.15)}" y2="${sz(1.65)}" stroke="#263746" stroke-width="8"/><line x1="${sx(stair.bounds.x1+stair.runLengthPerFlight)}" y1="${sz(1.72)}" x2="${sx(stair.bounds.x1+stair.runLengthPerFlight+stair.midLandingLength)}" y2="${sz(1.72)}" stroke="#263746" stroke-width="8"/><line x1="${sx(stair.bounds.x1+stair.runLengthPerFlight+stair.midLandingLength+0.15)}" y1="${sz(1.72)}" x2="${sx(stair.bounds.x2-0.15)}" y2="${sz(3.15)}" stroke="#263746" stroke-width="8"/><polyline points="${sx(stair.bounds.x1)},${sz(stair.lowerElevation)} ${flight(stair.bounds.x1, stair.lowerElevation)} ${sx(stair.bounds.x1+stair.runLengthPerFlight+stair.midLandingLength)},${sz(1.8)} ${flight(stair.bounds.x1+stair.runLengthPerFlight+stair.midLandingLength,1.8)}" fill="none" stroke="#58676d" stroke-width="3"/><text x="${sx(24.75)}" y="${sz(2.15)}" text-anchor="middle" class="tiny">懸空薄踏步＋雙連續鋼箱梯梁 · 2.70＋3.10＋2.70 m · 20R／18T</text></g>
    <g><rect x="${sx(31)}" y="${sz(3.3)}" width="${4.5*36}" height="${3*36}" class="confirmed"/><rect x="${sx(35.5)}" y="${sz(3.3)}" width="${3.5*36}" height="${3.2*36}" class="working"/><text x="${sx(33.25)}" y="${sz(1.65)}" text-anchor="middle" class="tiny">泳池側廁所 +0.30</text><text x="${sx(37.25)}" y="${sz(1.55)}" text-anchor="middle" class="tiny">操場側廁所 +0.10</text><rect x="${sx(39)}" y="${sz(0.1)}" width="${2*36}" height="4" class="deferred"/></g>
    <rect x="60" y="842" width="1320" height="84" rx="9" class="note"/><text x="82" y="873" class="small">剖面採 X／Z 同尺度。ST-01 從池畔 +0.30 m 直接到 L2 +3.30 m；3.10 m 平台的扭轉、振動、淨高與群聚荷重仍待專業驗證。</text><text x="82" y="902" class="small">L3 外挑、屋頂轉接帶、廁所結構／機電淨高、水處理與設備支承均為概念協調結果，非施工核定。</text>`;
  return shell('縱向概念剖面圖', `PROJECT / MODEL ${versionSlug} · X／Z 同尺度 · 池畔 +0.30 · L2 +3.30 · L3 +6.88`, body, 'DRAW-LONGITUDINAL-SECTION');
}

const drawings = [
  [`DRAW-L1-PLAN-${versionSlug}.svg`, l1Plan()],
  [`DRAW-L2-PLAN-${versionSlug}.svg`, l2Plan()],
  [`DRAW-L3-PLAN-${versionSlug}.svg`, l3Plan()],
  [`DRAW-LONGITUDINAL-SECTION-${versionSlug}.svg`, sectionDrawing()],
];
await mkdir(outputRoot, { recursive: true });
await Promise.all(drawings.map(([name, svg]) => writeFile(resolve(outputRoot, name), `${svg}\n`, 'utf8')));
process.stdout.write(drawings.map(([name]) => resolve(outputRoot, name)).join('\n') + '\n');
