import rawContent from '../../../generated/concept-content.json';
import rawModel from '../../../../model/project-model.json';
import l3Drawing from '../../../drafts/v0.6.7/DRAW-L3-PLAN-v0.6.7.svg?raw';
import { resolveActiveGeometry } from '../../../../scripts/active-geometry.mjs';
import type { MountedView } from '../../app/view-contract';
import type { ProjectModel } from '../../types';
import './view.css';

interface ConceptScene {
  id: string;
  label: string;
  title: string;
  html: string;
}

const content = rawContent as { scenes: ConceptScene[]; contentHash: string; modelHash: string };
const activeGeometry = resolveActiveGeometry(rawModel as unknown as ProjectModel) as unknown as {
  solar: { planRotation: { value: number } };
};
const planRotation = activeGeometry.solar.planRotation.value;
const chapterMeta = [
  { sceneId: 'light', number: '01', title: '向光', caption: '讓建築回應季節與太陽', motif: 'sun' },
  { sceneId: 'rain', number: '02', title: '向水', caption: '讓雨水成為建築可見的循環', motif: 'water' },
  { sceneId: 'people', number: '03', title: '向人', caption: '讓光線、視線與動線彼此穿透', motif: 'people' },
  { sceneId: 'time', number: '04', title: '向時間', caption: '讓新與舊清楚並存', motif: 'time' },
] as const;

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

export function mount(container: HTMLElement): MountedView {
  const overview = scene('overview');
  container.innerHTML = `
    <article class="concept-hero" aria-labelledby="concept-title">
      <div class="concept-hero-copy">
        <p class="site-kicker">01 ／ DESIGN NARRATIVE</p>
        <div class="concept-overview">${overview.html}</div>
        <a class="concept-scroll-cue" href="#concept-chapters">閱讀四個方向 <span aria-hidden="true">↓</span></a>
      </div>
      <figure class="concept-hero-figure">
        <div class="concept-drawing-window">${accessibleDrawing()}</div>
        <figcaption>
          <span>V067 ／ L3 PLAN</span>
          <span>水平旋轉 ${planRotation >= 0 ? '+' : ''}${planRotation.toFixed(1)}°</span>
        </figcaption>
      </figure>
    </article>
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
        return `
          <section
            id="concept-${chapter.sceneId}"
            class="concept-chapter concept-chapter--${chapter.motif} ${index % 2 ? 'concept-chapter--reverse' : ''}"
            aria-labelledby="concept-${chapter.sceneId}-title"
          >
            <header class="concept-chapter-heading">
              <span>${chapter.number}</span>
              <p>ORIENTATION</p>
              <h2 id="concept-${chapter.sceneId}-title">${chapter.title}</h2>
              <small>${chapter.caption}</small>
            </header>
            <div class="concept-chapter-copy">${contentScene.html}</div>
            <div class="concept-motif" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </div>
          </section>
        `;
      }).join('')}
    </div>
    <aside class="concept-integrity" aria-label="內容同步狀態">
      <span>CONTENT ${content.contentHash.slice(0, 12)}</span>
      <span>MODEL ${content.modelHash.slice(0, 12)}</span>
      <p>本頁文字由公開理念正本與 active geometry token 編譯，不另存第二份技術數值。</p>
    </aside>
  `;
  const heading = container.querySelector<HTMLElement>('.concept-overview h1');
  if (heading) heading.id = 'concept-title';
  return {
    destroy() {
      container.replaceChildren();
    },
  };
}
