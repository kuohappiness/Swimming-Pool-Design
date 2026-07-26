import rawContent from '../../../generated/concept-content.json';
import rawModel from '../../../../model/project-model.json';
import l3Drawing from '../../../drafts/v0.6.7/DRAW-L3-PLAN-v0.6.7.svg?raw';
import { resolveActiveGeometry } from '../../../../scripts/active-geometry.mjs';
import type { MountedView } from '../../app/view-contract';
import { getViewDefinition } from '../../app/router';
import type { ProjectModel } from '../../types';
import campus02Large from './assets/origin-campus-02-1920.jpg';
import campus02Small from './assets/origin-campus-02-960.jpg';
import campus05Large from './assets/origin-campus-05-1920.jpg';
import campus05Small from './assets/origin-campus-05-960.jpg';
import campus06Large from './assets/origin-campus-06-1920.jpg';
import campus06Small from './assets/origin-campus-06-960.jpg';
import early3dLarge from './assets/origin-early-3d-1920.jpg';
import early3dSmall from './assets/origin-early-3d-960.jpg';
import overheadPlanLarge from './assets/origin-overhead-plan-1920.jpg';
import overheadPlanSmall from './assets/origin-overhead-plan-960.jpg';
import sectionLarge from './assets/origin-section-1920.jpg';
import sectionSmall from './assets/origin-section-960.jpg';
import solarReflectionLarge from './assets/origin-solar-reflection-1920.jpg';
import solarReflectionSmall from './assets/origin-solar-reflection-960.jpg';
import solarStudyLarge from './assets/origin-solar-study-1920.jpg';
import solarStudySmall from './assets/origin-solar-study-960.jpg';
import './view.css';

interface ConceptScene {
  id: string;
  label: string;
  title: string;
  html: string;
}

interface OriginImage {
  sourceId: string;
  smallUrl: string;
  largeUrl: string;
  width: number;
  height: number;
  label: string;
  caption: string;
  alt: string;
  primary?: boolean;
}

