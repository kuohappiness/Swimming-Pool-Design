import * as THREE from 'three';
import type { ViewerModel } from './model-adapter';
import { getViewerPoolPresentation } from './pool-state';
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

function group(name: string, level: 'essential' | 'reduced' | 'full') {
  const detail = markVisualDetail(new THREE.Group(), level);
  detail.name = name;
  return detail;
}

function slopedStrip(
  x0: number,
  x1: number,
  shallowY: number,
  deepY: number,
  z: number,
  width: number,
  material: THREE.Material,
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    x0, shallowY, z - width / 2,
    x0, shallowY, z + width / 2,
    x1, deepY, z + width / 2,
    x1, deepY, z - width / 2,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function addOverflowGrating(
  essential: THREE.Group,
  full: THREE.Group,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  elevation: number,
  materials: MaterialRegistry,
) {
  const grate = materials.get('sanitary-metal');
  const dark = materials.get('sanitary-dark');
  essential.add(
    box([x1 - x0 + 0.36, 0.045, 0.2], [(x0 + x1) / 2, elevation + 0.018, z0 - 0.22], grate),
    box([x1 - x0 + 0.36, 0.045, 0.2], [(x0 + x1) / 2, elevation + 0.018, z1 + 0.22], grate),
    box([0.2, 0.045, z1 - z0], [x0 - 0.22, elevation + 0.018, (z0 + z1) / 2], grate),
    box([0.2, 0.045, z1 - z0], [x1 + 0.22, elevation + 0.018, (z0 + z1) / 2], grate),
  );
  const longSlatGeometry = new THREE.BoxGeometry(0.025, 0.012, 0.18);
  const longSlats = new THREE.InstancedMesh(longSlatGeometry, dark, 104);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 52; index += 1) {
    const x = x0 + (x1 - x0) * index / 51;
    matrix.makeTranslation(x, elevation + 0.048, z0 - 0.22);
    longSlats.setMatrixAt(index, matrix);
    matrix.makeTranslation(x, elevation + 0.048, z1 + 0.22);
    longSlats.setMatrixAt(index + 52, matrix);
  }
  const shortSlatGeometry = new THREE.BoxGeometry(0.18, 0.012, 0.025);
  const shortSlats = new THREE.InstancedMesh(shortSlatGeometry, dark, 36);
  for (let index = 0; index < 18; index += 1) {
    const z = z0 + (z1 - z0) * index / 17;
    matrix.makeTranslation(x0 - 0.22, elevation + 0.048, z);
    shortSlats.setMatrixAt(index, matrix);
    matrix.makeTranslation(x1 + 0.22, elevation + 0.048, z);
    shortSlats.setMatrixAt(index + 18, matrix);
  }
  full.add(longSlats, shortSlats);
}

