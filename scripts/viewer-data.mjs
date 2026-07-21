import { createHash } from 'node:crypto';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

export function hashData(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

const measure = (input) => ({
  value: input.value,
  status: input.status,
  sourceIds: [...(input.sourceIds ?? [])],
  ...(input.openItemId ? { openItemId: input.openItemId } : {}),
});

const finiteRecord = (value, path = 'viewerModel') => {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError(`${path} must not contain non-finite geometry.`);
  }
  if (Array.isArray(value)) value.forEach((entry, index) => finiteRecord(entry, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) finiteRecord(entry, `${path}.${key}`);
  }
};

export function buildViewerModel(model, analysisRegistry = {}) {
  const { pool, roof, solarReflection } = model.geometry;
  const study = solarReflection?.v050Study;
  if (!study?.activeForViewer || study.revision !== '0.5.0') {
    throw new TypeError('Viewer requires geometry.solarReflection.v050Study as the active 0.5.0 geometry.');
  }
  const { site, l1, levels, floorPlate, roofInterface, stairFromRaisedPoolDeck, mirror, planPivot, optimization } = study;
  const currentModelHash = hashData(model);
  const recordedModelHash = analysisRegistry?.solar?.modelHash ?? null;
  const analysisStatus = recordedModelHash === null
    ? 'unavailable'
    : recordedModelHash === currentModelHash ? 'current' : 'stale';

  const confirmed = (value, sourceIds = []) => ({ value, status: 'confirmed', sourceIds });
  const working = (value, sourceIds = [], openItemId) => ({
    value, status: 'working', sourceIds, ...(openItemId ? { openItemId } : {}),
  });
  const viewerModel = {
    schemaVersion: '1.0.0',
    modelVersion: model.modelVersion,
    revision: model.revision,
    modelHash: currentModelHash,
    project: {
      name: model.project.name,
      shortName: model.project.shortName,
      purpose: model.project.purpose,
      disclaimer: model.project.disclaimer,
    },
    referenceSystem: {
      unit: model.referenceSystem.unit,
      angleUnit: model.referenceSystem.angleUnit,
      localLongAxisBearingFromTrueNorth: model.referenceSystem.localLongAxisBearingFromTrueNorth,
      axes: structuredClone(model.referenceSystem.axes),
      coordinateAdapter: { modelX: 'threeX', modelY: 'threeZ', modelZ: 'threeY' },
    },
    geometry: {
      building: {
        length: confirmed(site.totalLength, ['SRC-CONCEPT-010']),
        width: working(site.l1Width, ['SRC-CONCEPT-010'], 'OPEN-016'),
        upperFloorWidth: confirmed(site.upperFloorWidth, []),
        poolHallLength: confirmed(site.poolHallLength, ['SRC-CONCEPT-010']),
        serviceCoreLength: confirmed(site.serviceWingLength, ['SRC-CONCEPT-010']),
        leftSetback: confirmed(site.leftSetback, ['SRC-CONCEPT-010']),
      },
      pool: {
        origin: [...l1.poolOrigin],
        length: measure(pool.length),
        width: measure(pool.width),
        shallowDepth: measure(pool.shallowDepth),
        deepDepth: measure(pool.deepDepth),
        deckElevation: confirmed(levels.poolDeckElevation, []),
        laneCount: pool.laneCount,
      },
      l1: {
        outdoorDepth: l1.outdoorDepth,
        toiletBandDepth: l1.toiletBandDepth,
        dryPassageDepth: l1.dryPassageDepth,
        outdoorConnectedToPoolHall: l1.outdoorConnectedToPoolHall,
        toiletDoorTopology: l1.toiletDoorTopology,
        core: structuredClone(l1.fixedCoreCandidate),
      },
      l2: {
        startX: floorPlate.poolSideX,
        endX: floorPlate.farSideX,
        length: floorPlate.length,
        width: floorPlate.width,
        baseElevation: levels.l2Elevation,
        topElevation: levels.l3Elevation,
        volumeHeight: working(levels.l2FloorToFloor, [], 'OPEN-016'),
        planRotation: confirmed(0, []),
        planPivot: {
          x: planPivot.x,
          y: planPivot.y,
          z: levels.l2Elevation,
          status: 'working',
          strategy: 'fixed-floor-plate-centroid',
          openItemId: 'OPEN-016',
        },
      },
      l3: {
        startX: floorPlate.poolSideX,
        endX: floorPlate.farSideX,
        length: floorPlate.length,
        width: floorPlate.width,
        baseElevation: levels.l3Elevation,
        volumeHeight: working(mirror.height, [], 'OPEN-011'),
        planRotation: measure(optimization.planRotation),
        planPivot: {
          x: planPivot.x,
          y: planPivot.y,
          z: levels.l3Elevation,
          status: planPivot.status,
          strategy: planPivot.strategy,
          openItemId: planPivot.openItemId,
        },
        mirror: {
          entityId: 'F-MIR-01',
          height: working(mirror.height, [], 'OPEN-011'),
          leanFromVertical: measure(optimization.mirrorLeanFromVertical),
          materialIntent: mirror.materialIntent,
          wallAndMirrorCoplanar: mirror.wallAndMirrorCoplanar,
          openItemId: 'OPEN-011',
        },
      },
      roof: {
        startX: site.buildingStartX,
        endX: floorPlate.poolSideX,
        planRun: roofInterface.planRun,
        totalRun: roofInterface.planRun,
        width: site.l1Width,
        pitch: confirmed(roofInterface.pitch, []),
        highElevation: roofInterface.highElevation,
        lowElevation: roofInterface.lowElevation,
        transitionBand: confirmed(roofInterface.l3TransitionBand, []),
        interfacePlanMismatch: working(0.7, [], 'OPEN-016'),
        rainCurtain: structuredClone(roof.rainCurtain),
        rainwaterReuse: structuredClone(roof.rainwaterReuse),
      },
      stair: {
        entityId: 'ST-01',
        startX: stairFromRaisedPoolDeck.startX,
        endX: stairFromRaisedPoolDeck.startX + stairFromRaisedPoolDeck.totalPlanLength,
        originY: stairFromRaisedPoolDeck.originY,
        width: stairFromRaisedPoolDeck.candidateClearWidth,
        totalRise: stairFromRaisedPoolDeck.totalRise,
        riserCount: stairFromRaisedPoolDeck.riserCount,
        risersPerRun: stairFromRaisedPoolDeck.risersPerRun,
        treadsPerRun: stairFromRaisedPoolDeck.treadsPerRun,
        treadDepth: stairFromRaisedPoolDeck.treadDepth,
        flightRun: stairFromRaisedPoolDeck.runLengthPerFlight,
        midLandingLength: stairFromRaisedPoolDeck.midLandingLength,
        midLandingElevation: stairFromRaisedPoolDeck.lowerElevation + stairFromRaisedPoolDeck.totalRise / 2,
        lowerElevation: stairFromRaisedPoolDeck.lowerElevation,
        upperElevation: stairFromRaisedPoolDeck.upperElevation,
        status: 'working',
        guardStatus: 'deferred',
        guardOpenItemId: stairFromRaisedPoolDeck.openItemId,
      },
    },
    layers: [
      { id: 'site', label: '基地與退縮', status: 'confirmed' },
      { id: 'l1', label: '1F 池畔與服務層', status: 'working' },
      { id: 'water', label: '泳池與水', status: 'confirmed' },
      { id: 'l2', label: '2F 固定更衣層', status: 'working' },
      { id: 'l3', label: '3F 旋轉服務層', status: 'working' },
      { id: 'roof', label: '玻璃屋頂', status: 'confirmed' },
      { id: 'circulation', label: '樓梯與固定核心', status: 'working' },
      { id: 'rain', label: '雨簾與回用水路', status: 'deferred' },
      { id: 'annotations', label: '幾何註記', status: 'working' },
    ],
    analysis: {
      solar: {
        status: analysisStatus,
        recordedModelHash,
        currentModelHash,
        sourceIds: [...(analysisRegistry?.solar?.sourceIds ?? [])],
        disclaimer: '幾何角度已確認；全年光熱、眩光與安全性能仍待專業驗證。',
      },
    },
  };

  finiteRecord(viewerModel);
  return viewerModel;
}
