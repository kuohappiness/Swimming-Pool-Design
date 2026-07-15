import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { deriveReferenceGeometry } from '../scripts/reference-geometry.mjs';
import { validateModel, validateSourceFiles } from '../scripts/reference-validation.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceModel = JSON.parse(await readFile(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const clone = () => structuredClone(sourceModel);
const closeTo = (actual, expected, tolerance = 0.002) => Math.abs(actual - expected) <= tolerance;
const modelStairTop = (model) => model.geometry.stair.originY + model.geometry.stair.width;
let rendererModulePromise;

function sourceModuleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

function importRendererModule() {
  if (!rendererModulePromise) {
    rendererModulePromise = Promise.all([
      readFile(resolve(repoRoot, 'reference/src/geometry.ts'), 'utf8'),
      readFile(resolve(repoRoot, 'reference/src/sheets.ts'), 'utf8'),
    ]).then(([geometrySource, sheetsSource]) => {
      const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };
      const geometryModuleUrl = sourceModuleUrl(ts.transpileModule(geometrySource, {
        compilerOptions,
        fileName: 'geometry.ts',
      }).outputText);
      const geometryHelperUrl = pathToFileURL(resolve(repoRoot, 'scripts/reference-geometry.mjs')).href;
      const executableSheetsSource = sheetsSource
        .replace("from '../../scripts/reference-geometry.mjs';", `from '${geometryHelperUrl}';`)
        .replace("} from './geometry';", `} from '${geometryModuleUrl}';`)
        .replace(
          /const siteImage = new URL\([^\r\n]+\)\.href;/,
          "const siteImage = 'test://site-image';",
        );
      const sheetsModuleUrl = sourceModuleUrl(ts.transpileModule(executableSheetsSource, {
        compilerOptions,
        fileName: 'sheets.ts',
      }).outputText);
      return import(sheetsModuleUrl);
    });
  }
  return rendererModulePromise;
}

test('derives the approved 5 m extension geometry from one base parameter', () => {
  const derived = deriveReferenceGeometry(clone());
  assert.equal(derived.l2StartX, 19);
  assert.equal(derived.l2Length, 16);
  assert.equal(derived.l2SplitAxisX, 27);
  assert.equal(derived.roofPlanRun, 19);
  assert.ok(closeTo(derived.stairStartX, 19.04));
  assert.equal(derived.stairEndX, 27);
});

test('re-derives every dependent position when the extension changes', () => {
  const model = clone();
  model.geometry.building.l2ExtensionLength.value = 4;
  const derived = deriveReferenceGeometry(model);
  assert.equal(derived.l2StartX, 20);
  assert.equal(derived.l2Length, 15);
  assert.equal(derived.l2SplitAxisX, 27.5);
  assert.equal(derived.roofPlanRun, 20);
  assert.ok(closeTo(derived.stairStartX, 19.54));
  assert.equal(derived.stairEndX, 27.5);
});

test('rejects an extension outside the usable pool hall', () => {
  const model = clone();
  model.geometry.building.l2ExtensionLength.value = model.geometry.building.poolHallLength.value;
  assert.throws(() => deriveReferenceGeometry(model), /l2ExtensionLength/);
});

test('authoritative reference model is internally consistent', () => {
  assert.deepEqual(validateModel(clone()), []);
});

test('package, lockfile, model, and README release versions stay synchronized', async () => {
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(await readFile(resolve(repoRoot, 'package-lock.json'), 'utf8'));
  const readme = await readFile(resolve(repoRoot, 'README.md'), 'utf8');
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[''].version, packageJson.version);
  assert.equal(sourceModel.modelVersion, packageJson.version);
  assert.ok(readme.includes(`套件版本：\`${packageJson.version}\``));
  assert.ok(readme.includes(`模型版本：\`${sourceModel.modelVersion}\``));
  assert.match(sourceModel.revision, /^\d{4}-\d{2}-\d{2}$/);
});

test('derived L2 zones stay equal and the stair ends on the split axis', () => {
  const derived = deriveReferenceGeometry(clone());
  const area = (bounds) => (bounds.x2 - bounds.x1) * (bounds.y2 - bounds.y1);
  assert.equal(area(derived.maleL2Bounds), area(derived.femaleL2Bounds));
  assert.equal(derived.maleL2Bounds.x2, derived.femaleL2Bounds.x1);
  assert.equal(derived.stairEndX, derived.l2SplitAxisX);
});