const content = rawContent as { scenes: ConceptScene[]; contentHash: string; modelHash: string };
const activeGeometry = resolveActiveGeometry(rawModel as unknown as ProjectModel) as unknown as {
  solar: { planRotation: { value: number } };
};
const planRotation = activeGeometry.solar.planRotation.value;
const viewDescription = getViewDefinition('design-concept').description;
const originTitle = '一切，從紙上的第一筆開始';
const chapterMeta = [
  { sceneId: 'light', number: '01', title: '向光而轉', sideTitle: '向光', caption: '讓建築回應季節與太陽。', motif: 'sun' },
  { sceneId: 'rain', number: '02', title: '向雨而生', sideTitle: '向雨', caption: '讓雨水成為建築可見的循環。', motif: 'water' },
  { sceneId: 'people', number: '03', title: '向人而開', sideTitle: '向人', caption: '讓光線串聯視線、動線與彼此。', motif: 'people' },
  { sceneId: 'time', number: '04', title: '向時間延續', sideTitle: '向時間', caption: '讓回憶延續，新舊並存。', motif: 'time' },
] as const;
const surveyImages: OriginImage[] = [
  {
    sourceId: 'SRC-CONCEPT-013',
    smallUrl: campus02Small,
    largeUrl: campus02Large,
    width: 1920,
    height: 1080,
    label: 'SITE NOTE 01',
    caption: '從球場側回看舊有量體，先記住尺度、入口與校園日常的距離。',
    alt: '校園場勘二：球場旁的既有泳池建物、樹木與入口',
    primary: true,
  },
  {
    sourceId: 'SRC-CONCEPT-016',
    smallUrl: campus05Small,
    largeUrl: campus05Large,
    width: 1920,
    height: 1080,
    label: 'SITE NOTE 02',
    caption: '樹冠、鋪面與既有建物共同界定了場地；更新不能只看建築本身。',
    alt: '校園場勘五：既有建物、戶外樓梯、老樹與前方鋪面',
  },
  {
    sourceId: 'SRC-CONCEPT-017',
    smallUrl: campus06Small,
    largeUrl: campus06Large,
    width: 1920,
    height: 1080,
    label: 'SITE NOTE 03',
    caption: '老樹與長向立面形成最強的現場記憶，也成為新舊關係的起點。',
    alt: '校園場勘六：老樹遮蔭下的既有泳池長向立面',
  },
];
const sketchImages: OriginImage[] = [
  {
    sourceId: 'SRC-CONCEPT-022',
    smallUrl: solarStudySmall,
    largeUrl: solarStudyLarge,
    width: 1920,
    height: 1340,
    label: 'SKETCH 01',
    caption: '先在紙上辨認東西南北與季節日照，讓量體的轉動有一個最初理由。',
    alt: '粉紅色紙張上的手繪日照研究，包含方位、季節與光線方向註記',
    primary: true,
  },
  {
    sourceId: 'SRC-CONCEPT-018',
    smallUrl: overheadPlanSmall,
    largeUrl: overheadPlanLarge,
    width: 1920,
    height: 1055,
    label: 'SKETCH 02',
    caption: '俯視圖把泳池、服務空間、戶外區與樓梯放進同一個關係裡。',
    alt: '手繪俯視圖，標示泳池、服務空間、戶外區與樓梯',
  },
  {
    sourceId: 'SRC-CONCEPT-019',
    smallUrl: sectionSmall,
    largeUrl: sectionLarge,
    width: 1920,
    height: 1373,
    label: 'SKETCH 03',
    caption: '剖面開始追問：玻璃屋頂、鏡牆、雨水與人在不同高度如何相遇。',
    alt: '手繪剖面圖，標示玻璃屋頂、鏡牆、泳池、雨水回收與服務空間',
  },
  {
    sourceId: 'SRC-CONCEPT-020',
    smallUrl: early3dSmall,
    largeUrl: early3dLarge,
    width: 1920,
    height: 1352,
    label: 'SKETCH 04',
    caption: '與哥哥一起把平面的線轉成立體，第一次看見量體、泳池與入口的整體關係。',
    alt: '早期手繪三維示意，呈現泳池、入口、服務量體與傾斜屋頂',
  },
  {
    sourceId: 'SRC-CONCEPT-021',
    smallUrl: solarReflectionSmall,
    largeUrl: solarReflectionLarge,
    width: 1920,
    height: 1351,
    label: 'SKETCH 05',
    caption: '最後用最簡單的光線，反覆確認冬季導光與夏季遮陽能否同時成立。',
    alt: '手繪日照反射剖面，標示冬季與夏季陽光、鏡面與水面',
  },
];

function scene(id: string): ConceptScene {
  const found = content.scenes.find((item) => item.id === id);
  if (!found) throw new TypeError(`Concept content is missing scene ${id}.`);
  return found;
}

function accessibleDrawing(): string {
  return l3Drawing
    .replace('<svg ', '<svg class="concept-drawing" role="img" aria-labelledby="concept-drawing-title concept-drawing-desc" ')
    .replace(
      /<title>.*?<\/title>/,
      '<title id="concept-drawing-title">三樓旋轉量體與太陽能屋頂概念平面</title><desc id="concept-drawing-desc">現行 V067 三樓平面圖，顯示旋轉量體、鏡牆、到達翼與太陽能屋頂配置。</desc>',
    );
}

function splitOverview(html: string): { heroHtml: string; originHtml: string } {
  const template = document.createElement('template');
  template.innerHTML = html;
  const heading = [...template.content.querySelectorAll('h2')]
    .find((candidate) => candidate.textContent?.trim() === originTitle);
  if (!heading) throw new TypeError('Concept content is missing the hand-sketch origin section.');
  const origin = document.createElement('div');
  let node: ChildNode | null = heading;
  while (node) {
    const next: ChildNode | null = node.nextSibling;
    origin.append(node);
    node = next;
  }
  return {
    heroHtml: template.innerHTML,
    originHtml: origin.innerHTML.replace(
      `<h2>${originTitle}</h2>`,
      '<h2>從 紙上的<br>第一筆開始</h2>',
    ),
  };
}

