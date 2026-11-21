import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SelectableInfo } from './scene-factory';

interface SelectionOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  selectables: SelectableInfo[];
  objectSelect: HTMLSelectElement;
  onSelect: (selection: SelectableInfo) => void;
}

export interface SelectionController {
  readonly suspended: boolean;
  readonly selectedIndex: number;
  suspend(): void;
  resume(): void;
  selectIndex(index: number, frame?: boolean): void;
  dispose(): void;
}

/** True when the object and every ancestor are visible, so a hidden layer cannot be picked. */
export function isRendered(object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}

/**
 * The selectable that owns a hit mesh. Detail meshes added after tagging carry no
 * owner of their own, so walk up the parents until a selectable is found.
 */
export function owningSelectableIndex(
  object: THREE.Object3D,
  selectableIndex: ReadonlyMap<THREE.Object3D, number>,
): number {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    const direct = selectableIndex.get(current);
    if (direct !== undefined) return direct;
    const owner = current.userData.selectionOwner as THREE.Object3D | undefined;
    const owned = owner ? selectableIndex.get(owner) : undefined;
    if (owned !== undefined) return owned;
  }
  return -1;
}

export function setupSelection(options: SelectionOptions): SelectionController {
  const { canvas, camera, controls, selectables, objectSelect, onSelect } = options;
  const raycaster = new THREE.Raycaster();
  // The default 1 m line tolerance lets edge outlines steal clicks from nearby faces.
  raycaster.params.Line = { threshold: 0.02 };
  const pointer = new THREE.Vector2();
  const selectableIndex = new Map(selectables.map(({ object }, index) => [object, index]));
  let currentIndex = -1;
  let attached = false;
  let disposed = false;

  objectSelect.replaceChildren(new Option('選擇模型構件…', ''));
  selectables.forEach((selection, index) => {
    objectSelect.add(new Option(`${selection.entityId} · ${selection.label}`, String(index)));
  });

  const select = (selection: SelectableInfo, index = selectables.indexOf(selection)) => {
    currentIndex = index;
    objectSelect.value = String(index);
    onSelect(selection);
  };

  // A press that travels further than this is an orbit drag, not a click.
  const clickSlopPixels = 6;
  let pressStart: { id: number; x: number; y: number } | null = null;

  const rememberPress = (event: PointerEvent) => {
    pressStart = event.isPrimary ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  };

  const selectFromPointer = (event: PointerEvent) => {
    const press = pressStart;
    pressStart = null;
    if (!press || press.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > clickSlopPixels) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(selectables.map(({ object }) => object), true);
    const nearest = hits.find(({ object }) => isRendered(object));
    const index = nearest ? owningSelectableIndex(nearest.object, selectableIndex) : -1;
    if (index >= 0) select(selectables[index], index);
  };

  const selectFromKeyboard = (event: KeyboardEvent) => {
    if (!['Enter', ' '].includes(event.key) || !selectables.length) return;
    event.preventDefault();
    const nextIndex = (currentIndex + 1) % selectables.length;
    select(selectables[nextIndex], nextIndex);
  };

  const selectFromList = () => {
    const index = Number(objectSelect.value);
    if (Number.isInteger(index) && selectables[index]) {
      controller.selectIndex(index, true);
    }
  };

  const attach = () => {
    if (attached || disposed) return;
    attached = true;
    objectSelect.disabled = false;
    canvas.addEventListener('pointerdown', rememberPress);
    canvas.addEventListener('pointerup', selectFromPointer);
    canvas.addEventListener('keydown', selectFromKeyboard);
    objectSelect.addEventListener('change', selectFromList);
  };

  const detach = () => {
    if (!attached) return;
    attached = false;
    pressStart = null;
    canvas.removeEventListener('pointerdown', rememberPress);
    canvas.removeEventListener('pointerup', selectFromPointer);
    canvas.removeEventListener('keydown', selectFromKeyboard);
    objectSelect.removeEventListener('change', selectFromList);
  };

  const controller: SelectionController = {
    get suspended() {
      return !attached;
    },
    get selectedIndex() {
      return currentIndex;
    },
    suspend() {
      detach();
      objectSelect.disabled = true;
    },
    resume() {
      attach();
    },
    selectIndex(index, frame = false) {
      const selection = selectables[index];
      if (!selection) return;
      select(selection, index);
      if (frame) {
        const centre = new THREE.Vector3();
        new THREE.Box3().setFromObject(selection.object).getCenter(centre);
        controls.target.copy(centre);
        controls.update();
      }
    },
    dispose() {
      if (disposed) return;
      detach();
      disposed = true;
      objectSelect.disabled = true;
    },
  };

  attach();
  return controller;
}
