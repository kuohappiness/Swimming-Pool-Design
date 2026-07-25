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
