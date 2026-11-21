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

function group(name: string, level: 'reduced' | 'full') {
  const detail = markVisualDetail(new THREE.Group(), level);
  detail.name = name;
  return detail;
}

function addConcretePanelJoints(
  target: THREE.Group,
  x1: number,
  x2: number,
  z: number,
  height: number,
  outward: number,
  materials: MaterialRegistry,
) {
  const joint = materials.get('sanitary-dark');
  for (let x = x1 + 2; x < x2 - 0.2; x += 2) {
    target.add(box([0.018, height - 0.18, 0.014], [x, height / 2, z + outward], joint));
  }
  for (let elevation = 1.2; elevation < height - 0.2; elevation += 1.2) {
    target.add(box([x2 - x1 - 0.12, 0.018, 0.014], [(x1 + x2) / 2, elevation, z + outward], joint));
  }
}

function addConcreteTieHoles(
  target: THREE.Group,
  x1: number,
  x2: number,
  z: number,
  height: number,
  outward: number,
  materials: MaterialRegistry,
) {
  const xs = [];
  for (let x = x1 + 1; x < x2 - 0.4; x += 2) xs.push(x);
  const elevations = [0.72, 1.72, 2.72].filter((value) => value < height - 0.18);
  const geometry = new THREE.CylinderGeometry(0.038, 0.038, 0.018, 12);
  const holes = new THREE.InstancedMesh(
    geometry,
    materials.get('sanitary-dark'),
    xs.length * elevations.length,
  );
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  let index = 0;
  for (const x of xs) {
    for (const elevation of elevations) {
      matrix.makeTranslation(x, elevation, z + outward);
      matrix.multiply(rotation);
      holes.setMatrixAt(index, matrix);
      index += 1;
    }
  }
  holes.name = 'visual-only:concrete-tie-holes';
  target.add(holes);
}

export function createArchitecturalDetails(model: ViewerModel, materials: MaterialRegistry) {
  const root = new THREE.Group();
  root.name = 'ARCHITECTURAL-DETAILS-PHASE-1';
  root.userData = {
    visualOnly: true,
    collisionExcluded: true,
    realismPriority: model.viewerPresentation.realismPriority,
  };
  const reduced = group('quality:reduced:architectural-envelope', 'reduced');
  const full = group('quality:full:architectural-envelope', 'full');
  const service = model.geometry.l1.serviceWingBounds;
  const wallHeight = model.geometry.l2.baseElevation - 0.18;

  addConcretePanelJoints(reduced, service.x1, service.x2, 0, wallHeight, -0.012, materials);
  addConcretePanelJoints(reduced, service.x1, service.x2, model.geometry.site.width, wallHeight, 0.012, materials);
  addConcreteTieHoles(full, service.x1, service.x2, 0, wallHeight, -0.024, materials);
  addConcreteTieHoles(full, service.x1, service.x2, model.geometry.site.width, wallHeight, 0.024, materials);

  const frame = materials.get('canopy-frame');
  const deckElevation = model.geometry.pool.deckElevation.value;
  reduced.add(
    box([30.5, 0.075, 0.08], [15.75, deckElevation + 0.055, -0.035], frame),
    box([30.5, 0.075, 0.08], [15.75, deckElevation + 0.055, model.geometry.site.width + 0.035], frame),
  );
  for (let x = 0.5; x <= 30.5; x += 2.5) {
    reduced.add(
      box([0.055, 0.14, 0.095], [x, deckElevation + 0.09, -0.04], frame),
      box([0.055, 0.14, 0.095], [x, deckElevation + 0.09, model.geometry.site.width + 0.04], frame),
    );
  }

  const roof = model.geometry.roof;
  const gutterMaterial = materials.get('sanitary-metal');
  reduced.add(
    box([0.32, 0.18, roof.width], [roof.startX - 0.1, roof.lowElevation - 0.08, roof.width / 2], gutterMaterial),
    box([0.16, roof.lowElevation - 0.28, 0.16], [roof.startX - 0.15, (roof.lowElevation - 0.28) / 2, 0.35], gutterMaterial),
    box([0.16, roof.lowElevation - 0.28, 0.16], [roof.startX - 0.15, (roof.lowElevation - 0.28) / 2, roof.width - 0.35], gutterMaterial),
    box([0.22, 0.12, roof.width], [roof.endX + 0.04, roof.highElevation + 0.04, roof.width / 2], materials.get('canopy-frame')),
  );

  const gasket = materials.get('sanitary-dark');
  for (const x of [0.5, 3, 8, 13, 18, 23, 28, 31]) {
    const height = roof.lowElevation
      + (roof.highElevation - roof.lowElevation) * ((Math.min(x, roof.endX) - roof.startX) / roof.planRun)
      - deckElevation;
    reduced.add(box([0.028, Math.max(0.4, height), 0.028], [x, deckElevation + Math.max(0.4, height) / 2, -0.052], gasket));
  }

  const sealant = materials.get('interior-grout');
  full.add(
    box([service.x2 - service.x1, 0.035, 0.04], [(service.x1 + service.x2) / 2, 0.035, -0.055], sealant),
    box([service.x2 - service.x1, 0.035, 0.04], [(service.x1 + service.x2) / 2, 0.035, model.geometry.site.width + 0.055], sealant),
  );
  root.add(reduced, full);
  root.traverse((object) => {
    object.userData.visualOnly = true;
    object.userData.collisionExcluded = true;
  });
  return root;
}
