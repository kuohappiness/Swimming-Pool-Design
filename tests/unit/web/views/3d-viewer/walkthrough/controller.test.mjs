import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../../../../../..');
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const [
  { CameraModeManager },
  { FixedStepLoop },
  { DesktopInput, keyBelongsToControl },
  { TouchInput },
  { PlayerController, advancePlayerFrame },
  { WALKTHROUGH_CONFIG },
  { adaptRenderQualityProfile, getWalkthroughCapabilityProfile },
] = await Promise.all([
  vite.ssrLoadModule('/src/views/3d-viewer/walkthrough/camera-mode-manager.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/walkthrough/fixed-step-loop.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/walkthrough/input/desktop-input.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/walkthrough/input/touch-input.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/walkthrough/player-controller.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/walkthrough/walkthrough-config.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/walkthrough/performance-profile.ts'),
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
  moveSurface.dispatchEvent(
    inputEvent('pointerdown', {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    }),
  );
  moveSurface.dispatchEvent(
    inputEvent('pointermove', {
      pointerId: 1,
      clientX: 164,
      clientY: 36,
    }),
  );
  const desktopIntent = desktop.readIntent();
  const touchIntent = touch.readIntent();
  assert.ok(Math.abs(desktopIntent.moveX - touchIntent.moveX) < 1e-9);
  assert.ok(Math.abs(desktopIntent.moveZ - touchIntent.moveZ) < 1e-9);

  canvas.dispatchEvent(
    inputEvent('pointerdown', {
      button: 0,
      pointerId: 9,
      clientX: 20,
      clientY: 20,
    }),
  );
  canvas.dispatchEvent(
    inputEvent('pointermove', {
      pointerId: 9,
      clientX: 32,
      clientY: 26,
    }),
  );
  await Promise.resolve();
  const dragLook = desktop.readIntent();
  assert.equal(canvas.pointerLockRequests, 1);
  assert.notEqual(
    dragLook.lookYaw,
    0,
    'drag-look must remain available when pointer lock is denied',
  );
  assert.notEqual(dragLook.lookPitch, 0);

  lookSurface.dispatchEvent(
    inputEvent('pointerdown', {
      pointerId: 2,
      clientX: 200,
      clientY: 100,
    }),
  );
  lookSurface.dispatchEvent(
    inputEvent('pointermove', {
      pointerId: 2,
      clientX: 216,
      clientY: 108,
    }),
  );
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
      loop.advance(renderDelta, (step) =>
        player.step(
          {
            moveX: 0.6,
            moveZ: -0.8,
            lookYaw: 0,
            lookPitch: 0,
            ascend: 0,
            descend: 0,
            fast: false,
            exitRequested: false,
          },
          step,
        ),
      );
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
  const result = capped.advance(2, () => {
    steps += 1;
  });
  assert.equal(steps, 8);
  assert.ok(result.droppedTimeSeconds > 1.9);
  assert.ok(result.alpha >= 0 && result.alpha < 1);
});

const idleIntent = Object.freeze({
  moveX: 0,
  moveZ: 0,
  lookYaw: 0,
  lookPitch: 0,
  ascend: 0,
  descend: 0,
  fast: false,
  exitRequested: false,
});

test('view turns every rendered frame, including frames that run no physics step', () => {
  // A 240 Hz display renders twice per 1/120 s physics step, so half of its
  // frames advance zero steps. Mouse movement on those frames must still count.
  const player = new PlayerController(WALKTHROUGH_CONFIG);
  const loop = new FixedStepLoop(1 / 120, 0.1, 8);
  let framesWithoutStep = 0;
  for (let frame = 0; frame < 240; frame += 1) {
    const result = advancePlayerFrame(
      player,
      loop,
      { ...idleIntent, lookYaw: 0.001, lookPitch: 0.0005 },
      1 / 240,
    );
    if (result.steps === 0) framesWithoutStep += 1;
  }
  assert.ok(framesWithoutStep > 0, 'the scenario must include frames with no physics step');
  assert.ok(Math.abs(player.state.yaw - 0.24) < 1e-9);
  assert.ok(Math.abs(player.state.pitch - 0.12) < 1e-9);

  const limit = (WALKTHROUGH_CONFIG.player.maxPitchDegrees * Math.PI) / 180;
  player.look(0, 10);
  assert.equal(player.state.pitch, limit);
  player.look(Number.NaN, Number.POSITIVE_INFINITY);
  assert.ok(Math.abs(player.state.yaw - 0.24) < 1e-9);
  assert.equal(player.state.pitch, limit);
});

