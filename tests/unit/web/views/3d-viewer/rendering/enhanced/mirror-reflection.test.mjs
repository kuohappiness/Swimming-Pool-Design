import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';

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
  MirrorReflection,
  createMirrorProbeUniforms,
  installMirrorProbeParallax,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/mirror-reflection.ts');
const { MIRROR_FRONT_NORMAL_KEY, MIRROR_SURFACE_NAME } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/contracts.ts');
const { ENHANCED_QUALITY_PROFILES } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/quality-profiles.ts');

const REFLECT_ANCHOR = 'reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );';

test('box-projected parallax patches only the mirror material’s environment lookup', () => {
  const pars = THREE.ShaderChunk.envmap_physical_pars_fragment;
  // three.js 改版後這一行不見了，這個測試會先失敗，提醒要重新對照著色器。
  assert.equal(pars.split(REFLECT_ANCHOR).length, 2, 'three.js still turns the reflection into world space once');
  const uniforms = createMirrorProbeUniforms();
  const material = new THREE.MeshPhysicalMaterial();
  assert.equal(installMirrorProbeParallax(material, uniforms), true);
  const shader = { fragmentShader: THREE.ShaderLib.physical.fragmentShader, vertexShader: '', uniforms: {} };
  material.onBeforeCompile(shader, null);
  const source = shader.fragmentShader;
  assert.ok(!source.includes('#include <envmap_physical_pars_fragment>'), 'the shared chunk is replaced inline');
  assert.equal(source.split('reflectVec = mirrorProbeParallax( reflectVec );').length, 2);
  assert.ok(source.indexOf('vec3 mirrorProbeParallax(') < source.indexOf('reflectVec = mirrorProbeParallax('));
  assert.ok(source.indexOf('mirrorProbeWorldPosition = (') < source.indexOf('#include <lights_fragment_maps>'));
  assert.equal(shader.uniforms.uMirrorProbeBoxMin, uniforms.uMirrorProbeBoxMin, 'shared, not copied');
  assert.ok(material.customProgramCacheKey().endsWith('|mirror-probe-parallax'));
  // three.js 自己的共用片段沒有被改。
  assert.equal(THREE.ShaderChunk.envmap_physical_pars_fragment, pars);

  const unfamiliar = { envmap_physical_pars_fragment: 'vec3 getIBLRadiance() { return vec3(0.0); }' };
  assert.equal(installMirrorProbeParallax(new THREE.MeshPhysicalMaterial(), uniforms, unfamiliar), false);
});

class FakeProbe {
  constructor(size) {
    this.size = size;
    this.texture = new THREE.CubeTexture();
    this.captures = [];
    this.disposed = false;
  }

  setSize(size) {
    if (size === this.size) return false;
    this.size = size;
    this.texture = new THREE.CubeTexture();
    return true;
  }

  capture(scene, position, hidden) {
    this.captures.push({ position: position.clone(), hidden: [...hidden], hiddenVisible: hidden.map((object) => object.visible) });
  }

  dispose() {
    this.disposed = true;
  }
}

/** 一個最小的場景：SITE 根節點底下有地坪與一片朝 −X、朝下傾斜的鏡面。 */
function fixture() {
  const scene = new THREE.Scene();
  const siteRoot = new THREE.Group();
  siteRoot.rotation.y = 0.6;
  siteRoot.scale.set(1, 1, -1);
  scene.add(siteRoot);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 40), new THREE.MeshStandardMaterial());
  ground.name = 'CUTAWAY-HIDE-SITE-GROUND';
  ground.position.set(20, -0.1, 10);
  siteRoot.add(ground);
  const layer = new THREE.Group();
  siteRoot.add(layer);
  const environment = new THREE.Texture();
  const material = new THREE.MeshPhysicalMaterial({ envMap: environment, envMapIntensity: 0.4 });
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 3.6), material);
  mirror.name = MIRROR_SURFACE_NAME;
  mirror.position.set(30, 8.7, 6.75);
  const lean = 23 * Math.PI / 180;
  mirror.userData[MIRROR_FRONT_NORMAL_KEY] = [-Math.cos(lean), -Math.sin(lean), 0];
  layer.add(mirror);
  scene.updateMatrixWorld(true);
  return { scene, siteRoot, layer, mirror, material, environment, context: { scene, siteRoot, worldRoot: siteRoot, layerGroups: new Map() } };
}

