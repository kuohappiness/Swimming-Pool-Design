import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type {
  ToiletFixtureFacing,
  ViewerModel,
  ViewerToiletCubicle,
  ViewerZone,
} from './model-adapter';
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

interface MergedPart {
  readonly geometry: THREE.BufferGeometry;
  readonly position: [number, number, number];
  readonly rotation?: [number, number, number];
  readonly scale?: [number, number, number];
}

function mergedMesh(parts: readonly MergedPart[], material: THREE.Material) {
  const geometries = parts.map(({ geometry, position, rotation, scale }) => {
    geometry.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rotation ?? [0, 0, 0]))),
      new THREE.Vector3(...(scale ?? [1, 1, 1])),
    ));
    return geometry;
  });
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new TypeError('Sanitary fixture geometry could not be merged.');
  return new THREE.Mesh(merged, material);
}

function detailGroup(
  name: string,
  level: 'essential' | 'reduced' | 'full',
  castVisualShadow = false,
) {
  const group = markVisualDetail(new THREE.Group(), level);
  group.name = name;
  group.userData.castVisualShadow = castVisualShadow;
  return group;
}

function tagFixture(
  group: THREE.Group,
  zone: ViewerZone,
  fixtureKind: string,
  index: number,
) {
  group.name = `visual-only:${zone.entityId}:${fixtureKind}:${index + 1}`;
  group.userData = {
    ...group.userData,
    visualOnly: true,
    collisionExcluded: true,
    zoneEntityId: zone.entityId,
    fixtureKind,
    fixtureIndex: index,
  };
  group.traverse((object) => {
    object.userData.visualOnly = true;
    object.userData.collisionExcluded = true;
    object.userData.zoneEntityId = zone.entityId;
  });
}

function facingRotation(facing: string) {
  if (facing === 'positive-y') return 0;
  if (facing === 'negative-y') return Math.PI;
  if (facing === 'positive-x') return Math.PI / 2;
  if (facing === 'negative-x') return -Math.PI / 2;
  throw new TypeError(`Unsupported sanitary fixture facing: ${facing}`);
}

function createSeatedToilet(
  cubicle: ViewerToiletCubicle,
  floorElevation: number,
  materials: MaterialRegistry,
) {
  const group = new THREE.Group();
  group.position.set(cubicle.fixtureCenter[0], floorElevation, cubicle.fixtureCenter[1]);
  group.rotation.y = facingRotation(cubicle.fixtureFacing);
  group.userData.fixtureType = 'seated';
  group.userData.fixtureFacing = cubicle.fixtureFacing;

  const essential = detailGroup('quality:essential:seated-toilet-shell', 'essential', true);
  essential.add(mergedMesh([
    {
      geometry: new THREE.CylinderGeometry(0.17, 0.22, 0.34, 10),
      position: [0, 0.17, -0.02],
      scale: [1, 1, 1.28],
    },
    {
      geometry: new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
      position: [0, 0.38, 0.07],
      rotation: [Math.PI, 0, 0],
      scale: [1, 0.48, 1.28],
    },
  ], materials.get('sanitary-fixture')));
  const seat = new THREE.Mesh(
    new THREE.TorusGeometry(0.205, 0.034, 6, 16),
    materials.get('sanitary-seat'),
  );
  seat.position.set(0, 0.43, 0.08);
  seat.rotation.x = Math.PI / 2;
  seat.scale.z = 1.28;

  const reduced = detailGroup('quality:reduced:seated-toilet-tank', 'reduced', true);
  reduced.add(
    seat,
    box([0.42, 0.48, 0.18], [0, 0.52, -0.28], materials.get('sanitary-fixture')),
    box([0.46, 0.035, 0.21], [0, 0.78, -0.28], materials.get('sanitary-seat')),
  );
  const flushButton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.018, 12),
    materials.get('sanitary-metal'),
  );
  flushButton.rotation.x = Math.PI / 2;
  flushButton.position.set(0.12, 0.79, -0.28);
  reduced.add(flushButton);

  const full = detailGroup('quality:full:seated-toilet-hardware', 'full');
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(0.14, 20),
    materials.get('sanitary-dark'),
  );
  inner.position.set(0, 0.435, 0.08);
  inner.rotation.x = -Math.PI / 2;
  inner.scale.z = 1.22;
  const hardware = mergedMesh([
    {
      geometry: new THREE.CylinderGeometry(0.014, 0.014, 0.28, 8),
      position: [-0.19, 0.2, -0.31],
    },
    {
      geometry: new THREE.CylinderGeometry(0.024, 0.024, 0.055, 8),
      position: [-0.11, 0.47, -0.08],
      rotation: [0, 0, Math.PI / 2],
    },
    {
      geometry: new THREE.CylinderGeometry(0.024, 0.024, 0.055, 8),
      position: [0.11, 0.47, -0.08],
      rotation: [0, 0, Math.PI / 2],
    },
  ], materials.get('sanitary-metal'));
  full.add(inner, hardware);
  group.add(essential, reduced, full);
  return group;
}

