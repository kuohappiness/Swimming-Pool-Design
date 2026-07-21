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
  existing: 0xb9b2a6,
  l1: 0xd9d1c2,
  l2: 0xd88761,
  l3: 0xb36159,
  water: 0x3c9eb8,
  roof: 0x9bd4d9,
  stair: 0x303b42,
  deferred: 0x8b65a7,
  confirmed: 0x397d8f,
  ground: 0xe8e4da,
  planting: 0x829f77,
};

function box(size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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

function line(points: THREE.Vector3[], material: THREE.Material) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function tag(object: THREE.Object3D, info: Omit<SelectableInfo, 'object'>, selectables: SelectableInfo[]) {
  object.userData = { ...object.userData, ...info, selectable: true };
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.userData = { ...child.userData, ...info, selectable: true, selectionOwner: object };
    }
  });
  selectables.push({ object, ...info });
}

function addWallSegments(
  group: THREE.Group,
  spans: Array<[number, number]>,
  z: number,
  height: number,
  material: THREE.Material,
) {
  for (const [start, end] of spans) {
    group.add(box([end - start, height, 0.14], [(start + end) / 2, height / 2, z], material));
  }
}

export function createViewerScene(model: ViewerModel): ViewerSceneGraph {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef0);
  scene.fog = new THREE.Fog(0xe9eef0, 72, 150);

  const ambient = new THREE.HemisphereLight(0xeaf6ff, 0x756b58, 2.25);
  const sun = new THREE.DirectionalLight(0xfff0d3, 3.5);
  sun.position.set(-24, 34, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(ambient, sun);

  const building = model.geometry.building;
  const buildingLength = building.length.value;
  const buildingWidth = building.width.value;
  const centreX = buildingLength / 2;
  const centreZ = buildingWidth / 2;
  const worldRoot = new THREE.Group();
  worldRoot.name = 'WORLD-BEARING-ROOT';
  worldRoot.rotation.y = THREE.MathUtils.degToRad(-model.referenceSystem.localLongAxisBearingFromTrueNorth);
  scene.add(worldRoot);

  const localRoot = new THREE.Group();
  localRoot.position.set(-centreX, 0, -centreZ);
  worldRoot.add(localRoot);
  const layerGroups = new Map<string, THREE.Group>();
  for (const modelLayer of model.layers) {
    const group = new THREE.Group();
    group.name = `layer:${modelLayer.id}`;
    group.userData.layerId = modelLayer.id;
    localRoot.add(group);
    layerGroups.set(modelLayer.id, group);
  }
  const layer = (id: string) => {
    const group = layerGroups.get(id);
    if (!group) throw new TypeError(`Viewer layer does not exist: ${id}`);
    return group;
  };
  const selectables: SelectableInfo[] = [];

  const groundMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 });
  const siteMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.planting, roughness: 1 });
  const l1Material = new THREE.MeshStandardMaterial({ color: PALETTE.l1, roughness: 0.82 });
  const l2Material = new THREE.MeshStandardMaterial({ color: PALETTE.l2, roughness: 0.7 });
  const l3Material = new THREE.MeshStandardMaterial({ color: PALETTE.l3, roughness: 0.66 });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xb87938, roughness: 0.58, transparent: true, opacity: 0.36, depthWrite: false,
  });
  const dark = new THREE.MeshStandardMaterial({ color: PALETTE.stair, roughness: 0.54, metalness: 0.24 });
  const deferred = new THREE.MeshStandardMaterial({
    color: PALETTE.deferred, roughness: 0.55, transparent: true, opacity: 0.68,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: PALETTE.roof, transparent: true, opacity: 0.34, roughness: 0.16,
    metalness: 0, transmission: 0.3, side: THREE.DoubleSide, depthWrite: false,
  });
  const wallGlass = glass.clone();
  wallGlass.opacity = 0.2;
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: PALETTE.water, transparent: true, opacity: 0.68, roughness: 0.16,
    metalness: 0.03, transmission: 0.18, side: THREE.DoubleSide, depthWrite: false,
  });
  const basinMaterial = new THREE.MeshStandardMaterial({ color: 0xd3e1df, roughness: 0.7, side: THREE.DoubleSide });
  const mirrorMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc1d7dc, roughness: 0.06, metalness: 0.86, side: THREE.DoubleSide,
  });

  const site = layer('site');
  const ground = box(
    [buildingLength + building.leftSetback.value + 12, 0.2, buildingWidth + 12],
    [(buildingLength - building.leftSetback.value) / 2, -0.18, centreZ],
    groundMaterial,
  );
  ground.receiveShadow = true;
  site.add(ground);
  const setback = box(
    [building.leftSetback.value, 0.07, buildingWidth],
    [-building.leftSetback.value / 2, 0.005, centreZ],
    siteMaterial,
  );
  site.add(setback);
  const boundary = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-building.leftSetback.value, 0.04, 0),
      new THREE.Vector3(buildingLength, 0.04, 0),
      new THREE.Vector3(buildingLength, 0.04, buildingWidth),
      new THREE.Vector3(-building.leftSetback.value, 0.04, buildingWidth),
    ]),
    new THREE.LineDashedMaterial({ color: 0x72858c, dashSize: 0.55, gapSize: 0.35 }),
  );
  boundary.computeLineDistances();
  site.add(boundary);
  tag(setback, {
    entityId: 'SITE-SETBACK-01', label: '左端 2 m 退縮', status: 'confirmed',
    description: '原基地邊界內退 2.0 m，保留雨簾、回收溝與視覺緩衝；細部排水仍待專業驗證。',
    openItemId: 'OPEN-014',
  }, selectables);

  const l1 = layer('l1');
  const coreData = model.geometry.l1.core;
  const fixedCore = box(
    [coreData.length, model.geometry.l3.baseElevation, coreData.width],
    [coreData.x + coreData.length / 2, model.geometry.l3.baseElevation / 2, coreData.y + coreData.width / 2],
    coreMaterial,
  );
  layer('circulation').add(fixedCore);
  tag(fixedCore, {
    entityId: 'CORE-01', label: '固定結構／機電核心候選', status: 'working',
    description: '以 X=35 m 附近幾何中心作三層固定核心代理；現況會占用 L1 廁所與戶外區分界，房間、柱網與逃生梯仍須重排。',
    openItemId: coreData.openItemId,
  }, selectables);

  const serviceStart = building.poolHallLength.value;
  const serviceEnd = buildingLength;
  const serviceFloor = box(
    [building.serviceCoreLength.value, 0.18, buildingWidth],
    [(serviceStart + serviceEnd) / 2, -0.09, centreZ],
    l1Material,
  );
  l1.add(serviceFloor);
  const outdoorFloor = box(
    [building.serviceCoreLength.value, 0.06, model.geometry.l1.outdoorDepth],
    [(serviceStart + serviceEnd) / 2, 0.03, model.geometry.l1.outdoorDepth / 2],
    new THREE.MeshStandardMaterial({ color: 0xc9b996, roughness: 0.95 }),
  );
  l1.add(outdoorFloor);
  const wallHeight = model.geometry.l2.baseElevation - 0.18;
  l1.add(box([0.16, wallHeight, buildingWidth], [serviceEnd - 0.08, wallHeight / 2, centreZ], l1Material));
  l1.add(box([building.serviceCoreLength.value, wallHeight, 0.16], [(serviceStart + serviceEnd) / 2, wallHeight / 2, buildingWidth - 0.08], l1Material));
  l1.add(box([0.16, wallHeight, model.geometry.l1.outdoorDepth], [serviceStart + 0.08, wallHeight / 2, model.geometry.l1.outdoorDepth / 2], l1Material));
  addWallSegments(l1, [[serviceStart, 34.2], [35.3, 37], [38.1, 39.5], [40.6, serviceEnd]], model.geometry.l1.outdoorDepth, wallHeight, l1Material);
  const passageY = buildingWidth - model.geometry.l1.dryPassageDepth;
  addWallSegments(l1, [[serviceStart, 34.4], [35.5, 37], [38.1, 39.6], [40.7, serviceEnd]], passageY, wallHeight, l1Material);
  l1.add(box([0.14, wallHeight, passageY - model.geometry.l1.outdoorDepth], [37, wallHeight / 2, (passageY + model.geometry.l1.outdoorDepth) / 2], l1Material));
  tag(serviceFloor, {
    entityId: 'L1-SERVICE-01', label: '1F 廁所／戶外服務翼', status: 'working',
    description: '8.0 × 14.0 m 工作外框：7 m 戶外區不接泳池大廳，7 m 廁所帶含池側乾式走道；雙向開口拓撲已表達，精確房間仍待確認。',
    openItemId: 'OPEN-008',
  }, selectables);

  const pool = model.geometry.pool;
  const deckElevation = pool.deckElevation.value;
  const poolX0 = pool.origin[0];
  const poolX1 = poolX0 + pool.length.value;
  const poolZ0 = pool.origin[1];
  const poolZ1 = poolZ0 + pool.width.value;
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.88 });
  const deckGroup = new THREE.Group();
  const deckThickness = deckElevation;
  deckGroup.add(
    box([poolX0, deckThickness, buildingWidth], [poolX0 / 2, deckElevation / 2, centreZ], deckMaterial),
    box([serviceStart - poolX1, deckThickness, buildingWidth], [(poolX1 + serviceStart) / 2, deckElevation / 2, centreZ], deckMaterial),
    box([pool.length.value, deckThickness, poolZ0], [(poolX0 + poolX1) / 2, deckElevation / 2, poolZ0 / 2], deckMaterial),
    box([pool.length.value, deckThickness, buildingWidth - poolZ1], [(poolX0 + poolX1) / 2, deckElevation / 2, (poolZ1 + buildingWidth) / 2], deckMaterial),
  );
  l1.add(deckGroup);
  tag(deckGroup, {
    entityId: 'DECK-L1-01', label: '抬高池畔完成面', status: 'confirmed',
    description: `池畔完成面 +${deckElevation.toFixed(2)} m，幾何已保留 POOL-01 開口；與 L1 服務翼 +0.00 m 的門檻、防水、溢流與坡道仍待深化。`,
    openItemId: 'OPEN-016',
  }, selectables);
  const thresholdRamp = quad([
    serviceStart - 0.9, deckElevation + 0.015, 11.05,
    serviceStart - 0.9, deckElevation + 0.015, 12.25,
    serviceStart, 0.015, 12.25,
    serviceStart, 0.015, 11.05,
  ], deferred);
  l1.add(thresholdRamp);
  tag(thresholdRamp, {
    entityId: 'J-L1-DECK-01', label: '池畔／服務層高差轉接', status: 'deferred',
    description: '僅以工作坡面提示 0.30 m 高差；不得視為已核定無障礙坡道、門檻或排水細部。',
    openItemId: 'OPEN-016',
  }, selectables);

  const poolGroup = new THREE.Group();
  const waterLevel = deckElevation - 0.08;
  const shallowBottom = waterLevel - pool.shallowDepth.value;
  const deepBottom = waterLevel - pool.deepDepth.value;
  poolGroup.add(quad([
    poolX0, shallowBottom, poolZ0,
    poolX0, shallowBottom, poolZ1,
    poolX1, deepBottom, poolZ1,
    poolX1, deepBottom, poolZ0,
  ], basinMaterial));
  poolGroup.add(quad([
    poolX0, shallowBottom, poolZ0,
    poolX1, deepBottom, poolZ0,
    poolX1, waterLevel, poolZ0,
    poolX0, waterLevel, poolZ0,
  ], basinMaterial));
  poolGroup.add(quad([
    poolX0, waterLevel, poolZ1,
    poolX1, waterLevel, poolZ1,
    poolX1, deepBottom, poolZ1,
    poolX0, shallowBottom, poolZ1,
  ], basinMaterial));
  poolGroup.add(quad([
    poolX0, shallowBottom, poolZ1,
    poolX0, shallowBottom, poolZ0,
    poolX0, waterLevel, poolZ0,
    poolX0, waterLevel, poolZ1,
  ], basinMaterial));
  poolGroup.add(quad([
    poolX1, deepBottom, poolZ0,
    poolX1, deepBottom, poolZ1,
    poolX1, waterLevel, poolZ1,
    poolX1, waterLevel, poolZ0,
  ], basinMaterial));
  poolGroup.add(quad([
    poolX0, waterLevel, poolZ0,
    poolX1, waterLevel, poolZ0,
    poolX1, waterLevel, poolZ1,
    poolX0, waterLevel, poolZ1,
  ], waterMaterial));
  for (let laneIndex = 1; laneIndex < pool.laneCount; laneIndex += 1) {
    const z = poolZ0 + pool.width.value * laneIndex / pool.laneCount;
    poolGroup.add(line([
      new THREE.Vector3(poolX0, waterLevel + 0.025, z),
      new THREE.Vector3(poolX1, waterLevel + 0.025, z),
    ], new THREE.LineBasicMaterial({ color: 0xf7f5df })));
  }
  const coping = 0.22;
  poolGroup.add(
    box([pool.length.value + coping * 2, 0.07, coping], [(poolX0 + poolX1) / 2, deckElevation + 0.02, poolZ0 - coping / 2], deckMaterial),
    box([pool.length.value + coping * 2, 0.07, coping], [(poolX0 + poolX1) / 2, deckElevation + 0.02, poolZ1 + coping / 2], deckMaterial),
    box([coping, 0.07, pool.width.value], [poolX0 - coping / 2, deckElevation + 0.02, (poolZ0 + poolZ1) / 2], deckMaterial),
    box([coping, 0.07, pool.width.value], [poolX1 + coping / 2, deckElevation + 0.02, (poolZ0 + poolZ1) / 2], deckMaterial),
  );
  layer('water').add(poolGroup);
  tag(poolGroup, {
    entityId: 'POOL-01', label: '三水道主泳池', status: 'confirmed',
    description: `${pool.length.value} × ${pool.width.value} m；左側低 X 端水深 ${pool.shallowDepth.value} m，向右側服務量體端降至 ${pool.deepDepth.value} m。`,
  }, selectables);

  const roof = model.geometry.roof;
  const roofHeightAt = (x: number) => roof.lowElevation
    + (roof.highElevation - roof.lowElevation) * ((x - roof.startX) / roof.planRun);
  for (const z of [0.03, buildingWidth - 0.03]) {
    const longWall = quad([
      roof.startX, deckElevation, z,
      roof.startX, roof.lowElevation, z,
      roof.endX, roof.highElevation, z,
      roof.endX, deckElevation, z,
    ], wallGlass);
    l1.add(longWall);
  }
  l1.add(quad([
    roof.startX, deckElevation, 0,
    roof.startX, roof.lowElevation, 0,
    roof.startX, roof.lowElevation, buildingWidth,
    roof.startX, deckElevation, buildingWidth,
  ], wallGlass));
  for (let x = roof.startX; x <= roof.endX + 0.01; x += roof.planRun / 5) {
    const height = roofHeightAt(Math.min(x, roof.endX)) - deckElevation;
    for (const z of [0.08, buildingWidth - 0.08]) {
      l1.add(box([0.13, height, 0.13], [Math.min(x, roof.endX), deckElevation + height / 2, z], dark));
    }
  }

  const l2Data = model.geometry.l2;
  const l2Group = new THREE.Group();
  const upperCentreZ = centreZ;
  const slabThickness = 0.24;
  const l2Slab = box(
    [l2Data.length, slabThickness, l2Data.width],
    [(l2Data.startX + l2Data.endX) / 2, l2Data.baseElevation - slabThickness / 2, upperCentreZ],
    l2Material,
  );
  l2Group.add(l2Slab);
  const l2WallHeight = l2Data.topElevation - l2Data.baseElevation - 0.28;
  l2Group.add(
    box([0.18, l2WallHeight, l2Data.width], [l2Data.endX - 0.09, l2Data.baseElevation + l2WallHeight / 2, upperCentreZ], l2Material),
    box([l2Data.length, l2WallHeight, 0.14], [(l2Data.startX + l2Data.endX) / 2, l2Data.baseElevation + l2WallHeight / 2, centreZ - l2Data.width / 2 + 0.07], wallGlass),
    box([l2Data.length, l2WallHeight, 0.14], [(l2Data.startX + l2Data.endX) / 2, l2Data.baseElevation + l2WallHeight / 2, centreZ + l2Data.width / 2 - 0.07], wallGlass),
    box([0.14, l2WallHeight, l2Data.width], [serviceStart + 0.07, l2Data.baseElevation + l2WallHeight / 2, upperCentreZ], l2Material),
    box([serviceEnd - serviceStart, l2WallHeight, 0.14], [(serviceStart + serviceEnd) / 2, l2Data.baseElevation + l2WallHeight / 2, centreZ], l2Material),
  );
  layer('l2').add(l2Group);
  tag(l2Group, {
    entityId: 'EXT-L2-01', label: '2F 固定更衣／淋浴層', status: 'working',
    description: `固定正交樓板 ${l2Data.length.toFixed(1)} × ${l2Data.width.toFixed(1)} m，標高 +${l2Data.baseElevation.toFixed(2)} m；4 m 伸入泳池挑高區。男女分區、除濕與排水豎井仍待深化。`,
    openItemId: 'OPEN-016',
  }, selectables);

  const l3Data = model.geometry.l3;
  const l3RotationGroup = new THREE.Group();
  l3RotationGroup.name = 'L3-PLAN-ROTATION';
  l3RotationGroup.position.set(l3Data.planPivot.x, l3Data.baseElevation, l3Data.planPivot.y);
  l3RotationGroup.rotation.y = THREE.MathUtils.degToRad(-l3Data.planRotation.value);
  const l3Slab = box([l3Data.length, slabThickness, l3Data.width], [0, -slabThickness / 2, 0], l3Material);
  l3RotationGroup.add(l3Slab);
  const l3Height = l3Data.volumeHeight.value;
  const halfL3X = l3Data.length / 2;
  const halfL3Z = l3Data.width / 2;
  l3RotationGroup.add(
    box([0.18, l3Height, l3Data.width], [halfL3X - 0.09, l3Height / 2, 0], l3Material),
    box([l3Data.length, l3Height, 0.16], [0, l3Height / 2, -halfL3Z + 0.08], l3Material),
    box([l3Data.length, l3Height, 0.16], [0, l3Height / 2, halfL3Z - 0.08], l3Material),
    box([0.12, l3Height * 0.78, l3Data.width * 0.62], [0, l3Height * 0.39, 0], l3Material),
    box([l3Data.length * 0.62, l3Height * 0.78, 0.12], [0.8, l3Height * 0.39, 1.6], l3Material),
  );
  layer('l3').add(l3RotationGroup);
  tag(l3Slab, {
    entityId: 'EXT-L3-01', label: '3F 旋轉服務／景觀層', status: 'working',
    description: `同面積 ${l3Data.length.toFixed(1)} × ${l3Data.width.toFixed(1)} m 樓板，繞 X=${l3Data.planPivot.x.toFixed(1)}／Y=${l3Data.planPivot.y.toFixed(2)} 順時針旋轉 ${l3Data.planRotation.value.toFixed(1)}°；外挑與轉換構架仍待結構驗證。`,
    openItemId: l3Data.planPivot.openItemId,
  }, selectables);

  const mirrorHeight = l3Data.mirror.height.value;
  const leanOffset = Math.tan(THREE.MathUtils.degToRad(l3Data.mirror.leanFromVertical.value)) * mirrorHeight;
  const mirrorBacking = quad([
    -halfL3X - leanOffset, mirrorHeight, -halfL3Z,
    -halfL3X - leanOffset, mirrorHeight, halfL3Z,
    -halfL3X, 0, halfL3Z,
    -halfL3X, 0, -halfL3Z,
  ], l3Material);
  const mirrorMesh = quad([
    -halfL3X - leanOffset - 0.012, mirrorHeight, -halfL3Z,
    -halfL3X - leanOffset - 0.012, mirrorHeight, halfL3Z,
    -halfL3X - 0.012, 0, halfL3Z,
    -halfL3X - 0.012, 0, -halfL3Z,
  ], mirrorMaterial);
  l3RotationGroup.add(mirrorBacking, mirrorMesh);
  tag(mirrorMesh, {
    entityId: l3Data.mirror.entityId, label: 'L3 共面外傾鏡牆', status: 'working',
    description: `建築承載牆本體與原始鏡面覆層共同向池側外傾 ${l3Data.mirror.leanFromVertical.value.toFixed(1)}°；0.012 m 僅為避免畫面閃爍的顯示偏移。`,
    openItemId: l3Data.mirror.openItemId,
  }, selectables);

  const equipmentMaterial = new THREE.MeshStandardMaterial({ color: 0x8aa8ae, roughness: 0.62, metalness: 0.15 });
  l3RotationGroup.add(
    box([2.2, 1.3, 2.2], [1.9, 0.65, -2.4], equipmentMaterial),
    box([2.8, 1.0, 1.8], [2.0, 0.5, 3.4], equipmentMaterial),
  );
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.8, 28), equipmentMaterial);
  tank.position.set(0.7, 0.9, 0.2);
  tank.castShadow = true;
  l3RotationGroup.add(tank);
  tag(tank, {
    entityId: 'WT-01', label: '水塔／重設備核心側配置', status: 'working',
    description: '重物配置在固定核心附近的概念位置；容量、設備荷重、振動、維修與真正結構落點尚未核定。',
    openItemId: 'OPEN-011',
  }, selectables);

  const stair = model.geometry.stair;
  const stairGroup = new THREE.Group();
  const addFlight = (baseX: number, baseElevation: number) => {
    const riserHeight = stair.totalRise / stair.riserCount;
    for (let index = 0; index < stair.treadsPerRun; index += 1) {
      const stepHeight = riserHeight * (index + 1);
      stairGroup.add(box(
        [stair.treadDepth, stepHeight, stair.width],
        [baseX + (index + 0.5) * stair.treadDepth, baseElevation + stepHeight / 2, stair.originY + stair.width / 2],
        dark,
      ));
    }
  };
  addFlight(stair.startX, stair.lowerElevation);
  const secondStart = stair.startX + stair.flightRun + stair.midLandingLength;
  addFlight(secondStart, stair.midLandingElevation);
  stairGroup.add(box(
    [stair.midLandingLength, 0.16, stair.width],
    [stair.startX + stair.flightRun + stair.midLandingLength / 2, stair.midLandingElevation - 0.08, stair.originY + stair.width / 2],
    dark,
  ));
  layer('circulation').add(stairGroup);
  tag(stairGroup, {
    entityId: stair.entityId, label: 'ST-01 長邊雙跑樓梯', status: 'working',
    description: `${stair.width.toFixed(2)} m 候選有效淨寬、${stair.riserCount} 級高／${stair.treadsPerRun * 2} 踏面，從池畔 +${stair.lowerElevation.toFixed(2)} m 升至 L2 +${stair.upperElevation.toFixed(2)} m；平台與防墜仍待確認。`,
    openItemId: stair.guardOpenItemId,
  }, selectables);

  const egressGroup = new THREE.Group();
  const egressX = coreData.x + 0.32;
  const egressZ = coreData.y + 0.4;
  for (let index = 0; index < 12; index += 1) {
    const rise = (model.geometry.l3.baseElevation - model.geometry.l2.baseElevation) * (index + 1) / 24;
    egressGroup.add(box([0.18, rise, 1.05], [egressX + (index + 0.5) * 0.18, model.geometry.l2.baseElevation + rise / 2, egressZ + 0.55], dark));
  }
  layer('circulation').add(egressGroup);
  tag(egressGroup, {
    entityId: 'ST-02', label: 'L2–L3 節省空間逃生梯工作區', status: 'deferred',
    description: '只顯示固定核心內的樓梯預留方向；不得視為已完成避難寬度、級高級深、平台、防火區劃或法規檢核。',
    openItemId: 'OPEN-016',
  }, selectables);

  const roofMesh = quad([
    roof.startX, roof.lowElevation, 0,
    roof.startX, roof.lowElevation, roof.width,
    roof.endX, roof.highElevation, roof.width,
    roof.endX, roof.highElevation, 0,
  ], glass);
  layer('roof').add(roofMesh);
  const roofGridMaterial = new THREE.LineBasicMaterial({ color: 0x5e9cac, transparent: true, opacity: 0.62 });
  for (let x = roof.startX; x <= roof.endX + 0.01; x += roof.planRun / 6) {
    const clamped = Math.min(x, roof.endX);
    layer('roof').add(line([
      new THREE.Vector3(clamped, roofHeightAt(clamped) + 0.015, 0),
      new THREE.Vector3(clamped, roofHeightAt(clamped) + 0.015, roof.width),
    ], roofGridMaterial));
  }
  for (let z = 0; z <= roof.width + 0.01; z += roof.width / 5) {
    layer('roof').add(line([
      new THREE.Vector3(roof.startX, roof.lowElevation + 0.015, Math.min(z, roof.width)),
      new THREE.Vector3(roof.endX, roof.highElevation + 0.015, Math.min(z, roof.width)),
    ], roofGridMaterial));
  }
  tag(roofMesh, {
    entityId: 'RF-GL-01', label: '固定 5° 單坡玻璃屋頂', status: 'confirmed',
    description: `${roof.planRun.toFixed(1)} m 水平跨度，低端 +${roof.lowElevation.toFixed(3)} m、高端 +${roof.highElevation.toFixed(3)} m；相對抬高池畔的低端淨高為 ${(roof.lowElevation - deckElevation).toFixed(2)} m。`,
  }, selectables);
  const transition = box(
    [0.22, roof.transitionBand.value, roof.width],
    [roof.endX + 0.11, roof.highElevation + roof.transitionBand.value / 2, roof.width / 2],
    deferred,
  );
  layer('roof').add(transition);
  tag(transition, {
    entityId: 'J-RF-L3-01', label: '屋頂／L3 垂直轉接帶', status: 'deferred',
    description: `${roof.transitionBand.value.toFixed(3)} m 只表示固定屋頂高端與 L3 樓板的標高差；中央剖面另有約 ${roof.interfacePlanMismatch.value.toFixed(2)} m 平面錯位，三維止水、活動縫與排水仍未解決。`,
    openItemId: roof.interfacePlanMismatch.openItemId,
  }, selectables);

  const rainGroup = new THREE.Group();
  const rainMaterial = new THREE.LineBasicMaterial({ color: 0x568eaf, transparent: true, opacity: 0.62 });
  for (let index = 0; index <= 18; index += 1) {
    const z = roof.width * index / 18;
    rainGroup.add(line([
      new THREE.Vector3(roof.startX, roof.lowElevation, z),
      new THREE.Vector3(roof.startX, 0.12, z),
    ], rainMaterial));
  }
  rainGroup.add(box([0.38, 0.14, roof.width], [roof.startX, 0.07, roof.width / 2], deferred));
  const waterPath = line([
    new THREE.Vector3(roof.startX, 0.16, centreZ),
    new THREE.Vector3(-1.35, 0.16, centreZ),
    new THREE.Vector3(coreData.x + coreData.length / 2, 0.16, coreData.y + coreData.width / 2),
  ], new THREE.LineDashedMaterial({ color: PALETTE.deferred, dashSize: 0.45, gapSize: 0.3 }));
  waterPath.computeLineDistances();
  rainGroup.add(waterPath);
  layer('rain').add(rainGroup);
  tag(rainGroup, {
    entityId: 'RC-RF-01', label: '被動雨簾與回用水路', status: 'deferred',
    description: '雨簾只在降雨時形成；承接溝、容量、泵浦、溢流、衛生隔離與施工尺度仍待專業精化。',
    openItemId: 'OPEN-014',
  }, selectables);

  const annotations = layer('annotations');
  const grid = new THREE.GridHelper(58, 29, 0x637179, 0xb8c0c2);
  grid.position.set(centreX - 8, 0.018, centreZ);
  annotations.add(grid);
  const localAxis = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(centreX, 0.26, centreZ),
    8,
    0xb66143,
    1.2,
    0.7,
  );
  localAxis.name = 'LOCAL-X-TO-NORTHWEST-307';
  annotations.add(localAxis);
  const trueNorth = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(-24, 0.28, -12),
    8,
    0x21323b,
    1.2,
    0.7,
  );
  trueNorth.name = 'TRUE-NORTH';
  scene.add(trueNorth);

  return { scene, worldRoot, layerGroups, selectables, lights: { sun, ambient } };
}
