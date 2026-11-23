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
  CALM_POOL_WAVES,
  MAXIMUM_LANE_LINES,
  WaterSurface,
  assertPoolBasinShape,
  createWaterSurfaceGeometry,
  createWaterSurfaceMaterial,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/water/water-surface.ts');

const basin = Object.freeze({
  minX: 3,
  maxX: 28,
  minZ: 4,
  maxZ: 12.5,
  waterLevel: 0.22,
  shallowBottom: -0.98,
  deepBottom: -1.28,
  laneLineZ: Object.freeze([4.25, 5.75, 8.25]),
  laneLineWidth: 0.16,
  laneLineInset: 0.35,
});
const textures = () => ({
  rippleNormal: new THREE.Texture(),
  caustics: new THREE.Texture(),
  reflectionCube: new THREE.CubeTexture(),
});
const options = (overrides = {}) => ({ basin, cellSize: 0.25, ...textures(), ...overrides });

test('basin shape must be finite, have a positive footprint and keep lane lines inside', () => {
  assert.equal(assertPoolBasinShape(basin), basin);
  assert.throws(() => assertPoolBasinShape({ ...basin, maxX: Number.NaN }), /finite/);
  assert.throws(() => assertPoolBasinShape({ ...basin, maxX: 3 }), /positive length and width/);
  assert.throws(() => assertPoolBasinShape({ ...basin, deepBottom: 0.3 }), /below the water level/);
  assert.throws(() => assertPoolBasinShape({ ...basin, laneLineZ: [3.9] }), /inside the basin/);
  assert.throws(() => assertPoolBasinShape({ ...basin, laneLineWidth: 0 }), /positive width/);
  assert.throws(
    () => assertPoolBasinShape({ ...basin, laneLineInset: -0.1 }),
    /non-negative inset/,
  );
  assert.throws(
    () =>
      assertPoolBasinShape({
        ...basin,
        laneLineZ: Array.from({ length: 9 }, (_, index) => 5 + index * 0.5),
      }),
    /at most 8 lane lines/,
  );
});

test('surface grid meets the pool walls exactly and stays within the mobile triangle budget', () => {
  const geometry = createWaterSurfaceGeometry(basin, 0.25);
  const position = geometry.getAttribute('position');
  assert.equal(position.count, (100 + 1) * (34 + 1));
  assert.equal(geometry.getIndex().count, 100 * 34 * 6);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index < position.count; index += 1) {
    assert.ok(Math.abs(position.getY(index) - basin.waterLevel) < 1e-6);
    minX = Math.min(minX, position.getX(index));
    maxX = Math.max(maxX, position.getX(index));
    minZ = Math.min(minZ, position.getZ(index));
    maxZ = Math.max(maxZ, position.getZ(index));
  }
  assert.deepEqual([minX, maxX, minZ, maxZ], [3, 28, 4, 12.5]);
  assert.ok(
    geometry.boundingBox.min.y < basin.waterLevel && geometry.boundingBox.max.y > basin.waterLevel,
  );
  assert.ok(geometry.boundingSphere.radius > 12);

  assert.equal(createWaterSurfaceGeometry(basin, 100).getIndex().count, 6, 'at least one cell');
  assert.throws(() => createWaterSurfaceGeometry(basin, 0), RangeError);
});

