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
  text{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;fill:#263746}.title{font-size:31px;font-weight:800}.subtitle{font-size:15px;fill:#536b75}.label{font-size:14px;font-weight:700}.small{font-size:12px}.tiny{font-size:10px}.grid{stroke:#cbd7da;stroke-width:.55}.gridMajor{stroke:#9fb2b8;stroke-width:.9}.outline{fill:none;stroke:#263746;stroke-width:2}.reference{fill:#eef2f2;stroke:#97a8ad;stroke-width:1.2;stroke-dasharray:7 5}.pool{fill:#bfe4ef;stroke:#227698;stroke-width:2}.lane{stroke:#f8fbfc;stroke-width:2;stroke-dasharray:8 5}.working{fill:#f1dfbe;stroke:#a96f28;stroke-width:1.6}.confirmed{fill:#d8ece4;stroke:#237c64;stroke-width:1.6}.service{fill:#dbe5e6;stroke:#5b7278;stroke-width:1.6}.chemical{fill:#ead9e8;stroke:#8e5a88;stroke-width:1.6}.deferred{fill:#e4dbed;stroke:#7c5c98;stroke-width:1.5;stroke-dasharray:6 4}.stair{fill:#d7dde0;stroke:#263746;stroke-width:1.6}.structure{fill:#c3793c;fill-opacity:.18;stroke:#a95c25;stroke-width:2.2;stroke-dasharray:8 4}.dim{stroke:#536b75;stroke-width:1;fill:none}.titleBox{fill:#f6f8f8;stroke:#263746;stroke-width:1.2}.note{fill:#f7f8f8;stroke:#a8b6ba;stroke-width:1}.mirror{stroke:#4f8792;stroke-width:7}.roof{fill:#d8eef2;fill-opacity:.28;stroke:#4f95a8;stroke-width:2}.level{stroke:#8b9ba0;stroke-width:1;stroke-dasharray:7 5}.water{fill:#8fd2e6;fill-opacity:.75;stroke:#227698;stroke-width:2}.wall{fill:#c9d3d4;stroke:#536b75;stroke-width:1.5}.terrace{fill:#cfe1c5;stroke:#52774b;stroke-width:1.7}.arrival{fill:#d7e8df;stroke:#286b5c;stroke-width:2}.corridor{fill:#dcecef;stroke:#357487;stroke-width:1.6}.female{fill:#e5e0ee;stroke:#76598d;stroke-width:1.6}.glassLine{stroke:#3d9bb3;stroke-width:7}.wallLine{stroke:#65757b;stroke-width:6}.windowLine{stroke:#4fa5bb;stroke-width:8}.locker{fill:#cfd8d8;stroke:#64787a;stroke-width:1}.counter{fill:#d7c5ab;stroke:#8a6234;stroke-width:1.5}.plant{fill:#bed6b2;stroke:#52774b;stroke-width:1.3}.pv{fill:#8fd9ee;fill-opacity:.24;stroke:#3d91b4;stroke-width:1.8}.pvGrid{stroke:#4f9fc1;stroke-width:.8;stroke-opacity:.82}.projected{fill:none;stroke:#9b6a43;stroke-width:1.5;stroke-dasharray:6 4}.rain{fill:#d9e5ef;fill-opacity:.55;stroke:#6f6a96;stroke-width:1.5;stroke-dasharray:5 3}
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
  return `<g aria-label="SITE-XY 0.5 m grid" data-grid-visible="true" data-minor-spacing="0.5" data-major-spacing="2.5">${lines.join('')}</g>`;
}

function rect(entity, className, label = '') {
  const b = entity.bounds;
  const text = label ? `<text x="${planX((b.x1 + b.x2) / 2)}" y="${planY((b.y1 + b.y2) / 2) + 4}" text-anchor="middle" class="small">${label}</text>` : '';
  return `<g data-entity="${entity.entityId}" data-coordinate-system="SITE-XY" data-bounds="${boundsData(entity)}"><rect x="${planX(b.x1)}" y="${planY(b.y2)}" width="${n((b.x2 - b.x1) * scale)}" height="${n((b.y2 - b.y1) * scale)}" class="${className}"/>${text}</g>`;
}

function northArrow() {
  return `<g data-north-plan-direction="lower-right" data-north-rotation="127" transform="translate(1690 190) rotate(127)"><line x1="0" y1="52" x2="0" y2="-38" stroke="#c4553f" stroke-width="4"/><path d="M0 -58L-10 -34H10Z" fill="#c4553f"/><text x="0" y="-70" text-anchor="middle" class="label">N</text></g><text x="1540" y="286" class="tiny">真北＝圖面右下；圖面右＝+X＝西北 307°</text>`;
}