test('derives a diagrammatic L1 topology with outdoor forecourt, dry passage, and offset doors', () => {
  const { diagrammaticL1 } = deriveReferenceGeometry(clone());
  assert.equal(diagrammaticL1.outdoorForecourtBounds.x1, 24);
  assert.equal(diagrammaticL1.outdoorForecourtBounds.x2, 35);
  assert.equal(diagrammaticL1.dryPassageBounds.x1, 23);
  assert.equal(diagrammaticL1.dryPassageBounds.x2, 35);
  assert.equal(diagrammaticL1.poolHallOpening.x, 24);
  assert.notEqual(diagrammaticL1.maleFrontDoor.x, diagrammaticL1.maleRearDoor.x);
  assert.notEqual(diagrammaticL1.femaleFrontDoor.x, diagrammaticL1.femaleRearDoor.x);
  assert.ok(diagrammaticL1.poolHallOpening.y > modelStairTop(clone()));
  assert.ok(diagrammaticL1.arrivalPath.minimumStairClearance > 0);
});

test('rendered REF-101 uses outdoor-entry semantics and includes every toilet door', async () => {
  const { renderSheets } = await importRendererModule();
  const markup = renderSheets(clone()).find((sheet) => sheet.id === 'REF-101')?.markup ?? '';
  for (const token of [
    'Z-L1-ENTRY-01',
    'RTE-L1-ARRIVAL-01',
    'OP-L1-PH-01',
    'DR-L1-WC-M-FRONT-01',
    'DR-L1-WC-M-REAR-01',
    'DR-L1-WC-F-FRONT-01',
    'DR-L1-WC-F-REAR-01',
    'PSG-L1-DRY-01',
    '戶外前場',
    '泳池入口',
    '男廁入口',
    '女廁入口',
    '泳池側乾式通道',
    'pool-hours-only',
  ]) {
    assert.match(markup, new RegExp(token));
  }
  assert.doesNotMatch(markup, /共用前室|vestibule/i);
  assert.doesNotMatch(markup, /LOW 6\.000/);
  assert.doesNotMatch(markup, /HIGH 10\.231/);
  assert.doesNotMatch(markup, /採 127°/);
  assert.ok(
    markup.indexOf('data-entity="Z-ST-01"') < markup.lastIndexOf('class="clear-route"'),
    'arrival route must render after the stair and remain visually legible',
  );
});

test('rejects legacy shared indoor vestibule semantics', () => {
  const model = clone();
  model.program.entrance.sharedVestibuleZoneId = 'Z-L1-ENTRY-01';
  assert.match(validateModel(model).join('\n'), /must not define a shared indoor vestibule/);
});

test('requires three distinct registered outdoor openings', () => {
  const model = clone();
  model.program.entrance.outdoorOpeningEntityIds[2] = model.program.entrance.outdoorOpeningEntityIds[1];
  assert.match(validateModel(model).join('\n'), /three distinct outdoor openings/);
});

test('requires a continuous pool-side dry passage to both rear doors', () => {
  const model = clone();
  model.program.l1.dryPassage.continuous = false;
  model.program.l1.dryPassage.connectsToDoorEntityIds.pop();
  const errors = validateModel(model).join('\n');
  assert.match(errors, /dry passage must be continuous/);
  assert.match(errors, /dry passage must connect to both toilet rear doors/);
});

test('requires offset screened toilet doors and no stair obstruction', () => {
  const model = clone();
  model.program.l1.maleToilet.doorsDirectlyAligned = true;
  model.program.l1.femaleToilet.privacyScreen = false;
  model.program.l1.accessConflicts.blocksDryPassage = true;
  const errors = validateModel(model).join('\n');
  assert.match(errors, /front and rear doors must be offset/);
  assert.match(errors, /toilet entrances must include privacy screens/);
  assert.match(errors, /ST-01 must not block/);
});

test('rejects an arrival path that geometrically intersects ST-01 even when conflict flags are false', () => {
  const model = clone();
  model.referenceSystem.worldTransform.localOrigin[0] = 26;
  assert.deepEqual(model.program.l1.accessConflicts, {
    stairEntityId: 'ST-01',
    blocksOutdoorOpenings: false,
    blocksToiletDoors: false,
    blocksDryPassage: false,
  });
  assert.match(
    validateModel(model).join('\n'),
    /arrival path must maintain positive clearance from ST-01/,
  );
});

