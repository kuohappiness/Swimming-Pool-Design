import legacyDocument from './legacy-template.html?raw';
import type { MountedView } from '../../app/view-contract';
import '../../solar-study/styles.css';
import './view.css';

function studyMarkup(): string {
  const documentFragment = new DOMParser().parseFromString(legacyDocument, 'text/html');
  const study = documentFragment.querySelector('main#study-stage');
  const footer = documentFragment.querySelector('footer');
  if (!study) throw new TypeError('Solar study template is missing its study stage.');
  const ownerText = (selector: string) => {
    const value = study.querySelector(selector)?.textContent?.trim();
    if (!value) throw new TypeError(`Solar study owner value is missing: ${selector}.`);
    return value;
  };
  const coldSeasonGain = study.querySelector('.decision-summary-copy')?.textContent
    ?.match(/[+＋][\d,.]+ kWh/)?.[0];
  if (!coldSeasonGain) throw new TypeError('Solar study cold-season gain is missing.');
  return `
    <section class="view-intro view-intro--solar" aria-labelledby="solar-view-title">
      <p class="site-kicker">02 ／ TOWARD LIGHT</p>
      <h1 id="solar-view-title">讓建築轉向光，<br />也讓光知道落點。</h1>
      <p>固定 L1／L2，只讓 L3 的水平旋轉決定鏡牆面向；共面鏡牆的外傾再把光線導向池面。以下研究保留完整工作值、比較控制與專業限制。</p>
      <dl class="solar-signature">
        <div><dt>水平旋轉</dt><dd>${ownerText('#confirmed-plan')}</dd></div>
        <div><dt>鏡牆外傾</dt><dd>${ownerText('#confirmed-lean')}</dd></div>
        <div><dt>鏡牆法線</dt><dd>${ownerText('#confirmed-normal')}</dd></div>
        <div><dt>冷季收益</dt><dd>${coldSeasonGain}</dd></div>
      </dl>
    </section>
    <div class="solar-trust-line">
      <span id="project-name"></span>
      <span id="model-version"></span>
    </div>
    <div class="solar-study-view wrap">${study.innerHTML}</div>
    <details class="solar-method">
      <summary>研究方法、來源與專業限制</summary>
      <div>${footer?.innerHTML ?? ''}</div>
    </details>
  `;
}

export async function mount(container: HTMLElement): Promise<MountedView> {
  container.innerHTML = studyMarkup();
  const runtime = await import('../../solar-study/main');
  return {
    destroy() {
      runtime.destroySolarStudy?.();
      container.replaceChildren();
    },
  };
}
