// Three layers guard the L3 mirror against another handedness mistake: an
// independent compass-frame formula, invariants that hold for any angle, and
// fixed sign checks. One snapshot is kept, labelled with the angles it belongs to.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveMirrorGeometry } from '../../../../core/geometry/mirror-geometry.mjs';
import {
  azimuthFromSiteVector,
  deriveMirrorNormalAzimuth,
  deriveSiteOrientation,
  siteVectorFromAzimuth,
} from '../../../../core/geometry/site-orientation.mjs';
import { activeSolarStudyGeometry } from '../../../../core/solar/solar-angle-analysis.mjs';

const model = JSON.parse(
  await readFile(new URL('../../../../model/project-model.json', import.meta.url), 'utf8'),
);
const study = activeSolarStudyGeometry(model);
const bearing = model.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth;
const RADIANS = Math.PI / 180;

const mirrorAt = (planRotation, leanFromVertical = study.mirrorLeanFromVertical) => deriveMirrorGeometry({
  startX: study.startX,
  width: study.width,
  pivot: { x: study.pivotX, y: study.pivotY },
  planRotation,
  leanFromVertical,
  height: study.mirrorHeight,
  baseElevation: study.baseElevation,
  positiveXAxisBearingFromTrueNorth: bearing,
});

const close = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} ≠ ${expected}`);
};

// Independent formula: work in east/north, where turning clockwise seen from
// above is (E, N) → (E cos r + N sin r, −E sin r + N cos r), then project back.
function independentCorners(planRotation, leanFromVertical) {
  const unit = (azimuth) => ({ e: Math.sin(azimuth * RADIANS), n: Math.cos(azimuth * RADIANS) });
  const siteX = unit(bearing);
  const siteY = unit(bearing - 90);
  const toEastNorth = ({ x, y }) => ({ e: x * siteX.e + y * siteY.e, n: x * siteX.n + y * siteY.n });
  const toSite = ({ e, n }) => ({ x: e * siteX.e + n * siteX.n, y: e * siteY.e + n * siteY.n });
  const pivot = toEastNorth({ x: study.pivotX, y: study.pivotY });
  const r = planRotation * RADIANS;
  const turn = (point) => {
    const p = toEastNorth(point);
    const e = p.e - pivot.e;
    const n = p.n - pivot.n;
    return toSite({ e: pivot.e + e * Math.cos(r) + n * Math.sin(r), n: pivot.n - e * Math.sin(r) + n * Math.cos(r) });
  };
  const lower = [turn({ x: study.startX, y: 0 }), turn({ x: study.startX, y: study.width })];
  const normal = toSite(unit(bearing + 180 + planRotation));
  const lean = study.mirrorHeight * Math.tan(leanFromVertical * RADIANS);
  const upper = lower.map(({ x, y }) => ({ x: x + normal.x * lean, y: y + normal.y * lean }));
  return { lower, upper, normal };
}

test('mirror corners match an independent compass-frame formula at any angle', () => {
  for (const planRotation of [-40, -12.5, 0, 9.5, 25.5, 40]) {
    for (const lean of [0, 8.5, 23]) {
      const mirror = mirrorAt(planRotation, lean);
      const expected = independentCorners(planRotation, lean);
      for (const edge of ['lower', 'upper']) {
        mirror[edge].forEach((corner, index) => {
          close(corner.x, expected[edge][index].x, 1e-9, `${edge}[${index}].x at ${planRotation}°/${lean}°`);
          close(corner.y, expected[edge][index].y, 1e-9, `${edge}[${index}].y at ${planRotation}°/${lean}°`);
        });
      }
      close(mirror.normal.x, expected.normal.x, 1e-12, 'normal.x');
      close(mirror.normal.y, expected.normal.y, 1e-12, 'normal.y');
    }
  }
});

test('mirror invariants hold for any rotation and lean', () => {
  const pivot = { x: study.pivotX, y: study.pivotY };
  const lean = study.mirrorHeight * Math.tan(study.mirrorLeanFromVertical * RADIANS);
  for (let planRotation = -40; planRotation <= 40; planRotation += 2.5) {
    const { lower, upper, normal } = mirrorAt(planRotation);
    const edge = { x: lower[1].x - lower[0].x, y: lower[1].y - lower[0].y };
    close(Math.hypot(edge.x, edge.y), study.width, 1e-9, 'edge keeps the L3 width');
    close(Math.hypot(normal.x, normal.y), 1, 1e-12, 'normal is a unit vector');
    close(edge.x * normal.x + edge.y * normal.y, 0, 1e-9, 'normal is perpendicular to the edge');
    assert.ok(normal.x < 0, 'the mirror always faces the pool side (SITE −X)');
    upper.forEach((corner, index) => {
      close(corner.x - lower[index].x, normal.x * lean, 1e-9, 'top leans out along the normal');
      close(corner.y - lower[index].y, normal.y * lean, 1e-9, 'top leans out along the normal');
      close(corner.z - lower[index].z, study.mirrorHeight, 1e-12, 'mirror height');
    });
    const unrotated = [{ x: study.startX, y: 0 }, { x: study.startX, y: study.width }];
    lower.forEach((corner, index) => close(
      Math.hypot(corner.x - pivot.x, corner.y - pivot.y),
      Math.hypot(unrotated[index].x - pivot.x, unrotated[index].y - pivot.y),
      1e-9,
      'rotation keeps distance to the pivot',
    ));
  }
  const level = mirrorAt(0, 0);
  assert.deepEqual(level.lower.map(({ x }) => x), [study.startX, study.startX]);
  close(level.normal.x, -1, 1e-12, 'unrotated mirror faces SITE −X');
  close(level.normal.y, 0, 1e-12, 'unrotated mirror faces SITE −X');
});

test('handedness guard: clockwise L3 rotation and compass conversion keep their signs', () => {
  const orientation = deriveSiteOrientation(model.referenceSystem);
  const north = siteVectorFromAzimuth(0, bearing);
  close(north.x, orientation.northInSite.x, 1e-12, 'azimuth 0° is true north in SITE-XY');
  close(north.y, orientation.northInSite.y, 1e-12, 'azimuth 0° is true north in SITE-XY');
  close(azimuthFromSiteVector({ x: 1, y: 0 }, bearing), 307, 1e-9, 'SITE +X is 307°');
  close(azimuthFromSiteVector({ x: 0, y: 1 }, bearing), 217, 1e-9, 'SITE +Y is 217°');

  const level = mirrorAt(0);
  const turned = mirrorAt(10);
  assert.ok(turned.lower[0].y > level.lower[0].y, 'clockwise rotation raises Y at the Y0 end');
  assert.ok(turned.lower[1].x > level.lower[1].x, 'clockwise rotation raises X at the far end');
  const active = mirrorAt(study.planRotation);
  close(active.normalAzimuth, deriveMirrorNormalAzimuth(model.referenceSystem, study.planRotation), 1e-9, 'normal azimuth');
  close(azimuthFromSiteVector(active.normal, bearing), active.normalAzimuth, 1e-9, 'normal vector matches its azimuth');
});

test('snapshot for the GEO-0.8.2 angles (+25.5° plan, +23.0° lean, pivot X35)', () => {
  assert.equal(study.planRotation, 25.5);
  assert.equal(study.mirrorLeanFromVertical, 23);
  assert.equal(study.pivotX, 35);
  const round = ({ x, y, z }) => [Number(x.toFixed(6)), Number(y.toFixed(6)), Number(z.toFixed(2))];
  const mirror = mirrorAt(study.planRotation);
  assert.deepEqual(mirror.lower.map(round), [[26.678538, 3.240616, 6.88], [32.490438, 15.425517, 6.88]]);
  assert.deepEqual(mirror.upper.map(round), [[25.299289, 3.898484, 10.48], [31.111189, 16.083385, 10.48]]);
  assert.equal(mirror.normalAzimuth, 152.5);
});
