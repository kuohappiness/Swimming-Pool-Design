import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const repoRoot = resolve(import.meta.dirname, '..');
const viewerRoot = resolve(repoRoot, 'reference/src/3d-viewer');
const vite = await createServer({
  root: resolve(repoRoot, 'reference'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
const {
  VISUAL_ASSET_MANIFEST,
  ENHANCED_QUALITY_PROFILES,
  assertVisualAssetManifest,
  assertEnhancedQualityProfiles,
  getVisualAssetByteSize,
} = await vite.ssrLoadModule('/src/3d-viewer/rendering/enhanced/index.ts');
test.after(async () => vite.close());

test('visual asset manifest resolves to local licensed files with exact hashes and sizes', async () => {
  assert.equal(assertVisualAssetManifest(), VISUAL_ASSET_MANIFEST);
  assert.equal(Object.isFrozen(VISUAL_ASSET_MANIFEST), true);
  assert.equal(new Set(VISUAL_ASSET_MANIFEST.map(({ id }) => id)).size, VISUAL_ASSET_MANIFEST.length);

  for (const asset of VISUAL_ASSET_MANIFEST) {
    const absolutePath = resolve(viewerRoot, asset.localPath);
    assert.ok(
      absolutePath.startsWith(resolve(viewerRoot, 'assets')),
      `${asset.id} must stay inside the local viewer asset root`,
    );
    const bytes = await readFile(absolutePath);
    const metadata = await stat(absolutePath);
    assert.equal(metadata.size, asset.byteSize, `${asset.id} byte size changed`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `${asset.id} hash changed`);
    assert.match(bytes.toString('utf8'), /SPDX-License-Identifier:\s*CC0-1\.0/);
    assert.doesNotMatch(asset.localPath, /^(?:https?:)?\/\//i);
    assert.doesNotMatch(asset.source, /^(?:https?:)?\/\//i);
  }
});

test('quality profiles enforce visual-only descending budgets and mobile fallback', () => {
  assert.equal(assertEnhancedQualityProfiles(), ENHANCED_QUALITY_PROFILES);
  assert.deepEqual(Object.keys(ENHANCED_QUALITY_PROFILES), ['high', 'medium', 'low']);
  assert.equal(ENHANCED_QUALITY_PROFILES.high.assetBudgetBytes, 24 * 1024 * 1024);
  assert.equal(ENHANCED_QUALITY_PROFILES.medium.assetBudgetBytes, 12 * 1024 * 1024);
  assert.equal(ENHANCED_QUALITY_PROFILES.low.assetBudgetBytes, 6 * 1024 * 1024);
  assert.equal(ENHANCED_QUALITY_PROFILES.high.minimumAverageFps, 50);
  assert.equal(ENHANCED_QUALITY_PROFILES.low.minimumAverageFps, 30);
  assert.equal(ENHANCED_QUALITY_PROFILES.low.pixelRatioCap, 1);
  assert.equal(ENHANCED_QUALITY_PROFILES.low.shadows, false);
  assert.equal(ENHANCED_QUALITY_PROFILES.low.ambientOcclusion, false);
  assert.equal(ENHANCED_QUALITY_PROFILES.low.enhancedWater, false);
  assert.equal(ENHANCED_QUALITY_PROFILES.low.postProcessing, false);

  for (const tier of ['high', 'medium', 'low']) {
    assert.ok(
      getVisualAssetByteSize(tier) <= ENHANCED_QUALITY_PROFILES[tier].assetBudgetBytes,
      `${tier} asset manifest must remain within budget`,
    );
  }

  const nonVisualKeys = [
    'camera',
    'movement',
    'collision',
    'scene',
    'layers',
    'selection',
    'modelVersion',
  ];
  for (const profile of Object.values(ENHANCED_QUALITY_PROFILES)) {
    for (const key of nonVisualKeys) assert.equal(key in profile, false, `${key} must not be a quality setting`);
  }
});

test('v0.6.7 visual baseline preserves deterministic screenshots and relative performance evidence', async () => {
  const baselineRoot = resolve(repoRoot, 'tests/visual-baselines/v0.6.7');
  const report = await readFile(resolve(baselineRoot, 'baseline-report.json'), 'utf8').then(JSON.parse);
  assert.equal(report.schemaVersion, '1.0.0');
  assert.equal(report.baselineId, 'viewer-0.6.7-before-enhanced-rendering');
  assert.match(report.performanceInterpretation, /Relative regression baseline only/);
  assert.deepEqual(report.deterministicConditions.sceneIds, ['overview', 'light', 'rain', 'people', 'time']);
  assert.deepEqual(report.desktop.viewport, { width: 1440, height: 900 });
  assert.deepEqual(report.mobile.viewport, { width: 390, height: 844 });
  assert.equal(report.desktop.frameTiming.sampleCount, 12);
  assert.equal(report.mobile.frameTiming.sampleCount, 12);
  assert.equal(report.desktop.resources.encodedBodyBytes > 0, true);
  assert.equal(report.mobile.resources.encodedBodyBytes > 0, true);
  assert.deepEqual(report.desktop.resources.externalOrigins, []);
  assert.deepEqual(report.mobile.resources.externalOrigins, []);
  assert.equal(report.screenshots.length, 14);

  const filenames = new Set(report.screenshots.map(({ filename }) => filename));
  for (const viewport of ['desktop-1440x900', 'mobile-390x844']) {
    for (const scene of report.deterministicConditions.sceneIds) {
      assert.equal(filenames.has(`${viewport}-scene-${scene}.png`), true);
    }
    assert.equal(filenames.has(`${viewport}-walkthrough-entrance.png`), true);
  }
  assert.equal(filenames.has('desktop-1440x900-view-pool-side.png'), true);
  assert.equal(filenames.has('desktop-1440x900-view-school-side.png'), true);

  for (const screenshot of report.screenshots) {
    const bytes = await readFile(resolve(baselineRoot, screenshot.filename));
    assert.equal(bytes.byteLength, screenshot.byteSize, `${screenshot.filename} byte size changed`);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      screenshot.sha256,
      `${screenshot.filename} hash changed`,
    );
  }
});

test('historical v0.6.7 visual baseline remains immutable while release versions stay synchronized', async () => {
  const [packageJson, projectModel] = await Promise.all([
    readFile(resolve(repoRoot, 'package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
  ]);
  assert.equal(packageJson.version, projectModel.modelVersion);
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
});
