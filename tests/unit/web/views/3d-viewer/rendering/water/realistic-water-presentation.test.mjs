import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { buildViewerModel } from '../../../../../../../core/viewer/viewer-data.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const [projectModel, analysisRegistry] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
]);
const viewerModel = buildViewerModel(projectModel, analysisRegistry);
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
test.after(async () => vite.close());
const THREE = await vite.ssrLoadModule('three');
const { createViewerScene } = await vite.ssrLoadModule('/src/views/3d-viewer/scene-factory.ts');
const { createBaselineSceneRenderingDependencies } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/index.ts');
const {
  EnhancedVisualAssetAdapter,
  getEnhancedQualityProfile,
} = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/index.ts');
const {
  getViewerPoolBasinShape,
  getPoolFloorLaneLineCentres,
  POOL_FLOOR_LANE_LINE_INSET,
  POOL_FLOOR_LANE_LINE_WIDTH,
} = await vite.ssrLoadModule('/src/views/3d-viewer/pool-state.ts');
const { RealisticWaterPresentation } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/water/realistic-water-presentation.ts',
);
const { POOL_BASIN_UNIFORM_NAMES } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/water/pool-basin-material.ts',
);

const basin = getViewerPoolBasinShape(viewerModel);

/** 測試用的貼圖來源與反射探針：不需要繪圖器，並記錄被呼叫的次數。 */
function createFakes({ failOn = null } = {}) {
  const log = { loaded: [], disposedTextures: 0, captures: [], probeSizes: [], sourceDisposed: false, probeDisposed: 0 };
  const textureSource = {
    async loadTexture(url) {
      log.loaded.push(url);
      if (failOn && url.includes(failOn)) throw new TypeError(`fixture could not load ${failOn}`);
      const texture = new THREE.Texture();
      const dispose = texture.dispose.bind(texture);
      texture.dispose = () => {
        log.disposedTextures += 1;
        dispose();
      };
      return texture;
    },
    dispose() {
      log.sourceDisposed = true;
    },
  };
  const createReflectionProbe = (size) => {
    log.probeSizes.push(size);
    let texture = new THREE.CubeTexture();
    let currentSize = size;
    return {
      get texture() {
        return texture;
      },
      setSize(next) {
        if (next === currentSize) return false;
        currentSize = next;
        log.probeSizes.push(next);
        texture = new THREE.CubeTexture();
        return true;
      },
      capture(scene, position, hidden) {
        log.captures.push({ position: position.clone(), hidden: [...hidden], hiddenVisible: hidden.map((o) => o.visible) });
      },
      dispose() {
        log.probeDisposed += 1;
      },
    };
  };
  return { log, textureSource, createReflectionProbe };
}

function createScene(adapter) {
  const baseline = createBaselineSceneRenderingDependencies();
  const graph = createViewerScene(viewerModel, {
    materials: baseline.materials,
    visualAssets: adapter ?? baseline.visualAssets,
  });
  graph.scene.updateMatrixWorld(true);
  const context = {
    scene: graph.scene,
    worldRoot: graph.worldRoot,
    siteRoot: graph.siteRoot,
    layerGroups: graph.layerGroups,
  };
  return { graph, context, materials: baseline.materials };
}

const frame = (overrides = {}) => ({
  deltaSeconds: 1 / 60,
  elapsedSeconds: 2.5,
  reducedMotion: false,
  camera: new THREE.PerspectiveCamera(),
  ...overrides,
});

test('pool basin shape comes from the model and matches the pool that the scene draws', () => {
  const pool = viewerModel.geometry.pool;
  assert.equal(basin.minX, pool.origin[0]);
  assert.equal(basin.maxX, pool.origin[0] + pool.length.value);
  assert.equal(basin.minZ, pool.origin[1]);
  assert.equal(basin.maxZ, pool.origin[1] + pool.width.value);
  assert.equal(basin.laneLineWidth, POOL_FLOOR_LANE_LINE_WIDTH);
  assert.equal(basin.laneLineInset, POOL_FLOOR_LANE_LINE_INSET);
  assert.deepEqual([...basin.laneLineZ], [...getPoolFloorLaneLineCentres(viewerModel)]);
  assert.equal(basin.laneLineZ.length, pool.laneBands.length - 1);

  const { graph, materials } = createScene();
  assert.equal(basin.waterLevel, graph.water.surfaceElevation);
  assert.equal(basin.shallowBottom, graph.water.shallowBottomElevation);
  assert.equal(basin.deepBottom, graph.water.deepBottomElevation);
  graph.water.surface.geometry.computeBoundingBox();
  const box = graph.water.surface.geometry.boundingBox;
  assert.deepEqual(
    [box.min.x, box.max.x, box.min.z, box.max.z],
    [basin.minX, basin.maxX, basin.minZ, basin.maxZ],
  );
  materials.dispose();
});

