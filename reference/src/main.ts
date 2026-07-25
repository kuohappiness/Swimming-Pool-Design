import rawModel from '../../model/project-model.json';
import type { ProjectModel, SheetRender } from './types';
import { escapeHtml } from './geometry';
import { renderSheets } from './sheets';

const model = rawModel as unknown as ProjectModel;
const sheets = renderSheets(model);

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Atlas shell is missing ${selector}.`);
  return element;
};

export function destroyAtlas(): void {
  window.removeEventListener('hashchange', handleHashChange);
}

const tabs = required<HTMLElement>('#sheet-tabs');
const stage = required<HTMLElement>('#sheet-stage');
const modelVersion = required<HTMLElement>('#model-version');
const projectName = required<HTMLElement>('#project-name');
const disclaimer = required<HTMLElement>('#disclaimer');

modelVersion.textContent = `MODEL ${model.modelVersion}`;
projectName.textContent = model.project.name;
disclaimer.textContent = model.project.disclaimer;

let activeSheetId = location.hash.slice(1).toUpperCase();
if (!sheets.some((sheet) => sheet.id === activeSheetId)) activeSheetId = sheets[0].id;

function displaySheetTitle(sheet: SheetRender): string {
  if (sheet.id === 'REF-001') return '基地衛星與方位圖';
  const definition = model.sheets.find((item) => item.id === sheet.id);
  return definition?.title ?? sheet.title ?? sheet.id;
}

function sheetMeta(sheet: SheetRender): string {
  const title = displaySheetTitle(sheet);
  const pvToggle = sheet.id === 'V067-L3'
    ? '<label><input id="toggle-pv" type="checkbox" checked /> 太陽能板</label>'
    : '';
  const note = sheet.id === 'REF-001'
    ? `MODEL ${model.modelVersion} · ACTIVE ${model.activeGeometryRevisionId}`
    : sheet.note;
  return `<div class="sheet-toolbar">
    <div>
      <span class="sheet-number">${sheet.id}</span>
      <strong>${escapeHtml(title)}</strong>
    </div>
    <div class="toolbar-actions" aria-label="圖層控制">
      <label><input id="toggle-working" type="checkbox" checked /> 工作值</label>
      ${pvToggle}
      <button id="fit-sheet" type="button">符合畫面</button>
    </div>
  </div>
  <p class="sheet-note">${escapeHtml(note)}</p>`;
}

function sheetTabCopy(sheet: SheetRender): { version: string; title: string } {
  const title = displaySheetTitle(sheet);
  const versionedId = /^V(\d)(\d)(\d)-(.+)$/.exec(sheet.id);
  if (!versionedId) {
    return { version: sheet.id, title: title.replace('參照圖', '') };
  }
  return {
    version: `V${versionedId[1]}.${versionedId[2]}.${versionedId[3]} - ${versionedId[4]}`,
    title: title
      .replace(/^v\d+\.\d+\.\d+｜/i, '')
      .replace('最新', '')
      .replaceAll(' ', ''),
  };
}

function renderTabs(): void {
  tabs.innerHTML = sheets.map((sheet) => {
    const copy = sheetTabCopy(sheet);
    return `<button
    type="button"
    class="sheet-tab ${sheet.id === activeSheetId ? 'active' : ''}"
    data-sheet="${sheet.id}"
    aria-current="${sheet.id === activeSheetId ? 'page' : 'false'}"
  ><span>${escapeHtml(copy.version)}</span>${escapeHtml(copy.title)}</button>`;
  }).join('');

  tabs.querySelectorAll<HTMLButtonElement>('[data-sheet]').forEach((button) => {
    button.addEventListener('click', () => setActiveSheet(button.dataset.sheet ?? sheets[0].id));
  });
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
  stage.querySelector<HTMLInputElement>('#toggle-working')?.addEventListener('change', (event) => {
    const visible = (event.currentTarget as HTMLInputElement).checked;
    stage.classList.toggle('hide-working', !visible);
  });
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
  const requested = location.hash.slice(1).toUpperCase();
  if (sheets.some((sheet) => sheet.id === requested)) setActiveSheet(requested);
}

window.addEventListener('hashchange', handleHashChange);

setActiveSheet(activeSheetId);
