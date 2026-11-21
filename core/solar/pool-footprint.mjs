// Whether the reflection from the L3 mirror lands on the pool at one moment.
// Pure (no file access) so the solar study page and the analysis share it: the
// page's "hits the pool" verdict is the same footprint test the annual energy
// analysis integrates (DEC-151).
import { resolveActiveGeometry, resolveGeometryEntity } from '../geometry/active-geometry.mjs';
import { deriveSiteOrientation } from '../geometry/site-orientation.mjs';
import { projectMirrorReflectionFootprint } from './solar-reflection.mjs';

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
};

/** Mirror and pool geometry of the active revision, with optional study overrides. */
export function activeMirrorFootprintGeometry(model, overrides = {}) {
  const active = resolveActiveGeometry(model);
  const plate = resolveGeometryEntity(active, 'L3-PLATE-01').bounds;
  const pool = resolveGeometryEntity(active, 'POOL-01').bounds;
  return {
    positiveXAxisBearingFromTrueNorth: deriveSiteOrientation(model.referenceSystem)
      .positiveXAxisBearingFromTrueNorth,
    startX: finite(plate.x1, 'L3-PLATE-01.bounds.x1'),
    width: finite(plate.y2 - plate.y1, 'L3-PLATE-01 width'),
    pivot: {
      x: finite(overrides.pivotX ?? active.l3.planPivot.x, 'pivot.x'),
      y: finite(active.l3.planPivot.y, 'pivot.y'),
    },
    planRotation: finite(overrides.planRotation ?? active.solar.planRotation.value, 'planRotation'),
    leanFromVertical: finite(
      overrides.leanFromVertical ?? active.solar.mirrorLeanFromVertical.value,
      'leanFromVertical',
    ),
    height: finite(active.l3.mirror.height, 'active.l3.mirror.height'),
    baseElevation: finite(active.l3.mirror.baseElevation, 'active.l3.mirror.baseElevation'),
    poolRectangle: { ...pool },
  };
}

/** Projects the mirror's reflection onto the pool plane for one solar reflection. */
export function projectPoolFootprint(model, reflection, overrides = {}) {
  return projectMirrorReflectionFootprint({
    ...activeMirrorFootprintGeometry(model, overrides),
    reflection,
  });
}
