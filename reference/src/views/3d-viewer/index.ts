import legacyDocument from './legacy-template.html?raw';
import type { MountedView } from '../../app/view-contract';
import '../../3d-viewer/styles.css';
import './view.css';

function viewerMarkup(): string {
  const documentFragment = new DOMParser().parseFromString(legacyDocument, 'text/html');
  const legacyShell = documentFragment.querySelector<HTMLElement>('[data-viewer-shell]');
  if (!legacyShell) throw new TypeError('3D Viewer template is missing its shell.');
  legacyShell.querySelector('.brand')?.remove();
  legacyShell.querySelectorAll<HTMLAnchorElement>('.viewer-links a').forEach((link) => {
    link.href = link.textContent?.includes('日照')
      ? '?view=solar-study'
      : '?view=drawings#V067-L1';
  });
  const fallbackLink = legacyShell.querySelector<HTMLAnchorElement>('[data-webgl-fallback] a');
  if (fallbackLink) fallbackLink.href = '?view=drawings';
  return `
    <section class="view-intro view-intro--viewer" aria-labelledby="viewer-view-title">
      <p class="site-kicker">04 ／ SPATIAL EXPERIENCE</p>
      <h1 id="viewer-view-title">從圖面走進空間。</h1>
      <p>選擇構件、切換設計場景，或從 EN-01 入口進入第一人稱漫遊。模型幾何、碰撞、游泳與七個安全區域維持既有契約。</p>
    </section>
    <div class="viewer-shell" data-viewer-shell data-viewer-ready="false">${legacyShell.innerHTML}</div>
  `;
}

export async function mount(container: HTMLElement): Promise<MountedView> {
  container.innerHTML = viewerMarkup();
  const runtime = await import('../../3d-viewer/main');
  return {
    async destroy() {
      await runtime.destroyViewer?.();
      container.replaceChildren();
    },
  };
}
