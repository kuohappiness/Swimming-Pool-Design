import * as THREE from 'three';
import type { ViewerModel } from './model-adapter';
import type { MaterialRegistry } from './rendering/contracts';
import { markVisualDetail } from './rendering/visual-detail';

const box = (
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  return mesh;
};

function detailGroup(name: string, level: 'reduced' | 'full') {
  const group = markVisualDetail(new THREE.Group(), level);
  group.name = name;
  return group;
}

export function createL2InteriorDetails(model: ViewerModel, materials: MaterialRegistry) {
  const root = new THREE.Group();
  root.name = 'L2-INTERIOR-DETAILS-PHASE-1';
  root.userData = {
    visualOnly: true,
    collisionExcluded: true,
    occupancyAppearance: model.viewerPresentation.occupancyAppearance,
  };
  const reduced = detailGroup('quality:reduced:l2-interior', 'reduced');
  const full = detailGroup('quality:full:l2-interior', 'full');
  const l2 = model.geometry.l2;
  const metal = materials.get('sanitary-metal');
  const dark = materials.get('sanitary-dark');
  const tile = materials.get('interior-tile');
  const matrix = new THREE.Matrix4();

  const showerCubicles = Object.values(l2.zones).flatMap(({ showerCubicles }) => showerCubicles);
  const showerHeads = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.035, 12),
    metal,
    showerCubicles.length,
  );
  const showerPipes = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.74, 8),
    metal,
    showerCubicles.length,
  );
  const showerDrains = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.014, 12),
    metal,
    showerCubicles.length,
  );
  const showerValves = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.035, 12),
    metal,
    showerCubicles.length,
  );
  showerHeads.name = 'visual-only:L2-shower-heads:30';
  showerPipes.name = 'visual-only:L2-shower-pipes:30';
  showerDrains.name = 'visual-only:L2-shower-drains:30';
  showerValves.name = 'visual-only:L2-shower-valves:30';
  for (const [index, cubicle] of showerCubicles.entries()) {
    const { x1, x2, y1, y2 } = cubicle.planBounds;
    const x = x1 + 0.09;
    const z = (y1 + y2) / 2;
    matrix.makeRotationZ(Math.PI / 2);
    matrix.setPosition(x + 0.04, l2.baseElevation + 1.82, z);
    showerHeads.setMatrixAt(index, matrix);
    matrix.makeTranslation(x, l2.baseElevation + 1.43, z);
    showerPipes.setMatrixAt(index, matrix);
    matrix.makeTranslation((x1 + x2) / 2, l2.baseElevation + 0.012, (y1 + y2) / 2);
    showerDrains.setMatrixAt(index, matrix);
    matrix.makeRotationZ(Math.PI / 2);
    matrix.setPosition(x + 0.02, l2.baseElevation + 1.16, z);
    showerValves.setMatrixAt(index, matrix);
  }
  reduced.add(showerHeads, showerPipes, showerDrains);
  full.add(showerValves);

  for (const zone of Object.values(l2.zones)) {
    for (const bank of zone.lockerBanks) {
      const extent = bank.planExtent;
      const onXWall = (extent.x2 - extent.x1) < (extent.y2 - extent.y1);
      const span = onXWall ? extent.y2 - extent.y1 : extent.x2 - extent.x1;
      const modules = Math.max(1, Math.floor(span / 0.46));
      for (let index = 1; index < modules; index += 1) {
        const fraction = index / modules;
        if (onXWall) {
          reduced.add(box(
            [extent.x2 - extent.x1 + 0.012, 1.78, 0.012],
            [(extent.x1 + extent.x2) / 2, l2.baseElevation + 0.95, extent.y1 + span * fraction],
            dark,
          ));
        } else {
          reduced.add(box(
            [0.012, 1.78, extent.y2 - extent.y1 + 0.012],
            [extent.x1 + span * fraction, l2.baseElevation + 0.95, (extent.y1 + extent.y2) / 2],
            dark,
          ));
        }
      }
      reduced.add(box(
        [extent.x2 - extent.x1 + 0.014, 0.014, extent.y2 - extent.y1 + 0.014],
        [(extent.x1 + extent.x2) / 2, l2.baseElevation + 0.96, (extent.y1 + extent.y2) / 2],
        dark,
      ));
      const handleCount = modules * 2;
      const handleGeometry = new THREE.BoxGeometry(0.025, 0.12, 0.025);
      const handles = new THREE.InstancedMesh(handleGeometry, metal, handleCount);
      for (let index = 0; index < handleCount; index += 1) {
        const moduleIndex = index % modules;
        const vertical = index < modules ? 0.56 : 1.34;
        const fraction = (moduleIndex + 0.78) / modules;
        if (onXWall) {
          matrix.makeTranslation(
            extent.x1 - 0.02,
            l2.baseElevation + vertical,
            extent.y1 + span * fraction,
          );
        } else {
          matrix.makeTranslation(
            extent.x1 + span * fraction,
            l2.baseElevation + vertical,
            extent.y1 - 0.02,
          );
        }
        handles.setMatrixAt(index, matrix);
      }
      full.add(handles);
    }
  }

  const lightGeometry = new THREE.BoxGeometry(1.05, 0.06, 0.28);
  const ceilingLights = new THREE.InstancedMesh(lightGeometry, materials.get('interior-light'), 12);
  ceilingLights.name = 'visual-only:L2-ceiling-lights:12';
  let lightIndex = 0;
  for (const x of [33.2, 36.2, 39.2]) {
    for (const z of [4, 6.4, 9.6, 12]) {
      matrix.makeTranslation(x, l2.ceiling.elevation - l2.ceiling.thickness - 0.04, z);
      ceilingLights.setMatrixAt(lightIndex, matrix);
      lightIndex += 1;
    }
  }
  reduced.add(ceilingLights);

  const ventGeometry = new THREE.BoxGeometry(0.58, 0.055, 0.24);
  const vents = new THREE.InstancedMesh(ventGeometry, dark, 6);
  vents.name = 'visual-only:L2-vents:6';
  for (let index = 0; index < 6; index += 1) {
    matrix.makeTranslation(
      34.2 + (index % 3) * 2.6,
      l2.ceiling.elevation - l2.ceiling.thickness - 0.055,
      index < 3 ? 5.2 : 10.8,
    );
    vents.setMatrixAt(index, matrix);
  }
  full.add(vents);

  for (const zone of Object.values(l2.zones)) {
    const wet = new THREE.Mesh(new THREE.CircleGeometry(0.72, 24), materials.get('wet-surface'));
    wet.rotation.x = -Math.PI / 2;
    wet.scale.set(1.8, 0.72, 1);
    wet.position.set(zone.bounds.x2 - 1.1, l2.baseElevation + 0.018, zone.bounds.y2 - 0.72);
    full.add(wet);
  }

  const tileBase = box(
    [l2.bounds.x2 - l2.bounds.x1 - 3.1, 0.012, l2.bounds.y2 - l2.bounds.y1 - 2.7],
    [(l2.bounds.x1 + l2.bounds.x2 + 3.1) / 2, l2.baseElevation + 0.008, (l2.bounds.y1 + l2.bounds.y2 + 2.7) / 2],
    tile,
  );
  tileBase.renderOrder = 0;
  reduced.add(tileBase);

  root.add(reduced, full);
  root.traverse((object) => {
    object.userData.visualOnly = true;
    object.userData.collisionExcluded = true;
  });
  return root;
}
