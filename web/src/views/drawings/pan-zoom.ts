/**
 * 圖面檢視器的平移與縮放（TASK-173）。圖紙在檢視框裡用 CSS transform 縮放與移動：
 * 倍率 1 是「符合畫面」（整張圖紙剛好放進檢視框），最大 8 倍；拖曳平移，
 * Ctrl 或全畫面時滾輪縮放，雙指捏合縮放，鍵盤 +、−、0 與方向鍵。
 * 計算部分是純函式，方便單元測試；DOM 綁定在 attachPanZoom。
 */

export interface View {
  scale: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
const STEP = 1.5;
const PAN_STEP = 0.1;

export const fitView = (): View => ({ scale: 1, x: 0, y: 0 });

/** 讓圖紙始終蓋滿檢視框：放大時不能拖出空白，倍率 1 時固定在原位。 */
export function clampView(view: View, size: Size): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
  const minX = size.width - size.width * scale;
  const minY = size.height - size.height * scale;
  return {
    scale,
    x: Math.min(0, Math.max(minX, view.x)),
    y: Math.min(0, Math.max(minY, view.y)),
  };
}

/** 以檢視框內的一點為中心縮放，那一點底下的圖面位置保持不動。 */
export function zoomAt(view: View, nextScale: number, point: { x: number; y: number }, size: Size): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
  const ratio = scale / view.scale;
  return clampView({
    scale,
    x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio,
  }, size);
}

export function panBy(view: View, dx: number, dy: number, size: Size): View {
  return clampView({ scale: view.scale, x: view.x + dx, y: view.y + dy }, size);
}

/** 鍵盤操作；不認得的按鍵回傳 null，讓瀏覽器照常處理。 */
export function viewForKey(view: View, key: string, size: Size): View | null {
  const center = { x: size.width / 2, y: size.height / 2 };
  const stepX = size.width * PAN_STEP;
  const stepY = size.height * PAN_STEP;
  switch (key) {
    case '+':
    case '=':
      return zoomAt(view, view.scale * STEP, center, size);
    case '-':
    case '_':
      return zoomAt(view, view.scale / STEP, center, size);
    case '0':
      return fitView();
    case 'ArrowLeft':
      return view.scale > 1 ? panBy(view, stepX, 0, size) : null;
    case 'ArrowRight':
      return view.scale > 1 ? panBy(view, -stepX, 0, size) : null;
    case 'ArrowUp':
      return view.scale > 1 ? panBy(view, 0, stepY, size) : null;
    case 'ArrowDown':
      return view.scale > 1 ? panBy(view, 0, -stepY, size) : null;
    default:
      return null;
  }
}

export interface PanZoomControls {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  destroy(): void;
}

/**
 * 綁定檢視框（overflow: hidden）與裡面的內容。onChange 在倍率改變時通知工具列更新讀數。
 * 只在全畫面或按住 Ctrl／⌘ 時用滾輪縮放，平常滾輪仍捲動頁面。
 */
export function attachPanZoom(
  viewport: HTMLElement,
  content: HTMLElement,
  onChange: (view: View) => void,
): PanZoomControls {
  let view = fitView();
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;

  const size = (): Size => ({ width: viewport.clientWidth, height: viewport.clientHeight });
  const local = (event: { clientX: number; clientY: number }) => {
    const rect = viewport.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const apply = (next: View) => {
    const changed = next.scale !== view.scale;
    view = next;
    content.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    viewport.classList.toggle('is-zoomed', view.scale > 1);
    if (changed) onChange(view);
  };
  const center = () => ({ x: size().width / 2, y: size().height / 2 });

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey && document.fullscreenElement === null) return;
    event.preventDefault();
    apply(zoomAt(view, view.scale * Math.exp(-event.deltaY * 0.002), local(event), size()));
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.set(event.pointerId, local(event));
    viewport.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const point = local(event);
    pointers.set(event.pointerId, point);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 0) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        apply(zoomAt(view, view.scale * (distance / pinchDistance), mid, size()));
      }
      pinchDistance = distance;
      return;
    }
    if (view.scale > 1) apply(panBy(view, point.x - previous.x, point.y - previous.y, size()));
  };
  const onPointerEnd = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = viewForKey(view, event.key, size());
    if (!next) return;
    event.preventDefault();
    apply(next);
  };
  const onResize = () => apply(clampView(view, size()));

  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerEnd);
  viewport.addEventListener('pointercancel', onPointerEnd);
  viewport.addEventListener('keydown', onKeyDown);
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(viewport);
  apply(view);
  onChange(view);

  return {
    zoomIn: () => apply(zoomAt(view, view.scale * STEP, center(), size())),
    zoomOut: () => apply(zoomAt(view, view.scale / STEP, center(), size())),
    fit: () => apply(fitView()),
    destroy() {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerEnd);
      viewport.removeEventListener('pointercancel', onPointerEnd);
      viewport.removeEventListener('keydown', onKeyDown);
      resizeObserver.disconnect();
    },
  };
}