test('rejects any local origin that drifts from the EN-01 and O-SITE-01 contract', () => {
  for (const localOrigin of [[100, 0, 0], [27, -2, 0], [27, 0, 1], [27.001, 0, 0]]) {
    const model = clone();
    model.referenceSystem.worldTransform.localOrigin = localOrigin;
    assert.match(
      validateModel(model).join('\n'),
      /local origin must remain \[27, 0, 0\]/,
    );
  }
});

test('requires the arrival route to join its threshold and stay inside the outdoor forecourt', () => {
  const model = clone();
  const { diagrammaticL1 } = deriveReferenceGeometry(model);
  assert.deepEqual(diagrammaticL1.arrivalPath.points[0], { x: 27, y: 0 });

  model.referenceSystem.worldTransform.localOrigin[0] = 34;
  assert.match(
    validateModel(model).join('\n'),
    /arrival path bounds must remain inside the outdoor forecourt/,
  );
});

test('treats a sub-tolerance stair gap as no positive clearance', () => {
  const model = clone();
  model.referenceSystem.worldTransform.localOrigin[0] = 26.335;
  assert.match(
    validateModel(model).join('\n'),
    /arrival path must maintain positive clearance from ST-01/,
  );
});

test('enforces TASK-002 registry entity type, level, status, and sources', () => {
  for (const id of [
    'Z-L1-ENTRY-01',
    'RTE-L1-ARRIVAL-01',
    'OP-L1-PH-01',
    'DR-L1-WC-M-FRONT-01',
    'DR-L1-WC-M-REAR-01',
    'DR-L1-WC-F-FRONT-01',
    'DR-L1-WC-F-REAR-01',
    'PSG-L1-DRY-01',
  ]) {
    for (const [field, value] of [
      ['type', 'roof'],
      ['level', 'RF'],
      ['status', 'legacy'],
      ['sourceIds', []],
    ]) {
      const model = clone();
      const entity = model.entities.find((candidate) => candidate.id === id);
      entity[field] = value;
      assert.match(
        validateModel(model).join('\n'),
        new RegExp(`${id} registry contract mismatch`),
      );
    }
  }
});

test('rejects an extra existing source in a TASK-002 registry contract', () => {
  const model = clone();
  const passage = model.entities.find((entity) => entity.id === 'PSG-L1-DRY-01');
  passage.sourceIds.push('SRC-CONCEPT-001');

  assert.deepEqual(validateModel(model), [
    'PSG-L1-DRY-01 registry contract mismatch: sourceIds must be the exact unique set [SRC-CONCEPT-005, SRC-CONCEPT-008]',
  ]);
});

test('rejects a duplicate source in a TASK-002 registry contract', () => {
  const model = clone();
  const passage = model.entities.find((entity) => entity.id === 'PSG-L1-DRY-01');
  passage.sourceIds.push('SRC-CONCEPT-005');

  assert.deepEqual(validateModel(model), [
    'PSG-L1-DRY-01 registry contract mismatch: sourceIds must be the exact unique set [SRC-CONCEPT-005, SRC-CONCEPT-008]',
  ]);
});

test('renders one accessible focus target for each TASK-002 entity', async () => {
  const { renderSheets } = await importRendererModule();
  const markup = renderSheets(clone()).find((sheet) => sheet.id === 'REF-101')?.markup ?? '';
  const taskEntityIds = [
    'Z-L1-ENTRY-01',
    'RTE-L1-ARRIVAL-01',
    'OP-L1-PH-01',
    'DR-L1-WC-M-FRONT-01',
    'DR-L1-WC-M-REAR-01',
    'DR-L1-WC-F-FRONT-01',
    'DR-L1-WC-F-REAR-01',
    'PSG-L1-DRY-01',
  ];

  for (const id of taskEntityIds) {
    const occurrences = markup.match(new RegExp(`data-entity="${id}"`, 'g')) ?? [];
    assert.equal(occurrences.length, 1, `${id} must expose exactly one interaction target`);
    const groupTag = markup.match(new RegExp(`<g[^>]*data-entity="${id}"[^>]*>`))?.[0] ?? '';
    assert.match(groupTag, /tabindex="0"/);
    assert.match(groupTag, /role="button"/);
    assert.match(groupTag, new RegExp(`aria-label="${id}[^"]*"`));
  }
});

test('rejects a missing base cubicle', () => {
  const model = clone();
  model.program.l2.female.activeIds.pop();
  assert.match(validateModel(model).join('\n'), /female must contain 15 active cubicles/);
});

