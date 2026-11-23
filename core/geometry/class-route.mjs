// 一堂游泳課的平面動線：把 active geometry 的 l1.poolUse、池體與 ST-01 整理成頁面要用的
// 區塊、路線與幾個由 bounds 算出來的尺寸。這裡只讀模型、不補值；模型缺一項就丟錯。

const ZONE_KEYS = [
  'entryVestibule',
  'entryRamp',
  'entrySteps',
  'dryCorridor',
  'rinseGate',
  'assemblyArea',
  'lifeguardChair',
  'accessibleChanging',
  'staffFirstAid',
  'equipmentParking',
  'poolLift',
];

function requireBounds(bounds, name) {
  for (const key of ['x1', 'x2', 'y1', 'y2']) {
    if (!Number.isFinite(bounds?.[key]))
      throw new TypeError(`${name} bounds need a finite ${key}.`);
  }
  if (!(bounds.x2 > bounds.x1) || !(bounds.y2 > bounds.y1))
    throw new RangeError(`${name} bounds must have a positive size.`);
  return { x1: bounds.x1, x2: bounds.x2, y1: bounds.y1, y2: bounds.y2 };
}

function requireFinite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number.`);
  return value;
}

// Sizes are differences of coordinates such as 12.5 − 9.5; trim binary noise to the model's millimetre grid.
const span = (from, to) => Math.round((to - from) * 1000) / 1000;
const contains = (bounds, [x, y]) =>
  x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;

/**
 * The plan and figures the swim-class page shows, all read from the active geometry.
 * `zones` keeps the model's key for each place; `route` is the class route in model order, each stop tied to
 * the place it highlights on the plan.
 */
export function buildSwimClassData(active) {
  const poolUse = active?.l1?.poolUse;
  const pool = active?.l1?.pool;
  const stair = active?.stair;
  if (!poolUse || !pool || !stair)
    throw new TypeError('Active geometry needs l1.poolUse, l1.pool and stair.');

  const zones = Object.fromEntries(
    ZONE_KEYS.map((key) => {
      const zone = poolUse[key];
      if (!zone?.entityId) throw new TypeError(`l1.poolUse.${key} needs an entityId.`);
      return [
        key,
        { entityId: zone.entityId, bounds: requireBounds(zone.bounds, `l1.poolUse.${key}`) },
      ];
    }),
  );
  const stairBounds = requireBounds(stair.bounds, 'stair');
  const poolBounds = requireBounds(pool.bounds, 'l1.pool');
  const platformBounds = requireBounds(pool.teachingPlatform?.bounds, 'l1.pool.teachingPlatform');
  if (
    platformBounds.x1 < poolBounds.x1 ||
    platformBounds.x2 > poolBounds.x2 ||
    platformBounds.y1 < poolBounds.y1 ||
    platformBounds.y2 > poolBounds.y2
  ) {
    throw new RangeError('The teaching platform must lie inside the pool.');
  }

  const places = { ...zones, stair: { entityId: stair.entityId, bounds: stairBounds } };
  if (!Array.isArray(poolUse.classRoute) || poolUse.classRoute.length === 0) {
    throw new TypeError('l1.poolUse.classRoute needs at least one stop.');
  }
  const route = poolUse.classRoute.map((stop, index) => {
    const standAt = [
      requireFinite(stop.standAt?.[0], `route stop ${index + 1} x`),
      requireFinite(stop.standAt?.[1], `route stop ${index + 1} y`),
    ];
    // A stop highlights the place it faces; a stop that faces the pool highlights the place it stands in.
    const faced = Object.entries(places).find(([, place]) => place.entityId === stop.faceEntityId);
    const stoodIn = Object.entries(zones).find(([, zone]) => contains(zone.bounds, standAt));
    const place = faced ?? stoodIn;
    if (!place)
      throw new RangeError(`Route stop ${stop.id} neither faces nor stands in a known place.`);
    return { id: stop.id, label: stop.label, standAt, place: place[0] };
  });

  const lanes = pool.laneBands.map((band) => ({
    id: band.id,
    use: band.use,
    y1: band.y1,
    y2: band.y2,
    width: span(band.y1, band.y2),
  }));
  const standardLanes = lanes.filter(({ use }) => use.startsWith('standard'));
  const mixedBand = lanes.find(({ id }) => id === pool.teachingPlatform.laneBandId);
  if (standardLanes.length === 0 || !mixedBand)
    throw new TypeError('Pool lanes need standard lanes and the teaching band.');
  if (new Set(standardLanes.map(({ width }) => width)).size !== 1)
    throw new RangeError('Standard lanes must share one width.');

  const aed = [
    requireFinite(poolUse.aed?.position?.[0], 'AED x'),
    requireFinite(poolUse.aed?.position?.[1], 'AED y'),
  ];
  return {
    revision: active.id,
    extent: requireBounds(active.site?.bounds ?? active.l1.building?.bounds, 'site'),
    hall: requireBounds(active.l1.poolHall?.bounds, 'l1.poolHall'),
    serviceWing: requireBounds(active.l1.serviceWing?.bounds, 'l1.serviceWing'),
    pool: { bounds: poolBounds, lanes },
    platform: { bounds: platformBounds },
    stair: { bounds: stairBounds },
    entrance: { bounds: requireBounds(active.l1.mainEntrance?.bounds, 'l1.mainEntrance') },
    parapet: {
      bounds: requireBounds(poolUse.dryCorridorParapet?.bounds, 'l1.poolUse.dryCorridorParapet'),
    },
    zones,
    aed,
    route,
    figures: {
      corridorLength: span(zones.dryCorridor.bounds.x1, zones.dryCorridor.bounds.x2),
      rampLength: span(zones.entryRamp.bounds.x1, zones.entryRamp.bounds.x2),
      entryRise: span(
        requireFinite(poolUse.entryRamp.fromElevation, 'ramp start'),
        requireFinite(poolUse.entryRamp.toElevation, 'ramp end'),
      ),
      platformLength: span(platformBounds.x1, platformBounds.x2),
      platformWidth: span(platformBounds.y1, platformBounds.y2),
      standardLaneCount: standardLanes.length,
      standardLaneWidth: standardLanes[0].width,
      teachingBandWidth: mixedBand.width,
      poolLength: span(poolBounds.x1, poolBounds.x2),
      poolWidth: span(poolBounds.y1, poolBounds.y2),
    },
  };
}
