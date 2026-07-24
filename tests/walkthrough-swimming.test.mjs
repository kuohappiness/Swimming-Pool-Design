import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
import { buildViewerModel } from '../scripts/viewer-data.mjs';
import { adaptWalkthroughSource } from '../reference/src/3d-viewer/walkthrough/adapters/viewer-model-adapter.ts';
import { WALKTHROUGH_CONFIG } from '../reference/src/3d-viewer/walkthrough/walkthrough-config.ts';

const repoRoot = resolve(import.meta.dirname, '..');
const [projectModel, analysisRegistry] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
]);
const viewerModel = buildViewerModel(projectModel, analysisRegistry);
const walkthroughSource = adaptWalkthroughSource(viewerModel);
const vite = await createServer({
  root: resolve(repoRoot, 'reference'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const [
  { createViewerScene },
  { createBaselineSceneRenderingDependencies },
  {
    CollisionWorld,
    SafeSpawnRegistry,
    WalkMovement,
    SwimMovement,
    PlayerController,
    FixedStepLoop,
    WaterVolume,
    UnderwaterEffects,
    TouchInput,
    SafeSpawnAreaRegistry,
  },
] = await Promise.all([
  vite.ssrLoadModule('/src/3d-viewer/scene-factory.ts'),
  vite.ssrLoadModule('/src/3d-viewer/rendering/index.ts'),
  vite.ssrLoadModule('/src/3d-viewer/walkthrough/index.ts'),
]);
test.after(async () => vite.close());

const rendering = createBaselineSceneRenderingDependencies();
const graph = createViewerScene(viewerModel, rendering);
graph.scene.updateMatrixWorld(true);
const collisionWorld = new CollisionWorld(
  walkthroughSource,
  graph.siteRoot.matrixWorld,
  WALKTHROUGH_CONFIG,
);
const safeSpawns = new SafeSpawnRegistry(
  walkthroughSource,
  collisionWorld,
  WALKTHROUGH_CONFIG,
);
const water = new WaterVolume(
  walkthroughSource.waterVolumes[0],
  walkthroughSource.poolShells[0],
  graph.siteRoot.matrixWorld,
);

const stationaryIntent = Object.freeze({
  moveX: 0,
  moveZ: 0,
  lookYaw: 0,
  lookPitch: 0,
  ascend: 0,
  descend: 0,
  fast: false,
  exitRequested: false,
});

function siteToWorld(x, y, z) {
  return collisionWorld.sitePointToWorld({ x, y, z });
}

function worldYawForSiteDirection(from, to) {
  const start = siteToWorld(from.x, from.y, from.z);
  const end = siteToWorld(to.x, to.y, to.z);
  return Math.atan2(-(end.x - start.x), -(end.z - start.z));
}

function createSwimmingController(siteX, siteElevation, siteZ, movementMode = 'swimming-underwater') {
  const walking = new WalkMovement(collisionWorld, safeSpawns, WALKTHROUGH_CONFIG);
  const swimming = new SwimMovement(
    walking,
    collisionWorld,
    water,
    safeSpawns,
    WALKTHROUGH_CONFIG,
  );
  const controller = new PlayerController(WALKTHROUGH_CONFIG, swimming);
  controller.setPose(siteToWorld(siteX, siteElevation, siteZ));
  controller.state.movementMode = movementMode;
  return { controller, swimming };
}

function runSteps(controller, seconds, framesPerSecond, intent = stationaryIntent) {
  const frameDelta = 1 / framesPerSecond;
  const loop = new FixedStepLoop(
    WALKTHROUGH_CONFIG.physics.fixedStepSeconds,
    WALKTHROUGH_CONFIG.physics.maxFrameDeltaSeconds,
    WALKTHROUGH_CONFIG.physics.maxSubsteps,
  );
  for (let frame = 0; frame < seconds * framesPerSecond; frame += 1) {
    loop.advance(frameDelta, (step) => controller.step(intent, step));
  }
}

test('rendered water, simulation waterline, sloped bottom, and collision support share one source', () => {
  assert.equal(walkthroughSource.waterVolumes[0].surfaceElevation, 0.22);
  assert.equal(water.surfaceWorldElevation, graph.water.surfaceElevation);
  assert.equal(graph.water.shallowBottomElevation, -0.98);
  assert.equal(graph.water.deepBottomElevation, -1.28);

  const shallow = siteToWorld(3, 0, 8);
  const deep = siteToWorld(28, 0, 8);
  assert.ok(Math.abs(water.bottomWorldElevation(shallow) - (-0.98)) < 1e-9);
  assert.ok(Math.abs(water.bottomWorldElevation(deep) - (-1.28)) < 1e-9);
  assert.ok(Math.abs(collisionWorld.getGroundHeight(shallow, 0) - (-0.98)) < 1e-9);
  assert.ok(Math.abs(collisionWorld.getGroundHeight(deep, 0) - (-1.28)) < 1e-9);
});

test('waterline hysteresis avoids surface jitter and supports deliberate dive and ascent', () => {
  const { controller } = createSwimmingController(12, 0.34, 8, 'swimming-surface');
  runSteps(controller, 2, 60);
  assert.equal(controller.state.movementMode, 'swimming-surface');
  assert.ok(Math.abs(controller.state.position.y - 0.34) < 0.015);

  runSteps(controller, 0.5, 60, { ...stationaryIntent, descend: 1 });
  assert.equal(controller.state.movementMode, 'swimming-underwater');
  assert.ok(controller.state.position.y < water.surfaceWorldElevation);

  runSteps(controller, 1.2, 60, { ...stationaryIntent, ascend: 1 });
  assert.equal(controller.state.movementMode, 'swimming-surface');
  assert.ok(Math.abs(controller.state.position.y - 0.34) < 1e-9);
});

test('underwater movement is fixed-step stable and clamps pool walls and sloped bottom', () => {
  const positiveX = worldYawForSiteDirection(
    { x: 20, y: 0, z: 8 },
    { x: 21, y: 0, z: 8 },
  );
  const swimForward = { ...stationaryIntent, moveZ: -1 };
  const run = (fps) => {
    const { controller } = createSwimmingController(20, -0.3, 8);
    controller.state.yaw = positiveX;
    runSteps(controller, 1, fps, swimForward);
    return collisionWorld.worldPointToSite(controller.state.position);
  };
  const thirty = run(30);
  const sixty = run(60);
  assert.ok(Math.abs(thirty.x - sixty.x) < 1e-8);
  assert.ok(Math.abs(thirty.z - sixty.z) < 1e-8);
  assert.ok(Math.abs(thirty.y - sixty.y) < 1e-8);

  const { controller: wallController } = createSwimmingController(27.2, -0.3, 8);
  wallController.state.yaw = positiveX;
  runSteps(wallController, 3, 60, swimForward);
  const wallSite = collisionWorld.worldPointToSite(wallController.state.position);
  assert.ok(wallSite.x <= 27.641, `capsule crossed deep-end wall at SITE x=${wallSite.x}`);

  const { controller: bottomController } = createSwimmingController(27, -0.4, 8);
  runSteps(bottomController, 4, 60, { ...stationaryIntent, descend: 1 });
  const expectedBottomEye = water.bottomWorldElevation(bottomController.state.position) + 0.42;
  assert.ok(Math.abs(bottomController.state.position.y - expectedBottomEye) < 1e-9);
  assert.equal(bottomController.state.movementMode, 'swimming-underwater');
});

test('assisted climb and poolside recovery return to clear supported deck positions', () => {
  const { controller, swimming } = createSwimmingController(3.35, 0.1, 8);
  controller.step({ ...stationaryIntent, ascend: 1 }, 1 / 120);
  assert.equal(controller.state.movementMode, 'walking');
  assert.equal(controller.state.grounded, true);
  assert.equal(collisionWorld.isCapsuleClear(controller.state.position), true);
  assert.equal(collisionWorld.isSupported(controller.state.position), true);

  controller.state.position = siteToWorld(15, -0.25, 8);
  controller.state.velocity = { x: 2, y: -3, z: 4 };
  controller.state.movementMode = 'swimming-underwater';
  assert.equal(swimming.returnToPoolside(controller.state), true);
  assert.deepEqual(controller.state.position, safeSpawns.get('l1-pool-deck').position);
  assert.deepEqual(controller.state.velocity, { x: 0, y: 0, z: 0 });
  assert.equal(controller.state.movementMode, 'teleporting');
});

test('semantic area registry jumps only through validated safe spawns', () => {
  const areas = new SafeSpawnAreaRegistry(safeSpawns);
  assert.deepEqual(areas.areas.map(({ id }) => id), safeSpawns.ids);
  const { controller } = createSwimmingController(15, -0.25, 8);
  for (const area of areas.areas) {
    const activated = areas.activate(controller.state, area.id);
    assert.equal(activated, area);
    assert.deepEqual(controller.state.position, safeSpawns.get(area.id).position);
    assert.deepEqual(controller.state.velocity, { x: 0, y: 0, z: 0 });
    assert.equal(controller.state.movementMode, 'teleporting');
    assert.equal(collisionWorld.isCapsuleClear(controller.state.position), true);
    assert.equal(collisionWorld.isSupported(controller.state.position), true);
    assert.equal(areas.nearest(controller.state.position).id, area.id);
  }
});

test('underwater effects degrade safely and touch swim buttons remain active while held', async () => {
  const shell = { dataset: {} };
  const originalFog = new THREE.Fog(0xeeeeee, 1, 10);
  const scene = new THREE.Scene();
  scene.fog = originalFog;
  let audioCalls = 0;
  const effects = new UnderwaterEffects(shell, scene, {
    quality: 'low',
    reducedMotion: true,
    audio: {
      setUnderwater() {
        audioCalls += 1;
        throw new Error('device unavailable');
      },
    },
  });
  effects.update('swimming-underwater');
  assert.ok(scene.fog instanceof THREE.FogExp2);
  assert.equal(shell.dataset.underwaterQuality, 'low');
  assert.equal(shell.dataset.underwaterReducedMotion, 'true');
  assert.equal(shell.dataset.waterMode, 'swimming-underwater');
  effects.update('walking');
  assert.equal(scene.fog, originalFog);
  assert.equal(audioCalls, 2);
  effects.dispose();
  assert.equal('underwater' in shell.dataset, false);

  class TestTarget extends EventTarget {
    setPointerCapture() {}
  }
  const moveSurface = new TestTarget();
  const lookSurface = new TestTarget();
  const ascendButton = new TestTarget();
  const descendButton = new TestTarget();
  const windowTarget = new TestTarget();
  const documentTarget = new TestTarget();
  documentTarget.hidden = false;
  const touch = new TouchInput({
    moveSurface,
    lookSurface,
    ascendButton,
    descendButton,
    window: windowTarget,
    document: documentTarget,
  });
  touch.start();
  ascendButton.dispatchEvent(new Event('pointerdown', { cancelable: true }));
  assert.equal(touch.readIntent().ascend, 1);
  assert.equal(touch.readIntent().ascend, 1);
  ascendButton.dispatchEvent(new Event('pointerup', { cancelable: true }));
  assert.equal(touch.readIntent().ascend, 0);
  descendButton.dispatchEvent(new Event('pointerdown', { cancelable: true }));
  assert.equal(touch.readIntent().descend, 1);
  windowTarget.dispatchEvent(new Event('blur'));
  assert.equal(touch.readIntent().descend, 0);
  touch.dispose();
});
