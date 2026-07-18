const numericValue = (measure, label) => {
  const value = measure?.value;
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite numeric measure.`);
  return value;
};

const finiteNumber = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
};

const levelElevation = (model, id) => {
  const level = model?.referenceSystem?.levels?.find((candidate) => candidate?.id === id);
  return finiteNumber(level?.elevation, `referenceSystem.levels.${id}.elevation`);
};

export function deriveReferenceGeometry(model) {
  const building = model?.geometry?.building;
  const stair = model?.geometry?.stair;
  const roof = model?.geometry?.roof;
  if (!building || !stair || !roof) throw new TypeError('Model building, stair, and roof geometry are required.');

  const buildingLength = numericValue(building.length, 'building.length');
  const buildingWidth = numericValue(building.width, 'building.width');
  const poolHallLength = numericValue(building.poolHallLength, 'building.poolHallLength');
  const serviceCoreLength = numericValue(building.serviceCoreLength, 'building.serviceCoreLength');
  const l2ExtensionLength = numericValue(building.l2ExtensionLength, 'building.l2ExtensionLength');
  const l2VolumeHeight = numericValue(building.l2VolumeHeight, 'building.l2VolumeHeight');
  const entranceThresholdX = finiteNumber(
    model?.referenceSystem?.worldTransform?.localOrigin?.[0],
    'referenceSystem.worldTransform.localOrigin[0]',
  );
  const entranceThresholdY = finiteNumber(
    model?.referenceSystem?.worldTransform?.localOrigin?.[1],
    'referenceSystem.worldTransform.localOrigin[1]',
  );
  const risersPerRun = finiteNumber(stair.risersPerRun, 'stair.risersPerRun');
  const treadsPerRun = finiteNumber(stair.treadsPerRun, 'stair.treadsPerRun');
  const treadDepth = finiteNumber(stair.treadDepth, 'stair.treadDepth');
  const midLandingLength = finiteNumber(stair.midLandingLength, 'stair.midLandingLength');
  const l1Elevation = levelElevation(model, 'L1');
  const l2Elevation = levelElevation(model, 'L2');
  const totalRise = l2Elevation - l1Elevation;
  const riserCount = finiteNumber(stair.riserCount, 'stair.riserCount');
  const roofPitch = numericValue(roof.pitch, 'roof.pitch');
  const roofLowOverhang = numericValue(roof.lowOverhang, 'roof.lowOverhang');
  const roofHighElevation = l2Elevation;
  const mirrorVisualWallHeight = numericValue(
    model?.geometry?.solarReflection?.mirrorVisualWallHeight,
    'solarReflection.mirrorVisualWallHeight',
  );

  if (buildingLength <= 0 || buildingWidth <= 0 || poolHallLength <= 0 || serviceCoreLength <= 0) {
    throw new RangeError('Building dimensions must be positive.');
  }
  if (l2ExtensionLength <= 0 || l2ExtensionLength >= poolHallLength) {
    throw new RangeError('building.l2ExtensionLength must be greater than 0 and smaller than the pool hall length.');
  }
  if (risersPerRun <= 0 || treadsPerRun <= 0 || treadDepth <= 0 || midLandingLength <= 0
    || l2VolumeHeight <= 0 || totalRise <= 0 || riserCount <= 0 || roofPitch <= 0
    || roofLowOverhang <= 0 || mirrorVisualWallHeight <= 0) {
    throw new RangeError('Stair run inputs must be positive.');
  }
  if (!Number.isInteger(risersPerRun) || !Number.isInteger(treadsPerRun)
    || treadsPerRun !== risersPerRun - 1) {
    throw new RangeError('stair.treadsPerRun must equal stair.risersPerRun - 1.');
  }

  const l1ServiceStartX = poolHallLength;
  const l1ServiceEndX = buildingLength;
  const l1SplitAxisX = (l1ServiceStartX + l1ServiceEndX) / 2;
  const l2StartX = poolHallLength - l2ExtensionLength;
  const l2EndX = buildingLength;
  const l2Length = l2EndX - l2StartX;
  const l2SplitAxisX = (l2StartX + l2EndX) / 2;
  const flightRun = treadsPerRun * treadDepth;
  const stairTotalRun = flightRun * stair.runs + midLandingLength;
  const stairStartX = l2SplitAxisX - stairTotalRun;
  const stairEndX = l2SplitAxisX;
  const riserHeight = totalRise / riserCount;
  const midLandingElevation = riserHeight * risersPerRun;
  const roofPlanRun = l2StartX;
  const roofTotalRun = roofPlanRun + roofLowOverhang;
  const roofPlanStartX = -roofLowOverhang;
  const roofPlanEndX = l2StartX;
  const roofPitchRadians = roofPitch * Math.PI / 180;
  const roofFarWallElevation = roofHighElevation - roofPlanRun * Math.tan(roofPitchRadians);
  const roofLowElevation = roofHighElevation - roofTotalRun * Math.tan(roofPitchRadians);
  const pivotStrategy = model?.geometry?.solarReflection?.planPivot?.strategy;
  if (pivotStrategy !== 'l2-start-width-center') {
    throw new RangeError('solarReflection.planPivot.strategy must be l2-start-width-center.');
  }
  const planPivot = { x: l2StartX, y: buildingWidth / 2, z: l2Elevation };
  const stairTopY = finiteNumber(stair.originY, 'stair.originY')
    + finiteNumber(stair.width, 'stair.width');

  // REF-101 expresses confirmed circulation topology without claiming the
  // unresolved room, door, forecourt, or passage dimensions from OPEN-008.
  // These diagrammatic bounds belong here so the renderer cannot invent a
  // second arrangement of the same relationships.
  const outdoorForecourtDepth = Math.min(serviceCoreLength / 2, buildingWidth * 0.42);
  const dryPassageDepth = buildingWidth * 0.1;
  const toiletRoomY1 = outdoorForecourtDepth;
  const toiletRoomY2 = buildingWidth - dryPassageDepth;
  const maleSpan = l1SplitAxisX - l1ServiceStartX;
  const femaleSpan = l1ServiceEndX - l1SplitAxisX;
  const poolHallOpeningY = Math.max(stairTopY + buildingWidth * 0.05, outdoorForecourtDepth * 0.68);
  const arrivalPathWidth = finiteNumber(stair.width, 'stair.width') * 0.5;
  const arrivalClearRunCenterX = entranceThresholdX + finiteNumber(stair.width, 'stair.width') * 0.62;
  const arrivalBypassDepth = finiteNumber(stair.originY, 'stair.originY') * 0.7;
  const arrivalPathEndY = outdoorForecourtDepth * 0.75;
  const arrivalThresholdBypassBounds = {
    x1: Math.min(entranceThresholdX, arrivalClearRunCenterX),
    x2: Math.max(entranceThresholdX, arrivalClearRunCenterX),
    y1: entranceThresholdY,
    y2: entranceThresholdY + arrivalBypassDepth,
  };
  const arrivalClearRunBounds = {
    x1: arrivalClearRunCenterX - arrivalPathWidth / 2,
    x2: arrivalClearRunCenterX + arrivalPathWidth / 2,
    y1: entranceThresholdY + arrivalBypassDepth,
    y2: arrivalPathEndY,
  };
  const stairBounds = {
    x1: stairStartX,
    x2: stairEndX,
    y1: finiteNumber(stair.originY, 'stair.originY'),
    y2: stairTopY,
  };
  const arrivalMinimumStairClearance = Math.min(
    stairBounds.y1 - arrivalThresholdBypassBounds.y2,
    arrivalClearRunBounds.x1 - stairBounds.x2,
  );

  if (toiletRoomY1 >= toiletRoomY2 || poolHallOpeningY >= outdoorForecourtDepth) {
    throw new RangeError('Diagrammatic L1 circulation bands cannot be derived without overlap.');
  }

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
    maleL1Bounds: { x1: l1ServiceStartX, x2: l1SplitAxisX, y1: toiletRoomY1, y2: toiletRoomY2 },
    femaleL1Bounds: { x1: l1SplitAxisX, x2: l1ServiceEndX, y1: toiletRoomY1, y2: toiletRoomY2 },
    maleL2Bounds: { x1: l2StartX, x2: l2SplitAxisX, y1: 0, y2: buildingWidth },
    femaleL2Bounds: { x1: l2SplitAxisX, x2: l2EndX, y1: 0, y2: buildingWidth },
    flightRun,
    stairTotalRun,
    stairTotalRise: totalRise,
    stairStartX,
    stairEndX,
    riserHeight,
    midLandingElevation,
    l1Elevation,
    l2Elevation,
    l2VolumeHeight,
    planPivot,
    mirrorVisualWallHeight,
    roofPlanStartX,
    roofPlanEndX,
    roofPlanRun,
    roofTotalRun,
    roofFarWallElevation,
    roofLowElevation,
    roofHighElevation,
    diagrammaticL1: {
      outdoorForecourtBounds: {
        x1: l1ServiceStartX,
        x2: l1ServiceEndX,
        y1: 0,
        y2: outdoorForecourtDepth,
      },
      dryPassageBounds: {
        x1: l1ServiceStartX - 1,
        x2: l1ServiceEndX,
        y1: toiletRoomY2,
        y2: buildingWidth,
      },
      poolHallOpening: { x: l1ServiceStartX, y: poolHallOpeningY },
      arrivalPath: {
        entityId: 'RTE-L1-ARRIVAL-01',
        width: arrivalPathWidth,
        thresholdBypassBounds: arrivalThresholdBypassBounds,
        clearRunBounds: arrivalClearRunBounds,
        stairBounds,
        minimumStairClearance: arrivalMinimumStairClearance,
        points: [
          { x: entranceThresholdX, y: entranceThresholdY },
          { x: arrivalClearRunCenterX, y: entranceThresholdY + arrivalBypassDepth / 2 },
          { x: arrivalClearRunCenterX, y: arrivalPathEndY },
        ],
      },
      maleFrontDoor: { x: l1ServiceStartX + maleSpan * 0.28, y: toiletRoomY1 },
      maleRearDoor: { x: l1ServiceStartX + maleSpan * 0.68, y: toiletRoomY2 },
      femaleFrontDoor: { x: l1SplitAxisX + femaleSpan * 0.32, y: toiletRoomY1 },
      femaleRearDoor: { x: l1SplitAxisX + femaleSpan * 0.74, y: toiletRoomY2 },
    },
  };
}
