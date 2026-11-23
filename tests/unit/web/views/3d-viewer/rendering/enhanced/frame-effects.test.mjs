import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// 鏡頭效果（TASK-152 步驟 6）：曝光適應、環境遮蔽與接觸陰影、暈光，以及它們在畫面管線裡的順序。
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
  adaptationRate,
  EXPOSURE_ADAPTATION,
  meterLevel,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/exposure-adaptation.ts');
const { FrameGrade } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/frame-grade.ts');
const {
  ScreenSpaceOcclusion,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/screen-space-occlusion.ts');
const { BLOOM, createBloomPass, disposeBloomPass } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/enhanced/bloom.ts',
);
const {
  EnhancedFrameEffectPipeline,
  ENHANCED_QUALITY_PROFILES,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/index.ts');

const TOP_TIER = Object.freeze({
  ...ENHANCED_QUALITY_PROFILES.high,
  postProcessing: true,
  exposureAdaptation: true,
  bloom: true,
  ambientOcclusion: true,
});

/** 記下每一次繪製畫到哪張貼圖、用哪個材質，以及當時的曝光。 */
function createRenderer({ floatTargets = true } = {}) {
  const draws = [];
  let target = null;
  const clearColor = new THREE.Color();
  let clearAlpha = 1;
  return {
    draws,
    extensions: { has: (name) => floatTargets && name === 'EXT_color_buffer_float' },
    capabilities: { maxSamples: 8 },
    shadowMap: { enabled: true, type: null },
    outputColorSpace: null,
    toneMapping: null,
    toneMappingExposure: null,
    autoClear: true,
    pixelRatio: 1,
    width: 1,
    height: 1,
    setPixelRatio(value) { this.pixelRatio = value; },
    setSize(width, height) {
      this.width = width;
      this.height = height;
    },
    getDrawingBufferSize(size) {
      return size.set(Math.round(this.width * this.pixelRatio), Math.round(this.height * this.pixelRatio));
    },
    getRenderTarget: () => target,
    setRenderTarget(next) { target = next; },
    getClearColor: (color) => color.copy(clearColor),
    setClearColor(color, alpha = 1) {
      clearColor.set(color);
      clearAlpha = alpha;
    },
    getClearAlpha: () => clearAlpha,
    clear() {},
    resetState() {},
    render(object) {
      draws.push({
        target: target?.texture.name ?? 'screen',
        renderTarget: target,
        material: object.isScene ? 'scene' : object.material.name,
        exposure: this.toneMappingExposure,
      });
    },
  };
}

function litScene() {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(0, 10, 0);
  const sky = new THREE.HemisphereLight(0xffffff, 0x000000, 0.4);
  // 整片天空照在水平面上的亮度（半球光只是其中一部分），和水的著色器讀同一個值。
  sky.userData.skyIrradiance = 2;
  scene.add(sun, sun.target, sky);
  scene.userData.toneMappingExposure = 0.8;
  return { scene, sun, sky };
}

test('exposure adapts at the rate of its time constant and meters down to one pixel', () => {
  assert.equal(adaptationRate(0, EXPOSURE_ADAPTATION.brightenSeconds), 0);
  assert.ok(Math.abs(adaptationRate(0.5, 0.5) - (1 - Math.exp(-1))) < 1e-12);
  // Brightening (the pupil closing) is faster than darkening.
  assert.ok(
    adaptationRate(0.1, EXPOSURE_ADAPTATION.brightenSeconds)
      > adaptationRate(0.1, EXPOSURE_ADAPTATION.darkenSeconds),
  );
  assert.equal(adaptationRate(Number.NaN, 1), 0);
  assert.equal(adaptationRate(-1, 1), 0);
  assert.throws(() => adaptationRate(0.1, 0), /time constant/);
  // 128 × 64 halves seven times down to 1 × 1.
  assert.equal(meterLevel(EXPOSURE_ADAPTATION.meterWidth, EXPOSURE_ADAPTATION.meterHeight), 7);
  assert.equal(meterLevel(1, 1), 0);
  assert.ok(EXPOSURE_ADAPTATION.rangeStops > 0 && EXPOSURE_ADAPTATION.strength < 1);
});

test('the grade measures the light falling on level ground from the sun, the sky and the fixtures', () => {
  const { scene, sun, sky } = litScene();
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 200);
  camera.position.set(5, 2, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const grade = new FrameGrade({ occlusion: true, adaptation: true });
  try {
    grade.prepare(scene, camera);
    // Sky 2 + overhead sun 3 × sin(90°); no fixtures in this scene.
    assert.ok(Math.abs(grade.horizontalIlluminance - 5) < 1e-9);
    const up = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorldInverse);
    assert.ok(grade.towardSun.distanceTo(up) < 1e-9, 'the light direction is in camera space');

    // A low sun adds only its vertical share.
    sun.position.set(10, 10, 0);
    grade.prepare(scene, camera);
    assert.ok(Math.abs(grade.horizontalIlluminance - (2 + 3 * Math.SQRT1_2)) < 1e-9);

    // Below the horizon (or switched off) the sun adds nothing; rain and night are darker
    // because the light is weaker, which the adaptation leaves alone.
    sun.visible = false;
    sky.userData.skyIrradiance = 0.5;
    grade.prepare(scene, camera);
    assert.ok(Math.abs(grade.horizontalIlluminance - 0.5) < 1e-9);
  } finally {
    grade.dispose();
  }
});