test('walkthrough keys leave browser shortcuts and focused controls alone', () => {
  const fakeWindow = new TrackingTarget();
  const desktop = new DesktopInput({
    canvas: new FakeCanvas(),
    window: fakeWindow,
    document: new FakeDocument(),
  });
  desktop.start();

  // Ctrl+W closes the tab and Ctrl+S / Ctrl+D open dialogs, so Ctrl is not a dive key.
  for (const code of ['ControlLeft', 'ControlRight']) {
    fakeWindow.dispatchEvent(inputEvent('keydown', { code, ctrlKey: true }));
  }
  assert.equal(desktop.readIntent().descend, 0);
  for (const [code, modifier] of [
    ['KeyW', 'ctrlKey'],
    ['KeyS', 'metaKey'],
    ['KeyD', 'altKey'],
  ]) {
    const shortcut = inputEvent('keydown', { code, [modifier]: true });
    fakeWindow.dispatchEvent(shortcut);
    assert.equal(shortcut.defaultPrevented, false, `${modifier}+${code} must reach the browser`);
  }
  assert.deepEqual(desktop.readIntent(), idleIntent);
  const dive = inputEvent('keydown', { code: 'KeyC' });
  fakeWindow.dispatchEvent(dive);
  assert.equal(dive.defaultPrevented, true);
  assert.equal(desktop.readIntent().descend, 1);
  fakeWindow.dispatchEvent(inputEvent('keyup', { code: 'KeyC' }));

  // A focused area picker keeps its arrow keys; a focused exit button keeps Space.
  const focused = (matches) => ({ closest: (selector) => (matches(selector) ? {} : null) });
  const select = focused((selector) => selector.startsWith('input, select'));
  const button = focused((selector) => selector.startsWith('button'));
  const arrowOnSelect = inputEvent('keydown', { code: 'ArrowDown', target: select });
  fakeWindow.dispatchEvent(arrowOnSelect);
  assert.equal(arrowOnSelect.defaultPrevented, false);
  const spaceOnButton = inputEvent('keydown', { code: 'Space', target: button });
  fakeWindow.dispatchEvent(spaceOnButton);
  assert.equal(spaceOnButton.defaultPrevented, false);
  assert.deepEqual(desktop.readIntent(), idleIntent);
  const walkWithButtonFocused = inputEvent('keydown', { code: 'KeyW', target: button });
  fakeWindow.dispatchEvent(walkWithButtonFocused);
  assert.equal(walkWithButtonFocused.defaultPrevented, true);
  assert.equal(desktop.readIntent().moveZ, -1);

  assert.equal(keyBelongsToControl({ code: 'Space', target: null }), false);
  assert.equal(keyBelongsToControl({ code: 'Enter', target: button }), true);
  assert.equal(keyBelongsToControl({ code: 'KeyW', target: select }), true);
  desktop.dispose();
});

// 幀時間的觀測與降級改由 rendering/performance 的 FrameGovernor 負責（DEC-190），
// 測試在 rendering/performance/frame-governor.test.mjs；這裡只留畫質設定的換算。
test('lowering the pipeline profile only changes rendering capabilities', () => {
  const high = {
    id: 'high',
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    textureTier: 'high',
    ambientOcclusion: true,
    enhancedWater: true,
    postProcessing: true,
    bloom: true,
    exposureAdaptation: true,
  };
  const low = adaptRenderQualityProfile(high, 'low');
  // Every frame effect goes with the post-processing it needs.
  assert.deepEqual(low, {
    id: 'low',
    pixelRatioCap: 1,
    shadows: false,
    shadowMapSize: 0,
    textureTier: 'low',
    ambientOcclusion: false,
    enhancedWater: false,
    postProcessing: false,
    bloom: false,
    exposureAdaptation: false,
  });
  assert.deepEqual(adaptRenderQualityProfile(high, 'high'), high);
  assert.deepEqual(getWalkthroughCapabilityProfile('low', false), {
    id: 'low',
    pixelRatioCap: 1,
    shadows: false,
    underwaterEffect: 'essential',
    cameraMotion: false,
  });
});

test('walkthrough UI and selection lifecycle expose stable accessibility hooks', async () => {
  const [view, html, styles, interactions, main] = await Promise.all([
    readFile(resolve(repoRoot, 'web/src/views/3d-viewer/index.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'web/src/views/3d-viewer/template.html'), 'utf8'),
    readFile(resolve(repoRoot, 'web/src/views/3d-viewer/styles.css'), 'utf8'),
    readFile(resolve(repoRoot, 'web/src/views/3d-viewer/interactions.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'web/src/views/3d-viewer/main.ts'), 'utf8'),
  ]);
  assert.match(view, /data-enter-walkthrough/);
  assert.match(view, />實境漫遊</);
  assert.match(html, /data-return-safe/);
  assert.match(html, /data-exit-walkthrough/);
  assert.match(html, /data-walkthrough-area-select[^>]+aria-label=/);
  assert.match(html, /data-walkthrough-notice[^>]+aria-live="polite"/);
  assert.match(html, /data-touch-move[^>]+aria-label="左側移動控制"/);
  assert.match(html, /data-touch-look[^>]+aria-label="右側環視控制"/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /data-camera-mode=['"]walkthrough['"]/);
  assert.match(interactions, /suspend\(\)/);
  assert.match(interactions, /if \(attached \|\| disposed\) return/);
  assert.match(main, /captureInspectState/);
  assert.match(main, /new CollisionWorld/);
  assert.match(main, /new SafeSpawnRegistry/);
  assert.match(main, /new WalkMovement/);
  assert.match(main, /new SafeSpawnAreaRegistry/);
  // 畫質的自動調整改由 QualitySession 與 FrameGovernor 負責（DEC-190）。
  assert.match(main, /new QualitySession/);
  assert.match(main, /qualitySession\.observe\(frameStatistics\.snapshot\(\)\)/);
  assert.match(main, /recoverToNearest/);
  assert.match(main, /selectionController\.suspend\(\)/);
  assert.match(main, /selectionController\.resume\(\)/);
  assert.match(main, /controls\.stopListenToKeyEvents\(\)/);
});