test('rejects a central locker area', () => {
  const model = clone();
  model.geometry.combinedCubicle.centralLockerArea = true;
  assert.match(validateModel(model).join('\n'), /centralLockerArea must remain false/);
});

test('rejects numeric roof elevations before OPEN-010 is resolved', () => {
  const model = clone();
  model.geometry.roof.highElevation = { value: 9, status: 'working', sourceIds: [] };
  assert.match(validateModel(model).join('\n'), /roof elevations must remain deferred under OPEN-010/);
});

test('rejects a second orientation answer', () => {
  const model = clone();
  model.referenceSystem.worldTransform.rotationFromTrueNorth = 127;
  assert.match(validateModel(model).join('\n'), /orientation fields must both equal 307 degrees/);
});

test('rejects an L1 toilet without a pool-hours rear door', () => {
  const model = clone();
  model.program.l1.maleToilet.rearDoor.access = 'always-open';
  assert.match(validateModel(model).join('\n'), /L1 toilet rear doors must be pool-hours-only/);
});

test('rejects unregistered sheet references', () => {
  const model = clone();
  model.sheets[0].referencedEntityIds.push('UNKNOWN-01');
  assert.match(validateModel(model).join('\n'), /references unknown entity/);
});

test('registers the confirmed pool-facing mirror facade', () => {
  const model = clone();
  const mirror = model.entities.find((entity) => entity.id === 'F-MIR-01');
  assert.deepEqual(mirror, {
    id: 'F-MIR-01',
    name: 'EXT-L2-01 面池端鏡面反射牆',
    type: 'mirror-facade',
    level: 'L2',
    grid: 'D/1-4',
    status: 'confirmed',
    sourceIds: ['SRC-CONCEPT-009'],
  });
  assert.equal(model.geometry.roof.highElevation.value, null);
  assert.equal(model.geometry.roof.lowElevation.value, null);
});

test('owns the confirmed solar reflection geometry in one model object', () => {
  const solar = clone().geometry.solarReflection;
  assert.deepEqual(solar, {
    planRotation: { value: 9.5, status: 'confirmed', sourceIds: [] },
    mirrorLeanFromVertical: { value: 8.5, status: 'confirmed', sourceIds: [] },
    rotationDirection: 'clockwise-from-above',
    mirrorLeanDirection: 'toward-pool',
    azimuthTolerance: { value: 28, status: 'working', sourceIds: [] },
    minimumDownwardAngle: { value: 8, status: 'working', sourceIds: [] },
    openItemId: 'OPEN-011',
  });
});

test('rejects drift in confirmed solar reflection geometry', () => {
  for (const [field, value, error] of [
    ['planRotation', { value: 9, status: 'confirmed', sourceIds: [] }, /plan rotation must remain confirmed at 9.5 degrees/],
    ['mirrorLeanFromVertical', { value: 9.5, status: 'confirmed', sourceIds: [] }, /mirror lean must remain confirmed at 8.5 degrees/],
    ['rotationDirection', 'counter-clockwise-from-above', /rotation direction must remain clockwise-from-above/],
    ['mirrorLeanDirection', 'away-from-pool', /mirror lean direction must remain toward-pool/],
    ['azimuthTolerance', { value: 30, status: 'working', sourceIds: [] }, /azimuth tolerance must remain working at 28 degrees/],
    ['minimumDownwardAngle', { value: 6, status: 'working', sourceIds: [] }, /minimum downward angle must remain working at 8 degrees/],
    ['openItemId', 'OPEN-010', /solar reflection must remain linked to OPEN-011/],
  ]) {
    const model = clone();
    model.geometry.solarReflection[field] = value;
    assert.match(validateModel(model).join('\n'), error);
  }
});

test('keeps the TASK-002 outdoor entry semantics while adding the new section source', () => {
  const entry = clone().entities.find((entity) => entity.id === 'Z-L1-ENTRY-01');
  assert.deepEqual(entry, {
    id: 'Z-L1-ENTRY-01',
    name: '操場側入口戶外區',
    type: 'outdoor-forecourt',
    level: 'L1',
    grid: 'E-F/1',
    status: 'confirmed',
    sourceIds: ['SRC-CONCEPT-008', 'SRC-CONCEPT-009'],
  });
});

