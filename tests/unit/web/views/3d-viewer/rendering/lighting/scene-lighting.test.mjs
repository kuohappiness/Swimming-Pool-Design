import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createServer } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
test.after(async () => vite.close());

const { aimKeyLight, deriveShadowFocus, siteDirectionToWorld, toSceneLighting } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/lighting/scene-lighting.ts',
);
const { SKY_NOON_INTENSITY, computeSunLighting } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/lighting/sun-lighting.ts',
);
const { deriveViewerOrientation } = await vite.ssrLoadModule('/src/views/3d-viewer/orientation.ts');
const { solarDirectionInLocalCoordinates } = await import('../../../../../../../core/solar/solar-reflection.mjs');

const model = JSON.parse(readFileSync(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const bearing = model.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth;
const siteLocation = model.referenceSystem.siteLocation;
const RADIANS = Math.PI / 180;

/** 和 scene-factory 相同的兩層座標：世界方位旋轉，再把 SITE-Y 對到 Three 的 −Z。 */
function siteRoots() {
  const worldRoot = new THREE.Group();
  worldRoot.rotation.y = deriveViewerOrientation(model.referenceSystem).threeWorldRotationRadians;
  const siteRoot = new THREE.Group();
  siteRoot.position.set(-20.5, 0, 7.25);
  siteRoot.scale.set(1, 1, -1);
  worldRoot.add(siteRoot);
  worldRoot.updateMatrixWorld(true);
  return siteRoot;
}

const lightingAt = (month, day, minutes, weather = 'clear') => computeSunLighting({
  moment: { year: 2026, month, day, minutes },
  location: {
    latitude: siteLocation.latitude.value,
    longitude: siteLocation.longitude.value,
    utcOffsetHours: siteLocation.utcOffsetHours,
  },
  positiveXAxisBearingFromTrueNorth: bearing,
  weather,
});

test('a sun direction lands on the same compass bearing in the scene: north is world −Z, east is +X', () => {
  const siteRoot = siteRoots();
  for (const [azimuth, altitude] of [[0, 0], [90, 0], [180, 0], [270, 0], [135, 30], [200, 65], [307, 10]]) {
    const world = siteDirectionToWorld(solarDirectionInLocalCoordinates({ azimuth, altitude }, bearing), siteRoot);
    const expected = new THREE.Vector3(
      Math.sin(azimuth * RADIANS) * Math.cos(altitude * RADIANS),
      Math.sin(altitude * RADIANS),
      -Math.cos(azimuth * RADIANS) * Math.cos(altitude * RADIANS),
    );
    assert.ok(world.distanceTo(expected) < 1e-9, `azimuth ${azimuth} altitude ${altitude}: ${world.toArray()}`);
  }
  // 模型自己的 +X 軸是方位 307°，換到世界座標也是。
  const plusX = new THREE.Vector3(1, 0, 0).transformDirection(siteRoot.matrixWorld);
  assert.ok(Math.abs(plusX.x - Math.sin(bearing * RADIANS)) < 1e-9);
  assert.ok(Math.abs(plusX.z + Math.cos(bearing * RADIANS)) < 1e-9);
});

test('the winter morning sun stands in the south-east and above the horizon in world space', () => {
  const siteRoot = siteRoots();
  const focus = deriveShadowFocus({ bounds: { x1: 0, x2: 41, y1: 0, y2: 14.5 }, height: 11, margin: 8 }, siteRoot);
  const scene = toSceneLighting(lightingAt(12, 21, 9 * 60 + 30), siteRoot, focus);
  assert.ok(scene.keyDirection.x > 0.4, 'east component');
  assert.ok(scene.keyDirection.z > 0.4, 'south component');
  assert.ok(scene.keyDirection.y > 0.3 && scene.keyDirection.y < 0.6, 'about 30° high');
  assert.ok(Math.abs(scene.keyDirection.length() - 1) < 1e-9);
  assert.equal(scene.source.key.source, 'sun');
  assert.equal(scene.exposure, scene.source.exposure);
  assert.equal(scene.keyAngularRadius, scene.source.key.angularRadius);
  assert.deepEqual(scene.fog, scene.source.fog);
  // 倒影與間接光跟著天光變暗，最亮不超過晴天正午。
  assert.ok(scene.environmentScale > 0.8 && scene.environmentScale <= 1);
  const night = toSceneLighting(lightingAt(12, 21, 22 * 60), siteRoot, focus);
  assert.ok(night.environmentScale < 0.35 && night.environmentScale > 0);
  assert.ok(Math.abs(night.environmentScale - night.skyIntensity / SKY_NOON_INTENSITY) < 1e-12);
  assert.ok(night.keyDirection.y > 0.5, 'moon stays above the horizon');
});

test('the shadow focus is a sphere that contains the site, its margin and the full height', () => {
  const siteRoot = siteRoots();
  const source = { bounds: { x1: 0, x2: 41, y1: 0, y2: 14.5 }, height: 11, margin: 8 };
  const focus = deriveShadowFocus(source, siteRoot);
  for (const x of [source.bounds.x1 - source.margin, source.bounds.x2 + source.margin]) {
    for (const y of [source.bounds.y1 - source.margin, source.bounds.y2 + source.margin]) {
      for (const height of [0, source.height]) {
        const corner = new THREE.Vector3(x, height, y).applyMatrix4(siteRoot.matrixWorld);
        assert.ok(corner.distanceTo(focus.centre) <= focus.radius + 1e-9, `corner ${x},${y},${height}`);
      }
    }
  }
  assert.ok(Math.abs(focus.centre.y - source.height / 2) < 1e-9);
  assert.ok(focus.radius < 40, `radius ${focus.radius}`);
  for (const bad of [
    { ...source, height: 0 },
    { ...source, margin: -1 },
    { ...source, bounds: { ...source.bounds, x2: 0 } },
    { ...source, bounds: { ...source.bounds, y1: Number.NaN } },
  ]) {
    assert.throws(() => deriveShadowFocus(bad, siteRoot), TypeError);
  }
});

test('aiming the key light keeps the shadow frustum fixed in size while the sun moves', () => {
  const siteRoot = siteRoots();
  const focus = deriveShadowFocus({ bounds: { x1: 0, x2: 41, y1: 0, y2: 14.5 }, height: 11, margin: 8 }, siteRoot);
  const light = new THREE.DirectionalLight();
  for (const minutes of [7 * 60, 9 * 60 + 30, 12 * 60, 16 * 60 + 40, 22 * 60]) {
    const scene = toSceneLighting(lightingAt(12, 21, minutes), siteRoot, focus);
    light.shadow.needsUpdate = false;
    aimKeyLight(light, scene);
    const camera = light.shadow.camera;
    assert.deepEqual(
      [camera.left, camera.right, camera.top, camera.bottom],
      [-focus.radius, focus.radius, focus.radius, -focus.radius],
    );
    assert.ok(light.target.position.distanceTo(focus.centre) < 1e-9);
    const offset = light.position.clone().sub(focus.centre);
    assert.ok(Math.abs(offset.length() - focus.radius * 2) < 1e-9);
    assert.ok(offset.normalize().distanceTo(scene.keyDirection) < 1e-9);
    // 整顆球都在陰影相機的近、遠平面之間，而且燈在地面以上。
    assert.ok(camera.near <= focus.radius + 1e-9 && camera.near > 0);
    assert.ok(camera.far >= focus.radius * 3 - 1e-9);
    assert.ok(light.position.y > 0);
    assert.equal(light.shadow.needsUpdate, true);
  }
});
