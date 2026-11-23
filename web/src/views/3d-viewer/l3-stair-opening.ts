import * as THREE from 'three';
import type { SiteBounds, ViewerModel } from './model-adapter';
import type { MaterialRegistry } from './rendering/contracts';

/**
 * 3F 樓梯口 `OP-L3-ST-02-01`（DEC-174，TASK-154）：ST-02 穿過 3F 的地方，在 2F 天花、
 * 旋轉的 3F 樓板與不旋轉的到達翼、擴板上開口，除了樓梯頂端以外三邊設防墜欄杆（DEC-175）。
 *
 * 樓梯口是 SITE 座標裡的矩形，3F 樓板卻跟著平面旋轉，所以每個被切的面都先轉成 SITE 的凸多邊形、
 * 減掉樓梯口拆成幾塊凸多邊形，再轉回各自的座標畫。拼起來的面在接縫處共用頂點，
 * 側面只畫外緣，混凝土的稜線才不會在接縫多畫一條。
 */

/** 平面上的一點：SITE 的 [X, Y]，或 3F 旋轉群組的 [x, z]。 */
export type PlanPoint = readonly [number, number];

type L3Geometry = ViewerModel['geometry']['l3'];

/** 欄杆高度：沿用 3D 景觀區欄杆的 1.15 m 當示意，實際高度待專業確認（`OPEN-019`）。 */
export const STAIR_OPENING_GUARDRAIL_HEIGHT = 1.15;
const GUARDRAIL_POST = 0.05;
const GUARDRAIL_GLASS = 0.02;
const EPSILON = 1e-9;

export function polygonArea(polygon: readonly PlanPoint[]) {
  let twice = 0;
  polygon.forEach(([x, y], index) => {
    const [nextX, nextY] = polygon[(index + 1) % polygon.length];
    twice += x * nextY - nextX * y;
  });
  return Math.abs(twice) / 2;
}

/** 用一條軸向的線切凸多邊形，留下 keep 那一側；切點那一軸直接取線的值，接縫兩邊才會完全相同。 */
function clipAxis(
  polygon: readonly PlanPoint[],
  axis: 0 | 1,
  value: number,
  keep: 'below' | 'above',
): PlanPoint[] {
  const inside = (point: PlanPoint) =>
    keep === 'below' ? point[axis] <= value + EPSILON : point[axis] >= value - EPSILON;
  const cut = (a: PlanPoint, b: PlanPoint): PlanPoint => {
    const t = (value - a[axis]) / (b[axis] - a[axis]);
    const other = 1 - axis;
    const point: [number, number] = [0, 0];
    point[axis] = value;
    point[other] = a[other] + t * (b[other] - a[other]);
    return point;
  };
  const output: PlanPoint[] = [];
  polygon.forEach((point, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    if (inside(point)) {
      if (!inside(previous)) output.push(cut(previous, point));
      output.push(point);
    } else if (inside(previous)) {
      output.push(cut(previous, point));
    }
  });
  // 頂點剛好在切線上時，切點和頂點重合；去掉重複的點，免得出現長度為零的邊。
  return output.filter(
    (point, index) =>
      pointKey(point) !== pointKey(output[(index + output.length - 1) % output.length]),
  );
}

const isPiece = (polygon: readonly PlanPoint[]) =>
  polygon.length >= 3 && polygonArea(polygon) > 1e-6;

/** 凸多邊形減掉一個軸向矩形，拆成至多四塊凸多邊形（矩形下方、上方、左邊、右邊）。 */
export function subtractBounds(polygon: readonly PlanPoint[], bounds: SiteBounds): PlanPoint[][] {
  const band = clipAxis(clipAxis(polygon, 1, bounds.y1, 'above'), 1, bounds.y2, 'below');
  return [
    clipAxis(polygon, 1, bounds.y1, 'below'),
    clipAxis(polygon, 1, bounds.y2, 'above'),
    clipAxis(band, 0, bounds.x1, 'below'),
    clipAxis(band, 0, bounds.x2, 'above'),
  ].filter(isPiece);
}

