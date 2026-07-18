import { createHash } from 'node:crypto';
import { deriveReferenceGeometry } from './reference-geometry.mjs';

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
  const derived = deriveReferenceGeometry(model);
  const { building, pool, roof, stair, solarReflection } = model.geometry;
  const currentModelHash = hashData(model);
  const recordedModelHash = analysisRegistry?.solar?.modelHash ?? null;
  const analysisStatus = recordedModelHash === null
    ? 'unavailable'
    : recordedModelHash === currentModelHash ? 'current' : 'stale';

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
        length: measure(building.length),
        width: measure(building.width),
        poolHallLength: measure(building.poolHallLength),
        serviceCoreLength: measure(building.serviceCoreLength),
      },
      pool: {
        origin: [...pool.origin],
        length: measure(pool.length),
        width: measure(pool.width),
        shallowDepth: measure(pool.shallowDepth),
        deepDepth: measure(pool.deepDepth),
        laneCount: pool.laneCount,
      },
      l2: {
        startX: derived.l2StartX,
        endX: derived.l2EndX,
        length: derived.l2Length,
        width: building.width.value,
        baseElevation: derived.l2Elevation,
        volumeHeight: measure(building.l2VolumeHeight),
        planRotation: measure(solarReflection.planRotation),
        planPivot: {
          ...derived.planPivot,
          status: solarReflection.planPivot.status,
          strategy: solarReflection.planPivot.strategy,
          openItemId: solarReflection.planPivot.openItemId,
        },
      },
      roof: {
        startX: derived.roofPlanStartX,
        endX: derived.roofPlanEndX,
        planRun: derived.roofPlanRun,
        totalRun: derived.roofTotalRun,
        width: building.width.value,
        pitch: measure(roof.pitch),
        lowOverhang: measure(roof.lowOverhang),
        highElevation: derived.roofHighElevation,
        farWallElevation: derived.roofFarWallElevation,
        lowElevation: derived.roofLowElevation,
        rainCurtain: structuredClone(roof.rainCurtain),
        rainwaterReuse: structuredClone(roof.rainwaterReuse),
      },
      mirror: {
        entityId: 'F-MIR-01',
        visualWallHeight: measure(solarReflection.mirrorVisualWallHeight),
        leanFromVertical: measure(solarReflection.mirrorLeanFromVertical),
        openItemId: solarReflection.openItemId,
        performanceSurface: 'separate-analysis-assumption',
      },
      stair: {
        entityId: stair.id,
        startX: derived.stairStartX,
        endX: derived.stairEndX,
        originY: stair.originY,
        width: stair.width,
        totalRise: derived.stairTotalRise,
        riserCount: stair.riserCount,
        risersPerRun: stair.risersPerRun,
        treadsPerRun: stair.treadsPerRun,
        treadDepth: stair.treadDepth,
        flightRun: derived.flightRun,
        midLandingLength: stair.midLandingLength,
        midLandingElevation: derived.midLandingElevation,
        status: 'confirmed',
        guardStatus: stair.guardrail.materialStatus,
        guardOpenItemId: stair.guardrail.openItemId,
      },
    },
    layers: [
      { id: 'original', label: '原建築', status: 'working' },
      { id: 'new', label: '新增介入', status: 'working' },
      { id: 'water', label: '泳池與水', status: 'confirmed' },
      { id: 'roof', label: '玻璃屋頂', status: 'confirmed' },
      { id: 'stair', label: '樓梯', status: 'confirmed' },
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
