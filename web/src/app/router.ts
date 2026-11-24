/** @internal tools/check/check-docs.mjs 讀這段原始碼核對分頁清單，不是給其他模組用的匯出。 */
export const viewIds = [
  'design-concept',
  'solar-study',
  'water-cycle',
  'swim-class',
  'design-process',
  'drawings',
  '3d-viewer',
  'about',
] as const;

export type ViewId = (typeof viewIds)[number];

export type NavigationGroupId = 'topics';

export interface ViewDefinition {
  id: ViewId;
  /** 唯一頁名：主導覽、分頁標題與文件都用它（DEC-170）。 */
  label: string;
  eyebrow: string;
  description: string;
  /** 屬於主導覽群組的頁面，以第二層頁籤切換。 */
  group?: NavigationGroupId;
}

export interface NavigationGroup {
  id: NavigationGroupId;
  label: string;
  description: string;
}

/** 主導覽的群組。群組不是一頁：點群組進入第一頁，再以第二層頁籤切換（DEC-170）。 */
export const navigationGroups: readonly NavigationGroup[] = [
  {
    id: 'topics',
    label: '四向專題',
    description: '向光、向雨、向人、向時間各有一頁證據',
  },
] as const;

export const viewDefinitions: readonly ViewDefinition[] = [
  {
    id: 'design-concept',
    label: '設計理念',
    eyebrow: 'DESIGN NARRATIVE',
    description: '向光、向雨、向人、向時間',
  },
  {
    id: 'solar-study',
    label: '日照研究',
    eyebrow: 'SOLAR STUDY',
    description: '日照角度的季節性研究',
    group: 'topics',
  },
  {
    id: 'water-cycle',
    label: '水循環',
    eyebrow: 'WATER CYCLE',
    description: '雨量、屋頂接到的雨水與它的去向',
    group: 'topics',
  },
  {
    id: 'swim-class',
    label: '一堂游泳課',
    eyebrow: 'SWIM CLASS',
    description: '跟著一班學生，從入口走到水裡',
    group: 'topics',
  },
  {
    id: 'design-process',
    label: '設計歷程',
    eyebrow: 'DESIGN PROCESS',
    description: '手繪稿、轉折、更正與待解的問題',
    group: 'topics',
  },
  {
    id: 'drawings',
    label: '圖面',
    eyebrow: 'DRAWING ATLAS',
    description: '現行平面、剖面與基地資料',
  },
  {
    id: '3d-viewer',
    label: '3D',
    eyebrow: 'SPATIAL EXPERIENCE',
    description: '3D展示與實境漫遊',
  },
  {
    id: 'about',
    label: '關於',
    eyebrow: 'ABOUT',
    description: '作者、資料來源、名詞與常見問題',
  },
] as const;

export function getViewDefinition(viewId: ViewId): ViewDefinition {
  return viewDefinitions.find(({ id }) => id === viewId) ?? viewDefinitions[0];
}

export function viewsInGroup(groupId: NavigationGroupId): readonly ViewDefinition[] {
  return viewDefinitions.filter(({ group }) => group === groupId);
}

export interface NavigationItem {
  /** view id，或群組 id。 */
  id: ViewId | NavigationGroupId;
  label: string;
  /** 群組項目連到群組的第一頁。 */
  viewId: ViewId;
  group?: NavigationGroupId;
}

/** 主導覽依登錄表順序產生；群組出現在它第一頁的位置，只佔一項。 */
export function navigationItems(): NavigationItem[] {
  const items: NavigationItem[] = [];
  for (const view of viewDefinitions) {
    if (!view.group) {
      items.push({ id: view.id, label: view.label, viewId: view.id });
      continue;
    }
    if (items.some(({ group }) => group === view.group)) continue;
    const group = navigationGroups.find(({ id }) => id === view.group);
    if (!group) throw new TypeError(`View ${view.id} names an unknown navigation group.`);
    items.push({ id: group.id, label: group.label, viewId: view.id, group: group.id });
  }
  return items;
}

function isViewId(value: string | null): value is ViewId {
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
