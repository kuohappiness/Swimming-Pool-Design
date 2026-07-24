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
    PlayerController,
    FixedStepLoop,
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

function siteToWorld(x, y, z) {
  return collisionWorld.sitePointToWorld({ x, y, z });
}

function worldYawForSiteDirection(from, to) {
  const start = siteToWorld(from.x, from.y, from.z);
  const end = siteToWorld(to.x, to.y, to.z);
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  return Math.atan2(-deltaX, -deltaZ);
}

const movementIntent = Object.freeze({
  moveX: 0,
  moveZ: -1,
  lookYaw: 0,
  lookPitch: 0,
  ascend: 0,
  descend: 0,
  fast: true,
  exitRequested: false,
});

function runSteps(controller, seconds, framesPerSecond, intent = movementIntent) {
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

function controllerAtSite(x, z, yaw, maximumGround = Number.POSITIVE_INFINITY) {
  const probe = siteToWorld(x, maximumGround, z);
  const ground = collisionWorld.getGroundHeight(probe, maximumGround);
  assert.notEqual(ground, null, `ground is required at SITE ${x},${z}`);
  const movement = new WalkMovement(collisionWorld, safeSpawns, WALKTHROUGH_CONFIG);
  const controller = new PlayerController(WALKTHROUGH_CONFIG, movement);
  controller.setPose({
    x: probe.x,
    y: ground + WALKTHROUGH_CONFIG.player.eyeHeight,
    z: probe.z,
  }, yaw);
  controller.state.grounded = true;
  return { controller, movement };
}

test('collision proxies use the live scene transform and all semantic safe spawns are valid', () => {
  assert.deepEqual(safeSpawns.ids, [
    'entrance',
    'l1-pool-deck',
    'l2-arrival',
    'l3-arrival',
    'l3-terrace',
    'roof-inspection',
  ]);
  for (const id of safeSpawns.ids) {
    const { position } = safeSpawns.get(id);
    assert.equal(collisionWorld.isCapsuleClear(position), true, `${id} capsule must be clear`);
    assert.equal(collisionWorld.isSupported(position), true, `${id} capsule must be supported`);
  }

  const siteReference = { x: 7.25, y: 2.4, z: 11.75 };
  const roundTrip = collisionWorld.worldPointToSite(collisionWorld.sitePointToWorld(siteReference));
  assert.ok(Math.abs(roundTrip.x - siteReference.x) < 1e-9);
  assert.ok(Math.abs(roundTrip.y - siteReference.y) < 1e-9);
  assert.ok(Math.abs(roundTrip.z - siteReference.z) < 1e-9);

  const l3VisualRoot = graph.scene.getObjectByName('L3-PLAN-ROTATION');
  assert.ok(l3VisualRoot, 'visual L3 transform root must exist');
  const visualPivot = l3VisualRoot.localToWorld(new THREE.Vector3(0, 0, 0));
  assert.ok(Math.abs(collisionWorld.getGroundHeight(visualPivot, 7) - 6.88) < 1e-9);
  const roofSpawn = safeSpawns.get('roof-inspection').position;
  assert.ok(collisionWorld.worldPointToSite(roofSpawn).y > 9);
});

test('EN-01 stays passable while solid facade and stair sides resolve a capsule', () => {
  const entrance = siteToWorld(2, WALKTHROUGH_CONFIG.player.eyeHeight, 0);
  assert.equal(collisionWorld.resolveCapsule(entrance).contacts.length, 0);

  const facade = siteToWorld(12, WALKTHROUGH_CONFIG.player.eyeHeight, 0);
  const facadeResolution = collisionWorld.resolveCapsule(facade);
  assert.ok(facadeResolution.contacts.includes('building-y0-right'));
  assert.equal(facadeResolution.unresolved, false);
  const resolvedFacadeSite = collisionWorld.worldPointToSite(facadeResolution.position);
  assert.ok(Math.abs(resolvedFacadeSite.z) >= 0.35);

  const stairSide = siteToWorld(25, 3.2, 1.95);
  const stairResolution = collisionWorld.resolveCapsule(stairSide);
  assert.ok(stairResolution.contacts.includes('ST-01-side-y-max'));
  assert.equal(stairResolution.unresolved, false);
  assert.ok(collisionWorld.worldPointToSite(stairResolution.position).z <= 1.65);
});

test('ST-01 and ST-02 continuous ramps support smooth bidirectional traversal', () => {
  const positiveX = worldYawForSiteDirection(
    { x: 20.5, y: 0.3, z: 1.25 },
    { x: 21.5, y: 0.3, z: 1.25 },
  );
  const st1Up = controllerAtSite(20.55, 1.25, positiveX, 1);
  runSteps(st1Up.controller, 3.25, 60);
  const st1Upper = collisionWorld.worldPointToSite(st1Up.controller.state.position);
  assert.ok(st1Upper.x > 29);
  assert.ok(Math.abs(st1Up.controller.state.position.y - WALKTHROUGH_CONFIG.player.eyeHeight - 3.3) < 0.03);
  assert.equal(st1Up.controller.state.grounded, true);

  const negativeX = positiveX + Math.PI;
  const st1Down = controllerAtSite(28.95, 1.25, negativeX, 4);
  runSteps(st1Down.controller, 3.25, 60);
  const st1Lower = collisionWorld.worldPointToSite(st1Down.controller.state.position);
  assert.ok(st1Lower.x < 20.5);
  assert.ok(Math.abs(st1Down.controller.state.position.y - WALKTHROUGH_CONFIG.player.eyeHeight - 0.3) < 0.03);
  assert.equal(st1Down.controller.state.grounded, true);

  const st2Up = controllerAtSite(32.55, 1.25, positiveX, 4);
  runSteps(st2Up.controller, 2.9, 60);
  const st2Upper = collisionWorld.worldPointToSite(st2Up.controller.state.position);
  assert.ok(
    st2Upper.x > 40.4 && st2Upper.x < 41.1,
    `ST-02 upper SITE x was ${st2Upper.x}`,
  );
  assert.ok(Math.abs(st2Up.controller.state.position.y - WALKTHROUGH_CONFIG.player.eyeHeight - 6.88) < 0.03);
  assert.equal(st2Up.controller.state.grounded, true);
});

test('fixed-step paths agree across render rates and invalid states recover once with zero velocity', () => {
  const positiveX = worldYawForSiteDirection(
    { x: 8, y: 0.3, z: 3 },
    { x: 9, y: 0.3, z: 3 },
  );
  const run = (fps) => {
    const { controller } = controllerAtSite(8, 3, positiveX, 1);
    runSteps(controller, 1, fps, { ...movementIntent, fast: false });
    return controller.state;
  };
  const thirty = run(30);
  const sixty = run(60);
  assert.ok(Math.abs(thirty.position.x - sixty.position.x) < 1e-8);
  assert.ok(Math.abs(thirty.position.z - sixty.position.z) < 1e-8);
  assert.ok(Math.abs(thirty.position.y - sixty.position.y) < 1e-8);

  const { controller, movement } = controllerAtSite(8, 3, positiveX, 1);
  controller.state.position.x = Number.NaN;
  controller.state.velocity = { x: 4, y: -8, z: 2 };
  controller.step({ ...movementIntent, moveZ: 0 }, 1 / 120);
  assert.equal(controller.state.movementMode, 'recovering');
  assert.deepEqual(controller.state.velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(controller.state.position, safeSpawns.get('entrance').position);

  controller.state.position.y = -20;
  controller.state.velocity = { x: 1, y: -1, z: 1 };
  controller.step({ ...movementIntent, moveZ: 0 }, 1 / 120);
  assert.equal(controller.state.movementMode, 'recovering');
  assert.deepEqual(controller.state.velocity, { x: 0, y: 0, z: 0 });
  assert.equal(collisionWorld.isSupported(controller.state.position), true);

  assert.equal(movement.teleportToSpawn(controller.state, 'l3-terrace'), true);
  assert.equal(controller.state.movementMode, 'teleporting');
  assert.deepEqual(controller.state.velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(controller.state.position, safeSpawns.get('l3-terrace').position);
});
