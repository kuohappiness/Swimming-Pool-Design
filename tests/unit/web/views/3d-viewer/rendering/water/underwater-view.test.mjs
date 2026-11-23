import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createWebModuleServer } from '../../../../../../support/web-modules.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createWebModuleServer();
test.after(async () => vite.close());
const THREE = await vite.ssrLoadModule('three');
const { cameraTouchesWater, MAXIMUM_SHAFT_STEPS, ScreenUnderwaterView } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/water/underwater-view.ts',
);
const { WaterSurface } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/water/water-surface.ts',
);
const { POOL_BASIN_UNIFORM_NAMES } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/water/pool-basin-material.ts',
);
const { createUnderwaterMotesGeometry, UnderwaterMotes, UNDERWATER_MOTES_NAME } =
  await vite.ssrLoadModule('/src/views/3d-viewer/rendering/water/underwater-motes.ts');

const basin = Object.freeze({
  minX: 3,
  maxX: 28,
  minZ: 4,
  maxZ: 12.5,
  waterLevel: 0.22,
  shallowBottom: -0.98,
  deepBottom: -1.28,
  laneLineZ: [6.5, 9],
  laneLineWidth: 0.16,
  laneLineInset: 0.35,
});

function createSurface() {
  return new WaterSurface({
    basin,
    rippleNormal: new THREE.Texture(),
    caustics: new THREE.Texture(),
    reflectionCube: new THREE.CubeTexture(),
    cellSize: 1,
  });
}

function cameraAt(x, y, z, lookAt = [x + 5, y, z]) {
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 100);
  camera.position.set(x, y, z);
  camera.lookAt(...lookAt);
  camera.updateMatrixWorld(true);
  return camera;
}

function createRenderer() {
  const log = { renders: [], targets: [] };
  let target = null;
  return {
    log,
    extensions: { has: () => true },
    getDrawingBufferSize: (size) => size.set(800, 500),
    getRenderTarget: () => target,
    setRenderTarget(next) {
      target = next;
      log.targets.push(next);
    },
    clear() {},
    render(scene, camera) {
      log.renders.push({ scene, camera, target });
    },
  };
}

test('the camera touches the water only inside the pool and below the surface', () => {
  const identity = new THREE.Matrix4();
  assert.equal(
    cameraTouchesWater(cameraAt(10, 1.6, 8), identity, basin, 0.014),
    false,
    'standing on the deck',
  );
  assert.equal(
    cameraTouchesWater(cameraAt(10, -0.5, 8), identity, basin, 0.014),
    true,
    'under water',
  );
  assert.equal(
    cameraTouchesWater(cameraAt(1, -0.5, 8), identity, basin, 0.014),
    false,
    'below deck level but outside the pool',
  );
  assert.equal(cameraTouchesWater(cameraAt(10, -0.5, 20), identity, basin, 0.014), false);
  // 眼睛在水面上 3 公分，但往下看時近裁面的下緣已經在水裡。
  assert.equal(
    cameraTouchesWater(cameraAt(10, 0.25, 8, [12, -1, 8]), identity, basin, 0.014),
    true,
  );
  // 近裁面最低的一角仍高於水面：不算碰到水。
  assert.equal(cameraTouchesWater(cameraAt(10, 0.3, 8), identity, basin, 0), false);
});