test('material inlines the shared basin shader and keeps tone mapping, colour space, fog and clipping', () => {
  const material = createWaterSurfaceMaterial(options());
  assert.equal(material.name, 'realistic:water-surface');
  assert.doesNotMatch(material.fragmentShader, /\/\/ #include pool-basin/);
  for (const symbol of [
    'intersectBasin',
    'shadePoolBasin',
    'poolCaustic',
    'applyWaterColumn',
    'mirrorBounceMask',
    'mirrorBounceInWater',
  ]) {
    assert.match(material.fragmentShader, new RegExp(`\\b${symbol}\\(`));
  }
  assert.doesNotMatch(material.fragmentShader, /\/\/ #include mirror-bounce/);
  // 鏡牆反射光的開關預設關著。
  assert.equal(material.uniforms.uMirrorBounceColor.value.w, 0);
  for (const chunk of [
    'tonemapping_fragment',
    'colorspace_fragment',
    'fog_fragment',
    'clipping_planes_fragment',
  ]) {
    assert.match(material.fragmentShader, new RegExp(`#include <${chunk}>`));
  }
  assert.match(material.vertexShader, /#include <fog_vertex>/);
  assert.match(material.vertexShader, /#include <clipping_planes_vertex>/);
  assert.equal(material.fog, true);
  assert.equal(material.clipping, true);
  assert.equal(material.side, THREE.DoubleSide);
  assert.ok('fogColor' in material.uniforms);
  assert.doesNotMatch(material.fragmentShader, /onBeforeCompile|transmission/);
  // Drawn into the frame pipeline's float target (no tone mapping there), the water writes alpha 0
  // so the ambient occlusion and contact shadows of the top tiers leave it alone (TASK-152 step 6).
  assert.match(
    material.fragmentShader,
    /#if defined\( TONE_MAPPING \)\s*gl_FragColor = vec4\(color, 1\.0\);\s*#else(?:\s*\/\/[^\n]*)*\s*gl_FragColor = vec4\(color, 0\.0\);\s*#endif/,
  );
});

test('uniforms come from the basin shape and textures are passed through, not cloned', () => {
  const given = options();
  const { uniforms } = createWaterSurfaceMaterial(given);
  assert.equal(uniforms.uRippleNormal.value, given.rippleNormal);
  assert.equal(uniforms.uCaustics.value, given.caustics);
  assert.equal(uniforms.uReflectionCube.value, given.reflectionCube);
  assert.deepEqual(uniforms.uPoolMin.value.toArray(), [3, 4]);
  assert.deepEqual(uniforms.uPoolMax.value.toArray(), [28, 12.5]);
  assert.equal(uniforms.uWaterLevel.value, 0.22);
  assert.equal(uniforms.uShallowBottom.value, -0.98);
  assert.equal(uniforms.uDeepBottom.value, -1.28);
  assert.equal(uniforms.uLaneLineZ.value.length, MAXIMUM_LANE_LINES);
  assert.deepEqual(uniforms.uLaneLineZ.value.slice(0, 3), [4.25, 5.75, 8.25]);
  assert.ok(
    uniforms.uLaneLineZ.value.slice(3).every((z) => z > 1e5),
    'unused lane lines sit far outside the pool',
  );

  assert.equal(uniforms.uWaves.value.length, 4);
  for (const [index, wave] of CALM_POOL_WAVES.entries()) {
    const uniform = uniforms.uWaves.value[index];
    assert.ok(
      Math.abs(Math.hypot(uniform.x, uniform.y) - 1) < 1e-9,
      'wave direction is a unit vector',
    );
    assert.equal(uniform.z, wave.wavelength);
    assert.equal(uniform.w, wave.amplitude);
    assert.ok(wave.amplitude <= 0.01, 'an indoor pool stays calm');
  }
  const single = createWaterSurfaceMaterial(
    options({ waves: [{ directionDegrees: 90, wavelength: 2, amplitude: 0.01 }] }),
  );
  assert.equal(single.uniforms.uWaves.value[1].w, 0, 'missing waves have zero amplitude');
  assert.throws(
    () => createWaterSurfaceMaterial(options({ waves: Array(5).fill(CALM_POOL_WAVES[0]) })),
    RangeError,
  );
  assert.throws(
    () =>
      createWaterSurfaceMaterial(
        options({ waves: [{ directionDegrees: 0, wavelength: 0, amplitude: 0.01 }] }),
      ),
    RangeError,
  );
});

test('per-frame update only writes uniforms, in the mirrored and rotated site frame', () => {
  const given = options();
  const water = new WaterSurface(given);
  assert.equal(water.mesh.name, 'POOL-01-WATER-SURFACE');
  assert.equal(water.mesh.userData.waterSurfaceElevation, basin.waterLevel);
  assert.equal(water.mesh.userData.collisionExcluded, true);
  assert.equal(given.rippleNormal.wrapS, THREE.RepeatWrapping);
  assert.equal(given.caustics.wrapT, THREE.RepeatWrapping);

  // Same shape as the viewer: SITE Y maps to Three −Z and the site is rotated to its true bearing.
  const siteRoot = new THREE.Group();
  siteRoot.scale.set(1, 1, -1);
  const world = new THREE.Group();
  world.rotation.y = THREE.MathUtils.degToRad(143);
  world.add(siteRoot);
  siteRoot.add(water.mesh);
  world.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera();
  const localCamera = new THREE.Vector3(10, 1.65, 6);
  camera.position.copy(water.mesh.localToWorld(localCamera.clone()));
  camera.updateMatrixWorld(true);
  const localSun = new THREE.Vector3(0.3, 0.8, -0.52).normalize();
  const worldSun = localSun.clone().transformDirection(water.mesh.matrixWorld);

  const versions = () => [
    water.mesh.material.version,
    given.rippleNormal.version,
    given.caustics.version,
    given.reflectionCube.version,
    water.mesh.geometry.getAttribute('position').version,
  ];
  const before = versions();
  for (const timeSeconds of [0, 1.5, 3]) {
    water.update({
      timeSeconds,
      camera,
      sunDirection: worldSun,
      sunColor: new THREE.Color(3, 2.8, 2.5),
      skyColor: new THREE.Color(0.7, 0.8, 1),
    });
  }
  assert.deepEqual(
    versions(),
    before,
    'no texture upload, material rebuild or geometry upload per frame',
  );

  const { uniforms } = water.mesh.material;
  assert.equal(uniforms.uTime.value, 3);
  assert.ok(uniforms.uCameraLocal.value.distanceTo(localCamera) < 1e-9);
  assert.ok(uniforms.uSunDirection.value.distanceTo(localSun) < 1e-9);
  assert.deepEqual(uniforms.uSunColor.value.toArray(), [3, 2.8, 2.5]);
  const backToWorld = localSun.clone().applyMatrix3(uniforms.uLocalToWorld.value);
  assert.ok(backToWorld.distanceTo(worldSun) < 1e-9, 'reflection lookups use world directions');

  water.dispose();
  water.update({
    timeSeconds: 9,
    camera,
    sunDirection: worldSun,
    sunColor: new THREE.Color(),
    skyColor: new THREE.Color(),
  });
  assert.equal(uniforms.uTime.value, 3, 'a disposed surface ignores updates');
});

test('the mirror wall’s reflected light reaches the water in the water mesh’s own coordinates', async () => {
  const { mirrorWallFromViewerModel, mirrorBounceToWorld, computeMirrorBounce } =
    await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/mirror-bounce.ts');
  const { buildViewerModel } = await import('../../../../../../../core/viewer/viewer-data.mjs');
  const { computeSunLighting } = await vite.ssrLoadModule(
    '/src/views/3d-viewer/rendering/lighting/sun-lighting.ts',
  );
  const { readFile } = await import('node:fs/promises');
  const [sourceModel, registry] = await Promise.all([
    readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
  ]);
  const wall = mirrorWallFromViewerModel(buildViewerModel(sourceModel, registry));
  const site = sourceModel.referenceSystem.siteLocation;
  const lighting = computeSunLighting({
    moment: { year: 2026, month: 12, day: 21, minutes: 9 * 60 + 30 },
    location: {
      latitude: site.latitude.value,
      longitude: site.longitude.value,
      utcOffsetHours: site.utcOffsetHours,
    },
    positiveXAxisBearingFromTrueNorth: wall.positiveXAxisBearingFromTrueNorth,
    weather: 'clear',
  });
  const siteRoot = new THREE.Group();
  siteRoot.scale.set(1, 1, -1);
  const world = new THREE.Group();
  world.rotation.y = THREE.MathUtils.degToRad(143);
  world.add(siteRoot);
  const water = new WaterSurface(options());
  siteRoot.add(water.mesh);
  world.updateMatrixWorld(true);
  const bounce = mirrorBounceToWorld(computeMirrorBounce(lighting, wall), siteRoot);
  const frame = {
    timeSeconds: 0,
    camera: new THREE.PerspectiveCamera(),
    sunDirection: new THREE.Vector3(0, 1, 0),
    sunColor: new THREE.Color(1, 1, 1),
    skyColor: new THREE.Color(1, 1, 1),
  };
  const { uniforms } = water.mesh.material;
  water.update({ ...frame, mirrorBounce: bounce });
  assert.equal(uniforms.uMirrorBounceColor.value.w, 1);
  // 水面網格直接掛在 SITE 根節點下：物件座標就是 SITE 的 (x, 高程, y)。
  const corner = computeMirrorBounce(lighting, wall).corners[0];
  assert.ok(
    uniforms.uMirrorBounceOrigin.value.distanceTo(new THREE.Vector3(corner.x, corner.z, corner.y)) <
      1e-9,
  );
  assert.ok(uniforms.uMirrorBounceDirection.value.y < -0.5, 'travels down onto the water');
  water.update(frame);
  assert.equal(uniforms.uMirrorBounceColor.value.w, 0, 'no bounce given, none drawn');
  water.dispose();
});

test('the water asks the sun shadow map whether a point is lit, and always has a depth texture bound', () => {
  const given = options();
  const water = new WaterSurface(given);
  const { uniforms, fragmentShader } = water.mesh.material;
  // 池底、水面反光都查陰影；取樣器是深度比較用的，所以沒有陰影貼圖時也要綁一張深度貼圖，
  // 否則這一筆繪製會被 GPU 丟掉（貼圖格式和取樣器型別不符），水就不見了。
  assert.match(fragmentShader, /uniform highp sampler2DShadow uSunShadowMap;/);
  assert.match(fragmentShader, /\bsunVisibility\(/);
  assert.match(fragmentShader, /\bsunVisibilityAtSurface\(/);
  const fallback = uniforms.uSunShadowMap.value;
  assert.equal(fallback.isDepthTexture, true);
  assert.equal(fallback.compareFunction, THREE.LessEqualCompare);
  assert.ok(fallback.version > 0, 'the fallback is uploaded, not left as an empty texture');
  assert.deepEqual(
    uniforms.uSunShadow.value.toArray(),
    [0, 0, 0],
    'no shadow map: everything is lit',
  );

  const siteRoot = new THREE.Group();
  siteRoot.scale.set(1, 1, -1);
  siteRoot.position.set(-20, 0, 7);
  siteRoot.add(water.mesh);
  siteRoot.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera();
  const frame = (sunShadow) => ({
    timeSeconds: 0,
    camera,
    sunDirection: new THREE.Vector3(0.3, 0.8, 0.5).normalize(),
    sunColor: new THREE.Color(1, 1, 1),
    skyColor: new THREE.Color(1, 1, 1),
    sunShadow,
  });

  const map = new THREE.DepthTexture(4, 4);
  map.compareFunction = THREE.LessEqualCompare;
  const matrix = new THREE.Matrix4().makeScale(0.01, 0.02, 0.03).setPosition(0.5, 0.5, 0.5);
  water.update(frame({ map, matrix, bias: 0.0005, radius: 0.001 }));
  assert.equal(uniforms.uSunShadowMap.value, map);
  assert.deepEqual(uniforms.uSunShadow.value.toArray(), [1, 0.0005, 0.001]);
  // 矩陣把水面自己的座標直接換到陰影貼圖的座標：先到世界，再進陰影相機。
  const local = new THREE.Vector3(10, 0.22, 6);
  const expected = local.clone().applyMatrix4(water.mesh.matrixWorld).applyMatrix4(matrix);
  assert.ok(
    local.clone().applyMatrix4(uniforms.uSunShadowMatrix.value).distanceTo(expected) < 1e-9,
  );
  assert.notEqual(
    uniforms.uSunShadowMatrix.value,
    matrix,
    "the light's own matrix is not overwritten",
  );

  // 陰影關掉（省電級、夜裡沒有主光）時回到全亮，並換回自己的深度貼圖。
  water.update(frame(null));
  assert.equal(uniforms.uSunShadowMap.value, fallback);
  assert.equal(uniforms.uSunShadow.value.x, 0);
  water.update(frame(undefined));
  assert.equal(uniforms.uSunShadowMap.value, fallback);

  let disposed = 0;
  fallback.addEventListener('dispose', () => {
    disposed += 1;
  });
  let mapDisposed = 0;
  map.addEventListener('dispose', () => {
    mapDisposed += 1;
  });
  water.dispose();
  assert.equal(disposed, 1);
  assert.equal(mapDisposed, 0, 'the light owns its shadow map');
});

test('lane line size and colour reach the shader from the basin shape', () => {
  const laneLineColor = new THREE.Color(0.1, 0.2, 0.3);
  const material = createWaterSurfaceMaterial(options({ laneLineColor }));
  assert.equal(material.uniforms.uLaneLineWidth.value, basin.laneLineWidth);
  assert.equal(material.uniforms.uLaneLineInset.value, basin.laneLineInset);
  assert.deepEqual(material.uniforms.uLaneLineZ.value.slice(0, 3), [...basin.laneLineZ]);
  assert.ok(material.uniforms.uLaneLineColor.value.equals(laneLineColor));
  assert.notEqual(
    material.uniforms.uLaneLineColor.value,
    laneLineColor,
    'the caller keeps its own colour object',
  );
  material.dispose();
});

test('an existing scene mesh is adopted in place and handed back on dispose', () => {
  const originalGeometry = new THREE.PlaneGeometry(1, 1);
  const originalMaterial = new THREE.MeshBasicMaterial();
  const target = new THREE.Mesh(originalGeometry, originalMaterial);
  target.name = 'POOL-01-WATER-SURFACE';
  target.userData.waterStateSource = 'walkthrough-main-pool-water';
  target.layers.enable(2);

  const water = new WaterSurface(options(), target);
  assert.equal(water.mesh, target, 'name, layers and pick data stay on the scene object');
  assert.equal(target.material, water.material);
  assert.notEqual(target.geometry, originalGeometry);
  assert.equal(target.userData.waterStateSource, 'walkthrough-main-pool-water');
  assert.equal(target.userData.waterSurfaceElevation, basin.waterLevel);
  assert.equal(target.layers.isEnabled(2), true);

  const coarse = target.geometry;
  const program = water.material.version;
  water.setCellSize(1);
  assert.notEqual(target.geometry, coarse);
  assert.equal(target.geometry.getAttribute('position').count, (25 + 1) * (9 + 1));
  assert.equal(water.material.version, program, 'changing the grid must not rebuild the shader');
  const unchanged = target.geometry;
  water.setCellSize(1);
  assert.equal(target.geometry, unchanged);

  const cube = new THREE.CubeTexture();
  water.setReflectionCube(cube);
  assert.equal(water.material.uniforms.uReflectionCube.value, cube);

  water.dispose();
  assert.equal(target.geometry, originalGeometry);
  assert.equal(target.material, originalMaterial);
  originalGeometry.dispose();
  originalMaterial.dispose();
});
