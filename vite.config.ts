import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const webRoot = resolve(repoRoot, 'web');

export default defineConfig({
  root: webRoot,
  base: './',
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: resolve(repoRoot, 'dist/web'),
    emptyOutDir: false,
    rolldownOptions: {
      input: resolve(webRoot, 'index.html'),
    },
  },
});
