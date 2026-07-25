import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveActiveGeometry } from './active-geometry.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const allowConceptSourceChange = process.argv.includes('--allow-concept-source-change');
const report = JSON.parse(await readFile(
  resolve(repoRoot, 'tests/visual-baselines/v0.9.0-pre-unification/baseline-report.json'),
  'utf8',
));
const [model, registry, viewerModel, conceptContent] = await Promise.all([
  readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, 'model/analysis-registry.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, 'reference/generated/viewer-model.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, 'reference/generated/concept-content.json'), 'utf8').then(JSON.parse),
]);

const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const hashValue = (value) => createHash('sha256').update(stableJson(value)).digest('hex');
const hashFile = async (path) => createHash('sha256')
  .update(await readFile(resolve(repoRoot, path)))
  .digest('hex');

const activeDesign = structuredClone(resolveActiveGeometry(model));
delete activeDesign.id;
delete activeDesign.revision;
delete activeDesign.modelVersion;
assert.equal(
  hashValue(activeDesign),
  report.immutableData.activeGeometryDesignSha256,
  'Active geometry design data changed outside the 0.9.0 presentation boundary.',
);
assert.equal(
  registry.solar.inputHash,
  report.immutableData.solarInputHash,
  'Solar analysis inputHash changed outside the 0.9.0 presentation boundary.',
);
if (allowConceptSourceChange) {
  assert.match(
    conceptContent.sourceHash,
    /^[a-f0-9]{64}$/,
    'The generated public design narrative must expose a valid source hash.',
  );
} else {
  assert.equal(
    conceptContent.sourceHash,
    report.immutableData.conceptSourceHash,
    'The public design narrative source changed during the presentation-only release.',
  );
}

const viewerSemantics = {
  coordinateSystemId: viewerModel.coordinateSystemId,
  referenceSystem: viewerModel.referenceSystem,
  geometry: viewerModel.geometry,
  entityBounds: viewerModel.entityBounds,
  viewerPresentation: viewerModel.viewerPresentation,
  walkthrough: viewerModel.walkthrough,
};
assert.equal(
  hashValue(viewerSemantics),
  report.immutableData.viewerSemanticSha256,
  'Viewer geometry or interaction semantics changed outside the 0.9.0 presentation boundary.',
);

for (const drawing of report.immutableData.drawings) {
  assert.equal(
    await hashFile(drawing.path),
    drawing.sha256,
    `${drawing.path} changed outside the 0.9.0 presentation boundary.`,
  );
}

process.stdout.write(
  `${allowConceptSourceChange ? '0.9.1 approved narrative boundary' : '0.9.0 immutable baseline'} verified: `
    + `${report.immutableData.drawings.length} drawing files, `
    + `solar ${registry.solar.inputHash.slice(0, 12)}, geometry ${report.immutableData.activeGeometryDesignSha256.slice(0, 12)}.\n`,
);
