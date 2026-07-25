import '../design-system/tokens.css';
import '../design-system/typography.css';
import '../design-system/layout.css';
import '../design-system/components.css';
import { mountAppShell } from './app-shell';
import { resolveView, type ViewId } from './router';
import type { MountedView, ViewModule } from './view-contract';

const loaders: Record<ViewId, () => Promise<ViewModule>> = {
  'design-concept': () => import('../views/design-concept'),
  'solar-study': () => import('../views/solar-study'),
  'drawings': () => import('../views/drawings'),
  '3d-viewer': () => import('../views/3d-viewer'),
};

function restoreHashTarget(): void {
  if (!window.location.hash) return;
  const targetId = decodeURIComponent(window.location.hash.slice(1));
  window.requestAnimationFrame(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const headerHeight = document.querySelector<HTMLElement>('.site-masthead')?.offsetHeight ?? 0;
    const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - 16;
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, Math.max(0, top));
    root.style.scrollBehavior = previousScrollBehavior;
  });
}

async function bootstrap(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#app');
  if (!host) throw new TypeError('Application root is missing.');
  const viewId = resolveView();
  const shell = mountAppShell(host, viewId);
  let mountedView: MountedView | null = null;
  let destroyed = false;

  const destroy = async () => {
    if (destroyed) return;
    destroyed = true;
    await mountedView?.destroy();
    shell.destroy();
  };

  window.addEventListener('pagehide', () => {
    void destroy();
  }, { once: true });

  try {
    const viewModule = await loaders[viewId]();
    if (destroyed) return;
    mountedView = await viewModule.mount(shell.viewContainer);
    shell.viewContainer.dataset.viewMounted = viewId;
    shell.viewContainer.removeAttribute('aria-busy');
    restoreHashTarget();
  } catch (error) {
    console.error(error);
    shell.viewContainer.innerHTML = `
      <section class="site-error" role="alert">
        <p class="site-kicker">VIEW UNAVAILABLE</p>
        <h1>這個章節暫時無法載入</h1>
        <p>${error instanceof Error ? error.message : '請重新整理頁面後再試。'}</p>
      </section>
    `;
  }
}

void bootstrap();
