import './styles.css';
import rawModel from '../../model/project-model.json';
import type { Entity, ProjectModel, SheetRender, Status } from './types';
import { escapeHtml } from './geometry';
import { renderSheets } from './sheets';

const model = rawModel as ProjectModel;
const sheets = renderSheets(model);
const entityById = new Map(model.entities.map((entity) => [entity.id, entity]));

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Atlas shell is missing ${selector}.`);
  return element;
};

const tabs = required<HTMLElement>('#sheet-tabs');
const stage = required<HTMLElement>('#sheet-stage');
const detail = required<HTMLElement>('#detail-panel');
const modelVersion = required<HTMLElement>('#model-version');
const projectName = required<HTMLElement>('#project-name');
const disclaimer = required<HTMLElement>('#disclaimer');

modelVersion.textContent = `MODEL ${model.modelVersion}`;
projectName.textContent = model.project.name;
disclaimer.textContent = model.project.disclaimer;

let activeSheetId = location.hash.slice(1).toUpperCase();
if (!sheets.some((sheet) => sheet.id === activeSheetId)) activeSheetId = sheets[0].id;

const statusLabel: Record<Status, string> = {
  confirmed: '已確認',
  working: '工作值',
  deferred: '待決',
  legacy: '歷史',
};

function sheetMeta(sheet: SheetRender): string {
  const definition = model.sheets.find((item) => item.id === sheet.id);
  const title = definition?.title ?? sheet.title ?? sheet.id;
  return `<div class="sheet-toolbar">
    <div>
      <span class="sheet-number">${sheet.id}</span>
      <strong>${escapeHtml(title)}</strong>
    </div>
    <div class="toolbar-actions" aria-label="圖層控制">
      <label><input id="toggle-working" type="checkbox" checked /> 工作值</label>
      <button id="fit-sheet" type="button">符合畫面</button>
    </div>
  </div>
  <p class="sheet-note">${escapeHtml(sheet.note)}</p>`;
}

function renderTabs(): void {
  tabs.innerHTML = sheets.map((sheet) => {
    const definition = model.sheets.find((item) => item.id === sheet.id);
    const title = definition?.title ?? sheet.title ?? sheet.id;
    return `<button
    type="button"
    class="sheet-tab ${sheet.id === activeSheetId ? 'active' : ''}"
    data-sheet="${sheet.id}"
    aria-current="${sheet.id === activeSheetId ? 'page' : 'false'}"
  ><span>${sheet.id}</span>${escapeHtml(title.replace('參照圖', ''))}</button>`;
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
  bindDrawingInteractions();
  const scroller = stage.querySelector<HTMLElement>('.drawing-scroll');
  if (scroller && id === 'REF-201' && window.matchMedia('(max-width: 820px)').matches) {
    scroller.scrollLeft = scroller.scrollWidth;
  }
}

function renderEntityDetail(entity: Entity): void {
  const sources = entity.sourceIds.length ? entity.sourceIds.join(' · ') : '使用者文字決策';
  detail.innerHTML = `<div class="detail-content">
    <p class="detail-eyebrow">SELECTED ENTITY</p>
    <div class="detail-heading"><h2>${escapeHtml(entity.id)}</h2><span class="status ${entity.status}">${statusLabel[entity.status]}</span></div>
    <p class="entity-name">${escapeHtml(entity.name)}</p>
    <dl>
      <div><dt>類型</dt><dd>${escapeHtml(entity.type)}</dd></div>
      <div><dt>樓層</dt><dd>${escapeHtml(entity.level)}</dd></div>
      <div><dt>格網</dt><dd>${escapeHtml(entity.grid)}</dd></div>
      <div><dt>來源</dt><dd>${escapeHtml(sources)}</dd></div>
      <div><dt>模型版本</dt><dd>${escapeHtml(model.modelVersion)}</dd></div>
    </dl>
  </div>`;
}

function renderCubicleDetail(id: string): void {
  const gender = id.includes('-M-') ? '男生' : '女生';
  const number = Number(id.slice(-2));
  const expansion = number > 15;
  const unit = model.geometry.combinedCubicle;
  detail.innerHTML = `<div class="detail-content">
    <p class="detail-eyebrow">COMBINED CUBICLE</p>
    <div class="detail-heading"><h2>${escapeHtml(id)}</h2><span class="status ${expansion ? 'working' : 'confirmed'}">${expansion ? '擴充位置' : '正式單元'}</span></div>
    <p class="entity-name">${gender}更衣＋淋浴整合室</p>
    <dl>
      <div><dt>尺寸</dt><dd>${unit.width.toFixed(1)} × ${unit.depth.toFixed(1)} m</dd></div>
      <div><dt>機能</dt><dd>更衣、淋浴整合</dd></div>
      <div><dt>置物</dt><dd>單間壁掛櫃</dd></div>
      <div><dt>櫃體</dt><dd>${unit.cabinet.width} × ${unit.cabinet.depth} × ${unit.cabinet.height} m</dd></div>
      <div><dt>集中櫃區</dt><dd>無</dd></div>
    </dl>
  </div>`;
}

function activateElement(element: Element): void {
  stage.querySelectorAll('.selected').forEach((item) => item.classList.remove('selected'));
  element.classList.add('selected');
  const entityId = element.getAttribute('data-entity');
  const cubicleId = element.getAttribute('data-cubicle');
  if (entityId) {
    const entity = entityById.get(entityId);
    if (entity) renderEntityDetail(entity);
  } else if (cubicleId) {
    renderCubicleDetail(cubicleId);
  }
  if (window.matchMedia('(max-width: 820px)').matches) detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function bindDrawingInteractions(): void {
  stage.querySelectorAll('[data-entity], [data-cubicle]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      activateElement(element);
    });
    element.addEventListener('keydown', (event) => {
      if (event instanceof KeyboardEvent && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        activateElement(element);
      }
    });
  });
  stage.querySelector<HTMLInputElement>('#toggle-working')?.addEventListener('change', (event) => {
    const visible = (event.currentTarget as HTMLInputElement).checked;
    stage.classList.toggle('hide-working', !visible);
  });
  stage.querySelector<HTMLButtonElement>('#fit-sheet')?.addEventListener('click', () => {
    stage.querySelector<HTMLElement>('.drawing-scroll')?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  });
}

window.addEventListener('hashchange', () => {
  const requested = location.hash.slice(1).toUpperCase();
  if (sheets.some((sheet) => sheet.id === requested)) setActiveSheet(requested);
});

setActiveSheet(activeSheetId);
