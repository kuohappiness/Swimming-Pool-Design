import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { buildViewerModel } from '../../../../../../../core/viewer/viewer-data.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
test.after(async () => vite.close());

const THREE = await vite.ssrLoadModule('three');
const lights = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/fixture-lights.ts');
const layoutModule = await vite.ssrLoadModule('/src/views/3d-viewer/fixture-layout.ts');
const { computeSunLighting } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/sun-lighting.ts');
const { createViewerScene } = await vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts');
const { createBaselineSceneRenderingDependencies } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts');
const { POOL_BASIN_UNIFORM_NAMES } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/water/pool-basin-material.ts');
const { getViewerPoolBasinShape } = await vite.ssrLoadModule('/src/views/3d-viewer/pool-state.ts');

const sourceModel = JSON.parse(readFileSync(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const registry = JSON.parse(readFileSync(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8'));
const viewerModel = buildViewerModel(sourceModel, registry);
const layout = layoutModule.getViewerFixtureLayout(viewerModel);
const site = sourceModel.referenceSystem.siteLocation;
const at = (time, weather = 'clear') => {
  const [hour, minute] = time.split(':').map(Number);
  return computeSunLighting({
    moment: { year: 2026, month: 12, day: 21, minutes: hour * 60 + minute },
    location: { latitude: site.latitude.value, longitude: site.longitude.value, utcOffsetHours: site.utcOffsetHours },
    positiveXAxisBearingFromTrueNorth: viewerModel.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
    weather,
  });
};

function createGraph() {
  const { materials, visualAssets } = createBaselineSceneRenderingDependencies();
  return createViewerScene(viewerModel, { materials, visualAssets });
}

const instancePositions = (mesh) => Array.from({ length: mesh.count }, (_, index) => {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
});

test('the drawn fixtures and the lighting share one layout', () => {
  const graph = createGraph();
  const [hall, l2] = layout.zones;
  const hallMesh = graph.scene.getObjectByName(layoutModule.POOL_HALL_FIXTURE_MESH_NAME);
  const l2Mesh = graph.scene.getObjectByName(layoutModule.L2_FIXTURE_MESH_NAME);
  assert.ok(hallMesh?.isInstancedMesh && l2Mesh?.isInstancedMesh);
  // 實例矩陣是 32 位元浮點，容許 1e-5 m。
  const same = (mesh, zone) => {
    const drawn = instancePositions(mesh);
    assert.equal(drawn.length, zone.fixtures.length);
    drawn.forEach((position, index) => position.forEach((value, axis) => {
      assert.ok(Math.abs(value - zone.fixtures[index].position[axis]) < 1e-5, `${zone.id} #${index}`);
    }));
  };
  same(hallMesh, hall);
  same(l2Mesh, l2);
  // 燈具在哪一區，就在那一區的盒子裡；錨點是場景裡真的有的物件。
  for (const zone of layout.zones) {
    assert.ok(graph.scene.getObjectByName(zone.anchorName), zone.anchorName);
    for (const { position } of zone.fixtures) {
      for (let axis = 0; axis < 3; axis += 1) {
        assert.ok(position[axis] >= zone.inner.min[axis] && position[axis] <= zone.inner.max[axis], `${zone.id} ${position}`);
      }
    }
  }
  assert.equal(lights.assertFixtureLayout(layout), layout);
});

test('underwater lights sit on the long pool walls below the water, clear of the teaching platform', () => {
  const basin = getViewerPoolBasinShape(viewerModel);
  const platform = viewerModel.geometry.pool.teachingPlatform.bounds;
  const { poolLights } = layout;
  assert.equal(poolLights.length, 11, 'six per wall, one covered by the teaching platform');
  for (const light of poolLights) {
    const [x, y, z] = light.position;
    assert.ok(x > basin.minX && x < basin.maxX);
    assert.ok(Math.abs(y - (basin.waterLevel - 0.6)) < 1e-9);
    assert.ok(z === basin.minZ || z === basin.maxZ);
    assert.deepEqual([...light.aim], [0, 0, z === basin.minZ ? 1 : -1], 'aims into the pool');
    assert.ok(!(x > platform.x1 && x < platform.x2 && z >= platform.y1 && z <= platform.y2));
  }
});

test('fixtures switch on for overcast, rain and the evening, and stay off on a clear day', () => {
  assert.equal(lights.fixturesSwitchedOn(at('12:00')), false);
  assert.equal(lights.fixturesSwitchedOn(at('09:30')), false);
  assert.equal(lights.fixturesSwitchedOn(at('12:00', 'overcast')), true);
  assert.equal(lights.fixturesSwitchedOn(at('12:00', 'rain')), true);
  assert.equal(lights.fixturesSwitchedOn(at('19:30')), true);
  const dusk = at('16:50');
  assert.equal(lights.fixturesSwitchedOn(dusk), dusk.altitude < lights.FIXTURES_ON_BELOW_ALTITUDE);

  // 換算比例：白天是日光的比例，夜裡是夜景的放大，中間依日光在對數上連續變化。
  assert.ok(Math.abs(lights.fixtureLuxScale(at('12:00')) - lights.DAY_LUX_SCALE) < 1e-12);
  assert.ok(Math.abs(lights.fixtureLuxScale(at('22:00')) - lights.NIGHT_LUX_SCALE) < 1e-12);
  const evening = ['16:30', '17:00', '17:20', '17:40', '18:00'].map((time) => lights.fixtureLuxScale(at(time)));
  for (let index = 1; index < evening.length; index += 1) assert.ok(evening[index] >= evening[index - 1]);
});

test('the hall and the changing floor average about 300 lux', () => {
  for (const zone of layout.zones) {
    const lux = lights.averageFloorIlluminance(zone);
    assert.ok(lux > 250 && lux < 340, `${zone.id}: ${lux}`);
  }
});

test('fewer lights on lower tiers keep the same total flux and centre', () => {
  const [hall] = layout.zones;
  const total = (fixtures) => fixtures.reduce((sum, fixture) => sum + fixture.lumens, 0);
  const centre = (fixtures) => [0, 1, 2].map((axis) => fixtures.reduce(
    (sum, fixture) => sum + fixture.position[axis] * fixture.lumens, 0,
  ) / total(fixtures));
  for (const maximum of [12, 6, 3, 1]) {
    const merged = lights.aggregateFixtures(hall.fixtures, maximum);
    assert.equal(merged.length, Math.min(maximum, hall.fixtures.length));
    assert.ok(Math.abs(total(merged) - total(hall.fixtures)) < 1e-6);
    centre(merged).forEach((value, axis) => assert.ok(Math.abs(value - centre(hall.fixtures)[axis]) < 1e-9));
  }
  for (const light of lights.aggregateFixtures(layout.poolLights, 4)) {
    assert.ok(Math.abs(Math.hypot(...light.aim) - 1) < 1e-9 && Math.abs(light.aim[1]) < 1e-12, 'merged lights still aim sideways');
  }
  assert.throws(() => lights.aggregateFixtures(hall.fixtures, 0), /positive integer/);
});

test('the lights are injected after three.js’s own lights and before its environment light', () => {
  const uniforms = lights.createFixtureLightUniforms();
  const material = new THREE.MeshStandardMaterial();
  assert.equal(lights.installFixtureLights(material, uniforms), true);
  assert.equal(lights.installFixtureLights(material, uniforms), true, 'installing twice is a no-op');
  const shader = { fragmentShader: THREE.ShaderLib.standard.fragmentShader, vertexShader: '', uniforms: {} };
  material.onBeforeCompile(shader, null);
  const source = shader.fragmentShader;
  const apply = source.indexOf('if ( uFixtureActive > 0.0 )');
  assert.ok(source.indexOf('float fixtureZoneReach(') > 0 && source.indexOf('float fixtureZoneReach(') < apply);
  assert.ok(source.indexOf('#include <lights_fragment_begin>') < apply, 'irradiance and directLight already exist');
  assert.ok(apply < source.indexOf('#include <lights_fragment_maps>'));
  assert.equal(shader.uniforms.uFixtureLights, uniforms.uFixtureLights, 'shared, not copied');
  assert.ok(material.customProgramCacheKey().endsWith('|fixture-lights'));
  // three.js 的光照片段仍宣告了注入要用的變數。
  assert.match(THREE.ShaderChunk.lights_fragment_begin, /vec3 irradiance = /);
  assert.match(THREE.ShaderChunk.lights_fragment_begin, /IncidentLight directLight;/);
  assert.equal(lights.installFixtureLights(new THREE.MeshBasicMaterial(), uniforms), false);
});

test('at night the fixtures light their zones in world space; by day they are off', () => {
  const graph = createGraph();
  graph.siteRoot.updateMatrixWorld(true);
  const fixtures = new lights.FixtureLights(layout, graph.scene, graph.siteRoot);
  fixtures.install(graph.scene);
  const emitter = graph.scene.getObjectByName(layoutModule.POOL_HALL_FIXTURE_MESH_NAME);
  assert.equal(emitter.material.userData.fixtureLights, undefined, 'the fixture faces do not light themselves');

  fixtures.setLighting(at('19:30'));
  const { uniforms } = fixtures;
  assert.equal(fixtures.state, 'on');
  assert.equal(fixtures.surfaceLighting, 1);
  assert.equal(uniforms.uFixtureActive.value, 1);
  const [hallRange, l2Range] = uniforms.uFixtureZoneRange.value;
  assert.deepEqual(hallRange.toArray(), [0, 12]);
  assert.deepEqual(l2Range.toArray(), [12, 12]);
  // 燈位是世界座標，在燈具下方一點；換回 SITE 根節點座標就是配置的位置。
  const first = uniforms.uFixtureLights.value[0];
  const local = graph.siteRoot.worldToLocal(new THREE.Vector3(first.x, first.y, first.z));
  const [x, y, z] = layout.zones[0].fixtures[0].position;
  assert.ok(local.distanceTo(new THREE.Vector3(x, y - 0.08, z)) < 1e-9);
  assert.ok(first.w > 0);
  assert.ok(emitter.material.emissiveIntensity > 1, 'the fixture face glows at night');
  const water = lights.readSceneFixtureLights(graph.scene);
  assert.ok(water);
  assert.equal(water.ceiling.length, 12, 'only the hall reaches the water');
  assert.equal(water.pool.length, layout.poolLights.length);
  assert.ok(water.lensLuminance > 0 && water.waterIrradiance.r > 0);

  // 陰天的白天燈開著，但燈光照在構件上只有日光的幾個百分點：只亮發光面，不跑燈光迴圈。
  fixtures.setLighting(at('12:00', 'overcast'));
  assert.equal(fixtures.state, 'on');
  assert.equal(fixtures.surfaceLighting, 0);
  assert.equal(uniforms.uFixtureActive.value, 0);
  assert.ok(emitter.material.emissiveIntensity > 0.2 && emitter.material.emissiveIntensity < 2);

  // 晴天白天關燈。
  fixtures.setLighting(at('12:00'));
  assert.equal(fixtures.state, 'off');
  assert.equal(uniforms.uFixtureActive.value, 0);
  assert.equal(emitter.material.emissiveIntensity, 0);
  assert.equal(lights.readSceneFixtureLights(graph.scene), null);

  // 圖層關掉：那一區的燈不亮，水下燈跟著池廳。
  fixtures.setLighting(at('19:30'));
  graph.scene.getObjectByName(layoutModule.POOL_HALL_DETAILS_NAME).visible = false;
  fixtures.sync();
  assert.equal(uniforms.uFixtureZoneRange.value[0].y, 0);
  assert.equal(uniforms.uFixtureZoneRange.value[1].y, 12);
  assert.equal(lights.readSceneFixtureLights(graph.scene).pool.length, 0);
  graph.scene.getObjectByName(layoutModule.POOL_HALL_DETAILS_NAME).visible = true;

  // 中畫質每區 6 盞、總光量不變。
  fixtures.setQuality('medium');
  assert.equal(uniforms.uFixtureZoneRange.value[0].y, 6);
  assert.equal(lights.readSceneFixtureLights(graph.scene).pool.length, 6);
  assert.throws(() => fixtures.setQuality('ultra'), /Unknown fixture quality tier/);
});

test('the water shader declares the same slots and shares the light uniforms', () => {
  const chunk = readFileSync(resolve(repoRoot, 'web/src/views/3d-viewer/rendering/water/shaders/pool-basin.glsl'), 'utf8');
  assert.match(chunk, new RegExp(`#define WATER_FIXTURE_SLOTS ${lights.WATER_FIXTURE_SLOTS}\\b`));
  assert.match(chunk, new RegExp(`#define POOL_LIGHT_SLOTS ${lights.POOL_LIGHT_SLOTS}\\b`));
  for (const name of lights.WATER_LIGHT_UNIFORM_NAMES) {
    assert.ok(POOL_BASIN_UNIFORM_NAMES.includes(name), name);
    assert.match(chunk, new RegExp(`uniform \\w+ ${name}\\b`));
  }

  // 世界座標轉到水面網格的物件座標（鏡射、旋轉過的 SITE 根節點）。
  const siteRoot = new THREE.Group();
  siteRoot.scale.set(1, 1, -1);
  const world = new THREE.Group();
  world.rotation.y = THREE.MathUtils.degToRad(143);
  world.add(siteRoot);
  const waterMesh = new THREE.Object3D();
  siteRoot.add(waterMesh);
  world.updateMatrixWorld(true);
  const toLocal = waterMesh.matrixWorld.clone().invert();
  const uniforms = lights.createWaterLightUniforms();
  const position = siteRoot.localToWorld(new THREE.Vector3(10, -0.3, 4));
  const aim = new THREE.Vector3(0, 0, 1).transformDirection(siteRoot.matrixWorld);
  lights.writeWaterLightUniforms(uniforms, {
    ceiling: [{ position: siteRoot.localToWorld(new THREE.Vector3(9, 4.6, 2.1)), intensity: 8 }],
    ceilingColor: new THREE.Color(1, 0.9, 0.8),
    pool: [{ position, aim, intensity: 1.2 }],
    poolColor: new THREE.Color(0.9, 1, 1),
    lensLuminance: 26,
    lensRadius: 0.14,
    waterIrradiance: new THREE.Color(0.3, 0.3, 0.3),
  }, toLocal);
  assert.equal(uniforms.uWaterFixtureCount.value, 1);
  assert.ok(new THREE.Vector3().copy(uniforms.uWaterFixtures.value[0]).distanceTo(new THREE.Vector3(9, 4.6, 2.1)) < 1e-9);
  assert.equal(uniforms.uWaterFixtures.value[0].w, 8);
  assert.ok(new THREE.Vector3().copy(uniforms.uPoolLights.value[0]).distanceTo(new THREE.Vector3(10, -0.3, 4)) < 1e-9);
  assert.ok(uniforms.uPoolLightAims.value[0].distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-9);
  assert.deepEqual(uniforms.uPoolLightLens.value.toArray(), [26, 0.14]);
  lights.writeWaterLightUniforms(uniforms, null, toLocal);
  assert.equal(uniforms.uWaterFixtureCount.value, 0);
  assert.equal(uniforms.uPoolLightCount.value, 0);
  assert.equal(uniforms.uPoolLightLens.value.x, 0);
});
