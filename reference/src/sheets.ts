import type { ProjectModel, SheetRender } from './types';
import { deriveReferenceGeometry } from '../../scripts/reference-geometry.mjs';
import {
  PLAN, badge, boundsRect, cubicleMarkup, dimH, dimV, grid, isoPoint, northArrow,
  planX, planY, points, px, sheetSvg,
} from './geometry';

const siteImage = new URL('../../source-materials/site/SRC-SITE-002_entrance-location-annotated.png', import.meta.url).href;
const metreLabel = (value: number) => value.toFixed(1);

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
      <g transform="translate(880 300) rotate(${bearing - 90}) translate(-180 -69.5)">
        <rect class="site-pool" x="0" y="0" width="360" height="139" rx="6" data-entity="BLDG-01"/>
        <rect class="site-core" x="247" y="0" width="113" height="139" rx="3" data-entity="CORE-01"/>
        <circle class="entrance-marker" cx="260" cy="139" r="10" data-entity="EN-01"/>
        <path class="axis-arrow" d="M72 69H300m0 0l-18-11m18 11l-18 11"/>
      </g>
      ${badge('BLDG-01', 755, 374)}
      ${badge('CORE-01', 1000, 310, 'core')}
      ${badge('EN-01', 895, 454, 'entry')}
      ${badge('O-SITE-01', 1005, 454)}
      <g class="coordinate-card" transform="translate(610 496)">
        <rect width="520" height="112" rx="8"/>
        <text x="24" y="30" class="label">本地 +X 有向方位</text><text x="496" y="30" text-anchor="end" class="value">${bearing}°</text>
        <text x="24" y="62" class="label">配置關係</text><text x="496" y="62" text-anchor="end" class="value">泳池遠端 → CORE-01／EN-01</text>
        <text x="24" y="94" class="label">世界座標</text><text x="496" y="94" text-anchor="end" class="value">+X 東 · +Y 北 · +Z 上</text>
      </g>
    </g>`;
  return {
    id: 'REF-001',
    markup: sheetSvg(model, 'REF-001', '基地與方位圖', content),
    note: `本地 +X 採 ${bearing}° 單一 transform；CORE-01 對準原廁所基地，EN-01 對應衛星圖紅箭頭。`,
  };
}

function buildingPlanBase(model: ProjectModel): string {
  const length = px(model.geometry.building.length.value);
  const width = px(model.geometry.building.width.value);
  return `<rect class="building-outline" x="${PLAN.x}" y="${PLAN.y}" width="${length}" height="${width}" data-entity="BLDG-01"/>
    <line class="major-wall" x1="${planX(model.geometry.building.poolHallLength.value)}" y1="${PLAN.y}" x2="${planX(model.geometry.building.poolHallLength.value)}" y2="${PLAN.y + width}"/>`;
}

function renderL1(model: ProjectModel): SheetRender {
  const derived = deriveReferenceGeometry(model);
  const building = model.geometry.building;
  const pool = model.geometry.pool;
  const width = px(building.width.value);
  const poolX = planX(pool.origin[0]);
  const poolY = planY(pool.origin[1] + pool.width.value, building.width.value);
  const male = boundsRect(derived.maleL1Bounds, building.width.value);
  const female = boundsRect(derived.femaleL1Bounds, building.width.value);
  const forecourt = boundsRect(derived.diagrammaticL1.outdoorForecourtBounds, building.width.value);
  const dryPassage = boundsRect(derived.diagrammaticL1.dryPassageBounds, building.width.value);
  const entranceX = planX(model.referenceSystem.worldTransform.localOrigin[0]);
  const {
    arrivalPath, poolHallOpening, maleFrontDoor, maleRearDoor, femaleFrontDoor, femaleRearDoor,
  } = derived.diagrammaticL1;
  const arrivalBypass = boundsRect(arrivalPath.thresholdBypassBounds, building.width.value);
  const arrivalClearRun = boundsRect(arrivalPath.clearRunBounds, building.width.value);
  const arrivalRoutePath = arrivalPath.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${planX(point.x)} ${planY(point.y)}`)
    .join(' ');
  const stairY1 = model.geometry.stair.originY;
  const stairY2 = stairY1 + model.geometry.stair.width;
  const frontDoorY = planY(maleFrontDoor.y, building.width.value);
  const rearDoorY = planY(maleRearDoor.y, building.width.value);
  const openingHalf = 15;

  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    ${grid(model)}
    ${buildingPlanBase(model)}
    <rect class="pool-water" x="${poolX}" y="${poolY}" width="${px(pool.length.value)}" height="${px(pool.width.value)}" data-entity="POOL-01"/>
    ${[1, 2].map((lane) => `<line class="lane-line" x1="${poolX}" y1="${poolY + px(pool.width.value) * lane / 3}" x2="${poolX + px(pool.length.value)}" y2="${poolY + px(pool.width.value) * lane / 3}"/>`).join('')}
    <text class="zone-label" x="${planX(12)}" y="${planY(6.75)}" text-anchor="middle">泳池大廳 · Z-PH-01</text>
    <rect class="service-zone male" x="${male.x}" y="${male.y}" width="${male.width}" height="${male.height}" data-entity="Z-WC-M-01"/>
    <rect class="service-zone female" x="${female.x}" y="${female.y}" width="${female.width}" height="${female.height}" data-entity="Z-WC-F-01"/>
    <line class="privacy-wall" x1="${planX(derived.l1SplitAxisX)}" y1="${dryPassage.y + dryPassage.height}" x2="${planX(derived.l1SplitAxisX)}" y2="${forecourt.y}"/>
    <text class="room-label" x="${planX((derived.maleL1Bounds.x1 + derived.maleL1Bounds.x2) / 2)}" y="${planY((derived.maleL1Bounds.y1 + derived.maleL1Bounds.y2) / 2)}" text-anchor="middle">男廁 · 左</text>
    <text class="room-label" x="${planX((derived.femaleL1Bounds.x1 + derived.femaleL1Bounds.x2) / 2)}" y="${planY((derived.femaleL1Bounds.y1 + derived.femaleL1Bounds.y2) / 2)}" text-anchor="middle">女廁 · 右</text>

    <g data-entity="PSG-L1-DRY-01" tabindex="0" role="button" aria-label="PSG-L1-DRY-01 泳池側連續乾式通道">
      <rect class="dry-passage" x="${dryPassage.x}" y="${dryPassage.y}" width="${dryPassage.width}" height="${dryPassage.height}"/>
      <path class="dry-route" d="M${planX(derived.diagrammaticL1.dryPassageBounds.x1 + .2)} ${planY((derived.diagrammaticL1.dryPassageBounds.y1 + derived.diagrammaticL1.dryPassageBounds.y2) / 2)}H${planX(derived.diagrammaticL1.dryPassageBounds.x2 - .2)}"/>
      <text class="access-note" x="${dryPassage.x + dryPassage.width / 2}" y="${dryPassage.y + 14}" text-anchor="middle">泳池側乾式通道 · 後門時段管制</text>
    </g>

    <g data-entity="Z-L1-ENTRY-01" tabindex="0" role="button" aria-label="Z-L1-ENTRY-01 操場側戶外前場">
      <rect class="outdoor-hit" x="${forecourt.x}" y="${forecourt.y}" width="${forecourt.width}" height="${forecourt.height}"/>
      <path class="outdoor-edge-clear" d="M${forecourt.x} ${forecourt.y + forecourt.height}H${forecourt.x + forecourt.width} M${forecourt.x + forecourt.width} ${forecourt.y}V${forecourt.y + forecourt.height}"/>
      <path class="outdoor-forecourt-guide" d="M${forecourt.x + 8} ${forecourt.y + 8}H${forecourt.x + forecourt.width - 8} M${forecourt.x + 8} ${forecourt.y + 8}V${forecourt.y + forecourt.height - 8}"/>
      <text class="outdoor-label" x="${forecourt.x + forecourt.width * .66}" y="${forecourt.y + forecourt.height * .62}" text-anchor="middle">戶外前場</text>
      <text class="outdoor-label small" x="${forecourt.x + forecourt.width * .66}" y="${forecourt.y + forecourt.height * .62 + 18}" text-anchor="middle">開放空間 · 範圍示意／尺寸待 OPEN-008</text>
    </g>
    <path class="entrance" d="M${entranceX - 17} ${PLAN.y + width}h34" data-entity="EN-01"/>
    <path class="entry-arrow" d="M${entranceX} ${PLAN.y + width + 58}v-45m0 0l-9 14m9-14l9 14"/>

    <g class="door-group outdoor-opening pool-hall-opening" data-access="daily-open" data-entity="OP-L1-PH-01" tabindex="0" role="button" aria-label="OP-L1-PH-01 泳池大廳戶外入口">
      <path class="door-opening" d="M${planX(poolHallOpening.x)} ${planY(poolHallOpening.y) - openingHalf}v${openingHalf * 2}"/>
      <path class="door-leaf" d="M${planX(poolHallOpening.x)} ${planY(poolHallOpening.y) - openingHalf}l-${openingHalf + 7} ${openingHalf + 7}"/>
      <text class="opening-label" x="${planX(poolHallOpening.x) + 10}" y="${planY(poolHallOpening.y) - 20}">泳池入口</text>
    </g>

    <g class="door-group front-door" data-access="daily-open">
      <g data-entity="DR-L1-WC-M-FRONT-01" tabindex="0" role="button" aria-label="DR-L1-WC-M-FRONT-01 男廁戶外前門">
        <path class="door-opening" d="M${planX(maleFrontDoor.x) - openingHalf} ${frontDoorY}h${openingHalf * 2}"/>
        <path class="door-leaf" d="M${planX(maleFrontDoor.x) - openingHalf} ${frontDoorY}l${openingHalf + 8}-${openingHalf + 8}"/>
        <text class="opening-label" x="${planX(maleFrontDoor.x)}" y="${frontDoorY + 21}" text-anchor="middle">男廁入口</text>
      </g>
      <g data-entity="DR-L1-WC-F-FRONT-01" tabindex="0" role="button" aria-label="DR-L1-WC-F-FRONT-01 女廁戶外前門">
        <path class="door-opening" d="M${planX(femaleFrontDoor.x) - openingHalf} ${frontDoorY}h${openingHalf * 2}"/>
        <path class="door-leaf" d="M${planX(femaleFrontDoor.x) + openingHalf} ${frontDoorY}l-${openingHalf + 8}-${openingHalf + 8}"/>
        <text class="opening-label" x="${planX(femaleFrontDoor.x)}" y="${frontDoorY + 21}" text-anchor="middle">女廁入口</text>
      </g>
    </g>
    <path class="privacy-screen" d="M${planX(maleFrontDoor.x + .78)} ${planY(maleFrontDoor.y + .18)}v-${px(1.05)}"/>
    <path class="privacy-screen" d="M${planX(femaleFrontDoor.x - .78)} ${planY(femaleFrontDoor.y + .18)}v-${px(1.05)}"/>

    <g class="door-group rear-door" data-access="pool-hours-only">
      <g data-entity="DR-L1-WC-M-REAR-01" tabindex="0" role="button" aria-label="DR-L1-WC-M-REAR-01 男廁泳池側管制後門">
        <path class="door-opening" d="M${planX(maleRearDoor.x) - openingHalf} ${rearDoorY}h${openingHalf * 2}"/>
        <path class="door-leaf" d="M${planX(maleRearDoor.x) - openingHalf} ${rearDoorY}l${openingHalf + 8} ${openingHalf + 8}"/>
      </g>
      <g data-entity="DR-L1-WC-F-REAR-01" tabindex="0" role="button" aria-label="DR-L1-WC-F-REAR-01 女廁泳池側管制後門">
        <path class="door-opening" d="M${planX(femaleRearDoor.x) - openingHalf} ${rearDoorY}h${openingHalf * 2}"/>
        <path class="door-leaf" d="M${planX(femaleRearDoor.x) + openingHalf} ${rearDoorY}l-${openingHalf + 8} ${openingHalf + 8}"/>
      </g>
    </g>

    <rect class="stair-gallery" x="${planX(derived.stairStartX)}" y="${planY(stairY2)}" width="${px(derived.stairTotalRun)}" height="${px(model.geometry.stair.width)}" data-entity="Z-ST-01"/>
    ${Array.from({ length: model.geometry.stair.riserCount }, (_, index) => `<line class="stair-tread" x1="${planX(derived.stairStartX + .18 + index * (derived.stairTotalRun - .36) / (model.geometry.stair.riserCount - 1))}" y1="${planY(stairY2 - .12)}" x2="${planX(derived.stairStartX + .18 + index * (derived.stairTotalRun - .36) / (model.geometry.stair.riserCount - 1))}" y2="${planY(stairY1 + .12)}"/>`).join('')}
    <g data-entity="RTE-L1-ARRIVAL-01" tabindex="0" role="button" aria-label="RTE-L1-ARRIVAL-01 EN-01 至戶外前場正淨空到達路徑">
      <rect class="clear-route-area" x="${arrivalBypass.x}" y="${arrivalBypass.y}" width="${arrivalBypass.width}" height="${arrivalBypass.height}"/>
      <rect class="clear-route-area" x="${arrivalClearRun.x}" y="${arrivalClearRun.y}" width="${arrivalClearRun.width}" height="${arrivalClearRun.height}"/>
      <path class="clear-route" d="${arrivalRoutePath}"/>
    </g>
    ${badge('POOL-01', planX(11.9), planY(5.5), 'pool')}
    ${badge('ST-01', planX((derived.stairStartX + derived.stairEndX) / 2), planY(stairY1 + .9), 'stair')}
    ${badge('EN-01', entranceX, PLAN.y + width + 70, 'entry')}
    ${badge('Z-WC-M-01', planX((derived.maleL1Bounds.x1 + derived.maleL1Bounds.x2) / 2), planY(10.2), 'male')}
    ${badge('Z-WC-F-01', planX((derived.femaleL1Bounds.x1 + derived.femaleL1Bounds.x2) / 2), planY(10.2), 'female')}
    ${dimH(PLAN.x, planX(building.poolHallLength.value), 548, metreLabel(building.poolHallLength.value))}
    ${dimH(planX(building.poolHallLength.value), planX(building.length.value), 548, metreLabel(building.serviceCoreLength.value))}
    ${dimH(PLAN.x, planX(building.length.value), 590, metreLabel(building.length.value))}
    ${dimV(1050, PLAN.y, PLAN.y + width, metreLabel(building.width.value))}
    ${northArrow(1110, 115)}`;
  return {
    id: 'REF-101',
    markup: sheetSvg(model, 'REF-101', 'L1 平面參照圖', content),
    note: '操場側為戶外前場；泳池大廳、男廁、女廁各有獨立戶外開口。兩廁前後門錯位，泳池側後門經連續乾式通道通達並採時段管制；ST-01 不阻擋動線。',
  };
}

function renderL2(model: ProjectModel): SheetRender {
  const derived = deriveReferenceGeometry(model);
  const building = model.geometry.building;
  const male = boundsRect(derived.maleL2Bounds, building.width.value);
  const female = boundsRect(derived.femaleL2Bounds, building.width.value);
  const lobbyWidth = 1.8;
  const lobbyX = planX(derived.l2SplitAxisX - lobbyWidth / 2);
  const lobbyY = planY(2.45, building.width.value);
  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    ${grid(model)}
    <rect class="building-outline ghost" x="${PLAN.x}" y="${PLAN.y}" width="${px(building.length.value)}" height="${px(building.width.value)}" data-entity="BLDG-01"/>
    <rect class="pool-hall-void" x="${PLAN.x}" y="${PLAN.y}" width="${px(derived.l2StartX)}" height="${px(building.width.value)}" data-entity="Z-PH-01"/>
    <text class="void-label" x="${planX(derived.l2StartX / 2)}" y="${planY(6.75)}" text-anchor="middle">泳池大廳挑空</text>
    <rect class="l2-extension" x="${planX(derived.l2StartX)}" y="${PLAN.y}" width="${px(building.l2ExtensionLength.value)}" height="${px(building.width.value)}" data-entity="EXT-L2-01"/>
    <rect class="service-zone male" x="${male.x}" y="${male.y}" width="${male.width}" height="${male.height}" data-entity="Z-CS-M-01"/>
    <rect class="service-zone female" x="${female.x}" y="${female.y}" width="${female.width}" height="${female.height}" data-entity="Z-CS-F-01"/>
    <line class="extension-boundary-plan" x1="${planX(building.poolHallLength.value)}" y1="${PLAN.y}" x2="${planX(building.poolHallLength.value)}" y2="${PLAN.y + px(building.width.value)}"/>
    <line class="privacy-wall" x1="${planX(derived.l2SplitAxisX)}" y1="${PLAN.y}" x2="${planX(derived.l2SplitAxisX)}" y2="${PLAN.y + px(building.width.value)}"/>
    ${cubicleMarkup(model.program.l2.male.activeIds, model.program.l2.male.expansionIds, 'M', derived.maleL2Bounds, model)}
    ${cubicleMarkup(model.program.l2.female.activeIds, model.program.l2.female.expansionIds, 'F', derived.femaleL2Bounds, model)}
    <rect class="distribution-lobby" x="${lobbyX}" y="${lobbyY}" width="${px(lobbyWidth)}" height="${px(2.45)}" data-entity="Z-L2-LOBBY-01"/>
    <path class="privacy-screen" d="M${planX(derived.l2SplitAxisX - 1.15)} ${planY(2.75)}v-${px(1.05)}"/>
    <path class="privacy-screen" d="M${planX(derived.l2SplitAxisX + 1.15)} ${planY(1.7)}v-${px(1.05)}"/>
    <path class="split-arrow" d="M${planX(derived.l2SplitAxisX)} ${planY(.7)}h-${px(2.3)}m${px(2.3)} 0h${px(2.3)}"/>
    <text class="room-label" x="${planX((derived.maleL2Bounds.x1 + derived.maleL2Bounds.x2) / 2)}" y="${planY(12.85)}" text-anchor="middle">男生區 · 左 · 15＋5</text>
    <text class="room-label" x="${planX((derived.femaleL2Bounds.x1 + derived.femaleL2Bounds.x2) / 2)}" y="${planY(12.85)}" text-anchor="middle">女生區 · 右 · 15＋5</text>
    <text class="extension-label" x="${planX((derived.l2StartX + building.poolHallLength.value) / 2)}" y="${planY(6.75)}" text-anchor="middle" transform="rotate(-90 ${planX((derived.l2StartX + building.poolHallLength.value) / 2)} ${planY(6.75)})">EXT-L2-01 · L1 下方開放</text>
    ${badge('Z-CS-M-01', planX((derived.maleL2Bounds.x1 + derived.maleL2Bounds.x2) / 2), planY(.45), 'male')}
    ${badge('Z-CS-F-01', planX((derived.femaleL2Bounds.x1 + derived.femaleL2Bounds.x2) / 2), planY(.45), 'female')}
    ${badge('ST-01', planX(derived.stairEndX), planY(1.25), 'stair')}
    <g class="legend" transform="translate(126 528)">
      <rect width="650" height="74" rx="8"/>
      <rect class="sample active" x="20" y="18" width="32" height="32"/><text x="64" y="39">正式 15 間／性別</text>
      <rect class="sample expansion" x="246" y="18" width="32" height="32"/><text x="290" y="39">擴充 5 間／性別</text>
      <rect class="sample cabinet" x="482" y="18" width="12" height="22"/><text x="508" y="39">每間壁掛櫃</text>
    </g>
    ${dimH(planX(derived.l2StartX), planX(building.poolHallLength.value), 548, `擴建 ${metreLabel(building.l2ExtensionLength.value)}`)}
    ${dimH(planX(building.poolHallLength.value), planX(building.length.value), 548, `原核心 ${metreLabel(building.serviceCoreLength.value)}`)}
    ${dimH(planX(derived.l2StartX), planX(derived.l2EndX), 590, `L2 ${metreLabel(derived.l2Length)}`)}
    ${northArrow(1110, 115)}`;
  return {
    id: 'REF-201',
    markup: sheetSvg(model, 'REF-201', 'L2 平面參照圖', content),
    note: 'L2 由 EXT-L2-01 與原核心上方整合；ST-01 在中央分流，男左女右、入口錯位，各保留 15＋5 單元。',
  };
}

