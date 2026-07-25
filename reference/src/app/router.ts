export const viewIds = ['design-concept', 'solar-study', 'drawings', '3d-viewer'] as const;

export type ViewId = (typeof viewIds)[number];

export interface ViewDefinition {
  id: ViewId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}

export const viewDefinitions: readonly ViewDefinition[] = [
  {
    id: 'design-concept',
    label: '設計理念',
    eyebrow: 'DESIGN NARRATIVE',
    title: '重新定向',
    description: '向光、向水、向人、向時間',
  },
  {
    id: 'solar-study',
    label: '日照研究',
    eyebrow: 'SOLAR STUDY',
    title: '向光而轉',
    description: 'L3 旋轉鏡牆的季節性光線研究',
  },
  {
    id: 'drawings',
    label: '圖面設計',
    eyebrow: 'DRAWING ATLAS',
    title: '建築圖冊',
    description: '現行平面、剖面與基地資料',
  },
  {
    id: '3d-viewer',
    label: '3D 展示',
    eyebrow: 'SPATIAL EXPERIENCE',
    title: '走入建築',
    description: '構件檢視與第一人稱實境漫遊',
  },
] as const;

export function isViewId(value: string | null): value is ViewId {
  return value !== null && viewIds.includes(value as ViewId);
}

export function resolveView(url = new URL(window.location.href)): ViewId {
  const requested = url.searchParams.get('view');
  if (requested === null) return 'design-concept';
  if (isViewId(requested)) return requested;
  url.searchParams.delete('view');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  return 'design-concept';
}

export function hrefForView(viewId: ViewId): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  if (viewId !== 'design-concept') url.searchParams.set('view', viewId);
  return `${url.pathname}${url.search}`;
}
