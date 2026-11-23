import rawContent from '../../generated/design-process-content.json';
import planDrawingUrl from '../../../../drawings/current/DRAW-L1-PLAN.svg?url';
import sectionDrawingUrl from '../../../../drawings/current/DRAW-LONGITUDINAL-SECTION.svg?url';
import type { MountedView } from '../../app/view-contract';
import { getViewDefinition } from '../../app/router';
import { markExternalLinks } from '../../shared/external-links';
import planV1Large from './assets/sketch-plan-v1-1920.jpg';
import planV1Small from './assets/sketch-plan-v1-960.jpg';
import planV2Large from './assets/sketch-plan-v2-1920.jpg';
import planV2Small from './assets/sketch-plan-v2-960.jpg';
import sectionV1 from './assets/sketch-section-v1-960.jpg';
import sectionV2Large from './assets/sketch-section-v2-1920.jpg';
import sectionV2Small from './assets/sketch-section-v2-960.jpg';
import './view.css';

interface ProcessItem {
  id: string;
  title: string;
  html: string;
}

interface ProcessSection {
  id: string;
  title: string;
  html: string;
  items: ProcessItem[];
}

interface SketchImage {
  kind: 'sketch';
  sourceId: string;
  smallUrl: string;
  largeUrl: string;
  width: number;
  height: number;
  alt: string;
}

interface DrawingImage {
  kind: 'drawing';
  url: string;
  alt: string;
}

type VersionImage = SketchImage | DrawingImage;

const content = rawContent as { sections: ProcessSection[]; contentHash: string };
const definition = getViewDefinition('design-process');
const TITLE_SEPARATOR = '｜';

/** Images for each item of the `versions` section, in the order of its three paragraphs. */
const versionImages: readonly (readonly VersionImage[])[] = [
  [
    {
      kind: 'sketch',
      sourceId: 'SRC-CONCEPT-003',
      smallUrl: planV1Small,
      largeUrl: planV1Large,
      width: 960,
      height: 724,
      alt: '第一版手繪一樓俯視圖：鉛筆畫出游泳池、一樓廁所、門與樓梯的位置',
    },
    {
      kind: 'sketch',
      sourceId: 'SRC-CONCEPT-010',
      smallUrl: planV2Small,
      largeUrl: planV2Large,
      width: 960,
      height: 528,
      alt: '第二版手繪一樓俯視圖：標示泳池、男女廁、戶外區、樓梯與手寫尺寸',
    },
    { kind: 'drawing', url: planDrawingUrl, alt: '現行一樓平面圖，由數位模型產生' },
  ],
  [
    {
      kind: 'sketch',
      sourceId: 'SRC-CONCEPT-001',
      smallUrl: sectionV1,
      largeUrl: sectionV1,
      width: 960,
      height: 747,
      alt: '第一版手繪長邊側面圖：玻璃屋頂、游泳池的淺端與深端、更衣室與廁所',
    },
    {
      kind: 'sketch',
      sourceId: 'SRC-CONCEPT-011',
      smallUrl: sectionV2Small,
      largeUrl: sectionV2Large,
      width: 960,
      height: 687,
      alt: '第二版手繪剖面圖：玻璃屋頂、鏡牆、樓梯、泳池、雨水回收、廁所與更衣室',
    },
    { kind: 'drawing', url: sectionDrawingUrl, alt: '現行縱向剖面圖，由數位模型產生' },
  ],
];

const anchorFor = (id: string) => `process-${id}`;

function section(id: string): ProcessSection {
  const found = content.sections.find((candidate) => candidate.id === id);
  if (!found) throw new TypeError(`Design process content is missing section ${id}.`);
  return found;
}

function renderTimeline({ items }: ProcessSection): string {
  return `
    <ol class="process-timeline">
      ${items.map((item) => {
        const [when, name] = item.title.split(TITLE_SEPARATOR);
        if (!when || !name) throw new TypeError(`Timeline title needs "<when>${TITLE_SEPARATOR}<name>": ${item.title}`);
        return `
          <li class="process-milestone" id="${anchorFor(item.id)}">
            <p class="process-when">${when}</p>
            <div class="process-milestone-body">
              <h3>${name}</h3>
              ${item.html}
            </div>
          </li>
        `;
      }).join('')}
    </ol>
  `;
}

