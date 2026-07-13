const numericValue = (measure, label) => {
  const value = measure?.value;
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite numeric measure.`);
  return value;
};

const finiteNumber = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
};

export function deriveReferenceGeometry(model) {
  const building = model?.geometry?.building;
  const stair = model?.geometry?.stair;
  if (!building || !stair) throw new TypeError('Model building and stair geometry are required.');

  const buildingLength = numericValue(building.length, 'building.length');
  const buildingWidth = numericValue(building.width, 'building.width');
  const poolHallLength = numericValue(building.poolHallLength, 'building.poolHallLength');
  const serviceCoreLength = numericValue(building.serviceCoreLength, 'building.serviceCoreLength');
  const l2ExtensionLength = numericValue(building.l2ExtensionLength, 'building.l2ExtensionLength');
  const risersPerRun = finiteNumber(stair.risersPerRun, 'stair.risersPerRun');
  const treadDepth = finiteNumber(stair.treadDepth, 'stair.treadDepth');
  const midLandingLength = finiteNumber(stair.midLandingLength, 'stair.midLandingLength');

  if (buildingLength <= 0 || buildingWidth <= 0 || poolHallLength <= 0 || serviceCoreLength <= 0) {
    throw new RangeError('Building dimensions must be positive.');
  }
  if (l2ExtensionLength <= 0 || l2ExtensionLength >= poolHallLength) {
    throw new RangeError('building.l2ExtensionLength must be greater than 0 and smaller than the pool hall length.');
  }
  if (risersPerRun <= 0 || treadDepth <= 0 || midLandingLength <= 0) {
    throw new RangeError('Stair run inputs must be positive.');
  }

  const l1ServiceStartX = poolHallLength;
  const l1ServiceEndX = buildingLength;
  const l1SplitAxisX = (l1ServiceStartX + l1ServiceEndX) / 2;
  const l2StartX = poolHallLength - l2ExtensionLength;
  const l2EndX = buildingLength;
  const l2Length = l2EndX - l2StartX;
  const l2SplitAxisX = (l2StartX + l2EndX) / 2;
  const flightRun = risersPerRun * treadDepth;
  const stairTotalRun = flightRun * 2 + midLandingLength;
  const stairStartX = l2SplitAxisX - stairTotalRun;
  const stairEndX = l2SplitAxisX;

  if (l2StartX < 0 || l2StartX >= l1ServiceStartX || l2Length <= serviceCoreLength) {
    throw new RangeError('Derived L2 extension geometry is outside the building programme bounds.');
  }
  if (stairStartX < 0 || stairEndX > buildingLength) {
    throw new RangeError('Derived stair geometry is outside the building length.');
  }

  return {
    l1ServiceStartX,
    l1ServiceEndX,
    l1SplitAxisX,
    l2StartX,
    l2EndX,
    l2Length,
    l2SplitAxisX,
    maleL1Bounds: { x1: l1ServiceStartX, x2: l1SplitAxisX, y1: 0, y2: buildingWidth },
    femaleL1Bounds: { x1: l1SplitAxisX, x2: l1ServiceEndX, y1: 0, y2: buildingWidth },
    maleL2Bounds: { x1: l2StartX, x2: l2SplitAxisX, y1: 0, y2: buildingWidth },
    femaleL2Bounds: { x1: l2SplitAxisX, x2: l2EndX, y1: 0, y2: buildingWidth },
    flightRun,
    stairTotalRun,
    stairStartX,
    stairEndX,
    roofPlanStartX: 0,
    roofPlanEndX: l2StartX,
    roofPlanRun: l2StartX,
  };
}
