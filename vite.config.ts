import { fileURLToPath, URL } from 'node:url';
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
    emptyOutDir: true,
  },
});
