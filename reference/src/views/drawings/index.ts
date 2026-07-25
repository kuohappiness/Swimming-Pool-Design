import rawModel from '../../../../model/project-model.json';
import type { ProjectModel } from '../../types';
import type { MountedView } from '../../app/view-contract';
import '../../styles.css';
import './view.css';

const model = rawModel as unknown as ProjectModel;

export async function mount(container: HTMLElement): Promise<MountedView> {
  container.innerHTML = `
    <section class="view-intro view-intro--drawings" aria-labelledby="drawings-title">
      <p class="site-kicker">03 ／ DRAWING ATLAS</p>
      <h1 id="drawings-title">圖面不是附件，<br />而是設計的精確語言。</h1>
      <p>五張現行圖面從基地與方位開始，逐層閱讀空間、旋轉、屋頂與剖面關係。所有圖框、比例、北向與版本資訊維持原始 V067 完稿內容。</p>
    </section>
    <section class="drawings-catalogue" aria-label="現行圖面">
      <nav id="sheet-tabs" class="sheet-tabs" aria-label="圖面目錄"></nav>
      <div class="workspace">
        <div id="sheet-stage" class="sheet-stage" tabindex="-1" aria-live="polite"></div>
        <aside id="detail-panel" class="detail-panel" aria-label="選取物件資料">
          <div class="detail-empty">
            <span class="crosshair" aria-hidden="true">＋</span>
            <h2>選取圖面 ID</h2>
            <p>點選有編號的空間、入口、樓梯或屋頂，查看統一模型資料。</p>
          </div>
        </aside>
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
