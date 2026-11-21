import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
import { validateTaskConcurrency } from '../scripts/check-docs.mjs';

const repoRoot = resolve(import.meta.dirname, '..');

async function withRenderingModule(run) {
  const vite = await createServer({
    root: resolve(repoRoot, 'reference'),
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: { port: 0 } },
  });
  try {
    await run(await vite.ssrLoadModule('/src/3d-viewer/rendering/index.ts'));
  } finally {
    await vite.close();
  }
}

test('baseline material registry exposes unique semantic materials without changing legacy values', async () => {
  await withRenderingModule(async ({ createBaselineSceneRenderingDependencies }) => {
    const { materials, visualAssets } = createBaselineSceneRenderingDependencies();
    assert.equal(materials.id, 'baseline-material-registry');
    assert.equal(visualAssets.id, 'baseline-visual-assets');
    assert.equal(new Set(materials.semanticIds).size, materials.semanticIds.length);
    for (const id of [
      'exposed-concrete-l1',
      'safety-glass',
      'structural-steel',
      'pool-deck',
      'water',
      'mirror',
      'photovoltaic',
    ]) {
      assert.ok(materials.semanticIds.includes(id), `missing semantic material ${id}`);
      assert.equal(materials.get(id), materials.get(id), `${id} must reuse one material instance`);
    }

    const glass = materials.get('safety-glass');
    assert.equal(glass.name, 'SHARED-SAFETY-GLASS-FACADE-MATERIAL');
    assert.equal(glass.transparent, true);
    assert.equal(glass.opacity, 0.34);
    assert.equal(glass.roughness, 0.1);
    assert.equal(glass.transmission, 0.16);
    assert.equal(glass.depthWrite, false);

    materials.dispose();
    materials.dispose();
    assert.throws(() => materials.get('safety-glass'), /disposed/);
    visualAssets.dispose();
    visualAssets.dispose();
  });
});

test('baseline environment and frame pipeline preserve direct-render behavior and are idempotent', async () => {
  const vite = await createServer({
    root: resolve(repoRoot, 'reference'),
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: { port: 0 } },
  });
  try {
    const [
      { BaselineEnvironmentEffect },
      { BaselineFrameEffectPipeline },
      { BASELINE_QUALITY_PROFILE },
    ] = await Promise.all([
      vite.ssrLoadModule('/src/3d-viewer/rendering/baseline-environment.ts'),
      vite.ssrLoadModule('/src/3d-viewer/rendering/baseline-frame-pipeline.ts'),
      vite.ssrLoadModule('/src/3d-viewer/rendering/quality-profile.ts'),
    ]);

    const scene = new THREE.Scene();
    const lights = {
      sun: new THREE.DirectionalLight(),
      ambient: new THREE.HemisphereLight(),
    };
    const environment = new BaselineEnvironmentEffect();
    environment.apply('day', { scene, lights });
    assert.equal(scene.background.getHex(), 0xe9eef0);
    assert.equal(scene.fog.near, 65);
    assert.equal(scene.fog.far, 135);
    assert.equal(lights.sun.intensity, 3.4);
    assert.equal(lights.ambient.intensity, 2.2);
    assert.deepEqual(lights.sun.position.toArray(), [-18, 32, 22]);

    const calls = [];
    const renderer = {
      shadowMap: {},
      outputColorSpace: '',
      setPixelRatio(value) { calls.push(['pixelRatio', value]); },
      setSize(width, height, updateStyle) { calls.push(['size', width, height, updateStyle]); },
      render(targetScene, camera) { calls.push(['render', targetScene, camera]); },
      resetState() { calls.push(['reset']); },
    };
    const pipeline = new BaselineFrameEffectPipeline(renderer, BASELINE_QUALITY_PROFILE);
    pipeline.resize(800, 600, 3);
    const camera = new THREE.PerspectiveCamera();
    pipeline.render(scene, camera);
    pipeline.restore();
    assert.deepEqual(calls[0], ['pixelRatio', 2]);
    assert.deepEqual(calls[1], ['size', 800, 600, false]);
    assert.deepEqual(calls[2], ['render', scene, camera]);
    assert.deepEqual(calls[3], ['reset']);
    pipeline.dispose();
    pipeline.dispose();
    pipeline.render(scene, camera);
    assert.equal(calls.filter(([name]) => name === 'render').length, 1);
  } finally {
    await vite.close();
  }
});

const approvedDecision = '| DEC-120 | 允許平行開發，使用獨立 branch／worktree | boundary | confirmed parallel-development boundary |';
const approvedSpec = `# Visual

- 日期：2026-07-24
- 類型：design
- 狀態：approved
- 任務：TASK-059～TASK-065
- 目標版本：0.8.0

## 版本與平行開發邊界

使用隔離工作區；shared files are integration-owned files.
`;

function taskRow(id, target) {
  return [id, 'fixture', 'in_progress', target, '[spec](spec.md)', 'TASK-053'];
}

test('docs task concurrency accepts only the approved isolated 0.7/0.8 pairing', () => {
  assert.deepEqual(validateTaskConcurrency({
    taskRows: [taskRow('TASK-054', '0.7.0'), taskRow('TASK-060', '0.8.0')],
    decisionContent: approvedDecision,
    activeSpecContents: [approvedSpec],
  }), []);

  assert.match(validateTaskConcurrency({
    taskRows: [taskRow('TASK-054', '0.7.0'), taskRow('TASK-055', '0.7.0')],
    decisionContent: approvedDecision,
    activeSpecContents: [approvedSpec],
  }).join('\n'), /at most one in_progress task for 0\.7\.0/);

  assert.match(validateTaskConcurrency({
    taskRows: [taskRow('TASK-054', '0.7.0'), taskRow('TASK-999', 'next')],
    decisionContent: approvedDecision,
    activeSpecContents: [approvedSpec],
  }).join('\n'), /unknown parallel target next/);

  assert.match(validateTaskConcurrency({
    taskRows: [taskRow('TASK-054', '0.7.0'), taskRow('TASK-060', '0.8.0')],
    decisionContent: '',
    activeSpecContents: [],
  }).join('\n'), /DEC-120 isolation approval/);

  assert.match(validateTaskConcurrency({
    taskRows: [taskRow('TASK-059', '0.8.0'), taskRow('TASK-054', '0.7.0')],
    decisionContent: approvedDecision,
    activeSpecContents: [approvedSpec],
  }).join('\n'), /shared integration task TASK-059/);
});

test('main and scene factory use rendering contracts instead of concrete material or direct render setup', async () => {
  const [mainSource, sceneSource] = await Promise.all([
    readFile(resolve(repoRoot, 'reference/src/3d-viewer/main.ts'), 'utf8'),
    readFile(resolve(repoRoot, 'reference/src/3d-viewer/scene-factory.ts'), 'utf8'),
  ]);
  assert.match(mainSource, /createBaselineRenderingRuntime/);
  assert.match(mainSource, /rendering\.environment\.apply/);
  assert.match(mainSource, /rendering\.framePipeline\.render/);
  assert.doesNotMatch(mainSource, /renderer\.render\(/);
  assert.match(sceneSource, /SceneRenderingDependencies/);
  assert.match(sceneSource, /materials\.get\('safety-glass'\)/);
  assert.match(sceneSource, /visualAssets\.attach/);
  assert.doesNotMatch(
    sceneSource,
    /new THREE\.(?:MeshStandardMaterial|MeshPhysicalMaterial|MeshBasicMaterial|LineBasicMaterial|LineDashedMaterial)/,
  );
});