function createSquatToilet(
  cubicle: ViewerToiletCubicle,
  floorElevation: number,
  materials: MaterialRegistry,
) {
  const group = new THREE.Group();
  group.position.set(cubicle.fixtureCenter[0], floorElevation, cubicle.fixtureCenter[1]);
  group.rotation.y = facingRotation(cubicle.fixtureFacing);
  group.userData.fixtureType = 'squat';
  group.userData.fixtureFacing = cubicle.fixtureFacing;

  const essential = detailGroup('quality:essential:squat-pan-shell', 'essential', true);
  const pan = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.23, 0.38, 4, 10),
    materials.get('sanitary-fixture'),
  );
  pan.rotation.x = Math.PI / 2;
  pan.scale.set(1, 1, 0.12);
  pan.position.set(0, 0.055, 0.03);
  const opening = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 18),
    materials.get('sanitary-dark'),
  );
  opening.rotation.x = -Math.PI / 2;
  opening.scale.z = 1.8;
  opening.position.set(0, 0.125, 0.08);
  essential.add(pan, opening);

  const reduced = detailGroup('quality:reduced:squat-pan-footpads', 'reduced');
  const padGeometry = new THREE.BoxGeometry(0.18, 0.035, 0.5);
  const pads = new THREE.InstancedMesh(padGeometry, materials.get('interior-tile'), 2);
  const grooveGeometry = new THREE.BoxGeometry(0.13, 0.012, 0.018);
  const groovePositions = [-0.16, -0.07, 0.02, 0.11, 0.2];
  const grooves = new THREE.InstancedMesh(
    grooveGeometry,
    materials.get('interior-grout'),
    groovePositions.length * 2,
  );
  const matrix = new THREE.Matrix4();
  for (const [xIndex, x] of [-0.3, 0.3].entries()) {
    matrix.makeTranslation(x, 0.045, 0.02);
    pads.setMatrixAt(xIndex, matrix);
    for (const [zIndex, z] of groovePositions.entries()) {
      matrix.makeTranslation(x, 0.068, z);
      grooves.setMatrixAt(xIndex * groovePositions.length + zIndex, matrix);
    }
  }
  reduced.add(pads, grooves);

  const full = detailGroup('quality:full:squat-pan-flush-hardware', 'full');
  full.add(mergedMesh([
    {
      geometry: new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8),
      position: [0, 0.24, -0.36],
    },
    {
      geometry: new THREE.CylinderGeometry(0.045, 0.045, 0.055, 10),
      position: [0, 0.38, -0.36],
      rotation: [Math.PI / 2, 0, 0],
    },
  ], materials.get('sanitary-metal')));
  group.add(essential, reduced, full);
  return group;
}

