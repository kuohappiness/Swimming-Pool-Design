import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const repoRoot = resolve(import.meta.dirname, '..');
const vite = await createServer({
  root: resolve(repoRoot, 'reference'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const [
  { CameraModeManager },
  { FixedStepLoop },
  { DesktopInput },
  { TouchInput },
  { PlayerController },
  { WALKTHROUGH_CONFIG },
  {
    AdaptiveFrameTimeMonitor,
    adaptRenderQualityProfile,
    getWalkthroughCapabilityProfile,
  },
] = await Promise.all([
  vite.ssrLoadModule('/src/3d-viewer/walkthrough/camera-mode-manager.ts'),
  vite.ssrLoadModule('/src/3d-viewer/walkthrough/fixed-step-loop.ts'),
  vite.ssrLoadModule('/src/3d-viewer/walkthrough/input/desktop-input.ts'),
  vite.ssrLoadModule('/src/3d-viewer/walkthrough/input/touch-input.ts'),
  vite.ssrLoadModule('/src/3d-viewer/walkthrough/player-controller.ts'),
  vite.ssrLoadModule('/src/3d-viewer/walkthrough/walkthrough-config.ts'),
  vite.ssrLoadModule('/src/3d-viewer/walkthrough/performance-profile.ts'),
]);
test.after(async () => vite.close());

class TrackingTarget extends EventTarget {
  adds = new Map();
  removes = new Map();

  addEventListener(type, listener, options) {
    this.adds.set(type, (this.adds.get(type) ?? 0) + 1);
    return super.addEventListener(type, listener, options);
  }

  removeEventListener(type, listener, options) {
    this.removes.set(type, (this.removes.get(type) ?? 0) + 1);
    return super.removeEventListener(type, listener, options);
  }
}

class FakeDocument extends TrackingTarget {
  hidden = false;
  pointerLockElement = null;
}

class FakeCanvas extends TrackingTarget {
  pointerCapture = null;
  pointerLockRequests = 0;

  setPointerCapture(pointerId) {
    this.pointerCapture = pointerId;
  }

  requestPointerLock() {
    this.pointerLockRequests += 1;
    return Promise.reject(new Error('denied for fixture'));
  }
}

function inputEvent(type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(event, key, { configurable: true, value });
  }
  return event;
}

test('CameraModeManager is re-entrant safe and restores the exact inspect snapshot', async () => {
  const states = [];
  const snapshots = [];
  let enters = 0;
  let restores = 0;
  const manager = new CameraModeManager({
    captureInspectState() {
      const snapshot = {
        camera: [34, 25, 30],
        target: [0, 2.4, 0],
        fov: 38,
        scene: 'overview',
        layers: ['site', 'l1', 'water'],
        cutaway: true,
        panelScroll: [120, 260],
        selection: 21,
      };
      snapshots.push(structuredClone(snapshot));
      return snapshot;
    },
    async enterWalkthrough() {
      enters += 1;
    },
    async restoreInspectState(snapshot) {
      restores += 1;
      assert.deepEqual(snapshot, snapshots.at(-1));
    },
    onStateChange(state) {
      states.push(state);
    },
  });

  for (let cycle = 0; cycle < 20; cycle += 1) {
    const firstEnter = manager.enter();
    assert.equal(await manager.enter(), false, 'concurrent enter must be ignored');
    assert.equal(await firstEnter, true);
    assert.equal(manager.state, 'walkthrough');
    assert.equal(await manager.exit(), true);
    assert.equal(await manager.exit(), false, 'duplicate exit must be ignored');
    assert.equal(manager.state, 'inspect');
  }

  assert.equal(enters, 20);
  assert.equal(restores, 20);
  assert.equal(states.filter((state) => state === 'entering').length, 20);
  assert.equal(states.filter((state) => state === 'walkthrough').length, 20);
  assert.equal(states.filter((state) => state === 'exiting').length, 20);
  assert.equal(states.filter((state) => state === 'inspect').length, 20);
  await manager.dispose();
  await manager.dispose();
  assert.equal(await manager.enter(), false);
});

test('desktop and touch adapters normalize equivalent movement and clear transient input', async () => {
  const fakeWindow = new TrackingTarget();
  const fakeDocument = new FakeDocument();
  const canvas = new FakeCanvas();
  const moveSurface = new FakeCanvas();
  const lookSurface = new FakeCanvas();
  const desktop = new DesktopInput({
    canvas,
    window: fakeWindow,
    document: fakeDocument,
    lookSensitivity: 0.01,
  });
  const touch = new TouchInput({
    moveSurface,
    lookSurface,
    window: fakeWindow,
    document: fakeDocument,
    moveRadius: 64,
    lookSensitivity: 0.01,
  });

  for (let cycle = 0; cycle < 20; cycle += 1) {
    desktop.start();
    desktop.start();
    desktop.stop();
    desktop.stop();
    touch.start();
    touch.start();
    touch.stop();
    touch.stop();
  }
  for (const target of [fakeWindow, fakeDocument, canvas, moveSurface, lookSurface]) {
    for (const [eventName, addCount] of target.adds) {
      assert.equal(target.removes.get(eventName), addCount, `${eventName} listeners must balance`);
    }
  }

  desktop.start();
  touch.start();
  fakeWindow.dispatchEvent(inputEvent('keydown', { code: 'KeyW' }));
  fakeWindow.dispatchEvent(inputEvent('keydown', { code: 'KeyD' }));
  moveSurface.dispatchEvent(inputEvent('pointerdown', {
    pointerId: 1, clientX: 100, clientY: 100,
  }));
  moveSurface.dispatchEvent(inputEvent('pointermove', {
    pointerId: 1, clientX: 164, clientY: 36,
  }));
  const desktopIntent = desktop.readIntent();
  const touchIntent = touch.readIntent();
  assert.ok(Math.abs(desktopIntent.moveX - touchIntent.moveX) < 1e-9);
  assert.ok(Math.abs(desktopIntent.moveZ - touchIntent.moveZ) < 1e-9);

  canvas.dispatchEvent(inputEvent('pointerdown', {
    button: 0, pointerId: 9, clientX: 20, clientY: 20,
  }));
  canvas.dispatchEvent(inputEvent('pointermove', {
    pointerId: 9, clientX: 32, clientY: 26,
  }));
  await Promise.resolve();
  const dragLook = desktop.readIntent();
  assert.equal(canvas.pointerLockRequests, 1);
  assert.notEqual(dragLook.lookYaw, 0, 'drag-look must remain available when pointer lock is denied');
  assert.notEqual(dragLook.lookPitch, 0);

  lookSurface.dispatchEvent(inputEvent('pointerdown', {
    pointerId: 2, clientX: 200, clientY: 100,
  }));
  lookSurface.dispatchEvent(inputEvent('pointermove', {
    pointerId: 2, clientX: 216, clientY: 108,
  }));
  assert.notEqual(touch.readIntent().lookYaw, 0);
  lookSurface.dispatchEvent(inputEvent('pointercancel', { pointerId: 2 }));
  moveSurface.dispatchEvent(inputEvent('pointercancel', { pointerId: 1 }));
  assert.deepEqual(touch.readIntent(), {
    moveX: 0,
    moveZ: 0,
    lookYaw: 0,
    lookPitch: 0,
    ascend: 0,
    descend: 0,
    fast: false,
    exitRequested: false,
  });

  fakeWindow.dispatchEvent(inputEvent('keydown', { code: 'KeyW' }));
  fakeWindow.dispatchEvent(new Event('blur'));
  assert.equal(desktop.readIntent().moveZ, 0);
  fakeWindow.dispatchEvent(new Event('orientationchange'));
  assert.equal(touch.readIntent().moveX, 0);
  desktop.dispose();
  touch.dispose();
});

test('fixed-step movement is stable across render deltas and caps delayed frames', () => {
  const strategy = {
    id: 'test-linear',
    step(state, intent, deltaSeconds) {
      state.position.x += intent.moveX * deltaSeconds;
      state.position.z += intent.moveZ * deltaSeconds;
    },
  };
  const run = (renderDelta, frames) => {
    const player = new PlayerController(WALKTHROUGH_CONFIG, strategy);
    const loop = new FixedStepLoop(1 / 120, 0.1, 20);
    for (let frame = 0; frame < frames; frame += 1) {
      loop.advance(renderDelta, (step) => player.step({
        moveX: 0.6,
        moveZ: -0.8,
        lookYaw: 0,
        lookPitch: 0,
        ascend: 0,
        descend: 0,
        fast: false,
        exitRequested: false,
      }, step));
    }
    return player.state.position;
  };

  const sixtyFps = run(1 / 60, 60);
  const thirtyFps = run(1 / 30, 30);
  assert.ok(Math.abs(sixtyFps.x - thirtyFps.x) < 1e-9);
  assert.ok(Math.abs(sixtyFps.z - thirtyFps.z) < 1e-9);
  assert.ok(Math.abs(sixtyFps.x - 0.6) < 1e-9);
  assert.ok(Math.abs(sixtyFps.z + 0.8) < 1e-9);

  const capped = new FixedStepLoop(1 / 120, 0.1, 8);
  let steps = 0;
  const result = capped.advance(2, () => { steps += 1; });
  assert.equal(steps, 8);
  assert.ok(result.droppedTimeSeconds > 1.9);
  assert.ok(result.alpha >= 0 && result.alpha < 1);
});

test('frame-time adaptation only degrades rendering capabilities and preserves simulation inputs', () => {
  const monitor = new AdaptiveFrameTimeMonitor('high', {
    minimumSamples: 10,
    sampleWindow: 20,
    slowFrameRatio: 0.3,
  });
  for (let sample = 0; sample < 20; sample += 1) {
    assert.equal(monitor.observe(16), null);
  }
  assert.equal(monitor.currentTier, 'high');

  let degraded = null;
  for (let sample = 0; sample < 20; sample += 1) {
    degraded = monitor.observe(32) ?? degraded;
  }
  assert.equal(degraded, 'medium');
  assert.equal(monitor.currentTier, 'medium');
  for (let sample = 0; sample < 20; sample += 1) {
    degraded = monitor.observe(40) ?? degraded;
  }
  assert.equal(degraded, 'low');
  assert.equal(monitor.currentTier, 'low');
  for (let sample = 0; sample < 100; sample += 1) monitor.observe(8);
  assert.equal(monitor.currentTier, 'low', 'quality must not oscillate upward in one session');

  const high = {
    id: 'high',
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    textureTier: 'high',
    ambientOcclusion: true,
    enhancedWater: true,
    postProcessing: true,
  };
  const low = adaptRenderQualityProfile(high, 'low');
  assert.deepEqual(low, {
    id: 'low',
    pixelRatioCap: 1,
    shadows: false,
    shadowMapSize: 0,
    textureTier: 'low',
    ambientOcclusion: false,
    enhancedWater: false,
    postProcessing: false,
  });
  assert.deepEqual(getWalkthroughCapabilityProfile('low', false), {
    id: 'low',
    pixelRatioCap: 1,
    shadows: false,
    underwaterEffect: 'essential',
    cameraMotion: false,
  });
});

test('walkthrough UI and selection lifecycle expose stable accessibility hooks', async () => {
  const [html, styles, interactions, main] = await Promise.all([
    readFile(resolve(repoRoot, 'reference/3d-viewer/index.html'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/src/3d-viewer/styles.css'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/src/3d-viewer/interactions.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/src/3d-viewer/main.ts'), 'utf8'),
  ]);
  assert.match(html, /data-enter-walkthrough/);
  assert.match(html, /data-return-safe/);
  assert.match(html, /data-exit-walkthrough/);
  assert.match(html, /data-walkthrough-area-select[^>]+aria-label=/);
  assert.match(html, /data-walkthrough-notice[^>]+aria-live="polite"/);
  assert.match(html, /data-touch-move[^>]+aria-label="左側移動控制"/);
  assert.match(html, /data-touch-look[^>]+aria-label="右側環視控制"/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /data-camera-mode="walkthrough"/);
  assert.match(interactions, /suspend\(\)/);
  assert.match(interactions, /if \(attached \|\| disposed\) return/);
  assert.match(main, /captureInspectState/);
  assert.match(main, /new CollisionWorld/);
  assert.match(main, /new SafeSpawnRegistry/);
  assert.match(main, /new WalkMovement/);
  assert.match(main, /new SafeSpawnAreaRegistry/);
  assert.match(main, /new AdaptiveFrameTimeMonitor/);
  assert.match(main, /recoverToNearest/);
  assert.match(main, /selectionController\.suspend\(\)/);
  assert.match(main, /selectionController\.resume\(\)/);
  assert.match(main, /controls\.stopListenToKeyEvents\(\)/);
});
