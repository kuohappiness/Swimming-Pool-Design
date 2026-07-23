import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const baseModelVersion = '0.6.2';
const baseGeometryRevisionId = 'GEO-0.6.2';

const outputDir = resolve(repoRoot, 'reference', 'drafts', 'v0.6.3');
const outputPath = resolve(outputDir, 'DRAW-L2-PLAN-v0.6.3-REVIEW-A.svg');
const scale = 56;
const originX = 120;
const originY = 890;
const sx = (siteX) => Number((originX + (siteX - 29) * scale).toFixed(2));
const sy = (siteY) => Number((originY - siteY * scale).toFixed(2));
const width = (metres) => Number((metres * scale).toFixed(2));
const points = (coordinates) => coordinates.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ');

const layout = {
  plate: { x1: 29, x2: 41, y1: 0, y2: 13.5 },
  circulation: [[29, 0], [32.5, 0], [32.5, 2.5], [32, 2.5], [32, 13.5], [29, 13.5]],
  stairZone: { x1: 32.5, x2: 41, y1: 0, y2: 2.5 },
  stairBand: { x1: 32.5, x2: 41, y1: 0.5, y2: 2 },
  male: { x1: 32, x2: 41, y1: 2.5, y2: 8 },
  female: { x1: 32, x2: 41, y1: 8, y2: 13.5 },
  maleEntry: { x: 32, y1: 6.7, y2: 7.7 },
  femaleEntry: { x: 32, y1: 12.2, y2: 13.2 },
  showerX1: 34.8,
  showerRows: {
    male: [2.55, 4.65, 6.75],
    female: [8.05, 10.15, 12.25],
  },
};

const polygonArea = (polygon) => Math.abs(polygon.reduce((sum, [x1, y1], index) => {
  const [x2, y2] = polygon[(index + 1) % polygon.length];
  return sum + x1 * y2 - x2 * y1;
}, 0) / 2);
const grossArea = (bounds) => (bounds.x2 - bounds.x1) * (bounds.y2 - bounds.y1);
const areaTotal = polygonArea(layout.circulation) + grossArea(layout.stairZone) + grossArea(layout.male) + grossArea(layout.female);
if (Math.abs(polygonArea(layout.circulation) - 41.75) > 1e-9 || Math.abs(areaTotal - 162) > 1e-9) {
  throw new Error(`Review layout area accounting failed: circulation ${polygonArea(layout.circulation)}, total ${areaTotal}.`);
}

const styles = `<style>
  text{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;fill:#243642}
  .title{font-size:32px;font-weight:800}.subtitle{font-size:14px;fill:#5a7078}.label{font-size:13px;font-weight:700}.small{font-size:11.5px}.tiny{font-size:9.5px}.micro{font-size:8px}
  .plate{fill:#fbfcfc;stroke:#263746;stroke-width:2.2}.grid{stroke:#d9e1e2;stroke-width:.55}.grid-major{stroke:#aebec2;stroke-width:1}
  .corridor{fill:#dcecef;stroke:#357487;stroke-width:1.6}.male{fill:#eadfcb;stroke:#9a6a2f;stroke-width:1.6}.female{fill:#e5e0ee;stroke:#76598d;stroke-width:1.6}
  .stair-zone{fill:#dbe2e4;stroke:#41565e;stroke-width:1.6}.stair{fill:#c7d0d3;stroke:#263746;stroke-width:1.4}.landing{fill:#b5c1c5;stroke:#263746;stroke-width:1}
  .wall{stroke:#65757b;stroke-width:7;stroke-linecap:square}.glass{stroke:#3d9bb3;stroke-width:7}.window{stroke:#4fa5bb;stroke-width:9}.split{stroke:#65757b;stroke-width:5}
  .shower{fill:#f8fbfa;stroke:#436e70;stroke-width:1.2}.shower-door{stroke:#2e6668;stroke-width:2}.optional{fill:#f2e6ef;stroke:#925b85;stroke-width:1.5;stroke-dasharray:5 3}
  .fixture{fill:#fff;stroke:#536b75;stroke-width:1.2}.basin{fill:#d9edf2;stroke:#367486;stroke-width:1.2}.locker{fill:#cfd8d8;stroke:#64787a;stroke-width:1}
  .counter{fill:#d7c5ab;stroke:#8a6234;stroke-width:1.5}.plant{fill:#bed6b2;stroke:#52774b;stroke-width:1.3}.water{fill:#c9e5ed;stroke:#3b8194;stroke-width:1.3}
  .panel{fill:#f7f9f9;stroke:#aebcc0;stroke-width:1.1}.panel-title{font-size:14px;font-weight:800;fill:#314850}.confirmed-dot{fill:#237c64}.working-dot{fill:#a96f28}.optional-dot{fill:#925b85}
  .dim{stroke:#667980;stroke-width:1;fill:none}.route{stroke:#2f7788;stroke-width:2;fill:none;stroke-dasharray:7 5}.view{stroke:#2d8da5;stroke-width:1.6;fill:none}
  .north{stroke:#c4553f;stroke-width:3.5}.warning{fill:#9b4f34;font-weight:700}.footer{fill:#f4f6f6;stroke:#263746;stroke-width:1.2}
</style>`;

