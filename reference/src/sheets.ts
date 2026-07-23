import type { ProjectModel, SheetRender } from './types';

const siteImage = new URL('../../source-materials/site/SRC-SITE-001_google-maps-satellite.png', import.meta.url).href;
const l1Image = new URL('../drafts/v0.6.2/DRAW-L1-PLAN-v0.6.2.png', import.meta.url).href;
const l2Image = new URL('../drafts/v0.6.2/DRAW-L2-PLAN-v0.6.2.png', import.meta.url).href;
const l3Image = new URL('../drafts/v0.6.2/DRAW-L3-PLAN-v0.6.2.png', import.meta.url).href;
const sectionImage = new URL('../drafts/v0.6.2/DRAW-LONGITUDINAL-SECTION-v0.6.2.png', import.meta.url).href;

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
    reviewDrawing('V062-L1', 'v0.6.2｜1F 最新平面圖', l1Image, '四間廁所取消入口遮擋版、WC 貼 Y3.5，泳池男廁一座小便斗移至 X31。非施工圖。', model),
    reviewDrawing('V062-L2', 'v0.6.2｜2F 最新平面圖', l2Image, '可見 SITE-XY 格線、男女各 15 間 1 × 1 m 淋浴間，以及由 X32.5 朝 +X 的方案一 ST-02。非施工圖。', model),
    reviewDrawing('V062-L3', 'v0.6.2｜3F 最新平面圖', l3Image, '旋轉主體不變，新增固定正交三角擴板、有頂到達翼與教師／維修專用受控景觀區。非施工圖。', model),
    reviewDrawing('V062-SECTION', 'v0.6.2｜最新縱向剖面圖', sectionImage, '池畔、L2、L3、5°屋頂、ST-01 與方案一 ST-02 的概念標高關係。非施工圖。', model),
  ];
}
