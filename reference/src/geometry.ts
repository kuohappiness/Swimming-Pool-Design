import type { ProjectModel } from './types';
import type { PlanBounds } from '../../scripts/reference-geometry.mjs';

export const PLAN = { x: 112, y: 128, scale: 26 };

export const px = (metres: number) => metres * PLAN.scale;
export const planX = (x: number) => PLAN.x + px(x);
export const planY = (y: number, buildingWidth = 13.5) => PLAN.y + px(buildingWidth - y);

export const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

export function badge(id: string, x: number, y: number, tone = ''): string {
  return `<g class="entity-badge ${tone}" data-entity="${id}" transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${id}">
    <rect x="-36" y="-14" width="72" height="28" rx="5"/>
    <text text-anchor="middle" dy="5">${id}</text>
  </g>`;
}

export function northArrow(x: number, y: number, bearing = 0): string {
  return `<g class="north-arrow" transform="translate(${x} ${y}) rotate(${bearing})">
    <path d="M0 -42 L12 -5 L0 -12 L-12 -5 Z"/>
    <line x1="0" y1="-12" x2="0" y2="30"/>
    <text x="0" y="-49" text-anchor="middle">N</text>
  </g>`;
}

export function grid(model: ProjectModel): string {
  const { x: xGrids, y: yGrids } = model.referenceSystem.grids;
  const width = px(model.geometry.building.width.value);
  const length = px(model.geometry.building.length.value);
  const xLines = xGrids.map((item) => {
    const x = planX(item.position);
    return `<g class="grid-line"><line x1="${x}" y1="${PLAN.y - 28}" x2="${x}" y2="${PLAN.y + width + 28}"/><circle cx="${x}" cy="${PLAN.y - 42}" r="14"/><text x="${x}" y="${PLAN.y - 37}" text-anchor="middle">${item.id}</text></g>`;
  }).join('');
  const yLines = yGrids.map((item) => {
    const y = planY(item.position, model.geometry.building.width.value);
    return `<g class="grid-line"><line x1="${PLAN.x - 28}" y1="${y}" x2="${PLAN.x + length + 28}" y2="${y}"/><circle cx="${PLAN.x - 42}" cy="${y}" r="14"/><text x="${PLAN.x - 42}" y="${y + 5}" text-anchor="middle">${item.id}</text></g>`;
  }).join('');
  return xLines + yLines;
}

export function dimH(x1: number, x2: number, y: number, label: string): string {
  return `<g class="dimension"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><path d="M${x1} ${y - 7}v14 M${x2} ${y - 7}v14"/><text x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle">${label}</text></g>`;
}

export function dimV(x: number, y1: number, y2: number, label: string): string {
  return `<g class="dimension"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><path d="M${x - 7} ${y1}h14 M${x - 7} ${y2}h14"/><text transform="translate(${x - 9} ${(y1 + y2) / 2}) rotate(-90)" text-anchor="middle">${label}</text></g>`;
}

export function titleBlock(model: ProjectModel, sheetId: string, title: string): string {
  return `<g class="title-block">
    <line x1="62" y1="650" x2="1138" y2="650"/>
    <text x="64" y="681" class="title-main">${title}</text>
    <text x="64" y="707">${sheetId} · ${model.project.shortName}</text>
    <text x="805" y="681">MODEL ${model.modelVersion}</text>
    <text x="805" y="707">REV ${model.revision} · 單位 m</text>
  </g>`;
}

export function sheetSvg(model: ProjectModel, sheetId: string, title: string, content: string, viewBox = '0 0 1200 740'): string {
  return `<svg class="drawing" viewBox="${viewBox}" role="img" aria-labelledby="${sheetId}-title">
    <title id="${sheetId}-title">${title}</title>
    <defs>
      <pattern id="water-grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 9 Q4 5 9 9 T18 9" fill="none" stroke="currentColor" stroke-opacity=".22"/></pattern>
      <pattern id="glass-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="14" stroke="currentColor" stroke-opacity=".18"/></pattern>
      <pattern id="deferred-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="12" stroke="currentColor" stroke-opacity=".28"/></pattern>
      <filter id="soft-shadow"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-opacity=".18"/></filter>
    </defs>
    ${content}
    ${titleBlock(model, sheetId, title)}
  </svg>`;
}

export function boundsRect(bounds: PlanBounds, buildingWidth: number): { x: number; y: number; width: number; height: number } {
  return {
    x: planX(bounds.x1),
    y: planY(bounds.y2, buildingWidth),
    width: px(bounds.x2 - bounds.x1),
    height: px(bounds.y2 - bounds.y1),
  };
}

export function cubicleMarkup(
  ids: string[],
  expansionIds: string[],
  prefix: 'M' | 'F',
  bounds: PlanBounds,
  model: ProjectModel,
): string {
  const all = [...ids, ...expansionIds];
  const unitAlongY = model.geometry.combinedCubicle.width;
  const unitAlongX = model.geometry.combinedCubicle.depth;
  const yStart = bounds.y1 + 1.35;
  const yStep = 1.08;
  const xInset = 0.55;
  const bankX = [bounds.x1 + xInset, bounds.x2 - xInset - unitAlongX];

  return all.map((id, index) => {
    const bank = Math.floor(index / 10);
    const position = index % 10;
    const x = bankX[bank];
    const y = yStart + position * yStep;
    const screenX = planX(x);
    const screenY = planY(y + unitAlongY, model.geometry.building.width.value);
    const isExpansion = expansionIds.includes(id);
    const classes = `cubicle ${prefix === 'M' ? 'male' : 'female'} ${isExpansion ? 'expansion' : 'active'}`;
    return `<g class="${classes}" data-cubicle="${id}" tabindex="0" role="button" aria-label="${id} ${isExpansion ? '擴充位置' : '正式單元'}">
      <rect x="${screenX}" y="${screenY}" width="${px(unitAlongX)}" height="${px(unitAlongY)}" rx="2"/>
      <path class="door-swing" d="M${screenX + 3} ${screenY + px(unitAlongY)}h${Math.min(15, px(unitAlongX) - 6)}"/>
      <rect class="cabinet" x="${screenX + px(unitAlongX) - 8}" y="${screenY + 4}" width="5" height="12"/>
      <text x="${screenX + px(unitAlongX) / 2}" y="${screenY + px(unitAlongY) / 2 + 3}" text-anchor="middle">${id.slice(-2)}</text>
    </g>`;
  }).join('');
}

export function isoPoint(x: number, y: number, z: number): [number, number] {
  return [250 + x * 21 - y * 10, 500 - y * 5 - z * 27];
}

export const points = (coords: Array<[number, number]>) => coords.map(([x, y]) => `${x},${y}`).join(' ');
