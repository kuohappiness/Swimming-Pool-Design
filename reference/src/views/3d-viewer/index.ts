import viewerTemplate from './viewer-template.html?raw';
import type { MountedView } from '../../app/view-contract';
import '../../3d-viewer/styles.css';
import './view.css';

function viewerMarkup(): string {
  return `
    <section class="view-intro view-intro--viewer" aria-labelledby="viewer-view-title">
      <p class="site-kicker">04 ／ SPATIAL EXPERIENCE</p>
      <h1 id="viewer-view-title">從圖面走進空間。</h1>
      <p>觀看、選取，或親自走入空間。完整敘事留在設計理念；這裡專注回答尺度、關係與移動。</p>
    </section>
    ${viewerTemplate}
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
