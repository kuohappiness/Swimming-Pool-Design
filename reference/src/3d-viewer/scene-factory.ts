import * as THREE from 'three';
import type { DesignStatus, ViewerModel } from './model-adapter';

export interface SelectableInfo {
  object: THREE.Object3D;
  entityId: string;
  label: string;
  status: DesignStatus;
  description: string;
  openItemId?: string;
}

export interface ViewerSceneGraph {
  scene: THREE.Scene;
  worldRoot: THREE.Group;
  layerGroups: Map<string, THREE.Group>;
  selectables: SelectableInfo[];
  lights: { sun: THREE.DirectionalLight; ambient: THREE.HemisphereLight };
}

const PALETTE = {
  original: 0xc6c0b5,
  newWork: 0xd47c57,
  confirmed: 0x4f8197,
  water: 0x4ba7bd,
  roof: 0x9bd4d9,
  stair: 0x323941,
  deferred: 0x9c7fc2,
  ground: 0xeeeae0,
};

function box(size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function tag(
  object: THREE.Object3D,
  info: Omit<SelectableInfo, 'object'>,
  selectables: SelectableInfo[],
) {
  object.userData = { ...object.userData, ...info, selectable: true };
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.userData = { ...child.userData, ...info, selectable: true, selectionOwner: object };
    }
  });
  selectables.push({ object, ...info });
}