function createWashbasin(
  center: [number, number],
  facing: string,
  floorElevation: number,
  materials: MaterialRegistry,
) {
  const group = new THREE.Group();
  group.position.set(center[0], floorElevation, center[1]);
  group.rotation.y = facingRotation(facing);

  const essential = detailGroup('quality:essential:washbasin-shell', 'essential', true);
  essential.add(mergedMesh([
    {
      geometry: new THREE.CylinderGeometry(0.1, 0.15, 0.66, 10),
      position: [0, 0.35, 0.16],
    },
    {
      geometry: new THREE.CylinderGeometry(0.31, 0.22, 0.15, 14),
      position: [0, 0.74, 0.19],
      scale: [1, 1, 0.74],
    },
    {
      geometry: new THREE.TorusGeometry(0.29, 0.026, 6, 16),
      position: [0, 0.825, 0.19],
      rotation: [Math.PI / 2, 0, 0],
      scale: [1, 1, 0.74],
    },
  ], materials.get('sanitary-fixture')));

  const reduced = detailGroup('quality:reduced:washbasin-faucet-mirror', 'reduced');
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.235, 20), materials.get('sanitary-dark'));
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(0, 0.828, 0.2);
  inner.scale.z = 0.72;
  const spoutCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0.98, -0.01),
    new THREE.Vector3(0, 1.03, 0.11),
    new THREE.Vector3(0, 0.94, 0.16),
  );
  const tap = mergedMesh([
    {
      geometry: new THREE.CylinderGeometry(0.026, 0.032, 0.16, 10),
      position: [0, 0.91, -0.01],
    },
    {
      geometry: new THREE.TubeGeometry(spoutCurve, 10, 0.018, 6, false),
      position: [0, 0, 0],
    },
  ], materials.get('sanitary-metal'));
  const mirror = box([0.66, 0.55, 0.026], [0, 1.45, -0.025], materials.get('mirror'));
  reduced.add(inner, tap, mirror);

  const full = detailGroup('quality:full:washbasin-plumbing', 'full');
  full.add(mergedMesh([
    {
      geometry: new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10),
      position: [0, 0.838, 0.23],
    },
    {
      geometry: new THREE.CylinderGeometry(0.024, 0.024, 0.31, 8),
      position: [0, 0.49, 0.19],
    },
  ], materials.get('sanitary-metal')));
  group.add(essential, reduced, full);
  return group;
}

function createUrinal(
  center: [number, number],
  facing: string,
  floorElevation: number,
  materials: MaterialRegistry,
) {
  const group = new THREE.Group();
  group.position.set(center[0], floorElevation, center[1]);
  group.rotation.y = facingRotation(facing);

  const essential = detailGroup('quality:essential:urinal-shell', 'essential', true);
  essential.add(mergedMesh([
    {
      geometry: new THREE.BoxGeometry(0.38, 0.58, 0.1),
      position: [0, 0.66, -0.02],
    },
    {
      geometry: new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
      position: [0, 0.52, 0.12],
      rotation: [Math.PI, 0, 0],
      scale: [0.88, 1.15, 0.7],
    },
  ], materials.get('sanitary-fixture')));

  const reduced = detailGroup('quality:reduced:urinal-flush', 'reduced');
  reduced.add(mergedMesh([
    {
      geometry: new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8),
      position: [0, 1.03, -0.01],
    },
    {
      geometry: new THREE.CylinderGeometry(0.044, 0.044, 0.08, 10),
      position: [0, 1.14, -0.01],
      rotation: [Math.PI / 2, 0, 0],
    },
  ], materials.get('sanitary-metal')));

  const full = detailGroup('quality:full:urinal-sensor-drain', 'full');
  const sensor = box([0.045, 0.045, 0.015], [0, 1.16, 0.036], materials.get('sanitary-dark'));
  const drain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12),
    materials.get('sanitary-metal'),
  );
  drain.position.set(0, 0.42, 0.18);
  full.add(sensor, drain);
  group.add(essential, reduced, full);
  return group;
}