test('above the water the pass does nothing; under water it draws the scene to a texture and then the screen', () => {
  const surface = createSurface();
  const scene = new THREE.Scene();
  scene.add(surface.mesh);
  scene.updateMatrixWorld(true);
  const extra = new THREE.Object3D();
  const view = new ScreenUnderwaterView({
    basin,
    waterUniforms: surface.material.uniforms,
    surface: surface.mesh,
    maximumWaveHeight: surface.maximumWaveHeight,
    underwaterOnly: [extra],
  });
  assert.equal(extra.visible, false, 'underwater-only objects start hidden');
  const renderer = createRenderer();

  assert.equal(view.render(renderer, scene, cameraAt(10, 1.6, 8)), false);
  assert.equal(renderer.log.renders.length, 0);
  assert.equal(renderer.log.targets.length, 0);

  const camera = cameraAt(10, -0.5, 8);
  let visibleDuringScenePass = null;
  const render = renderer.render;
  renderer.render = (passScene, passCamera) => {
    if (passScene === scene) visibleDuringScenePass = extra.visible;
    render(passScene, passCamera);
  };
  assert.equal(view.render(renderer, scene, camera), true);
  assert.equal(renderer.log.renders.length, 2);
  const [scenePass, screenPass] = renderer.log.renders;
  assert.equal(scenePass.scene, scene);
  assert.equal(scenePass.camera, camera);
  assert.equal(scenePass.target.width, 800);
  assert.equal(scenePass.target.height, 500);
  assert.ok(
    scenePass.target.depthTexture,
    'distance through the water comes from the depth buffer',
  );
  assert.equal(screenPass.target, null);
  assert.equal(visibleDuringScenePass, true);
  assert.equal(extra.visible, false);

  const quad = screenPass.scene.children[0];
  assert.equal(quad.material.name, 'realistic:underwater-view');
  assert.equal(quad.material.uniforms.tScene.value, scenePass.target.texture);
  assert.equal(quad.material.uniforms.tDepth.value, scenePass.target.depthTexture);
  for (const name of [...POOL_BASIN_UNIFORM_NAMES, 'uWaves']) {
    assert.equal(
      quad.material.uniforms[name],
      surface.material.uniforms[name],
      `${name} is shared with the water`,
    );
  }
  // 鏡頭座標的原點（眼睛）轉到池體座標要回到鏡頭的位置。
  const eye = new THREE.Vector3().applyMatrix4(quad.material.uniforms.uViewToBasin.value);
  assert.ok(eye.distanceTo(camera.position) < 1e-9);

  view.setShaftSteps(8);
  assert.equal(quad.material.uniforms.uShaftSteps.value, 8);
  assert.throws(() => view.setShaftSteps(MAXIMUM_SHAFT_STEPS + 1), /shaft steps/);
  assert.throws(() => view.setShaftSteps(2.5), /shaft steps/);

  // With post-processing on, the frame pipeline draws the whole frame into its own scene
  // texture; the underwater view has to draw back into that texture, not to the screen.
  const frame = new THREE.WebGLRenderTarget(800, 500);
  renderer.setRenderTarget(frame);
  renderer.log.renders.length = 0;
  assert.equal(view.render(renderer, scene, camera), true);
  assert.equal(renderer.log.renders[0].target, scenePass.target);
  assert.equal(renderer.log.renders[1].target, frame);
  frame.dispose();

  view.dispose();
  assert.equal(view.render(renderer, scene, camera), false);
  surface.dispose();
});

test('the underwater shader takes absorption, caustics and waves from the shared water code', async () => {
  const source = await readFile(
    resolve(repoRoot, 'web/src/views/3d-viewer/rendering/water/shaders/underwater-view.frag.glsl'),
    'utf8',
  );
  assert.match(source, /\/\/ #include pool-basin/);
  assert.match(source, /applyWaterColumn\(color, distanceToScene\)/);
  assert.match(source, /#include <tonemapping_fragment>\s+#include <colorspace_fragment>/);
  assert.match(source, new RegExp(`MAXIMUM_SHAFT_STEPS = ${MAXIMUM_SHAFT_STEPS};`));
});

test('motes are reproducible, hidden by default and never picked', () => {
  const first = createUnderwaterMotesGeometry(50);
  const second = createUnderwaterMotesGeometry(50);
  assert.deepEqual(
    [...first.getAttribute('position').array],
    [...second.getAttribute('position').array],
  );
  assert.equal(first.getAttribute('position').count, 50);
  assert.ok([...first.getAttribute('position').array].every((value) => value >= 0 && value < 1));
  assert.throws(() => createUnderwaterMotesGeometry(-1), /non-negative integer/);

  const surface = createSurface();
  const motes = new UnderwaterMotes(surface.material.uniforms, surface.mesh, 50);
  assert.equal(motes.points.name, UNDERWATER_MOTES_NAME);
  assert.equal(motes.points.parent, surface.mesh);
  assert.equal(motes.points.visible, false);
  assert.equal(motes.points.material.uniforms.uTime, surface.material.uniforms.uTime);
  const hits = [];
  motes.points.raycast(new THREE.Raycaster(), hits);
  assert.equal(hits.length, 0);

  const geometry = motes.points.geometry;
  motes.setCount(50);
  assert.equal(motes.points.geometry, geometry);
  motes.setCount(20);
  assert.equal(motes.points.geometry.getAttribute('position').count, 20);
  motes.dispose();
  assert.equal(motes.points.parent, null);
  surface.dispose();
  first.dispose();
  second.dispose();
});
