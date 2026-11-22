import rawModel from '../../../../model/project-model.json';
import type { ProjectModel, SheetRender } from '../../shared/types';
import { escapeHtml } from './geometry';
import { renderSheets, retiredSheetIds } from './sheets';

const model = rawModel as unknown as ProjectModel;
const sheets = renderSheets(model);

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Atlas shell is missing ${selector}.`);
  return element;
};

export function destroyAtlas(): void {
  window.removeEventListener('hashchange', handleHashChange);
  window.removeEventListener('resize', updateSheetTabOverflow);
  tabs.removeEventListener('scroll', updateSheetTabOverflow);
}

const tabs = required<HTMLElement>('#sheet-tabs');
const tabsShell = required<HTMLElement>('.sheet-tabs-shell');
const stage = required<HTMLElement>('#sheet-stage');
const modelVersion = required<HTMLElement>('#model-version');
const projectName = required<HTMLElement>('#project-name');
const disclaimer = required<HTMLElement>('#disclaimer');

modelVersion.textContent = `MODEL ${model.modelVersion}`;
projectName.textContent = model.project.name;
disclaimer.textContent = model.project.disclaimer;

/** 由網址錨點找圖號；去版號前的舊圖號（#V067-L1 等）轉到現行圖號。 */
function sheetIdFromHash(): string | undefined {
  const requested = decodeURIComponent(location.hash.slice(1)).toUpperCase();
  const id = retiredSheetIds[requested] ?? requested;
  return sheets.some((sheet) => sheet.id === id) ? id : undefined;
}

let activeSheetId = sheetIdFromHash() ?? sheets[0].id;

function sheetMeta(sheet: SheetRender): string {
  const title = sheet.title ?? sheet.id;
  const pvToggle = sheet.id === 'L3'
    ? '<label><input id="toggle-pv" type="checkbox" checked /> 太陽能板</label>'
    : '';
  const note = sheet.id === 'SITE'
    ? `MODEL ${model.modelVersion} · ACTIVE ${model.activeGeometryRevisionId}`
    : sheet.note;
  return `<div class="sheet-toolbar">
    <div>
      <span class="sheet-number">${sheet.id}</span>
      <strong>${escapeHtml(title)}</strong>
    </div>
    <div class="toolbar-actions" aria-label="圖層控制">
      ${pvToggle}
      <button id="fit-sheet" type="button">符合畫面</button>
    </div>
  </div>
  <p class="sheet-note">${escapeHtml(note)}</p>`;
}


function renderTabs(): void {
  tabs.innerHTML = sheets.map((sheet) => {
    return `<button
    type="button"
    class="sheet-tab ${sheet.id === activeSheetId ? 'active' : ''}"
    data-sheet="${sheet.id}"
    aria-current="${sheet.id === activeSheetId ? 'page' : 'false'}"
  ><span>${escapeHtml(sheet.id)}</span>${escapeHtml(sheet.title ?? sheet.id)}</button>`;
  }).join('');

  tabs.querySelectorAll<HTMLButtonElement>('[data-sheet]').forEach((button) => {
    button.addEventListener('click', () => setActiveSheet(button.dataset.sheet ?? sheets[0].id));
  });
  updateSheetTabOverflow();
  requestAnimationFrame(updateSheetTabOverflow);
}

function updateSheetTabOverflow(): void {
  const overflowTolerance = 2;
  tabsShell.classList.toggle('can-scroll-left', tabs.scrollLeft > overflowTolerance);
  tabsShell.classList.toggle(
    'can-scroll-right',
    tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - overflowTolerance,
  );
}

function setActiveSheet(id: string): void {
  activeSheetId = id;
  const sheet = sheets.find((item) => item.id === id) ?? sheets[0];
  history.replaceState(null, '', `#${sheet.id}`);
  renderTabs();
  stage.innerHTML = `${sheetMeta(sheet)}<div class="drawing-scroll"><div class="drawing-wrap">${sheet.markup}</div></div>`;
  bindSheetControls();
  const scroller = stage.querySelector<HTMLElement>('.drawing-scroll');
  if (scroller && id === 'REF-201' && window.matchMedia('(max-width: 820px)').matches) {
    scroller.scrollLeft = scroller.scrollWidth;
  }
}

function bindSheetControls(): void {
  stage.querySelector<HTMLInputElement>('#toggle-pv')?.addEventListener('change', (event) => {
    const visible = (event.currentTarget as HTMLInputElement).checked;
    stage.classList.toggle('hide-pv', !visible);
  });
  const fitButton = stage.querySelector<HTMLButtonElement>('#fit-sheet');
  const setFitSheet = (fit: boolean) => {
    stage.classList.toggle('fit-sheet', fit);
    fitButton?.setAttribute('aria-pressed', String(fit));
    if (fitButton) fitButton.textContent = fit ? '原圖尺寸' : '符合畫面';
    if (fit) {
      stage.querySelector<HTMLElement>('.drawing-scroll')
        ?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }
  };
  setFitSheet(window.matchMedia('(max-width: 820px)').matches);
  fitButton?.addEventListener('click', () => {
    setFitSheet(!stage.classList.contains('fit-sheet'));
  });
}

function handleHashChange(): void {
  const id = sheetIdFromHash();
  if (id) setActiveSheet(id);
}

window.addEventListener('hashchange', handleHashChange);
window.addEventListener('resize', updateSheetTabOverflow);
tabs.addEventListener('scroll', updateSheetTabOverflow, { passive: true });

setActiveSheet(activeSheetId);
