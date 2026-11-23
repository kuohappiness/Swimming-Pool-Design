import rawModel from '../../../model/project-model.json';
import siteEmblem from '../shared/assets/brand/school-emblem-header.webp';
import type { ProjectModel } from '../shared/types';
import {
  getViewDefinition,
  hrefForView,
  navigationGroups,
  navigationItems,
  viewDefinitions,
  viewsInGroup,
  type ViewDefinition,
  type ViewId,
} from './router';

const model = rawModel as unknown as ProjectModel;

export interface AppShell {
  viewContainer: HTMLElement;
  destroy(): void;
}

/** 頁尾的上一章、下一章依登錄表順序，第一頁沒有上一章、最後一頁沒有下一章。 */
function pagerLink(view: ViewDefinition | undefined, rel: 'prev' | 'next'): string {
  if (!view) return '';
  return `
          <a class="site-pager-link site-pager-link--${rel}" href="${hrefForView(view.id)}" rel="${rel}" data-site-pager="${rel}">
            <span>${rel === 'prev' ? '上一章' : '下一章'}</span>
            <strong>${view.label}</strong>
          </a>`;
}

export function mountAppShell(host: HTMLElement, activeView: ViewId): AppShell {
  const activeDefinition = getViewDefinition(activeView);
  const activeGroup = navigationGroups.find(({ id }) => id === activeDefinition.group);
  const activeIndex = viewDefinitions.findIndex(({ id }) => id === activeView);
  document.title = `${activeDefinition.label}｜實小泳池改建概念設計`;
  document.documentElement.dataset.activeView = activeView;
  if (activeGroup) document.documentElement.dataset.navGroup = activeGroup.id;
  else delete document.documentElement.dataset.navGroup;
  const subnavigation = activeGroup
    ? `
        <nav class="site-subnavigation" aria-label="${activeGroup.label}">
          ${viewsInGroup(activeGroup.id)
            .map(
              (view) => `
            <a
              href="${hrefForView(view.id)}"
              data-site-subnav="${view.id}"
              ${view.id === activeView ? 'aria-current="page"' : ''}
            >${view.label}</a>
          `,
            )
            .join('')}
        </nav>`
    : '';
  host.innerHTML = `
    <a class="site-skip-link" href="#view-content">跳到主要內容</a>
    <div class="site-frame" data-site-frame data-active-view="${activeView}">
      <header class="site-masthead">
        <a class="site-identity" href="${hrefForView('design-concept')}" aria-label="返回設計理念">
          <span class="site-monogram" aria-hidden="true">
            <img src="${siteEmblem}" alt="">
          </span>
          <span class="site-identity-copy">
            <strong>實小泳池改建概念設計</strong>
          </span>
        </a>
        <button
          class="site-menu-button"
          type="button"
          popovertarget="site-navigation"
          aria-controls="site-navigation"
        >
          <span class="site-menu-icon" aria-hidden="true"></span>
          <span>選單</span>
        </button>
        <nav id="site-navigation" class="site-navigation" aria-label="主要章節" popover>
          ${navigationItems()
            .map((item) => {
              // A group is not a page: inside it the group link is marked as the current section.
              const current = item.group
                ? item.group === activeGroup?.id && 'aria-current="true"'
                : item.viewId === activeView && 'aria-current="page"';
              return `
            <a
              href="${hrefForView(item.viewId)}"
              data-site-nav="${item.id}"
              ${item.group ? 'data-site-nav-group' : ''}
              ${current || ''}
            >${item.label}</a>
          `;
            })
            .join('')}
        </nav>${subnavigation}
      </header>
      <main id="view-content" class="site-view site-view--${activeView}" tabindex="-1">
        <div data-view-root aria-live="polite"></div>
      </main>
      <footer class="site-footer">
        <nav class="site-pager" aria-label="上一章與下一章">${pagerLink(viewDefinitions[activeIndex - 1], 'prev')}${pagerLink(viewDefinitions[activeIndex + 1], 'next')}
        </nav>
        <p class="site-colophon">
          <strong>國立臺中教育大學附設實驗國民小學<br>游泳池改建設計</strong>
          <span class="site-author">作者｜郭鼎佑　日期｜2026.07.29</span>
        </p>
        <details class="site-technical">
          <summary>技術資料</summary>
          <p class="site-footer-meta">MODEL ${model.modelVersion} · ${model.activeGeometryRevisionId} · SITE-XY · 單位 m</p>
        </details>
      </footer>
    </div>
  `;

  const viewContainer = host.querySelector<HTMLElement>('[data-view-root]');
  if (!viewContainer) throw new TypeError('App shell view root was not created.');
  // On narrow screens the second-level tabs scroll sideways; keep the current tab in view.
  // The main navigation folds into the menu panel there instead (popover, no script needed).
  for (const bar of host.querySelectorAll<HTMLElement>('.site-subnavigation')) {
    const currentLink = bar.querySelector<HTMLElement>('[aria-current]');
    if (!currentLink) continue;
    const overflow = currentLink.offsetLeft + currentLink.offsetWidth - bar.clientWidth;
    if (overflow > 0) bar.scrollLeft = overflow;
  }
  return {
    viewContainer,
    destroy() {
      document.documentElement.removeAttribute('data-active-view');
      document.documentElement.removeAttribute('data-nav-group');
      host.replaceChildren();
    },
  };
}