export function createPoolHallDetails(model: ViewerModel, materials: MaterialRegistry) {
  const root = new THREE.Group();
  root.name = 'POOL-HALL-DETAILS-PHASE-1';
  root.userData = {
    visualOnly: true,
    collisionExcluded: true,
    occupancyAppearance: model.viewerPresentation.occupancyAppearance,
  };
  const essential = group('quality:essential:pool-hall', 'essential');
  const reduced = group('quality:reduced:pool-hall', 'reduced');
  const full = group('quality:full:pool-hall', 'full');
  const pool = model.geometry.pool;
  const presentation = getViewerPoolPresentation(model);
  const x0 = pool.origin[0];
  const x1 = x0 + pool.length.value;
  const z0 = pool.origin[1];
  const z1 = z0 + pool.width.value;
  const deckElevation = pool.deckElevation.value;

  addOverflowGrating(essential, full, x0, x1, z0, z1, deckElevation, materials);
  for (const band of pool.laneBands.slice(0, -1)) {
    const z = (band.y1 + band.y2) / 2;
    essential.add(slopedStrip(
      x0 + 0.35,
      x1 - 0.35,
      presentation.shallowBottomElevation + 0.012,
      presentation.deepBottomElevation + 0.012,
      z,
      0.16,
      materials.get('sanitary-dark'),
    ));
  }

  for (const [x, labelWidth] of [[x0 - 0.58, 0.44], [x1 + 0.58, 0.44]]) {
    reduced.add(
      box([labelWidth, 0.025, 0.34], [x, deckElevation + 0.025, z0 + 0.4], materials.get('signage')),
      box([labelWidth, 0.025, 0.34], [x, deckElevation + 0.025, z1 - 0.4], materials.get('signage')),
    );
  }

  const drainGeometry = new THREE.BoxGeometry(0.72, 0.025, 0.12);
  const drains = new THREE.InstancedMesh(drainGeometry, materials.get('sanitary-metal'), 12);
  drains.name = 'visual-only:POOL-01-deck-drains:12';
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 6; index += 1) {
    const x = x0 + 1.2 + index * (pool.length.value - 2.4) / 5;
    matrix.makeTranslation(x, deckElevation + 0.014, z0 - 0.72);
    drains.setMatrixAt(index, matrix);
    matrix.makeTranslation(x, deckElevation + 0.014, z1 + 0.72);
    drains.setMatrixAt(index + 6, matrix);
  }
  reduced.add(drains);

  const roof = model.geometry.roof;
  const lightGeometry = new THREE.BoxGeometry(1.25, 0.08, 0.32);
  const lights = new THREE.InstancedMesh(lightGeometry, materials.get('interior-light'), 12);
  lights.name = 'visual-only:POOL-HALL-ceiling-lights:12';
  let lightIndex = 0;
  for (const x of [4.5, 9, 13.5, 18, 22.5, 27]) {
    const roofHeight = roof.lowElevation
      + (roof.highElevation - roof.lowElevation) * ((x - roof.startX) / roof.planRun);
    for (const z of [2.1, 11.9]) {
      matrix.makeTranslation(x, roofHeight - 0.12, z);
      lights.setMatrixAt(lightIndex, matrix);
      lightIndex += 1;
    }
  }
  reduced.add(lights);

  const ventGeometry = new THREE.BoxGeometry(0.85, 0.08, 0.32);
  const vents = new THREE.InstancedMesh(ventGeometry, materials.get('sanitary-dark'), 6);
  vents.name = 'visual-only:POOL-HALL-vents:6';
  for (let index = 0; index < 6; index += 1) {
    const x = 5 + index * 4.4;
    const roofHeight = roof.lowElevation
      + (roof.highElevation - roof.lowElevation) * ((x - roof.startX) / roof.planRun);
    matrix.makeTranslation(x, roofHeight - 0.14, 7);
    vents.setMatrixAt(index, matrix);
  }
  full.add(vents);

  const wetPatch = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), materials.get('wet-surface'));
  wetPatch.rotation.x = -Math.PI / 2;
  wetPatch.scale.set(2.4, 0.72, 1);
  wetPatch.position.set(x0 + 4.5, deckElevation + 0.018, z0 - 0.72);
  full.add(wetPatch);

  const causticMaterial = materials.get('pool-caustic');
  for (let index = 0; index < 10; index += 1) {
    const fraction = (index + 0.5) / 10;
    const x = x0 + fraction * (x1 - x0);
    const bottom = presentation.shallowBottomElevation
      + fraction * (presentation.deepBottomElevation - presentation.shallowBottomElevation);
    const stripe = box([1.4, 0.012, z1 - z0 - 0.6], [x, bottom + 0.024, (z0 + z1) / 2], causticMaterial);
    stripe.name = `visual-only:POOL-01-caustic:${index + 1}`;
    stripe.userData.causticPhase = index / 10;
    full.add(stripe);
  }
  root.add(essential, reduced, full);
  root.traverse((object) => {
    object.userData.visualOnly = true;
    object.userData.collisionExcluded = true;
  });
  return root;
}
