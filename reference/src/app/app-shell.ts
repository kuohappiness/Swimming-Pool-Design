import rawModel from '../../../model/project-model.json';
import siteEmblem from '../assets/site-emblem-header.png';
import type { ProjectModel } from '../types';
import { getViewDefinition, hrefForView, viewDefinitions, type ViewId } from './router';

const model = rawModel as unknown as ProjectModel;

export interface AppShell {
  viewContainer: HTMLElement;
  destroy(): void;
}

export function mountAppShell(host: HTMLElement, activeView: ViewId): AppShell {
  const activeDefinition = getViewDefinition(activeView);
  document.title = `${activeDefinition.title}｜游泳池翻修概念設計`;
  document.documentElement.dataset.activeView = activeView;
  host.innerHTML = `
    <a class="site-skip-link" href="#view-content">跳到主要內容</a>
    <div class="site-frame" data-site-frame data-active-view="${activeView}">
      <header class="site-masthead">
        <a class="site-identity" href="${hrefForView('design-concept')}" aria-label="返回設計理念">
          <span class="site-monogram" aria-hidden="true">
            <img src="${siteEmblem}" alt="">
          </span>
          <span class="site-identity-copy">
            <strong>實小泳池翻修概念設計</strong>
          </span>
        </a>
        <nav class="site-navigation" aria-label="主要章節">
          ${viewDefinitions.map((view) => `
            <a
              href="${hrefForView(view.id)}"
              data-site-nav="${view.id}"
              ${view.id === activeView ? 'aria-current="page"' : ''}
            >${view.label}</a>
          `).join('')}
        </nav>
        <div class="site-release" aria-label="模型版本">
          <span>MODEL</span>
          <strong>${model.modelVersion}</strong>
        </div>
      </header>
      <main id="view-content" class="site-view site-view--${activeView}" tabindex="-1">
        <div data-view-root aria-live="polite"></div>
      </main>
      <footer class="site-footer">
        <p>
          <strong>國立臺中教育大學附設實驗國民小學<br>游泳池改建設計</strong>
          <span class="site-author">作者｜郭鼎佑　日期｜2026.07.29</span>
        </p>
        <p class="site-footer-meta">MODEL ${model.modelVersion} · ${model.activeGeometryRevisionId} · SITE-XY · 單位 m</p>
      </footer>
    </div>
  `;

  const viewContainer = host.querySelector<HTMLElement>('[data-view-root]');
  if (!viewContainer) throw new TypeError('App shell view root was not created.');
  return {
    viewContainer,
    destroy() {
      document.documentElement.removeAttribute('data-active-view');
      host.replaceChildren();
    },
  };
}
