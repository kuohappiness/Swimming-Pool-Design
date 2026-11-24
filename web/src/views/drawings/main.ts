import rawModel from '../../../../model/project-model.json';
import type { ProjectModel, SheetRender } from '../../shared/types';
import { renderSheets, retiredSheetIds } from './sheets';
import { attachPanZoom, type PanZoomControls } from './pan-zoom';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const model = rawModel as unknown as ProjectModel;
const sheets = renderSheets(model);

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Atlas shell is missing ${selector}.`);
  return element;
};

let panZoom: PanZoomControls | null = null;

export function destroyAtlas(): void {
  panZoom?.destroy();
  panZoom = null;
  document.removeEventListener('fullscreenchange', syncFullscreen);
  window.removeEventListener('beforeprint', fitForPrint);
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
      <div class="zoom-controls" role="group" aria-label="縮放">
        <button type="button" data-zoom="out" aria-label="縮小">−</button>
        <output id="zoom-level" aria-live="polite">100%</output>
        <button type="button" data-zoom="in" aria-label="放大">＋</button>
        <button type="button" data-zoom="fit">符合畫面</button>
        <button type="button" data-zoom="fullscreen" aria-pressed="false">全畫面</button>
      </div>
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
  panZoom?.destroy();
  const title = escapeHtml(sheet.title ?? sheet.id);
  stage.innerHTML = `${sheetMeta(sheet)}
    <div class="drawing-viewport" tabindex="0" role="group" aria-label="${title}，可平移縮放" aria-describedby="drawing-help">
      <div class="drawing-wrap">${sheet.markup}</div>
    </div>
    <p id="drawing-help" class="drawing-help">拖曳平移；雙指或按住 Ctrl 加滾輪縮放；鍵盤用 ＋、－ 縮放，方向鍵平移，0 回到符合畫面。</p>`;
  bindSheetControls();
}

function bindSheetControls(): void {
  stage.querySelector<HTMLInputElement>('#toggle-pv')?.addEventListener('change', (event) => {
    const visible = (event.currentTarget as HTMLInputElement).checked;
    stage.classList.toggle('hide-pv', !visible);
  });
  const viewport = stage.querySelector<HTMLElement>('.drawing-viewport');
  const content = stage.querySelector<HTMLElement>('.drawing-wrap');
  const level = stage.querySelector<HTMLOutputElement>('#zoom-level');
  if (!viewport || !content || !level) throw new Error('Atlas sheet is missing its viewer.');
  const zoomButtons = (name: string) => stage.querySelector<HTMLButtonElement>(`[data-zoom="${name}"]`);
  panZoom = attachPanZoom(viewport, content, ({ scale }) => {
    level.value = `${Math.round(scale * 100)}%`;
    const zoomOut = zoomButtons('out');
    const zoomIn = zoomButtons('in');
    if (zoomOut) zoomOut.disabled = scale <= 1;
    if (zoomIn) zoomIn.disabled = scale >= 8;
  });
  zoomButtons('in')?.addEventListener('click', () => panZoom?.zoomIn());
  zoomButtons('out')?.addEventListener('click', () => panZoom?.zoomOut());
  zoomButtons('fit')?.addEventListener('click', () => panZoom?.fit());
  const fullscreenButton = zoomButtons('fullscreen');
  if (fullscreenButton && !document.fullscreenEnabled) fullscreenButton.hidden = true;
  fullscreenButton?.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.requestFullscreen().then(() => viewport.focus());
  });
  syncFullscreen();
}

/** 列印整張圖紙，不印放大後的局部。 */
function fitForPrint(): void {
  panZoom?.fit();
}

/** 全畫面時圖紙用滿螢幕，滾輪直接縮放；按 Esc 離開時回到符合畫面。 */
function syncFullscreen(): void {
  const active = document.fullscreenElement === stage;
  stage.querySelector('[data-zoom="fullscreen"]')?.setAttribute('aria-pressed', String(active));
  if (!active) panZoom?.fit();
}

function handleHashChange(): void {
  const id = sheetIdFromHash();
  if (id) setActiveSheet(id);
}

window.addEventListener('hashchange', handleHashChange);
document.addEventListener('fullscreenchange', syncFullscreen);
window.addEventListener('beforeprint', fitForPrint);
window.addEventListener('resize', updateSheetTabOverflow);
tabs.addEventListener('scroll', updateSheetTabOverflow, { passive: true });

setActiveSheet(activeSheetId);