function renderRoof(model: ProjectModel): SheetRender {
  const derived = deriveReferenceGeometry(model);
  const building = model.geometry.building;
  const width = px(building.width.value);
  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    ${grid(model)}
    <rect class="building-outline" x="${PLAN.x}" y="${PLAN.y}" width="${px(building.length.value)}" height="${width}"/>
    <rect class="glass-roof" x="${planX(derived.roofPlanStartX)}" y="${PLAN.y}" width="${px(derived.roofPlanRun)}" height="${width}" data-entity="RF-GL-01"/>
    ${Array.from({ length: Math.ceil(derived.roofPlanRun / 3) + 1 }, (_, i) => {
      const x = Math.min(derived.roofPlanEndX, i * 3);
      return `<line class="roof-mullion" x1="${planX(x)}" y1="${PLAN.y}" x2="${planX(x)}" y2="${PLAN.y + width}"/>`;
    }).join('')}
    <rect class="l2-roof-extension" x="${planX(derived.l2StartX)}" y="${PLAN.y}" width="${px(building.l2ExtensionLength.value)}" height="${width}" data-entity="EXT-L2-01"/>
    <rect class="l2-roof-core" x="${planX(building.poolHallLength.value)}" y="${PLAN.y}" width="${px(building.serviceCoreLength.value)}" height="${width}" data-entity="CORE-01"/>
    <line class="deferred-joint" x1="${planX(derived.roofPlanEndX)}" y1="${PLAN.y}" x2="${planX(derived.roofPlanEndX)}" y2="${PLAN.y + width}" data-entity="J-RF-L2-01"/>
    <path class="slope-arrow" d="M${planX(derived.roofPlanEndX - 1.2)} ${planY(6.75)}H${planX(2)}m0 0l18-11m-18 11l18 11"/>
    <text class="zone-label" x="${planX(derived.roofPlanRun / 2)}" y="${planY(7.5)}" text-anchor="middle">10° 向左下 · RF-GL-01</text>
    <text class="deferred-label" x="${planX(derived.roofPlanEndX)}" y="${planY(5.7)}" text-anchor="middle">J-RF-L2-01</text>
    <text class="deferred-label small" x="${planX(derived.roofPlanEndX)}" y="${planY(4.9)}" text-anchor="middle">標高／交界待 OPEN-010</text>
    <text class="room-label" x="${planX((derived.l2StartX + derived.l2EndX) / 2)}" y="${planY(6.75)}" text-anchor="middle">L2 擴建＋原核心上方</text>
    ${badge('RF-GL-01', planX(derived.roofPlanRun / 2), planY(4.2), 'roof')}
    ${badge('EXT-L2-01', planX((derived.l2StartX + building.poolHallLength.value) / 2), planY(8.5), 'extension')}
    ${badge('J-RF-L2-01', planX(derived.roofPlanEndX), planY(2.0), 'deferred')}
    ${dimH(planX(derived.roofPlanStartX), planX(derived.roofPlanEndX), 548, `玻璃屋頂平面 ${metreLabel(derived.roofPlanRun)}`)}
    ${dimH(planX(derived.l2StartX), planX(derived.l2EndX), 590, `L2 ${metreLabel(derived.l2Length)}`)}
    ${northArrow(1110, 115)}`;
  return {
    id: 'REF-301',
    markup: sheetSvg(model, 'REF-301', '屋頂參照圖', content),
    note: '玻璃屋頂平面終止於 L2 擴建邊緣，坡度 10° 向泳池遠端左下；最終標高與交界構造待 OPEN-010。',
  };
}

function renderSection(model: ProjectModel): SheetRender {
  const derived = deriveReferenceGeometry(model);
  const groundY = 530;
  const sx = (x: number) => 105 + x * 27;
  const sz = (z: number) => groundY - z * 36;
  const stair = model.geometry.stair;
  const midStart = derived.stairStartX + derived.flightRun;
  const secondStart = midStart + stair.midLandingLength;
  const steps = Array.from({ length: stair.riserCount }, (_, index) => {
    const runIndex = index < stair.risersPerRun ? index : index - stair.risersPerRun;
    const baseX = index < stair.risersPerRun ? derived.stairStartX : secondStart;
    const baseZ = index < stair.risersPerRun ? 0 : stair.totalRise / 2;
    const x = sx(baseX + runIndex * stair.treadDepth);
    const z = sz(baseZ + (runIndex + 1) * stair.totalRise / stair.riserCount);
    return `<path class="section-step" d="M${x} ${z}h${stair.treadDepth * 27}v${stair.totalRise / stair.riserCount * 36}"/>`;
  }).join('');
  const roofLowY = 345;
  const roofHighY = roofLowY - derived.roofPlanRun * 27 * Math.tan(model.geometry.roof.pitch.value * Math.PI / 180);
  const volumeTopY = Math.min(roofHighY - 8, 236);
  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    <line class="ground-line" x1="62" y1="${groundY}" x2="1138" y2="${groundY}"/>
    <rect class="pool-section" x="${sx(model.geometry.pool.origin[0])}" y="${groundY}" width="${model.geometry.pool.length.value * 27}" height="${model.geometry.pool.deepDepth.value * 36}" data-entity="POOL-01"/>
    <line class="level-line" x1="${sx(derived.l2StartX)}" y1="${sz(stair.totalRise)}" x2="${sx(derived.l2EndX)}" y2="${sz(stair.totalRise)}"/>
    <rect class="service-section l1-core" x="${sx(derived.l1ServiceStartX)}" y="${sz(stair.totalRise)}" width="${model.geometry.building.serviceCoreLength.value * 27}" height="${stair.totalRise * 36}" data-entity="CORE-01"/>
    <rect class="l2-section-volume" x="${sx(derived.l2StartX)}" y="${volumeTopY}" width="${derived.l2Length * 27}" height="${sz(stair.totalRise) - volumeTopY}" data-entity="EXT-L2-01"/>
    <line class="extension-boundary-plan" x1="${sx(derived.l1ServiceStartX)}" y1="${volumeTopY}" x2="${sx(derived.l1ServiceStartX)}" y2="${sz(stair.totalRise)}"/>
    <rect class="open-below-extension" x="${sx(derived.l2StartX)}" y="${sz(stair.totalRise)}" width="${model.geometry.building.l2ExtensionLength.value * 27}" height="${groundY - sz(stair.totalRise)}"/>
    <text class="void-label" x="${sx((derived.l2StartX + derived.l1ServiceStartX) / 2)}" y="${sz(1.4)}" text-anchor="middle">L1 開放</text>
    <polygon class="glass-roof-section" points="${sx(derived.roofPlanStartX)},${roofLowY} ${sx(derived.roofPlanEndX)},${roofHighY} ${sx(derived.roofPlanEndX)},${roofHighY + 7} ${sx(derived.roofPlanStartX)},${roofLowY + 7}" data-entity="RF-GL-01"/>
    <line class="glass-wall" x1="${sx(0)}" y1="${groundY}" x2="${sx(0)}" y2="${roofLowY}"/>
    <line class="deferred-joint" x1="${sx(derived.roofPlanEndX)}" y1="${roofHighY - 12}" x2="${sx(derived.roofPlanEndX)}" y2="${volumeTopY + 22}" data-entity="J-RF-L2-01"/>
    <text class="deferred-label" x="${sx(derived.roofPlanEndX) + 12}" y="${roofHighY - 17}">J-RF-L2-01</text>
    <text class="deferred-label small" x="${sx(derived.roofPlanEndX) + 12}" y="${roofHighY + 2}">標高／構造待 OPEN-010</text>
    ${steps}
    <line class="stringer" x1="${sx(derived.stairStartX)}" y1="${sz(.08)}" x2="${sx(midStart)}" y2="${sz(1.88)}"/>
    <line class="stringer" x1="${sx(secondStart)}" y1="${sz(1.88)}" x2="${sx(derived.stairEndX)}" y2="${sz(3.68)}"/>
    <rect class="floating-landing" x="${sx(midStart)}" y="${sz(1.88)}" width="${stair.midLandingLength * 27}" height="8"/>
    <path class="open-under-stair" d="M${sx(derived.stairStartX)} ${groundY - 3}L${sx(derived.stairEndX)} ${sz(stair.totalRise) + 3}"/>
    <text class="void-label" x="${sx((derived.stairStartX + derived.stairEndX) / 2)}" y="${sz(1.05)}" text-anchor="middle">梯下完全開放</text>
    <text class="elevation-label" x="${sx(derived.roofPlanRun * .55)}" y="${roofLowY - 38}">10°</text>
    <text class="extension-label" x="${sx((derived.l2StartX + derived.l2EndX) / 2)}" y="${volumeTopY + 28}" text-anchor="middle">L2 紅框＋綠框整合量體</text>
    ${badge('POOL-01', sx(10.5), groundY + 76, 'pool')}
    ${badge('ST-01', sx(derived.stairEndX), sz(2.55), 'stair')}
    ${badge('EXT-L2-01', sx((derived.l2StartX + model.geometry.building.poolHallLength.value) / 2), volumeTopY + 52, 'extension')}
    ${badge('RF-GL-01', sx(derived.roofPlanRun * .48), roofLowY - 72, 'roof')}
    ${dimH(sx(derived.roofPlanStartX), sx(derived.roofPlanEndX), 590, `玻璃屋頂 ${metreLabel(derived.roofPlanRun)}`)}
    ${dimH(sx(derived.l2StartX), sx(derived.l2EndX), 620, `L2 ${metreLabel(derived.l2Length)}`)}
    ${dimV(1090, sz(stair.totalRise), groundY, 'L2 +3.600')}`;
  return {
    id: 'REF-401',
    markup: sheetSvg(model, 'REF-401', 'A–A 縱剖面參照圖', content),
    note: 'EXT-L2-01 只存在於二樓，其下 L1 開放；玻璃屋頂 10° 向左下，J-RF-L2-01 的標高與構造仍待第二階段。',
  };
}

