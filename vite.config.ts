import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const referenceRoot = resolve(repoRoot, 'reference');

export default defineConfig({
  root: referenceRoot,
  base: './',
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: resolve(repoRoot, 'dist/reference'),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(referenceRoot, 'index.html'),
    },
  },
});
