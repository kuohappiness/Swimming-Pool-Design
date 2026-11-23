import rawContent from '../../generated/water-cycle-content.json';
import rawData from '../../generated/water-cycle-data.json';
import type { MountedView } from '../../app/view-contract';
import { getViewDefinition } from '../../app/router';
import { markExternalLinks } from '../../shared/external-links';
import './view.css';

interface WaterItem {
  id: string;
  title: string;
  html: string;
}

interface WaterSection {
  id: string;
  title: string;
  html: string;
  items: WaterItem[];
}

interface MonthRainfall {
  month: number;
  millimetres: number;
  volumeM3: number;
}

interface WaterCycleData {
  sourceId: string;
  provider: string;
  statisticalPeriod: string;
  stationName: string;
  stationNumber: string;
  roofAreaM2: number;
  months: MonthRainfall[];
  annualMm: number;
  annualVolumeM3: number;
  annualVolumeInPools: number;
  wettestMonth: MonthRainfall;
  driestMonth: MonthRainfall;
}

const content = rawContent as { sections: WaterSection[]; contentHash: string };
const data = rawData as WaterCycleData;
const definition = getViewDefinition('water-cycle');

/** Months shaded as the warm season; the same split the solar study uses. */
const WARM_SEASON = { first: 5, last: 9 };
const AXIS_STEP_MM = 100;