test('activation swaps the scene water and basin onto one set of shared uniforms', async () => {
  const { graph, context, materials } = createScene();
  const { log, textureSource, createReflectionProbe } = createFakes();
  const basinSource = materials.get('pool-basin');
  const surface = graph.water.surface;
  const originalMaterial = surface.material;
  const originalGeometry = surface.geometry;
  const basinMeshes = [];
  graph.siteRoot.traverse((object) => {
    if (object.isMesh && object.material === basinSource) basinMeshes.push(object);
  });
  assert.ok(basinMeshes.length > 0, 'the scene must have basin meshes to adopt');

  const water = new RealisticWaterPresentation(getEnhancedQualityProfile('high'), {
    basin,
    basinMaterial: basinSource,
    laneLineColor: new THREE.Color(0.03, 0.04, 0.045),
    textureSource,
    createReflectionProbe,
  });
  assert.throws(() => water.activate(context), /not loaded/);
  await water.load();
  assert.equal(log.loaded.length, 2);
  assert.ok(log.loaded.some((url) => url.endsWith('ripple-normal.ktx2')));
  assert.ok(log.loaded.some((url) => url.endsWith('caustics.ktx2')));
  assert.equal(water.active, false);

  water.activate(context);
  assert.equal(water.active, true);
  assert.equal(surface.material.name, 'realistic:water-surface');
  assert.notEqual(surface.geometry, originalGeometry);
  assert.deepEqual(log.probeSizes, [256]);
  const basinMaterial = basinMeshes[0].material;
  assert.equal(basinMaterial.name, 'realistic:pool-basin');
  for (const mesh of basinMeshes) assert.equal(mesh.material, basinMaterial);
  for (const name of POOL_BASIN_UNIFORM_NAMES) {
    assert.equal(
      basinMaterial.uniforms[name],
      surface.material.uniforms[name],
      `${name} must be the same uniform object on the water and the basin`,
    );
  }
  // 池體著色在水面網格的物件座標裡算：世界座標轉回去要得到原本的池體座標。
  const local = new THREE.Vector3(basin.minX, basin.waterLevel, basin.minZ);
  const world = surface.localToWorld(local.clone());
  assert.ok(world.applyMatrix4(basinMaterial.uniforms.uWorldToBasin.value).distanceTo(local) < 1e-9);

  water.dispose();
  assert.equal(surface.material, originalMaterial);
  assert.equal(surface.geometry, originalGeometry);
  for (const mesh of basinMeshes) assert.equal(mesh.material, basinSource);
  assert.equal(log.disposedTextures, 2);
  assert.equal(log.probeDisposed, 1);
  assert.equal(log.sourceDisposed, true);
  materials.dispose();
});

test('reflection is captured once, with the water hidden, and again only after an invalidation', async () => {
  const { graph, context, materials } = createScene();
  const { log, textureSource, createReflectionProbe } = createFakes();
  const water = new RealisticWaterPresentation(getEnhancedQualityProfile('medium'), {
    basin, textureSource, createReflectionProbe,
  });
  await water.load();
  water.activate(context);
  const surface = graph.water.surface;

  water.updateFrame(frame());
  water.updateFrame(frame({ elapsedSeconds: 3 }));
  assert.equal(log.captures.length, 1);
  const [capture] = log.captures;
  assert.deepEqual(capture.hidden, [surface]);
  const expected = surface.localToWorld(new THREE.Vector3(
    (basin.minX + basin.maxX) / 2,
    basin.waterLevel + 0.5,
    (basin.minZ + basin.maxZ) / 2,
  ));
  assert.ok(capture.position.distanceTo(expected) < 1e-9);

  water.invalidateReflection();
  water.updateFrame(frame());
  assert.equal(log.captures.length, 2);

  // 畫質改變：網格與探針跟著換，倒影重拍，但材質不重建。
  const material = surface.material;
  const version = material.version;
  const previousCube = material.uniforms.uReflectionCube.value;
  water.setQuality(getEnhancedQualityProfile('high'));
  assert.equal(surface.material, material);
  assert.equal(material.version, version);
  assert.deepEqual(log.probeSizes, [128, 256]);
  assert.notEqual(material.uniforms.uReflectionCube.value, previousCube);
  water.updateFrame(frame());
  assert.equal(log.captures.length, 3);

  water.dispose();
  materials.dispose();
});

