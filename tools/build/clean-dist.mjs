import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(repoRoot, 'dist', 'reference');

if (!outputDirectory.startsWith(repoRoot + '\\') && !outputDirectory.startsWith(repoRoot + '/')) {
  throw new Error('Refusing to clean outside the repository.');
}

await rm(outputDirectory, { recursive: true, force: true });
console.log('Cleaned dist/reference.');
