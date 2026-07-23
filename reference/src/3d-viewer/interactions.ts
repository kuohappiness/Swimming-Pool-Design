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

export function setupSelection(options: SelectionOptions) {
  const { canvas, camera, controls, selectables, objectSelect, onSelect } = options;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let currentIndex = -1;

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
      select(selectables[index], index);
      const centre = new THREE.Vector3();
      new THREE.Box3().setFromObject(selectables[index].object).getCenter(centre);
      controls.target.copy(centre);
      controls.update();
    }
  };

  canvas.addEventListener('pointerup', selectFromPointer);
  canvas.addEventListener('keydown', selectFromKeyboard);
  objectSelect.addEventListener('change', selectFromList);
  return () => {
    canvas.removeEventListener('pointerup', selectFromPointer);
    canvas.removeEventListener('keydown', selectFromKeyboard);
    objectSelect.removeEventListener('change', selectFromList);
  };
}
