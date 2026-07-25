import viewerTemplate from './viewer-template.html?raw';
import type { MountedView } from '../../app/view-contract';
import { getViewDefinition } from '../../app/router';
import '../../3d-viewer/styles.css';
import './view.css';

const viewDescription = getViewDefinition('3d-viewer').description;

function viewerMarkup(): string {
  return `
    <section class="view-intro view-intro--viewer" aria-labelledby="viewer-view-title">
      <p class="site-kicker">SPATIAL EXPERIENCE</p>
      <p class="site-section-description">${viewDescription}</p>
      <h1 id="viewer-view-title">從圖面走進空間</h1>
      <div class="walkthrough-entry walkthrough-entry--intro" data-walkthrough-entry>
        <button type="button" data-enter-walkthrough aria-describedby="walkthrough-entry-help">實境漫遊</button>
        <span id="walkthrough-entry-help">從 EN-01 入口以人眼尺度探索</span>
      </div>
      <p>走進空間，跟著視線，感受建築中的光線與動線。</p>
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
