import rawContent from '../../generated/swim-class-content.json';
import rawData from '../../generated/swim-class-data.json';
import type { MountedView } from '../../app/view-contract';
import { getViewDefinition } from '../../app/router';
import { markExternalLinks } from '../../shared/external-links';
import './view.css';

interface SwimItem {
  id: string;
  title: string;
  html: string;
}

interface SwimSection {
  id: string;
  title: string;
  html: string;
  items: SwimItem[];
}

interface Bounds {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface Place {
  bounds: Bounds;
}

type Point = [number, number];

interface SwimClassData {
  revision: string;
  hall: Bounds;
  serviceWing: Bounds;
  pool: { bounds: Bounds; lanes: { y1: number; y2: number }[] };
  platform: Place;
  stair: Place;
  entrance: Place;
  parapet: Place;
  zones: Record<string, Place>;
  aed: Point;
  route: { id: string; standAt: Point; place: string }[];
}

interface Marker {
  key: string;
  badge: string;
  at: Point;
  places: string[];
}

const content = rawContent as { sections: SwimSection[]; contentHash: string };
const data = rawData as unknown as SwimClassData;
const definition = getViewDefinition('swim-class');

const anchorFor = (id: string) => `swim-${id}`;
/** The plan covers the pool hall and the service wing; everything on it is in SITE-XY metres. */
const extent: Bounds = { x1: 0, x2: data.serviceWing.x2, y1: data.hall.y1, y2: data.hall.y2 };
const planWidth = extent.x2 - extent.x1;
const planHeight = extent.y2 - extent.y1;
const places: Record<string, Place> = { ...data.zones, stair: data.stair };
const centre = ({ x1, x2, y1, y2 }: Bounds): Point => [(x1 + x2) / 2, (y1 + y2) / 2];

/** One marker per stop of the class route, in model order; the copy's five steps pair with them by position. */
const routeMarkers: Marker[] = data.route.map((stop, index) => ({
  key: `route-${index + 1}`,
  badge: String(index + 1),
  at: stop.standAt,
  places: [stop.place],
}));

/** Places of the care section, in the order of its items. */
const careMarkers: Marker[] = [
  { key: 'care-1', badge: 'A', at: centre(data.zones.lifeguardChair.bounds), places: ['lifeguardChair'] },
  { key: 'care-2', badge: 'B', at: centre(data.zones.staffFirstAid.bounds), places: ['staffFirstAid'] },
  { key: 'care-3', badge: 'C', at: data.aed, places: [] },
  { key: 'care-4', badge: 'D', at: centre(data.zones.accessibleChanging.bounds), places: ['accessibleChanging'] },
  { key: 'care-5', badge: 'E', at: centre(data.zones.poolLift.bounds), places: ['poolLift', 'entryRamp'] },
];

function section(id: string): SwimSection {
  const found = content.sections.find((candidate) => candidate.id === id);
  if (!found) throw new TypeError(`Swim class content is missing section ${id}.`);
  return found;
}

/** SVG y grows downwards and SITE-XY y grows upwards, so every rectangle is flipped about the plan height. */
function rect({ x1, x2, y1, y2 }: Bounds, className: string, attributes = ''): string {
  return `<rect class="${className}" x="${x1 - extent.x1}" y="${extent.y2 - y2}" width="${x2 - x1}" height="${y2 - y1}" ${attributes}/>`;
}

const position = ([x, y]: Point) =>
  `left: ${((x - extent.x1) / planWidth * 100).toFixed(3)}%; bottom: ${((y - extent.y1) / planHeight * 100).toFixed(3)}%`;

function renderPlan(mode: 'route' | 'care', markers: Marker[], label: string): string {
  const keysByPlace = new Map<string, string[]>();
  for (const marker of markers) {
    for (const place of marker.places) keysByPlace.set(place, [...(keysByPlace.get(place) ?? []), marker.key]);
  }
  const placeRects = Object.entries(places).map(([name, place]) =>
    rect(place.bounds, `swim-plan-place swim-plan-place--${name}`, `data-swim-keys="${(keysByPlace.get(name) ?? []).join(' ')}"`));
  const laneLines = data.pool.lanes.slice(1).map(({ y1 }) =>
    `<line class="swim-plan-lane" x1="${data.pool.bounds.x1 - extent.x1}" x2="${data.pool.bounds.x2 - extent.x1}" y1="${extent.y2 - y1}" y2="${extent.y2 - y1}"/>`);
  const treadCount = Math.round((data.stair.bounds.x2 - data.stair.bounds.x1) / 0.5);
  const treads = Array.from({ length: treadCount - 1 }, (_, index) => {
    const x = data.stair.bounds.x1 - extent.x1 + (index + 1) * 0.5;
    return `<line class="swim-plan-tread" x1="${x}" x2="${x}" y1="${extent.y2 - data.stair.bounds.y2}" y2="${extent.y2 - data.stair.bounds.y1}"/>`;
  });
  const routeLine = mode === 'route'
    ? `<polyline class="swim-plan-route" points="${data.route.map(({ standAt: [x, y] }) => `${x - extent.x1},${extent.y2 - y}`).join(' ')}"/>`
    : '';
  const labels: { text: string; at: Point; modifier: string }[] = [
    { text: '泳池', at: centre(data.pool.bounds), modifier: 'pool' },
    { text: '教學平台', at: centre(data.platform.bounds), modifier: 'platform' },
    { text: '樓梯（往二樓更衣）', at: centre(data.stair.bounds), modifier: 'stair' },
    { text: '服務中心', at: [(data.serviceWing.x1 + data.serviceWing.x2) / 2, data.serviceWing.y1 + 3.75], modifier: 'service' },
    { text: '入口', at: [(data.entrance.bounds.x1 + data.entrance.bounds.x2) / 2, extent.y1], modifier: 'entrance' },
  ];
  return `
    <figure class="swim-plan swim-plan--${mode}" data-swim-revision="${data.revision}">
      <div class="swim-plan-scroll">
        <div class="swim-plan-canvas" style="aspect-ratio: ${planWidth} / ${planHeight}">
          <svg viewBox="0 0 ${planWidth} ${planHeight}" preserveAspectRatio="none" role="img" aria-label="${label}">
            ${rect(data.hall, 'swim-plan-hall')}
            ${rect(data.serviceWing, 'swim-plan-service')}
            ${rect(data.pool.bounds, 'swim-plan-pool')}
            ${laneLines.join('')}
            ${rect(data.platform.bounds, 'swim-plan-platform')}
            ${placeRects.join('')}
            ${treads.join('')}
            ${rect(data.parapet.bounds, 'swim-plan-parapet')}
            ${rect(data.entrance.bounds, 'swim-plan-entrance')}
            ${routeLine}
          </svg>
          ${labels.map(({ text, at, modifier }) =>
            `<span class="swim-plan-label swim-plan-label--${modifier}" style="${position(at)}" aria-hidden="true">${text}</span>`).join('')}
          ${markers.map(({ key, badge, at }) =>
            `<span class="swim-plan-marker" data-swim-key="${key}" style="${position(at)}" aria-hidden="true">${badge}</span>`).join('')}
        </div>
      </div>
      <figcaption>簡化的一樓平面，依模型 ${data.revision} 繪製；圖的上下左右和圖面頁的一樓平面圖相同。</figcaption>
    </figure>
  `;
}

function renderLocator(marker: Marker, title: string): string {
  return `
    <button type="button" class="swim-locate" data-swim-key="${marker.key}" aria-pressed="false">
      <span aria-hidden="true">${marker.badge}</span>
      <span class="site-visually-hidden">在平面圖上標出「${title}」</span>
    </button>
  `;
}

function pairMarkers(items: SwimItem[], markers: Marker[], sectionId: string): Marker[] {
  if (items.length !== markers.length) {
    throw new TypeError(`Section ${sectionId} has ${items.length} items for ${markers.length} places on the plan.`);
  }
  return markers;
}

function renderRoute({ items }: SwimSection): string {
  const markers = pairMarkers(items, routeMarkers, 'route');
  return `
    <div class="swim-group" data-swim-group="route">
      ${renderPlan('route', markers, `一樓平面動線圖：${items.map((item, index) => `${index + 1} ${item.title}`).join('、')}。`)}
      <ol class="swim-steps">
        ${items.map((item, index) => `
          <li class="swim-step" id="${anchorFor(item.id)}" data-swim-key="${markers[index].key}">
            ${renderLocator(markers[index], item.title)}
            <div class="swim-step-body">
              <h3>${item.title}</h3>
              ${item.html}
            </div>
          </li>
        `).join('')}
      </ol>
    </div>
  `;
}

function renderCare({ items }: SwimSection): string {
  const markers = pairMarkers(items, careMarkers, 'care');
  return `
    <div class="swim-group" data-swim-group="care">
      ${renderPlan('care', markers, `一樓平面圖上的安全與照顧位置：${items.map((item, index) => `${markers[index].badge} ${item.title}`).join('、')}。`)}
      <div class="swim-cards swim-cards--care">
        ${items.map((item, index) => `
          <article class="swim-card swim-card--located" id="${anchorFor(item.id)}" data-swim-key="${markers[index].key}">
            ${renderLocator(markers[index], item.title)}
            <div class="swim-step-body">
              <h3>${item.title}</h3>
              ${item.html}
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCards({ items }: SwimSection, modifier: string): string {
  return `
    <div class="swim-cards swim-cards--${modifier}">
      ${items.map((item) => `
        <article class="swim-card" id="${anchorFor(item.id)}">
          <h3>${item.title}</h3>
          ${item.html}
        </article>
      `).join('')}
    </div>
  `;
}

function renderSectionBody(current: SwimSection): string {
  if (current.id === 'route') return renderRoute(current);
  if (current.id === 'care') return renderCare(current);
  return renderCards(current, current.id);
}

/**
 * Each group ties list items to the markers and places of its own plan by `data-swim-key`.
 * Pointing at an item, focusing its button or pressing it selects that key; one key per group stays selected.
 */
function bindGroup(group: HTMLElement, signal: AbortSignal): void {
  const select = (key: string, reveal: boolean) => {
    group.dataset.swimActive = key;
    for (const element of group.querySelectorAll<HTMLElement>('[data-swim-key]')) {
      const active = element.dataset.swimKey === key;
      element.classList.toggle('is-active', active);
      if (element instanceof HTMLButtonElement) element.setAttribute('aria-pressed', String(active));
    }
    for (const place of group.querySelectorAll<SVGElement>('[data-swim-keys]')) {
      place.classList.toggle('is-active', (place.dataset.swimKeys ?? '').split(' ').includes(key));
    }
    if (!reveal) return;
    // On a phone the plan scrolls sideways; bring the selected marker into view without moving the page.
    const scroller = group.querySelector<HTMLElement>('.swim-plan-scroll');
    const marker = group.querySelector<HTMLElement>(`.swim-plan-marker[data-swim-key="${key}"]`);
    if (scroller && marker && scroller.scrollWidth > scroller.clientWidth) {
      scroller.scrollTo({ left: marker.offsetLeft - scroller.clientWidth / 2, behavior: 'auto' });
    }
  };
  const keyOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('.swim-step, .swim-card--located')?.dataset.swimKey : undefined;
  group.addEventListener('pointerover', (event) => {
    const key = event.pointerType === 'mouse' ? keyOf(event.target) : undefined;
    if (key && key !== group.dataset.swimActive) select(key, false);
  }, { signal });
  group.addEventListener('focusin', (event) => {
    const key = keyOf(event.target);
    if (key && key !== group.dataset.swimActive) select(key, false);
  }, { signal });
  group.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.swim-locate') : null;
    if (button?.dataset.swimKey) select(button.dataset.swimKey, true);
  }, { signal });
  const first = group.querySelector<HTMLElement>('.swim-locate')?.dataset.swimKey;
  if (first) select(first, false);
}

