import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { geometryEntities, resolveActiveGeometry, resolveGeometryEntity } from './active-geometry.mjs';

const TOLERANCE = 0.002;
const closeTo = (actual, expected, tolerance = TOLERANCE) => Number.isFinite(actual)
  && Math.abs(actual - expected) <= tolerance;
const sameBounds = (actual, expected) => ['x1', 'x2', 'y1', 'y2']
  .every((key) => closeTo(actual?.[key], expected[key]));
const positiveOverlap = (a, b) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > TOLERANCE
  && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > TOLERANCE;
const containedBy = (inner, outer) => inner.x1 >= outer.x1 - TOLERANCE
  && inner.x2 <= outer.x2 + TOLERANCE
  && inner.y1 >= outer.y1 - TOLERANCE
  && inner.y2 <= outer.y2 + TOLERANCE;

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function check(errors, condition, message) {
  if (!condition) errors.push(message);
}

export function validateModel(model) {
  const errors = [];
  let active;
  try {
    active = resolveActiveGeometry(model);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  check(errors, model.schemaVersion === '1.3.0', 'schemaVersion must be 1.3.0.');
  check(errors, model.modelVersion === '0.6.7', 'modelVersion must be 0.6.7.');
  check(errors, model.designTargetVersion === model.modelVersion, 'designTargetVersion must equal modelVersion.');
  check(errors, active.id === 'GEO-0.6.7', 'GEO-0.6.7 must be the active geometry revision.');
  check(errors, active.coordinateSystemId === 'SITE-XY', 'Active geometry must use SITE-XY.');

  const coordinateSystem = model.referenceSystem?.coordinateSystems?.find(({ id }) => id === 'SITE-XY');
  check(errors, Boolean(coordinateSystem), 'SITE-XY must be declared once in referenceSystem.coordinateSystems.');
  check(errors, model.referenceSystem?.coordinateSystems?.filter(({ id }) => id === 'SITE-XY').length === 1, 'SITE-XY must not be duplicated.');
  check(errors, sameBounds(coordinateSystem?.bounds, { x1: 0, x2: 41, y1: 0, y2: 14 }), 'SITE-XY bounds must be X0–41/Y0–14.');
  check(
    errors,
    coordinateSystem?.renderAdapters?.three === 'x-to-x-y-to-negative-z-z-to-y-right-handed',
    'Three.js adapter must preserve handedness: SITE X->Three X, SITE Y->Three -Z, SITE Z->Three Y.',
  );

  const requiredBounds = {
    'SITE-01': { x1: 0, x2: 41, y1: 0, y2: 14 },
    'BLDG-01': { x1: 0.5, x2: 39, y1: 0, y2: 14 },
    'Z-PH-01': { x1: 0.5, x2: 31, y1: 0, y2: 14 },
    'POOL-01': { x1: 3, x2: 28, y1: 4, y2: 12.5 },
    'CORE-01': { x1: 31, x2: 39, y1: 0, y2: 14 },
    'F-L1-Y0-01': { x1: 0.5, x2: 39, y1: 0, y2: 0.14 },
    'EN-01': { x1: 1, x2: 3, y1: 0, y2: 0.2 },
    'Z-L1-WEST-SETBACK-01': { x1: 0, x2: 0.5, y1: 0, y2: 14 },
    'RF-L1-WEST-EAVE-01': { x1: 0, x2: 0.5, y1: 0, y2: 14 },
    'RF-L1-REAR-CANOPY-01': { x1: 31, x2: 39, y1: 13.5, y2: 14.5 },
    'RW-WEST-01': { x1: 0, x2: 0.5, y1: 0, y2: 14 },
    'L2-PLATE-01': { x1: 29, x2: 41, y1: 0, y2: 13.5 },
    'CLG-L2-01': { x1: 29, x2: 41, y1: 0, y2: 13.5 },
    'F-L2-Y0-01': { x1: 29, x2: 41, y1: 0, y2: 0.14 },
    'W-L2-ST-CH-01': { x1: 32, x2: 41, y1: 2.43, y2: 2.57 },
    'L3-PLATE-01': { x1: 29, x2: 41, y1: 0, y2: 13.5 },
    'RF-L3-01': { x1: 27.472, x2: 41, y1: 0, y2: 13.5 },
    'RF-GL-01': { x1: 0, x2: 29, y1: 0, y2: 14 },
    'ST-01': { x1: 20.5, x2: 29, y1: 0.5, y2: 2 },
    'ST-02': { x1: 32.5, x2: 41, y1: 0.5, y2: 2 },
    'Z-ST-02-01': { x1: 32.5, x2: 41, y1: 0, y2: 2.5 },
    'Z-ST-02-PLANT-01': { x1: 33.2, x2: 34.6, y1: 0.72, y2: 1.78 },
    'Z-L2-CORRIDOR-01': { x1: 29, x2: 32.5, y1: 0, y2: 13.5 },
    'Z-CS-M-01': { x1: 32, x2: 41, y1: 2.5, y2: 8 },
    'Z-CS-F-01': { x1: 32, x2: 41, y1: 8, y2: 13.5 },
    'L3-EXT-01': { x1: 38.428, x2: 41, y1: 0, y2: 5.392 },
    'Z-L3-ARRIVAL-01': { x1: 38.666, x2: 41, y1: 0.5, y2: 2 },
    'Z-L3-TERRACE-01': { x1: 38.428, x2: 41, y1: 0, y2: 5.392 },
    'Z-WC-POOL-M-01': { x1: 31, x2: 35.5, y1: 0, y2: 3.5 },
    'Z-WC-POOL-F-01': { x1: 31, x2: 35.5, y1: 3.5, y2: 7.5 },
    'Z-WC-PLAY-M-01': { x1: 35.5, x2: 39, y1: 0, y2: 3.5 },
    'Z-WC-PLAY-F-01': { x1: 35.5, x2: 39, y1: 3.5, y2: 7.5 },
    'Z-STOR-01': { x1: 31, x2: 32.5, y1: 7.5, y2: 14 },
    'Z-WTP-01': { x1: 32.5, x2: 39, y1: 7.5, y2: 14 },
    'Z-CHEM-01': { x1: 37.5, x2: 39, y1: 11, y2: 14 },
    'RF-PV-RES-01': { x1: 27.722, x2: 40.75, y1: 0.25, y2: 13.25 },
  };
  for (const [entityId, expected] of Object.entries(requiredBounds)) {
    let entity;
    try {
      entity = resolveGeometryEntity(active, entityId);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    check(errors, sameBounds(entity.bounds, expected), `${entityId} bounds must match the v0.6.7 SITE-XY contract.`);
  }

  const pool = resolveGeometryEntity(active, 'POOL-01');
  const poolHall = resolveGeometryEntity(active, 'Z-PH-01');
  const serviceWing = resolveGeometryEntity(active, 'CORE-01');
  const stair = resolveGeometryEntity(active, 'ST-01');
  check(errors, containedBy(pool.bounds, poolHall.bounds), 'POOL-01 must remain inside the pool hall.');
  check(errors, !positiveOverlap(pool.bounds, stair.bounds), 'ST-01 must not intrude into POOL-01.');
  check(errors, !positiveOverlap(pool.bounds, serviceWing.bounds), 'POOL-01 must not intrude into the service wing.');
  check(errors, closeTo(active.l1.pool.shallowDepth, 1.2) && closeTo(active.l1.pool.deepDepth, 1.5), 'POOL-01 depths must remain 1.2–1.5 m.');
  check(errors, active.l1.pool.laneBands?.length === 4, 'POOL-01 must preserve the four confirmed width bands.');

  const zones = Object.values(active.l1.zones);
  const toilets = zones.filter((zone) => zone.fixtures);
  check(errors, toilets.length === 4, 'L1 must contain four independent toilet zones.');
  check(errors, toilets.every((zone) => containedBy(zone.bounds, serviceWing.bounds)), 'All toilet zones must stay within CORE-01.');
  for (let i = 0; i < toilets.length; i += 1) {
    for (let j = i + 1; j < toilets.length; j += 1) {
      check(errors, !positiveOverlap(toilets[i].bounds, toilets[j].bounds), `${toilets[i].entityId} and ${toilets[j].entityId} must not overlap.`);
    }
  }
  const entrances = active.l1.toiletEntrances ?? [];
  check(errors, entrances.length === 4, 'Exactly four independent toilet entrance openings are required.');
  check(errors, entrances.filter(({ side }) => side === 'x31').length === 2, 'Pool-side toilets require exactly two X31 entrances.');
  check(errors, entrances.filter(({ side }) => side === 'x39').length === 2, 'Playground-side toilets require exactly two X39 entrances.');
  check(errors, entrances.every(({ clearWidth }) => closeTo(clearWidth, 1)), 'All toilet entrances must have 1.00 m clear width.');
  check(errors, entrances.every(({ openingType, doorLeaf }) => openingType === 'doorless-opening' && doorLeaf === false), 'All toilet entrances must be doorless openings.');
  const entranceById = Object.fromEntries(entrances.map((entrance) => [entrance.entityId, entrance]));
  check(errors, entranceById['OP-WC-POOL-M-01']?.facadePosition === 'right' && closeTo(entranceById['OP-WC-POOL-M-01']?.center?.[1], 1), 'Pool male entrance must be on the right when viewed from the pool hall.');
  check(errors, entranceById['OP-WC-POOL-F-01']?.facadePosition === 'left' && closeTo(entranceById['OP-WC-POOL-F-01']?.center?.[1], 6.5), 'Pool female entrance must be on the left at Y6.0–7.0.');
  check(errors, entranceById['OP-WC-PLAY-M-01']?.facadePosition === 'left' && closeTo(entranceById['OP-WC-PLAY-M-01']?.center?.[1], 1), 'Playground male entrance must be on the left when viewed from the playground.');
  check(errors, entranceById['OP-WC-PLAY-F-01']?.facadePosition === 'right' && closeTo(entranceById['OP-WC-PLAY-F-01']?.center?.[1], 6.5), 'Playground female entrance must be on the right at Y6.0–7.0.');
  check(errors, active.l1.zones.poolMaleToilet?.layout?.washbasinWall === 'y0' && active.l1.zones.playgroundMaleToilet?.layout?.washbasinWall === 'y0', 'Both male toilet washbasins must line the Y0 wall after entry.');
  check(errors, active.l1.zones.poolFemaleToilet?.layout?.washbasinWall === 'y7.5' && active.l1.zones.playgroundFemaleToilet?.layout?.washbasinWall === 'y7.5', 'Both female toilet washbasins must line the Y7.5 wall after entry.');
  check(errors, toilets.every((zone) => zone.layout?.toiletCubicles?.every(({ doorLeaf }) => doorLeaf === true)), 'Every internal WC cubicle must retain a door leaf.');
  check(errors, toilets.every((zone) => zone.privacyScreen === false && zone.layout?.privacyScreen === undefined), 'All toilet entrance privacy screens must remain removed in v0.6.3.');
  check(errors, toilets.every((zone) => zone.layout?.toiletCubicles?.every(({ wallContact }) => wallContact === 'y3.5')), 'Every WC cubicle must contact the Y3.5 wall.');
  check(errors, active.l1.zones.poolFemaleToilet.layout.toiletCubicles.length === 3, 'Pool female toilet must have three WCs on Y3.5.');
  check(errors, active.l1.zones.poolMaleToilet.layout.toiletCubicles.length === 2, 'Pool male toilet must have two WCs on Y3.5.');
  check(errors, active.l1.zones.playgroundFemaleToilet.layout.toiletCubicles.length === 2, 'Playground female toilet must have two WCs on Y3.5.');
  check(errors, active.l1.zones.playgroundMaleToilet.layout.toiletCubicles.length === 1, 'Playground male toilet must have one WC on Y3.5.');
  check(errors, active.l1.zones.poolMaleToilet.layout.urinals.some(({ center, wallContact }) => closeTo(center[0], 31.18) && wallContact === 'x31'), 'One pool male urinal must move to the X31 wall.');
  check(errors, active.l1.zones.playgroundMaleToilet.fixtures.urinals === 2 && active.l1.zones.playgroundMaleToilet.layout.urinals.length === 2, 'Playground male toilet must have two adjacent urinals in v0.6.3.');
  check(errors, active.l1.zones.playgroundMaleToilet.fixtures.washbasins === 2 && active.l1.zones.playgroundMaleToilet.layout.washbasins.length === 2, 'Playground male toilet must have two adjacent washbasins in v0.6.3.');
  check(errors, active.l1.zones.playgroundFemaleToilet.fixtures.washbasins === 2 && active.l1.zones.playgroundFemaleToilet.layout.washbasins.length === 2, 'Playground female toilet must have two adjacent washbasins in v0.6.3.');
  check(errors, active.l1.zones.playgroundMaleToilet.layout.washbasins.some(({ center, existing }) => closeTo(center[0], 37.7) && existing === true), 'The existing playground male washbasin must remain at X37.7.');
  check(errors, active.l1.zones.playgroundFemaleToilet.layout.washbasins.some(({ center, existing }) => closeTo(center[0], 37.7) && existing === true), 'The existing playground female washbasin must remain at X37.7.');
  check(errors, active.l1.zones.playgroundMaleToilet.layout.urinals.some(({ center, existing }) => closeTo(center[0], 37.3) && existing === true), 'The existing playground male urinal must remain at X37.3.');
  check(errors, active.l1.serviceWing?.architecturalStyle?.scope === 'all-opaque-l1-l2-l3-service-volumes', 'All opaque service volumes must use the confirmed fair-faced concrete style.');
  check(errors, active.l1.y0ExteriorFacade?.materialIntent === 'segmented-safety-glass-and-fair-faced-concrete'
    && active.l1.y0ExteriorFacade?.poolHallMaterialIntent === 'safety-glass'
    && active.l1.y0ExteriorFacade?.serviceWingMaterialIntent === 'fair-faced-exposed-concrete'
    && active.l1.y0ExteriorFacade?.segments?.length === 4
    && active.l1.y0ExteriorFacade?.segments?.at(-1)?.x1 === 31
    && active.l1.y0ExteriorFacade?.segments?.at(-1)?.x2 === 39
    && active.l1.y0ExteriorFacade?.mainEntranceEntityId === 'EN-01', 'L1 Y0 must keep pool-hall glass at X0.5–31 and fair-faced concrete only at service body X31–39.');
  check(errors, sameBounds(active.l1.mainEntrance?.bounds, { x1: 1, x2: 3, y1: 0, y2: 0.2 }), 'EN-01 must shift +0.5 m to X1–3/Y0.');
  check(errors, sameBounds(active.l1.westSetback?.bounds, { x1: 0, x2: 0.5, y1: 0, y2: 14 })
    && sameBounds(active.l1.westGlassEave?.bounds, { x1: 0, x2: 0.5, y1: 0, y2: 14 })
    && active.l1.westGlassEave?.rainwaterRecoveryEntityId === 'RW-WEST-01', 'The west wall setback must create the X0–0.5 glass eave and rainwater recovery zone.');
  check(errors, sameBounds(active.l1.rearGlassCanopy?.bounds, { x1: 31, x2: 39, y1: 13.5, y2: 14.5 })
    && active.l1.rearGlassCanopy?.buildingLineY === 14
    && active.l1.rearGlassCanopy?.siteBoundsUnchanged === true, 'The service rear glass canopy must project from Y13.5 to Y14.5 while SITE-XY remains Y0–14.');
  check(errors, active.l1.zones.chemicalRoom?.publicAccess === false, 'The chemical room must remain independent from public circulation.');
  check(errors, active.l1.structuralStrategy?.glassCarriesGravityLoad === false, 'Glass must not be a gravity-support element.');
  check(errors, active.l1.structuralStrategy?.isolatedColumnsAllowed === false, 'The integrated structure strategy must avoid isolated columns.');

  check(errors, closeTo(active.levels.poolDeckElevation, 0.3), 'Pool deck elevation must be +0.30 m.');
  check(errors, closeTo(active.levels.l2Elevation, 3.3) && closeTo(active.levels.l3Elevation, 6.88), 'L2/L3 elevations must be +3.30/+6.88 m.');
  check(errors, active.stair.riserCount === 20 && active.stair.treadsPerRun === 9, 'ST-01 must contain 20 risers and 18 treads.');
  check(errors, closeTo(active.stair.runLengthPerFlight, 2.7) && closeTo(active.stair.midLandingLength, 3.1), 'ST-01 must use 2.70 + 3.10 + 2.70 m plan geometry.');
  check(errors, closeTo(active.stair.upperElevation, active.levels.l2Elevation), 'ST-01 must connect directly to L2.');
  check(errors, active.stair.upperConnection === 'direct-to-l2-at-x29', 'ST-01 must not use a short bridge to L2.');
  check(errors, active.stair.designIntent === 'suspended-floating-stair' && active.stair.stringerCount === 2 && active.stair.underStairEnclosure === false, 'ST-01 must remain a suspended floating stair on two continuous stringers with an open underside.');

  check(errors, closeTo(active.l2.poolAtriumOverlap, 2) && closeTo(active.l2.rightSetbackOverhang, 2), 'L2 must preserve the two 2 m overhang relationships.');
  check(errors, active.l2.gridDisplay?.minorSpacing === 0.5 && active.l2.gridDisplay?.majorSpacing === 2.5 && active.l2.gridDisplay?.axisLabels === true, 'L2 must expose the 0.5 m / 2.5 m SITE-XY grid with axis labels.');
  check(errors, closeTo(active.l2.circulationZone?.area, 41.75) && active.l2.circulationZone?.standingOnly === true && active.l2.circulationZone?.seatingAllowed === false, 'L2 must provide the 41.75 m² standing-only L-shaped pool-view corridor.');
  check(errors, closeTo(active.l2.stairZone?.area, 21.25) && active.l2.stairZone?.y0Facade === 'full-width-safety-glass' && active.l2.stairZone?.y2_5Divider === 'continuous-fair-faced-exposed-concrete', 'L2 must keep the independent Y0–2.5 stair zone with full-width Y0 glass and a continuous Y2.5 concrete divider.');
  check(errors, active.l2.y0ExteriorFacade?.materialIntent === 'full-width-safety-glass' && active.l2.y0ExteriorFacade?.opaqueSegments === false, 'L2 Y0 must be full-width safety glass without opaque wall segments.');
  check(errors, active.l2.stairChangingDivider?.axis === 'y2.5' && JSON.stringify(active.l2.stairChangingDivider?.spanX) === JSON.stringify([32, 41]) && active.l2.stairChangingDivider?.openings?.length === 0 && active.l2.stairChangingDivider?.continuous === true, 'L2 Y2.5 divider must fill X32–41 without an opening from the stair zone to the changing room.');
  check(errors, active.l2.ceiling?.continuous === true && closeTo(active.l2.ceiling?.elevation, 6.88) && sameBounds(active.l2.ceiling?.bounds, active.l2.floorPlate.bounds), 'L2 must have a complete ceiling over the full fixed floor-plate bounds.');
  check(errors, active.l2.changingRoomEntries?.length === 2 && active.l2.changingRoomEntries.every(({ clearWidth, doorLeaf, openingType }) => closeTo(clearWidth, 1) && doorLeaf === false && openingType === 'doorless-opening'), 'L2 male and female changing rooms must each have one 1.00 m doorless X32 entrance.');
  check(errors, active.l2.corridorFeatures?.standingCounter?.chairs === 0 && active.l2.corridorFeatures?.standingCounter?.suspended === true, 'The L2 corridor counter must be suspended and have no chairs.');
  check(errors, active.l2.corridorFeatures?.poolObservationWindow?.wall === 'x29', 'The L2 pool observation window must remain on X29.');
  const showerZones = Object.values(active.l2.zones ?? {});
  check(errors, showerZones.length === 2 && showerZones.every(({ showerCount, showerCubicles }) => showerCount === 15 && showerCubicles?.length === 15), 'L2 must provide 15 male and 15 female showers.');
  check(errors, showerZones.every(({ showerModuleSize, showerDimensionBasis }) => closeTo(showerModuleSize?.[0], 1.2) && closeTo(showerModuleSize?.[1], 1.2) && showerDimensionBasis === 'inclusive-of-partitions'), 'Every L2 shower must use a 1.20 × 1.20 m module inclusive of partitions.');
  check(errors, showerZones.every(({ showerCubicles }) => showerCubicles.every(({ planBounds }) => closeTo(planBounds.x2 - planBounds.x1, 1.2) && closeTo(planBounds.y2 - planBounds.y1, 1.2))), 'Every L2 shower cubicle plan module must measure 1.20 × 1.20 m.');
  check(errors, showerZones.every(({ showerCubicles }) => showerCubicles.every(({ planBounds }) => !positiveOverlap(planBounds, active.l2.stairZone.bounds))), 'L2 shower cubicles must not overlap the independent ST-02 zone.');
  check(errors, showerZones.every(({ supportFixtures }) => supportFixtures?.fixtures?.toilets === 1 && supportFixtures?.fixtures?.washbasins === 2 && supportFixtures.toiletCubicles?.length === 1 && supportFixtures.washbasins?.length === 2), 'Each L2 changing room must provide one WC and two washbasins.');
  check(errors, active.l2.stairToL3.lowerStartX === 32.5 && active.l2.stairToL3.axis === '+x' && JSON.stringify(active.l2.stairToL3.yBandLocked) === JSON.stringify([0.5, 2]), 'ST-02 must start at X32.5 and remain horizontal in Y0.5–2 while ascending +X.');
  check(errors, active.l2.stairToL3.riserCount === 22 && active.l2.stairToL3.treadsPerRun === 10 && closeTo(active.l2.stairToL3.upperElevation, 6.88), 'ST-02 must use the 22-riser two-flight concept and reach L3 +6.88 m.');
  check(errors, active.l2.stairToL3.designIntent === 'suspended-floating-stair' && active.l2.stairToL3.stringerCount === 2 && active.l2.stairToL3.underStairEnclosure === false, 'ST-02 must be a suspended floating stair with two continuous stringers and an open underside.');
  check(errors, active.l2.stairToL3.underStairLandscape?.planterCount === 3 && active.l2.stairToL3.underStairLandscape?.containers === 'removable-lightweight-planters' && active.l2.stairToL3.underStairLandscape?.deepSoil === false && active.l2.stairToL3.underStairLandscape?.waterFeature === false, 'ST-02 under-stair landscape must use three removable lightweight planters without deep soil or water features.');
  check(errors, closeTo(active.l3.planRotation, 25.5), 'L3 plan rotation must be +25.5°.');
  check(errors, closeTo(active.l3.mirror.leanFromVertical, 23), 'L3 mirror wall lean must be +23.0°.');
  check(errors, active.l3.mirror.wallAndMirrorCoplanar === true, 'The mirror and loadbearing wall must remain coplanar.');
  check(errors, active.l3.mirror.sideWallEndGapsFilled === true && active.l3.mirror.roofEdgeContinuous === true, 'L3 mirror end gaps must be filled and the mirror top must meet the complete roof.');
  check(errors, closeTo(active.l3.planPivot.x, 35) && closeTo(active.l3.planPivot.y, 6.75), 'L3 plan pivot must remain X35/Y6.75.');
  check(errors, closeTo(active.l3.orthogonalExtension.grossArea, 6.935) && active.l3.orthogonalExtension.rotation === 0 && active.l3.orthogonalExtension.withinL2Projection === true, 'L3 must add the fixed orthogonal 6.935 m² extension within the L2 projection.');
  check(errors, closeTo(active.l3.arrivalWing.area, 2.964) && active.l3.arrivalWing.covered === true && active.l3.arrivalWing.connectsStairToIndoorL3 === true && active.l3.arrivalWing.soleRouteViaTerrace === false, 'ST-02 must arrive through a covered indoor L3 wing, not solely through the terrace.');
  check(errors, closeTo(active.l3.landscapeTerrace.netLandscapeArea, 3.971) && active.l3.landscapeTerrace.access === 'teachers-and-maintenance-only' && active.l3.landscapeTerrace.studentsAllowed === false && active.l3.landscapeTerrace.visitorsAllowed === false && active.l3.landscapeTerrace.primaryEgress === false, 'L3 landscape terrace must be controlled for teachers and maintenance staff only and must not be primary egress.');
  check(errors, active.l3.roof?.continuous === true && active.l3.roof?.extendsToMirrorTopEdge === true && closeTo(active.l3.roof?.area, 182.628) && closeTo(active.l3.roof?.baseElevation, 10.48), 'L3 must have a complete 182.628 m² roof that extends to the leaned mirror top edge.');
  check(errors, closeTo(active.l3.pvRoofReserve?.area, 169.364) && closeTo(active.l3.pvRoofReserve?.roofArea, 182.628) && closeTo(active.l3.pvRoofReserve?.coveragePercent, 92.74) && closeTo(active.l3.pvRoofReserve?.perimeterSetback, 0.25) && active.l3.pvRoofReserve?.moduleLayoutStatus === 'working-dense-concept-layout' && active.l3.pvRoofReserve?.capacityStatus === 'deferred', 'L3 PV must densely cover the complete roof after a 0.25 m perimeter setback without committing capacity.');
  check(errors, active.l3.pvRoofReserve?.rotation === active.l3.planRotation && active.l3.pvRoofReserve?.excludedSupports?.includes('existing-glass-pool-roof'), 'The dense PV array must rotate with the L3 roof and remain separate from the glass pool roof.');
  check(errors, active.l3.energyStorageStrategy?.preferredLocation === 'ground-level-independent-outdoor-enclosure' && active.l3.energyStorageStrategy?.batteryObjectsOnGeneralL3Interior === false && active.l3.energyStorageStrategy?.fireApproval === false, 'Energy storage must prefer a ground-level independent outdoor enclosure and prohibit batteries in general L3 interior space.');
  check(errors, active.l3.programStrategy?.teacherObservationRoom === 'future-flexibility-only' && active.l3.programStrategy?.environmentalEducationDisplay === 'future-flexibility-only' && active.l3.programStrategy?.dryMaintenanceStorage === 'under-consideration-not-built', 'L3 must preserve future program flexibility without building observation, education, or dry-storage rooms now.');
  check(errors, closeTo(active.roof.pitch, 5) && closeTo(active.roof.lowElevation, 4) && closeTo(active.roof.highElevation, 6.537), 'The fixed glass roof must remain 29 m at 5° from +4.00 to +6.537 m.');

  check(errors, closeTo(active.solar.planRotation.value, active.l3.planRotation), 'Solar and L3 plan rotations must share one value.');
  check(errors, closeTo(active.solar.mirrorLeanFromVertical.value, active.l3.mirror.leanFromVertical), 'Solar and mirror-wall lean values must share one value.');
  check(errors, active.solar.workingResult?.warmPoolAddedKWh === 0, 'The X35 working result must keep warm-season added pool energy at zero.');
  check(errors, closeTo(active.solar.workingResult?.coolPoolAddedKWh, 1036.829), 'The X35 cool-season pool result must be +1,036.829 kWh.');
  check(errors, active.solar.analysisStatus === 'working-optimized-requires-professional-validation', 'Solar status must require professional validation.');
  check(errors, active.integrationReview?.status === 'conceptual-coordination-complete-professional-approvals-outstanding', 'Integration review must not claim professional approval.');
  check(errors, Object.values(active.integrationReview?.professionalApprovals ?? {}).every((value) => value === false), 'No professional approval may be implied by the conceptual model.');

  const idsByRegistry = [
    ['entity', model.entities ?? []],
    ['sheet', model.sheets ?? []],
    ['source', model.sources ?? []],
  ];
  for (const [label, records] of idsByRegistry) {
    for (const id of duplicates(records.map(({ id }) => id))) errors.push(`${label} ID is duplicated: ${id}`);
  }
  const sheetIds = (model.sheets ?? []).map(({ id }) => id);
  check(errors, JSON.stringify(sheetIds) === JSON.stringify(['REF-001', 'V067-L1', 'V067-L2', 'V067-L3', 'V067-SECTION']), 'Current sheet registry must contain only REF-001 and the four v0.6.7 sheets.');

  const boundedEntities = geometryEntities(active);
  check(errors, boundedEntities.size >= Object.keys(requiredBounds).length, 'Active geometry entity index is incomplete.');
  return errors;
}

export async function validateSourceFiles(model, repoRoot) {
  const errors = [];
  for (const source of model.sources ?? []) {
    if (!source.path || !source.sha256) {
      errors.push(`${source.id} must declare path and sha256.`);
      continue;
    }
    try {
      const bytes = await readFile(resolve(repoRoot, source.path));
      const actualHash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
      if (actualHash !== source.sha256.toUpperCase()) errors.push(`${source.id} SHA-256 does not match ${source.path}.`);
      if (Number.isFinite(source.byteSize) && source.byteSize !== bytes.byteLength) errors.push(`${source.id} byteSize does not match ${source.path}.`);
    } catch (error) {
      errors.push(`${source.id} cannot be read at ${source.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}