test('each frame feeds the sun, sky and time; reduced motion freezes the surface', async () => {
  const { graph, context, materials } = createScene();
  const { textureSource, createReflectionProbe } = createFakes();
  const water = new RealisticWaterPresentation(getEnhancedQualityProfile('high'), {
    basin, textureSource, createReflectionProbe,
  });
  await water.load();
  water.activate(context);
  const { uniforms } = graph.water.surface.material;
  const { sun, ambient } = graph.lights;
  sun.intensity = 2.5;
  ambient.intensity = 1.5;
  graph.scene.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(graph.water.surface.localToWorld(new THREE.Vector3(10, 1.6, 6)));
  // 故意不更新鏡頭的世界矩陣：水面要自己更新，折射才不會慢一個畫面。
  water.updateFrame(frame({ camera, elapsedSeconds: 4.25 }));
  assert.equal(uniforms.uTime.value, 4.25);
  assert.ok(uniforms.uCameraLocal.value.distanceTo(new THREE.Vector3(10, 1.6, 6)) < 1e-6);
  assert.ok(uniforms.uSunColor.value.equals(sun.color.clone().multiplyScalar(2.5)));
  assert.ok(uniforms.uSkyColor.value.equals(ambient.color.clone().multiplyScalar(1.5)));
  const worldSun = sun.getWorldPosition(new THREE.Vector3())
    .sub(sun.target.getWorldPosition(new THREE.Vector3()))
    .normalize();
  const localSun = worldSun.clone()
    .transformDirection(graph.water.surface.matrixWorld.clone().invert());
  assert.ok(uniforms.uSunDirection.value.distanceTo(localSun) < 1e-6);
  assert.ok(Math.abs(uniforms.uSunDirection.value.length() - 1) < 1e-6);

  water.updateFrame(frame({ camera, elapsedSeconds: 9, reducedMotion: true }));
  assert.equal(uniforms.uTime.value, 0);

  assert.throws(() => water.setWalkthroughState({
    movementMode: 'walking',
    waterSurfaceElevation: basin.waterLevel + 0.1,
    poolCutaway: false,
  }), /second water surface state/);
  water.dispose();
  materials.dispose();
});

test('a failed texture leaves the scene untouched and releases the one that did load', async () => {
  const { graph, context, materials } = createScene();
  const { log, textureSource, createReflectionProbe } = createFakes({ failOn: 'caustics' });
  const originalMaterial = graph.water.surface.material;
  const water = new RealisticWaterPresentation(getEnhancedQualityProfile('high'), {
    basin, textureSource, createReflectionProbe,
  });
  await assert.rejects(() => water.load(), /fixture could not load caustics/);
  assert.equal(log.disposedTextures, 1);
  assert.throws(() => water.activate(context), /not loaded/);
  assert.equal(graph.water.surface.material, originalMaterial);
  water.dispose();
  materials.dispose();
});

test('a basin that does not match the scene water is refused', async () => {
  const { graph, context, materials } = createScene();
  const { textureSource, createReflectionProbe } = createFakes();
  const originalMaterial = graph.water.surface.material;
  const water = new RealisticWaterPresentation(getEnhancedQualityProfile('high'), {
    basin: { ...basin, maxX: basin.maxX + 0.5 }, textureSource, createReflectionProbe,
  });
  await water.load();
  assert.throws(() => water.activate(context), /not aligned/);
  assert.equal(graph.water.surface.material, originalMaterial);
  water.dispose();
  materials.dispose();
});