const anchorFor = (id: string) => `water-${id}`;
const grouped = (value: number, digits: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const millimetres = (value: number) => `${grouped(value, 1)} mm`;
const cubicMetres = (value: number) => `${grouped(value, 0)} m³`;

function section(id: string): WaterSection {
  const found = content.sections.find((candidate) => candidate.id === id);
  if (!found) throw new TypeError(`Water cycle content is missing section ${id}.`);
  return found;
}

/**
 * Monthly rainfall as a column chart. The plot is one image to assistive technology;
 * the table under it carries the same twelve values as text.
 */
function renderRainfallChart(): string {
  const axisTop = Math.ceil(data.wettestMonth.millimetres / AXIS_STEP_MM) * AXIS_STEP_MM;
  const ticks = Array.from(
    { length: axisTop / AXIS_STEP_MM + 1 },
    (_, index) => index * AXIS_STEP_MM,
  );
  const share = (value: number) => ((value / axisTop) * 100).toFixed(3);
  const summary =
    `長條圖：${data.stationName} ${data.statisticalPeriod} 年各月平均降水量。` +
    `最多是 ${data.wettestMonth.month} 月 ${millimetres(data.wettestMonth.millimetres)}，` +
    `最少是 ${data.driestMonth.month} 月 ${millimetres(data.driestMonth.millimetres)}，` +
    `全年 ${millimetres(data.annualMm)}。`;
  return `
    <figure class="water-chart" data-source-id="${data.sourceId}">
      <figcaption class="water-chart-caption">
        <strong>各月平均降水量</strong>
        <span>單位 mm｜${data.stationName} ${data.statisticalPeriod}</span>
      </figcaption>
      <div class="water-chart-plot" role="img" aria-label="${summary}">
        <div class="water-chart-axis" aria-hidden="true">
          ${ticks.map((tick) => `<span style="--water-level: ${share(tick)}%">${grouped(tick, 0)}</span>`).join('')}
        </div>
        <div class="water-chart-area" aria-hidden="true">
          ${ticks.map((tick) => `<span class="water-chart-gridline" style="--water-level: ${share(tick)}%"></span>`).join('')}
          <span
            class="water-chart-season"
            style="--water-first: ${WARM_SEASON.first}; --water-last: ${WARM_SEASON.last}"
          >暖季</span>
          <ol class="water-chart-columns">
            ${data.months
              .map(({ month, millimetres: value, volumeM3 }) => {
                const marked =
                  month === data.wettestMonth.month || month === data.driestMonth.month;
                return `
                <li class="water-chart-column" data-water-month="${month}" style="--water-level: ${share(value)}%">
                  <span class="water-chart-bar"></span>
                  ${marked ? `<span class="water-chart-value">${grouped(value, 1)}</span>` : ''}
                  <span class="water-chart-tip">
                    <strong>${month} 月</strong>
                    <span>降水量 ${millimetres(value)}</span>
                    <span>落在屋頂約 ${cubicMetres(volumeM3)}</span>
                  </span>
                </li>
              `;
              })
              .join('')}
          </ol>
        </div>
        <ol class="water-chart-months" aria-hidden="true">
          ${data.months.map(({ month }) => `<li>${month}<span> 月</span></li>`).join('')}
        </ol>
      </div>
      <details class="water-chart-table">
        <summary>看每個月的數字</summary>
        <div class="water-chart-table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">月份</th>
                <th scope="col">平均降水量</th>
                <th scope="col">落在屋頂的雨水（概念估算）</th>
              </tr>
            </thead>
            <tbody>
              ${data.months
                .map(
                  ({ month, millimetres: value, volumeM3 }) => `
                <tr>
                  <th scope="row">${month} 月</th>
                  <td>${millimetres(value)}</td>
                  <td>約 ${cubicMetres(volumeM3)}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">全年</th>
                <td>${millimetres(data.annualMm)}</td>
                <td>約 ${cubicMetres(data.annualVolumeM3)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </figure>
  `;
}

function renderRoofFigures(): string {
  const figures = [
    { value: `${grouped(data.roofAreaM2, 0)} m²`, label: '玻璃屋頂從正上方看的面積' },
    { value: `約 ${cubicMetres(data.annualVolumeM3)}`, label: '一年落在屋頂上的雨水' },
    { value: `約 ${grouped(data.annualVolumeInPools, 1)} 座`, label: '相當於裝滿幾座這樣的泳池' },
  ];
  return `
    <dl class="water-figures">
      ${figures
        .map(
          ({ value, label }) => `
        <div class="water-figure">
          <dt>${label}</dt>
          <dd>${value}</dd>
        </div>
      `,
        )
        .join('')}
    </dl>
    <p class="water-estimate-note">概念估算｜落在屋頂上的雨水總量，不是可以回收的水量</p>
  `;
}

function renderPath({ items }: WaterSection): string {
  return `
    <ol class="water-path">
      ${items
        .map(
          (item, index) => `
        <li class="water-step" id="${anchorFor(item.id)}">
          <p class="water-step-number site-card-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</p>
          <h3>${item.title}</h3>
          ${item.html}
        </li>
      `,
        )
        .join('')}
    </ol>
  `;
}

/** 這三節的卡片短，排三欄；其餘兩欄。 */
const threeColumnCards = new Set(['rainfall', 'seasons', 'open']);

function renderCards({ items }: WaterSection, modifier: string): string {
  return `
    <div class="water-cards site-cards${threeColumnCards.has(modifier) ? '' : ' site-cards--two'} water-cards--${modifier}">
      ${items
        .map(
          (item) => `
        <article class="water-card site-card" id="${anchorFor(item.id)}">
          <h3>${item.title}</h3>
          ${item.html}
        </article>
      `,
        )
        .join('')}
    </div>
  `;
}

function renderSectionBody(current: WaterSection): string {
  if (current.id === 'rainfall')
    return `${renderRainfallChart()}${renderCards(current, current.id)}`;
  if (current.id === 'roof') return `${renderRoofFigures()}${renderCards(current, current.id)}`;
  if (current.id === 'path') return renderPath(current);
  return renderCards(current, current.id);
}

/** Touch has no hover: a tap pins one column's values, and a tap elsewhere or Escape releases it. */
function bindChart(container: HTMLElement, signal: AbortSignal): void {
  const columns = [...container.querySelectorAll<HTMLElement>('.water-chart-column')];
  const release = () => columns.forEach((column) => column.removeAttribute('data-water-active'));
  container.addEventListener(
    'click',
    (event) => {
      const column =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('.water-chart-column')
          : null;
      const wasActive = column?.hasAttribute('data-water-active');
      release();
      if (column && !wasActive) column.setAttribute('data-water-active', '');
    },
    { signal },
  );
  container.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') release();
    },
    { signal },
  );
}

export function mount(container: HTMLElement): MountedView {
  const overview = section('overview');
  const sections = content.sections.filter(({ id }) => id !== 'overview');
  container.innerHTML = `
    <section class="view-intro view-intro--water-cycle" aria-labelledby="water-cycle-title">
      <p class="site-kicker">${definition.eyebrow}</p>
      <p class="site-section-description">${definition.description}</p>
      <h1 id="water-cycle-title">跟著一滴雨，<br>從屋頂走到廁所。</h1>
      ${overview.html}
    </section>
    <nav class="water-index site-chapter-index" aria-label="本頁目錄">
      <ol>
        ${sections.map(({ id, title }) => `<li><a href="#${anchorFor(id)}">${title}</a></li>`).join('')}
      </ol>
    </nav>
    <div class="water-sections site-chapters" data-content-hash="${content.contentHash}">
      ${sections
        .map(
          (current) => `
        <section
          class="water-section site-chapter water-section--${current.id}"
          id="${anchorFor(current.id)}"
          aria-labelledby="${anchorFor(current.id)}-title"
        >
          <header class="water-section-header site-chapter-header">
            <h2 id="${anchorFor(current.id)}-title">${current.title}</h2>
            <div class="water-section-intro site-chapter-intro">${current.html}</div>
          </header>
          ${renderSectionBody(current)}
        </section>
      `,
        )
        .join('')}
    </div>
  `;
  markExternalLinks(container, '.water-section');
  const controller = new AbortController();
  bindChart(container, controller.signal);

  return {
    destroy() {
      controller.abort();
      container.replaceChildren();
    },
  };
}
