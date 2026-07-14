import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: 'reference',
  base: './',
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: '../dist/reference',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        atlas: resolve(repoRoot, 'reference/index.html'),
        solarStudy: resolve(repoRoot, 'reference/solar-study/index.html'),
      },
    },
  },
});
