import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';

const repoRoot = resolve(import.meta.dirname, '..');
const vite = await createServer({
  root: resolve(repoRoot, 'reference'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const {
  EnhancedEnvironmentEffect,
  EnhancedFrameEffectPipeline,
  ENHANCED_QUALITY_PROFILES,
  TONE_MAPPING_PROFILES,
  getToneMappingProfile,
} = await vite.ssrLoadModule('/src/3d-viewer/rendering/enhanced/index.ts');
test.after(async () => vite.close());

function environmentTarget() {
  return {
    scene: new THREE.Scene(),
    lights: {
      sun: new THREE.DirectionalLight(),
      ambient: new THREE.HemisphereLight(),
    },
  };
}

function environmentFixtures({ failLoad = false } = {}) {
  const source = new THREE.DataTexture(
    new Uint8Array([180, 200, 220, 255]),
    1,
    1,
    THREE.RGBAFormat,
  );
  const environmentMap = new THREE.DataTexture(
    new Uint8Array([160, 180, 200, 255]),
    1,
    1,
    THREE.RGBAFormat,
  );
  const calls = { load: [], create: 0, dispose: 0 };
  return {
    source,
    environmentMap,
    calls,
    textureLoader: {
      async load(url) {
        calls.load.push(url);
        if (failLoad) throw new Error('fixture environment unavailable');
        return source;
      },
    },
    mapFactory: {
      create(texture) {
        assert.equal(texture, source);
        calls.create += 1;
        return environmentMap;
      },
      dispose() {
        calls.dispose += 1;
      },
    },
  };
}

test('tone mapping profiles cover only the existing scene environments with ACES output', () => {
  assert.deepEqual(Object.keys(TONE_MAPPING_PROFILES), ['day', 'winter-light', 'rain', 'soft']);
  for (const id of ['day', 'winter-light', 'rain', 'soft']) {
    const profile = getToneMappingProfile(id);
    assert.equal(profile.environmentId, id);
    assert.equal(profile.toneMapping, THREE.ACESFilmicToneMapping);
    assert.equal(profile.outputColorSpace, THREE.SRGBColorSpace);
    assert.ok(profile.exposure > 0.7 && profile.exposure < 1);
  }
  assert.equal(getToneMappingProfile('rain').exposure < getToneMappingProfile('day').exposure, true);
  assert.throws(() => getToneMappingProfile('second-day'), /unknown/);
});

test('enhanced environment applies local reflections, stable shadows, and existing scene moods', async () => {
  const fixtures = environmentFixtures();
  const effect = await EnhancedEnvironmentEffect.create({
    renderer: {},
    quality: ENHANCED_QUALITY_PROFILES.high,
    textureLoader: fixtures.textureLoader,
    mapFactory: fixtures.mapFactory,
  });
  const target = environmentTarget();
  try {
    assert.equal(effect.id, 'enhanced-pmrem-environment');
    assert.equal(effect.diagnostic, null);
    assert.equal(fixtures.calls.load.length, 1);
    assert.doesNotMatch(fixtures.calls.load[0], /^https?:\/\//i);
    assert.equal(fixtures.calls.create, 1);

    effect.apply('day', target);
    assert.equal(target.scene.environment, fixtures.environmentMap);
    assert.equal(target.scene.userData.environmentId, 'day');
    assert.equal(target.scene.userData.toneMappingExposure, getToneMappingProfile('day').exposure);
    assert.equal(target.lights.sun.castShadow, true);
    assert.equal(target.lights.sun.shadow.mapSize.width, 2048);
    assert.equal(target.lights.sun.shadow.bias, -0.00015);
    assert.equal(target.lights.sun.shadow.normalBias, 0.025);
    assert.equal(target.lights.ambient.intensity, 1.52);

    effect.apply('rain', target);
    assert.equal(target.scene.userData.environmentId, 'rain');
    assert.equal(target.scene.userData.toneMappingExposure, getToneMappingProfile('rain').exposure);
    assert.equal(target.lights.sun.intensity, 1.08);
    assert.equal(target.scene.fog.near, 48);
    assert.equal(target.scene.fog.far, 112);

    effect.setQuality(ENHANCED_QUALITY_PROFILES.low);
    assert.equal(target.scene.environment, null);
    assert.equal(target.lights.sun.castShadow, false);
    assert.equal(target.lights.sun.shadow.mapSize.width, 0);
    assert.equal(target.scene.userData.environmentId, 'rain');

    effect.setQuality(ENHANCED_QUALITY_PROFILES.high);
    assert.equal(target.scene.environment, fixtures.environmentMap);
    assert.equal(target.lights.sun.castShadow, true);
  } finally {
    effect.dispose();
    effect.dispose();
  }
  assert.equal(target.scene.environment, null);
  assert.equal(fixtures.calls.dispose, 1);
});

test('optional environment failure keeps the enhanced scene operational with a diagnostic', async () => {
  const fixtures = environmentFixtures({ failLoad: true });
  const effect = await EnhancedEnvironmentEffect.create({
    renderer: {},
    quality: ENHANCED_QUALITY_PROFILES.high,
    textureLoader: fixtures.textureLoader,
    mapFactory: fixtures.mapFactory,
  });
  const target = environmentTarget();
  try {
    assert.match(effect.diagnostic, /fixture environment unavailable/);
    assert.equal(fixtures.calls.create, 0);
    effect.apply('soft', target);
    assert.equal(target.scene.environment, null);
    assert.ok(target.scene.background instanceof THREE.Color);
    assert.equal(target.scene.userData.environmentId, 'soft');
  } finally {
    effect.dispose();
  }
  assert.equal(fixtures.calls.dispose, 1);
});

function rendererFixture() {
  const calls = [];
  return {
    calls,
    shadowMap: { enabled: true, type: null },
    outputColorSpace: null,
    toneMapping: null,
    toneMappingExposure: null,
    setPixelRatio(value) { calls.push(['pixelRatio', value]); },
    setSize(width, height, updateStyle) { calls.push(['size', width, height, updateStyle]); },
    render(scene, camera) { calls.push(['render', scene, camera]); },
    resetState() { calls.push(['reset']); },
  };
}

test('medium and low frame pipelines render directly without changing interaction state', () => {
  const renderer = rendererFixture();
  const pipeline = new EnhancedFrameEffectPipeline(renderer, ENHANCED_QUALITY_PROFILES.medium);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const layer = new THREE.Group();
  layer.visible = false;
  scene.add(layer);
  scene.userData.environmentId = 'rain';
  scene.userData.toneMappingExposure = getToneMappingProfile('rain').exposure;
  camera.position.set(4, 5, 6);
  const state = {
    selection: 18,
    movement: { x: 2, y: 3, z: 4 },
  };
  const before = {
    camera: camera.position.toArray(),
    layer: layer.visible,
    state: structuredClone(state),
  };

  assert.equal(pipeline.usesAmbientOcclusion, false);
  assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(renderer.outputColorSpace, THREE.SRGBColorSpace);
  pipeline.resize(800, 600, 2);
  pipeline.render(scene, camera);
  assert.deepEqual(renderer.calls[0], ['pixelRatio', 1.5]);
  assert.deepEqual(renderer.calls[1], ['size', 800, 600, false]);
  assert.deepEqual(renderer.calls[2], ['render', scene, camera]);
  assert.equal(renderer.toneMappingExposure, getToneMappingProfile('rain').exposure);

  pipeline.setQuality(ENHANCED_QUALITY_PROFILES.low);
  assert.equal(renderer.shadowMap.enabled, false);
  assert.equal(pipeline.usesAmbientOcclusion, false);
  pipeline.restore();
  assert.equal(renderer.calls.some(([name]) => name === 'reset'), true);
  assert.deepEqual(camera.position.toArray(), before.camera);
  assert.equal(layer.visible, before.layer);
  assert.deepEqual(state, before.state);

  pipeline.setQuality({
    ...ENHANCED_QUALITY_PROFILES.high,
    ambientOcclusion: true,
    postProcessing: true,
  });
  assert.equal(renderer.shadowMap.enabled, true);
  assert.equal(pipeline.usesAmbientOcclusion, true);
  pipeline.dispose();
  pipeline.dispose();
  pipeline.render(scene, camera);
  assert.equal(renderer.calls.filter(([name]) => name === 'render').length, 1);
});

test('high AO composition ends with OutputPass so the beauty buffer reaches the screen', async () => {
  const source = await readFile(
    resolve(repoRoot, 'reference/src/3d-viewer/rendering/enhanced/frame-effect-pipeline.ts'),
    'utf8',
  );
  assert.match(source, /new OutputPass\(\)/);
  assert.match(
    source,
    /addPass\(this\.renderPass\)[\s\S]*addPass\(this\.ssaoPass\)[\s\S]*addPass\(this\.outputPass\)/,
  );
  assert.match(source, /this\.outputPass\?\.dispose\(\)/);
});
