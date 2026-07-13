import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateModel, validateSourceFiles } from './reference-validation.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const errors = [
  ...validateModel(model),
  ...await validateSourceFiles(model, repoRoot),
];

if (errors.length) {
  console.error('Reference model validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Reference model ${model.modelVersion} validated: ${model.entities.length} entities, ${model.sheets.length} sheets, ${model.sources.length} sources.`);
}