export function mount(container: HTMLElement): MountedView {
  const overview = section('overview');
  const sections = content.sections.filter(({ id }) => id !== 'overview');
  container.innerHTML = `
    <section class="view-intro view-intro--swim-class" aria-labelledby="swim-class-title">
      <p class="site-kicker">${definition.eyebrow}</p>
      <p class="site-section-description">${definition.description}</p>
      <h1 id="swim-class-title">從脫下鞋子，<br>到走進水裡。</h1>
      ${overview.html}
    </section>
    <nav class="swim-index" aria-label="本頁目錄">
      <ol>
        ${sections.map(({ id, title }) => `<li><a href="#${anchorFor(id)}">${title}</a></li>`).join('')}
      </ol>
    </nav>
    <div class="swim-sections" data-content-hash="${content.contentHash}">
      ${sections.map((current) => `
        <section
          class="swim-section swim-section--${current.id}"
          id="${anchorFor(current.id)}"
          aria-labelledby="${anchorFor(current.id)}-title"
        >
          <header class="swim-section-header">
            <h2 id="${anchorFor(current.id)}-title">${current.title}</h2>
            <div class="swim-section-intro">${current.html}</div>
          </header>
          ${renderSectionBody(current)}
        </section>
      `).join('')}
    </div>
  `;
  markExternalLinks(container, '.swim-section');
  const controller = new AbortController();
  for (const group of container.querySelectorAll<HTMLElement>('[data-swim-group]')) bindGroup(group, controller.signal);

  return {
    destroy() {
      controller.abort();
      container.replaceChildren();
    },
  };
}
