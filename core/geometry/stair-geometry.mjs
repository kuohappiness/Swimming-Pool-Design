// Two-flight straight stairs (ST-01, ST-02) along SITE +X. Validation, the
// drawings and the viewer data read flight positions, nosings and the stair
// opening from here, so riser counts per flight are interpreted exactly once.
import { rotateSitePointClockwise } from './site-orientation.mjs';

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
};

const flightRisers = (stair) => {
  const risers = Array.isArray(stair?.risersPerRun) ? stair.risersPerRun : [stair?.risersPerRun, stair?.risersPerRun];
  if (risers.length !== 2 || !risers.every((count) => Number.isInteger(count) && count > 1)) {
    throw new TypeError('A two-flight stair needs two whole riser counts above 1.');
  }
  return risers;
};

/**
 * Flights of a two-flight stair rising along +X with one mid landing.
 * Each flight of n risers has n − 1 treads; the landing takes the last riser.
 * @param {object} stair Model stair with lowerStartX, lowerElevation, riserHeight,
 *   treadDepth, midLandingLength and risersPerRun (a number or [first, second]).
 */
export function deriveStairFlights(stair) {
  const startX = finite(stair?.lowerStartX ?? stair?.bounds?.x1, 'lowerStartX');
  const lowerElevation = finite(stair?.lowerElevation, 'lowerElevation');
  const riserHeight = finite(stair?.riserHeight, 'riserHeight');
  const treadDepth = finite(stair?.treadDepth, 'treadDepth');
  const midLandingLength = finite(stair?.midLandingLength, 'midLandingLength');
  const [firstRisers, secondRisers] = flightRisers(stair);
  const flight = (x1, z1, risers) => ({
    x1,
    x2: x1 + (risers - 1) * treadDepth,
    z1,
    z2: z1 + risers * riserHeight,
    risers,
    treads: risers - 1,
    run: (risers - 1) * treadDepth,
  });
  const first = flight(startX, lowerElevation, firstRisers);
  const second = flight(first.x2 + midLandingLength, first.z2, secondRisers);
  return {
    flights: [first, second],
    midLanding: { x1: first.x2, x2: second.x1, elevation: first.z2 },
    topX: second.x2,
    upperElevation: second.z2,
    riserCount: firstRisers + secondRisers,
    treadCount: first.treads + second.treads,
  };
}

/**
 * Walking-surface edges where headroom is measured: the outer edge (nosing) of
 * every tread and both ends of the mid landing.
 */
export function deriveStairNosings(stair) {
  const { flights, midLanding } = deriveStairFlights(stair);
  const tread = finite(stair.treadDepth, 'treadDepth');
  const rise = finite(stair.riserHeight, 'riserHeight');
  const points = [];
  for (const run of flights) {
    for (let index = 1; index < run.risers; index += 1) {
      points.push({ x: run.x1 + (index - 1) * tread, z: run.z1 + index * rise });
    }
  }
  points.push({ x: midLanding.x1, z: midLanding.elevation }, { x: midLanding.x2, z: midLanding.elevation });
  return points.sort((a, b) => a.x - b.x || a.z - b.z);
}

/**
 * The first X where the clear height from a nosing to the slab above drops
 * below the required headroom; the stair opening must start at or before it.
 * Returns null when the whole stair keeps the headroom.
 */
export function firstHeadroomShortfallX(stair, slabUndersideElevation, requiredHeadroom) {
  const underside = finite(slabUndersideElevation, 'slabUndersideElevation');
  const headroom = finite(requiredHeadroom, 'requiredHeadroom');
  const shortfall = deriveStairNosings(stair).find(({ z }) => underside - z < headroom - 1e-9);
  return shortfall ? shortfall.x : null;
}

const polygonArea = (points) => Math.abs(points.reduce((sum, [x, y], index) => {
  const [nextX, nextY] = points[(index + 1) % points.length];
  return sum + x * nextY - nextX * y;
}, 0)) / 2;

// Sutherland–Hodgman against a convex, counter-clockwise clip polygon.
const clipConvex = (subject, clip) => clip.reduce((output, [ax, ay], index) => {
  const [bx, by] = clip[(index + 1) % clip.length];
  const inside = ([x, y]) => (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -1e-12;
  const cross = ([px, py], [qx, qy]) => {
    const t = ((ax - px) * (by - ay) - (ay - py) * (bx - ax)) / ((qx - px) * (by - ay) - (qy - py) * (bx - ax));
    return [px + t * (qx - px), py + t * (qy - py)];
  };
  return output.flatMap((point, pointIndex) => {
    const previous = output[(pointIndex + output.length - 1) % output.length];
    if (inside(point)) return inside(previous) ? [point] : [cross(previous, point), point];
    return inside(previous) ? [cross(previous, point)] : [];
  });
}, subject);

const counterClockwise = (points) => {
  const signed = points.reduce((sum, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return sum + x * nextY - nextX * y;
  }, 0);
  return signed >= 0 ? points : [...points].reverse();
};

const boundsPolygon = ({ x1, x2, y1, y2 }) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];

/**
 * Area of an axis-aligned SITE-XY rectangle that falls inside a convex polygon.
 * @param {{x1:number,x2:number,y1:number,y2:number}} bounds
 * @param {Array<[number, number]>} polygon Convex polygon in SITE-XY.
 */
export function boundsOverlapArea(bounds, polygon) {
  const clipped = clipConvex(boundsPolygon(bounds), counterClockwise(polygon));
  return clipped.length < 3 ? 0 : polygonArea(clipped);
}

/**
 * Corners of unrotated bounds after the shared L3 plan rotation, in SITE-XY.
 */
export function rotatedBoundsPolygon(bounds, pivot, clockwiseDegrees) {
  return boundsPolygon(bounds).map(([x, y]) => {
    const point = rotateSitePointClockwise({ x, y }, pivot, clockwiseDegrees);
    return [point.x, point.y];
  });
}