function renderIsometric(model: ProjectModel): SheetRender {
  const derived = deriveReferenceGeometry(model);
  const b = model.geometry.building;
  const p = model.geometry.pool;
  const stair = model.geometry.stair;
  const displayRoofLow = 5.8;
  const displayRoofHigh = displayRoofLow + derived.roofPlanRun * Math.tan(model.geometry.roof.pitch.value * Math.PI / 180);
  const l2Base = model.geometry.stair.totalRise;
  const p000 = isoPoint(0, 0, 0);
  const p100 = isoPoint(b.length.value, 0, 0);
  const p110 = isoPoint(b.length.value, b.width.value, 0);
  const p010 = isoPoint(0, b.width.value, 0);
  const coreA = isoPoint(derived.l1ServiceStartX, 0, 0);
  const coreB = isoPoint(derived.l1ServiceEndX, 0, 0);
  const coreC = isoPoint(derived.l1ServiceEndX, b.width.value, 0);
  const coreD = isoPoint(derived.l1ServiceStartX, b.width.value, 0);
  const coreA2 = isoPoint(derived.l1ServiceStartX, 0, l2Base);
  const coreB2 = isoPoint(derived.l1ServiceEndX, 0, l2Base);
  const coreC2 = isoPoint(derived.l1ServiceEndX, b.width.value, l2Base);
  const coreD2 = isoPoint(derived.l1ServiceStartX, b.width.value, l2Base);
  const l2A = isoPoint(derived.l2StartX, 0, l2Base);
  const l2B = isoPoint(derived.l2EndX, 0, l2Base);
  const l2C = isoPoint(derived.l2EndX, b.width.value, l2Base);
  const l2D = isoPoint(derived.l2StartX, b.width.value, l2Base);
  const l2AT = isoPoint(derived.l2StartX, 0, displayRoofHigh);
  const l2BT = isoPoint(derived.l2EndX, 0, displayRoofHigh);
  const l2CT = isoPoint(derived.l2EndX, b.width.value, displayRoofHigh);
  const l2DT = isoPoint(derived.l2StartX, b.width.value, displayRoofHigh);
  const extensionBoundaryFront = isoPoint(derived.l1ServiceStartX, 0, displayRoofHigh);
  const extensionBoundaryBack = isoPoint(derived.l1ServiceStartX, b.width.value, displayRoofHigh);
  const r1 = isoPoint(derived.roofPlanStartX, 0, displayRoofLow);
  const r2 = isoPoint(derived.roofPlanEndX, 0, displayRoofHigh);
  const r3 = isoPoint(derived.roofPlanEndX, b.width.value, displayRoofHigh);
  const r4 = isoPoint(derived.roofPlanStartX, b.width.value, displayRoofLow);
  const poolPts = [
    isoPoint(p.origin[0], p.origin[1], .05),
    isoPoint(p.origin[0] + p.length.value, p.origin[1], .05),
    isoPoint(p.origin[0] + p.length.value, p.origin[1] + p.width.value, .05),
    isoPoint(p.origin[0], p.origin[1] + p.width.value, .05),
  ];
  const content = `
    <rect class="sheet-bg" width="1200" height="740"/>
    <g class="iso-model" transform="translate(35 -6)">
      <polygon class="iso-ground" points="${points([p000, p100, p110, p010])}"/>
      <polygon class="iso-pool" points="${points(poolPts)}" data-entity="POOL-01"/>
      ${[1, 2].map((lane) => {
        const y = p.origin[1] + p.width.value * lane / 3;
        const a = isoPoint(p.origin[0], y, .07);
        const z = isoPoint(p.origin[0] + p.length.value, y, .07);
        return `<line class="iso-lane" x1="${a[0]}" y1="${a[1]}" x2="${z[0]}" y2="${z[1]}"/>`;
      }).join('')}
      <polygon class="iso-core-front" points="${points([coreA, coreB, coreB2, coreA2])}" data-entity="CORE-01"/>
      <polygon class="iso-core-side" points="${points([coreB, coreC, coreC2, coreB2])}"/>
      <polygon class="iso-core-roof" points="${points([coreA2, coreB2, coreC2, coreD2])}"/>
      <polygon class="iso-l2-extension-front" points="${points([l2A, coreA2, extensionBoundaryFront, l2AT])}" data-entity="EXT-L2-01"/>
      <polygon class="iso-l2-extension-roof" points="${points([l2AT, extensionBoundaryFront, extensionBoundaryBack, l2DT])}"/>
      <polygon class="iso-l2-core-front" points="${points([coreA2, coreB2, l2BT, extensionBoundaryFront])}" data-entity="CORE-01"/>
      <polygon class="iso-l2-core-side" points="${points([coreB2, coreC2, l2CT, l2BT])}"/>
      <polygon class="iso-l2-core-roof" points="${points([extensionBoundaryFront, l2BT, l2CT, extensionBoundaryBack])}"/>
      <polygon class="iso-glass-roof" points="${points([r1, r2, r3, r4])}" data-entity="RF-GL-01"/>
      <line class="iso-glass-edge" x1="${r1[0]}" y1="${r1[1]}" x2="${r2[0]}" y2="${r2[1]}"/>
      <line class="iso-glass-edge" x1="${r4[0]}" y1="${r4[1]}" x2="${r3[0]}" y2="${r3[1]}"/>
      <line class="iso-deferred-joint" x1="${r2[0]}" y1="${r2[1]}" x2="${r3[0]}" y2="${r3[1]}" data-entity="J-RF-L2-01"/>
      <polygon class="iso-glass-wall" points="${points([p000, isoPoint(derived.roofPlanEndX, 0, 0), r2, r1])}"/>
      <g class="iso-stair" data-entity="ST-01">
        <line x1="${isoPoint(derived.stairStartX, stair.originY, 0)[0]}" y1="${isoPoint(derived.stairStartX, stair.originY, 0)[1]}" x2="${isoPoint(derived.stairStartX + derived.flightRun, stair.originY, 1.8)[0]}" y2="${isoPoint(derived.stairStartX + derived.flightRun, stair.originY, 1.8)[1]}"/>
        <line x1="${isoPoint(derived.stairEndX - derived.flightRun, stair.originY, 1.8)[0]}" y1="${isoPoint(derived.stairEndX - derived.flightRun, stair.originY, 1.8)[1]}" x2="${isoPoint(derived.stairEndX, stair.originY, 3.6)[0]}" y2="${isoPoint(derived.stairEndX, stair.originY, 3.6)[1]}"/>
        <line x1="${isoPoint(derived.stairStartX, stair.originY + stair.width, 0)[0]}" y1="${isoPoint(derived.stairStartX, stair.originY + stair.width, 0)[1]}" x2="${isoPoint(derived.stairStartX + derived.flightRun, stair.originY + stair.width, 1.8)[0]}" y2="${isoPoint(derived.stairStartX + derived.flightRun, stair.originY + stair.width, 1.8)[1]}"/>
        <line x1="${isoPoint(derived.stairEndX - derived.flightRun, stair.originY + stair.width, 1.8)[0]}" y1="${isoPoint(derived.stairEndX - derived.flightRun, stair.originY + stair.width, 1.8)[1]}" x2="${isoPoint(derived.stairEndX, stair.originY + stair.width, 3.6)[0]}" y2="${isoPoint(derived.stairEndX, stair.originY + stair.width, 3.6)[1]}"/>
      </g>
    </g>
    ${badge('POOL-01', 485, 516, 'pool')}
    ${badge('ST-01', 795, 432, 'stair')}
    ${badge('CORE-01', 995, 292, 'core')}
    ${badge('EXT-L2-01', 910, 284, 'extension')}
    ${badge('RF-GL-01', 520, 210, 'roof')}
    ${badge('J-RF-L2-01', 745, 238, 'deferred')}
    ${northArrow(1100, 105)}
    <g class="coordinate-triad" transform="translate(100 540)">
      <circle r="4"/><path d="M0 0h62m0 0l-10-6m10 6l-10 6"/><path d="M0 0l-35-22m0 0l5 11m-5-11l12 1"/><path d="M0 0v-62m0 0l-6 10m6-10l6 10"/>
      <text x="72" y="5">本地 +X</text><text x="-74" y="-24">本地 +Y</text><text x="8" y="-65">+Z 上</text>
    </g>`;
  return {
    id: 'REF-501',
    markup: sheetSvg(model, 'REF-501', '3D 軸測參照圖', content),
    note: '綠色 CORE-01、紅色 EXT-L2-01 與玻璃屋頂是獨立量體；紅色擴建下方 L1 開放，交界維持 deferred。',
  };
}

export function renderSheets(model: ProjectModel): SheetRender[] {
  return [renderSite(model), renderL1(model), renderL2(model), renderRoof(model), renderSection(model), renderIsometric(model)];
}
