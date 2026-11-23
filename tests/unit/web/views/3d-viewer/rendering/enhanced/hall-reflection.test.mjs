import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebModuleServer } from '../../../../../../support/web-modules.mjs';

const vite = await createWebModuleServer();
test.after(async () => vite.close());

const THREE = await vite.ssrLoadModule('three');
const { HallReflection, createHallReflectionUniforms, installHallReflection } =
  await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/hall-reflection.ts');
const { markReflectionCapture } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/lighting/reflection-capture.ts',
);

// three.js 的 getIBLRadiance 算反射方向的那一行；池廳反射用同一個算法，改版時這裡先失敗。
const THREE_REFLECTION = 'reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );';

test('the hall probe replaces the environment reflection after three.js computes it', () => {
  assert.ok(THREE.ShaderChunk.envmap_physical_pars_fragment.includes(THREE_REFLECTION));
  // three 0.187 起先算進 iblRadiance（可能再混入回射）才加到 radiance；池廳反射接在加完之後。
  assert.match(THREE.ShaderChunk.lights_fragment_maps, /vec3 iblRadiance = getIBLRadiance\(/);
  assert.match(THREE.ShaderChunk.lights_fragment_maps, /radiance \+= iblRadiance;/);
  const uniforms = createHallReflectionUniforms();
  const material = new THREE.MeshPhysicalMaterial();
  assert.equal(installHallReflection(material, uniforms), true);
  const shader = {
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
    vertexShader: '',
    uniforms: {},
  };
  material.onBeforeCompile(shader, null);
  const source = shader.fragmentShader;
  const apply = source.indexOf('if ( uHallProbeStrength > 0.0 )');
  assert.ok(source.indexOf('float hallProbeReach(') < apply);
  assert.ok(
    source.indexOf('#include <lights_fragment_maps>') < apply,
    'after the environment radiance exists',
  );
  assert.ok(apply < source.indexOf('#include <lights_fragment_end>'), 'before it is applied');
  assert.match(
    source,
    /hallReflect = normalize\( mix\( hallReflect, geometryNormal, pow4\( material\.roughness \) \) \);/,
  );
  assert.equal(shader.uniforms.uHallProbe, uniforms.uHallProbe, 'shared, not copied');
  assert.ok(material.customProgramCacheKey().endsWith('|hall-reflection'));
  assert.equal(installHallReflection(new THREE.MeshLambertMaterial(), uniforms), false);
});

const hall = Object.freeze({
  minX: 0,
  maxX: 29,
  minZ: 0,
  maxZ: 14,
  floor: 0.3,
  roofAtMinX: 4,
  roofAtMaxX: 6.537,
});

function source() {
  const mesh = new THREE.Object3D();
  mesh.rotation.y = 0.7;
  mesh.scale.set(1, 1, -1);
  mesh.updateMatrixWorld(true);
  return {
    texture: new THREE.CubeTexture(),
    size: 256,
    probePosition: new THREE.Vector3(15.5, 0.6, 8.25),
    hall,
    localToWorld: mesh.matrixWorld,
  };
}

test('the hall reflection follows the water probe and waits until it has been captured', () => {
  let current = null;
  const reflection = new HallReflection(() => current);
  reflection.updateFrame();
  assert.equal(reflection.enabled, false);
  assert.equal(reflection.uniforms.uHallProbeStrength.value, 0);
  assert.equal(reflection.uniforms.uHallProbe.value, null);

  current = source();
  reflection.updateFrame();
  const { uniforms } = reflection;
  assert.equal(reflection.enabled, true);
  assert.equal(uniforms.uHallProbe.value, current.texture);
  assert.equal(uniforms.uHallProbeStrength.value, 1);
  assert.deepEqual(uniforms.uHallProbeMin.value.toArray(), [0, 0.3, 0]);
  assert.equal(uniforms.uHallProbeMax.value.x, 29);
  assert.equal(uniforms.uHallProbeMax.value.z, 14);
  assert.equal(uniforms.uHallProbeRoof.value.x, 4);
  assert.ok(Math.abs(uniforms.uHallProbeRoof.value.y - 2.537 / 29) < 1e-12);
  assert.equal(uniforms.uHallProbeMaxMip.value, 8);
  assert.ok(uniforms.uHallProbePosition.value.equals(current.probePosition));
  const point = new THREE.Vector3(3, 1, 2);
  const world = point.clone().applyMatrix4(current.localToWorld);
  assert.ok(world.applyMatrix4(uniforms.uHallProbeWorldToLocal.value).distanceTo(point) < 1e-9);
  const direction = new THREE.Vector3(0.2, 0.3, 0.9);
  assert.ok(
    direction
      .clone()
      .applyMatrix3(uniforms.uHallProbeLocalToWorld.value)
      .distanceTo(
        direction
          .clone()
          .transformDirection(current.localToWorld)
          .multiplyScalar(direction.length()),
      ) < 1e-9,
  );
});

test('reflection captures never read the probe they are drawing into', () => {
  const current = source();
  const reflection = new HallReflection(() => current);
  const scene = new THREE.Scene();
  const calls = [];
  scene.onBeforeRender = () => calls.push('before');
  scene.onAfterRender = () => calls.push('after');
  const own = new THREE.MeshStandardMaterial({ envMap: new THREE.CubeTexture() });
  const plain = new THREE.MeshStandardMaterial();
  scene.add(
    new THREE.Mesh(new THREE.BoxGeometry(), own),
    new THREE.Mesh(new THREE.BoxGeometry(), plain),
  );
  reflection.attach(scene);
  assert.equal(plain.userData.hallReflection, reflection.uniforms);
  assert.equal(own.userData.hallReflection, undefined, 'a material with its own probe keeps it');
  reflection.updateFrame();

  const { uniforms } = reflection;
  const main = new THREE.PerspectiveCamera();
  const capture = new THREE.PerspectiveCamera();
  markReflectionCapture(capture);
  scene.onBeforeRender(null, scene, main, null);
  assert.equal(uniforms.uHallProbe.value, current.texture);
  // 主畫面中途畫平面倒影：裡面那一次不讀探針，畫完還原。
  scene.onBeforeRender(null, scene, capture, null);
  assert.equal(uniforms.uHallProbe.value, null);
  assert.equal(uniforms.uHallProbeStrength.value, 0);
  scene.onAfterRender(null, scene, capture, null);
  assert.equal(uniforms.uHallProbe.value, current.texture);
  assert.equal(uniforms.uHallProbeStrength.value, 1);
  scene.onAfterRender(null, scene, main, null);
  assert.equal(uniforms.uHallProbe.value, current.texture);
  assert.deepEqual(
    calls,
    ['before', 'before', 'after', 'after'],
    'the scene’s own hooks still run',
  );

  reflection.dispose();
  calls.length = 0;
  scene.onBeforeRender(null, scene, capture, null);
  assert.deepEqual(calls, ['before'], 'dispose hands the hooks back');
  assert.equal(uniforms.uHallProbeStrength.value, 0);
});