test('the mirror gets its own probe in front of it and recaptures only when told to', () => {
  const probes = [];
  const reflection = new MirrorReflection(ENHANCED_QUALITY_PROFILES.high, {
    createProbe: (size) => {
      const probe = new FakeProbe(size);
      probes.push(probe);
      return probe;
    },
  });
  assert.equal(reflection.active, false);
  const { mirror, material, environment, layer, context, siteRoot } = fixture();
  reflection.attach(context);
  assert.equal(reflection.active, true);
  assert.equal(reflection.parallaxCorrected, true);
  const [probe] = probes;
  assert.equal(probe.size, 256);
  assert.equal(material.envMap, probe.texture);
  assert.equal(material.envMapIntensity, 1, 'the probe holds scene radiance, not a scaled sky');

  reflection.updateFrame();
  assert.equal(probe.captures.length, 1);
  const [first] = probe.captures;
  assert.deepEqual(first.hidden, [mirror], 'the mirror never photographs itself');
  // 探針在鏡面中心沿正面法線往外 0.6 m（世界座標）。
  const normal = new THREE.Vector3(...mirror.userData[MIRROR_FRONT_NORMAL_KEY]).transformDirection(mirror.matrixWorld);
  const expected = mirror.getWorldPosition(new THREE.Vector3()).addScaledVector(normal, 0.6);
  assert.ok(first.position.distanceTo(expected) < 1e-9, `${first.position.toArray()} vs ${expected.toArray()}`);
  // 視差修正的盒子在 SITE 根節點的座標裡包住探針，地面就是盒底。
  const uniforms = material.onBeforeCompile && (() => {
    const shader = { fragmentShader: THREE.ShaderLib.physical.fragmentShader, vertexShader: '', uniforms: {} };
    material.onBeforeCompile(shader, null);
    return shader.uniforms;
  })();
  const local = uniforms.uMirrorProbePosition.value;
  assert.ok(local.distanceTo(siteRoot.worldToLocal(first.position.clone())) < 1e-9);
  const box = new THREE.Box3(uniforms.uMirrorProbeBoxMin.value, uniforms.uMirrorProbeBoxMax.value);
  assert.ok(box.containsPoint(local));
  assert.ok(Math.abs(box.min.y) < 1e-6, 'box floor is the ground surface');
  assert.ok(box.max.y > 80);
  assert.ok(Math.abs(box.min.x - -10) < 1e-6 && Math.abs(box.max.x - 50) < 1e-6);
  const toBox = uniforms.uMirrorProbeWorldToBox.value;
  assert.ok(first.position.clone().applyMatrix4(toBox).distanceTo(local) < 1e-9);

  reflection.updateFrame();
  assert.equal(probe.captures.length, 1, 'a static scene is not captured again');
  reflection.invalidate();
  layer.visible = false;
  reflection.updateFrame();
  assert.equal(probe.captures.length, 1, 'a hidden mirror waits until it is shown');
  layer.visible = true;
  reflection.updateFrame();
  assert.equal(probe.captures.length, 2);

  reflection.setQuality(ENHANCED_QUALITY_PROFILES.low);
  assert.equal(probe.size, 64);
  assert.equal(material.envMap, probe.texture, 'a resized probe hands over its new texture');
  reflection.updateFrame();
  assert.equal(probe.captures.length, 3, 'a new size is captured again');

  reflection.dispose();
  assert.equal(material.envMap, environment);
  assert.equal(material.envMapIntensity, 0.4);
  assert.equal(probe.disposed, true);
  reflection.updateFrame();
  assert.equal(probe.captures.length, 3);
});

test('a scene without the mirror, or a mirror without a front, is handled plainly', () => {
  const reflection = new MirrorReflection(ENHANCED_QUALITY_PROFILES.medium, { createProbe: (size) => new FakeProbe(size) });
  const scene = new THREE.Scene();
  const siteRoot = new THREE.Group();
  scene.add(siteRoot);
  reflection.attach({ scene, siteRoot, worldRoot: siteRoot, layerGroups: new Map() });
  assert.equal(reflection.active, false);
  reflection.updateFrame();
  reflection.dispose();

  const { mirror, context } = fixture();
  delete mirror.userData[MIRROR_FRONT_NORMAL_KEY];
  assert.throws(
    () => new MirrorReflection(ENHANCED_QUALITY_PROFILES.medium, { createProbe: (size) => new FakeProbe(size) }).attach(context),
    /front normal/,
  );
  assert.throws(() => new MirrorReflection(ENHANCED_QUALITY_PROFILES.medium, {}), /renderer or a reflection probe/);
});