test('ambient occlusion and contact shadows share one depth pass, and only the occlusion is denoised', () => {
  const occlusion = new ScreenSpaceOcclusion();
  try {
    const { occlusionMaterial, denoiseMaterial } = occlusion;
    // The contact shadows are patched into three.js' GTAO shader; this fails when the
    // installed version no longer has the functions they use.
    assert.match(occlusionMaterial.fragmentShader, /float contactVisibility\(vec3 position, vec3 normal\)/);
    assert.equal(occlusionMaterial.defines.FRAGMENT_OUTPUT, 'vec4(ao, contactVisibility(viewPos, viewNormal), 0.0, 1.0)');
    assert.equal(occlusionMaterial.defines.NORMAL_VECTOR_TYPE, 0, 'normals come from the depth buffer');
    assert.equal(denoiseMaterial.defines.FRAGMENT_OUTPUT, 'vec4(denoised.r, texel.g, 0.0, 1.0)');
    assert.equal(denoiseMaterial.defines.SAMPLE_LUMINANCE, 'a.r');

    occlusion.setSize(801, 600);
    assert.deepEqual(occlusionMaterial.uniforms.resolution.value.toArray(), [401, 300]);
  } finally {
    occlusion.dispose();
  }
});

test('bloom spreads only the light above its threshold, never the whole colour', () => {
  const pass = createBloomPass(800, 500);
  try {
    const material = pass.materialHighPassFilter;
    assert.equal(material.name, 'realistic:bloom-high-pass');
    // The same uniforms object, so the pass still writes the frame and threshold into it.
    assert.equal(material.uniforms, pass.highPassUniforms);
    assert.equal(material.uniforms.luminosityCap.value, BLOOM.cap);
    assert.equal(material.uniforms.smoothWidth.value, BLOOM.knee);
    assert.match(material.fragmentShader, /value - luminosityThreshold/);
    assert.equal(pass.threshold, BLOOM.threshold);
    assert.equal(pass.strength, BLOOM.strength);
    // three.js multiplies the five blur levels by 3; with radius 0 their weights add up to 3,
    // so what spreads is strength × 9 of the light above the threshold: well under half of it.
    assert.ok(BLOOM.strength * 9 < 0.5);
  } finally {
    disposeBloomPass(pass);
  }
});