test('requires every REF-401 conceptual section entity reference', () => {
  for (const id of [
    'Z-L1-ENTRY-01',
    'EXT-L2-01',
    'F-MIR-01',
    'ST-01',
    'RF-GL-01',
    'J-RF-L2-01',
  ]) {
    const model = clone();
    const section = model.sheets.find((sheet) => sheet.id === 'REF-401');
    assert.ok(section.referencedEntityIds.includes(id), `canonical REF-401 must reference ${id}`);
    section.referencedEntityIds = section.referencedEntityIds.filter((candidate) => candidate !== id);
    assert.match(
      validateModel(model).join('\n'),
      new RegExp(`REF-401 must reference ${id}`),
    );
  }
});

test('registers SRC-CONCEPT-009 with the approved immutable identity', () => {
  const source = clone().sources.find((item) => item.id === 'SRC-CONCEPT-009');
  assert.deepEqual(source, {
    id: 'SRC-CONCEPT-009',
    path: 'source-materials/concepts/SRC-CONCEPT-009_longitudinal-section-correction-annotated.png',
    kind: 'annotated-concept',
    pixelSize: [2216, 1130],
    sha256: '3CD710CEC62E32F2209EFA731FCF0EBFDA38A978BD0925A504481EE563175034',
  });
});

test('rejects each field of a drifted SRC-CONCEPT-009 identity', () => {
  for (const [field, value, expectedError] of [
    ['id', 'SRC-CONCEPT-010', /id must remain SRC-CONCEPT-009/],
    ['path', 'source-materials/concepts/SRC-CONCEPT-008_l1-outdoor-entries-annotated.png', /path must remain/],
    ['kind', 'hand-sketch', /kind must remain annotated-concept/],
    ['pixelSize', [2194, 1120], /pixelSize must remain \[2216, 1130\]/],
    ['sha256', 'BBAE9566DF0107810CFE3E499C0D32E0DB68A66B1CC846D3AD815F31FF7BDB0E', /sha256 must remain/],
  ]) {
    const model = clone();
    const source = model.sources.find((item) => item.id === 'SRC-CONCEPT-009');
    source[field] = value;
    assert.match(validateModel(model).join('\n'), expectedError);
  }
});

test('rejects SRC-CONCEPT-009 impersonating a byte-valid registered source', async () => {
  const model = clone();
  const approved = model.sources.find((item) => item.id === 'SRC-CONCEPT-009');
  const impostor = model.sources.find((item) => item.id === 'SRC-CONCEPT-008');
  Object.assign(approved, {
    path: impostor.path,
    kind: impostor.kind,
    pixelSize: [...impostor.pixelSize],
    sha256: impostor.sha256,
  });

  assert.deepEqual(await validateSourceFiles(model, repoRoot), []);
  assert.match(validateModel(model).join('\n'), /SRC-CONCEPT-009 source contract mismatch/);
});

test('enforces the exact F-MIR-01 registry contract', () => {
  for (const [field, value] of [
    ['type', 'wall'],
    ['level', 'RF'],
    ['status', 'working'],
    ['sourceIds', []],
    ['sourceIds', ['SRC-CONCEPT-009', 'SRC-CONCEPT-001']],
    ['sourceIds', ['SRC-CONCEPT-009', 'SRC-CONCEPT-009']],
  ]) {
    const model = clone();
    const mirror = model.entities.find((entity) => entity.id === 'F-MIR-01');
    assert.ok(mirror, 'F-MIR-01 must exist before its registry contract can be mutated');
    mirror[field] = value;
    assert.match(
      validateModel(model).join('\n'),
      /F-MIR-01 registry contract mismatch/,
    );
  }
});

test('rejects formal mirror and display-only geometry fields', () => {
  for (const [path, value] of [
    [['mirrorFacade'], { leanAngle: 9.5 }],
    [['leanAngle'], 9.5],
    [['displayRoofElevation'], 4.5],
    [['roof', 'leanAngle'], 9.5],
  ]) {
    const model = clone();
    const field = path.at(-1);
    const owner = path.slice(0, -1).reduce((current, segment) => current[segment], model.geometry);
    owner[field] = value;
    assert.match(
      validateModel(model).join('\n'),
      new RegExp(`model\\.geometry(?:\\.${path.slice(0, -1).join('\\.')})? must not define ${field}`),
    );
    assert.equal(model.geometry.roof.highElevation.value, null);
    assert.equal(model.geometry.roof.lowElevation.value, null);
  }
});

test('forbidden geometry checks ignore inherited keys and string values', () => {
  const model = clone();
  Object.setPrototypeOf(model.geometry.roof, { leanAngle: 9.5 });
  model.geometry.stair.stringerDescription = 'mirrorFacade leanAngle displayRoofElevation';
  assert.deepEqual(validateModel(model), []);
});