function renderVersionMedia(image: VersionImage): string {
  if (image.kind === 'drawing') {
    return `<span class="process-version-media process-version-media--drawing">
      <img src="${image.url}" alt="${image.alt}" loading="lazy" decoding="async">
    </span>`;
  }
  return `
    <a class="process-version-media" href="${image.largeUrl}" target="_blank" rel="noopener">
      <picture>
        <source
          srcset="${image.smallUrl} 960w, ${image.largeUrl} 1920w"
          sizes="(max-width: 760px) calc(100vw - 28px), 32vw"
        >
        <img
          src="${image.smallUrl}"
          width="${image.width}"
          height="${image.height}"
          alt="${image.alt}"
          loading="lazy"
          decoding="async"
        >
      </picture>
      <span class="site-visually-hidden">（開啟大圖，另開新視窗）</span>
    </a>
  `;
}

/** Each version item is three paragraphs: a bold stage label followed by the caption for one image. */
function renderVersions({ items }: ProcessSection): string {
  return items.map((item, itemIndex) => {
    const images = versionImages[itemIndex];
    const template = document.createElement('template');
    template.innerHTML = item.html;
    const paragraphs = [...template.content.children].filter((child) => child.tagName === 'P');
    if (!images || paragraphs.length !== images.length) {
      throw new TypeError(`Version item "${item.title}" needs one paragraph per image.`);
    }
    return `
      <article class="process-version" id="${anchorFor(item.id)}" aria-labelledby="${anchorFor(item.id)}-title">
        <h3 id="${anchorFor(item.id)}-title">${item.title}</h3>
        <div class="process-version-row">
          ${paragraphs.map((paragraph, index) => {
            const image = images[index];
            const label = paragraph.querySelector('strong');
            const stage = label?.textContent?.trim();
            if (!stage) throw new TypeError(`Version paragraph ${index + 1} of "${item.title}" needs a bold label.`);
            label?.remove();
            return `
              <figure
                class="process-version-figure"
                data-process-stage="${index + 1}"
                ${image.kind === 'sketch' ? `data-source-id="${image.sourceId}"` : ''}
              >
                ${renderVersionMedia(image)}
                <figcaption>
                  <span class="process-stage">${stage}</span>
                  <p>${paragraph.innerHTML.trim()}</p>
                </figcaption>
              </figure>
            `;
          }).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function renderCards({ items }: ProcessSection, modifier: string): string {
  return `
    <div class="process-cards process-cards--${modifier}">
      ${items.map((item, index) => `
        <article class="process-card" id="${anchorFor(item.id)}">
          <p class="process-card-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</p>
          <h3>${item.title}</h3>
          ${item.html}
        </article>
      `).join('')}
    </div>
  `;
}

function renderSectionBody(current: ProcessSection): string {
  if (current.id === 'timeline') return renderTimeline(current);
  if (current.id === 'versions') return renderVersions(current);
  return renderCards(current, current.id);
}

export function mount(container: HTMLElement): MountedView {
  const overview = section('overview');
  const sections = content.sections.filter(({ id }) => id !== 'overview');
  container.innerHTML = `
    <section class="view-intro" aria-labelledby="design-process-title">
      <p class="site-kicker">${definition.eyebrow}</p>
      <p class="site-section-description">${definition.description}</p>
      <h1 id="design-process-title">從第一張手繪稿，<br>到現在的每一次修改。</h1>
      ${overview.html}
    </section>
    <nav class="process-index" aria-label="本頁目錄">
      <ol>
        ${sections.map(({ id, title }) => `<li><a href="#${anchorFor(id)}">${title}</a></li>`).join('')}
      </ol>
    </nav>
    <div class="process-sections" data-content-hash="${content.contentHash}">
      ${sections.map((current) => `
        <section
          class="process-section process-section--${current.id}"
          id="${anchorFor(current.id)}"
          aria-labelledby="${anchorFor(current.id)}-title"
        >
          <header class="process-section-header">
            <h2 id="${anchorFor(current.id)}-title">${current.title}</h2>
            <div class="process-section-intro">${current.html}</div>
          </header>
          ${renderSectionBody(current)}
        </section>
      `).join('')}
    </div>
  `;
  markExternalLinks(container, '.process-section');

  return {
    destroy() {
      container.replaceChildren();
    },
  };
}
