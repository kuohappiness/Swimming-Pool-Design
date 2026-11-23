import * as THREE from 'three';
import type { ViewerModel } from './model-adapter';
import type { MaterialRegistry } from './rendering/contracts';
import { markVisualDetail } from './rendering/visual-detail';
import { l3RectMinusStairOpening, slabGeometry } from './l3-stair-opening';

/**
 * 3F 觀課與環境教育室（DEC-173，TASK-153）：玻璃隔間、兩個分區、入口與教室裡的示意家具；
 * 地面範圍扣掉 ST-02 樓梯口，桌椅排在樓梯口西側（DEC-174，TASK-154）。
 *
 * 全部畫在 3F 旋轉群組的座標裡：x = 旋轉前的 X − 支點 X，z = 旋轉前的 Y − 支點 Y，y 從 3F 樓板面算起。
 * 分區與玻璃隔間的位置只取自模型；維修門的位置照 3F 平面圖（模型還沒有門的資料）。
 * 桌椅、螢幕與能源看板是視覺示意：數量照「約半班」畫 15 個座位，可移動、不是固定隔間；
 * 人數上限、隔音、攝影機與螢幕的規格待專業確認（`OPEN-009`）。
 */

export const L3_LEARNING_ROOM_FURNITURE_NAME = 'visual-only:L3-learning-room-furniture';

/** 玻璃隔間上鎖維修門的位置（旋轉前的 X），與 3F 平面圖相同。 */
const MAINTENANCE_DOOR_X: readonly [number, number] = [39.5, 40.5];
const DOOR_HEIGHT = 2.1;
/** 到達翼進教室的門寬：和 3F 景觀區的門同寬，位置在模型 `learningRoom.entryDoor` 那一段端牆的中間。 */
const ENTRY_DOOR_WIDTH = 0.9;
const GLASS_THICKNESS = 0.03;
const FRAME_WIDTH = 0.05;
const MULLION_SPACING = 1.75;
/** 3F 外牆厚度，與場景的 3F 牆相同（端牆 0.18、兩側 0.16）。 */
const END_WALL_THICKNESS = 0.18;
const SIDE_WALL_THICKNESS = 0.16;

