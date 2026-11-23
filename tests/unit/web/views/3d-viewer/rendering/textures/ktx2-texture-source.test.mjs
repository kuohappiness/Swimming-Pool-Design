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
const { BUNDLED_TRANSCODER_URLS, Ktx2TextureSource, resolveTranscoderUrl } =
  await vite.ssrLoadModule('/src/views/3d-viewer/rendering/textures/ktx2-texture-source.ts');

test('the Basis transcoder is bundled from three.js, not fetched from another origin', () => {
  assert.match(BUNDLED_TRANSCODER_URLS.script, /basis_transcoder[^/]*\.js$/);
  assert.match(BUNDLED_TRANSCODER_URLS.wasm, /basis_transcoder[^/]*\.wasm$/);
  for (const url of Object.values(BUNDLED_TRANSCODER_URLS)) {
    assert.doesNotMatch(url, /^(?:https?:)?\/\//i);
  }
  assert.equal(Object.isFrozen(BUNDLED_TRANSCODER_URLS), true);
});

test('only the two fixed transcoder file names are rewritten', () => {
  const urls = {
    script: '/assets/basis_transcoder-abc.js',
    wasm: '/assets/basis_transcoder-def.wasm',
  };
  assert.equal(resolveTranscoderUrl('basis-transcoder:/basis_transcoder.js', urls), urls.script);
  assert.equal(resolveTranscoderUrl('basis-transcoder:/basis_transcoder.wasm', urls), urls.wasm);
  assert.equal(
    resolveTranscoderUrl('/assets/ripple-normal-123.ktx2', urls),
    '/assets/ripple-normal-123.ktx2',
  );
  assert.equal(resolveTranscoderUrl('basis_transcoder.js', urls), 'basis_transcoder.js');
  assert.equal(typeof Ktx2TextureSource, 'function');
});