function originFigure(image: OriginImage, collection: 'survey' | 'sketch'): string {
  const sizes = image.primary
    ? '(max-width: 720px) calc(100vw - 40px), (max-width: 980px) 58vw, 48vw'
    : '(max-width: 720px) calc(100vw - 40px), (max-width: 980px) 29vw, 24vw';
  return `
    <figure
      class="concept-origin-figure ${image.primary ? 'concept-origin-figure--primary' : ''}"
      data-source-id="${image.sourceId}"
      data-origin-collection="${collection}"
    >
      <picture class="concept-origin-media">
        <source srcset="${image.smallUrl} 960w, ${image.largeUrl} 1920w" sizes="${sizes}">
        <img
          src="${image.smallUrl}"
          width="${image.width}"
          height="${image.height}"
          alt="${image.alt}"
          loading="lazy"
          decoding="async"
        >
      </picture>
      <figcaption>
        <span>${image.label}</span>
        <p>${image.caption}</p>
      </figcaption>
    </figure>
  `;
}

export function mount(container: HTMLElement): MountedView {
  const overview = scene('overview');
  const overviewSections = splitOverview(overview.html);
  container.innerHTML = `
    <article class="concept-hero" aria-labelledby="concept-title">
      <div class="concept-hero-copy">
        <p class="site-kicker">DESIGN NARRATIVE</p>
        <p class="site-section-description">${viewDescription}</p>
        <div class="concept-overview">${overviewSections.heroHtml}</div>
      </div>
      <figure class="concept-hero-figure">
        <div class="concept-drawing-window">${accessibleDrawing()}</div>
        <figcaption>
          <span>V067 ／ L3 PLAN</span>
          <span>水平旋轉 ${planRotation >= 0 ? '+' : ''}${planRotation.toFixed(1)}°</span>
        </figcaption>
      </figure>
    </article>
    <section id="concept-origin" class="concept-origin" aria-labelledby="concept-origin-title">
      <header class="concept-origin-heading">
        <p class="site-kicker concept-origin-kicker">
          <span class="concept-origin-number">00</span>
          <span>／ ORIGIN</span>
        </p>
        <div class="concept-origin-copy">${overviewSections.originHtml}</div>
      </header>
      <div class="concept-origin-story">
        <section class="concept-origin-stage" aria-labelledby="concept-origin-site-title">
          <header class="concept-origin-stage-heading">
            <span>00A</span>
            <div>
              <h3 id="concept-origin-site-title">先看見，才開始畫</h3>
              <p>設計不是從形狀開始，而是先回到現場：看見既有建物、老樹、球場與每天經過這裡的人。</p>
            </div>
          </header>
          <div class="concept-origin-gallery concept-origin-gallery--survey" aria-label="校園場勘二、五、六">
            ${surveyImages.map((image) => originFigure(image, 'survey')).join('')}
          </div>
        </section>
        <section class="concept-origin-stage" aria-labelledby="concept-origin-sketch-title">
          <header class="concept-origin-stage-heading">
            <span>00B</span>
            <div>
              <h3 id="concept-origin-sketch-title">讓每一條線，回答一個問題</h3>
              <p>從方位到平面、從剖面到立體，再回到光線；方案不是一次完成，而是在一張張紙上逐漸清楚。</p>
            </div>
          </header>
          <div class="concept-origin-gallery concept-origin-gallery--sketch" data-hand-sketch-gallery aria-label="早期手繪設計稿">
            ${sketchImages.map((image) => originFigure(image, 'sketch')).join('')}
          </div>
        </section>
      </div>
    </section>
    <nav id="concept-chapters" class="concept-index" aria-label="四個設計方向">
      ${chapterMeta.map((chapter) => `
        <a href="#concept-${chapter.sceneId}">
          <span>${chapter.number}</span>
          <strong>${chapter.title}</strong>
          <small>${chapter.caption}</small>
        </a>
      `).join('')}
    </nav>
    <div class="concept-chapters">
      ${chapterMeta.map((chapter, index) => {
        const contentScene = scene(chapter.sceneId);
        let chapterHtml = contentScene.html;
        let detailHtml = '';
        let conclusionHtml = '';
        if (chapter.sceneId === 'time') {
          const detailMarker = '<h2>設計細節</h2>';
          const conclusionMarker = '<h2>結語</h2>';
          const detailIndex = chapterHtml.indexOf(detailMarker);
          const conclusionIndex = chapterHtml.indexOf(conclusionMarker);
          if (detailIndex < 0 || conclusionIndex < detailIndex) {
            throw new TypeError('Time concept content is missing its detail or conclusion section.');
          }
          detailHtml = chapterHtml.slice(detailIndex + detailMarker.length, conclusionIndex);
          conclusionHtml = chapterHtml
            .slice(conclusionIndex + conclusionMarker.length)
            .replace(
              '<blockquote>',
              '<blockquote class="concept-final-note">',
            );
          chapterHtml = chapterHtml.slice(0, detailIndex);
        }
        return `
          <section
            id="concept-${chapter.sceneId}"
            class="concept-chapter concept-chapter--${chapter.motif} ${index % 2 ? 'concept-chapter--reverse' : ''}"
            aria-labelledby="concept-${chapter.sceneId}-title"
          >
            <header class="concept-chapter-heading">
              <span>${chapter.number}</span>
              <h2 id="concept-${chapter.sceneId}-title" aria-label="${chapter.title}">
                <span class="concept-side-title--desktop">${chapter.sideTitle}</span>
                <span class="concept-side-title--mobile" aria-hidden="true">${chapter.title}</span>
              </h2>
            </header>
            <div class="concept-chapter-copy">${chapterHtml}</div>
            <div class="concept-motif" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </div>
          </section>
          ${detailHtml ? `
            <section class="concept-detail-section" aria-labelledby="concept-detail-heading">
              <header class="concept-chapter-heading concept-detail-side-heading">
                <h2 id="concept-detail-heading">設計細節</h2>
              </header>
              <div class="concept-chapter-copy">${detailHtml}</div>
            </section>
            <section class="concept-conclusion-section" aria-labelledby="concept-conclusion-heading">
              <header class="concept-chapter-heading concept-conclusion-side-heading">
                <h2 id="concept-conclusion-heading">結語</h2>
              </header>
              <div class="concept-chapter-copy">${conclusionHtml}</div>
            </section>
          ` : ''}
        `;
      }).join('')}
    </div>
    <section class="concept-journey" aria-labelledby="concept-journey-title">
      <p class="site-kicker">EPILOGUE ／ FROM LINE TO SPACE</p>
      <h2 id="concept-journey-title">從紙上的一筆，<br>到可被閱讀、驗證、<br>並親自走入的空間。</h2>
      <p>手稿保留最原始的靈感；<br>日照研究提供科學支持；<br>建築繪圖讓想法被實現；<br>3D展示讓空間真正被感受。</p>
      <nav aria-label="繼續閱讀作品成果">
        <a href="?view=solar-study">驗證光線</a>
        <a href="?view=drawings">閱讀圖面</a>
        <a href="?view=3d-viewer">走入空間</a>
      </nav>
    </section>
  `;
  const heading = container.querySelector<HTMLElement>('.concept-overview h1');
  if (heading) heading.id = 'concept-title';
  return {
    destroy() {
      container.replaceChildren();
    },
  };
}
