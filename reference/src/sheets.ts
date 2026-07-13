import type { ProjectModel, SheetRender } from './types';
import {
  PLAN, badge, cubicleMarkup, dimH, dimV, grid, isoPoint, northArrow,
  planX, planY, points, px, sheetSvg,
} from './geometry';

const siteImage = new URL('../../source-materials/site/SRC-SITE-002_entrance-location-annotated.png', import.meta.url).href;

function renderSite(model: ProjectModel): SheetRender {
  const bearing = model.referenceSystem.localLongAxisBearingFromTrueNorth;
  const content = `
    <rect class="sheet-bg" x="0" y="0" width="1200" height="740"/>
    <g filter="url(#soft-shadow)">
      <rect class="image-frame" x="64" y="38" width="486" height="574" rx="10"/>
      <image href="${siteImage}" x="72" y="46" width="470" height="558" preserveAspectRatio="xMidYMid slice"/>
    </g>
    <g class="site-diagram">
      <text x="610" y="74" class="sheet-kicker">基地定位與模型座標</text>
      ${northArrow(1080, 102, 0)}
      <g transform="translate(640 178) rotate(${bearing - 90})">
        <rect class="site-pool" x="0" y="0" width="360" height="139" rx="6" data-entity="BLDG-01"/>
        <rect class="site-core" x="247" y="0" width="113" height="139" rx="3" data-entity="CORE-01"/>
        <circle class="entrance-marker" cx="260" cy="139" r="10" data-entity="EN-01"/>
        <path class="axis-arrow" d="M260 139v70"/>
      </g>
      ${badge('BLDG-01', 755, 374)}
      ${badge('CORE-01', 1000, 310, 'core')}
      ${badge('EN-01', 895, 454, 'entry')}
      ${badge('O-SITE-01', 1005, 454)}
      <g class="coordinate-card" transform="translate(610 496)">
        <rect width="520" height="112" rx="8"/>
        <text x="24" y="30" class="label">模型長軸方位</text><text x="496" y="30" text-anchor="end" class="value">${bearing}°</text>
        <text x="24" y="62" class="label">世界原點</text><text x="496" y="62" text-anchor="end" class="value">O-SITE-01 = EN-01 = (0, 0, 0)</text>
        <text x="24" y="94" class="label">座標</text><text x="496" y="94" text-anchor="end" class="value">+X 東 · +Y 北 · +Z 上</text>
      </g>
    </g>`;
  return { id: 'REF-001', markup: sheetSvg(model, 'REF-001', '基地與方位圖', content), note: '公開地圖標註是基地定位證據；模型長軸方位採 127°，O-SITE-01 與 EN-01 門檻中心共點。' };
}

function buildingPlanBase(model: ProjectModel): string {
  const length = px(model.geometry.building.length.value);
  const width = px(model.geometry.building.width.value);
  return `<rect class="building-outline" x="${PLAN.x}" y="${PLAN.y}" width="${length}" height="${width}" data-entity="BLDG-01"/>
    <line class="major-wall" x1="${planX(model.geometry.building.poolHallLength.value)}" y1="${PLAN.y}" x2="${planX(model.geometry.building.poolHallLength.value)}" y2="${PLAN.y + width}"/>`;
}

