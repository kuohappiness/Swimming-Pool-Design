import * as THREE from 'three';
import type { ViewerModel } from './model-adapter';
import type { MaterialRegistry } from './rendering/contracts';
import type { SelectableInfo } from './scene-factory';

// DEC-157: shoes stay at the entry, the foot of ST-01 is the dry/wet boundary.
// DEC-158: a removable teaching platform in the shallow end of the teaching band.
// Every size comes from model.geometry.l1.poolUse / pool.teachingPlatform.

type Tag = (object: THREE.Object3D, info: Omit<SelectableInfo, 'object'>, selectables: SelectableInfo[]) => void;
type Bounds = { x1: number; x2: number; y1: number; y2: number };

const box = (size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};
const slab = (b: Bounds, bottom: number, top: number, material: THREE.Material) => box(
  [b.x2 - b.x1, top - bottom, b.y2 - b.y1],
  [(b.x1 + b.x2) / 2, (bottom + top) / 2, (b.y1 + b.y2) / 2],
  material,
);
const size = (b: Bounds) => `${(b.x2 - b.x1).toFixed(2)} × ${(b.y2 - b.y1).toFixed(2)} m`;

function category<T extends THREE.Object3D>(object: T, renderCategory: 'structure' | 'small-furnishing'): T {
  object.userData.renderCategory = renderCategory;
  return object;
}

function slopedRail(x1: number, x2: number, y: number, z1: number, z2: number, material: THREE.Material) {
  const length = Math.hypot(x2 - x1, z2 - z1);
  const rail = box([length, 0.04, 0.04], [(x1 + x2) / 2, (z1 + z2) / 2, y], material);
  rail.rotation.z = Math.atan2(z2 - z1, x2 - x1);
  return rail;
}

/**
 * Pool-hall deck at +0.30 m with the DEC-157 entry cut out: the vestibule stays
 * at the L1 base level and the ramp/steps climb to the deck. Pieces inside the
 * Y0 band (Y0 to the pool edge) are returned separately for the pool cutaway.
 */
export function createPoolUseDeck(model: ViewerModel, materials: MaterialRegistry) {
  const use = model.geometry.l1.poolUse;
  const pool = model.geometry.pool;
  const deck = pool.deckElevation.value;
  const deckMaterial = materials.get('pool-deck');
  const poolX0 = pool.bounds.x1;
  const poolX1 = pool.bounds.x2;
  const poolY0 = pool.bounds.y1;
  const vestibule = use.entryVestibule.bounds;
  const ramp = use.entryRamp.bounds;
  const steps = use.entrySteps.bounds;
  const base = use.entryVestibule.floorElevation;

  const westDeck = new THREE.Group();
  westDeck.add(
    slab({ x1: 0, x2: poolX0, y1: vestibule.y2, y2: model.geometry.site.width }, 0, deck, deckMaterial),
    // Outside strip west of the Y0 glass, kept at the deck level as before.
    slab({ x1: 0, x2: vestibule.x1, y1: 0, y2: vestibule.y2 }, 0, deck, deckMaterial),
  );
  const y0Band = new THREE.Group();
  y0Band.name = 'CUTAWAY-HIDE-Y0-POOL-DECK';
  y0Band.add(
    // Wet deck between the dry-corridor wall and the pool edge.
    slab({ x1: poolX0, x2: poolX1, y1: vestibule.y2, y2: poolY0 }, 0, deck, deckMaterial),
    // Corridor beside the ramp, then on to the pool's far end.
    slab({ x1: steps.x2, x2: ramp.x2, y1: ramp.y2, y2: vestibule.y2 }, 0, deck, deckMaterial),
    slab({ x1: ramp.x2, x2: poolX1, y1: 0, y2: vestibule.y2 }, 0, deck, deckMaterial),
  );
  const vestibuleFloor = slab(vestibule, base - 0.04, base + 0.005, materials.get('interior-tile'));
  vestibuleFloor.name = 'POOL-USE-ENTRY-FLOOR';
  y0Band.add(vestibuleFloor);
  return { westDeck, y0Band };
}

