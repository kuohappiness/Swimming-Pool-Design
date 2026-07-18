import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import rawViewerModel from '../../generated/viewer-model.json';
import rawConceptContent from '../../generated/concept-content.json';
import { adaptViewerData, formatDegrees, formatElevation } from './model-adapter';
import { createViewerScene, type SelectableInfo } from './scene-factory';
import { setupSelection } from './interactions';
import { getViewerScene, viewerScenes, type EnvironmentId } from './scenes';
import './styles.css';

const required = <T extends Element>(selector: string) => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new TypeError(`Viewer element is missing: ${selector}`);
  return element;
};

const shell = required<HTMLElement>('[data-viewer-shell]');
const canvasHost = required<HTMLElement>('[data-canvas-host]');
const fallback = required<HTMLElement>('[data-webgl-fallback]');
const loading = required<HTMLElement>('[data-loading]');
const errorPanel = required<HTMLElement>('[data-error]');
const sceneNav = required<HTMLElement>('[data-scene-nav]');
const layerList = required<HTMLElement>('[data-layer-list]');
const contentPanel = required<HTMLElement>('[data-concept-content]');
const selectionPanel = required<HTMLElement>('[data-selection-info]');
const objectSelect = required<HTMLSelectElement>('[data-object-select]');
const versionLabel = required<HTMLElement>('[data-model-version]');
const hashLabel = required<HTMLElement>('[data-model-hash]');
const analysisBadge = required<HTMLElement>('[data-analysis-status]');
const compass = required<HTMLElement>('[data-compass]');

function showFailure(error: unknown) {
  loading.hidden = true;
  fallback.hidden = false;
  errorPanel.hidden = false;
  errorPanel.textContent = error instanceof Error ? error.message : '3D Viewer 無法載入。';
  shell.dataset.viewerReady = 'fallback';
}