/** 凸多邊形與軸向矩形的交集；沒有交集時回傳空陣列。 */
export function intersectBounds(polygon: readonly PlanPoint[], bounds: SiteBounds): PlanPoint[] {
  const clipped = clipAxis(
    clipAxis(
      clipAxis(clipAxis(polygon, 0, bounds.x1, 'above'), 0, bounds.x2, 'below'),
      1,
      bounds.y1,
      'above',
    ),
    1,
    bounds.y2,
    'below',
  );
  return isPiece(clipped) ? clipped : [];
}

/** SITE 點轉成 3F 旋轉群組的座標（旋轉前的樓板座標減去支點）。 */
export function siteToL3Plan(l3: L3Geometry, [x, y]: PlanPoint): PlanPoint {
  const radians = THREE.MathUtils.degToRad(l3.planRotation.value);
  const dx = x - l3.planPivot.x;
  const dy = y - l3.planPivot.y;
  return [
    dx * Math.cos(radians) - dy * Math.sin(radians),
    dx * Math.sin(radians) + dy * Math.cos(radians),
  ];
}

/** 3F 旋轉群組的座標轉回 SITE（繞支點順時針旋轉，和 3F 平面圖相同）。 */
export function l3PlanToSite(l3: L3Geometry, [x, z]: PlanPoint): PlanPoint {
  const radians = THREE.MathUtils.degToRad(l3.planRotation.value);
  return [
    l3.planPivot.x + x * Math.cos(radians) + z * Math.sin(radians),
    l3.planPivot.y - x * Math.sin(radians) + z * Math.cos(radians),
  ];
}

/**
 * 3F 旋轉群組裡的一個矩形（x1～x2、z1～z2）扣掉樓梯口，回傳群組座標的幾塊凸多邊形。
 * margin 把樓梯口每邊放大一點：3F 樓板和 2F 天花疊在同一個高度範圍，切面放大後藏進 2F 天花裡，
 * 兩個切面才不會重疊閃爍。
 */
export function l3RectMinusStairOpening(
  l3: L3Geometry,
  rect: { x1: number; x2: number; z1: number; z2: number },
  margin = 0,
): PlanPoint[][] {
  const corners: PlanPoint[] = [
    [rect.x1, rect.z1],
    [rect.x2, rect.z1],
    [rect.x2, rect.z2],
    [rect.x1, rect.z2],
  ];
  const { x1, x2, y1, y2 } = l3.stairOpening.bounds;
  return subtractBounds(
    corners.map((point) => l3PlanToSite(l3, point)),
    { x1: x1 - margin, x2: x2 + margin, y1: y1 - margin, y2: y2 + margin },
  ).map((piece) => piece.map((point) => siteToL3Plan(l3, point)));
}

/** 3F 旋轉群組裡的一個矩形落在樓梯口裡的部分（群組座標）。 */
export function l3RectWithinStairOpening(
  l3: L3Geometry,
  rect: { x1: number; x2: number; z1: number; z2: number },
): PlanPoint[] {
  const corners: PlanPoint[] = [
    [rect.x1, rect.z1],
    [rect.x2, rect.z1],
    [rect.x2, rect.z2],
    [rect.x1, rect.z2],
  ];
  return intersectBounds(
    corners.map((point) => l3PlanToSite(l3, point)),
    l3.stairOpening.bounds,
  ).map((point) => siteToL3Plan(l3, point));
}

const pointKey = ([x, y]: PlanPoint) => `${x.toFixed(6)},${y.toFixed(6)}`;
const edgeKey = (a: PlanPoint, b: PlanPoint) => {
  const [first, second] = [pointKey(a), pointKey(b)].sort();
  return `${first}|${second}`;
};