function renderL1(model: ProjectModel): SheetRender {
  const building = model.geometry.building;
  const pool = model.geometry.pool;
  const poolX = planX(pool.origin[0]);
  const poolY = planY(pool.origin[1] + pool.width.value, building.width.value);
  const serviceX = planX(building.poolHallLength.value);
  const width = px(building.width.value);
  const entranceX = planX(24.5);
  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    ${grid(model)}
    ${buildingPlanBase(model)}
    <rect class="pool-water" x="${poolX}" y="${poolY}" width="${px(pool.length.value)}" height="${px(pool.width.value)}" data-entity="POOL-01"/>
    ${[1, 2].map((lane) => `<line class="lane-line" x1="${poolX}" y1="${poolY + px(pool.width.value) * lane / 3}" x2="${poolX + px(pool.length.value)}" y2="${poolY + px(pool.width.value) * lane / 3}"/>`).join('')}
    <text class="zone-label" x="${planX(12)}" y="${planY(6.75)}" text-anchor="middle">泳池大廳 · Z-PH-01</text>
    <rect class="service-zone female" x="${serviceX}" y="${planY(6.75)}" width="${px(building.serviceCoreLength.value)}" height="${px(6.75)}" data-entity="Z-WC-F-01"/>
    <rect class="service-zone male" x="${serviceX}" y="${PLAN.y}" width="${px(building.serviceCoreLength.value)}" height="${px(6.75)}" data-entity="Z-WC-M-01"/>
    <text class="room-label" x="${planX(29.5)}" y="${planY(10)}" text-anchor="middle">男廁</text>
    <text class="room-label" x="${planX(29.5)}" y="${planY(3.4)}" text-anchor="middle">女廁</text>
    <rect class="stair-gallery" x="${planX(20.4)}" y="${planY(2.3)}" width="${px(13.1)}" height="${px(1.8)}" data-entity="Z-ST-01"/>
    ${Array.from({ length: 22 }, (_, index) => `<line class="stair-tread" x1="${planX(20.7 + index * 0.55)}" y1="${planY(2.18)}" x2="${planX(20.7 + index * 0.55)}" y2="${planY(.62)}"/>`).join('')}
    <path class="entrance" d="M${entranceX - 22} ${PLAN.y + width}h44" data-entity="EN-01"/>
    <path class="entry-arrow" d="M${entranceX} ${PLAN.y + width + 58}v-45m0 0l-9 14m9-14l9 14"/>
    ${badge('POOL-01', planX(11.9), planY(5.5), 'pool')}
    ${badge('ST-01', planX(27), planY(1.4), 'stair')}
    ${badge('EN-01', entranceX, PLAN.y + width + 70, 'entry')}
    ${badge('Z-WC-M-01', planX(29.5), planY(8.2), 'male')}
    ${badge('Z-WC-F-01', planX(29.5), planY(1.8), 'female')}
    ${dimH(PLAN.x, planX(building.poolHallLength.value), 548, '24.0')}
    ${dimH(planX(building.poolHallLength.value), planX(building.length.value), 548, '11.0')}
    ${dimH(PLAN.x, planX(building.length.value), 590, '35.0')}
    ${dimV(1050, PLAN.y, PLAN.y + width, '13.5')}
    ${northArrow(1110, 115)}`;
  return { id: 'REF-101', markup: sheetSvg(model, 'REF-101', 'L1 平面參照圖', content), note: 'EN-01 是唯一日常入口；L1 服務核心重建為男女廁所，ST-01 位於長邊玻璃乾式樓梯廊。' };
}

function renderL2(model: ProjectModel): SheetRender {
  const building = model.geometry.building;
  const serviceX = planX(building.poolHallLength.value);
  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    ${grid(model)}
    ${buildingPlanBase(model)}
    <rect class="pool-hall-void" x="${PLAN.x}" y="${PLAN.y}" width="${px(building.poolHallLength.value)}" height="${px(building.width.value)}" data-entity="Z-PH-01"/>
    <text class="void-label" x="${planX(12)}" y="${planY(6.75)}" text-anchor="middle">泳池大廳挑空</text>
    <rect class="service-zone female" x="${serviceX}" y="${planY(6.55)}" width="${px(11)}" height="${px(6.55)}" data-entity="Z-CS-F-01"/>
    <rect class="service-zone male" x="${serviceX}" y="${PLAN.y}" width="${px(11)}" height="${px(6.55)}" data-entity="Z-CS-M-01"/>
    <rect class="distribution-lobby" x="${serviceX}" y="${planY(7.15)}" width="${px(11)}" height="${px(0.6)}" data-entity="Z-L2-LOBBY-01"/>
    ${cubicleMarkup(model.program.l2.female.activeIds, model.program.l2.female.expansionIds, 'F', .35, model)}
    ${cubicleMarkup(model.program.l2.male.activeIds, model.program.l2.male.expansionIds, 'M', 7.25, model)}
    <path class="split-arrow" d="M${planX(33.3)} ${planY(6.85)}h-48m48 0l-13-9m13 9l-13 9"/>
    <text class="room-label" x="${planX(29.5)}" y="${planY(13.15)}" text-anchor="middle">男生區 · 15＋5</text>
    <text class="room-label" x="${planX(29.5)}" y="${planY(.1)}" text-anchor="middle">女生區 · 15＋5</text>
    ${badge('Z-CS-M-01', planX(18.2), planY(9.7), 'male')}
    ${badge('Z-CS-F-01', planX(18.2), planY(3.6), 'female')}
    ${badge('ST-01', planX(21), planY(1.3), 'stair')}
    <g class="legend" transform="translate(126 528)">
      <rect width="650" height="74" rx="8"/>
      <rect class="sample active" x="20" y="18" width="32" height="32"/><text x="64" y="39">正式 15 間／性別</text>
      <rect class="sample expansion" x="246" y="18" width="32" height="32"/><text x="290" y="39">擴充 5 間／性別</text>
      <rect class="sample cabinet" x="482" y="18" width="12" height="22"/><text x="508" y="39">每間壁掛櫃</text>
    </g>
    ${northArrow(1110, 115)}`;
  return { id: 'REF-201', markup: sheetSvg(model, 'REF-201', 'L2 平面參照圖', content), note: '男、女嚴格分區；實線為各 15 間正式整合式更衣淋浴單元，虛線為各 5 間擴充位置。每間內設壁掛櫃，不設集中櫃區。' };
}

