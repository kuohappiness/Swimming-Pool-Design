import rawModel from '../../../../model/project-model.json';
import type { ProjectModel } from '../../types';
import type { MountedView } from '../../app/view-contract';
import { getViewDefinition } from '../../app/router';
import '../../styles.css';
import './view.css';

const model = rawModel as unknown as ProjectModel;
const viewDescription = getViewDefinition('drawings').description;

export async function mount(container: HTMLElement): Promise<MountedView> {
  container.innerHTML = `
    <section class="view-intro view-intro--drawings" aria-labelledby="drawings-title">
      <p class="site-kicker">DRAWING ATLAS</p>
      <p class="site-section-description">${viewDescription}</p>
      <h1 id="drawings-title">圖面是設計的語言，<br />讓原始的靈感得以實現。</h1>
      <p>五張現行圖面從基地與方位開始，逐層閱讀空間、旋轉、屋頂與剖面關係。</p>
    </section>
    <section class="drawings-catalogue" aria-label="現行圖面">
      <nav id="sheet-tabs" class="sheet-tabs" aria-label="圖面目錄"></nav>
      <div class="workspace">
        <div id="sheet-stage" class="sheet-stage" tabindex="-1" aria-live="polite"></div>
      </div>
      <div class="drawing-trust-line">
        <span id="project-name">${model.project.name}</span>
        <span id="model-version">MODEL ${model.modelVersion}</span>
        <span id="connection-dot" aria-hidden="true"></span>
        <span id="disclaimer">${model.project.disclaimer}</span>
      </div>
    </section>
  `;
  const runtime = await import('../../main');
  return {
    destroy() {
      runtime.destroyAtlas?.();
      container.replaceChildren();
    },
  };
}
