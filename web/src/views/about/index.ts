import rawContent from '../../generated/about-content.json';
import rawModel from '../../../../model/project-model.json';
import l1DrawingUrl from '../../../../drawings/current/DRAW-L1-PLAN.svg?url';
import l2DrawingUrl from '../../../../drawings/current/DRAW-L2-PLAN.svg?url';
import l3DrawingUrl from '../../../../drawings/current/DRAW-L3-PLAN.svg?url';
import sectionDrawingUrl from '../../../../drawings/current/DRAW-LONGITUDINAL-SECTION.svg?url';
import type { MountedView } from '../../app/view-contract';
import { getViewDefinition } from '../../app/router';
import type { ProjectModel } from '../../shared/types';
import './view.css';

interface AboutItem {
  id: string;
  title: string;
  html: string;
}

interface AboutSection {
  id: string;
  title: string;
  html: string;
  items: AboutItem[];
}

const content = rawContent as { sections: AboutSection[]; contentHash: string };
const model = rawModel as unknown as ProjectModel;
const definition = getViewDefinition('about');
const downloads = [
  { label: '1F 平面圖', fileName: 'DRAW-L1-PLAN.svg', url: l1DrawingUrl },
  { label: '2F 平面圖', fileName: 'DRAW-L2-PLAN.svg', url: l2DrawingUrl },
  { label: '3F 平面圖', fileName: 'DRAW-L3-PLAN.svg', url: l3DrawingUrl },
  { label: '縱向剖面圖', fileName: 'DRAW-LONGITUDINAL-SECTION.svg', url: sectionDrawingUrl },
] as const;

const anchorFor = (sectionId: string) => `about-${sectionId}`;

function renderTopics(section: AboutSection): string {
  return section.items.map((item) => `
    <article class="about-topic" id="about-${item.id}">
      <h3>${item.title}</h3>
      ${item.html}
    </article>
  `).join('');
}

function renderGlossary(section: AboutSection): string {
  return `
    <dl class="about-glossary">
      ${section.items.map((item) => `
        <div class="about-term" id="about-${item.id}">
          <dt>${item.title}</dt>
          <dd>${item.html}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}

function renderFaq(section: AboutSection): string {
  return `
    <div class="about-faq">
      ${section.items.map((item) => `
        <details class="about-question" id="about-${item.id}">
          <summary><span>${item.title}</span></summary>
          <div class="about-answer">${item.html}</div>
        </details>
      `).join('')}
    </div>
  `;
}

function renderDownloads(): string {
  return `
    <ul class="about-downloads">
      ${downloads.map(({ label, fileName, url }) => `
        <li>
          <a href="${url}" download="${fileName}" data-about-download="${fileName}">
            <strong>${label}</strong>
            <span>SVG · ${fileName}</span>
          </a>
        </li>
      `).join('')}
    </ul>
    <p class="about-version">模型版本 ${model.modelVersion} · 幾何修訂 ${model.activeGeometryRevisionId}</p>
  `;
}

function renderSectionBody(section: AboutSection): string {
  if (section.id === 'glossary') return renderGlossary(section);
  if (section.id === 'faq') return renderFaq(section);
  if (section.id === 'downloads') return renderDownloads();
  return `<div class="about-topics">${renderTopics(section)}</div>`;
}

function markExternalLinks(container: HTMLElement): void {
  for (const link of container.querySelectorAll<HTMLAnchorElement>('.about-section a[href^="http"]')) {
    link.target = '_blank';
    link.rel = 'noopener';
    link.insertAdjacentHTML('beforeend', '<span class="about-visually-hidden">（另開新視窗）</span>');
  }
}

export function mount(container: HTMLElement): MountedView {
  container.innerHTML = `
    <section class="view-intro view-intro--about" aria-labelledby="about-title">
      <p class="site-kicker">${definition.eyebrow}</p>
      <p class="site-section-description">${definition.description}</p>
      <h1 id="about-title">誰做的、資料從哪裡來、<br>這些名詞是什麼意思。</h1>
      <p>${model.project.disclaimer}。這一頁說明網站內容的來源、限制與讀法。</p>
    </section>
    <div class="about-layout" data-content-hash="${content.contentHash}">
      <nav class="about-contents" aria-label="本頁目錄">
        <ol>
          ${content.sections.map((section) => `
            <li><a href="#${anchorFor(section.id)}">${section.title}</a></li>
          `).join('')}
        </ol>
      </nav>
      <div class="about-sections">
        ${content.sections.map((section) => `
          <section
            class="about-section about-section--${section.id}"
            id="${anchorFor(section.id)}"
            aria-labelledby="${anchorFor(section.id)}-title"
          >
            <h2 id="${anchorFor(section.id)}-title">${section.title}</h2>
            <div class="about-section-intro">${section.html}</div>
            ${renderSectionBody(section)}
          </section>
        `).join('')}
      </div>
    </div>
  `;
  markExternalLinks(container);

  const openHashTarget = () => {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (target instanceof HTMLDetailsElement) target.open = true;
  };
  openHashTarget();
  window.addEventListener('hashchange', openHashTarget);

  return {
    destroy() {
      window.removeEventListener('hashchange', openHashTarget);
      container.replaceChildren();
    },
  };
}