function renderRoof(model: ProjectModel): SheetRender {
  const building = model.geometry.building;
  const width = px(building.width.value);
  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    ${grid(model)}
    <rect class="building-outline" x="${PLAN.x}" y="${PLAN.y}" width="${px(building.length.value)}" height="${width}"/>
    <rect class="glass-roof" x="${PLAN.x}" y="${PLAN.y}" width="${px(building.poolHallLength.value)}" height="${width}" data-entity="RF-GL-01"/>
    ${Array.from({ length: 9 }, (_, i) => `<line class="roof-mullion" x1="${PLAN.x + i * px(3)}" y1="${PLAN.y}" x2="${PLAN.x + i * px(3)}" y2="${PLAN.y + width}"/>`).join('')}
    <rect class="opaque-roof" x="${planX(24)}" y="${PLAN.y}" width="${px(11)}" height="${width}" data-entity="CORE-01"/>
    <path class="slope-arrow" d="M${planX(4)} ${planY(6.75)}H${planX(21.8)}m0 0l-18-11m18 11l-18 11"/>
    <text class="zone-label" x="${planX(12)}" y="${planY(7.5)}" text-anchor="middle">10° 單坡玻璃屋頂</text>
    <text class="elevation-label" x="${planX(1.2)}" y="${planY(5.8)}">LOW 6.000</text>
    <text class="elevation-label" x="${planX(20.4)}" y="${planY(5.8)}">HIGH 10.231</text>
    <text class="room-label" x="${planX(29.5)}" y="${planY(6.75)}" text-anchor="middle">服務核心非玻璃屋頂</text>
    ${badge('RF-GL-01', planX(12), planY(4.2), 'roof')}
    ${badge('CORE-01', planX(29.5), planY(5.3), 'core')}
    ${dimH(PLAN.x, planX(24), 548, '玻璃屋頂範圍 24.0')}
    ${dimH(planX(24), planX(35), 548, '服務核心 11.0')}
    ${northArrow(1110, 115)}`;
  return { id: 'REF-301', markup: sheetSvg(model, 'REF-301', '屋頂參照圖', content), note: '玻璃屋頂只覆蓋泳池大廳；服務核心端為高側 10.231 m，泳池遠端為低側 6.000 m，坡度 10°。' };
}

function renderSection(model: ProjectModel): SheetRender {
  const groundY = 530;
  const sx = (x: number) => 105 + x * 27;
  const sz = (z: number) => groundY - z * 36;
  const roof = model.geometry.roof;
  const stair = model.geometry.stair;
  const stairStart = 20.4;
  const flightRun = stair.risersPerRun * stair.treadDepth;
  const midStart = stairStart + flightRun;
  const secondStart = midStart + stair.midLandingLength;
  const stairEnd = secondStart + flightRun;
  const steps = Array.from({ length: stair.riserCount }, (_, index) => {
    const runIndex = index < stair.risersPerRun ? index : index - stair.risersPerRun;
    const baseX = index < stair.risersPerRun ? stairStart : secondStart;
    const baseZ = index < stair.risersPerRun ? 0 : stair.totalRise / 2;
    const x = sx(baseX + runIndex * stair.treadDepth);
    const z = sz(baseZ + (runIndex + 1) * stair.totalRise / stair.riserCount);
    return `<path class="section-step" d="M${x} ${z}h${stair.treadDepth * 27}v${stair.totalRise / stair.riserCount * 36}"/>`;
  }).join('');
  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    <line class="ground-line" x1="62" y1="${groundY}" x2="1138" y2="${groundY}"/>
    <rect class="pool-section" x="${sx(1.75)}" y="${groundY}" width="${20.5 * 27}" height="${1.5 * 36}" data-entity="POOL-01"/>
    <line class="level-line" x1="${sx(19)}" y1="${sz(3.6)}" x2="${sx(35)}" y2="${sz(3.6)}"/>
    <rect class="service-section" x="${sx(24)}" y="${sz(6)}" width="${11 * 27}" height="${6 * 36}" data-entity="CORE-01"/>
    <polygon class="glass-roof-section" points="${sx(0)},${sz(roof.lowElevation.value)} ${sx(24)},${sz(roof.highElevation.value)} ${sx(24)},${sz(roof.highElevation.value - .18)} ${sx(0)},${sz(roof.lowElevation.value - .18)}" data-entity="RF-GL-01"/>
    <line class="glass-wall" x1="${sx(0)}" y1="${groundY}" x2="${sx(0)}" y2="${sz(6)}"/>
    ${steps}
    <line class="stringer" x1="${sx(stairStart)}" y1="${sz(.08)}" x2="${sx(midStart)}" y2="${sz(1.88)}"/>
    <line class="stringer" x1="${sx(secondStart)}" y1="${sz(1.88)}" x2="${sx(stairEnd)}" y2="${sz(3.68)}"/>
    <rect class="floating-landing" x="${sx(midStart)}" y="${sz(1.88)}" width="${stair.midLandingLength * 27}" height="8"/>
    <path class="open-under-stair" d="M${sx(stairStart)} ${groundY - 3}L${sx(stairEnd)} ${sz(3.6) + 3}"/>
    <text class="void-label" x="${sx(26)}" y="${sz(1.1)}">梯下完全開放</text>
    <text class="elevation-label" x="${sx(1)}" y="${sz(6) - 12}">LOW 6.000</text>
    <text class="elevation-label" x="${sx(20)}" y="${sz(9.65) - 12}">10°</text>
    ${badge('POOL-01', sx(10.5), groundY + 76, 'pool')}
    ${badge('ST-01', sx(28), sz(2.6), 'stair')}
    ${badge('RF-GL-01', sx(10), sz(8), 'roof')}
    ${dimH(sx(0), sx(24), 590, '泳池大廳 24.0')}
    ${dimH(sx(24), sx(35), 590, '服務核心 11.0')}
    ${dimV(1090, sz(3.6), groundY, 'L2 +3.600')}`;
  return { id: 'REF-401', markup: sheetSvg(model, 'REF-401', 'A–A 縱剖面參照圖', content), note: 'ST-01 為兩段同向、懸浮中間平台、雙側厚鋼梯梁；梯下保持開放，結構不懸掛於玻璃屋頂。' };
}

