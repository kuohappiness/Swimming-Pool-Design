import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../../../../..');
const vite = await createServer({
  root: resolve(repoRoot, 'web'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const [
  qualityModule,
  manifestModule,
  performanceModule,
] = await Promise.all([
  vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/quality-profiles.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/rendering/enhanced/asset-manifest.ts'),
  vite.ssrLoadModule('/src/views/3d-viewer/walkthrough/performance-profile.ts'),
]);
test.after(async () => vite.close());

const {
  ENHANCED_QUALITY_PROFILES,
  assertEnhancedQualityProfiles,
} = qualityModule;
const { getVisualAssetByteSize } = manifestModule;
const { adaptRenderQualityProfile } = performanceModule;

test('enhanced quality tiers meet descending transfer budgets and explicit FPS targets', () => {
  assert.equal(assertEnhancedQualityProfiles(), ENHANCED_QUALITY_PROFILES);
  assert.deepEqual(
    ['high', 'medium', 'low'].map((tier) => ({
      tier,
      bytes: getVisualAssetByteSize(tier),
      budget: ENHANCED_QUALITY_PROFILES[tier].assetBudgetBytes,
      fps: ENHANCED_QUALITY_PROFILES[tier].minimumAverageFps,
    })),
    [
      { tier: 'high', bytes: 606604, budget: 24 * 1024 * 1024, fps: 50 },
      { tier: 'medium', bytes: 606604, budget: 12 * 1024 * 1024, fps: 40 },
      { tier: 'low', bytes: 604987, budget: 6 * 1024 * 1024, fps: 30 },
    ],
  );
});

test('quality adaptation changes visual cost only and leaves semantic state untouched', () => {
  const semanticState = Object.freeze({
    sceneId: 'rain',
    selectedEntityId: 'POOL-01',
    layerIds: Object.freeze(['site', 'water']),
    playerPosition: Object.freeze([10, 1.2, -4]),
    movementMode: 'swimming-underwater',
  });
  const before = structuredClone(semanticState);
  const low = adaptRenderQualityProfile(ENHANCED_QUALITY_PROFILES.high, 'low');

  assert.deepEqual(semanticState, before);
  assert.deepEqual(low, {
    ...ENHANCED_QUALITY_PROFILES.high,
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
  for (const key of Object.keys(semanticState)) assert.equal(key in low, false);
});

test('viewer publishes deterministic GPU diagnostics and restores only rendering state', async () => {
  const source = await readFile(
    resolve(repoRoot, 'web/src/views/3d-viewer/main.ts'),
    'utf8',
  );
  assert.match(source, /renderer\.info\.autoReset = false/);
  assert.match(source, /await renderer\.compileAsync\(graph\.scene, camera\)/);
  assert.match(source, /dataset\.shaderCompileMs/);
  assert.match(source, /dataset\.drawCalls/);
  assert.match(source, /dataset\.triangles/);
  assert.match(source, /dataset\.renderingInitMs/);
  assert.match(source, /get\('adaptive'\) !== 'off'/);
  assert.match(source, /swiftshader\|software\|llvmpipe/i);
  // 軟體繪圖一律從省電級啟動：判斷在 QualitySession，main 只把偵測結果交給它（DEC-190）。
  assert.match(source, /new QualitySession\(\{[\s\S]*?softwareRenderer,/);
  assert.match(
    source,
    /webglcontextrestored[\s\S]*rendering\.framePipeline\.restore\(\)/,
  );
});
