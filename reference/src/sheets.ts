import type { ProjectModel, SheetRender } from './types';

const siteImage = new URL('../../source-materials/site/SRC-SITE-001_google-maps-satellite.png', import.meta.url).href;
import l1Svg from '../drafts/v0.6.5/DRAW-L1-PLAN-v0.6.5.svg?raw';
import l2Svg from '../drafts/v0.6.5/DRAW-L2-PLAN-v0.6.5.svg?raw';
import l3Svg from '../drafts/v0.6.5/DRAW-L3-PLAN-v0.6.5.svg?raw';
import sectionSvg from '../drafts/v0.6.5/DRAW-LONGITUDINAL-SECTION-v0.6.5.svg?raw';

function reviewDrawing(id: string, title: string, svgSource: string, note: string, model: ProjectModel): SheetRender {
  const inlineSvg = svgSource
    .replace('<svg ', `<svg class="drawing review-drawing" data-sheet-id="${id}" `)
    .replace('</svg>', `<metadata data-sheet-id="${id}" data-model-version="${model.modelVersion}" data-active-geometry="${model.activeGeometryRevisionId}" data-coordinate-system="SITE-XY" /></svg>`);
  return {
    id,
    title,
    note,
    markup: inlineSvg,
  };
}

function siteDrawing(model: ProjectModel): SheetRender {
  const note = `基地現況來源圖；MODEL ${model.modelVersion} · ACTIVE ${model.activeGeometryRevisionId}。衛星影像不是地籍或測量成果。`;
  return {
    id: 'REF-001',
    title: '基地與方位圖',
    note,
    markup: `<svg class="drawing" viewBox="0 0 1200 760" role="img" aria-labelledby="site-title site-desc">
      <title id="site-title">基地與方位圖</title>
      <desc id="site-desc">${note}</desc>
      <rect width="1200" height="760" fill="#edf1f2" />
      <image href="${siteImage}" x="44" y="42" width="850" height="672" preserveAspectRatio="xMidYMid slice" />
      <g transform="translate(936 92)" font-family="system-ui, sans-serif" fill="#263746">
        <text font-size="16" font-weight="700">MODEL ${model.modelVersion}</text>
        <text y="30" font-size="13">ACTIVE ${model.activeGeometryRevisionId}</text>
        <text y="56" font-size="13">SITE-XY · +X 方位 307°</text>
        <path d="M92 180L120 102L148 180L120 160Z" fill="#c4553f" />
        <text x="120" y="94" text-anchor="middle" font-size="14" font-weight="700">N</text>
        <text y="232" font-size="12">概念設計／非施工圖</text>
      </g>
    </svg>`,
  };
}

export function renderSheets(model: ProjectModel): SheetRender[] {
  return [
    siteDrawing(model),
    reviewDrawing('V065-L1', 'v0.6.5｜1F 最新平面圖', l1Svg, '泳池端玻璃、服務本體清水模、西端退縮／玻璃屋簷／雨水回收及後側突出玻璃屋簷。非施工圖。', model),
    reviewDrawing('V065-L2', 'v0.6.5｜2F 最新平面圖', l2Svg, 'L2 Y0 全寬玻璃；Y2.5 清水模牆由 X32 連續至 X41，不由樓梯區直通更衣室。非施工圖。', model),
    reviewDrawing('V065-L3', 'v0.6.5｜3F 最新平面圖', l3Svg, 'L3／屋頂／鏡牆／淡藍透明太陽能板共用同一 +25.5° transform；太陽能板可獨立顯示。非施工圖。', model),
    reviewDrawing('V065-SECTION', 'v0.6.5｜最新縱向剖面圖', sectionSvg, '補齊 X0.5、X29、X41 垂直牆、投影入口、玻璃屋簷與雨水回收關係。非施工圖。', model),
  ];
}