test('REF-401 renders the approved conceptual section language and accessible targets', async () => {
  const [{ renderSheets }, styles] = await Promise.all([
    importRendererModule(),
    readFile(resolve(repoRoot, 'reference/src/styles.css'), 'utf8'),
  ]);
  const section = renderSheets(clone()).find((sheet) => sheet.id === 'REF-401');
  assert.ok(section, 'REF-401 must render');
  const { markup, note } = section;

  for (const token of [
    'entry-outdoor-section',
    'mirror-facade-section',
    'section-concept-note',
    '入口戶外區',
    '位置示意；標高／交界待 OPEN-010',
    '外傾示意；角度待 OPEN-011',
  ]) {
    assert.match(markup, new RegExp(token));
  }
  assert.match(note, /F-MIR-01 向泳池側外傾/);
  assert.doesNotMatch(markup, /9\.5°|\+4\.5°/);

  for (const [id, label] of [
    ['Z-L1-ENTRY-01', '入口戶外區'],
    ['F-MIR-01', '面池端鏡面反射牆'],
  ]) {
    const occurrences = markup.match(new RegExp(`data-entity="${id}"`, 'g')) ?? [];
    assert.equal(occurrences.length, 1, `${id} must expose exactly one interaction target`);
    const groupTag = markup.match(new RegExp(`<g[^>]*data-entity="${id}"[^>]*>`))?.[0] ?? '';
    assert.match(groupTag, /tabindex="0"/);
    assert.match(groupTag, /role="button"/);
    assert.match(groupTag, new RegExp(`aria-label="${id} [^"]*${label}[^"]*"`));
  }

  const roofPoints = markup.match(/<polygon class="glass-roof-section" points="([^"]+)"/)?.[1]
    .split(' ')
    .map((point) => point.split(',').map(Number));
  assert.equal(roofPoints?.length, 4);
  const l2FloorY = 530 - sourceModel.geometry.stair.totalRise * 36;
  assert.ok(closeTo(roofPoints[1][1], l2FloorY - 16), 'roof high end must use the approved SVG-only offset');
  assert.ok(roofPoints[0][1] > roofPoints[1][1], 'the 10-degree roof must still rise toward L2');

  const mirror = markup.match(/<line class="mirror-facade-section" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/);
  assert.ok(mirror, 'F-MIR-01 mirror line must render');
  assert.ok(Number(mirror[1]) < Number(mirror[3]), 'mirror top must lean toward the pool-side low-X direction');
  assert.ok(Number(mirror[2]) < Number(mirror[4]), 'mirror top must remain above its base');
  const extensionPoints = markup.match(/<polygon class="l2-section-volume" points="([^"]+)"/)?.[1]
    .split(' ')
    .map((point) => point.split(',').map(Number));
  assert.deepEqual(extensionPoints?.[0], [Number(mirror[1]), Number(mirror[2])]);
  assert.deepEqual(extensionPoints?.at(-1), [Number(mirror[3]), Number(mirror[4])]);

  const coreIndex = markup.indexOf('class="service-section l1-core"');
  const entryIndex = markup.indexOf('data-entity="Z-L1-ENTRY-01"');
  assert.ok(coreIndex >= 0 && coreIndex < entryIndex, 'the open entry treatment must render over the core fill');
  const core = markup.match(/<rect class="service-section l1-core" x="([^"]+)"[^>]*width="([^"]+)"/);
  const entry = markup.match(/<rect class="entry-outdoor-section" x="([^"]+)"[^>]*width="([^"]+)"/);
  assert.ok(core && entry, 'core and outdoor entry geometry must both render');
  assert.ok(Number(entry[1]) >= Number(core[1]), 'the outdoor entry must occupy the core-side section bay');
  assert.ok(
    closeTo(Number(entry[1]) + Number(entry[2]), Number(core[1]) + Number(core[2])),
    'the outdoor entry must terminate at the service core edge',
  );
  assert.match(styles, /\.entry-outdoor-section\s*\{[^}]*fill:\s*var\(--paper\)/s);
  assert.match(styles, /\.entry-outdoor-section\s*\{[^}]*stroke-dasharray:/s);
  assert.match(styles, /\.mirror-facade-section\s*\{/);
  assert.match(styles, /\.entity-badge\.mirror rect\s*\{/);
});