function quad(vertices: number[], material: THREE.Material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createViewerScene(model: ViewerModel): ViewerSceneGraph {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef0);
  scene.fog = new THREE.Fog(0xe9eef0, 65, 135);

  const ambient = new THREE.HemisphereLight(0xeaf6ff, 0x756b58, 2.2);
  const sun = new THREE.DirectionalLight(0xfff0d3, 3.4);
  sun.position.set(-18, 32, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(ambient, sun);

  const building = model.geometry.building;
  const centreX = building.length.value / 2;
  const centreZ = building.width.value / 2;
  const worldRoot = new THREE.Group();
  worldRoot.name = 'WORLD-BEARING-ROOT';
  worldRoot.rotation.y = THREE.MathUtils.degToRad(-model.referenceSystem.localLongAxisBearingFromTrueNorth);
  scene.add(worldRoot);

  const localRoot = new THREE.Group();
  localRoot.position.set(-centreX, 0, -centreZ);
  worldRoot.add(localRoot);
  const layerGroups = new Map<string, THREE.Group>();
  for (const layer of model.layers) {
    const group = new THREE.Group();
    group.name = `layer:${layer.id}`;
    group.userData.layerId = layer.id;
    localRoot.add(group);
    layerGroups.set(layer.id, group);
  }
  const layer = (id: string) => {
    const group = layerGroups.get(id);
    if (!group) throw new TypeError(`Viewer layer does not exist: ${id}`);
    return group;
  };
  const selectables: SelectableInfo[] = [];

  const matte = new THREE.MeshStandardMaterial({ color: PALETTE.original, roughness: 0.82, metalness: 0.02 });
  const work = new THREE.MeshStandardMaterial({ color: PALETTE.newWork, roughness: 0.72, metalness: 0.04 });
  const dark = new THREE.MeshStandardMaterial({ color: PALETTE.stair, roughness: 0.58, metalness: 0.28 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: PALETTE.roof, transparent: true, opacity: 0.38, roughness: 0.16, metalness: 0,
    transmission: 0.25, side: THREE.DoubleSide, depthWrite: false,
  });
  const water = new THREE.MeshPhysicalMaterial({
    color: PALETTE.water, transparent: true, opacity: 0.72, roughness: 0.18, metalness: 0.02,
  });
  const mirror = new THREE.MeshPhysicalMaterial({
    color: 0xb7d2da, roughness: 0.08, metalness: 0.75, side: THREE.DoubleSide,
  });

  const ground = box(
    [building.length.value + 12, 0.24, building.width.value + 12],
    [building.length.value / 2, -0.2, building.width.value / 2],
    new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }),
  );
  ground.receiveShadow = true;
  layer('original').add(ground);

  const serviceStart = building.poolHallLength.value;
  const core = box(
    [building.serviceCoreLength.value, model.geometry.l2.baseElevation, building.width.value],
    [serviceStart + building.serviceCoreLength.value / 2, model.geometry.l2.baseElevation / 2, building.width.value / 2],
    matte,
  );
  layer('original').add(core);
  tag(core, {
    entityId: 'CORE-01', label: '原服務核心', status: 'working',
    description: '原廁所基地上的服務核心工作量體。',
  }, selectables);

  const floor = box(
    [building.poolHallLength.value, 0.18, building.width.value],
    [building.poolHallLength.value / 2, -0.02, building.width.value / 2],
    matte,
  );
  layer('original').add(floor);

  const glassWallMaterial = glass.clone();
  glassWallMaterial.opacity = 0.28;
  const wallHeight = model.geometry.roof.farWallElevation;
  for (const z of [0.04, building.width.value - 0.04]) {
    const longWall = box(
      [building.poolHallLength.value, wallHeight, 0.08],
      [building.poolHallLength.value / 2, wallHeight / 2, z],
      glassWallMaterial,
    );
    layer('original').add(longWall);
  }
  const endWall = box([0.08, wallHeight, building.width.value], [0.04, wallHeight / 2, centreZ], glassWallMaterial);
  layer('original').add(endWall);

  const pool = model.geometry.pool;
  const poolGroup = new THREE.Group();
  const basinDepth = pool.deepDepth.value;
  const basin = box(
    [pool.length.value + 0.35, basinDepth, pool.width.value + 0.35],
    [pool.origin[0] + pool.length.value / 2, -basinDepth / 2, pool.origin[1] + pool.width.value / 2],
    new THREE.MeshStandardMaterial({ color: 0xd7e2df, roughness: 0.7 }),
  );
  const surface = box(
    [pool.length.value, 0.08, pool.width.value],
    [pool.origin[0] + pool.length.value / 2, 0.02, pool.origin[1] + pool.width.value / 2],
    water,
  );
  poolGroup.add(basin, surface);
  for (let laneIndex = 1; laneIndex < pool.laneCount; laneIndex += 1) {
    const z = pool.origin[1] + pool.width.value * laneIndex / pool.laneCount;
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pool.origin[0], 0.08, z),
      new THREE.Vector3(pool.origin[0] + pool.length.value, 0.08, z),
    ]);
    poolGroup.add(new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xf7f5df })));
  }
  layer('water').add(poolGroup);
  tag(poolGroup, {
    entityId: 'POOL-01', label: '三水道主泳池', status: 'working',
    description: `${pool.length.value} × ${pool.width.value} m 工作池體；深度 ${pool.shallowDepth.value}–${pool.deepDepth.value} m。`,
  }, selectables);

  const l2 = model.geometry.l2;
  const l2RotationGroup = new THREE.Group();
  l2RotationGroup.name = 'L2-PLAN-ROTATION';
  l2RotationGroup.position.set(l2.planPivot.x, l2.planPivot.z, l2.planPivot.y);
  l2RotationGroup.rotation.y = THREE.MathUtils.degToRad(-l2.planRotation.value);
  layer('new').add(l2RotationGroup);
  const l2Volume = box(
    [l2.length, l2.volumeHeight.value, l2.width],
    [(l2.startX + l2.endX) / 2 - l2.planPivot.x, l2.volumeHeight.value / 2, centreZ - l2.planPivot.y],
    work,
  );
  l2RotationGroup.add(l2Volume);
  tag(l2Volume, {
    entityId: 'EXT-L2-01', label: '2F 旋轉量體', status: 'working',
    description: `以工作支點水平旋轉 ${l2.planRotation.value.toFixed(1)}°；量體高度為視覺工作值。`,
    openItemId: l2.planPivot.openItemId,
  }, selectables);

  const mirrorHeight = model.geometry.mirror.visualWallHeight.value;
  const leanOffset = Math.tan(THREE.MathUtils.degToRad(model.geometry.mirror.leanFromVertical.value)) * mirrorHeight;
  const mirrorMesh = quad([
    -leanOffset, mirrorHeight, -centreZ,
    -leanOffset, mirrorHeight, centreZ,
    0, 0, centreZ,
    0, 0, -centreZ,
  ], mirror);
  l2RotationGroup.add(mirrorMesh);
  tag(mirrorMesh, {
    entityId: model.geometry.mirror.entityId, label: '面池端鏡牆', status: 'working',
    description: `牆面外傾 ${model.geometry.mirror.leanFromVertical.value.toFixed(1)}°；完整牆高是 Viewer 視覺值，不等於能量分析有效鏡面。`,
    openItemId: model.geometry.mirror.openItemId,
  }, selectables);

  const roof = model.geometry.roof;
  const roofMesh = quad([
    roof.startX, roof.lowElevation, 0,
    roof.startX, roof.lowElevation, roof.width,
    roof.endX, roof.highElevation, roof.width,
    roof.endX, roof.highElevation, 0,
  ], glass);
  layer('roof').add(roofMesh);
  tag(roofMesh, {
    entityId: 'RF-GL-01', label: '單坡玻璃屋頂', status: 'confirmed',
    description: `${roof.pitch.value.toFixed(1)}°，高端 +${roof.highElevation.toFixed(3)} m，低端外挑 ${roof.lowOverhang.value} m。`,
  }, selectables);

  const stair = model.geometry.stair;
  const stairGroup = new THREE.Group();
  const riserHeight = stair.totalRise / stair.riserCount;
  const secondStart = stair.startX + stair.flightRun + stair.midLandingLength;
  const addFlight = (baseX: number, baseY: number) => {
    for (let index = 0; index < stair.risersPerRun; index += 1) {
      const stepHeight = riserHeight * (index + 1);
      const step = box(
        [stair.treadDepth, stepHeight, stair.width],
        [baseX + (index + 0.5) * stair.treadDepth, baseY + stepHeight / 2, stair.originY + stair.width / 2],
        dark,
      );
      stairGroup.add(step);
    }
  };
  addFlight(stair.startX, 0);
  addFlight(secondStart, stair.midLandingElevation);
  stairGroup.add(box(
    [stair.midLandingLength, 0.16, stair.width],
    [stair.startX + stair.flightRun + stair.midLandingLength / 2, stair.midLandingElevation, stair.originY + stair.width / 2],
    dark,
  ));
  layer('stair').add(stairGroup);
  tag(stairGroup, {
    entityId: stair.entityId, label: '懸浮雙跑樓梯', status: 'confirmed',
    description: `${stair.riserCount} 級高／${stair.treadsPerRun * 2} 踏面；弦幕材料與節點仍待確認。`,
    openItemId: stair.guardOpenItemId,
  }, selectables);

  const rainGroup = new THREE.Group();
  const rainMaterial = new THREE.LineBasicMaterial({ color: 0x568eaf, transparent: true, opacity: 0.62 });
  for (let index = 0; index <= 18; index += 1) {
    const z = roof.width * index / 18;
    rainGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(roof.startX, roof.lowElevation, z),
        new THREE.Vector3(roof.startX, 0.08, z),
      ]),
      rainMaterial,
    ));
  }
  const waterPath = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(roof.startX, 0.12, centreZ),
      new THREE.Vector3(2, 0.12, centreZ),
      new THREE.Vector3(serviceStart + 1.2, 0.12, centreZ),
    ]),
    new THREE.LineDashedMaterial({ color: PALETTE.deferred, dashSize: 0.45, gapSize: 0.3 }),
  );
  waterPath.computeLineDistances();
  rainGroup.add(waterPath);
  layer('rain').add(rainGroup);
  tag(rainGroup, {
    entityId: 'RC-RF-01', label: '被動雨簾與回用路徑', status: 'deferred',
    description: '只在降雨時形成；承接溝、容量、泵浦與施工尺度仍待專業精化。',
    openItemId: 'OPEN-014',
  }, selectables);

  const annotations = layer('annotations');
  const grid = new THREE.GridHelper(58, 29, 0x637179, 0xb8c0c2);
  grid.position.set(centreX, 0.015, centreZ);
  annotations.add(grid);
  const north = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(centreX, 0.2, centreZ), 8, 0x21323b, 1.2, 0.7);
  north.name = 'TRUE-NORTH';
  annotations.add(north);

  return { scene, worldRoot, layerGroups, selectables, lights: { sun, ambient } };
}
