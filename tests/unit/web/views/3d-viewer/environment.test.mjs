import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWebModuleServer } from '../../../../support/web-modules.mjs';

const vite = await createWebModuleServer();
const {
  EnhancedEnvironmentEffect,
  EnhancedFrameEffectPipeline,
  ENHANCED_QUALITY_PROFILES,
  TONE_MAPPING_PROFILES,
  getToneMappingProfile,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/index.ts');
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
  assert.equal(
    getToneMappingProfile('rain').exposure < getToneMappingProfile('day').exposure,
    true,
  );
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
    // 固定環境（沒有算出來的光）一律用固定半徑的陰影過濾。
    assert.equal(target.lights.sun.shadow.radius, 1.5);
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

test('computed sun lighting overrides the fixed scene moods and survives scene and quality changes', async () => {
  const { computeSunLighting } = await vite.ssrLoadModule(
    '/src/views/3d-viewer/rendering/lighting/sun-lighting.ts',
  );
  const winterMorning = computeSunLighting({
    moment: { year: 2026, month: 12, day: 21, minutes: 570 },
    location: { latitude: 24.14434, longitude: 120.67341, utcOffsetHours: 8 },
    positiveXAxisBearingFromTrueNorth: 307,
    weather: 'clear',
  });
  const fixtures = environmentFixtures();
  const effect = await EnhancedEnvironmentEffect.create({
    renderer: {},
    quality: ENHANCED_QUALITY_PROFILES.high,
    textureLoader: fixtures.textureLoader,
    mapFactory: fixtures.mapFactory,
  });
  const target = environmentTarget();
  const lighting = (overrides = {}) => ({
    source: winterMorning,
    keyDirection: new THREE.Vector3(0.6, 0.48, 0.64),
    sunDirection: new THREE.Vector3(0.6, 0.48, 0.64),
    moonDirection: new THREE.Vector3(-0.5, 0.74, -0.45),
    keyColor: [1, 0.82, 0.6],
    keyIntensity: 2.4,
    keyAngularRadius: (0.4 * Math.PI) / 180,
    skyColor: [0.8, 0.9, 1],
    groundColor: [0.2, 0.17, 0.12],
    skyIntensity: 1.2,
    horizon: [0.6, 0.7, 0.75],
    fog: { near: 60, far: 130 },
    exposure: 0.93,
    environmentScale: 0.5,
    shadowFocus: { centre: new THREE.Vector3(1, 5, -2), radius: 30 },
    ...overrides,
  });
  const close = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≈ ${expected}`);
  try {
    effect.apply('day', target);
    const fixedEnvironmentIntensity = target.scene.environmentIntensity;
    effect.applyLighting(lighting(), target);
    assert.deepEqual(
      target.lights.sun.color.toArray().map((value) => Number(value.toFixed(6))),
      [1, 0.82, 0.6],
    );
    assert.equal(target.lights.sun.intensity, 2.4);
    assert.deepEqual(target.lights.sun.target.position.toArray(), [1, 5, -2]);
    close(target.lights.sun.position.distanceTo(target.lights.sun.target.position), 60);
    assert.equal(target.lights.sun.shadow.camera.right, 30);
    assert.equal(target.lights.sun.shadow.camera.far, 90);
    // 天光 1.2 由半球光和環境貼圖一起提供：高畫質的環境貼圖佔 0.64，半球光只補剩下的，
    // 同一片天空不會被算兩次；水的著色器不吃環境貼圖，另外拿到完整的天光。
    close(target.scene.environmentIntensity, 0.64 * 0.5);
    close(target.lights.ambient.intensity, 1.2 * (1 - 0.64));
    assert.equal(target.lights.ambient.userData.skyIrradiance, 1.2);
    close(target.lights.ambient.groundColor.r, 0.2);
    close(target.scene.background.g, 0.7);
    assert.ok(target.scene.fog instanceof THREE.Fog);
    assert.deepEqual([target.scene.fog.near, target.scene.fog.far], [60, 130]);
    close(target.scene.fog.color.b, 0.75);
    assert.equal(target.scene.userData.toneMappingExposure, 0.93);
    close(target.scene.environmentIntensity, fixedEnvironmentIntensity * 0.5);
    // 陰影的畫質設定仍由畫質級別決定。
    assert.equal(target.lights.sun.castShadow, true);
    assert.equal(target.lights.sun.shadow.mapSize.width, 2048);
    // 距離柔化的陰影過濾還沒裝上時用固定半徑；裝上之後高畫質改成「每公尺幾格」的負值，
    // 陰天光源變大、影子更柔；中畫質維持固定半徑。
    assert.equal(target.lights.sun.shadow.radius, 1.5);
    effect.setSoftShadows(true);
    close(target.lights.sun.shadow.radius, -Math.tan((0.4 * Math.PI) / 180) / (60 / 2048));
    effect.applyLighting(lighting({ keyAngularRadius: (3 * Math.PI) / 180 }), target);
    close(target.lights.sun.shadow.radius, -Math.tan((3 * Math.PI) / 180) / (60 / 2048));
    effect.setQuality(ENHANCED_QUALITY_PROFILES.medium);
    assert.equal(target.lights.sun.shadow.radius, 1.5);
    close(target.lights.ambient.intensity, 1.2 * (1 - 0.46));
    effect.setQuality(ENHANCED_QUALITY_PROFILES.high);
    effect.applyLighting(lighting(), target);
    close(target.lights.sun.shadow.radius, -Math.tan((0.4 * Math.PI) / 180) / (60 / 2048));

    // 換場景會先寫入固定的環境，再蓋回算出來的光；霧始終是同一個物件。
    const fog = target.scene.fog;
    effect.apply('rain', target);
    assert.equal(target.scene.userData.environmentId, 'rain');
    assert.equal(target.lights.sun.intensity, 2.4);
    close(target.lights.ambient.intensity, 1.2 * (1 - 0.64));
    assert.equal(target.scene.fog, fog);
    assert.equal(target.scene.userData.toneMappingExposure, 0.93);

    effect.setQuality(ENHANCED_QUALITY_PROFILES.low);
    assert.equal(target.lights.sun.castShadow, false);
    assert.equal(target.lights.sun.intensity, 2.4);
    // 省電級沒有環境貼圖，天光全部由半球光提供。
    assert.equal(target.lights.ambient.intensity, 1.2);
    effect.setQuality(ENHANCED_QUALITY_PROFILES.high);

    // 潛到水裡時漫遊會暫時換上水下的霧；時刻改變不可以把它換掉，浮出來之後接回的霧已是新的顏色。
    const underwater = new THREE.FogExp2(0x2f8f9a, 0.2);
    target.scene.fog = underwater;
    effect.applyLighting(
      lighting({ horizon: [0.1, 0.2, 0.3], fog: { near: 40, far: 100 } }),
      target,
    );
    assert.equal(target.scene.fog, underwater);
    close(fog.color.r, 0.1);
    assert.deepEqual([fog.near, fog.far], [40, 100]);
    close(target.scene.background.b, 0.3);
  } finally {
    effect.dispose();
  }
  // 丟棄之後不再動場景。
  effect.applyLighting(lighting({ keyIntensity: 9 }), target);
  assert.equal(target.lights.sun.intensity, 2.4);
});

test('reflections and indirect light come from the sky once it settles, and never on the saver tier', async () => {
  const { computeSunLighting } = await vite.ssrLoadModule(
    '/src/views/3d-viewer/rendering/lighting/sun-lighting.ts',
  );
  const { toSceneLighting } = await vite.ssrLoadModule(
    '/src/views/3d-viewer/rendering/lighting/scene-lighting.ts',
  );
  const siteRoot = new THREE.Group();
  siteRoot.scale.set(1, 1, -1);
  siteRoot.updateMatrixWorld(true);
  const lightingAt = (minutes, weather = 'clear') =>
    toSceneLighting(
      computeSunLighting({
        moment: { year: 2026, month: 12, day: 21, minutes },
        location: { latitude: 24.14434, longitude: 120.67341, utcOffsetHours: 8 },
        positiveXAxisBearingFromTrueNorth: 307,
        weather,
      }),
      siteRoot,
      { centre: new THREE.Vector3(), radius: 30 },
    );

  const fixtures = environmentFixtures();
  const skyMaps = [];
  const captured = [];
  fixtures.mapFactory.createFromScene = (scene) => {
    // 產生環境貼圖的來源只有天空，沒有建築；日面不在裡面（太陽由方向光負責）。
    assert.equal(scene.children.length, 1);
    const [source] = scene.children;
    captured.push({
      sunDisc: source.material.uniforms.uSunDiscColor.value.length(),
      cloudCover: source.material.uniforms.uCloudCover.value,
    });
    const map = new THREE.DataTexture(new Uint8Array([90, 120, 160, 255]), 1, 1, THREE.RGBAFormat);
    skyMaps.push(map);
    return map;
  };
  const effect = await EnhancedEnvironmentEffect.create({
    renderer: {},
    quality: ENHANCED_QUALITY_PROFILES.high,
    textureLoader: fixtures.textureLoader,
    mapFactory: fixtures.mapFactory,
  });
  const target = environmentTarget();
  const close = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≈ ${expected}`);
  try {
    effect.apply('day', target);
    const base = target.scene.environmentIntensity;
    assert.equal(effect.environmentSource, 'fixed');
    // 還沒有光照狀態時沒有天空可以拍。
    assert.equal(effect.refreshEnvironment(), false);
    assert.equal(target.scene.getObjectByName('SKY-DOME'), undefined);

    const morning = lightingAt(9 * 60 + 30);
    effect.applyLighting(morning, target);
    const dome = target.scene.getObjectByName('SKY-DOME');
    assert.ok(dome instanceof THREE.Mesh);
    assert.ok(dome.material.uniforms.uSunDirection.value.distanceTo(morning.sunDirection) < 1e-12);
    // 時刻還在變的時候先沿用固定的環境圖，只調強度。
    assert.equal(effect.environmentSource, 'fixed');
    close(target.scene.environmentIntensity, base * morning.environmentScale);

    assert.equal(effect.refreshEnvironment(), true);
    assert.equal(target.scene.environment, skyMaps[0]);
    assert.equal(effect.environmentSource, 'sky');
    close(target.scene.environmentIntensity, base);
    assert.equal(captured[0].sunDisc, 0);
    // 沒有新的變化就不重做。
    assert.equal(effect.refreshEnvironment(), false);
    assert.equal(skyMaps.length, 1);

    // 拖動時刻：天空球立刻跟著變，環境貼圖先按天光的比例調亮度，停下來才重新產生。
    const dusk = lightingAt(17 * 60);
    effect.applyLighting(dusk, target);
    assert.equal(target.scene.children.filter((child) => child.name === 'SKY-DOME').length, 1);
    assert.equal(target.scene.environment, skyMaps[0]);
    close(target.scene.environmentIntensity, (base * dusk.skyIntensity) / morning.skyIntensity);
    assert.ok(target.scene.environmentIntensity < base);
    assert.equal(effect.refreshEnvironment(), true);
    assert.equal(target.scene.environment, skyMaps[1]);
    close(target.scene.environmentIntensity, base);

    // 換場景不必重拍天空；換天氣要。
    effect.apply('rain', target);
    assert.equal(target.scene.environment, skyMaps[1]);
    assert.equal(target.scene.children.filter((child) => child.name === 'SKY-DOME').length, 1);
    effect.applyLighting(lightingAt(17 * 60, 'overcast'), target);
    assert.equal(effect.refreshEnvironment(), true);
    assert.equal(captured.at(-1).cloudCover, 1);

    // 省電級：沒有環境貼圖，也不花力氣產生；天空球還在，雲用簡化版。
    effect.setQuality(ENHANCED_QUALITY_PROFILES.low);
    assert.equal(target.scene.environment, null);
    assert.equal(effect.environmentSource, 'none');
    assert.equal(effect.refreshEnvironment(), false);
    assert.equal(dome.parent, target.scene);
    assert.equal(dome.material.uniforms.uCloudDetail.value, 0);
    const made = skyMaps.length;
    effect.applyLighting(lightingAt(12 * 60), target);
    assert.equal(effect.refreshEnvironment(), false);
    assert.equal(skyMaps.length, made);

    // 回到較高的級別：先接回上一張，再依現在的天空重拍。
    effect.setQuality(ENHANCED_QUALITY_PROFILES.medium);
    assert.equal(target.scene.environment, skyMaps.at(-1));
    assert.equal(dome.material.uniforms.uCloudDetail.value, 1);
    assert.equal(effect.refreshEnvironment(), true);
    assert.equal(skyMaps.length, made + 1);
    assert.equal(target.scene.environment, skyMaps.at(-1));
    assert.equal(effect.environmentSource, 'sky');
  } finally {
    effect.dispose();
  }
  assert.equal(target.scene.getObjectByName('SKY-DOME'), undefined);
  assert.equal(target.scene.environment, null);
  assert.equal(effect.environmentSource, 'none');
  assert.equal(effect.refreshEnvironment(), false);
});