const box = (
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

type L3Geometry = ViewerModel['geometry']['l3'];

/** 3F 旋轉群組座標裡的一個範圍（旋轉前的樓板座標減去支點）。 */
function l3LocalBounds(l3: L3Geometry, bounds: { x1: number; x2: number; y1: number; y2: number }) {
  return {
    x1: bounds.x1 - l3.planPivot.x,
    x2: bounds.x2 - l3.planPivot.x,
    z1: bounds.y1 - l3.planPivot.y,
    z2: bounds.y2 - l3.planPivot.y,
  };
}

/**
 * 教室門所在的端牆段（旋轉群組座標的 z 範圍）。到達翼不旋轉、3F 樓板旋轉，兩者沿端牆相接，
 * 但靠樓梯的那一段在 ST-02 樓梯口裡；門用模型 `learningRoom.entryDoor` 指定的那一段（DEC-175）。
 * 不在端牆上就是模型改了，教室的入口要重新對。
 */
export function arrivalContactOnEndWall(l3: L3Geometry): [number, number] {
  const radians = THREE.MathUtils.degToRad(l3.planRotation.value);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfLength = l3.length / 2;
  const touching = l3.learningRoom.entryDoor.wallSegment
    .map(([x, y]) => {
      const dx = x - l3.planPivot.x;
      const dy = y - l3.planPivot.y;
      // SITE 順時針旋轉的反向：把 SITE 點轉回旋轉前的樓板座標。
      return { x: dx * cos - dy * sin, z: dx * sin + dy * cos };
    })
    .filter(({ x }) => Math.abs(x - halfLength) < 0.05)
    .map(({ z }) => z);
  if (touching.length < 2) {
    throw new TypeError('3F 教室門必須在旋轉後的 3F 端牆上（DEC-175）。');
  }
  return [Math.min(...touching), Math.max(...touching)];
}

/** 隔間玻璃的外形：從鏡牆（下緣在樓板邊、上緣隨外傾往外）到端牆內側，挖掉維修門。 */
function partitionGlassShape(
  left: number,
  leftTop: number,
  right: number,
  height: number,
  door: [number, number],
) {
  const shape = new THREE.Shape();
  shape.moveTo(left, 0);
  shape.lineTo(door[0], 0);
  shape.lineTo(door[0], DOOR_HEIGHT);
  shape.lineTo(door[1], DOOR_HEIGHT);
  shape.lineTo(door[1], 0);
  shape.lineTo(right, 0);
  shape.lineTo(right, height);
  shape.lineTo(leftTop, height);
  shape.closePath();
  return shape;
}

export interface L3LearningRoomParts {
  /** W-L3-GLASS-01：隔音玻璃、框與上鎖維修門。 */
  readonly partition: THREE.Group;
  /** Z-L3-LEARN-01 的地面範圍。 */
  readonly learningZone: THREE.Mesh;
  /** Z-L3-MEP-01 的地面範圍。 */
  readonly equipmentZone: THREE.Mesh;
  /** 鏡牆那一側的觀課螢幕、隔間這一側的能源看板與到達翼的入口門。 */
  readonly fixtures: THREE.Group;
  /** 可移動桌椅（中級以上才畫），排在樓梯口西側。 */
  readonly furniture: THREE.Group;
}

export function createL3LearningRoom(
  model: ViewerModel,
  materials: MaterialRegistry,
): L3LearningRoomParts {
  const l3 = model.geometry.l3;
  const height = l3.volumeHeight.value;
  const halfLength = l3.length / 2;
  const halfWidth = l3.width / 2;
  const lean =
    Math.tan(THREE.MathUtils.degToRad(l3.mirror.leanFromVertical.value)) * l3.mirror.height.value;
  const endWallInside = halfLength - END_WALL_THICKNESS;
  const sideWallInside = halfWidth - SIDE_WALL_THICKNESS;

  const frame = materials.get('structural-steel');
  const glassMaterial = materials.get('safety-glass');
  const doorMaterial = materials.get('opening-marker');
  const screenMaterial = materials.get('sanitary-dark');

  const glass = l3LocalBounds(l3, l3.glassPartition.bounds);
  const partitionZ = (glass.z1 + glass.z2) / 2;
  const partitionDepth = glass.z2 - glass.z1;
  const door: [number, number] = [
    MAINTENANCE_DOOR_X[0] - l3.planPivot.x,
    MAINTENANCE_DOOR_X[1] - l3.planPivot.x,
  ];
  const left = glass.x1;
  if (!(left === -halfLength && door[0] > left && door[1] < endWallInside)) {
    throw new TypeError('3F 玻璃隔間須從鏡牆接到端牆，維修門在兩者之間。');
  }

  const partition = new THREE.Group();
  partition.name = `${l3.glassPartition.entityId}:PARTITION`;
  const glassGeometry = new THREE.ExtrudeGeometry(
    partitionGlassShape(left, left - lean, endWallInside, height, door),
    { depth: GLASS_THICKNESS, bevelEnabled: false },
  ).translate(0, 0, partitionZ - GLASS_THICKNESS / 2);
  const pane = new THREE.Mesh(glassGeometry, glassMaterial);
  pane.name = `${l3.glassPartition.entityId}:GLASS`;
  pane.castShadow = false;
  pane.receiveShadow = true;
  partition.add(pane);

  // 框與豎框佔隔間的整個厚度；鏡牆那一端的框跟著鏡牆外傾。
  const rail = (from: number, to: number, y: number) =>
    box([to - from, FRAME_WIDTH, partitionDepth], [(from + to) / 2, y, partitionZ], frame);
  partition.add(
    rail(left, door[0], FRAME_WIDTH / 2),
    rail(door[1], endWallInside, FRAME_WIDTH / 2),
    rail(left - lean, endWallInside, height - FRAME_WIDTH / 2),
    rail(door[0], door[1], DOOR_HEIGHT + FRAME_WIDTH / 2),
  );
  const slantLength = Math.hypot(lean, height);
  const slant = box(
    [FRAME_WIDTH, slantLength, partitionDepth],
    [left - lean / 2, height / 2, partitionZ],
    frame,
  );
  slant.rotation.z = Math.atan2(lean, height);
  partition.add(slant);
  for (let x = left + MULLION_SPACING; x < door[0] - 0.5; x += MULLION_SPACING) {
    partition.add(box([FRAME_WIDTH, height, partitionDepth], [x, height / 2, partitionZ], frame));
  }
  for (const x of door) {
    partition.add(box([FRAME_WIDTH, height, partitionDepth], [x, height / 2, partitionZ], frame));
  }
  const doorWidth = door[1] - door[0];
  const doorLeaf = box(
    [doorWidth - FRAME_WIDTH, DOOR_HEIGHT, 0.045],
    [(door[0] + door[1]) / 2, DOOR_HEIGHT / 2, partitionZ],
    doorMaterial,
  );
  doorLeaf.name = `${l3.glassPartition.entityId}:MAINTENANCE-DOOR`;
  partition.add(doorLeaf);
  // 門鎖在教室那一側（z 較小的一側），和框同一種材質，不多一次繪製。
  partition.add(box([0.05, 0.16, 0.04], [door[0] + 0.12, 1.05, partitionZ - 0.045], frame));

  // 分區的地面範圍扣掉樓梯口（教室被切掉一角，設備區沒有碰到）。
  const zone = (
    bounds: { x1: number; x2: number; y1: number; y2: number },
    material: THREE.Material,
    inset: [number, number],
  ) => {
    const local = l3LocalBounds(l3, bounds);
    const rect = {
      x1: local.x1,
      x2: Math.min(local.x2, endWallInside),
      z1: Math.max(local.z1, -sideWallInside) + inset[0],
      z2: Math.min(local.z2, sideWallInside) - inset[1],
    };
    const mesh = new THREE.Mesh(
      slabGeometry(l3RectMinusStairOpening(l3, rect), 0.002, 0.022),
      material,
    );
    mesh.receiveShadow = true;
    return mesh;
  };
  const learningZone = zone(l3.learningRoom.bounds, materials.get('program-zone'), [
    0,
    partitionDepth / 2,
  ]);
  learningZone.name = `${l3.learningRoom.entityId}:FLOOR`;
  const equipmentZone = zone(l3.equipmentZone.bounds, materials.get('equipment-zone'), [
    partitionDepth / 2,
    0,
  ]);
  equipmentZone.name = `${l3.equipmentZone.entityId}:FLOOR`;

  const room = l3LocalBounds(l3, l3.learningRoom.bounds);
  const roomZ1 = Math.max(room.z1, -sideWallInside);
  const roomZ2 = glass.z1;
  const roomCentreZ = (roomZ1 + roomZ2) / 2;

  const fixtures = new THREE.Group();
  fixtures.name = `${l3.learningRoom.entityId}:FIXTURES`;
  // 觀課螢幕：鏡牆那一側（鏡牆外傾、內面往外倒，螢幕立在牆腳前方的架上）。
  const screenX = left + 0.3;
  for (const offset of [-0.86, 0.86]) {
    const screen = box([0.06, 0.94, 1.66], [screenX, 1.47, roomCentreZ + offset], screenMaterial);
    screen.name = `${l3.learningRoom.entityId}:CAMERA-SCREEN`;
    fixtures.add(
      screen,
      box([0.05, 1.94, 0.06], [screenX - 0.06, 0.97, roomCentreZ + offset], frame),
    );
  }
  // 能源看板：玻璃隔間這一側、面向教室，掛在兩道豎框之間。
  const dashboardX = left + MULLION_SPACING * 4.5;
  const dashboard = box([1.3, 0.76, 0.05], [dashboardX, 1.55, glass.z1 - 0.07], screenMaterial);
  dashboard.name = `${l3.learningRoom.entityId}:ENERGY-DASHBOARD`;
  fixtures.add(dashboard, box([1.38, 0.84, 0.03], [dashboardX, 1.55, glass.z1 - 0.035], frame));
  // 從到達翼進教室的門：穿過端牆，兩面都看得到。
  const [contactZ1, contactZ2] = arrivalContactOnEndWall(l3);
  const entryZ = (contactZ1 + contactZ2) / 2;
  if (!(
    contactZ2 - contactZ1 >= ENTRY_DOOR_WIDTH &&
    entryZ - ENTRY_DOOR_WIDTH / 2 >= roomZ1 &&
    entryZ + ENTRY_DOOR_WIDTH / 2 <= roomZ2
  )) {
    throw new TypeError('3F 到達翼要從教室那一段端牆進入（DEC-173）。');
  }
  const entry = box(
    [END_WALL_THICKNESS + 0.04, DOOR_HEIGHT, ENTRY_DOOR_WIDTH],
    [halfLength - END_WALL_THICKNESS / 2, DOOR_HEIGHT / 2, entryZ],
    doorMaterial,
  );
  entry.name = `${l3.learningRoom.entityId}:ENTRY-DOOR`;
  fixtures.add(entry);

  // 可移動桌椅：三排、每排兩張桌子五張凳子，面向螢幕，排在樓梯口西側；教師桌在螢幕旁的角落。
  const furniture = markVisualDetail(new THREE.Group(), 'reduced');
  furniture.name = L3_LEARNING_ROOM_FURNITURE_NAME;
  const rows = [screenX + 2.4, screenX + 4.2, screenX + 6.0];
  const tables: Array<[number, number, number, number]> = rows.flatMap((x) => [
    [x, roomCentreZ - 0.65, 0.6, 1.2] as [number, number, number, number],
    [x, roomCentreZ + 0.65, 0.6, 1.2] as [number, number, number, number],
  ]);
  const teacherDesk: [number, number, number, number] = [screenX + 1.4, roomZ1 + 0.75, 0.7, 1.4];
  tables.push(teacherDesk);
  const seats: Array<[number, number]> = rows.flatMap((x) =>
    [-1, -0.5, 0, 0.5, 1].map((step) => [x + 0.6, roomCentreZ + step] as [number, number]),
  );
  seats.push([teacherDesk[0] + 0.6, teacherDesk[1]]);
  const matrix = new THREE.Matrix4();
  const tableTops = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.03, 1),
    materials.get('interior-fixture'),
    tables.length,
  );
  tableTops.name = `visual-only:L3-learning-room-tables:${tables.length}`;
  const tableLegs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.04, 0.72, 0.04),
    frame,
    tables.length * 4,
  );
  tableLegs.name = `visual-only:L3-learning-room-table-legs:${tables.length * 4}`;
  tables.forEach(([x, z, depth, width], index) => {
    matrix.makeScale(depth, 1, width).setPosition(x, 0.735, z);
    tableTops.setMatrixAt(index, matrix);
    [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ].forEach(([sx, sz], corner) => {
      matrix.makeTranslation(x + sx * (depth / 2 - 0.05), 0.36, z + sz * (width / 2 - 0.05));
      tableLegs.setMatrixAt(index * 4 + corner, matrix);
    });
  });
  const stools = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.17, 0.15, 0.46, 14).translate(0, 0.23, 0),
    materials.get('locker'),
    seats.length,
  );
  stools.name = `visual-only:L3-learning-room-stools:${seats.length}`;
  seats.forEach(([x, z], index) => {
    matrix.makeTranslation(x, 0, z);
    stools.setMatrixAt(index, matrix);
  });
  for (const mesh of [tableTops, tableLegs, stools]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    furniture.add(mesh);
  }
  furniture.userData.castVisualShadow = true;

  return { partition, learningZone, equipmentZone, fixtures, furniture };
}