test('the top tiers light the frame in linear values and tone-map once, at the very end', () => {
  const renderer = createRenderer();
  const pipeline = new EnhancedFrameEffectPipeline(renderer, TOP_TIER);
  const { scene } = litScene();
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 200);
  camera.position.set(5, 2, 5);
  camera.updateMatrixWorld(true);
  pipeline.resize(800, 500, 1);
  assert.equal(pipeline.usesPostProcessing, true);
  assert.deepEqual(pipeline.activeEffects, [
    'multisample', 'exposure-adaptation', 'bloom', 'ambient-occlusion', 'contact-shadows',
  ]);

  pipeline.render(scene, camera);
  const own = renderer.draws.filter(({ material }) => material === 'scene' || material.startsWith('realistic:'));
  assert.deepEqual(own.map(({ target, material }) => [target, material]), [
    ['realistic:frame-scene', 'scene'],
    ['realistic:exposure-meter', 'realistic:exposure-meter'],
    ['realistic:exposure-adaptation', 'realistic:exposure-adaptation'],
    ['realistic:screen-space-occlusion', 'realistic:screen-space-occlusion'],
    ['realistic:screen-space-occlusion-denoised', 'realistic:screen-space-occlusion-denoise'],
    ['realistic:frame-graded', 'realistic:frame-grade'],
    // The bloom keeps only what is brighter than its threshold, capped per pixel.
    ['UnrealBloomPass.bright', 'realistic:bloom-high-pass'],
  ]);
  const scenePass = renderer.draws[0].renderTarget;
  assert.equal(scenePass.samples, 4, 'multisampled anti-aliasing');
  assert.equal(scenePass.texture.type, THREE.HalfFloatType);
  assert.ok(scenePass.depthTexture, 'occlusion reads the scene depth');
  assert.equal(scenePass.width, 800);
  // The bloom adds onto the graded frame, then the output pass tone-maps it to the screen.
  const afterGrade = renderer.draws.slice(renderer.draws.findIndex(({ material }) => material === 'realistic:frame-grade') + 1);
  assert.equal(afterGrade.at(-2).target, 'realistic:frame-graded');
  assert.deepEqual(afterGrade.at(-1), {
    target: 'screen',
    renderTarget: null,
    material: 'OutputShader',
    // The exposure is already multiplied in; the tone mapping itself uses 1.
    exposure: 1,
  });
  assert.equal(renderer.toneMappingExposure, 0.8);
  assert.equal(renderer.getRenderTarget(), null);

  // The governor sheds bloom first, then ambient occlusion; the exposure stays.
  renderer.draws.length = 0;
  pipeline.setQuality({ ...TOP_TIER, bloom: false, ambientOcclusion: false });
  assert.deepEqual(pipeline.activeEffects, ['multisample', 'exposure-adaptation']);
  pipeline.render(scene, camera);
  assert.deepEqual(renderer.draws.map(({ material }) => material), [
    'scene', 'realistic:exposure-meter', 'realistic:exposure-adaptation', 'realistic:frame-grade', 'OutputShader',
  ]);

  // The underwater view takes the whole frame over, drawing into the pipeline's scene texture.
  renderer.draws.length = 0;
  const takenInto = [];
  pipeline.setSceneRenderer(() => {
    takenInto.push(renderer.getRenderTarget()?.texture.name);
    return true;
  });
  pipeline.render(scene, camera);
  assert.deepEqual(takenInto, ['realistic:frame-scene']);
  assert.equal(renderer.draws.some(({ material }) => material === 'scene'), false);
  assert.equal(renderer.draws.at(-1).material, 'OutputShader');
  pipeline.setSceneRenderer(null);

  // Medium and saver draw straight to the screen, tone-mapped inside the materials.
  renderer.draws.length = 0;
  pipeline.setQuality(ENHANCED_QUALITY_PROFILES.medium);
  assert.deepEqual(pipeline.activeEffects, []);
  pipeline.render(scene, camera);
  assert.deepEqual(renderer.draws, [{ target: 'screen', renderTarget: null, material: 'scene', exposure: 0.8 }]);

  pipeline.dispose();
  pipeline.render(scene, camera);
  assert.equal(renderer.draws.length, 1);
});

test('a frame rendered into another target goes back into that target', () => {
  const renderer = createRenderer();
  const pipeline = new EnhancedFrameEffectPipeline(renderer, { ...TOP_TIER, bloom: false, ambientOcclusion: false });
  const { scene } = litScene();
  const camera = new THREE.PerspectiveCamera();
  const capture = new THREE.WebGLRenderTarget(64, 64);
  capture.texture.name = 'capture';
  pipeline.resize(320, 200, 1);
  renderer.setRenderTarget(capture);
  pipeline.render(scene, camera);
  assert.equal(renderer.draws.at(-1).target, 'capture');
  assert.equal(renderer.getRenderTarget(), capture);
  capture.dispose();
  pipeline.dispose();
});