test('the adapter keeps the previous water until the realistic one is ready, then hands over', async () => {
  const { log, textureSource, createReflectionProbe } = createFakes();
  const adapter = new EnhancedVisualAssetAdapter(getEnhancedQualityProfile('high'), {
    realisticWater: { basin, textureSource, createReflectionProbe },
  });
  const { graph, materials } = createScene(adapter);
  const surface = graph.water.surface;
  assert.equal(adapter.waterPresentation, 'realistic-loading');
  assert.equal(surface.userData.waterPresentation, 'realistic-loading');
  assert.equal(surface.material.name, 'enhanced:shared-water-presentation');
  assert.ok(surface.getObjectByName('visual-only:POOL-01-waterline'));

  await adapter.waterReady;
  assert.equal(adapter.waterPresentation, 'realistic');
  assert.equal(adapter.waterDiagnostic, null);
  assert.equal(surface.userData.waterPresentation, 'realistic');
  assert.equal(surface.material.name, 'realistic:water-surface');
  assert.equal(surface.getObjectByName('visual-only:POOL-01-waterline'), undefined);
  const caustic = graph.siteRoot.getObjectByName('visual-only:POOL-01-caustic:1');
  assert.equal(caustic.visible, false, 'the sliding strips are replaced by caustics in the shader');
  const causticX = caustic.position.x;
  adapter.updateFrame(frame());
  assert.equal(caustic.position.x, causticX);
  assert.equal(log.captures.length, 1);
  adapter.invalidateLighting();
  adapter.updateFrame(frame());
  assert.equal(log.captures.length, 2);

  adapter.dispose();
  assert.equal(caustic.visible, true);
  assert.notEqual(surface.material.name, 'realistic:water-surface');
  materials.dispose();
});

test('the adapter falls back to the previous water when the textures cannot be loaded', async () => {
  const { textureSource, createReflectionProbe } = createFakes({ failOn: 'ripple-normal' });
  const adapter = new EnhancedVisualAssetAdapter(getEnhancedQualityProfile('high'), {
    realisticWater: { basin, textureSource, createReflectionProbe },
  });
  const { graph, materials } = createScene(adapter);
  await adapter.waterReady;
  assert.equal(adapter.waterPresentation, 'legacy-fallback');
  assert.match(adapter.waterDiagnostic, /fixture could not load ripple-normal/);
  assert.equal(graph.water.surface.userData.waterPresentation, 'legacy-fallback');
  assert.equal(graph.water.surface.material.name, 'enhanced:shared-water-presentation');
  assert.ok(graph.water.surface.getObjectByName('visual-only:POOL-01-waterline'));
  assert.equal(graph.siteRoot.getObjectByName('visual-only:POOL-01-caustic:1').visible, true);
  adapter.dispose();
  materials.dispose();
});

test('without a pool basin the adapter stays on the previous water', () => {
  const adapter = new EnhancedVisualAssetAdapter(getEnhancedQualityProfile('high'));
  const { graph, materials } = createScene(adapter);
  assert.equal(adapter.waterPresentation, 'legacy');
  assert.equal(graph.water.surface.userData.waterPresentation, 'legacy');
  adapter.dispose();
  materials.dispose();
});

test('nothing but water lies between the pool floor and the water surface', () => {
  const { graph, materials } = createScene();
  const surface = graph.water.surface;
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.001;
  const up = new THREE.Vector3(0, 1, 0).transformDirection(surface.matrixWorld);
  // 只看畫面上真的看得到的網格與線。
  const solids = [];
  graph.scene.traverse((object) => {
    if (!(object.isMesh || object.isLine)) return;
    for (let node = object; node; node = node.parent) if (!node.visible) return;
    solids.push(object);
  });
  // 取樣點避開水道繩（在水道帶的邊界上）與池梯。
  for (const [x, z] of [[8, 5.6], [15.3, 8.9], [22.7, 11.1], [27.4, 6.1], [5.1, 11.9]]) {
    const floor = basin.shallowBottom
      + (basin.deepBottom - basin.shallowBottom) * ((x - basin.minX) / (basin.maxX - basin.minX));
    const origin = surface.localToWorld(new THREE.Vector3(x, floor + 0.1, z));
    raycaster.set(origin, up);
    raycaster.far = basin.waterLevel - floor + 0.5;
    const hits = raycaster.intersectObjects(solids, false);
    assert.ok(hits.length > 0, `a ray from the pool floor at (${x}, ${z}) must reach the water surface`);
    assert.equal(
      hits[0].object.name,
      'POOL-01-WATER-SURFACE',
      `first thing above the pool floor at (${x}, ${z}) is ${hits[0].object.name || hits[0].object.type}`,
    );
  }

  // 地坪開了口，但外框不變：依賴它的包圍盒（周邊配景的位置）不受影響。
  const ground = graph.siteRoot.getObjectByName('CUTAWAY-HIDE-SITE-GROUND');
  ground.geometry.computeBoundingBox();
  const size = ground.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - (viewerModel.geometry.site.length + 12)) < 1e-6);
  assert.ok(Math.abs(size.y - 0.2) < 1e-6);
  assert.ok(Math.abs(size.z - (viewerModel.geometry.site.width + 12)) < 1e-6);
  materials.dispose();
});