function sectionGrid(sx, sz) {
  const marks = [];
  for (let x = 0; x <= 42.5001; x += 0.5) {
    const major = Math.abs((x / 2.5) - Math.round(x / 2.5)) < 1e-6;
    marks.push(`<line x1="${sx(x)}" y1="${sz(11)}" x2="${sx(x)}" y2="${sz(-1.75)}" class="${major ? 'gridMajor' : 'grid'}"/>`);
    if (major || x === 42.5) marks.push(`<text x="${sx(x)}" y="${sz(-1.75) + 18}" text-anchor="middle" class="tiny">X${n(x)}</text>`);
  }
  for (let z = -1.5; z <= 11.0001; z += 0.5) {
    const major = Math.abs((z / 2.5) - Math.round(z / 2.5)) < 1e-6;
    marks.push(`<line x1="${sx(0)}" y1="${sz(z)}" x2="${sx(42.5)}" y2="${sz(z)}" class="${major ? 'gridMajor' : 'grid'}"/>`);
    if (major) marks.push(`<text x="${sx(0) - 12}" y="${sz(z) + 4}" text-anchor="end" class="tiny">Z${z >= 0 ? '+' : ''}${n(z)}</text>`);
  }
  return `<g aria-label="SITE-XZ 0.5 m grid" data-grid-visible="true" data-coordinate-system="SITE-XZ" data-minor-spacing="0.5" data-major-spacing="2.5">${marks.join('')}</g>`;
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
    const doorAxis = cubicle.doorSide[0];
    const doorCoordinate = Number(cubicle.doorSide.slice(1));
    const doorLine = doorAxis === 'x'
      ? `<line x1="${planX(doorCoordinate)}" y1="${planY((b.y1 + b.y2) / 2 - 0.35)}" x2="${planX(doorCoordinate + (doorCoordinate < (b.x1 + b.x2) / 2 ? 0.62 : -0.62))}" y2="${planY((b.y1 + b.y2) / 2 + 0.35)}" stroke="#263746" stroke-width="1.4"/>`
      : `<line x1="${planX((b.x1 + b.x2) / 2 - 0.35)}" y1="${planY(doorCoordinate)}" x2="${planX((b.x1 + b.x2) / 2 + 0.35)}" y2="${planY(doorCoordinate + (doorCoordinate < (b.y1 + b.y2) / 2 ? 0.62 : -0.62))}" stroke="#263746" stroke-width="1.4"/>`;
    marks.push(`<g data-wc-door-leaf="true" data-wall-contact="${cubicle.wallContact ?? ''}"><rect x="${planX(b.x1)}" y="${planY(b.y2)}" width="${(b.x2 - b.x1) * scale}" height="${(b.y2 - b.y1) * scale}" fill="none" stroke="#536b75" stroke-width="1.2"/>${doorLine}<rect x="${planX((b.x1 + b.x2) / 2) - 7}" y="${planY((b.y1 + b.y2) / 2) - 5}" width="14" height="10" rx="3" fill="#fff" stroke="#536b75"/></g>`);
  }
  for (const basin of zone.layout.washbasins) {
    const [x, y] = basin.center;
    marks.push(`<g data-fixture="washbasin"><ellipse cx="${planX(x)}" cy="${planY(y)}" rx="11" ry="6" fill="#d9edf2" stroke="#367486"/><line x1="${planX(x) - 12}" y1="${planY(y + (basin.facing === 'positive-y' ? -0.14 : 0.14))}" x2="${planX(x) + 12}" y2="${planY(y + (basin.facing === 'positive-y' ? -0.14 : 0.14))}" stroke="#536b75"/></g>`);
  }
  for (const urinal of zone.layout.urinals) {
    const [x, y] = urinal.center;
    marks.push(`<ellipse data-fixture="urinal" cx="${planX(x)}" cy="${planY(y)}" rx="6" ry="9" fill="#fff" stroke="#536b75"/>`);
  }
  if (zone.layout.privacyScreen) {
    const screen = zone.layout.privacyScreen.planBounds;
    marks.push(`<rect data-privacy-screen="true" x="${planX(screen.x1)}" y="${planY(screen.y2)}" width="${(screen.x2 - screen.x1) * scale}" height="${(screen.y2 - screen.y1) * scale}" fill="#66777d"/>`);
  }
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
    ${rect(active.l1.westSetback, 'reference', '0.5 m 退縮')}${rect(active.l1.rightSetback, 'reference', '2 m 退縮／整坡')}${rect(active.l1.mainEntrance, 'confirmed', '主入口 X1～3')}${rect(active.l1.playgroundRamp, 'deferred')}
    <g data-entity="${active.l1.westGlassEave.entityId}" data-bounds="${boundsData(active.l1.westGlassEave)}"><rect x="${planX(0)}" y="${planY(14)}" width="${0.5*scale}" height="${14*scale}" class="roof"/><text x="${planX(0.25)}" y="${planY(8)}" text-anchor="middle" class="tiny" transform="rotate(-90 ${planX(0.25)} ${planY(8)})">傾斜玻璃突出屋簷</text></g>
    <g data-entity="${active.l1.westRainwaterRecovery.entityId}" data-bounds="${boundsData(active.l1.westRainwaterRecovery)}"><line x1="${planX(0.08)}" y1="${planY(14)}" x2="${planX(0.08)}" y2="${planY(0)}" class="rain"/><text x="${planX(0.08)+8}" y="${planY(4)}" class="tiny" transform="rotate(-90 ${planX(0.08)+8} ${planY(4)})">下方雨水回收</text></g>
    <g data-entity="${active.l1.rearGlassCanopy.entityId}" data-bounds="${boundsData(active.l1.rearGlassCanopy)}" data-building-line-y="14" data-projection-y="14-14.5"><rect x="${planX(31)}" y="${planY(14.5)}" width="${8*scale}" height="${1*scale}" class="roof"/><line x1="${planX(31)}" y1="${planY(14)}" x2="${planX(39)}" y2="${planY(14)}" class="projected"/><text x="${planX(35)}" y="${planY(14.5)-8}" text-anchor="middle" class="tiny">透明玻璃屋頂；Y14～Y14.5 突出屋簷</text></g>
    <g class="structure"><rect x="${planX(32.5) - 5}" y="${planY(14)}" width="10" height="${6.5 * scale}"/><rect x="${planX(35.5) - 5}" y="${planY(7.5)}" width="10" height="${7.5 * scale}"/></g>
    <text x="${planX(35)}" y="${planY(13.2)}" text-anchor="middle" class="tiny">結構候選整合於設備牆／隔間；非結構定案</text>
    <g data-entity="F-L1-Y0-01" data-material-intent="segmented-safety-glass-and-fair-faced-concrete"><line x1="${planX(0.5)}" y1="${planY(0)}" x2="${planX(1)}" y2="${planY(0)}" class="glassLine"/><line x1="${planX(3)}" y1="${planY(0)}" x2="${planX(31)}" y2="${planY(0)}" class="glassLine"/><line x1="${planX(31)}" y1="${planY(0)}" x2="${planX(39)}" y2="${planY(0)}" class="wallLine"/></g>
    <line x1="${planX(0.5)}" y1="${planY(0)}" x2="${planX(0.5)}" y2="${planY(14)}" class="glassLine" data-entity="W-L1-X0.5-01"/>
    <text x="${planX(15.5)}" y="${planY(0) + 34}" text-anchor="middle" class="tiny">L1 Y0：泳池端 X0.5～31 安全玻璃／服務本體 X31～39 清水模；EN-01＝X1～3</text>
    <rect x="60" y="845" width="1570" height="82" rx="9" class="note"/><text x="82" y="875" class="small">L1 西端牆退縮至 X0.5，主入口同步移至 X1～X3；X0～X0.5 形成傾斜玻璃突出屋簷並在下方接入雨水回收系統。</text><text x="82" y="902" class="small">服務中心後側 X31～X39／Y13.5～Y14.5 補透明玻璃屋頂；SITE-XY 仍為 Y0～Y14，Y14～Y14.5 明確標示為突出屋簷。結構、防水與容量待專業驗證。</text>`, 'DRAW-L1-PLAN');
}

function showerMarks(zone) {
  return `<g data-entity="${zone.entityId}" data-shower-count="${zone.showerCount}" data-inclusive-size="1.2x1.2">${zone.showerCubicles.map((cubicle) => {
    const b = cubicle.planBounds;
    return `<g data-shower-cubicle="${cubicle.id}" data-inclusive-width="${n(b.x2 - b.x1)}" data-inclusive-depth="${n(b.y2 - b.y1)}"><rect x="${planX(b.x1)}" y="${planY(b.y2)}" width="${(b.x2 - b.x1) * scale}" height="${(b.y2 - b.y1) * scale}" fill="#f8fbfa" fill-opacity=".8" stroke="#4f7474" stroke-width="1.1"/><text x="${planX((b.x1 + b.x2) / 2)}" y="${planY((b.y1 + b.y2) / 2) + 3}" text-anchor="middle" class="tiny">${cubicle.id.replace('CS-', '')}</text></g>`;
  }).join('')}</g>`;
}

function l2SupportMarks(zone) {
  const support = zone.supportFixtures;
  const toilets = support.toiletCubicles.map((cubicle) => {
    const b = cubicle.planBounds;
    return `<g data-fixture="wc" data-door-leaf="true"><rect x="${planX(b.x1)}" y="${planY(b.y2)}" width="${(b.x2 - b.x1) * scale}" height="${(b.y2 - b.y1) * scale}" fill="#f4e8e0" stroke="#76598d"/><rect x="${planX((b.x1 + b.x2) / 2) - 7}" y="${planY(b.y1 + 0.38) - 5}" width="14" height="10" rx="3" fill="#fff" stroke="#536b75"/></g>`;
  }).join('');
  const basins = support.washbasins.map(({ center: [x, y] }) => `<ellipse data-fixture="washbasin" cx="${planX(x + 0.24)}" cy="${planY(y)}" rx="10" ry="6" fill="#d9edf2" stroke="#367486"/>`).join('');
  const lockers = zone.lockerBanks.map(({ planExtent: b }) => `<rect x="${planX(b.x1)}" y="${planY(b.y2)}" width="${(b.x2 - b.x1) * scale}" height="${(b.y2 - b.y1) * scale}" class="locker"/>`).join('');
  return `<g data-zone-support="${zone.entityId}" data-wc-count="1" data-washbasin-count="2">${toilets}${basins}${lockers}</g>`;
}

function stairToL3Plan() {
  const stair = active.l2.stairToL3;
  const b = stair.bounds;
  const firstEnd = b.x1 + stair.runLengthPerFlight;
  const secondStart = firstEnd + stair.midLandingLength;
  const secondEnd = secondStart + stair.runLengthPerFlight;
  const treads = [];
  for (let index = 1; index <= stair.treadsPerRun; index += 1) {
    for (const x of [b.x1 + index * stair.treadDepth, secondStart + index * stair.treadDepth]) {
      treads.push(`<line x1="${planX(x)}" y1="${planY(b.y2)}" x2="${planX(x)}" y2="${planY(b.y1)}" stroke="#263746" stroke-width=".85"/>`);
    }
  }
  const landscape = stair.underStairLandscape;
  const planterXs = Array.from({ length: landscape.planterCount }, (_, index) =>
    landscape.bounds.x1 + (index + 0.5) * (landscape.bounds.x2 - landscape.bounds.x1) / landscape.planterCount);
  return `<g data-entity="ST-02" data-axis="+x" data-lower-start-x="32.5" data-y-band="0.5,2" data-design-intent="suspended-floating-stair">${rect(stair, 'stair')}${treads.join('')}<rect x="${planX(firstEnd)}" y="${planY(b.y2)}" width="${stair.midLandingLength * scale}" height="${(b.y2 - b.y1) * scale}" fill="#bfc9cd"/><rect x="${planX(secondEnd)}" y="${planY(b.y2)}" width="${stair.upperLandingLength * scale}" height="${(b.y2 - b.y1) * scale}" fill="#d7e7df"/><line x1="${planX(33)}" y1="${planY(1.25)}" x2="${planX(40.2)}" y2="${planY(1.25)}" stroke="#9a4e2d" stroke-width="3"/><path d="M${planX(40.2)} ${planY(1.25)}l-14 -7v14z" fill="#9a4e2d"/><text x="${planX(36.75)}" y="${planY(2.2)}" text-anchor="middle" class="tiny">ST-02 懸空式：X32.5 起步 → +X／22R／20T</text><g data-entity="${landscape.entityId}" data-planter-count="${landscape.planterCount}">${planterXs.map((x, index) => `<circle cx="${planX(x)}" cy="${planY(index % 2 ? 1.48 : 1.02)}" r="8" class="plant"/>`).join('')}</g></g>`;
}

function l2Plan() {
  const plate = active.l2.floorPlate;
  const male = active.l2.zones.maleChangingShower;
  const female = active.l2.zones.femaleChangingShower;
  const corridorPoints = active.l2.circulationZone.polygon.map(([x, y]) => `${planX(x)},${planY(y)}`).join(' ');
  const entries = active.l2.changingRoomEntries.map((entry) => `<g data-entity="${entry.entityId}" data-clear-width="1" data-door-leaf="false"><line x1="${planX(32)}" y1="${planY(entry.rangeY[0])}" x2="${planX(32)}" y2="${planY(entry.rangeY[1])}" stroke="#fff" stroke-width="8"/><text x="${planX(31.8)}" y="${planY((entry.rangeY[0] + entry.rangeY[1]) / 2) + 3}" text-anchor="end" class="tiny">1.00 m 無門片</text></g>`).join('');
  const features = active.l2.corridorFeatures;
  const counter = features.standingCounter.planExtent;
  const fountain = features.drinkingFountain.planExtent;
  return shell('2F 概念平面圖', `PROJECT / MODEL ${versionSlug} · Review A · 固定正交樓板 +3.30 m · SITE-XY`, `${northArrow()}${rect(active.site, 'reference', '1F 基地參照')}${rect(plate, 'outline')}
    <polygon points="${corridorPoints}" class="corridor" data-entity="${active.l2.circulationZone.entityId}" data-area="${active.l2.circulationZone.area}"/>
    ${rect(active.l2.stairZone, 'stair', 'ST-02 獨立區')}${rect(male, 'working', '男更衣／淋浴 15')}${rect(female, 'female', '女更衣／淋浴 15')}
    <rect x="${planX(29)}" y="${planY(13)}" width="${0.75 * scale}" height="${10.3 * scale}" fill="#bfe4ef" fill-opacity=".35"/>
    ${grid()}
    <line x1="${planX(29)}" y1="${planY(0)}" x2="${planX(41)}" y2="${planY(0)}" class="glassLine" data-entity="${active.l2.y0ExteriorFacade.entityId}"/><text x="${planX(36.5)}" y="${planY(0) + 34}" text-anchor="middle" class="tiny">Y0 大面安全玻璃</text>
    <line x1="${planX(active.l2.stairChangingDivider.spanX[0])}" y1="${planY(2.5)}" x2="${planX(active.l2.stairChangingDivider.spanX[1])}" y2="${planY(2.5)}" class="wallLine" data-entity="${active.l2.stairChangingDivider.entityId}" data-openings="0"/><text x="${planX(36.5)}" y="${planY(2.5) - 8}" text-anchor="middle" class="tiny">Y2.5 清水模連續分隔牆 X32～X41／無開口</text>
    <line x1="${planX(29)}" y1="${planY(features.poolObservationWindow.spanY[0])}" x2="${planX(29)}" y2="${planY(features.poolObservationWindow.spanY[1])}" class="windowLine" data-entity="${features.poolObservationWindow.entityId}"/>
    <line x1="${planX(32)}" y1="${planY(2.5)}" x2="${planX(32)}" y2="${planY(6.7)}" class="wallLine"/><line x1="${planX(32)}" y1="${planY(7.7)}" x2="${planX(32)}" y2="${planY(12.2)}" class="wallLine"/><line x1="${planX(32)}" y1="${planY(13.2)}" x2="${planX(32)}" y2="${planY(13.5)}" class="wallLine"/>
    <line x1="${planX(32)}" y1="${planY(8)}" x2="${planX(41)}" y2="${planY(8)}" class="wallLine"/>${entries}
    ${showerMarks(male)}${showerMarks(female)}${l2SupportMarks(male)}${l2SupportMarks(female)}${stairToL3Plan()}
    ${male.lockerBanks.concat(female.lockerBanks).map(({ planExtent: b }) => `<rect x="${planX(b.x1)}" y="${planY(b.y2)}" width="${(b.x2 - b.x1) * scale}" height="${(b.y2 - b.y1) * scale}" class="locker"/>`).join('')}
    <rect x="${planX(counter.x1)}" y="${planY(counter.y2)}" width="${(counter.x2 - counter.x1) * scale}" height="${(counter.y2 - counter.y1) * scale}" rx="3" class="counter"/><text x="${planX(29.53)}" y="${planY(10.65)}" text-anchor="middle" class="tiny" transform="rotate(-90 ${planX(29.53)} ${planY(10.65)})">懸空站立長桌／無椅</text>
    <rect x="${planX(fountain.x1)}" y="${planY(fountain.y2)}" width="${(fountain.x2 - fountain.x1) * scale}" height="${(fountain.y2 - fountain.y1) * scale}" rx="3" class="service"/><text x="${planX(30.93)}" y="${planY(3.45) + 3}" text-anchor="middle" class="tiny">飲水機</text>
    ${features.planters.map(({ center: [x, y] }) => `<circle cx="${planX(x)}" cy="${planY(y)}" r="9" class="plant"/>`).join('')}
    <text x="${planX(30.4)}" y="${planY(8)}" text-anchor="middle" class="tiny" transform="rotate(-90 ${planX(30.4)} ${planY(8)})">L 形面池觀景走道 · 站立使用</text>
    <text x="${planX(30)}" y="${planY(1) + 4}" text-anchor="middle" class="tiny">ST-01 到達／走道起點</text>
    <rect x="60" y="845" width="1560" height="82" rx="9" class="note"/><text x="82" y="875" class="small">Review A：男區 Y2.5～8、女區 Y8～13.5；男女各 15 間含隔間 1.20 × 1.20 m 淋浴模組＋1 WC＋2 洗手槽，入口均為 X32 的 1.00 m 無門片開口。</text><text x="82" y="902" class="small">L 形走道沿 X29 觀景窗設懸空站立桌（無椅）、飲水機與盆栽；ST-02 採懸空雙梯梁語彙並於梯下配置 3 組可移除耐陰植栽。無障礙、排水、避難與結構仍待專業驗證。</text>`, 'DRAW-L2-PLAN');
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
  const extension = active.l3.orthogonalExtension;
  const arrival = active.l3.arrivalWing;
  const terrace = active.l3.landscapeTerrace;
  const roof = active.l3.roof;
  const pv = active.l3.pvRoofReserve;
  const extensionPoints = extension.polygon.map(([x, y]) => `${planX(x)},${planY(y)}`).join(' ');
  const arrivalPoints = arrival.polygon.map(([x, y]) => `${planX(x)},${planY(y)}`).join(' ');
  const rotationTransform = `rotate(${active.l3.planRotation} ${planX(pivot.x)} ${planY(pivot.y)})`;
  const pvColumns = Array.from({ length: Math.floor((pv.bounds.x2 - pv.bounds.x1) / 0.85) }, (_, index) => pv.bounds.x1 + (index + 1) * 0.85).filter((x) => x < pv.bounds.x2);
  const pvRows = Array.from({ length: Math.floor((pv.bounds.y2 - pv.bounds.y1) / 1.3) }, (_, index) => pv.bounds.y1 + (index + 1) * 1.3).filter((y) => y < pv.bounds.y2);
  return shell('3F 概念平面圖', `PROJECT / MODEL ${versionSlug} · L3 +6.88 m · +${active.l3.planRotation.toFixed(1)}°／+${active.l3.mirror.leanFromVertical.toFixed(1)}° 工作值 · SITE-XY`, `${northArrow()}<g transform="translate(184.8 118.8) scale(0.78)" data-drawing-scale="fit-complete-rotated-roof">${rect(active.site, 'reference', '1F 基地參照')}${rect(active.l2.floorPlate, 'reference', '固定 L2 投影')}
    <polygon points="${extensionPoints}" class="terrace" data-entity="L3-EXT-01" data-gross-area="${extension.grossArea}"/><text x="${planX(40.35)}" y="${planY(3.25)}" text-anchor="middle" class="tiny">教師／維修專用景觀區</text><text x="${planX(40.35)}" y="${planY(2.85)}" text-anchor="middle" class="tiny">淨 ${terrace.netLandscapeArea.toFixed(3)} m²／上鎖管制</text>
    <polygon points="${arrivalPoints}" class="arrival" data-entity="Z-L3-ARRIVAL-01" data-covered="true"/><text x="${planX(40.05)}" y="${planY(1.25)+4}" text-anchor="middle" class="tiny">有頂室內到達翼 ${arrival.area.toFixed(3)} m²</text><line x1="${planX(39.65)}" y1="${planY(1.25)}" x2="${planX(40.75)}" y2="${planY(1.25)}" stroke="#9a4e2d" stroke-width="2.5"/><path d="M${planX(40.75)} ${planY(1.25)}l-10 -5v10z" fill="#9a4e2d"/>
    <g data-entity="L3-ROTATED-ASSEMBLY" data-shared-plan-rotation="${active.l3.planRotation}" transform="${rotationTransform}">
      <g data-entity="L3-PLATE-01" data-coordinate-system="SITE-XY" data-bounds="${boundsData(active.l3.floorPlate)}"><rect x="${planX(b.x1)}" y="${planY(b.y2)}" width="${(b.x2-b.x1)*scale}" height="${(b.y2-b.y1)*scale}" class="working"/></g>
      <g class="structure"><rect x="${planX(32.5)-5}" y="${planY(12)}" width="10" height="${4 * scale}"/><rect x="${planX(35.5)-5}" y="${planY(7.5)}" width="10" height="${7.5 * scale}"/></g>
      <g><rect x="${planX(33)}" y="${planY(10)}" width="${2.2*scale}" height="${1.6*scale}" class="service"/><circle cx="${planX(34)}" cy="${planY(6.8)}" r="22" class="service"/><text x="${planX(34.1)}" y="${planY(11)}" text-anchor="middle" class="tiny">除濕／熱回收</text><text x="${planX(34)}" y="${planY(6.8)+4}" text-anchor="middle" class="tiny">水塔</text></g>
      <g data-entity="${roof.entityId}" data-area="${roof.area}" data-complete-roof="true"><rect x="${planX(roof.bounds.x1)}" y="${planY(roof.bounds.y2)}" width="${(roof.bounds.x2-roof.bounds.x1)*scale}" height="${(roof.bounds.y2-roof.bounds.y1)*scale}" class="roof"/></g>
      <line x1="${planX(b.x1)}" y1="${planY(b.y1)}" x2="${planX(b.x1)}" y2="${planY(b.y2)}" class="mirror" data-entity="${active.l3.mirror.entityId}"/>
      <g data-entity="${pv.entityId}" data-area="${pv.area}" data-roof-area="${pv.roofArea}" data-coverage-percent="${pv.coveragePercent}" data-perimeter-setback="${pv.perimeterSetback}" data-capacity-status="${pv.capacityStatus}" data-shared-plan-rotation="${active.l3.planRotation}"><rect x="${planX(pv.bounds.x1)}" y="${planY(pv.bounds.y2)}" width="${(pv.bounds.x2-pv.bounds.x1)*scale}" height="${(pv.bounds.y2-pv.bounds.y1)*scale}" class="pv"/>${pvColumns.map((x) => `<line x1="${planX(x)}" y1="${planY(pv.bounds.y1)}" x2="${planX(x)}" y2="${planY(pv.bounds.y2)}" class="pvGrid"/>`).join('')}${pvRows.map((y) => `<line x1="${planX(pv.bounds.x1)}" y1="${planY(y)}" x2="${planX(pv.bounds.x2)}" y2="${planY(y)}" class="pvGrid"/>`).join('')}<text x="${planX((pv.bounds.x1+pv.bounds.x2)/2)}" y="${planY((pv.bounds.y1+pv.bounds.y2)/2)+4}" text-anchor="middle" class="small" style="fill:#24536b;font-weight:700">屋頂光電高覆蓋率排布 ${pv.area.toFixed(1)} m²／${pv.coveragePercent.toFixed(2)}%</text></g>
      <text x="${planX(pivot.x)}" y="${planY(pivot.y)}" text-anchor="middle" class="label">L3／屋頂／鏡牆／光電共用 +${active.l3.planRotation.toFixed(1)}°</text>
    </g>
    <circle cx="${planX(pivot.x)}" cy="${planY(pivot.y)}" r="7" fill="#a95c25"/><text x="${planX(pivot.x)+10}" y="${planY(pivot.y)-12}" class="tiny">支點 X35／Y6.75</text>
    ${grid()}
    <text x="${planX(34)}" y="${planY(13.4)}" text-anchor="middle" class="tiny">完整 3F 屋頂；太陽能板為淡藍透明圖層，可在 HTML 獨立顯示／隱藏</text></g>
    <rect x="60" y="845" width="1610" height="82" rx="9" class="note"/><text x="82" y="875" class="small">L3 樓板、完整屋頂、鏡牆與太陽能板共用同一 +${active.l3.planRotation.toFixed(1)}° SITE-XY transform；不再對光電圖層施加反向或額外旋轉。</text><text x="82" y="902" class="small">太陽能板改為淡藍透明填色以閱讀下方結構；周邊保留 ${pv.perimeterSetback.toFixed(2)} m，概念覆蓋 ${pv.area.toFixed(1)}／${pv.roofArea.toFixed(1)} m²（${pv.coveragePercent.toFixed(2)}%），容量與專業核定仍待定。</text>`, 'DRAW-L3-PLAN');
}

function sectionDrawing() {
  const sx = (x) => 100 + x * 36;
  const sz = (z) => 760 - z * 36;
  const pool = active.l1.pool;
  const stair = active.stair;
  const stair2 = active.l2.stairToL3;
  const flight = (x0, z0, reverse = false) => Array.from({ length: stair.treadsPerRun }, (_, i) => {
    const x = reverse ? x0 + (stair.treadsPerRun - i) * stair.treadDepth : x0 + (i + 1) * stair.treadDepth;
    const z = z0 + (i + 1) * stair.riserHeight;
    return `${sx(x)},${sz(z)}`;
  }).join(' ');
  const l3Min = 26.7;
  const l3Max = 43.3;
  const roof = active.roof;
  const pv = active.l3.pvRoofReserve;
  const stairLandscape = stair2.underStairLandscape;
  const mirrorTopX = 29 - Math.tan(active.l3.mirror.leanFromVertical * Math.PI / 180) * active.l3.mirror.height;
  const l3Roof = active.l3.roof;
  const body = `${sectionGrid(sx, sz)}<g><line x1="${sx(0)}" y1="${sz(0)}" x2="${sx(41)}" y2="${sz(0)}" class="outline"/>${[0.1,0.3,3.3,6.88,10.48].map((z) => `<line x1="${sx(0)}" y1="${sz(z)}" x2="${sx(43.5)}" y2="${sz(z)}" class="level"/><text x="${sx(43.7)}" y="${sz(z)+4}" class="tiny">+${z.toFixed(2)} m</text>`).join('')}</g>
    <g data-entity="POOL-01" data-coordinate-system="SITE-XY" data-bounds="${boundsData(pool)}"><path d="M${sx(pool.bounds.x1)} ${sz(0.22)}L${sx(pool.bounds.x2)} ${sz(0.22)}L${sx(pool.bounds.x2)} ${sz(-1.28)}L${sx(pool.bounds.x1)} ${sz(-0.98)}Z" class="water"/><text x="${sx(15.5)}" y="${sz(-0.4)}" text-anchor="middle" class="label">25 m 泳池 · 左 1.2 m → 右 1.5 m</text></g>
    <g data-entity="RF-GL-01" data-coordinate-system="SITE-XY" data-bounds="${boundsData(roof)}"><path d="M${sx(0)} ${sz(roof.lowElevation)}L${sx(29)} ${sz(roof.highElevation)}L${sx(29)} ${sz(roof.highElevation+0.12)}L${sx(0)} ${sz(roof.lowElevation+0.12)}Z" class="roof"/><text x="${sx(13)}" y="${sz(5.35)}" class="label" transform="rotate(-5 ${sx(13)} ${sz(5.35)})">29.0 m 玻璃屋頂 · 5°</text></g>
    <g data-entity="${active.l1.westGlassEave.entityId}"><path d="M${sx(0)} ${sz(roof.lowElevation+0.13)}L${sx(0.5)} ${sz(roof.lowElevation+0.17)}" class="glassLine"/><text x="${sx(0.05)}" y="${sz(4.55)}" class="tiny">X0～0.5 突出玻璃屋簷</text></g>
    <g data-entity="${active.l1.westRainwaterRecovery.entityId}"><rect x="${sx(0.08)}" y="${sz(0.18)}" width="${0.34*36}" height="${0.18*36}" class="rain"/><path d="M${sx(0.25)} ${sz(0.18)}L${sx(0.25)} ${sz(-0.55)}" class="projected"/><text x="${sx(0.62)}" y="${sz(-0.35)}" class="tiny">雨水回收</text></g>
    <g data-entity="W-L1-X0.5-01"><line x1="${sx(0.5)}" y1="${sz(0.3)}" x2="${sx(0.5)}" y2="${sz(roof.lowElevation+0.04)}" class="glassLine"/><text x="${sx(0.62)}" y="${sz(2.2)}" class="tiny">L1 西端牆 X0.5</text></g>
    <g data-entity="EN-01" data-projection="elevation-not-cut"><rect x="${sx(1)}" y="${sz(2.72)}" width="${2*36}" height="${(2.72-0.3)*36}" class="projected"/><text x="${sx(2)}" y="${sz(1.42)}" text-anchor="middle" class="tiny">EN-01 投影 X1～X3</text></g>
    <g data-entity="${active.l1.rearGlassCanopy.entityId}" data-projection-y="14-14.5"><line x1="${sx(31)}" y1="${sz(3.42)}" x2="${sx(39)}" y2="${sz(3.42)}" class="projected"/><text x="${sx(35)}" y="${sz(3.55)}" text-anchor="middle" class="tiny">後側透明玻璃突出屋簷（投影）</text></g>
    <g><rect x="${sx(29)}" y="${sz(3.3)}" width="${12*36}" height="9" class="wall"/><rect x="${sx(29)}" y="${sz(active.l2.ceiling.elevation)}" width="${12*36}" height="${active.l2.ceiling.thickness*36}" class="wall" data-entity="${active.l2.ceiling.entityId}" data-continuous="true"/><line x1="${sx(29)}" y1="${sz(3.3)}" x2="${sx(29)}" y2="${sz(6.88)}" class="wallLine" data-entity="W-L2-X29-01"/><line x1="${sx(41)}" y1="${sz(3.3)}" x2="${sx(41)}" y2="${sz(6.88)}" class="wallLine" data-entity="W-L2-X41-01"/><rect x="${sx(l3Min)}" y="${sz(6.88)}" width="${(l3Max-l3Min)*36}" height="9" class="working"/><rect x="${sx(l3Roof.bounds.x1)}" y="${sz(l3Roof.baseElevation + l3Roof.thickness)}" width="${(l3Roof.bounds.x2-l3Roof.bounds.x1)*36}" height="${l3Roof.thickness*36}" class="wall" data-entity="${l3Roof.entityId}" data-complete-roof="true"/><line x1="${sx(29)}" y1="${sz(6.88)}" x2="${sx(mirrorTopX)}" y2="${sz(10.48)}" class="mirror"/><line x1="${sx(41)}" y1="${sz(6.88)}" x2="${sx(41)}" y2="${sz(10.48)}" class="wallLine" data-entity="W-L3-X41-01"/><text x="${sx(34.5)}" y="${sz(3.55)}" class="small">L2 固定更衣層 +3.30／完整天花 +6.88</text><text x="${sx(34)}" y="${sz(7.16)}" class="small">L3 旋轉服務層 +6.88</text><text x="${sx(34)}" y="${sz(l3Roof.baseElevation)+28}" class="small">L3 完整屋頂連接鏡牆上緣</text><text x="${sx(27.5)}" y="${sz(9)}" class="tiny">鏡牆外傾 ${active.l3.mirror.leanFromVertical.toFixed(1)}°</text></g>
    <g data-entity="ST-01" data-coordinate-system="SITE-XY" data-bounds="${boundsData(stair)}" data-design-intent="suspended-floating-stair"><line x1="${sx(stair.bounds.x1+0.15)}" y1="${sz(stair.lowerElevation+0.02)}" x2="${sx(stair.bounds.x1+stair.runLengthPerFlight-0.15)}" y2="${sz(1.65)}" stroke="#263746" stroke-width="8"/><line x1="${sx(stair.bounds.x1+stair.runLengthPerFlight)}" y1="${sz(1.72)}" x2="${sx(stair.bounds.x1+stair.runLengthPerFlight+stair.midLandingLength)}" y2="${sz(1.72)}" stroke="#263746" stroke-width="8"/><line x1="${sx(stair.bounds.x1+stair.runLengthPerFlight+stair.midLandingLength+0.15)}" y1="${sz(1.72)}" x2="${sx(stair.bounds.x2-0.15)}" y2="${sz(3.15)}" stroke="#263746" stroke-width="8"/><polyline points="${sx(stair.bounds.x1)},${sz(stair.lowerElevation)} ${flight(stair.bounds.x1, stair.lowerElevation)} ${sx(stair.bounds.x1+stair.runLengthPerFlight+stair.midLandingLength)},${sz(1.8)} ${flight(stair.bounds.x1+stair.runLengthPerFlight+stair.midLandingLength,1.8)}" fill="none" stroke="#58676d" stroke-width="3"/><text x="${sx(24.75)}" y="${sz(2.15)}" text-anchor="middle" class="tiny">懸空薄踏步＋雙連續鋼箱梯梁 · 2.70＋3.10＋2.70 m · 20R／18T</text></g>
    <g data-entity="ST-02" data-axis="+x" data-y-band="0.5,2" data-design-intent="suspended-floating-stair"><line x1="${sx(32.5)}" y1="${sz(3.3)}" x2="${sx(35.25)}" y2="${sz(5.09)}" stroke="#46555b" stroke-width="7"/><line x1="${sx(35.25)}" y1="${sz(5.09)}" x2="${sx(36.75)}" y2="${sz(5.09)}" stroke="#46555b" stroke-width="7"/><line x1="${sx(36.75)}" y1="${sz(5.09)}" x2="${sx(39.5)}" y2="${sz(6.88)}" stroke="#46555b" stroke-width="7"/><line x1="${sx(39.5)}" y1="${sz(6.88)}" x2="${sx(41)}" y2="${sz(6.88)}" stroke="#286b5c" stroke-width="9"/><text x="${sx(36.75)}" y="${sz(5.55)}" text-anchor="middle" class="tiny">ST-02 懸空薄踏步＋雙連續鋼箱梯梁／22R</text></g>
    <g data-entity="${stairLandscape.entityId}" data-planter-count="${stairLandscape.planterCount}">${[33.42,33.88,34.34].map((x, index) => `<rect x="${sx(x)-7}" y="${sz(3.3)-10}" width="14" height="10" rx="3" class="plant"/><path d="M${sx(x)} ${sz(3.3)-10}q${index % 2 ? 8 : -8} -18 ${index % 2 ? 13 : -13} -26" fill="none" stroke="#52774b" stroke-width="2"/>`).join('')}<text x="${sx(33.9)}" y="${sz(2.72)}" text-anchor="middle" class="tiny">梯下 3 組可移除耐陰盆栽</text></g>
    <g data-entity="${pv.entityId}" data-area="${pv.area}" data-coverage-percent="${pv.coveragePercent}" data-capacity-status="${pv.capacityStatus}"><rect x="${sx(pv.bounds.x1)}" y="${sz(pv.baseElevation + 0.08)}" width="${(pv.bounds.x2-pv.bounds.x1)*36}" height="8" class="pv"/><text x="${sx((pv.bounds.x1+pv.bounds.x2)/2)}" y="${sz(pv.baseElevation)-28}" text-anchor="middle" class="tiny">3F 屋頂光電高覆蓋率排布 ${pv.area.toFixed(1)} m²／${pv.coveragePercent.toFixed(2)}%／容量待定</text></g>
    <g><rect x="${sx(31)}" y="${sz(3.3)}" width="${4.5*36}" height="${3*36}" class="confirmed"/><rect x="${sx(35.5)}" y="${sz(3.3)}" width="${3.5*36}" height="${3.2*36}" class="working"/><text x="${sx(33.25)}" y="${sz(1.65)}" text-anchor="middle" class="tiny">泳池側廁所 +0.30</text><text x="${sx(37.25)}" y="${sz(1.55)}" text-anchor="middle" class="tiny">操場側廁所 +0.10</text><rect x="${sx(39)}" y="${sz(0.1)}" width="${2*36}" height="4" class="deferred"/></g>
    <rect x="60" y="842" width="1630" height="84" rx="9" class="note"/><text x="82" y="873" class="small">剖面補齊 L1 西端 X0.5、L2 X29、L2／L3 X41 垂直牆；EN-01 不在中心剖切線上，故以投影虛線表示。L2 天花與 L3 屋頂均連續。</text><text x="82" y="902" class="small">X0～X0.5 玻璃屋簷與雨水回收、後側玻璃屋簷均標示；3F 太陽能板採淡藍透明圖層。結構、防水、排水、容量、眩光、消防與儲能仍須專業核定。</text>`;
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
