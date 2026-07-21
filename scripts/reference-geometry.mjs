import { resolveActiveGeometry, resolveGeometryEntity } from './active-geometry.mjs';

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
};

const size = (bounds) => ({
  length: finite(bounds.x2, 'bounds.x2') - finite(bounds.x1, 'bounds.x1'),
  width: finite(bounds.y2, 'bounds.y2') - finite(bounds.y1, 'bounds.y1'),
});

export function deriveReferenceGeometry(model) {
  const active = resolveActiveGeometry(model);
  const site = resolveGeometryEntity(active, 'SITE-01');
  const building = resolveGeometryEntity(active, 'BLDG-01');
  const poolHall = resolveGeometryEntity(active, 'Z-PH-01');
  const pool = resolveGeometryEntity(active, 'POOL-01');
  const serviceWing = resolveGeometryEntity(active, 'CORE-01');
  const rightSetback = resolveGeometryEntity(active, 'Z-L1-SETBACK-01');
  const l2 = resolveGeometryEntity(active, 'L2-PLATE-01');
  const l3 = resolveGeometryEntity(active, 'L3-PLATE-01');
  const roof = resolveGeometryEntity(active, 'RF-GL-01');
  const stair = resolveGeometryEntity(active, 'ST-01');
  const siteSize = size(site.bounds);
  const buildingSize = size(building.bounds);
  const poolSize = size(pool.bounds);
  const l2Size = size(l2.bounds);
  const stairSize = size(stair.bounds);
  const levels = active.levels;
  const stairData = active.stair;
  const roofData = active.roof;
  const l3Data = active.l3;

  if (Math.abs(stairSize.length - stairData.totalPlanLength) > 1e-9) {
    throw new RangeError('ST-01 bounds and totalPlanLength must match.');
  }
  if (Math.abs(stairSize.width - stairData.clearWidth) > 1e-9) {
    throw new RangeError('ST-01 bounds and clearWidth must match.');
  }
  if (Math.abs(poolSize.length - 25) > 1e-9 || Math.abs(poolSize.width - 8.5) > 1e-9) {
    throw new RangeError('POOL-01 active bounds must remain 25 × 8.5 m for v0.6.0.');
  }

  return {
    activeGeometryRevisionId: active.id,
    coordinateSystemId: active.coordinateSystemId,
    siteBounds: site.bounds,
    siteLength: siteSize.length,
    siteWidth: siteSize.width,
    buildingBounds: building.bounds,
    buildingLength: buildingSize.length,
    buildingWidth: buildingSize.width,
    poolHallBounds: poolHall.bounds,
    poolBounds: pool.bounds,
    poolLength: poolSize.length,
    poolWidth: poolSize.width,
    serviceWingBounds: serviceWing.bounds,
    rightSetbackBounds: rightSetback.bounds,
    l1ServiceStartX: serviceWing.bounds.x1,
    l1ServiceEndX: serviceWing.bounds.x2,
    l1SplitAxisX: active.l1.zones.poolMaleToilet.bounds.x2,
    l2Bounds: l2.bounds,
    l2StartX: l2.bounds.x1,
    l2EndX: l2.bounds.x2,
    l2Length: l2Size.length,
    l2SplitAxisX: active.l2.splitAxisX,
    l3Bounds: l3.bounds,
    l3PlanRotation: active.l3.planRotation,
    planPivot: { x: l3Data.planPivot.x, y: l3Data.planPivot.y, z: levels.l3Elevation },
    roofBounds: roof.bounds,
    roofPlanStartX: roof.bounds.x1,
    roofPlanEndX: roof.bounds.x2,
    roofPlanRun: size(roof.bounds).length,
    roofTotalRun: size(roof.bounds).length,
    roofFarWallElevation: roofData.lowElevation,
    roofLowElevation: roofData.lowElevation,
    roofHighElevation: roofData.highElevation,
    l1Elevation: levels.l1BaseElevation,
    poolDeckElevation: levels.poolDeckElevation,
    l2Elevation: levels.l2Elevation,
    l3Elevation: levels.l3Elevation,
    l2VolumeHeight: levels.l2FloorToFloor,
    mirrorVisualWallHeight: l3Data.mirror.height,
    flightRun: stairData.runLengthPerFlight,
    stairTotalRun: stairData.totalPlanLength,
    stairTotalRise: stairData.totalRise,
    stairStartX: stair.bounds.x1,
    stairEndX: stair.bounds.x2,
    stairOriginY: stair.bounds.y1,
    stairWidth: stairSize.width,
    riserHeight: stairData.riserHeight,
    midLandingElevation: stairData.lowerElevation + stairData.totalRise / 2,
    stair: structuredClone(stairData),
    l1Zones: structuredClone(active.l1.zones),
    diagrammaticL1: {
      mainEntranceBounds: active.l1.mainEntrance.bounds,
      playgroundRampBounds: active.l1.playgroundRamp.bounds,
      stairBounds: stair.bounds,
      toiletGroupsInterconnect: false,
    },
  };
}