/** 每塊轉成逆時針（從上往下看、第二軸朝下），並在邊上補進別塊落在邊上的頂點，接縫兩邊的邊才對得上。 */
function weldPieces(pieces: readonly (readonly PlanPoint[])[]) {
  const vertices = pieces.flat();
  const rings = pieces.map((piece) => {
    let signed = 0;
    piece.forEach(([x, y], index) => {
      const [nextX, nextY] = piece[(index + 1) % piece.length];
      signed += x * nextY - nextX * y;
    });
    const ordered = signed < 0 ? piece : [...piece].reverse();
    const ring: PlanPoint[] = [];
    ordered.forEach((a, index) => {
      const b = ordered[(index + 1) % ordered.length];
      ring.push(a);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const lengthSquared = dx * dx + dy * dy;
      const between = vertices
        .map((point) => ({
          point,
          t: ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared,
          offset:
            Math.abs((point[0] - a[0]) * dy - (point[1] - a[1]) * dx) / Math.sqrt(lengthSquared),
        }))
        .filter(({ t, offset }) => offset < 1e-7 && t > 1e-7 && t < 1 - 1e-7)
        .sort((first, second) => first.t - second.t);
      for (const { point } of between) {
        if (pointKey(point) !== pointKey(ring[ring.length - 1])) ring.push(point);
      }
    });
    return ring;
  });
  const edgeCounts = new Map<string, number>();
  for (const ring of rings) {
    ring.forEach((a, index) => {
      const key = edgeKey(a, ring[(index + 1) % ring.length]);
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    });
  }
  return {
    rings,
    isOuterEdge: (a: PlanPoint, b: PlanPoint) => edgeCounts.get(edgeKey(a, b)) === 1,
  };
}

/**
 * 幾塊互不重疊的凸多邊形（平面座標 [x, z]）拼成一塊從 bottom 到 top 的實心板。
 * 頂面與底面從每塊的中心點扇形切三角；側面只畫外緣。uv 照整塊板的外框 0～1，和原本的方塊相同。
 */