function addCubicle(
  target: THREE.Group,
  cubicle: ViewerToiletCubicle,
  floorElevation: number,
  materials: MaterialRegistry,
) {
  const { x1, x2, y1, y2 } = cubicle.planBounds;
  const panelBottom = floorElevation + 0.12;
  const panelHeight = 1.9;
  const panelCenterY = panelBottom + panelHeight / 2;
  const panelMaterial = materials.get('cubicle');
  const doorMaterial = materials.get('cubicle-door');
  const essential = detailGroup('quality:essential:wc-cubicle', 'essential');
  const doorAxis = cubicle.doorSide[0];
  const doorCoordinate = Number(cubicle.doorSide.slice(1));
  const panelParts: MergedPart[] = [
    {
      geometry: new THREE.BoxGeometry(0.045, panelHeight, y2 - y1),
      position: [x1, panelCenterY, (y1 + y2) / 2],
    },
    {
      geometry: new THREE.BoxGeometry(0.045, panelHeight, y2 - y1),
      position: [x2, panelCenterY, (y1 + y2) / 2],
    },
  ];
  let door: THREE.Mesh;
  if (doorAxis === 'y') {
    const backY = Math.abs(doorCoordinate - y1) < 1e-6 ? y2 : y1;
    panelParts.push({
      geometry: new THREE.BoxGeometry(x2 - x1, panelHeight, 0.045),
      position: [(x1 + x2) / 2, panelCenterY, backY],
    });
    const doorWidth = Math.min(0.72, x2 - x1 - 0.2);
    const sideWidth = ((x2 - x1) - doorWidth) / 2;
    panelParts.push(
      {
        geometry: new THREE.BoxGeometry(sideWidth, panelHeight, 0.045),
        position: [x1 + sideWidth / 2, panelCenterY, doorCoordinate],
      },
      {
        geometry: new THREE.BoxGeometry(sideWidth, panelHeight, 0.045),
        position: [x2 - sideWidth / 2, panelCenterY, doorCoordinate],
      },
    );
    door = box(
      [doorWidth, 1.76, 0.035],
      [(x1 + x2) / 2, floorElevation + 1.02, doorCoordinate],
      doorMaterial,
    );
  } else {
    const backX = Math.abs(doorCoordinate - x1) < 1e-6 ? x2 : x1;
    panelParts.push({
      geometry: new THREE.BoxGeometry(0.045, panelHeight, y2 - y1),
      position: [backX, panelCenterY, (y1 + y2) / 2],
    });
    const doorWidth = Math.min(0.72, y2 - y1 - 0.2);
    const sideWidth = ((y2 - y1) - doorWidth) / 2;
    panelParts.push(
      {
        geometry: new THREE.BoxGeometry(0.045, panelHeight, sideWidth),
        position: [doorCoordinate, panelCenterY, y1 + sideWidth / 2],
      },
      {
        geometry: new THREE.BoxGeometry(0.045, panelHeight, sideWidth),
        position: [doorCoordinate, panelCenterY, y2 - sideWidth / 2],
      },
    );
    door = box(
      [0.035, 1.76, doorWidth],
      [doorCoordinate, floorElevation + 1.02, (y1 + y2) / 2],
      doorMaterial,
    );
  }
  essential.add(mergedMesh(panelParts, panelMaterial), door);

  const reduced = detailGroup('quality:reduced:wc-cubicle-feet', 'reduced');
  const footGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.12, 8);
  const feet = new THREE.InstancedMesh(footGeometry, materials.get('sanitary-metal'), 4);
  const footMatrix = new THREE.Matrix4();
  for (const [index, [x, z]] of [[x1, y1], [x2, y1], [x1, y2], [x2, y2]].entries()) {
    footMatrix.makeTranslation(x, floorElevation + 0.06, z);
    feet.setMatrixAt(index, footMatrix);
  }
  reduced.add(feet);

  const full = detailGroup('quality:full:wc-cubicle-hardware', 'full');
  const doorCenterX = (x1 + x2) / 2;
  const doorCenterZ = (y1 + y2) / 2;
  if (doorAxis === 'y') {
    full.add(mergedMesh([
      {
        geometry: new THREE.BoxGeometry(0.06, 0.045, 0.025),
        position: [doorCenterX + 0.22, floorElevation + 1.05, doorCoordinate],
      },
      {
        geometry: new THREE.BoxGeometry(0.025, 0.12, 0.025),
        position: [doorCenterX - 0.31, floorElevation + 1.42, doorCoordinate],
      },
      {
        geometry: new THREE.BoxGeometry(0.025, 0.12, 0.025),
        position: [doorCenterX - 0.31, floorElevation + 0.65, doorCoordinate],
      },
    ], materials.get('sanitary-metal')));
  } else {
    full.add(mergedMesh([
      {
        geometry: new THREE.BoxGeometry(0.025, 0.045, 0.06),
        position: [doorCoordinate, floorElevation + 1.05, doorCenterZ + 0.22],
      },
      {
        geometry: new THREE.BoxGeometry(0.025, 0.12, 0.025),
        position: [doorCoordinate, floorElevation + 1.42, doorCenterZ - 0.31],
      },
      {
        geometry: new THREE.BoxGeometry(0.025, 0.12, 0.025),
        position: [doorCoordinate, floorElevation + 0.65, doorCenterZ - 0.31],
      },
    ], materials.get('sanitary-metal')));
  }
  target.add(essential, reduced, full);
}

