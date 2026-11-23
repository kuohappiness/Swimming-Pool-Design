import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createWebModuleServer } from '../../../../../../support/web-modules.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createWebModuleServer();
test.after(async () => vite.close());
const viewerRoot = resolve(repoRoot, 'web/src/views/3d-viewer');
const { VISUAL_ASSET_MANIFEST, assertVisualAssetManifest } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/enhanced/asset-manifest.ts',
);

async function listFiles(directory, prefix) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await listFiles(resolve(directory, entry.name), path)));
    else files.push(path);
  }
  return files;
}

const sample = VISUAL_ASSET_MANIFEST[0];
const ktx2 = VISUAL_ASSET_MANIFEST.find((asset) => asset.localPath.endsWith('.ktx2'));

test('every file in the asset folder is registered in asset-manifest.json', async () => {
  const registered = new Set(VISUAL_ASSET_MANIFEST.map((asset) => asset.localPath));
  const unregistered = (await listFiles(resolve(viewerRoot, 'assets'), 'assets'))
    .filter((path) => !path.endsWith('/README.md') && path !== 'assets/asset-manifest.json')
    .filter((path) => !registered.has(path));
  assert.deepEqual(unregistered, []);
});

test('manifest entries are frozen and converted textures carry their conversion record', () => {
  assert.ok(ktx2, 'at least one KTX2 texture is registered');
  for (const asset of VISUAL_ASSET_MANIFEST) {
    assert.equal(Object.isFrozen(asset) && Object.isFrozen(asset.qualityTiers), true);
    assert.equal(Boolean(asset.conversion), asset.localPath.endsWith('.ktx2'));
  }
  assert.equal(Object.isFrozen(ktx2.conversion), true);
  assert.equal(ktx2.conversion.format, 'uastc');
  assert.match(ktx2.source, /^project-authored:tools\/build\/textures\//);
});

test('values that JSON cannot type-check are validated at load', () => {
  assert.throws(
    () => assertVisualAssetManifest([{ ...sample, kind: 'video' }]),
    /kind, requirement or loading priority/,
  );
  assert.throws(
    () => assertVisualAssetManifest([{ ...sample, requirement: 'maybe' }]),
    /kind, requirement or loading priority/,
  );
  assert.throws(
    () => assertVisualAssetManifest([{ ...sample, loadingPriority: 'now' }]),
    /kind, requirement or loading priority/,
  );
  assert.throws(
    () => assertVisualAssetManifest([{ ...ktx2, conversion: undefined }]),
    /conversion record/,
  );
  assert.throws(
    () => assertVisualAssetManifest([{ ...sample, conversion: ktx2.conversion }]),
    /conversion record/,
  );
  assert.throws(
    () =>
      assertVisualAssetManifest([
        { ...ktx2, conversion: { ...ktx2.conversion, sourceSha256: 'abc' } },
      ]),
    /conversion source hash/,
  );
});