function rect(bounds, className, extra = '') {
  return `<rect x="${sx(bounds.x1)}" y="${sy(bounds.y2)}" width="${width(bounds.x2 - bounds.x1)}" height="${width(bounds.y2 - bounds.y1)}" class="${className}" ${extra}/>`;
}

function grid() {
  const marks = [];
  for (let x = 29; x <= 41.0001; x += 0.5) {
    const major = Math.abs(x / 2.5 - Math.round(x / 2.5)) < 1e-6;
    marks.push(`<line x1="${sx(x)}" y1="${sy(13.5)}" x2="${sx(x)}" y2="${sy(0)}" class="${major ? 'grid-major' : 'grid'}"/>`);
    if (major || x === 29 || x === 41) marks.push(`<text x="${sx(x)}" y="${sy(0) + 19}" text-anchor="middle" class="tiny">X${x}</text>`);
  }
  for (let y = 0; y <= 13.5001; y += 0.5) {
    const major = Math.abs(y / 2.5 - Math.round(y / 2.5)) < 1e-6;
    marks.push(`<line x1="${sx(29)}" y1="${sy(y)}" x2="${sx(41)}" y2="${sy(y)}" class="${major ? 'grid-major' : 'grid'}"/>`);
    if (major || y === 13.5) marks.push(`<text x="${sx(29) - 10}" y="${sy(y) + 3}" text-anchor="end" class="tiny">Y${y}</text>`);
  }
  return `<g aria-label="SITE-XY 0.5 metre review grid">${marks.join('')}</g>`;
}

function dimension(x1, y1, x2, y2, label, labelDx = 0, labelDy = -7) {
  const x1p = sx(x1);
  const y1p = sy(y1);
  const x2p = sx(x2);
  const y2p = sy(y2);
  return `<g><line x1="${x1p}" y1="${y1p}" x2="${x2p}" y2="${y2p}" class="dim"/><line x1="${x1p - 4}" y1="${y1p - 4}" x2="${x1p + 4}" y2="${y1p + 4}" class="dim"/><line x1="${x2p - 4}" y1="${y2p - 4}" x2="${x2p + 4}" y2="${y2p + 4}" class="dim"/><text x="${(x1p + x2p) / 2 + labelDx}" y="${(y1p + y2p) / 2 + labelDy}" text-anchor="middle" class="tiny">${label}</text></g>`;
}