function rendererFixture() {
  const calls = [];
  return {
    calls,
    shadowMap: { enabled: true, type: null },
    outputColorSpace: null,
    toneMapping: null,
    toneMappingExposure: null,
    setPixelRatio(value) {
      calls.push(['pixelRatio', value]);
    },
    setSize(width, height, updateStyle) {
      calls.push(['size', width, height, updateStyle]);
    },
    render(scene, camera) {
      calls.push(['render', scene, camera]);
    },
    resetState() {
      calls.push(['reset']);
    },
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
  assert.equal(
    renderer.calls.some(([name]) => name === 'reset'),
    true,
  );
  assert.deepEqual(camera.position.toArray(), before.camera);
  assert.equal(layer.visible, before.layer);
  assert.deepEqual(state, before.state);

  // Without float render targets the top tiers draw straight to the screen as well; the frame
  // effects themselves are tested in rendering/enhanced/frame-effects.test.mjs.
  pipeline.setQuality({
    ...ENHANCED_QUALITY_PROFILES.high,
    ambientOcclusion: true,
    bloom: true,
    exposureAdaptation: true,
    postProcessing: true,
  });
  assert.equal(renderer.shadowMap.enabled, true);
  assert.equal(pipeline.usesPostProcessing, false);
  assert.equal(pipeline.usesAmbientOcclusion, false);
  assert.deepEqual(pipeline.activeEffects, []);
  pipeline.render(scene, camera);
  assert.deepEqual(renderer.calls.at(-1), ['render', scene, camera]);
  pipeline.dispose();
  pipeline.dispose();
  pipeline.render(scene, camera);
  assert.equal(renderer.calls.filter(([name]) => name === 'render').length, 2);
});

test('a scene renderer can take a frame over, and the pipeline draws when it declines', () => {
  const renderer = rendererFixture();
  const pipeline = new EnhancedFrameEffectPipeline(renderer, ENHANCED_QUALITY_PROFILES.medium);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  // The underwater view draws the whole frame itself while the camera is in the water.
  const taken = [];
  let takeOver = true;
  pipeline.setSceneRenderer((passScene, passCamera) => {
    taken.push([passScene, passCamera]);
    return takeOver;
  });
  pipeline.render(scene, camera);
  assert.deepEqual(taken, [[scene, camera]]);
  assert.equal(
    renderer.calls.some(([name]) => name === 'render'),
    false,
    'the frame is not drawn twice',
  );
  takeOver = false;
  pipeline.render(scene, camera);
  assert.deepEqual(renderer.calls.at(-1), ['render', scene, camera]);
  pipeline.setSceneRenderer(null);
  pipeline.render(scene, camera);
  assert.equal(taken.length, 2);
  assert.equal(renderer.calls.filter(([name]) => name === 'render').length, 2);
  pipeline.dispose();
});
