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

export function setupSelection(options: SelectionOptions): SelectionController {
  const { canvas, camera, controls, selectables, objectSelect, onSelect } = options;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
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

  const selectFromPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(selectables.map(({ object }) => object), true);
    const owner = hits[0]?.object.userData.selectionOwner as THREE.Object3D | undefined;
    const direct = hits[0]?.object;
    const match = selectables.find((candidate) => candidate.object === owner || candidate.object === direct);
    if (match) select(match);
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
    canvas.addEventListener('pointerup', selectFromPointer);
    canvas.addEventListener('keydown', selectFromKeyboard);
    objectSelect.addEventListener('change', selectFromList);
  };

  const detach = () => {
    if (!attached) return;
    attached = false;
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