function showerBank(prefix, rowStarts) {
  let number = 1;
  const groups = [];
  rowStarts.forEach((rowY, rowIndex) => {
    for (let column = 0; column < 5; column += 1) {
      const x1 = layout.showerX1 + column * 1.2;
      const bounds = { x1, x2: x1 + 1.2, y1: rowY, y2: rowY + 1.2 };
      const doorY = rowIndex === 0 ? bounds.y2 : bounds.y1;
      const id = `${prefix}-${String(number).padStart(2, '0')}`;
      groups.push(`<g data-shower="${id}" data-inclusive-size="1.2x1.2">${rect(bounds, 'shower')}<line x1="${sx(x1 + 0.42)}" y1="${sy(doorY)}" x2="${sx(x1 + 0.78)}" y2="${sy(doorY)}" stroke="#fff" stroke-width="3.5"/><line x1="${sx(x1 + 0.42)}" y1="${sy(doorY)}" x2="${sx(x1 + 0.72)}" y2="${sy(doorY + (rowIndex === 0 ? 0.28 : -0.28))}" class="shower-door"/><text x="${sx(x1 + 0.6)}" y="${sy(rowY + 0.6) + 3}" text-anchor="middle" class="micro">${id}</text></g>`);
      number += 1;
    }
  });
  return groups.join('');
}

function supportFixtures(zoneName, yBase, basinYs) {
  const wc = { x1: 32.18, x2: 33.38, y1: yBase, y2: yBase + 1.5 };
  const basins = basinYs.map((y, index) => `<g data-optional-basin="${zoneName}-${index + 1}"><rect x="${sx(32.08)}" y="${sy(y + 0.26)}" width="${width(0.52)}" height="${width(0.52)}" rx="5" class="basin"/><circle cx="${sx(32.34)}" cy="${sy(y)}" r="3" fill="#367486"/></g>`).join('');
  return `<g data-optional-support="${zoneName}" data-status="working-suggestion">${rect(wc, 'optional')}<rect x="${sx(32.6)}" y="${sy(yBase + 1.02)}" width="${width(0.38)}" height="${width(0.62)}" rx="4" class="fixture"/><text x="${sx(32.78)}" y="${sy(yBase + 0.28)}" text-anchor="middle" class="micro">1 WC 建議</text>${basins}<text x="${sx(32.75)}" y="${sy(basinYs[0] + 0.58)}" text-anchor="middle" class="micro">2 洗手槽建議</text></g>`;
}

function stair() {
  const b = layout.stairBand;
  const firstEnd = 35.25;
  const secondStart = 36.75;
  const secondEnd = 39.5;
  const treads = [];
  for (let index = 1; index <= 10; index += 1) {
    for (const x of [32.5 + index * 0.275, secondStart + index * 0.275]) {
      treads.push(`<line x1="${sx(x)}" y1="${sy(b.y2)}" x2="${sx(x)}" y2="${sy(b.y1)}" stroke="#43545b" stroke-width="1"/>`);
    }
  }
  return `<g data-entity="ST-02-REVIEW" data-stair-zone="32.5,41,0,2.5" data-clear-band="32.5,41,0.5,2">${rect(b, 'stair')}${treads.join('')}${rect({ x1: firstEnd, x2: secondStart, y1: b.y1, y2: b.y2 }, 'landing')}${rect({ x1: secondEnd, x2: 41, y1: b.y1, y2: b.y2 }, 'landing')}<line x1="${sx(33)}" y1="${sy(1.25)}" x2="${sx(40.35)}" y2="${sy(1.25)}" stroke="#9a4e2d" stroke-width="3"/><path d="M${sx(40.35)} ${sy(1.25)}l-13 -7v14z" fill="#9a4e2d"/><text x="${sx(36.75)}" y="${sy(2.17)}" text-anchor="middle" class="tiny">ST-02：1.50 m 淨寬置中／X32.5 起步 → +X</text></g>`;
}