function addRoomFinishDetails(
  target: THREE.Group,
  zone: ViewerZone,
  materials: MaterialRegistry,
) {
  const floorElevation = zone.floorElevation ?? 0;
  const { x1, x2, y1, y2 } = zone.bounds;
  const reduced = detailGroup(`quality:reduced:${zone.entityId}:tile-grid`, 'reduced');
  const xCount = Math.max(1, Math.floor((x2 - x1) / 0.5));
  const zCount = Math.max(1, Math.floor((y2 - y1) / 0.5));
  const matrix = new THREE.Matrix4();
  const xLines = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.012, 0.006, y2 - y1 - 0.08),
    materials.get('interior-grout'),
    xCount,
  );
  for (let index = 0; index < xCount; index += 1) {
    matrix.makeTranslation(x1 + (index + 1) * (x2 - x1) / (xCount + 1), floorElevation + 0.006, (y1 + y2) / 2);
    xLines.setMatrixAt(index, matrix);
  }
  const zLines = new THREE.InstancedMesh(
    new THREE.BoxGeometry(x2 - x1 - 0.08, 0.006, 0.012),
    materials.get('interior-grout'),
    zCount,
  );
  for (let index = 0; index < zCount; index += 1) {
    matrix.makeTranslation((x1 + x2) / 2, floorElevation + 0.006, y1 + (index + 1) * (y2 - y1) / (zCount + 1));
    zLines.setMatrixAt(index, matrix);
  }
  reduced.add(xLines, zLines);

  const drain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.012, 16),
    materials.get('sanitary-metal'),
  );
  drain.position.set(x2 - 0.32, floorElevation + 0.012, y2 - 0.32);
  reduced.add(drain);

  const full = detailGroup(`quality:full:${zone.entityId}:occupied-finish`, 'full');
  const wetPatch = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), materials.get('wet-surface'));
  wetPatch.rotation.x = -Math.PI / 2;
  wetPatch.scale.set(1.4, 0.65, 1);
  wetPatch.position.set((x1 + x2) / 2, floorElevation + 0.014, zone.entityId.includes('-M-') ? y1 + 0.85 : y2 - 0.85);
  const bin = box([0.26, 0.42, 0.24], [x2 - 0.25, floorElevation + 0.21, zone.entityId.includes('-M-') ? y1 + 0.3 : y2 - 0.3], materials.get('sanitary-dark'));
  const sign = box([0.32, 0.32, 0.022], [zone.entrySide === 'x31-only' ? x1 + 0.02 : x2 - 0.02, floorElevation + 1.72, (y1 + y2) / 2], materials.get('signage'));
  full.add(wetPatch, bin, sign);
  target.add(reduced, full);
}

export function createL1SanitaryDetails(model: ViewerModel, materials: MaterialRegistry) {
  const root = new THREE.Group();
  root.name = 'SANITARY-DETAILS-L1';
  root.userData = {
    visualOnly: true,
    collisionExcluded: true,
    occupancyAppearance: model.viewerPresentation.occupancyAppearance,
  };
  const zones = Object.values(model.geometry.l1.zones).filter(
    (candidate): candidate is ViewerZone & { layout: NonNullable<ViewerZone['layout']> } =>
      candidate.layout !== undefined,
  );
  for (const zone of zones) {
    const room = new THREE.Group();
    room.name = `visual-only:${zone.entityId}:sanitary-room`;
    room.userData = {
      visualOnly: true,
      collisionExcluded: true,
      zoneEntityId: zone.entityId,
    };
    const floorElevation = zone.floorElevation ?? 0;
    for (const [index, basin] of zone.layout.washbasins.entries()) {
      const fixture = createWashbasin(basin.center, basin.facing, floorElevation, materials);
      tagFixture(fixture, zone, 'washbasin', index);
      room.add(fixture);
    }
    for (const [index, urinal] of zone.layout.urinals.entries()) {
      const fixture = createUrinal(urinal.center, urinal.facing, floorElevation, materials);
      tagFixture(fixture, zone, 'urinal', index);
      room.add(fixture);
    }
    for (const [index, cubicle] of zone.layout.toiletCubicles.entries()) {
      addCubicle(room, cubicle, floorElevation, materials);
      const fixture = cubicle.fixtureType === 'seated'
        ? createSeatedToilet(cubicle, floorElevation, materials)
        : createSquatToilet(cubicle, floorElevation, materials);
      tagFixture(fixture, zone, cubicle.fixtureType, index);
      room.add(fixture);
    }
    addRoomFinishDetails(room, zone, materials);
    root.add(room);
  }
  root.traverse((object) => {
    object.userData.visualOnly = true;
    object.userData.collisionExcluded = true;
  });
  return root;
}
