import type { ProjectModel, SheetRender } from './types';

const siteImage = new URL('../../source-materials/site/SRC-SITE-001_google-maps-satellite.png', import.meta.url).href;
const l1Image = new URL('../drafts/v0.6.4/DRAW-L1-PLAN-v0.6.4.png', import.meta.url).href;
const l2Image = new URL('../drafts/v0.6.4/DRAW-L2-PLAN-v0.6.4.png', import.meta.url).href;
const l3Image = new URL('../drafts/v0.6.4/DRAW-L3-PLAN-v0.6.4.png', import.meta.url).href;
const sectionImage = new URL('../drafts/v0.6.4/DRAW-LONGITUDINAL-SECTION-v0.6.4.png', import.meta.url).href;

function reviewDrawing(id: string, title: string, imageUrl: string, note: string, model: ProjectModel): SheetRender {
  return {
    id,
    title,
    note,
    markup: `<svg class="review-drawing" viewBox="0 0 1920 1080" role="img" aria-labelledby="${id}-title ${id}-desc">
      <title id="${id}-title">${title}</title>
      <desc id="${id}-desc">${note}</desc>
      <image href="${imageUrl}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid meet" />
      <metadata data-model-version="${model.modelVersion}" data-active-geometry="${model.activeGeometryRevisionId}" data-coordinate-system="SITE-XY" />
    </svg>`,
  };
}

function siteDrawing(model: ProjectModel): SheetRender {
  const note = `基地現況來源圖；MODEL ${model.modelVersion} · ACTIVE ${model.activeGeometryRevisionId}。衛星影像不是地籍或測量成果。`;
  return {
    id: 'REF-001',
    title: '基地與方位圖',
    note,
    markup: `<svg viewBox="0 0 1200 760" role="img" aria-labelledby="site-title site-desc">
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
    reviewDrawing('V064-L1', 'v0.6.4｜1F 最新平面圖', l1Image, 'L1 Y0 外牆採自然灰清水模並保留 EN-01 玻璃入口；四廁與器具配置不變。非施工圖。', model),
    reviewDrawing('V064-L2', 'v0.6.4｜2F 最新平面圖', l2Image, 'L2 Y0 全寬玻璃；Y2.5 清水模牆由 X32 連續至 X41，不由樓梯區直通更衣室。非施工圖。', model),
    reviewDrawing('V064-L3', 'v0.6.4｜3F 最新平面圖', l3Image, '完整 3F 屋頂、鏡牆端部收邊與高覆蓋率太陽能排布；SITE-XY 格線保持可讀。非施工圖。', model),
    reviewDrawing('V064-SECTION', 'v0.6.4｜最新縱向剖面圖', sectionImage, 'X／Z 座標格線、完整 L2 天花、完整 L3 屋頂與高覆蓋率太陽能排布的概念關係。非施工圖。', model),
  ];
}