function planBody() {
  return `
    <g id="l2-review-plan" data-coordinate-system="SITE-XY">
      ${rect(layout.plate, 'plate')}
      ${grid()}
      <polygon points="${points(layout.circulation)}" class="corridor" data-zone="L2-CIRCULATION-REVIEW"/>
      ${rect(layout.stairZone, 'stair-zone', 'data-zone="L2-STAIR-ZONE-REVIEW"')}
      ${rect(layout.male, 'male', 'data-zone="L2-MALE-REVIEW"')}
      ${rect(layout.female, 'female', 'data-zone="L2-FEMALE-REVIEW"')}
      <rect x="${sx(28.25)}" y="${sy(13)}" width="${width(0.75)}" height="${width(10.5)}" fill="#bfe4ef" fill-opacity=".55" stroke="#4a9bb0" stroke-dasharray="6 4"/>
      <text x="${sx(28.62)}" y="${sy(7.7)}" text-anchor="middle" class="tiny" transform="rotate(-90 ${sx(28.62)} ${sy(7.7)})">泳池挑高參照</text>

      <line x1="${sx(29)}" y1="${sy(0)}" x2="${sx(41)}" y2="${sy(0)}" class="glass" data-wall-finish="large-glass"/>
      <text x="${sx(35)}" y="${sy(0) + 36}" text-anchor="middle" class="small">Y0 大面玻璃：延續 ST-01 → ST-02 的垂直動線層次</text>
      <line x1="${sx(32.5)}" y1="${sy(2.5)}" x2="${sx(41)}" y2="${sy(2.5)}" class="wall" data-wall-finish="fair-faced-concrete"/>
      <text x="${sx(36.75)}" y="${sy(2.5) - 10}" text-anchor="middle" class="tiny">Y2.5 清水模分隔牆：樓梯區／更衣區</text>
      <line x1="${sx(29)}" y1="${sy(2.7)}" x2="${sx(29)}" y2="${sy(13)}" class="window" data-window-use="pool-observation"/>
      <text x="${sx(29) - 15}" y="${sy(8)}" text-anchor="middle" class="tiny" transform="rotate(-90 ${sx(29) - 15} ${sy(8)})">X29 觀景窗</text>

      <line x1="${sx(32)}" y1="${sy(2.5)}" x2="${sx(32)}" y2="${sy(6.7)}" class="wall"/>
      <line x1="${sx(32)}" y1="${sy(7.7)}" x2="${sx(32)}" y2="${sy(12.2)}" class="wall"/>
      <line x1="${sx(32)}" y1="${sy(13.2)}" x2="${sx(32)}" y2="${sy(13.5)}" class="wall"/>
      <line x1="${sx(32)}" y1="${sy(8)}" x2="${sx(41)}" y2="${sy(8)}" class="split"/>
      <g data-entry="male" data-clear-width="1" data-door-leaf="false"><line x1="${sx(32)}" y1="${sy(6.7)}" x2="${sx(32)}" y2="${sy(7.7)}" stroke="#fff" stroke-width="8"/><text x="${sx(31.82)}" y="${sy(7.2)}" text-anchor="end" class="tiny">男 1.00 m 無門片</text></g>
      <g data-entry="female" data-clear-width="1" data-door-leaf="false"><line x1="${sx(32)}" y1="${sy(12.2)}" x2="${sx(32)}" y2="${sy(13.2)}" stroke="#fff" stroke-width="8"/><text x="${sx(31.82)}" y="${sy(12.7)}" text-anchor="end" class="tiny">女 1.00 m 無門片</text></g>

      ${stair()}
      ${showerBank('M', layout.showerRows.male)}
      ${showerBank('F', layout.showerRows.female)}
      ${supportFixtures('male', 2.65, [4.95, 5.72])}
      ${supportFixtures('female', 8.15, [10.45, 11.22])}

      <g aria-label="changing lockers">
        <rect x="${sx(34.36)}" y="${sy(4.45)}" width="${width(0.34)}" height="${width(1.55)}" class="locker"/><rect x="${sx(34.36)}" y="${sy(7.8)}" width="${width(0.34)}" height="${width(1.55)}" class="locker"/>
        <rect x="${sx(34.36)}" y="${sy(10.05)}" width="${width(0.34)}" height="${width(1.55)}" class="locker"/><rect x="${sx(34.36)}" y="${sy(13.35)}" width="${width(0.34)}" height="${width(1.55)}" class="locker"/>
        <text x="${sx(34.54)}" y="${sy(5.1)}" text-anchor="middle" class="micro" transform="rotate(-90 ${sx(34.54)} ${sy(5.1)})">置物</text><text x="${sx(34.54)}" y="${sy(10.7)}" text-anchor="middle" class="micro" transform="rotate(-90 ${sx(34.54)} ${sy(10.7)})">置物</text>
      </g>

      <g data-corridor-furniture="standing-only">
        <rect x="${sx(29.22)}" y="${sy(12.45)}" width="${width(0.62)}" height="${width(3.6)}" rx="4" class="counter"/>
        <text x="${sx(29.53)}" y="${sy(10.65)}" text-anchor="middle" class="micro" transform="rotate(-90 ${sx(29.53)} ${sy(10.65)})">懸空站立長桌／無椅</text>
        <rect x="${sx(30.62)}" y="${sy(3.85)}" width="${width(0.62)}" height="${width(0.72)}" rx="4" class="water"/><text x="${sx(30.93)}" y="${sy(3.45) + 3}" text-anchor="middle" class="micro">飲水機</text>
        ${[[30.05, 4.65], [31.18, 6.05], [30.95, 13.05]].map(([x, y]) => `<circle cx="${sx(x)}" cy="${sy(y)}" r="${width(0.24)}" class="plant"/>`).join('')}
      </g>
      <path d="M${sx(30.9)} ${sy(1.7)}L${sx(30.9)} ${sy(12.8)}" class="route"/><text x="${sx(30.9) + 10}" y="${sy(8.2)}" class="tiny" transform="rotate(-90 ${sx(30.9) + 10} ${sy(8.2)})">連續面池走道／家具靠邊、不設座椅</text>
      <path d="M${sx(29.45)} ${sy(5)}l-${width(0.75)} 0M${sx(29.45)} ${sy(7.4)}l-${width(0.75)} 0M${sx(29.45)} ${sy(9.8)}l-${width(0.75)} 0" class="view"/>
      <path d="M${sx(28.7)} ${sy(5)}l8 -5v10zM${sx(28.7)} ${sy(7.4)}l8 -5v10zM${sx(28.7)} ${sy(9.8)}l8 -5v10z" fill="#2d8da5"/>

      <rect x="${sx(29)}" y="${sy(2)}" width="${width(2)}" height="${width(2)}" fill="none" stroke="#76598d" stroke-width="1.4" stroke-dasharray="6 4" data-reference="ST-01-arrival"/>
      <text x="${sx(30)}" y="${sy(1)}" text-anchor="middle" class="tiny">ST-01 到達／走道起點</text>
      <path d="M${sx(31)} ${sy(1.25)}L${sx(32.75)} ${sy(1.25)}" class="route"/><path d="M${sx(32.75)} ${sy(1.25)}l-10 -5v10z" fill="#2f7788"/>

      <text x="${sx(33.88)}" y="${sy(5.35)}" text-anchor="middle" class="label" transform="rotate(-90 ${sx(33.88)} ${sy(5.35)})">男更衣／淋浴 · 15 間</text>
      <text x="${sx(33.88)}" y="${sy(10.85)}" text-anchor="middle" class="label" transform="rotate(-90 ${sx(33.88)} ${sy(10.85)})">女更衣／淋浴 · 15 間</text>
      <text x="${sx(33.42)}" y="${sy(7.25)}" text-anchor="middle" class="tiny">男乾區</text>
      <text x="${sx(33.42)}" y="${sy(12.75)}" text-anchor="middle" class="tiny">女乾區</text>

      ${dimension(29, 13.85, 32, 13.85, '走道 3.00 m')}
      ${dimension(32, 13.85, 41, 13.85, '更衣／淋浴 9.00 m')}
      ${dimension(41.35, 0, 41.35, 2.5, '樓梯區 2.50 m', 45, 3)}
      <line x1="${sx(34.8)}" y1="${sy(13.65)}" x2="${sx(36)}" y2="${sy(13.65)}" class="dim"/><text x="${sx(35.4)}" y="${sy(13.65) - 6}" text-anchor="middle" class="tiny">每間 1.20 m</text>
    </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="title desc" data-target-version="0.6.3" data-review-revision="A" data-model-base-version="${baseModelVersion}" data-model-base-geometry="${baseGeometryRevisionId}" data-current-output="false" data-drawing-status="working-review">
  <title id="title">2F 更新版平面檢討圖 A</title>
  <desc id="desc">0.6.3 工作草案，以 v0.6.2 模型為基準；非 current、非施工圖。</desc>
  ${styles}
  <rect width="1920" height="1080" fill="#fff"/>
  <text x="70" y="50" class="title">2F 更新版平面檢討圖 A</text>
  <text x="72" y="80" class="subtitle">TARGET v0.6.3 · MODEL BASE v${baseModelVersion} / ${baseGeometryRevisionId} · SITE-XY · WORKING REVIEW · 非 CURRENT · 非施工圖</text>
${planBody()}

  <g transform="translate(875 112)">
    <rect width="975" height="155" rx="10" class="panel"/>
    <text x="24" y="30" class="panel-title">使用者指定的配置骨架</text>
    <circle cx="28" cy="58" r="5" class="confirmed-dot"/><text x="44" y="63" class="small">ST-02 獨立區 X32.5～41／Y0～2.5；Y2.5 分隔牆，Y0 延續大面玻璃。</text>
    <circle cx="28" cy="84" r="5" class="confirmed-dot"/><text x="44" y="89" class="small">X29～32 面池走道；X29 觀景窗、X32 更衣室牆；站立長桌不配置椅子。</text>
    <circle cx="28" cy="110" r="5" class="confirmed-dot"/><text x="44" y="115" class="small">女上男下；兩個入口均位於 X32 且靠各區上方，淨寬 1.00 m、無門片。</text>
    <circle cx="28" cy="136" r="5" class="confirmed-dot"/><text x="44" y="141" class="small">男女各 15 間淋浴，每間 1.20 × 1.20 m，尺寸包含隔間厚度。</text>
  </g>

  <g transform="translate(875 284)">
    <rect width="975" height="173" rx="10" class="panel"/>
    <text x="24" y="30" class="panel-title">本張圖採用的可逆工作假設</text>
    <circle cx="28" cy="58" r="5" class="working-dot"/><text x="44" y="63" class="small">走道在 ST-01 到達處局部加寬至 X32.5，之後維持 X29～32；形成連續 L 形動線。</text>
    <circle cx="28" cy="84" r="5" class="working-dot"/><text x="44" y="89" class="small">男區 X32～41／Y2.5～8；女區 X32～41／Y8～13.5；每側毛面積 49.5 m²。</text>
    <circle cx="28" cy="110" r="5" class="working-dot"/><text x="44" y="115" class="small">15 間淋浴採 3 排 × 5 間；排間工作走道 0.90 m，西側保留約 2.80 m 乾區。</text>
    <circle cx="28" cy="136" r="5" class="optional-dot"/><text x="44" y="141" class="small">每側試放 1 間一般 WC＋2 座洗手槽；屬空間利用建議，待確認後才納入正式需求。</text>
    <text x="44" y="162" class="tiny">淋浴門向、置物櫃、家具位置與植栽數量均可在不改配置骨架下調整。</text>
  </g>

  <g transform="translate(875 474)">
    <rect width="975" height="167" rx="10" class="panel"/>
    <text x="24" y="30" class="panel-title">概念可行性與必須保留的專業驗證</text>
    <text x="24" y="59" class="small">概念上可行：162 m² 固定 L2 樓板可容納 41.75 m² 走道／到達、21.25 m² 樓梯區，</text>
    <text x="24" y="81" class="small">以及男女各 49.5 m² 更衣淋浴區；圖面沒有擴大 L2 樓板或改動 L3 旋轉角。</text>
    <text x="24" y="109" class="small warning">仍須專業驗證：</text><text x="136" y="109" class="small">ST-02 淨高／避難／結構、Y0 安全玻璃與清水模牆支承、觀景窗耐濕與防火、</text>
    <text x="24" y="131" class="small">更衣隱私、排水防滑、0.90 m 排間通道、WC／洗手槽管道、懸空長桌固定及連續有效通行淨寬。</text>
    <text x="24" y="153" class="tiny">本圖不能作為建築、結構、消防、機電、無障礙、成本或施工核准。</text>
  </g>

  <g transform="translate(875 658)">
    <rect width="975" height="196" rx="10" class="panel"/>
    <text x="24" y="30" class="panel-title">面積與數量快照</text>
    <text x="24" y="58" class="small">走道／到達（L 形）</text><text x="340" y="58" class="label">41.75 m²</text>
    <text x="24" y="84" class="small">獨立樓梯區</text><text x="340" y="84" class="label">21.25 m²</text>
    <text x="24" y="110" class="small">男更衣／淋浴</text><text x="340" y="110" class="label">49.50 m² · 15 showers</text>
    <text x="24" y="136" class="small">女更衣／淋浴</text><text x="340" y="136" class="label">49.50 m² · 15 showers</text>
    <line x1="20" y1="151" x2="520" y2="151" stroke="#b8c4c7"/>
    <text x="24" y="177" class="small">合計</text><text x="340" y="177" class="label">162.00 m²</text>
    <g transform="translate(570 48)">
      <circle cx="5" cy="4" r="5" class="confirmed-dot"/><text x="20" y="9" class="tiny">使用者已指定</text>
      <circle cx="5" cy="36" r="5" class="working-dot"/><text x="20" y="41" class="tiny">本圖工作假設</text>
      <circle cx="5" cy="68" r="5" class="optional-dot"/><text x="20" y="73" class="tiny">待確認的加值配置</text>
      <line x1="0" y1="101" x2="34" y2="101" class="glass"/><text x="45" y="105" class="tiny">玻璃／觀景窗</text>
      <line x1="0" y1="132" x2="34" y2="132" class="wall"/><text x="45" y="136" class="tiny">清水模分隔牆</text>
    </g>
  </g>

  <g transform="translate(875 870)">
    <rect width="975" height="66" rx="10" class="panel"/>
    <rect x="20" y="18" width="200" height="30" fill="#c9d3d4" stroke="#65757b"/><rect x="220" y="18" width="310" height="30" fill="#d8eef2" stroke="#3d9bb3"/><rect x="530" y="18" width="200" height="30" fill="#c9d3d4" stroke="#65757b"/>
    <text x="120" y="39" text-anchor="middle" class="tiny">L1 清水模</text><text x="375" y="39" text-anchor="middle" class="tiny">L2 大面玻璃／動線延伸</text><text x="630" y="39" text-anchor="middle" class="tiny">L3 清水模</text>
    <text x="748" y="39" class="tiny">立面層次意圖；仍須以後續剖面／Viewer 驗證。</text>
  </g>

  <g data-north-plan-direction="lower-right"><g transform="translate(1800 65) rotate(127)"><line x1="0" y1="28" x2="0" y2="-26" class="north"/><path d="M0 -40L-8 -22H8Z" fill="#c4553f"/></g><text x="1822" y="95" text-anchor="middle" class="label">N</text></g>

  <g transform="translate(60 958)">
    <rect width="1800" height="82" class="footer"/>
    <line x1="1000" y1="0" x2="1000" y2="82" stroke="#263746"/><line x1="1300" y1="0" x2="1300" y2="82" stroke="#263746"/><line x1="1570" y1="0" x2="1570" y2="82" stroke="#263746"/>
    <text x="18" y="29" class="small">國立臺中教育大學附設實驗國民小學游泳池翻修</text><text x="18" y="61" class="label">2F 更新版平面檢討圖 A</text>
    <text x="1020" y="27" class="tiny">圖號</text><text x="1020" y="58" class="label">DRAW-L2-PLAN-v0.6.3-REVIEW-A</text>
    <text x="1320" y="27" class="tiny">TARGET／MODEL BASE</text><text x="1320" y="58" class="label">0.6.3／${baseModelVersion} · ${baseGeometryRevisionId}</text>
    <text x="1590" y="22" class="tiny">狀態</text><text x="1590" y="47" class="small warning">WORKING REVIEW</text><text x="1590" y="67" class="small warning">非 CURRENT · 非施工圖</text>
  </g>
</svg>`;

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${svg}\n`, 'utf8');
process.stdout.write(`${outputPath}\n`);
