import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { buildViewerModel } from '../../../../../../../core/viewer/viewer-data.mjs';
import { activeMirrorFootprintGeometry, projectPoolFootprint } from '../../../../../../../core/solar/pool-footprint.mjs';
import { deriveMirrorGeometry } from '../../../../../../../core/geometry/mirror-geometry.mjs';
import { reflectSolarRay } from '../../../../../../../core/solar/solar-reflection.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
test.after(async () => vite.close());

const THREE = await vite.ssrLoadModule('three');
const {
  MIRROR_BOUNCE_GLSL,
  MIRROR_REFLECTANCE,
  MirrorBounceLight,
  computeMirrorBounce,
  createMirrorBounceUniforms,
  installMirrorBounce,
  mirrorBounceToWorld,
  mirrorWallFromViewerModel,
  pickMirrorBounceUniforms,
  publishSceneMirrorBounce,
  readSceneMirrorBounce,
  writeMirrorBounceUniforms,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/mirror-bounce.ts');
const { computeSunLighting } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/sun-lighting.ts');

const sourceModel = JSON.parse(readFileSync(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const registry = JSON.parse(readFileSync(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8'));
const viewerModel = buildViewerModel(sourceModel, registry);
const wall = mirrorWallFromViewerModel(viewerModel);
const siteLocation = sourceModel.referenceSystem.siteLocation;
const at = (month, day, time, weather = 'clear') => {
  const [hour, minute] = time.split(':').map(Number);
  return computeSunLighting({
    moment: { year: 2026, month, day, minutes: hour * 60 + minute },
    location: {
      latitude: siteLocation.latitude.value,
      longitude: siteLocation.longitude.value,
      utcOffsetHours: siteLocation.utcOffsetHours,
    },
    positiveXAxisBearingFromTrueNorth: wall.positiveXAxisBearingFromTrueNorth,
    weather,
  });
};
const close = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
};

test('the 3D mirror wall reads the same inputs as the solar study', () => {
  // 單一真相：網站從模型取的鏡牆數值，和日照研究頁 activeMirrorFootprintGeometry 逐項相同。
  const study = activeMirrorFootprintGeometry(sourceModel);
  for (const key of ['startX', 'width', 'planRotation', 'leanFromVertical', 'height', 'baseElevation',
    'positiveXAxisBearingFromTrueNorth']) {
    assert.equal(wall[key], study[key], key);
  }
  assert.deepEqual(wall.pivot, study.pivot);
  assert.deepEqual(wall.poolRectangle, study.poolRectangle);
});

test('the reflected sunlight lands where the solar study projects it', () => {
  const lighting = at(12, 21, '09:30');
  const bounce = computeMirrorBounce(lighting, wall);
  assert.equal(bounce.active, true);
  assert.equal(bounce.hitsPool, true, 'winter-solstice morning light reaches the pool');
  // 光斑與入射角和日照研究頁同一組函式算出來的一樣。
  const reflection = reflectSolarRay({
    solarAltitude: lighting.altitude,
    solarAzimuth: lighting.azimuth,
    wallNormalAzimuth: deriveMirrorGeometry(wall).normalAzimuth,
    wallLeanFromVertical: wall.leanFromVertical,
  });
  const study = projectPoolFootprint(sourceModel, reflection);
  assert.equal(study.hitsPool, true);
  assert.equal(bounce.footprint.length, 4);
  bounce.footprint.forEach((point, index) => {
    close(point.x, study.footprint[index].x, 1e-9, `footprint[${index}].x`);
    close(point.y, study.footprint[index].y, 1e-9, `footprint[${index}].y`);
  });
  close(bounce.incidenceAngle, reflection.incidenceAngle, 1e-9, 'incidence');
  // 反射光往下走、是單位向量；亮度是陽光乘鏡面反射率，顏色與光源大小和陽光相同。
  assert.ok(bounce.direction.z < -0.5);
  close(Math.hypot(bounce.direction.x, bounce.direction.y, bounce.direction.z), 1, 1e-9, '|direction|');
  close(bounce.intensity, lighting.key.intensity * MIRROR_REFLECTANCE, 1e-12, 'intensity');
  assert.deepEqual(bounce.color, lighting.key.color);
  assert.equal(bounce.angularRadius, lighting.key.angularRadius);
  // 鏡面四個角點：下緣在 3F 樓板標高，上緣高出鏡牆高度。
  const mirror = deriveMirrorGeometry(wall);
  assert.deepEqual(bounce.corners.map(({ x, y, z }) => [x, y, z]), [
    mirror.lower[0], mirror.lower[1], mirror.upper[1], mirror.upper[0],
  ].map(({ x, y, z }) => [x, y, z]));
  close(bounce.corners[2].z - bounce.corners[1].z, wall.height, 1e-9, 'mirror height');
});

test('no reflected light at night, behind the mirror, or when it misses the ground', () => {
  const night = computeMirrorBounce(at(12, 21, '21:00'), wall);
  assert.equal(night.active, false);
  assert.equal(night.intensity, 0);
  assert.equal(night.direction, null);
  assert.deepEqual(night.footprint, []);

  // 夏至早上太陽在鏡面背後：沒有反射光，也沒有入射角。
  const summer = computeMirrorBounce(at(6, 21, '09:00'), wall);
  assert.equal(summer.active, false);
  assert.equal(summer.incidenceAngle, null);

  // 冬至午後光斑離開池面，仍有反射光（落在池外）。
  const afternoon = computeMirrorBounce(at(12, 21, '15:00'), wall);
  if (afternoon.active) assert.equal(afternoon.hitsPool, false);

  // 陰天的太陽還在，反射光跟著變弱、變柔，不會消失。
  const overcast = computeMirrorBounce(at(12, 21, '09:30', 'overcast'), wall);
  const clear = computeMirrorBounce(at(12, 21, '09:30'), wall);
  assert.equal(overcast.active, true);
  assert.ok(overcast.intensity < clear.intensity);
  assert.ok(overcast.angularRadius > clear.angularRadius);
});

/** 和場景相同的 SITE 根節點：SITE (x, y, z) → 物件 (x, z, y)，再轉一個角度並鏡射。 */
function siteRoot() {
  const root = new THREE.Group();
  root.rotation.y = 0.7;
  root.scale.set(1, 1, -1);
  root.position.set(3, 0, -2);
  root.updateMatrixWorld(true);
  return root;
}

test('the reflected light is handed to shaders in world and in object coordinates', () => {
  const bounce = computeMirrorBounce(at(12, 21, '09:30'), wall);
  const root = siteRoot();
  const world = mirrorBounceToWorld(bounce, root);
  const toWorld = (point) => root.localToWorld(new THREE.Vector3(point.x, point.z, point.y));
  assert.ok(world.enabled);
  assert.ok(world.origin.distanceTo(toWorld(bounce.corners[0])) < 1e-9);
  assert.ok(world.origin.clone().add(world.edgeU).distanceTo(toWorld(bounce.corners[1])) < 1e-9);
  assert.ok(world.origin.clone().add(world.edgeV).distanceTo(toWorld(bounce.corners[3])) < 1e-9);
  // 方向：SITE 的反射方向換到世界座標，仍是單位向量、仍往下。
  close(world.direction.length(), 1, 1e-9, '|direction|');
  assert.ok(world.direction.y < -0.5);
  close(world.softness, Math.tan(bounce.angularRadius), 1e-12, 'softness');
  close(world.color.r, bounce.color[0] * bounce.intensity, 1e-9, 'color');

  const uniforms = createMirrorBounceUniforms();
  writeMirrorBounceUniforms(uniforms, world, new THREE.Matrix4());
  assert.equal(uniforms.uMirrorBounceColor.value.w, 1);
  assert.ok(uniforms.uMirrorBounceOrigin.value.distanceTo(world.origin) < 1e-9);
  // 換到某個物件座標（例如水面網格）：點用整個矩陣，邊與方向只轉不移、長度不變。
  const mesh = new THREE.Object3D();
  mesh.position.set(-4, 1, 9);
  mesh.rotation.set(0.1, -1.2, 0);
  mesh.updateMatrixWorld(true);
  const inverse = mesh.matrixWorld.clone().invert();
  writeMirrorBounceUniforms(uniforms, world, inverse);
  assert.ok(uniforms.uMirrorBounceOrigin.value.distanceTo(mesh.worldToLocal(world.origin.clone())) < 1e-9);
  const far = mesh.worldToLocal(world.origin.clone().add(world.edgeU));
  assert.ok(uniforms.uMirrorBounceOrigin.value.clone().add(uniforms.uMirrorBounceEdgeU.value).distanceTo(far) < 1e-9);
  close(uniforms.uMirrorBounceDirection.value.length(), 1, 1e-9, 'local |direction|');

  writeMirrorBounceUniforms(uniforms, null, inverse);
  assert.equal(uniforms.uMirrorBounceColor.value.w, 0, 'no bounce switches the shaders off');
  const dark = mirrorBounceToWorld(computeMirrorBounce(at(12, 21, '21:00'), wall), root);
  assert.equal(dark.enabled, false);
  writeMirrorBounceUniforms(uniforms, dark, inverse);
  assert.equal(uniforms.uMirrorBounceColor.value.w, 0);

  // 水的著色器從場景讀同一份。
  const scene = new THREE.Scene();
  assert.equal(readSceneMirrorBounce(scene), null);
  publishSceneMirrorBounce(scene, world);
  assert.equal(readSceneMirrorBounce(scene), world);
  scene.userData.mirrorBounce = { enabled: true };
  assert.equal(readSceneMirrorBounce(scene), null, 'a malformed value is ignored');
});

test('the bounce is injected into the lit materials after three.js lights', () => {
  // 注入的程式碼用到 three.js 光照片段裡的這些名稱；改版後對不上時這裡先失敗。
  const begin = THREE.ShaderChunk.lights_fragment_begin;
  for (const name of ['vec3 geometryPosition', 'vec3 geometryNormal', 'vec3 geometryViewDir', 'vec3 geometryClearcoatNormal', 'IncidentLight directLight;']) {
    assert.ok(begin.includes(name), name);
  }
  const fragment = THREE.ShaderLib.physical.fragmentShader;
  assert.ok(fragment.includes('#include <common>') && fragment.includes('#include <lights_fragment_maps>'));
  assert.ok(fragment.indexOf('#include <lights_fragment_begin>') < fragment.indexOf('#include <lights_fragment_maps>'));

  const uniforms = createMirrorBounceUniforms();
  const material = new THREE.MeshPhysicalMaterial();
  let chained = 0;
  material.onBeforeCompile = () => { chained += 1; };
  assert.equal(installMirrorBounce(material, uniforms), true);
  assert.equal(installMirrorBounce(material, uniforms), true, 'installing twice is harmless');
  const shader = { fragmentShader: fragment, vertexShader: '', uniforms: {} };
  material.onBeforeCompile(shader, null);
  assert.equal(chained, 1, 'an earlier onBeforeCompile still runs, once');
  assert.equal(shader.uniforms.uMirrorBounceColor, uniforms.uMirrorBounceColor, 'shared, not copied');
  assert.equal(shader.fragmentShader.split('float mirrorBounceMask(').length, 2);
  assert.ok(shader.fragmentShader.indexOf('mirrorBounceMask( mirrorBounceWorld )')
    < shader.fragmentShader.indexOf('#include <lights_fragment_maps>'));
  assert.ok(material.customProgramCacheKey().endsWith('|mirror-bounce'));

  assert.equal(installMirrorBounce(new THREE.MeshBasicMaterial(), uniforms), false, 'unlit materials stay unlit');
  assert.equal(installMirrorBounce(new THREE.ShaderMaterial(), uniforms), false);
  assert.ok(MIRROR_BOUNCE_GLSL.includes('uniform vec4 uMirrorBounceColor;'));

  // 著色器材質（水）用同名的 uniform，從它的 uniforms 取出同一批物件。
  const owned = createMirrorBounceUniforms();
  const picked = pickMirrorBounceUniforms({ ...owned, uOther: { value: 1 } });
  assert.equal(picked.uMirrorBounceEdgeV, owned.uMirrorBounceEdgeV);
  assert.throws(() => pickMirrorBounceUniforms({}), /uMirrorBounceColor/);
});

test('hiding the mirror wall layer switches its reflected light off', () => {
  const scene = new THREE.Scene();
  const root = siteRoot();
  const layer = new THREE.Group();
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  layer.add(mirror);
  root.add(layer);
  scene.add(root);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  scene.add(deck);
  const light = new MirrorBounceLight(wall, scene, root, mirror);
  light.install(scene);
  assert.equal(deck.material.userData.mirrorBounce, light.uniforms);

  assert.equal(light.landing, 'none', 'nothing before the first lighting');
  light.setLighting(at(12, 21, '09:30'));
  assert.equal(light.landing, 'pool');
  assert.ok(light.incidenceAngle > 0);
  assert.equal(light.uniforms.uMirrorBounceColor.value.w, 1);
  assert.ok(readSceneMirrorBounce(scene)?.enabled);

  layer.visible = false;
  light.sync();
  assert.equal(light.landing, 'none');
  assert.equal(light.uniforms.uMirrorBounceColor.value.w, 0);
  assert.equal(readSceneMirrorBounce(scene), null);

  layer.visible = true;
  light.sync();
  assert.equal(light.landing, 'pool');
  light.setLighting(at(12, 21, '21:00'));
  assert.equal(light.landing, 'none');
  assert.equal(light.uniforms.uMirrorBounceColor.value.w, 0);
});
