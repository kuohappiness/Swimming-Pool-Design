import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebModuleServer } from '../../../../../../support/web-modules.mjs';

const vite = await createWebModuleServer();
test.after(async () => vite.close());
const THREE = await vite.ssrLoadModule('three');
const { ScenePlanarReflection } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/water/planar-reflection.ts',
);

const WATER_LEVEL = 0.22;

/** 只記錄呼叫的假繪圖器：平面倒影不需要真的畫，測的是「什麼時候畫、畫的時候場景是什麼狀態」。 */
function createRenderer() {
  const log = { renders: [], targets: [] };
  let target = null;
  const renderer = {
    log,
    extensions: { has: () => true },
    xr: { enabled: true },
    shadowMap: { autoUpdate: true },
    autoClear: true,
    state: { buffers: { depth: { setMask() {} } } },
    getRenderTarget: () => target,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget(next) {
      target = next;
      log.targets.push(next);
    },
    clear() {},
    render(scene, camera) {
      log.renders.push({
        target,
        camera,
        position: camera.position.clone(),
        xr: renderer.xr.enabled,
        shadowAutoUpdate: renderer.shadowMap.autoUpdate,
        hiddenVisible: scene.userData.watch.map((object) => object.visible),
      });
    },
  };
  return renderer;
}

function createFixture() {
  const scene = new THREE.Scene();
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  const basinMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  scene.add(surface, basinMesh);
  scene.userData.watch = [surface, basinMesh];
  scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
  camera.position.set(4, 1.8, 6);
  camera.lookAt(12, WATER_LEVEL, 8);
  camera.updateMatrixWorld(true);
  const renderer = createRenderer();
  const input = {
    renderer,
    scene,
    camera,
    surface,
    waterLevel: WATER_LEVEL,
    hidden: [surface, basinMesh],
  };
  return { scene, surface, basinMesh, camera, renderer, input };
}

test('the scene is drawn once from the mirrored camera, with the water hidden and renderer state put back', () => {
  const { camera, renderer, input, surface, basinMesh } = createFixture();
  const planar = new ScenePlanarReflection(renderer, 320, 200);
  assert.equal(planar.texture.name, 'realistic:water-planar-reflection');

  assert.equal(planar.update(input), true);
  assert.equal(renderer.log.renders.length, 1);
  const [pass] = renderer.log.renders;
  assert.notEqual(pass.target, null, 'the reflection is drawn into its own texture');
  assert.deepEqual(pass.hiddenVisible, [false, false]);
  assert.equal(pass.xr, false);
  assert.equal(pass.shadowAutoUpdate, false, 'the shadow map is shared with the main view');
  // 倒影鏡頭是主鏡頭對水面的鏡射：水平位置相同，高度翻到水面下方。
  assert.ok(Math.abs(pass.position.x - camera.position.x) < 1e-9);
  assert.ok(Math.abs(pass.position.z - camera.position.z) < 1e-9);
  assert.ok(Math.abs(pass.position.y - (2 * WATER_LEVEL - camera.position.y)) < 1e-9);

  assert.equal(surface.visible, true);
  assert.equal(basinMesh.visible, true);
  assert.equal(renderer.xr.enabled, true);
  assert.equal(renderer.shadowMap.autoUpdate, true);
  assert.equal(renderer.getRenderTarget(), null);
  planar.dispose();
});

test('a point on the water maps to where the main camera sees it; ripples move it within the picture', () => {
  const { camera, input } = createFixture();
  const planar = new ScenePlanarReflection(input.renderer, 320, 200);
  planar.update(input);

  // 平坦水面上，倒影畫面裡「水面某一點」的位置，就是主鏡頭看那一點的畫面位置。
  const point = new THREE.Vector3(12, WATER_LEVEL, 8);
  const projected = new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(
    planar.textureMatrix,
  );
  const expected = point.clone().project(camera);
  assert.ok(Math.abs(projected.x / projected.w - (expected.x * 0.5 + 0.5)) < 1e-6);
  assert.ok(Math.abs(projected.y / projected.w - (expected.y * 0.5 + 0.5)) < 1e-6);

  // 沿著鏡射後的視線往上走到的任何一點（倒影裡真正被照到的東西）也落在同一個位置。
  const view = point.clone().sub(camera.position).normalize();
  const reflected = new THREE.Vector3(view.x, -view.y, view.z);
  const along = point.clone().addScaledVector(reflected, 5);
  const alongProjected = new THREE.Vector4(along.x, along.y, along.z, 1).applyMatrix4(
    planar.textureMatrix,
  );
  assert.ok(Math.abs(alongProjected.x / alongProjected.w - projected.x / projected.w) < 1e-6);
  assert.ok(Math.abs(alongProjected.y / alongProjected.w - projected.y / projected.w) < 1e-6);
  planar.dispose();
});

test('a still camera costs nothing; moving it, resizing or invalidating draws again', () => {
  const { camera, renderer, input } = createFixture();
  const planar = new ScenePlanarReflection(renderer, 320, 200);
  planar.update(input);
  planar.update(input);
  planar.update(input);
  assert.equal(renderer.log.renders.length, 1);

  camera.position.x += 0.5;
  camera.updateMatrixWorld(true);
  planar.update(input);
  assert.equal(renderer.log.renders.length, 2);

  planar.setSize(320, 200);
  planar.update(input);
  assert.equal(renderer.log.renders.length, 2, 'same size is not a change');
  planar.setSize(160, 100);
  planar.update(input);
  assert.equal(renderer.log.renders.length, 3);
  assert.equal(renderer.log.renders.at(-1).target.width, 160);

  planar.invalidate();
  planar.update(input);
  assert.equal(renderer.log.renders.length, 4);

  camera.fov = 35;
  camera.updateProjectionMatrix();
  planar.update(input);
  assert.equal(renderer.log.renders.length, 5);
  planar.dispose();
});

test('no reflection is drawn from under the water, and nothing after dispose', () => {
  const { camera, renderer, input } = createFixture();
  const planar = new ScenePlanarReflection(renderer, 320, 200);
  camera.position.y = WATER_LEVEL - 0.4;
  camera.updateMatrixWorld(true);
  assert.equal(planar.update(input), false);
  assert.equal(renderer.log.renders.length, 0);

  camera.position.y = 1.2;
  camera.updateMatrixWorld(true);
  assert.equal(planar.update(input), true);
  planar.dispose();
  camera.position.x += 1;
  camera.updateMatrixWorld(true);
  assert.equal(planar.update(input), false);
  assert.equal(renderer.log.renders.length, 1);
});
