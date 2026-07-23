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
  siteRoot: THREE.Group;
  layerGroups: Map<string, THREE.Group>;
  selectables: SelectableInfo[];
  lights: { sun: THREE.DirectionalLight; ambient: THREE.HemisphereLight };
}

const PALETTE = {
  existing: 0xb9b2a6,
  l1: 0xb9b6b0,
  l2: 0xaaa7a1,
  l3: 0x9d9a94,
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

function horizontalPolygon(points: Array<[number, number]>, elevation: number, material: THREE.Material) {
  const vertices = points.flatMap(([x, z]) => [x, elevation, z]);
  const indices: number[] = [];
  for (let index = 1; index < points.length - 1; index += 1) indices.push(0, index, index + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
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

function addFacadeWallWithOpenings(
  group: THREE.Group,
  x: number,
  yStart: number,
  yEnd: number,
  height: number,
  thickness: number,
  openings: ViewerModel['geometry']['l1']['toiletEntrances'],
  material: THREE.Material,
) {
  const sorted = [...openings].sort((a, b) => a.center[1] - b.center[1]);
  let cursor = yStart;
  for (const opening of sorted) {
    const openingStart = opening.center[1] - opening.clearWidth / 2;
    const openingEnd = opening.center[1] + opening.clearWidth / 2;
    if (openingStart > cursor) {
      group.add(box([thickness, height, openingStart - cursor], [x, height / 2, (cursor + openingStart) / 2], material));
    }
    if (height > opening.displayClearHeight) {
      const headerHeight = height - opening.displayClearHeight;
      group.add(box([thickness, headerHeight, opening.clearWidth], [x, opening.displayClearHeight + headerHeight / 2, opening.center[1]], material));
    }
    cursor = openingEnd;
  }
  if (cursor < yEnd) group.add(box([thickness, height, yEnd - cursor], [x, height / 2, (cursor + yEnd) / 2], material));
}

function beamBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  depth: number,
  width: number,
  material: THREE.Material,
) {
  const delta = end.clone().sub(start);
  const length = Math.hypot(delta.x, delta.y);
  const beam = box([length, depth, width], [
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2,
  ], material);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
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
  const buildingLength = model.geometry.site.length;
  const buildingWidth = model.geometry.site.width;
  const centreX = buildingLength / 2;
  const centreZ = buildingWidth / 2;
  const worldRoot = new THREE.Group();
  worldRoot.name = 'WORLD-BEARING-ROOT';
  worldRoot.rotation.y = THREE.MathUtils.degToRad(-model.referenceSystem.localLongAxisBearingFromTrueNorth);
  scene.add(worldRoot);

  const siteRoot = new THREE.Group();
  siteRoot.name = model.referenceSystem.coordinateAdapter.adapterId;
  // SITE is Z-up while Three.js is Y-up. Negating Three Z preserves
  // handedness and keeps SITE Y0/Y14 on their canonical plan sides.
  siteRoot.position.set(-centreX, 0, centreZ);
  siteRoot.scale.set(1, 1, -1);
  siteRoot.userData.coordinateAdapter = structuredClone(model.referenceSystem.coordinateAdapter);
  worldRoot.add(siteRoot);
  const layerGroups = new Map<string, THREE.Group>();
  for (const modelLayer of model.layers) {
    const group = new THREE.Group();
    group.name = `layer:${modelLayer.id}`;
    group.userData.layerId = modelLayer.id;
    siteRoot.add(group);
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
  if (model.geometry.l1.serviceWingStyle.materialIntent !== 'fair-faced-exposed-concrete') {
    throw new TypeError('CORE-01 必須使用 active model 的清水模材質意圖。');
  }
  const l1Material = new THREE.MeshStandardMaterial({ color: PALETTE.l1, roughness: 0.94, metalness: 0 });
  const l2Material = new THREE.MeshStandardMaterial({ color: PALETTE.l2, roughness: 0.92, metalness: 0 });
  const l3Material = new THREE.MeshStandardMaterial({ color: PALETTE.l3, roughness: 0.9, metalness: 0 });
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
    [buildingLength + 12, 0.2, buildingWidth + 12],
    [buildingLength / 2, -0.18, centreZ],
    groundMaterial,
  );
  ground.receiveShadow = true;
  site.add(ground);
  const setback = box(
    [building.rightSetback.value, 0.07, buildingWidth],
    [model.geometry.l1.rightSetbackBounds.x1 + building.rightSetback.value / 2, 0.005, centreZ],
    siteMaterial,
  );
  site.add(setback);
  const boundary = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Vector3(buildingLength, 0.04, 0),
      new THREE.Vector3(buildingLength, 0.04, buildingWidth),
      new THREE.Vector3(0, 0.04, buildingWidth),
    ]),
    new THREE.LineDashedMaterial({ color: 0x72858c, dashSize: 0.55, gapSize: 0.35 }),
  );
  boundary.computeLineDistances();
  site.add(boundary);
  tag(setback, {
    entityId: 'Z-L1-SETBACK-01', label: '右側 2 m 退縮與整坡工作帶', status: 'confirmed',
    description: 'X39～X41 保留室外到達與 +0.10 m 整坡；精確排水、無障礙與門口淨空仍待專業驗證。',
    openItemId: 'OPEN-016',
  }, selectables);

  const l1 = layer('l1');
  const serviceBounds = model.geometry.l1.serviceWingBounds;
  const serviceStart = serviceBounds.x1;
  const serviceEnd = serviceBounds.x2;
  const serviceFloor = box(
    [serviceEnd - serviceStart, 0.18, buildingWidth],
    [(serviceStart + serviceEnd) / 2, -0.09, centreZ],
    l1Material,
  );
  l1.add(serviceFloor);
  const wallHeight = model.geometry.l2.baseElevation - 0.18;
  const zoneMaterial = new THREE.MeshStandardMaterial({ color: 0xdcc9a9, roughness: 0.88, transparent: true, opacity: 0.7 });
  const equipmentZoneMaterial = new THREE.MeshStandardMaterial({ color: 0x9eb4b3, roughness: 0.78, transparent: true, opacity: 0.62 });
  const zoneEntries = Object.values(model.geometry.l1.zones);
  for (const zone of zoneEntries) {
    const bounds = zone.bounds;
    const zoneHeight = 0.1;
    const zoneMesh = box(
      [bounds.x2 - bounds.x1, zoneHeight, bounds.y2 - bounds.y1],
      [(bounds.x1 + bounds.x2) / 2, (zone.floorElevation ?? 0) + zoneHeight / 2, (bounds.y1 + bounds.y2) / 2],
      zone.entityId.includes('WTP') || zone.entityId.includes('CHEM') ? equipmentZoneMaterial : zoneMaterial,
    );
    l1.add(zoneMesh);
    tag(zoneMesh, {
      entityId: zone.entityId,
      label: zone.entityId.includes('WC') ? '獨立廁所區' : zone.entityId.includes('STOR') ? '乾式儲物間' : zone.entityId.includes('CHEM') ? '獨立藥劑分間' : '水處理機房',
      status: 'working',
      description: `${(bounds.x2 - bounds.x1).toFixed(2)} × ${(bounds.y2 - bounds.y1).toFixed(2)} m 工作範圍；隔間、設備與實際淨空仍待專業深化。`,
      openItemId: 'OPEN-008',
    }, selectables);
  }
  const poolSideEntrances = model.geometry.l1.toiletEntrances.filter(({ side }) => side === 'x31');
  const playgroundSideEntrances = model.geometry.l1.toiletEntrances.filter(({ side }) => side === 'x39');
  addFacadeWallWithOpenings(l1, serviceStart + 0.08, 0, 7.5, wallHeight, 0.16, poolSideEntrances, l1Material);
  addFacadeWallWithOpenings(l1, serviceEnd - 0.08, 0, 7.5, wallHeight, 0.16, playgroundSideEntrances, l1Material);
  l1.add(
    box([0.16, wallHeight, 6.5], [serviceStart + 0.08, wallHeight / 2, 10.75], l1Material),
    box([0.16, wallHeight, 6.5], [serviceEnd - 0.08, wallHeight / 2, 10.75], l1Material),
    box([serviceEnd - serviceStart, wallHeight, 0.16], [(serviceStart + serviceEnd) / 2, wallHeight / 2, buildingWidth - 0.08], l1Material),
    box([0.14, wallHeight, 7.5], [35.5, wallHeight / 2, 3.75], l1Material),
    box([serviceEnd - serviceStart, wallHeight, 0.14], [(serviceStart + serviceEnd) / 2, wallHeight / 2, 3.5], l1Material),
    box([serviceEnd - serviceStart, wallHeight, 0.14], [(serviceStart + serviceEnd) / 2, wallHeight / 2, 7.5], l1Material),
    box([0.14, wallHeight, 6.5], [32.5, wallHeight / 2, 10.75], l1Material),
  );
  const openingMarkerMaterial = new THREE.MeshStandardMaterial({ color: 0x3f4c51, roughness: 0.72 });
  for (const entrance of model.geometry.l1.toiletEntrances) {
    const openingGroup = new THREE.Group();
    const x = entrance.side === 'x31' ? serviceStart - 0.015 : serviceEnd + 0.015;
    openingGroup.add(box([0.24, 0.035, entrance.clearWidth], [x, 0.018, entrance.center[1]], openingMarkerMaterial));
    l1.add(openingGroup);
    tag(openingGroup, {
      entityId: entrance.entityId,
      label: '廁所 1.00 m 無門板入口',
      status: 'confirmed',
      description: `${entrance.side.toUpperCase()} 立面 ${entrance.facadePosition === 'left' ? '左側' : '右側'}入口；1.00 m 淨寬、無門板，依 0.6.2 決策不設入口遮擋版，可直接面向洗手台。`,
      openItemId: 'OPEN-008',
    }, selectables);
  }

  const sanitaryMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f6f4, roughness: 0.42 });
  const cubicleMaterial = new THREE.MeshStandardMaterial({ color: 0xc8d1ce, roughness: 0.78 });
  const cubicleDoorMaterial = new THREE.MeshStandardMaterial({ color: 0x65736f, roughness: 0.68 });
  const toiletDetails = new THREE.Group();
  for (const zone of Object.values(model.geometry.l1.zones).filter((candidate) => candidate.layout)) {
    const layout = zone.layout!;
    const floorElevation = zone.floorElevation ?? 0;
    for (const basin of layout.washbasins) {
      toiletDetails.add(box([0.72, 0.12, 0.42], [basin.center[0], floorElevation + 0.78, basin.center[1]], sanitaryMaterial));
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.68, 18), sanitaryMaterial);
      pedestal.position.set(basin.center[0], floorElevation + 0.38, basin.center[1]);
      toiletDetails.add(pedestal);
    }
    for (const urinal of layout.urinals) {
      toiletDetails.add(box([0.34, 0.58, 0.2], [urinal.center[0], floorElevation + 0.64, urinal.center[1]], sanitaryMaterial));
    }
    for (const cubicle of layout.toiletCubicles) {
      const bounds = cubicle.planBounds;
      const cubicleHeight = 2.05;
      toiletDetails.add(
        box([bounds.x2 - bounds.x1, cubicleHeight, 0.06], [(bounds.x1 + bounds.x2) / 2, floorElevation + cubicleHeight / 2, bounds.y1], cubicleMaterial),
        box([bounds.x2 - bounds.x1, cubicleHeight, 0.06], [(bounds.x1 + bounds.x2) / 2, floorElevation + cubicleHeight / 2, bounds.y2], cubicleMaterial),
        box([0.06, cubicleHeight, bounds.y2 - bounds.y1], [bounds.x1, floorElevation + cubicleHeight / 2, (bounds.y1 + bounds.y2) / 2], cubicleMaterial),
        box([0.06, cubicleHeight, bounds.y2 - bounds.y1], [bounds.x2, floorElevation + cubicleHeight / 2, (bounds.y1 + bounds.y2) / 2], cubicleMaterial),
      );
      const doorAxis = cubicle.doorSide[0];
      const doorCoordinate = Number(cubicle.doorSide.slice(1));
      if (doorAxis === 'x') {
        const doorWidth = Math.min(0.72, bounds.y2 - bounds.y1 - 0.24);
        toiletDetails.add(box([0.045, 1.82, doorWidth], [doorCoordinate, floorElevation + 0.94, (bounds.y1 + bounds.y2) / 2], cubicleDoorMaterial));
      } else {
        const doorWidth = Math.min(0.72, bounds.x2 - bounds.x1 - 0.24);
        toiletDetails.add(box([doorWidth, 1.82, 0.045], [(bounds.x1 + bounds.x2) / 2, floorElevation + 0.94, doorCoordinate], cubicleDoorMaterial));
      }
      const toilet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.42, 20), sanitaryMaterial);
      toilet.position.set((bounds.x1 + bounds.x2) / 2, floorElevation + 0.22, (bounds.y1 + bounds.y2) / 2);
      toiletDetails.add(toilet);
    }
    if (layout.privacyScreen) {
      const screen = layout.privacyScreen.planBounds;
      toiletDetails.add(box([
        screen.x2 - screen.x1,
        layout.privacyScreen.height,
        screen.y2 - screen.y1,
      ], [
        (screen.x1 + screen.x2) / 2,
        floorElevation + layout.privacyScreen.height / 2,
        (screen.y1 + screen.y2) / 2,
      ], l1Material));
    }
  }
  l1.add(toiletDetails);
  tag(toiletDetails, {
    entityId: 'WC-L1-DETAIL-01', label: '四間廁所內裝與隱私格局', status: 'working',
    description: '四個主入口均無門板且不設遮擋版，可直接面向洗手台；WC 個別隔間仍保留門板，並全部貼齊 Y3.5 牆面。泳池男廁其中一座小便斗移至 X31 且避開入口。',
    openItemId: 'OPEN-008',
  }, selectables);
  const integratedStructure = new THREE.Group();
  integratedStructure.add(
    box([0.28, model.geometry.l3.baseElevation, 6.5], [32.5, model.geometry.l3.baseElevation / 2, 10.75], coreMaterial),
    box([0.28, model.geometry.l3.baseElevation, 7.5], [35.5, model.geometry.l3.baseElevation / 2, 3.75], coreMaterial),
  );
  layer('circulation').add(integratedStructure);
  tag(integratedStructure, {
    entityId: 'STRUCT-INTEGRATED-01', label: '整合隔間／設備牆的連續支承帶', status: 'working',
    description: '支承候選沿 X32.5 設備牆與 X35.5 廁所分界整合，避免完成空間出現孤柱；真正柱牆尺寸、連續至基礎的荷重路徑與轉換構架仍須結構專業驗證。',
    openItemId: 'OPEN-016',
  }, selectables);
  tag(serviceFloor, {
    entityId: 'CORE-01', label: '1F 六區服務翼', status: 'working',
    description: 'X31～X39 由四間互不相通廁所、儲物、水處理與獨立藥劑分間組成；泳池組只由 X31 進出，操場組只由 X39 進出。',
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
    description: `池畔與泳池側男女廁連續為 +${deckElevation.toFixed(2)} m，幾何已保留 POOL-01 開口；防水、溢流與排水仍待深化。`,
    openItemId: 'OPEN-016',
  }, selectables);
  const rampBounds = model.geometry.l1.playgroundRamp.bounds;
  const thresholdRamp = quad([
    rampBounds.x1, 0.015, rampBounds.y1,
    rampBounds.x1, 0.015, rampBounds.y2,
    rampBounds.x2, model.geometry.l1.playgroundRamp.endElevation + 0.015, rampBounds.y2,
    rampBounds.x2, model.geometry.l1.playgroundRamp.endElevation + 0.015, rampBounds.y1,
  ], deferred);
  l1.add(thresholdRamp);
  tag(thresholdRamp, {
    entityId: model.geometry.l1.playgroundRamp.entityId, label: '操場側 +0.10 m 外部整坡', status: 'working',
    description: 'X39～X41 以 1:20 工作坡銜接操場側廁所；精確無障礙、門檻、排水與防滑仍待專業驗證。',
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
  for (const band of pool.laneBands.slice(0, -1)) {
    const z = band.y2;
    poolGroup.add(line([
      new THREE.Vector3(poolX0, waterLevel + 0.025, z),
      new THREE.Vector3(poolX1, waterLevel + 0.025, z),
    ], new THREE.LineBasicMaterial({ color: 0xf7f5df })));
    for (let x = poolX0 + 0.35, index = 0; x < poolX1; x += 0.5, index += 1) {
      const floatMaterial = new THREE.MeshStandardMaterial({ color: index % 6 < 3 ? 0xf4f1de : 0xc75d4b, roughness: 0.54 });
      const laneFloat = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), floatMaterial);
      laneFloat.position.set(x, waterLevel + 0.045, z);
      poolGroup.add(laneFloat);
    }
  }
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0xaeb8ba, roughness: 0.32, metalness: 0.72 });
  for (const z of [poolZ0 + 0.8, poolZ1 - 0.8]) {
    for (const x of [poolX0 + 0.28, poolX0 + 0.7]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 14), railMaterial);
      rail.position.set(x, deckElevation + 0.55, z);
      poolGroup.add(rail);
    }
    for (let step = 0; step < 3; step += 1) {
      poolGroup.add(box([0.42, 0.04, 0.08], [poolX0 + 0.49, waterLevel - 0.2 - step * 0.25, z], railMaterial));
    }
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
    entityId: 'POOL-01', label: '25 m 教學／游泳混合泳池', status: 'confirmed',
    description: `${pool.length.value} × ${pool.width.value} m；兩條 2.5 m 標準水道加 3.0 m 正常游泳／教學混合區，左側低 X 端水深 ${pool.shallowDepth.value} m，向右側服務量體端降至 ${pool.deepDepth.value} m。`,
  }, selectables);

  const roof = model.geometry.roof;
  const roofHeightAt = (x: number) => roof.lowElevation
    + (roof.highElevation - roof.lowElevation) * ((x - roof.startX) / roof.planRun);
  const glassWallSegment = (x1: number, x2: number, z: number, bottom: number) => quad([
    x1, bottom, z,
    x1, roofHeightAt(x1), z,
    x2, roofHeightAt(x2), z,
    x2, bottom, z,
  ], wallGlass);
  const mainEntranceBounds = model.geometry.l1.mainEntranceBounds;
  l1.add(
    glassWallSegment(roof.startX, mainEntranceBounds.x1, 0.03, deckElevation),
    glassWallSegment(mainEntranceBounds.x2, roof.endX, 0.03, deckElevation),
    glassWallSegment(mainEntranceBounds.x1, mainEntranceBounds.x2, 0.03, 2.55),
    glassWallSegment(roof.startX, roof.endX, buildingWidth - 0.03, deckElevation),
  );
  const entranceGroup = new THREE.Group();
  const entranceWidth = mainEntranceBounds.x2 - mainEntranceBounds.x1;
  const entranceCentreX = (mainEntranceBounds.x1 + mainEntranceBounds.x2) / 2;
  const entranceHeight = 2.42;
  const entranceGlass = wallGlass.clone();
  entranceGlass.opacity = 0.34;
  entranceGroup.add(
    box([entranceWidth / 2 - 0.04, entranceHeight, 0.045], [entranceCentreX - entranceWidth / 4, deckElevation + entranceHeight / 2, 0.025], entranceGlass),
    box([entranceWidth / 2 - 0.04, entranceHeight, 0.045], [entranceCentreX + entranceWidth / 4, deckElevation + entranceHeight / 2, 0.025], entranceGlass),
    box([0.055, entranceHeight + 0.06, 0.075], [mainEntranceBounds.x1, deckElevation + entranceHeight / 2, 0.025], dark),
    box([0.055, entranceHeight + 0.06, 0.075], [entranceCentreX, deckElevation + entranceHeight / 2, 0.025], dark),
    box([0.055, entranceHeight + 0.06, 0.075], [mainEntranceBounds.x2, deckElevation + entranceHeight / 2, 0.025], dark),
    box([entranceWidth + 0.1, 0.065, 0.075], [entranceCentreX, deckElevation + entranceHeight, 0.025], dark),
  );
  l1.add(entranceGroup);
  tag(entranceGroup, {
    entityId: 'EN-01', label: '泳池大廳玻璃主入口', status: 'confirmed',
    description: `位於 SITE-XY X${mainEntranceBounds.x1.toFixed(1)}～X${mainEntranceBounds.x2.toFixed(1)}／Y0；Viewer 明確切開長邊玻璃牆並表達雙扇玻璃入口，實際淨寬與門框仍須專業驗證。`,
    openItemId: 'OPEN-008',
  }, selectables);
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
  const upperCentreZ = (l2Data.bounds.y1 + l2Data.bounds.y2) / 2;
  const slabThickness = 0.24;
  const l2Slab = box(
    [l2Data.length, slabThickness, l2Data.width],
    [(l2Data.startX + l2Data.endX) / 2, l2Data.baseElevation - slabThickness / 2, upperCentreZ],
    l2Material,
  );
  l2Group.add(l2Slab);
  const l2WallHeight = l2Data.topElevation - l2Data.baseElevation - 0.28;
  const l2WallCentreY = l2Data.baseElevation + l2WallHeight / 2;
  const corridorMaterial = new THREE.MeshStandardMaterial({
    color: 0xc7d8d2, roughness: 0.82, transparent: true, opacity: 0.74, side: THREE.DoubleSide,
  });
  const stairZoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xd0ccc2, roughness: 0.86, transparent: true, opacity: 0.78, side: THREE.DoubleSide,
  });
  const corridorSurface = horizontalPolygon(
    l2Data.circulationZone.polygon,
    l2Data.baseElevation + 0.012,
    corridorMaterial,
  );
  const stairZoneSurface = horizontalPolygon([
    [l2Data.stairZone.bounds.x1, l2Data.stairZone.bounds.y1],
    [l2Data.stairZone.bounds.x2, l2Data.stairZone.bounds.y1],
    [l2Data.stairZone.bounds.x2, l2Data.stairZone.bounds.y2],
    [l2Data.stairZone.bounds.x1, l2Data.stairZone.bounds.y2],
  ], l2Data.baseElevation + 0.016, stairZoneMaterial);
  l2Group.add(corridorSurface, stairZoneSurface);
  l2Group.add(
    box([0.18, l2WallHeight, l2Data.width], [l2Data.endX - 0.09, l2WallCentreY, upperCentreZ], l2Material),
    box([l2Data.length, l2WallHeight, 0.14], [(l2Data.startX + l2Data.endX) / 2, l2WallCentreY, l2Data.bounds.y1 + 0.07], wallGlass),
    box([l2Data.length, l2WallHeight, 0.14], [(l2Data.startX + l2Data.endX) / 2, l2WallCentreY, l2Data.bounds.y2 - 0.07], l2Material),
    box([l2Data.stairZone.bounds.x2 - l2Data.stairZone.bounds.x1, l2WallHeight, 0.14], [
      (l2Data.stairZone.bounds.x1 + l2Data.stairZone.bounds.x2) / 2,
      l2WallCentreY,
      l2Data.stairZone.bounds.y2,
    ], l2Material),
    box([l2Data.zones.maleChangingShower.bounds.x2 - l2Data.zones.maleChangingShower.bounds.x1, l2WallHeight, 0.14], [
      (l2Data.zones.maleChangingShower.bounds.x1 + l2Data.zones.maleChangingShower.bounds.x2) / 2,
      l2WallCentreY,
      l2Data.splitAxisY,
    ], l2Material),
  );

  const observation = l2Data.corridorFeatures.poolObservationWindow;
  const observationBottom = l2Data.baseElevation + 0.82;
  const observationHeight = 1.42;
  l2Group.add(
    box([0.14, l2WallHeight, observation.spanY[0] - l2Data.bounds.y1], [
      l2Data.startX + 0.07, l2WallCentreY, (l2Data.bounds.y1 + observation.spanY[0]) / 2,
    ], l2Material),
    box([0.14, observationBottom - l2Data.baseElevation, observation.spanY[1] - observation.spanY[0]], [
      l2Data.startX + 0.07,
      l2Data.baseElevation + (observationBottom - l2Data.baseElevation) / 2,
      (observation.spanY[0] + observation.spanY[1]) / 2,
    ], l2Material),
    box([0.14, observationHeight, observation.spanY[1] - observation.spanY[0]], [
      l2Data.startX + 0.07,
      observationBottom + observationHeight / 2,
      (observation.spanY[0] + observation.spanY[1]) / 2,
    ], wallGlass),
    box([0.14, l2Data.topElevation - observationBottom - observationHeight, observation.spanY[1] - observation.spanY[0]], [
      l2Data.startX + 0.07,
      observationBottom + observationHeight + (l2Data.topElevation - observationBottom - observationHeight) / 2,
      (observation.spanY[0] + observation.spanY[1]) / 2,
    ], l2Material),
    box([0.14, l2WallHeight, l2Data.bounds.y2 - observation.spanY[1]], [
      l2Data.startX + 0.07, l2WallCentreY, (observation.spanY[1] + l2Data.bounds.y2) / 2,
    ], l2Material),
  );

  const roomWallX = l2Data.zones.maleChangingShower.bounds.x1;
  const sortedEntries = [...l2Data.changingRoomEntries].sort((a, b) => a.rangeY[0] - b.rangeY[0]);
  let roomWallCursor = l2Data.stairZone.bounds.y2;
  for (const entry of sortedEntries) {
    if (entry.rangeY[0] > roomWallCursor) {
      l2Group.add(box([0.14, l2WallHeight, entry.rangeY[0] - roomWallCursor], [
        roomWallX, l2WallCentreY, (roomWallCursor + entry.rangeY[0]) / 2,
      ], l2Material));
    }
    const headerHeight = Math.max(0, l2WallHeight - 2.2);
    if (headerHeight > 0) {
      l2Group.add(box([0.14, headerHeight, entry.clearWidth], [
        roomWallX, l2Data.baseElevation + 2.2 + headerHeight / 2, (entry.rangeY[0] + entry.rangeY[1]) / 2,
      ], l2Material));
    }
    roomWallCursor = entry.rangeY[1];
  }
  if (roomWallCursor < l2Data.bounds.y2) {
    l2Group.add(box([0.14, l2WallHeight, l2Data.bounds.y2 - roomWallCursor], [
      roomWallX, l2WallCentreY, (roomWallCursor + l2Data.bounds.y2) / 2,
    ], l2Material));
  }

  tag(corridorSurface, {
    entityId: l2Data.circulationZone.entityId,
    label: 'L 形面池觀景走道',
    status: 'working',
    description: `面積 ${l2Data.circulationZone.area.toFixed(2)} m²，沿 X29 觀景窗串聯男女更衣入口；僅供站立觀景與通行，不設座椅。`,
    openItemId: 'OPEN-019',
  }, selectables);
  tag(stairZoneSurface, {
    entityId: l2Data.stairZone.entityId,
    label: 'ST-02 獨立樓梯區',
    status: 'working',
    description: 'X32.5～41／Y0～2.5；Y0 為大面安全玻璃，Y2.5 為清水模分隔牆。',
    openItemId: 'OPEN-019',
  }, selectables);

  const showerMaterial = new THREE.MeshStandardMaterial({ color: 0xd9e4e1, roughness: 0.78 });
  const fixtureMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.5 });
  const lockerMaterial = new THREE.MeshStandardMaterial({ color: 0x6d827f, roughness: 0.76 });
  for (const [key, zone] of Object.entries(l2Data.zones)) {
    const showerGroup = new THREE.Group();
    const partitionHeight = 2.1;
    for (const cubicle of zone.showerCubicles) {
      const bounds = cubicle.planBounds;
      showerGroup.add(
        box([bounds.x2 - bounds.x1, partitionHeight, 0.04], [(bounds.x1 + bounds.x2) / 2, l2Data.baseElevation + partitionHeight / 2, bounds.y1], showerMaterial),
        box([0.04, partitionHeight, bounds.y2 - bounds.y1], [bounds.x1, l2Data.baseElevation + partitionHeight / 2, (bounds.y1 + bounds.y2) / 2], showerMaterial),
        box([0.04, partitionHeight, bounds.y2 - bounds.y1], [bounds.x2, l2Data.baseElevation + partitionHeight / 2, (bounds.y1 + bounds.y2) / 2], showerMaterial),
      );
    }
    for (const cubicle of zone.supportFixtures.toiletCubicles) {
      const bounds = cubicle.planBounds;
      showerGroup.add(
        box([bounds.x2 - bounds.x1, partitionHeight, 0.04], [(bounds.x1 + bounds.x2) / 2, l2Data.baseElevation + partitionHeight / 2, bounds.y1], showerMaterial),
        box([0.04, partitionHeight, bounds.y2 - bounds.y1], [bounds.x1, l2Data.baseElevation + partitionHeight / 2, (bounds.y1 + bounds.y2) / 2], showerMaterial),
        box([0.04, partitionHeight, bounds.y2 - bounds.y1], [bounds.x2, l2Data.baseElevation + partitionHeight / 2, (bounds.y1 + bounds.y2) / 2], showerMaterial),
        box([0.42, 0.42, 0.58], [(bounds.x1 + bounds.x2) / 2, l2Data.baseElevation + 0.21, bounds.y1 + 0.38], fixtureMaterial),
      );
    }
    for (const basin of zone.supportFixtures.washbasins) {
      showerGroup.add(box([0.52, 0.16, 0.42], [
        basin.center[0] + 0.25, l2Data.baseElevation + 0.82, basin.center[1],
      ], fixtureMaterial));
    }
    for (const bank of zone.lockerBanks) {
      const extent = bank.planExtent;
      showerGroup.add(box([
        extent.x2 - extent.x1, 1.9, extent.y2 - extent.y1,
      ], [
        (extent.x1 + extent.x2) / 2,
        l2Data.baseElevation + 0.95,
        (extent.y1 + extent.y2) / 2,
      ], lockerMaterial));
    }
    l2Group.add(showerGroup);
    tag(showerGroup, {
      entityId: zone.entityId,
      label: `${key === 'maleChangingShower' ? '男' : '女'}更衣淋浴區（15 間）`,
      status: 'working',
      description: `配置 ${zone.showerCount} 間含隔間 1.20 × 1.20 m 淋浴模組、1 間一般 WC、2 座洗手槽與置物櫃；男女合計 30 間淋浴，無障礙、排水與機電細部仍待專業深化。`,
      openItemId: 'OPEN-019',
    }, selectables);
  }

  const corridorFeatureGroup = new THREE.Group();
  const counter = l2Data.corridorFeatures.standingCounter.planExtent;
  corridorFeatureGroup.add(
    box([counter.x2 - counter.x1, 0.1, counter.y2 - counter.y1], [
      (counter.x1 + counter.x2) / 2, l2Data.baseElevation + 1.02, (counter.y1 + counter.y2) / 2,
    ], dark),
  );
  const fountain = l2Data.corridorFeatures.drinkingFountain.planExtent;
  corridorFeatureGroup.add(box([
    fountain.x2 - fountain.x1, 0.9, fountain.y2 - fountain.y1,
  ], [
    (fountain.x1 + fountain.x2) / 2,
    l2Data.baseElevation + 0.45,
    (fountain.y1 + fountain.y2) / 2,
  ], equipmentZoneMaterial));
  for (const planter of l2Data.corridorFeatures.planters) {
    corridorFeatureGroup.add(box([0.48, 0.42, 0.48], [
      planter.center[0], l2Data.baseElevation + 0.21, planter.center[1],
    ], siteMaterial));
  }
  l2Group.add(corridorFeatureGroup);
  tag(corridorFeatureGroup, {
    entityId: l2Data.corridorFeatures.standingCounter.entityId,
    label: '觀景走道站立設施',
    status: 'working',
    description: '設懸空站立長桌（無椅）、飲水機與 3 組可移除低矮盆栽；固定、給排水及通行淨寬仍待專業驗證。',
    openItemId: 'OPEN-019',
  }, selectables);

  layer('l2').add(l2Group);
  tag(l2Group, {
    entityId: 'EXT-L2-01', label: '2F 固定更衣／淋浴層', status: 'working',
    description: `固定正交樓板 ${l2Data.length.toFixed(1)} × ${l2Data.width.toFixed(1)} m，標高 +${l2Data.baseElevation.toFixed(2)} m；Review A 已配置 L 形面池走道、獨立樓梯區與男女各 15 間含隔間 1.20 × 1.20 m 淋浴模組。無障礙、除濕與排水豎井仍待深化。`,
    openItemId: 'OPEN-016',
  }, selectables);

  const l3Data = model.geometry.l3;
  const l3RotationGroup = new THREE.Group();
  l3RotationGroup.name = 'L3-PLAN-ROTATION';
  l3RotationGroup.position.set(l3Data.planPivot.x, l3Data.baseElevation, l3Data.planPivot.y);
  // siteRoot applies the SITE-to-Three reflection, so the child keeps the
  // SITE clockwise angle used by the canonical plan drawing.
  l3RotationGroup.rotation.y = THREE.MathUtils.degToRad(l3Data.planRotation.value);
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

  const extensionMaterial = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.82, side: THREE.DoubleSide });
  const arrivalMaterial = new THREE.MeshStandardMaterial({ color: 0xd7ddd9, roughness: 0.7, side: THREE.DoubleSide });
  const terraceMaterial = new THREE.MeshStandardMaterial({ color: 0x99b48c, roughness: 0.92, side: THREE.DoubleSide });
  const extension = l3Data.orthogonalExtension;
  const arrival = l3Data.arrivalWing;
  const terrace = l3Data.landscapeTerrace;
  const extensionGroup = new THREE.Group();
  const extensionSlab = horizontalPolygon(extension.polygon, l3Data.baseElevation - 0.03, extensionMaterial);
  const terraceSurface = horizontalPolygon(terrace.outerPolygon, l3Data.baseElevation + 0.015, terraceMaterial);
  const arrivalFloor = horizontalPolygon(arrival.polygon, l3Data.baseElevation + 0.035, arrivalMaterial);
  const arrivalRoof = horizontalPolygon(arrival.polygon, l3Data.baseElevation + 2.85, arrivalMaterial);
  extensionGroup.add(extensionSlab, terraceSurface, arrivalFloor, arrivalRoof);
  extensionGroup.add(
    box([0.08, 1.15, terrace.bounds.y2 - terrace.bounds.y1], [40.96, l3Data.baseElevation + 0.575, (terrace.bounds.y1 + terrace.bounds.y2) / 2], dark),
    box([terrace.bounds.x2 - terrace.bounds.x1, 1.15, 0.08], [(terrace.bounds.x1 + terrace.bounds.x2) / 2, l3Data.baseElevation + 0.575, 0.04], dark),
    box([0.9, 2.1, 0.06], [40.25, l3Data.baseElevation + 1.05, 2.04], dark),
  );
  const planterMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.planting, roughness: 0.95 });
  extensionGroup.add(
    box([0.55, 0.42, 0.75], [40.45, l3Data.baseElevation + 0.21, 3.0], planterMaterial),
    box([0.45, 0.36, 0.65], [40.5, l3Data.baseElevation + 0.18, 4.25], planterMaterial),
    box([0.4, 0.32, 0.35], [40.4, l3Data.baseElevation + 0.16, 0.22], planterMaterial),
  );
  layer('l3').add(extensionGroup);
  tag(extensionSlab, {
    entityId: extension.entityId, label: '3F 固定正交三角擴板', status: 'working',
    description: `在不改變旋轉主體 ${l3Data.planRotation.value.toFixed(1)}° 與支點的前提下新增 ${extension.grossArea.toFixed(3)} m²；L3 概念總面積為 ${extension.totalL3Area.toFixed(3)} m²，全部位於 L2 投影內。`,
    openItemId: 'OPEN-019',
  }, selectables);
  tag(arrivalFloor, {
    entityId: arrival.entityId, label: '3F 有頂室內到達翼', status: 'working',
    description: `ST-02 上端銜接面積約 ${arrival.area.toFixed(3)} m² 的固定正交有頂室內動線，再進入旋轉 L3；戶外景觀區不是唯一室內通路。`,
    openItemId: 'OPEN-019',
  }, selectables);
  tag(terraceSurface, {
    entityId: terrace.entityId, label: '教師／維修專用景觀區', status: 'working',
    description: `扣除到達翼後淨景觀面積約 ${terrace.netLandscapeArea.toFixed(3)} m²；只限教師與維修人員，設鎖門與告示，不開放學生、訪客或公眾聚集，也不得作主要逃生路徑。`,
    openItemId: 'OPEN-020',
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
  const fixedEquipment = new THREE.Group();
  fixedEquipment.add(
    box([2.2, 1.3, 2.2], [34.1, l3Data.baseElevation + 0.65, 9.0], equipmentMaterial),
    box([2.8, 1.0, 1.8], [34.0, l3Data.baseElevation + 0.5, 11.8], equipmentMaterial),
  );
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.8, 28), equipmentMaterial);
  tank.position.set(34.0, l3Data.baseElevation + 0.9, 6.8);
  tank.castShadow = true;
  fixedEquipment.add(tank);
  layer('circulation').add(fixedEquipment);
  tag(tank, {
    entityId: 'WT-01', label: '水塔／重設備核心側配置', status: 'working',
    description: '重物獨立保持在固定支承帶附近，不跟隨旋轉懸挑樓板；容量、設備荷重、振動、維修與真正結構落點尚未核定。',
    openItemId: 'OPEN-011',
  }, selectables);

  const stair = model.geometry.stair;
  const stairStartX = stair.bounds.x1;
  const stairOriginY = stair.bounds.y1;
  const stairWidth = stair.bounds.y2 - stair.bounds.y1;
  const stairGroup = new THREE.Group();
  const addFlight = (baseX: number, baseElevation: number) => {
    const riserHeight = stair.totalRise / stair.riserCount;
    for (let index = 0; index < stair.treadsPerRun; index += 1) {
      const treadElevation = baseElevation + riserHeight * (index + 1);
      const treadX = baseX + (index + 0.5) * stair.treadDepth;
      stairGroup.add(
        box([stair.treadDepth, 0.055, stairWidth], [treadX, treadElevation - 0.028, stairOriginY + stairWidth / 2], dark),
        box([0.04, riserHeight, stairWidth], [baseX + index * stair.treadDepth, treadElevation - riserHeight / 2, stairOriginY + stairWidth / 2], dark),
      );
    }
  };
  addFlight(stairStartX, stair.lowerElevation);
  const secondStart = stairStartX + stair.flightRun + stair.midLandingLength;
  addFlight(secondStart, stair.midLandingElevation);
  stairGroup.add(box(
    [stair.midLandingLength, 0.16, stairWidth],
    [stairStartX + stair.flightRun + stair.midLandingLength / 2, stair.midLandingElevation - 0.08, stairOriginY + stairWidth / 2],
    dark,
  ));
  const stringerInset = 0.18;
  const stringerZs = [stairOriginY + stringerInset, stairOriginY + stairWidth - stringerInset];
  for (const z of stringerZs) {
    stairGroup.add(
      beamBetween(
        new THREE.Vector3(stairStartX + 0.1, stair.lowerElevation - 0.1, z),
        new THREE.Vector3(stairStartX + stair.flightRun - 0.1, stair.midLandingElevation - 0.1, z),
        0.2, 0.12, dark,
      ),
      box([stair.midLandingLength, 0.2, 0.12], [stairStartX + stair.flightRun + stair.midLandingLength / 2, stair.midLandingElevation - 0.18, z], dark),
      beamBetween(
        new THREE.Vector3(secondStart + 0.1, stair.midLandingElevation - 0.1, z),
        new THREE.Vector3(stair.bounds.x2 - 0.1, stair.upperElevation - 0.1, z),
        0.2, 0.12, dark,
      ),
    );
  }
  layer('circulation').add(stairGroup);
  tag(stairGroup, {
    entityId: stair.entityId, label: 'ST-01 懸空式雙梯梁樓梯', status: 'working',
    description: `${stairWidth.toFixed(2)} m 候選有效淨寬、${stair.riserCount} 級高／${stair.treadsPerRun * 2} 踏面；薄踏步與封閉踢面由兩道連續深色鋼箱梯梁及懸空平台承托，梯下完全開放。SITE-XY 位於 X${stair.bounds.x1}～X${stair.bounds.x2}／Y${stair.bounds.y1}～Y${stair.bounds.y2}（Y0 側），從 +${stair.lowerElevation.toFixed(2)} m 升至 L2 +${stair.upperElevation.toFixed(2)} m；梯梁尺寸、節點、振動與防墜仍須專業驗證。`,
    openItemId: stair.guardOpenItemId,
  }, selectables);

  const stair2 = model.geometry.l2.stairToL3;
  const stair2Group = new THREE.Group();
  const stair2Width = stair2.bounds.y2 - stair2.bounds.y1;
  const addStair2Flight = (baseX: number, baseElevation: number) => {
    for (let index = 0; index < stair2.treadsPerRun; index += 1) {
      const treadElevation = baseElevation + stair2.riserHeight * (index + 1);
      stair2Group.add(
        box(
          [stair2.treadDepth, 0.06, stair2Width],
          [baseX + (index + 0.5) * stair2.treadDepth, treadElevation - 0.03, stair2.bounds.y1 + stair2Width / 2],
          dark,
        ),
        box(
          [0.04, stair2.riserHeight, stair2Width],
          [baseX + index * stair2.treadDepth, treadElevation - stair2.riserHeight / 2, stair2.bounds.y1 + stair2Width / 2],
          dark,
        ),
      );
    }
  };
  addStair2Flight(stair2.bounds.x1, stair2.lowerElevation);
  const stair2SecondStart = stair2.bounds.x1 + stair2.flightRun + stair2.midLandingLength;
  addStair2Flight(stair2SecondStart, stair2.midLandingElevation);
  stair2Group.add(
    box([stair2.midLandingLength, 0.16, stair2Width], [stair2.bounds.x1 + stair2.flightRun + stair2.midLandingLength / 2, stair2.midLandingElevation - 0.08, stair2.bounds.y1 + stair2Width / 2], dark),
    box([stair2.upperLandingLength, 0.16, stair2Width], [stair2.bounds.x2 - stair2.upperLandingLength / 2, stair2.upperElevation - 0.08, stair2.bounds.y1 + stair2Width / 2], dark),
  );
  const stair2StringerZs = [
    stair2.bounds.y1 + stringerInset,
    stair2.bounds.y2 - stringerInset,
  ];
  for (const z of stair2StringerZs) {
    stair2Group.add(
      beamBetween(
        new THREE.Vector3(stair2.bounds.x1 + 0.1, stair2.lowerElevation - 0.1, z),
        new THREE.Vector3(stair2.bounds.x1 + stair2.flightRun - 0.1, stair2.midLandingElevation - 0.1, z),
        0.2,
        0.12,
        dark,
      ),
      box([stair2.midLandingLength, 0.2, 0.12], [
        stair2.bounds.x1 + stair2.flightRun + stair2.midLandingLength / 2,
        stair2.midLandingElevation - 0.18,
        z,
      ], dark),
      beamBetween(
        new THREE.Vector3(stair2SecondStart + 0.1, stair2.midLandingElevation - 0.1, z),
        new THREE.Vector3(stair2.bounds.x2 - stair2.upperLandingLength - 0.1, stair2.upperElevation - 0.1, z),
        0.2,
        0.12,
        dark,
      ),
      box([stair2.upperLandingLength, 0.2, 0.12], [
        stair2.bounds.x2 - stair2.upperLandingLength / 2,
        stair2.upperElevation - 0.18,
        z,
      ], dark),
    );
  }
  layer('circulation').add(stair2Group);
  tag(stair2Group, {
    entityId: stair2.entityId, label: 'ST-02 懸空式正交樓梯', status: 'working',
    description: `2F 起步端 X${stair2.lowerStartX.toFixed(1)}，固定於 Y${stair2.bounds.y1.toFixed(1)}～${stair2.bounds.y2.toFixed(1)}，全程朝 +X 上行至 3F；${stair2.riserCount} 級高、薄踏步與封閉踢面由兩道連續深色鋼箱梯梁及懸空平台承托，梯下保持開放。結構、扶手、防火與避難仍待專業核定。`,
    openItemId: stair2.openItemId,
  }, selectables);

  const underStair = stair2.underStairLandscape;
  const underStairGroup = new THREE.Group();
  const underStairXStep = (underStair.bounds.x2 - underStair.bounds.x1) / underStair.planterCount;
  for (let index = 0; index < underStair.planterCount; index += 1) {
    const x = underStair.bounds.x1 + underStairXStep * (index + 0.5);
    const z = index % 2 === 0
      ? underStair.bounds.y1 + 0.28
      : underStair.bounds.y2 - 0.28;
    underStairGroup.add(
      box([0.36, 0.28, 0.36], [x, stair2.lowerElevation + 0.14, z], siteMaterial),
      box([0.16, 0.28 + index * 0.05, 0.16], [x, stair2.lowerElevation + 0.42 + index * 0.025, z], planterMaterial),
    );
  }
  layer('circulation').add(underStairGroup);
  tag(underStairGroup, {
    entityId: underStair.entityId,
    label: 'ST-02 梯下輕量造景植栽',
    status: 'working',
    description: `${underStair.planterCount} 組低矮、耐陰、低落葉且可移除的輕量盆栽；不設深土槽、水景或固定於梯梁的灌溉設備。`,
    openItemId: underStair.openItemId,
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

  const pv = l3Data.pvRoofReserve;
  const pvMaterial = new THREE.MeshStandardMaterial({
    color: 0x244d73, roughness: 0.42, metalness: 0.28, side: THREE.DoubleSide,
  });
  const pvGridMaterial = new THREE.LineBasicMaterial({ color: 0x8fc4e5, transparent: true, opacity: 0.78 });
  const pvGroup = new THREE.Group();
  pvGroup.add(horizontalPolygon([
    [pv.bounds.x1, pv.bounds.y1],
    [pv.bounds.x2, pv.bounds.y1],
    [pv.bounds.x2, pv.bounds.y2],
    [pv.bounds.x1, pv.bounds.y2],
  ], pv.baseElevation, pvMaterial));
  for (let x = pv.bounds.x1; x <= pv.bounds.x2 + 0.01; x += 0.75) {
    pvGroup.add(line([
      new THREE.Vector3(Math.min(x, pv.bounds.x2), pv.baseElevation + 0.012, pv.bounds.y1),
      new THREE.Vector3(Math.min(x, pv.bounds.x2), pv.baseElevation + 0.012, pv.bounds.y2),
    ], pvGridMaterial));
  }
  for (let z = pv.bounds.y1; z <= pv.bounds.y2 + 0.01; z += 1.125) {
    pvGroup.add(line([
      new THREE.Vector3(pv.bounds.x1, pv.baseElevation + 0.012, Math.min(z, pv.bounds.y2)),
      new THREE.Vector3(pv.bounds.x2, pv.baseElevation + 0.012, Math.min(z, pv.bounds.y2)),
    ], pvGridMaterial));
  }
  layer('energy').add(pvGroup);
  tag(pvGroup, {
    entityId: pv.entityId,
    label: '3F 屋頂太陽能預留區',
    status: 'working',
    description: `${pv.area.toFixed(1)} m² 輕量太陽能屋頂／棚架概念預留，須由固定核心或直接支承線獨立承載；模組排布、容量與發電量尚未定案。儲能優先設於地面層獨立戶外機櫃，3F 一般室內不配置電池。`,
    openItemId: pv.openItemId,
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
    new THREE.Vector3(35.75, 0.16, 10.75),
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

  return { scene, worldRoot, siteRoot, layerGroups, selectables, lights: { sun, ambient } };
}