export function createPoolUseDetails(
  model: ViewerModel,
  materials: MaterialRegistry,
  tag: Tag,
  selectables: SelectableInfo[],
  water: { surface: number; shallowBottom: number; deepBottom: number },
) {
  const use = model.geometry.l1.poolUse;
  const pool = model.geometry.pool;
  const deck = pool.deckElevation.value;
  const metal = materials.get('sanitary-metal');
  const rail = materials.get('pool-rail');
  const concrete = materials.get('exposed-concrete-l1');
  const fixture = materials.get('interior-fixture');
  const sanitary = materials.get('sanitary-fixture');
  const wet = materials.get('wet-surface');
  const zone = materials.get('program-zone');
  const y0Band = new THREE.Group();
  y0Band.name = 'CUTAWAY-HIDE-Y0-POOL-USE';
  const elsewhere = new THREE.Group();
  elsewhere.name = 'POOL-USE-DETAILS';

  // 1. Shoe-change vestibule: cubbies line the west wall and the Y2 edge, a bench in the middle.
  const vestibule = use.entryVestibule.bounds;
  const base = use.entryVestibule.floorElevation;
  const entry = new THREE.Group();
  entry.add(
    category(box([0.35, 1.2, vestibule.y2 - vestibule.y1 - 0.2], [vestibule.x1 + 0.175, base + 0.6, (vestibule.y1 + vestibule.y2) / 2 + 0.1], materials.get('locker')), 'small-furnishing'),
    category(box([vestibule.x2 - vestibule.x1 - 0.35, 1.2, 0.35], [(vestibule.x1 + 0.35 + vestibule.x2) / 2, base + 0.6, vestibule.y2 - 0.175], materials.get('locker')), 'small-furnishing'),
    category(box([2.4, 0.42, 0.32], [(vestibule.x1 + vestibule.x2) / 2 + 0.3, base + 0.21, vestibule.y1 + 1.05], fixture), 'small-furnishing'),
  );
  y0Band.add(entry);
  tag(entry, {
    entityId: use.entryVestibule.entityId, label: '入口換鞋玄關', status: 'working',
    description: `${size(vestibule)}，±${base.toFixed(2)} m；鞋櫃約 ${use.entryVestibule.shoeCubbyPairs} 雙（換班時兩班同時在場）與坐凳。鞋子留在這裡，之後全程穿襪或赤腳。`,
  }, selectables);

  // 2. Ramp and two steps from ±0.00 to the +0.30 m deck.
  const ramp = use.entryRamp.bounds;
  const rise = use.entryRamp.toElevation - use.entryRamp.fromElevation;
  const wedge = new THREE.Shape([
    new THREE.Vector2(ramp.x1, use.entryRamp.fromElevation),
    new THREE.Vector2(ramp.x2, use.entryRamp.fromElevation),
    new THREE.Vector2(ramp.x2, use.entryRamp.toElevation),
  ]);
  const rampSurface = new THREE.Mesh(
    new THREE.ExtrudeGeometry(wedge, { depth: ramp.y2 - ramp.y1, bevelEnabled: false }),
    materials.get('pool-deck'),
  );
  rampSurface.position.z = ramp.y1;
  rampSurface.castShadow = true;
  rampSurface.receiveShadow = true;
  const access = new THREE.Group();
  access.add(category(rampSurface, 'structure'));
  for (const y of [ramp.y1 + 0.08, ramp.y2 - 0.05]) {
    access.add(category(slopedRail(ramp.x1, ramp.x2, y, use.entryRamp.fromElevation + 0.85, use.entryRamp.toElevation + 0.85, rail), 'small-furnishing'));
  }
  const steps = use.entrySteps.bounds;
  for (let index = 0; index < use.entrySteps.risers; index += 1) {
    const top = use.entrySteps.fromElevation + use.entrySteps.riserHeight * (index + 1);
    access.add(category(box(
      [use.entrySteps.treadDepth, top - use.entrySteps.fromElevation, steps.y2 - steps.y1],
      [steps.x1 + use.entrySteps.treadDepth * (index + 0.5), (use.entrySteps.fromElevation + top) / 2, (steps.y1 + steps.y2) / 2],
      materials.get('pool-deck'),
    ), 'structure'));
  }
  y0Band.add(access);
  tag(access, {
    entityId: use.entryRamp.entityId, label: '入口坡道與兩階', status: 'working',
    description: `坡道 1:${use.entryRamp.slopeRatio}、長 ${(ramp.x2 - ramp.x1).toFixed(2)} m，兩側扶手；旁邊兩階各 ${use.entrySteps.riserHeight.toFixed(2)} m，共升 ${rise.toFixed(2)} m。坡度、平台與扶手細節待無障礙規範覆核。`,
    openItemId: 'OPEN-009',
  }, selectables);

  // 3. Dry corridor: a dry floor finish and a 1.1 m low wall with a splash curb.
  const corridor = use.dryCorridor.bounds;
  const parapet = use.dryCorridorParapet;
  const dry = new THREE.Group();
  dry.add(
    category(slab({ x1: ramp.x2, x2: corridor.x2, y1: corridor.y1, y2: corridor.y2 }, deck, deck + 0.008, materials.get('interior-tile')), 'structure'),
    category(slab({ x1: steps.x2, x2: ramp.x2, y1: ramp.y2, y2: corridor.y2 }, deck, deck + 0.008, materials.get('interior-tile')), 'structure'),
    category(slab(parapet.bounds, deck, deck + parapet.height, concrete), 'structure'),
    category(slab({ ...parapet.bounds, y1: parapet.bounds.y2, y2: parapet.bounds.y2 + 0.12 }, deck, deck + parapet.curbHeight, concrete), 'structure'),
  );
  y0Band.add(dry);
  tag(dry, {
    entityId: use.dryCorridor.entityId, label: '乾式廊道', status: 'working',
    description: `${size(corridor)}，+${use.dryCorridor.floorElevation.toFixed(2)} m；著襪或乾腳由玄關走到 ST-01。沿 Y${parapet.bounds.y1.toFixed(2)} 設 ${parapet.height.toFixed(1)} m 低牆與止水緣，與濕池畔分開。`,
  }, selectables);

  // 4. Rinse gate at the foot of ST-01: foot bath, three showers and the AED.
  const rinse = use.rinseGate.bounds;
  const gate = new THREE.Group();
  const bathDepth = 1.0;
  gate.add(category(slab({ x1: rinse.x1, x2: rinse.x2 - 0.9, y1: (rinse.y1 + rinse.y2) / 2 - bathDepth / 2, y2: (rinse.y1 + rinse.y2) / 2 + bathDepth / 2 }, deck, deck + 0.012, wet), 'structure'));
  const spacing = (rinse.x2 - rinse.x1) / use.rinseGate.showerHeads;
  for (let index = 0; index < use.rinseGate.showerHeads; index += 1) {
    const x = rinse.x1 + spacing * (index + 0.5);
    gate.add(
      category(box([0.07, 2.2, 0.07], [x, deck + 1.1, rinse.y1 + 0.12], metal), 'small-furnishing'),
      category(box([0.06, 0.05, 0.4], [x, deck + 2.15, rinse.y1 + 0.32], metal), 'small-furnishing'),
    );
  }
  const [aedX, aedY] = use.aed.position;
  gate.add(
    category(box([0.08, 1.2, 0.08], [aedX, deck + 0.6, aedY], metal), 'small-furnishing'),
    category(box([0.4, 0.5, 0.16], [aedX, deck + 1.35, aedY], materials.get('signage')), 'small-furnishing'),
  );
  y0Band.add(gate);
  tag(gate, {
    entityId: use.rinseGate.entityId, label: '梯底洗腳池與沖身', status: 'working',
    description: `${size(rinse)}；下 ST-01 到池畔的唯一通路，洗腳池加 ${use.rinseGate.showerHeads} 支沖身，老師在這裡看得到每個人是否沖過。洗腳池旁留平面繞行給輪椅；AED 設在廊道端。`,
  }, selectables);

  // 5. Assembly deck and lifeguard chair.
  const assembly = use.assemblyArea.bounds;
  const muster = category(slab(assembly, deck, deck + 0.006, zone), 'structure');
  y0Band.add(muster);
  tag(muster, {
    entityId: use.assemblyArea.entityId, label: '池畔集合區', status: 'working',
    description: `${size(assembly)}；一班 ${use.assemblyArea.seatedClassCapacity} 人坐下點名，面向淺端分組教學。`,
  }, selectables);
  const chairBounds = use.lifeguardChair.bounds;
  const seat = use.lifeguardChair.seatHeight;
  const chair = new THREE.Group();
  for (const x of [chairBounds.x1 + 0.05, chairBounds.x2 - 0.05]) {
    for (const y of [chairBounds.y1 + 0.05, chairBounds.y2 - 0.05]) {
      chair.add(category(box([0.05, seat, 0.05], [x, deck + seat / 2, y], rail), 'small-furnishing'));
    }
  }
  chair.add(
    category(box([chairBounds.x2 - chairBounds.x1, 0.06, 0.5], [(chairBounds.x1 + chairBounds.x2) / 2, deck + seat, (chairBounds.y1 + chairBounds.y2) / 2], fixture), 'small-furnishing'),
    category(box([chairBounds.x2 - chairBounds.x1, 0.5, 0.05], [(chairBounds.x1 + chairBounds.x2) / 2, deck + seat + 0.28, chairBounds.y1 + 0.3], fixture), 'small-furnishing'),
  );
  y0Band.add(chair);
  tag(chair, {
    entityId: use.lifeguardChair.entityId, label: '救生椅', status: 'working',
    description: `座高 ${seat.toFixed(1)} m，橫看全池；管理暨急救室由 X31 縱看，兩個視點互補。救生配置待專業確認。`,
  }, selectables);

  // 6–7. Accessible family room and staff/first-aid room in the service wing.
  const accessible = use.accessibleChanging.bounds;
  const room = new THREE.Group();
  const roomFloor = use.accessibleChanging.floorElevation;
  room.add(
    category(slab(accessible, roomFloor - 0.1, roomFloor, zone), 'structure'),
    category(box([0.42, 0.42, 0.7], [accessible.x2 - 0.45, roomFloor + 0.21, accessible.y1 + 0.4], sanitary), 'small-furnishing'),
    category(box([0.55, 0.16, 0.45], [accessible.x1 + 1.6, roomFloor + 0.8, accessible.y1 + 0.24], sanitary), 'small-furnishing'),
    category(slab({ x1: accessible.x2 - 1.1, x2: accessible.x2 - 0.05, y1: accessible.y2 - 1.15, y2: accessible.y2 - 0.1 }, roomFloor, roomFloor + 0.012, wet), 'structure'),
    category(box([1.2, 0.45, 0.45], [accessible.x1 + 1.2, roomFloor + 0.225, accessible.y2 - 0.25], fixture), 'small-furnishing'),
  );
  elsewhere.add(room);
  tag(room, {
    entityId: use.accessibleChanging.entityId, label: '無障礙暨親子更衣淋浴廁所', status: 'working',
    description: `${size(accessible)}，由 X31 池畔進出、與池畔同為 +${roomFloor.toFixed(2)} m；含無障礙廁所、淋浴與親子更衣檯。淨空間與器具配置待無障礙規範覆核。`,
    openItemId: 'OPEN-009',
  }, selectables);
  const staff = use.staffFirstAid.bounds;
  const office = new THREE.Group();
  const officeFloor = use.staffFirstAid.floorElevation;
  office.add(
    category(slab(staff, officeFloor - 0.1, officeFloor, zone), 'structure'),
    category(box([0.6, 0.75, 1.2], [staff.x1 + 0.45, officeFloor + 0.375, staff.y2 - 1.0], fixture), 'small-furnishing'),
    category(box([0.7, 0.6, 1.9], [staff.x2 - 0.45, officeFloor + 0.3, (staff.y1 + staff.y2) / 2], fixture), 'small-furnishing'),
  );
  elsewhere.add(office);
  tag(office, {
    entityId: use.staffFirstAid.entityId, label: '管理暨急救室', status: 'working',
    description: `${size(staff)}；面向 X31 開窗，縱看 25 m 全池。急救後送可沿既有受控服務動線到 X39 外側，是否可行待專業確認。`,
    openItemId: 'OPEN-018',
  }, selectables);

  // 8. Equipment carts and the mobile pool lift.
  const parking = use.equipmentParking.bounds;
  const carts = new THREE.Group();
  const cartWidth = (parking.x2 - parking.x1 - 0.6) / 2;
  for (let index = 0; index < 2; index += 1) {
    carts.add(category(box([cartWidth, 0.9, parking.y2 - parking.y1 - 0.5], [parking.x1 + 0.2 + cartWidth * (index + 0.5) + 0.2 * index, deck + 0.45, (parking.y1 + parking.y2) / 2], materials.get('equipment')), 'small-furnishing'));
  }
  elsewhere.add(carts);
  tag(carts, {
    entityId: use.equipmentParking.entityId, label: '教具推車停放區', status: 'working',
    description: `${size(parking)}；浮板與浮條推車，接手原乾式儲物間的教具功能。`,
  }, selectables);
  const lift = use.poolLift.bounds;
  const liftX = (lift.x1 + lift.x2) / 2;
  const liftY = (lift.y1 + lift.y2) / 2;
  const liftGroup = new THREE.Group();
  liftGroup.add(
    category(box([lift.x2 - lift.x1, 0.18, lift.y2 - lift.y1], [liftX, deck + 0.09, liftY], rail), 'small-furnishing'),
    category(box([0.12, 1.45, 0.12], [liftX, deck + 0.9, liftY], rail), 'small-furnishing'),
    category(box([0.9, 0.08, 0.08], [liftX - 0.45, deck + 1.6, liftY], rail), 'small-furnishing'),
    category(box([0.46, 0.06, 0.46], [liftX - 0.85, deck + 0.75, liftY], fixture), 'small-furnishing'),
  );
  liftGroup.userData.batchExclude = true;
  liftGroup.traverse((child) => { child.userData.batchExclude = true; });
  elsewhere.add(liftGroup);
  tag(liftGroup, {
    entityId: use.poolLift.entityId, label: '移動式入水升降椅', status: 'working',
    description: '平時停在東側池畔、靠近無障礙室，需要時可推到淺端使用；不改池體。',
  }, selectables);

  // DEC-158: removable teaching platform, top set by its water depth.
  const platform = pool.teachingPlatform;
  const top = water.surface - platform.topWaterDepth;
  const slope = (water.deepBottom - water.shallowBottom) / pool.length.value;
  const bottom = water.shallowBottom + slope * (platform.bounds.x2 - pool.origin[0]);
  const platformMesh = category(slab(platform.bounds, bottom, top, materials.get('interior-tile')), 'structure');
  platformMesh.name = 'POOL-PLAT-01';
  platformMesh.userData.batchExclude = true;
  tag(platformMesh, {
    entityId: platform.entityId, label: '可移除水中教學平台', status: 'working',
    description: `${size(platform.bounds)}，位於 3.0 m 教學帶淺端；平台面水深 ${platform.topWaterDepth.toFixed(2)} m，讓初學者站立。池深仍為 ${pool.shallowDepth.value.toFixed(1)}～${pool.deepDepth.value.toFixed(1)} m。固定、防滑與收納待專業確認。`,
  }, selectables);

  return { y0Band, elsewhere, platform: platformMesh };
}