function supportsWebGL() {
  if (new URLSearchParams(location.search).has('forceFallback')) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

try {
  const { model, content } = adaptViewerData(rawViewerModel, rawConceptContent);
  versionLabel.textContent = `MODEL ${model.modelVersion} · REV ${model.revision}`;
  hashLabel.textContent = `${model.modelHash.slice(0, 12)} · CONTENT ${content.contentHash.slice(0, 8)}`;
  analysisBadge.textContent = model.analysis.solar.status === 'current' ? '分析與模型同步' : '分析需重新驗證';
  analysisBadge.dataset.status = model.analysis.solar.status;
  analysisBadge.title = model.analysis.solar.disclaimer;
  compass.style.setProperty('--bearing', `${model.referenceSystem.localLongAxisBearingFromTrueNorth}deg`);
  compass.setAttribute('aria-label', `真北；建築本地長軸方位 ${model.referenceSystem.localLongAxisBearingFromTrueNorth} 度`);

  if (!supportsWebGL()) {
    const renderFallbackContent = (sceneId: string) => {
      const sceneContent = content.scenes.find((scene) => scene.id === sceneId);
      if (!sceneContent) return;
      contentPanel.innerHTML = sceneContent.html;
      sceneNav.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        const active = button.dataset.sceneId === sceneId;
        button.dataset.active = String(active);
        button.setAttribute('aria-pressed', String(active));
      });
      shell.dataset.scene = sceneId;
    };
    for (const sceneContent of content.scenes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = sceneContent.label;
      button.dataset.sceneId = sceneContent.id;
      button.addEventListener('click', () => renderFallbackContent(sceneContent.id));
      sceneNav.append(button);
    }
    layerList.innerHTML = '<p class="fallback-layer-note">靜態模式不提供模型圖層；狀態與限制仍保留於右側理念內容。</p>';
    objectSelect.replaceChildren(new Option('WebGL 靜態模式', ''));
    objectSelect.disabled = true;
    renderFallbackContent('overview');
    loading.hidden = true;
    fallback.hidden = false;
    shell.dataset.viewerReady = 'fallback';
  } else {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', '游泳池概念設計 3D 模型。滑鼠拖曳旋轉，右鍵平移，滾輪縮放；鍵盤方向鍵平移，Enter 依序選取構件。');
    canvasHost.prepend(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 240);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.dampingFactor = 0.08;
    controls.minDistance = 9;
    controls.maxDistance = 105;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.listenToKeyEvents(window);
    controls.keyPanSpeed = 18;

    const graph = createViewerScene(model);
    const layerInputs = new Map<string, HTMLInputElement>();
    for (const modelLayer of model.layers) {
      const label = document.createElement('label');
      label.className = 'layer-toggle';
      label.innerHTML = `<input type="checkbox" value="${modelLayer.id}"><span>${modelLayer.label}</span><i data-status="${modelLayer.status}">${modelLayer.status}</i>`;
      const input = label.querySelector('input')!;
      input.addEventListener('change', () => {
        const group = graph.layerGroups.get(modelLayer.id);
        if (group) group.visible = input.checked;
      });
      layerInputs.set(modelLayer.id, input);
      layerList.append(label);
    }

    const renderSelection = (selection: SelectableInfo) => {
      selectionPanel.innerHTML = `
        <div class="selection-heading"><span class="status-dot" data-status="${selection.status}"></span><strong>${selection.entityId}</strong></div>
        <h3>${selection.label}</h3>
        <p>${selection.description}</p>
        ${selection.openItemId ? `<a href="../../docs/04_DECISIONS_AND_OPEN_ITEMS.md#${selection.openItemId.toLowerCase()}">${selection.openItemId} · 尚待確認</a>` : ''}`;
    };
    setupSelection({
      canvas: renderer.domElement, camera, controls, scene: graph.scene,
      selectables: graph.selectables, objectSelect, onSelect: renderSelection,
    });

    const contentByScene = new Map(content.scenes.map((item) => [item.id, item]));
    const sceneButtons = new Map<string, HTMLButtonElement>();
    const setEnvironment = (environment: EnvironmentId) => {
      const settings = {
        day: { background: 0xe9eef0, fog: 0xe9eef0, sun: 3.4, ambient: 2.2, sunPosition: [-18, 32, 22] },
        'winter-light': { background: 0xe8edf2, fog: 0xe8edf2, sun: 4.2, ambient: 1.7, sunPosition: [-24, 11, 9] },
        rain: { background: 0x9aaab2, fog: 0x9aaab2, sun: 1.2, ambient: 2.6, sunPosition: [-8, 18, 12] },
        soft: { background: 0xe8e3da, fog: 0xe8e3da, sun: 2.5, ambient: 2.4, sunPosition: [12, 25, -14] },
      }[environment];
      graph.scene.background = new THREE.Color(settings.background);
      graph.scene.fog = new THREE.Fog(settings.fog, 65, 135);
      graph.lights.sun.intensity = settings.sun;
      graph.lights.ambient.intensity = settings.ambient;
      graph.lights.sun.position.set(...settings.sunPosition as [number, number, number]);
      shell.dataset.environment = environment;
    };

    const applyScene = (sceneId: string) => {
      const config = getViewerScene(sceneId);
      const visibleLayers = new Set(config.layers);
      for (const [id, group] of graph.layerGroups) {
        group.visible = visibleLayers.has(id);
        const input = layerInputs.get(id);
        if (input) input.checked = group.visible;
      }
      camera.position.set(...config.camera.position);
      camera.fov = config.camera.fov;
      camera.updateProjectionMatrix();
      controls.target.set(...config.camera.target);
      controls.update();
      setEnvironment(config.environment);
      for (const [id, button] of sceneButtons) {
        const active = id === sceneId;
        button.dataset.active = String(active);
        button.setAttribute('aria-pressed', String(active));
      }
      const sceneContent = contentByScene.get(sceneId);
      if (!sceneContent) throw new TypeError(`理念內容缺少場景 ${sceneId}`);
      contentPanel.innerHTML = sceneContent.html;
      contentPanel.scrollTop = 0;
      shell.dataset.scene = sceneId;
      history.replaceState(null, '', `#${sceneId}`);
    };

    for (const config of viewerScenes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = config.label;
      button.addEventListener('click', () => applyScene(config.id));
      sceneButtons.set(config.id, button);
      sceneNav.append(button);
    }

    const frameModel = (mode: 'perspective' | 'top' | 'elevation' | 'opposite') => {
      const views = {
        perspective: { position: [34, 25, 30], target: [0, 2.4, 0] },
        top: { position: [0, 58, 0.01], target: [0, 0, 0] },
        elevation: { position: [0, 9, 52], target: [0, 3.2, 0] },
        opposite: { position: [0, 9, -52], target: [0, 3.2, 0] },
      }[mode];
      camera.position.set(...views.position as [number, number, number]);
      controls.target.set(...views.target as [number, number, number]);
      controls.update();
    };
    required<HTMLElement>('[data-view-controls]').addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-view]');
      if (button) frameModel(button.dataset.view as 'perspective' | 'top' | 'elevation' | 'opposite');
    });
    required<HTMLButtonElement>('[data-reset-view]').addEventListener('click', () => applyScene(shell.dataset.scene ?? 'overview'));

    const resize = () => {
      const rect = canvasHost.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvasHost);
    resize();
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(graph.scene, camera);
    });

    const initialId = location.hash.slice(1);
    applyScene(viewerScenes.some((scene) => scene.id === initialId) ? initialId : 'overview');
    loading.hidden = true;
    shell.dataset.viewerReady = 'true';
    shell.dataset.modelHash = model.modelHash;
    shell.dataset.l2Rotation = formatDegrees(model.geometry.l2.planRotation.value);
    shell.dataset.mirrorLean = formatDegrees(model.geometry.mirror.leanFromVertical.value);
    shell.dataset.l2Elevation = formatElevation(model.geometry.l2.baseElevation);
  }
} catch (error) {
  console.error(error);
  showFailure(error);
}
