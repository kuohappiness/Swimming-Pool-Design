import legacyDocument from './template.html?raw';
import type { MountedView } from '../../app/view-contract';
import { getViewDefinition } from '../../app/router';
import './view.css';

const viewDescription = getViewDefinition('solar-study').description;

/**
 * 把平面圖與剖面圖收在同一欄（寬螢幕時固定在左側、調滑桿時一直看得到），
 * 控制器、讀值與診斷放另一欄；兩張圖的閱讀說明移到控制欄最上方，讓圖欄能放進一個畫面。
 */
function arrangeStage(stage: HTMLElement): void {
  const [planPanel, controlPanel] = stage.querySelectorAll<HTMLElement>(':scope > article.panel');
  const sectionHeading = controlPanel?.querySelector(':scope > h2');
  const sectionSvg = controlPanel?.querySelector(':scope > svg#section');
  const planNote = planPanel?.querySelector(':scope > p.sub');
  const sectionNote = controlPanel?.querySelector(':scope > p.sub');
  if (!planPanel || !controlPanel || !sectionHeading || !sectionSvg || !planNote || !sectionNote) {
    throw new TypeError('Solar study template is missing its plan or section panel.');
  }
  const sectionPanel = document.createElement('article');
  sectionPanel.className = 'panel';
  sectionPanel.append(sectionHeading, sectionSvg);

  const notes = document.createElement('div');
  notes.className = 'stage-notes';
  for (const [label, note] of [['平面', planNote], ['剖面', sectionNote]] as const) {
    const term = document.createElement('strong');
    term.textContent = label;
    note.prepend(term);
    notes.append(note);
  }
  controlPanel.classList.add('stage-controls');
  controlPanel.prepend(notes);

  const figures = document.createElement('div');
  figures.className = 'stage-figures';
  figures.append(planPanel, sectionPanel);
  stage.prepend(figures);
}

function studyMarkup(): string {
  const documentFragment = new DOMParser().parseFromString(legacyDocument, 'text/html');
  const study = documentFragment.querySelector('main#study-stage');
  const footer = documentFragment.querySelector('footer');
  if (!study) throw new TypeError('Solar study template is missing its study stage.');
  const modelStage = study.querySelector<HTMLElement>('section.stage');
  const seasonTable = study.querySelector<HTMLElement>('section.season-table-panel');
  const studyFacts = study.querySelector<HTMLElement>('.facts');
  const principles = study.querySelector<HTMLElement>('section.principles');
  if (!modelStage || !seasonTable || !studyFacts || !principles) {
    throw new TypeError('Solar study template is missing its model stage, seasonal table, site facts, or design principles.');
  }
  arrangeStage(modelStage);
  const conclusion = study.querySelector<HTMLElement>('section.research-conclusion');
  if (!conclusion) throw new TypeError('Solar study template is missing its research conclusion.');
  conclusion.remove();
  const modelMarkup = `${modelStage.outerHTML}${seasonTable.outerHTML}`;
  const factsMarkup = studyFacts.outerHTML;
  modelStage.remove();
  seasonTable.remove();
  studyFacts.remove();
  principles.remove();
  return `
    <section class="view-intro view-intro--solar" aria-labelledby="solar-view-title">
      <p class="site-kicker">SOLAR STUDY</p>
      <p class="site-section-description">${viewDescription}</p>
      <h1 id="solar-view-title">讓建築轉向光，<br />也讓光知道落點。</h1>
      <p>在L3牆面設計鏡面牆；水平旋轉L3結構本體面向；利用鏡牆的外傾再把冬季的光線導向池面。</p>
    </section>
    <div class="solar-study-view solar-conclusion wrap">${conclusion.outerHTML}</div>
    <section class="solar-model" aria-labelledby="solar-model-title">
      <h2 id="solar-model-title"><span aria-hidden="true">|</span> 日照研究模型</h2>
      <div class="solar-study-view solar-model-content wrap">${modelMarkup}</div>
    </section>
    <section class="solar-meta solar-study-view" aria-label="基地資訊">
      ${factsMarkup}
    </section>
    <div class="solar-study-view solar-study-details wrap">
      ${study.innerHTML}
      <details class="solar-method">
        <summary>研究方法、來源與專業限制</summary>
        <div>${footer?.innerHTML ?? ''}</div>
      </details>
    </div>
  `;
}

export async function mount(container: HTMLElement): Promise<MountedView> {
  container.innerHTML = studyMarkup();
  const runtime = await import('./main');
  return {
    destroy() {
      runtime.destroySolarStudy?.();
      container.replaceChildren();
    },
  };
}