export function slabGeometry(
  pieces: readonly (readonly PlanPoint[])[],
  bottom: number,
  top: number,
): THREE.BufferGeometry {
  const { rings, isOuterEdge } = weldPieces(pieces);
  const all = rings.flat();
  const minX = Math.min(...all.map(([x]) => x));
  const maxX = Math.max(...all.map(([x]) => x));
  const minZ = Math.min(...all.map(([, z]) => z));
  const maxZ = Math.max(...all.map(([, z]) => z));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const planUv = ([x, z]: PlanPoint) => [(x - minX) / (maxX - minX), (maxZ - z) / (maxZ - minZ)];
  const vertex = (point: PlanPoint, y: number, normal: [number, number, number], uv: number[]) => {
    positions.push(point[0], y, point[1]);
    normals.push(...normal);
    uvs.push(...uv);
  };
  for (const ring of rings) {
    const centre: PlanPoint = [
      ring.reduce((sum, [x]) => sum + x, 0) / ring.length,
      ring.reduce((sum, [, z]) => sum + z, 0) / ring.length,
    ];
    ring.forEach((a, index) => {
      const b = ring[(index + 1) % ring.length];
      // 環在 [x, z] 平面上是順時針（從 +y 往下看是逆時針），c→a→b 的法線朝 +y。
      for (const point of [centre, a, b]) vertex(point, top, [0, 1, 0], planUv(point));
      for (const point of [centre, b, a]) vertex(point, bottom, [0, -1, 0], planUv(point));
      if (!isOuterEdge(a, b)) return;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const length = Math.hypot(dx, dz);
      const outward: [number, number, number] = [-dz / length, 0, dx / length];
      const side: Array<[PlanPoint, number, number[]]> = [
        [a, bottom, [0, 0]],
        [b, bottom, [1, 0]],
        [b, top, [1, 1]],
        [a, bottom, [0, 0]],
        [b, top, [1, 1]],
        [a, top, [0, 1]],
      ];
      for (const [point, y, uv] of side) vertex(point, y, outward, uv);
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

/** 幾塊凸多邊形（SITE 的 [X, Y]）拼成一個水平面，只有位置與法線，和場景裡其他水平多邊形相同。 */
export function flatSurfaceGeometry(
  pieces: readonly (readonly PlanPoint[])[],
  elevation: number,
): THREE.BufferGeometry {
  const { rings } = weldPieces(pieces);
  const positions: number[] = [];
  for (const ring of rings) {
    const centre: PlanPoint = [
      ring.reduce((sum, [x]) => sum + x, 0) / ring.length,
      ring.reduce((sum, [, z]) => sum + z, 0) / ring.length,
    ];
    ring.forEach((a, index) => {
      const b = ring[(index + 1) % ring.length];
      for (const point of [centre, a, b]) positions.push(point[0], elevation, point[1]);
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      Array.from({ length: positions.length / 3 }, () => [0, 1, 0]).flat(),
      3,
    ),
  );
  return geometry;
}

export interface StairOpeningGuardrailSegment {
  /** SITE 座標，欄杆中心線的兩端（已從洞口邊往外退半個欄杆厚，欄杆整個站在樓板上）。 */
  readonly from: PlanPoint;
  readonly to: PlanPoint;
}

/**
 * 防墜欄杆的位置：樓梯口除了樓梯頂端（X 較大、接到達翼平台的那一邊）以外的三邊，
 * 跨過旋轉的教室與不旋轉的到達翼，所以畫在 SITE 座標、不跟 3F 旋轉（DEC-175）。
 */
export function stairOpeningGuardrailSegments(l3: L3Geometry): StairOpeningGuardrailSegment[] {
  const { x1, x2, y1, y2 } = l3.stairOpening.bounds;
  const half = GUARDRAIL_POST / 2;
  // 轉角的立柱共用：兩條長邊延伸到 X34.85 那一邊的外側。
  return [
    { from: [x1 - half, y1 - half], to: [x2, y1 - half] },
    { from: [x1 - half, y2 + half], to: [x2, y2 + half] },
    { from: [x1 - half, y1 - half], to: [x1 - half, y2 + half] },
  ];
}

/** 樓梯口的防墜欄杆：安全玻璃欄板，頂端扶手與兩端立柱用結構鋼，畫在 SITE 座標、高度從 3F 樓板面算起。 */
export function createStairOpeningGuardrail(
  model: ViewerModel,
  materials: MaterialRegistry,
): THREE.Group {
  const l3 = model.geometry.l3;
  const steel = materials.get('structural-steel');
  const glass = materials.get('safety-glass');
  const group = new THREE.Group();
  group.name = `${l3.stairOpening.entityId}:GUARDRAIL`;
  group.position.y = l3.baseElevation;
  const height = STAIR_OPENING_GUARDRAIL_HEIGHT;
  const piece = (
    size: [number, number, number],
    centre: PlanPoint,
    y: number,
    angle: number,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(centre[0], y, centre[1]);
    mesh.rotation.y = angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  for (const { from, to } of stairOpeningGuardrailSegments(l3)) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(-dz, dx);
    const middle: PlanPoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const panel = piece(
      [length, height - GUARDRAIL_POST, GUARDRAIL_GLASS],
      middle,
      (height - GUARDRAIL_POST) / 2,
      angle,
      glass,
    );
    panel.name = `${l3.stairOpening.entityId}:GUARDRAIL-GLASS`;
    group.add(
      panel,
      piece(
        [length + GUARDRAIL_POST, GUARDRAIL_POST, GUARDRAIL_POST],
        middle,
        height - GUARDRAIL_POST / 2,
        angle,
        steel,
      ),
      piece([GUARDRAIL_POST, height, GUARDRAIL_POST], from, height / 2, angle, steel),
      piece([GUARDRAIL_POST, height, GUARDRAIL_POST], to, height / 2, angle, steel),
    );
  }
  return group;
}