function renderIsometric(model: ProjectModel): SheetRender {
  const b = model.geometry.building;
  const p = model.geometry.pool;
  const roof = model.geometry.roof;
  const p000 = isoPoint(0, 0, 0), p100 = isoPoint(b.length.value, 0, 0), p110 = isoPoint(b.length.value, b.width.value, 0), p010 = isoPoint(0, b.width.value, 0);
  const coreA = isoPoint(24, 0, 0), coreB = isoPoint(35, 0, 0), coreC = isoPoint(35, 13.5, 0), coreD = isoPoint(24, 13.5, 0);
  const coreAT = isoPoint(24, 0, 6), coreBT = isoPoint(35, 0, 6), coreCT = isoPoint(35, 13.5, 6), coreDT = isoPoint(24, 13.5, 6);
  const r1 = isoPoint(0, 0, roof.lowElevation.value), r2 = isoPoint(24, 0, roof.highElevation.value), r3 = isoPoint(24, 13.5, roof.highElevation.value), r4 = isoPoint(0, 13.5, roof.lowElevation.value);
  const poolPts = [isoPoint(p.origin[0], p.origin[1], .05), isoPoint(p.origin[0] + p.length.value, p.origin[1], .05), isoPoint(p.origin[0] + p.length.value, p.origin[1] + p.width.value, .05), isoPoint(p.origin[0], p.origin[1] + p.width.value, .05)];
  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    <g class="iso-model" transform="translate(35 -6)">
      <polygon class="iso-ground" points="${points([p000, p100, p110, p010])}"/>
      <polygon class="iso-pool" points="${points(poolPts)}" data-entity="POOL-01"/>
      ${[1, 2].map((lane) => {
        const y = p.origin[1] + p.width.value * lane / 3;
        const a = isoPoint(p.origin[0], y, .07), z = isoPoint(p.origin[0] + p.length.value, y, .07);
        return `<line class="iso-lane" x1="${a[0]}" y1="${a[1]}" x2="${z[0]}" y2="${z[1]}"/>`;
      }).join('')}
      <polygon class="iso-core-front" points="${points([coreA, coreB, coreBT, coreAT])}" data-entity="CORE-01"/>
      <polygon class="iso-core-side" points="${points([coreB, coreC, coreCT, coreBT])}"/>
      <polygon class="iso-core-roof" points="${points([coreAT, coreBT, coreCT, coreDT])}"/>
      <polygon class="iso-glass-roof" points="${points([r1, r2, r3, r4])}" data-entity="RF-GL-01"/>
      <line class="iso-glass-edge" x1="${r1[0]}" y1="${r1[1]}" x2="${r2[0]}" y2="${r2[1]}"/>
      <line class="iso-glass-edge" x1="${r4[0]}" y1="${r4[1]}" x2="${r3[0]}" y2="${r3[1]}"/>
      <polygon class="iso-glass-wall" points="${points([p000, coreA, coreAT, r1])}"/>
      <g class="iso-stair" data-entity="ST-01">
        <line x1="${isoPoint(20.4, .5, 0)[0]}" y1="${isoPoint(20.4, .5, 0)[1]}" x2="${isoPoint(26.5, .5, 1.8)[0]}" y2="${isoPoint(26.5, .5, 1.8)[1]}"/>
        <line x1="${isoPoint(28.3, .5, 1.8)[0]}" y1="${isoPoint(28.3, .5, 1.8)[1]}" x2="${isoPoint(34.4, .5, 3.6)[0]}" y2="${isoPoint(34.4, .5, 3.6)[1]}"/>
        <line x1="${isoPoint(20.4, 2.3, 0)[0]}" y1="${isoPoint(20.4, 2.3, 0)[1]}" x2="${isoPoint(26.5, 2.3, 1.8)[0]}" y2="${isoPoint(26.5, 2.3, 1.8)[1]}"/>
        <line x1="${isoPoint(28.3, 2.3, 1.8)[0]}" y1="${isoPoint(28.3, 2.3, 1.8)[1]}" x2="${isoPoint(34.4, 2.3, 3.6)[0]}" y2="${isoPoint(34.4, 2.3, 3.6)[1]}"/>
      </g>
    </g>
    ${badge('POOL-01', 485, 516, 'pool')}
    ${badge('ST-01', 840, 427, 'stair')}
    ${badge('CORE-01', 960, 310, 'core')}
    ${badge('RF-GL-01', 540, 206, 'roof')}
    ${northArrow(1100, 105)}
    <g class="coordinate-triad" transform="translate(100 540)">
      <circle r="4"/><path d="M0 0h62m0 0l-10-6m10 6l-10 6"/><path d="M0 0l-35-22m0 0l5 11m-5-11l12 1"/><path d="M0 0v-62m0 0l-6 10m6-10l6 10"/>
      <text x="72" y="5">+X 東</text><text x="-74" y="-24">+Y 北</text><text x="8" y="-65">+Z 上</text>
    </g>`;
  return { id: 'REF-501', markup: sheetSvg(model, 'REF-501', '3D 軸測參照圖', content), note: '此軸測圖與平面、屋頂、剖面共用同一 project-model.json；點選編號可核對來源、狀態與格網。' };
}

export function renderSheets(model: ProjectModel): SheetRender[] {
  return [renderSite(model), renderL1(model), renderL2(model), renderRoof(model), renderSection(model), renderIsometric(model)];
}
