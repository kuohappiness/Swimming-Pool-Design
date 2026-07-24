import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import rawViewerModel from '../../generated/viewer-model.json';
import rawConceptContent from '../../generated/concept-content.json';
import { adaptViewerData, formatDegrees, formatElevation } from './model-adapter';
import { createViewerScene, type SelectableInfo } from './scene-factory';
import { setupSelection } from './interactions';
import { createBaselineRenderingRuntime } from './rendering';
import { getViewerScene, viewerScenes } from './scenes';
import {
  AdaptiveFrameTimeMonitor,
  adaptRenderQualityProfile,
  adaptWalkthroughSource,
  CameraModeManager,
  CollisionWorld,
  DesktopInput,
  FixedStepLoop,
  getWalkthroughCapabilityProfile,
  PlayerController,
  SafeSpawnAreaRegistry,
  SafeSpawnRegistry,
  SwimMovement,
  TouchInput,
  UnderwaterEffects,
  WaterVolume,
  WalkMovement,
  WALKTHROUGH_CONFIG,
  type InputAdapter,
} from './walkthrough';
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
const controlsPanel = required<HTMLElement>('.controls-panel');
const informationPanel = required<HTMLElement>('.information-panel');
const sceneNav = required<HTMLElement>('[data-scene-nav]');
const layerList = required<HTMLElement>('[data-layer-list]');
const contentPanel = required<HTMLElement>('[data-concept-content]');
const selectionPanel = required<HTMLElement>('[data-selection-info]');
const objectSelect = required<HTMLSelectElement>('[data-object-select]');
const versionLabel = required<HTMLElement>('[data-model-version]');
const hashLabel = required<HTMLElement>('[data-model-hash]');
const analysisBadge = required<HTMLElement>('[data-analysis-status]');
const compass = required<HTMLElement>('[data-compass]');
const poolCutawayKey = required<HTMLElement>('[data-pool-cutaway-key]');
const walkthroughEntry = required<HTMLElement>('[data-walkthrough-entry]');
const enterWalkthroughButton = required<HTMLButtonElement>('[data-enter-walkthrough]');
const walkthroughHud = required<HTMLElement>('[data-walkthrough-hud]');
const walkthroughArea = required<HTMLElement>('[data-walkthrough-area]');
const walkthroughAreaSelect = required<HTMLSelectElement>('[data-walkthrough-area-select]');
const walkthroughNotice = required<HTMLElement>('[data-walkthrough-notice]');
const walkthroughQuality = required<HTMLElement>('[data-walkthrough-quality]');
const returnPoolsideButton = required<HTMLButtonElement>('[data-return-poolside]');
const returnSafeButton = required<HTMLButtonElement>('[data-return-safe]');
const exitWalkthroughButton = required<HTMLButtonElement>('[data-exit-walkthrough]');
const walkthroughTouch = required<HTMLElement>('[data-walkthrough-touch]');
const touchMoveSurface = required<HTMLElement>('[data-touch-move]');
const touchLookSurface = required<HTMLElement>('[data-touch-look]');
const swimControls = required<HTMLElement>('[data-swim-controls]');
const swimUpButton = required<HTMLButtonElement>('[data-swim-up]');
const swimDownButton = required<HTMLButtonElement>('[data-swim-down]');

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

async function bootstrap() {
const bootstrapStartedAt = performance.now();
try {
  const { model, content } = adaptViewerData(rawViewerModel, rawConceptContent);
  versionLabel.textContent = `MODEL ${model.modelVersion} · REV ${model.revision}`;
  hashLabel.textContent = `${model.modelHash.slice(0, 12)} · CONTENT ${content.contentHash.slice(0, 8)}`;
  analysisBadge.textContent = model.analysis.solar.status === 'current' ? '分析與模型同步' : '分析需重新驗證';
  analysisBadge.dataset.status = model.analysis.solar.status;
  analysisBadge.title = model.analysis.solar.disclaimer;
  compass.setAttribute('data-north-direction', 'lower-right');
  compass.setAttribute('aria-label', `真北指向畫面右下角；建築本地長軸方位 ${model.referenceSystem.localLongAxisBearingFromTrueNorth} 度`);

  if (!supportsWebGL()) {
    walkthroughEntry.hidden = true;
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
    renderer.info.autoReset = false;
    const graphicsContext = renderer.getContext();
    const rendererInfo = graphicsContext.getExtension('WEBGL_debug_renderer_info');
    const graphicsAdapter = String(graphicsContext.getParameter(
      rendererInfo?.UNMASKED_RENDERER_WEBGL ?? graphicsContext.RENDERER,
    ));
    const softwareRenderer = /swiftshader|software|llvmpipe/i.test(graphicsAdapter);
    shell.dataset.graphicsAdapter = graphicsAdapter.slice(0, 160);
    shell.dataset.softwareRenderer = String(softwareRenderer);
    const renderingParameters = new URLSearchParams(location.search);
    const baselineRenderingRequested = renderingParameters.get('rendering') === 'baseline';
    const adaptiveQualityEnabled = renderingParameters.get('adaptive') !== 'off';
    let rendering;
    if (!baselineRenderingRequested) {
      try {
        const {
          createEnhancedRenderingRuntime,
          getEnhancedQualityProfile,
        } = await import('./rendering/enhanced');
        const requestedQuality = renderingParameters.get('quality');
        const initialQuality = requestedQuality === 'high'
          || requestedQuality === 'medium'
          || requestedQuality === 'low'
          ? requestedQuality
          : softwareRenderer
            ? 'low'
            : matchMedia('(pointer: coarse)').matches || innerWidth <= 640
              ? 'medium'
              : 'high';
        const previewQuality = getEnhancedQualityProfile(initialQuality);
        const simulateOptionalEnvironmentFailure =
          renderingParameters.get('simulateOptionalAssetFailure') === 'environment';
        const simulateRequiredMaterialFailure =
          renderingParameters.get('simulateRequiredAssetFailure') === 'material';
        rendering = await createEnhancedRenderingRuntime(
          renderer,
          previewQuality,
          simulateOptionalEnvironmentFailure || simulateRequiredMaterialFailure
            ? {
                ...(simulateOptionalEnvironmentFailure
                  ? {
                      environmentTextureLoader: {
                        load: async () => {
                          throw new TypeError('Simulated optional environment asset failure.');
                        },
                      },
                    }
                  : {}),
                ...(simulateRequiredMaterialFailure
                  ? {
                      materialTextureSourceLoader: {
                        loadTexture: async () => {
                          throw new TypeError('Simulated required material asset failure.');
                        },
                      },
                    }
                  : {}),
              }
            : undefined,
        );
        shell.dataset.renderingMode = 'enhanced';
      } catch (enhancedError) {
        console.error(enhancedError);
        rendering = createBaselineRenderingRuntime(renderer);
        shell.dataset.renderingMode = 'baseline-fallback';
        shell.dataset.renderingDiagnostic = enhancedError instanceof Error
          ? enhancedError.message
          : 'Enhanced rendering could not be created.';
      }
    } else {
      rendering = createBaselineRenderingRuntime(renderer);
      shell.dataset.renderingMode = 'baseline-explicit';
    }
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', '游泳池概念設計 3D 模型。滑鼠拖曳旋轉，右鍵平移，滾輪縮放；鍵盤方向鍵平移，Enter 依序選取構件。');
    canvasHost.prepend(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 240);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = 0.08;
    controls.minDistance = 9;
    controls.maxDistance = 105;
    const defaultMaxPolarAngle = Math.PI * 0.49;
    const cutawayMaxPolarAngle = Math.PI * (2 / 3);
    controls.maxPolarAngle = defaultMaxPolarAngle;
    controls.listenToKeyEvents(window);
    controls.keyPanSpeed = 18;

    const graph = createViewerScene(model, rendering);
    let walkthroughSource: ReturnType<typeof adaptWalkthroughSource> | null = null;
    let collisionWorld: CollisionWorld | null = null;
    let safeSpawns: SafeSpawnRegistry | null = null;
    let areaRegistry: SafeSpawnAreaRegistry | null = null;
    let waterVolume: WaterVolume | null = null;
    try {
      walkthroughSource = adaptWalkthroughSource(model);
      graph.siteRoot.updateWorldMatrix(true, false);
      collisionWorld = new CollisionWorld(
        walkthroughSource,
        graph.siteRoot.matrixWorld,
        WALKTHROUGH_CONFIG,
      );
      safeSpawns = new SafeSpawnRegistry(
        walkthroughSource,
        collisionWorld,
        WALKTHROUGH_CONFIG,
      );
      areaRegistry = new SafeSpawnAreaRegistry(safeSpawns);
      walkthroughAreaSelect.replaceChildren(...areaRegistry.areas.map(
        ({ id, label }) => new Option(label, id),
      ));
      const waterDescriptor = walkthroughSource.waterVolumes[0];
      const poolShell = walkthroughSource.poolShells[0];
      if (!waterDescriptor || !poolShell) {
        throw new TypeError('Walkthrough water volume or pool shell is missing.');
      }
      waterVolume = new WaterVolume(
        waterDescriptor,
        poolShell,
        graph.siteRoot.matrixWorld,
      );
      if (Math.abs(graph.water.surfaceElevation - waterDescriptor.surfaceElevation) > 1e-9) {
        throw new TypeError('Visible and simulation water surfaces are not aligned.');
      }
      shell.dataset.walkthroughAvailable = 'true';
      shell.dataset.collisionWorld = 'capsule-proxies-task-055';
      shell.dataset.safeSpawnCount = String(safeSpawns.ids.length);
      shell.dataset.areaRegistry = areaRegistry.id;
      shell.dataset.waterVolume = waterVolume.id;
      shell.dataset.waterSurfaceElevation = graph.water.surfaceElevation.toFixed(3);
    } catch (walkthroughError) {
      console.error(walkthroughError);
      shell.dataset.walkthroughAvailable = 'false';
      enterWalkthroughButton.disabled = true;
      enterWalkthroughButton.title = walkthroughError instanceof Error
        ? walkthroughError.message
        : '第一人稱漫遊資料無法建立。';
      walkthroughEntry.querySelector('span')!.textContent = '漫遊資料驗證失敗；模型檢視仍可使用';
    }
    shell.dataset.materialRegistry = rendering.materials.id;
    shell.dataset.environmentEffect = rendering.environment.id;
    shell.dataset.frameEffectPipeline = rendering.framePipeline.id;
    shell.dataset.visualAssetAdapter = rendering.visualAssets.id;
    shell.dataset.renderQuality = rendering.quality.id;
    shell.dataset.environmentDiagnostic = rendering.environment.diagnostic ?? 'none';
    shell.dataset.adaptiveQuality = String(adaptiveQualityEnabled);
    shell.dataset.contextRestores = '0';
    shell.dataset.coordinateAdapter = model.referenceSystem.coordinateAdapter.adapterId;
    shell.dataset.siteYToThree = model.referenceSystem.coordinateAdapter.siteY;
    shell.dataset.siteRootScaleZ = String(graph.siteRoot.scale.z);
    shell.dataset.stairSiteBounds = JSON.stringify(model.geometry.stair.bounds);
    shell.dataset.stairSide = model.geometry.stair.bounds.y2 <= model.geometry.pool.bounds.y1 ? 'Y0' : 'INVALID';
    shell.dataset.stairDesign = model.geometry.stair.designIntent;
    shell.dataset.stairStringers = String(model.geometry.stair.stringerCount);
    shell.dataset.toiletEntranceCount = String(model.geometry.l1.toiletEntrances.length);
    shell.dataset.toiletEntranceWidth = `${model.geometry.l1.toiletEntrances[0]?.clearWidth.toFixed(2)} m`;
    shell.dataset.toiletEntranceDoorLeaves = String(model.geometry.l1.toiletEntrances.filter(({ doorLeaf }) => doorLeaf).length);
    shell.dataset.wcCubicleDoorLeaves = String(Object.values(model.geometry.l1.zones).flatMap((zone) => zone.layout?.toiletCubicles ?? []).filter(({ doorLeaf }) => doorLeaf).length);
    shell.dataset.serviceMaterial = model.geometry.l1.serviceWingStyle.materialIntent;
    shell.dataset.selectionOutline = model.viewerPresentation.selectionOutline;
    shell.dataset.glassFacadeMaterialSystem = model.viewerPresentation.glassFacadeMaterialSystem;
    shell.dataset.playgroundMaleWashbasins = String(model.geometry.l1.zones.playgroundMaleToilet.fixtures?.washbasins ?? 0);
    shell.dataset.playgroundMaleUrinals = String(model.geometry.l1.zones.playgroundMaleToilet.fixtures?.urinals ?? 0);
    shell.dataset.playgroundFemaleWashbasins = String(model.geometry.l1.zones.playgroundFemaleToilet.fixtures?.washbasins ?? 0);
    shell.dataset.stair2Design = model.geometry.l2.stairToL3.designIntent;
    shell.dataset.stair2Planters = String(model.geometry.l2.stairToL3.underStairLandscape.planterCount);
    shell.dataset.l2ShowerModule = model.geometry.l2.zones.maleChangingShower.showerModuleSize.join(' × ');
    shell.dataset.l2SupportWcPerGender = String(model.geometry.l2.zones.maleChangingShower.supportFixtures.fixtures.toilets);
    shell.dataset.l2SupportBasinsPerGender = String(model.geometry.l2.zones.maleChangingShower.supportFixtures.fixtures.washbasins);
    shell.dataset.pvReserveArea = String(model.geometry.l3.pvRoofReserve.area);
    shell.dataset.pvCoveragePercent = String(model.geometry.l3.pvRoofReserve.coveragePercent);
    shell.dataset.l1Y0Material = model.geometry.l1.y0ExteriorFacade.materialIntent;
    shell.dataset.l2Y0Material = model.geometry.l2.y0ExteriorFacade.materialIntent;
    shell.dataset.l2SplitAxisY = String(model.geometry.l2.splitAxisY);
    shell.dataset.l2GenderDividerOverlapsY0 = String(
      model.geometry.l2.splitAxisY <= model.geometry.l2.y0ExteriorFacade.bounds.y2,
    );
    shell.dataset.l2DividerSpan = model.geometry.l2.stairChangingDivider.spanX.join('–');
    shell.dataset.l2DividerOpenings = String(model.geometry.l2.stairChangingDivider.openings.length);
    shell.dataset.l2CeilingContinuous = String(model.geometry.l2.ceiling.continuous);
    shell.dataset.l3RoofContinuous = String(model.geometry.l3.roof.continuous);
    shell.dataset.l3MirrorEndGapsFilled = String(model.geometry.l3.mirror.sideWallEndGapsFilled);
    shell.dataset.l3InteriorBatteryObjects = String(model.geometry.l3.energyStorageStrategy.batteryObjectsOnGeneralL3Interior);
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
    const selectionController = setupSelection({
      canvas: renderer.domElement, camera, controls,
      selectables: graph.selectables, objectSelect, onSelect: renderSelection,
    });

    const contentByScene = new Map(content.scenes.map((item) => [item.id, item]));
    const sceneButtons = new Map<string, HTMLButtonElement>();
    const setPoolCutaway = (enabled: boolean) => {
      for (const object of graph.cutaway.hiddenObjects) object.visible = !enabled;
      graph.cutaway.annotationGroup.visible = enabled;
      controls.maxPolarAngle = enabled ? cutawayMaxPolarAngle : defaultMaxPolarAngle;
      poolCutawayKey.hidden = !enabled;
      shell.dataset.poolCutaway = String(enabled);
      rendering.visualAssets.setWalkthroughState?.({
        movementMode: 'walking',
        waterSurfaceElevation: graph.water.surfaceElevation,
        poolCutaway: enabled,
      });
      if (!enabled) {
        required<HTMLElement>('[data-view-controls]').querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((button) => {
          button.dataset.active = 'false';
          button.setAttribute('aria-pressed', 'false');
        });
      }
    };
    const setEnvironment = (environment: ReturnType<typeof getViewerScene>['environment']) => {
      rendering.environment.apply(environment, graph);
      shell.dataset.environment = environment;
    };

    const applyScene = (sceneId: string) => {
      setPoolCutaway(false);
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

    type ViewMode = 'perspective' | 'top' | 'elevation' | 'opposite' | 'pool-cutaway';
    const frameModel = (mode: ViewMode) => {
      if (mode === 'pool-cutaway') {
        setPoolCutaway(true);
        graph.siteRoot.updateWorldMatrix(true, false);
        const poolBounds = model.geometry.pool.bounds;
        const position = graph.siteRoot.localToWorld(new THREE.Vector3(
          (poolBounds.x1 + poolBounds.x2) / 2,
          4.2,
          -34,
        ));
        const target = graph.siteRoot.localToWorld(new THREE.Vector3(
          (poolBounds.x1 + poolBounds.x2) / 2,
          -0.48,
          (poolBounds.y1 + poolBounds.y2) / 2,
        ));
        camera.position.copy(position);
        camera.fov = 32;
        camera.updateProjectionMatrix();
        controls.target.copy(target);
        controls.update();
      } else {
        setPoolCutaway(false);
        camera.fov = 38;
        camera.updateProjectionMatrix();
        if (mode === 'elevation' || mode === 'opposite') {
          graph.siteRoot.updateWorldMatrix(true, false);
          const centreX = model.geometry.site.length / 2;
          const centreY = model.geometry.site.width / 2;
          const outsideY = mode === 'elevation' ? -38 : model.geometry.site.width + 38;
          camera.position.copy(graph.siteRoot.localToWorld(new THREE.Vector3(centreX, 9, outsideY)));
          controls.target.copy(graph.siteRoot.localToWorld(new THREE.Vector3(centreX, 3.2, centreY)));
          controls.update();
        } else {
          const views = {
            perspective: { position: [34, 25, 30], target: [0, 2.4, 0] },
            top: { position: [0, 58, 0.01], target: [0, 0, 0] },
          }[mode];
          camera.position.set(...views.position as [number, number, number]);
          controls.target.set(...views.target as [number, number, number]);
          controls.update();
        }
      }
      required<HTMLElement>('[data-view-controls]').querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((button) => {
        const active = button.dataset.view === mode;
        button.dataset.active = String(active);
        button.setAttribute('aria-pressed', String(active));
      });
    };
    required<HTMLElement>('[data-view-controls]').addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-view]');
      if (button) frameModel(button.dataset.view as ViewMode);
    });
    required<HTMLButtonElement>('[data-reset-view]').addEventListener('click', () => applyScene(shell.dataset.scene ?? 'overview'));

    interface InspectSnapshot {
      cameraPosition: THREE.Vector3;
      cameraTarget: THREE.Vector3;
      fov: number;
      sceneId: string;
      layers: Array<[string, boolean]>;
      cutaway: boolean;
      activeView: string | null;
      selectionIndex: number;
      controlsScrollTop: number;
      informationScrollTop: number;
      focusElement: HTMLElement | null;
    }

    const desktopInput = new DesktopInput({ canvas: renderer.domElement });
    const touchInput = new TouchInput({
      moveSurface: touchMoveSurface,
      lookSurface: touchLookSurface,
      ascendButton: swimUpButton,
      descendButton: swimDownButton,
    });
    let activeInput: InputAdapter = desktopInput;
    const playerController = new PlayerController(WALKTHROUGH_CONFIG);
    const walkMovement = collisionWorld && safeSpawns
      ? new WalkMovement(collisionWorld, safeSpawns, WALKTHROUGH_CONFIG)
      : null;
    const swimMovement = walkMovement && collisionWorld && waterVolume && safeSpawns
      ? new SwimMovement(
          walkMovement,
          collisionWorld,
          waterVolume,
          safeSpawns,
          WALKTHROUGH_CONFIG,
        )
      : null;
    if (swimMovement) playerController.setMovementStrategy(swimMovement);
    else if (walkMovement) playerController.setMovementStrategy(walkMovement);
    const fixedStepLoop = new FixedStepLoop(
      WALKTHROUGH_CONFIG.physics.fixedStepSeconds,
      WALKTHROUGH_CONFIG.physics.maxFrameDeltaSeconds,
      WALKTHROUGH_CONFIG.physics.maxSubsteps,
    );
    const underwaterEffects = new UnderwaterEffects(shell, graph.scene, {
      quality: rendering.quality.id === 'low' ? 'low' : 'high',
      reducedMotion,
    });
    shell.dataset.reducedMotion = String(reducedMotion);
    const frameTimeMonitor = new AdaptiveFrameTimeMonitor(rendering.quality.id);
    walkthroughQuality.textContent = rendering.quality.id.toUpperCase();
    shell.dataset.performanceProfile = rendering.quality.id;

    const resolveEntrancePose = () => {
      if (!walkthroughSource || !safeSpawns) throw new TypeError('Walkthrough source is unavailable.');
      const spawn = walkthroughSource.spawns.find(({ id }) => id === 'entrance');
      if (!spawn) throw new TypeError('Walkthrough entrance spawn is missing.');
      const entity = walkthroughSource.entities[spawn.entityId];
      if (!entity) throw new TypeError(`Walkthrough spawn entity ${spawn.entityId} is missing.`);
      const resolvedSpawn = safeSpawns.get('entrance');
      const position = new THREE.Vector3(
        resolvedSpawn.position.x,
        resolvedSpawn.position.y,
        resolvedSpawn.position.z,
      );
      graph.siteRoot.updateWorldMatrix(true, false);
      const target = graph.siteRoot.localToWorld(new THREE.Vector3(
        (entity.bounds.x1 + entity.bounds.x2) / 2,
        resolvedSpawn.position.y,
        (entity.bounds.y1 + entity.bounds.y2) / 2,
      ));
      return { position, target };
    };

    const showWalkthroughArea = (areaId: Parameters<SafeSpawnAreaRegistry['get']>[0]) => {
      if (!areaRegistry) return;
      const area = areaRegistry.get(areaId);
      walkthroughArea.textContent = area.label;
      walkthroughAreaSelect.value = area.id;
      shell.dataset.walkthroughArea = area.id;
    };

    const announceWalkthrough = (message: string) => {
      walkthroughNotice.textContent = '';
      requestAnimationFrame(() => {
        walkthroughNotice.textContent = message;
      });
    };

    const cameraModeManager = new CameraModeManager<InspectSnapshot>({
      captureInspectState: () => ({
        cameraPosition: camera.position.clone(),
        cameraTarget: controls.target.clone(),
        fov: camera.fov,
        sceneId: shell.dataset.scene ?? 'overview',
        layers: [...graph.layerGroups].map(([id, group]) => [id, group.visible]),
        cutaway: shell.dataset.poolCutaway === 'true',
        activeView: required<HTMLElement>('[data-view-controls]')
          .querySelector<HTMLButtonElement>('button[data-active="true"]')?.dataset.view ?? null,
        selectionIndex: selectionController.selectedIndex,
        controlsScrollTop: controlsPanel.scrollTop,
        informationScrollTop: informationPanel.scrollTop,
        focusElement: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      }),
      enterWalkthrough: () => {
        if (!swimMovement) throw new TypeError('Walkthrough movement environment is unavailable.');
        const { position, target } = resolveEntrancePose();
        setPoolCutaway(false);
        selectionController.suspend();
        controls.enabled = false;
        controls.stopListenToKeyEvents();
        fixedStepLoop.reset();
        camera.position.copy(position);
        camera.fov = 72;
        camera.updateProjectionMatrix();
        camera.rotation.order = 'YXZ';
        camera.lookAt(target);
        playerController.setPose(
          { x: position.x, y: position.y, z: position.z },
          camera.rotation.y,
          camera.rotation.x,
        );
        playerController.state.grounded = true;
        showWalkthroughArea('entrance');
        walkthroughNotice.textContent = '';
        returnPoolsideButton.hidden = true;
        swimControls.hidden = true;
        // Hybrid laptops often expose touch points while the active pointer is
        // still a mouse. Prefer the actual coarse-pointer media query, with
        // viewport width as the mobile fallback.
        const useTouch = matchMedia('(pointer: coarse)').matches || innerWidth <= 900;
        activeInput = useTouch ? touchInput : desktopInput;
        activeInput.start();
        shell.dataset.walkthroughInput = activeInput.id;
        walkthroughTouch.hidden = !useTouch;
        walkthroughTouch.dataset.active = String(useTouch);
        required<HTMLElement>('[data-walkthrough-input-hint]').textContent = useTouch
          ? '左側移動 · 右側環視 · 按鈕退出'
          : 'WASD 移動 · 滑鼠環視 · Esc 退出';
        walkthroughEntry.hidden = true;
        walkthroughHud.hidden = false;
        renderer.domElement.focus();
      },
      restoreInspectState: (snapshot) => {
        activeInput.stop();
        fixedStepLoop.reset();
        walkthroughTouch.hidden = true;
        walkthroughTouch.dataset.active = 'false';
        walkthroughHud.hidden = true;
        walkthroughNotice.textContent = '';
        returnPoolsideButton.hidden = true;
        swimControls.hidden = true;
        underwaterEffects.update('walking');
        rendering.visualAssets.setWalkthroughState?.({
          movementMode: 'walking',
          waterSurfaceElevation: graph.water.surfaceElevation,
          poolCutaway: snapshot.cutaway,
        });
        walkthroughEntry.hidden = false;
        for (const [id, visible] of snapshot.layers) {
          const group = graph.layerGroups.get(id);
          if (group) group.visible = visible;
          const input = layerInputs.get(id);
          if (input) input.checked = visible;
        }
        setPoolCutaway(snapshot.cutaway);
        camera.position.copy(snapshot.cameraPosition);
        camera.fov = snapshot.fov;
        camera.updateProjectionMatrix();
        controls.target.copy(snapshot.cameraTarget);
        controls.enabled = true;
        controls.listenToKeyEvents(window);
        controls.update();
        shell.dataset.scene = snapshot.sceneId;
        for (const [id, button] of sceneButtons) {
          const active = id === snapshot.sceneId;
          button.dataset.active = String(active);
          button.setAttribute('aria-pressed', String(active));
        }
        required<HTMLElement>('[data-view-controls]').querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((button) => {
          const active = button.dataset.view === snapshot.activeView;
          button.dataset.active = String(active);
          button.setAttribute('aria-pressed', String(active));
        });
        selectionController.resume();
        if (snapshot.selectionIndex >= 0) selectionController.selectIndex(snapshot.selectionIndex);
        controlsPanel.scrollTop = snapshot.controlsScrollTop;
        informationPanel.scrollTop = snapshot.informationScrollTop;
        history.replaceState(null, '', `#${snapshot.sceneId}`);
        snapshot.focusElement?.focus();
      },
      onStateChange: (state) => {
        shell.dataset.cameraMode = state;
        shell.setAttribute('aria-busy', String(state === 'entering' || state === 'exiting'));
      },
    });
    shell.dataset.cameraMode = 'inspect';

    const enterWalkthrough = async () => {
      if (!walkthroughSource) return;
      try {
        await cameraModeManager.enter();
      } catch (walkthroughError) {
        console.error(walkthroughError);
        errorPanel.hidden = false;
        errorPanel.textContent = walkthroughError instanceof Error
          ? walkthroughError.message
          : '第一人稱漫遊無法啟動。';
      }
    };
    enterWalkthroughButton.addEventListener('click', enterWalkthrough);
    exitWalkthroughButton.addEventListener('click', () => {
      void cameraModeManager.exit();
    });
    returnSafeButton.addEventListener('click', () => {
      if (cameraModeManager.state !== 'walkthrough' || !walkMovement) return;
      activeInput.reset();
      const spawn = walkMovement.recoverToNearest(playerController.state);
      showWalkthroughArea(spawn.id);
      announceWalkthrough(`已返回${areaRegistry?.get(spawn.id).label ?? '安全點'}`);
    });
    returnPoolsideButton.addEventListener('click', () => {
      if (cameraModeManager.state !== 'walkthrough' || !swimMovement) return;
      activeInput.reset();
      if (!swimMovement.returnToPoolside(playerController.state)) return;
      showWalkthroughArea('l1-pool-deck');
      announceWalkthrough('已返回一樓池畔');
      underwaterEffects.update(playerController.state.movementMode);
      rendering.visualAssets.setWalkthroughState?.({
        movementMode: playerController.state.movementMode,
        waterSurfaceElevation: graph.water.surfaceElevation,
        poolCutaway: false,
      });
    });
    walkthroughAreaSelect.addEventListener('change', () => {
      if (cameraModeManager.state !== 'walkthrough' || !areaRegistry) return;
      activeInput.reset();
      const area = areaRegistry.activate(
        playerController.state,
        walkthroughAreaSelect.value as Parameters<SafeSpawnAreaRegistry['get']>[0],
      );
      showWalkthroughArea(area.id);
      underwaterEffects.update(playerController.state.movementMode);
      announceWalkthrough(`已跳至${area.label}`);
    });

    const applyPerformanceTier = (tier: 'high' | 'medium' | 'low') => {
      const profile = adaptRenderQualityProfile(rendering.quality, tier);
      const capability = getWalkthroughCapabilityProfile(tier, reducedMotion);
      rendering.setQuality(profile);
      renderer.shadowMap.enabled = capability.shadows;
      controls.enableDamping = capability.cameraMotion;
      underwaterEffects.setQuality(capability.underwaterEffect === 'essential' ? 'low' : 'high');
      walkthroughQuality.textContent = tier.toUpperCase();
      shell.dataset.performanceProfile = tier;
      shell.dataset.cameraMotion = String(capability.cameraMotion);
      shell.dataset.underwaterEffect = capability.underwaterEffect;
    };
    applyPerformanceTier(rendering.quality.id);

    const resize = () => {
      const rect = canvasHost.getBoundingClientRect();
      rendering.framePipeline.resize(
        rect.width,
        rect.height,
        Math.min(devicePixelRatio, rendering.quality.pixelRatioCap),
      );
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvasHost);
    resize();
    const initialId = location.hash.slice(1);
    applyScene(viewerScenes.some((scene) => scene.id === initialId) ? initialId : 'overview');
    const shaderCompileStartedAt = performance.now();
    await renderer.compileAsync(graph.scene, camera);
    shell.dataset.shaderCompileMs = (performance.now() - shaderCompileStartedAt).toFixed(2);
    shell.dataset.shaderPrograms = String(renderer.info.programs?.length ?? 0);
    shell.dataset.renderingInitMs = (performance.now() - bootstrapStartedAt).toFixed(2);
    let previousFrameTime = performance.now();
    let renderedFrames = 0;
    renderer.setAnimationLoop(() => {
      const currentFrameTime = performance.now();
      const frameDelta = (currentFrameTime - previousFrameTime) / 1000;
      previousFrameTime = currentFrameTime;
      const degradedTier = adaptiveQualityEnabled
        ? frameTimeMonitor.observe(frameDelta * 1000)
        : null;
      if (degradedTier) {
        applyPerformanceTier(degradedTier);
        resize();
        announceWalkthrough(`畫質已調整為 ${degradedTier.toUpperCase()}，移動與碰撞維持不變`);
      }
      renderedFrames += 1;
      if (cameraModeManager.state === 'walkthrough') {
        const intent = activeInput.readIntent();
        if (intent.exitRequested) {
          void cameraModeManager.exit();
        } else {
          let firstStep = true;
          fixedStepLoop.advance(frameDelta, (stepSeconds) => {
            playerController.step({
              ...intent,
              lookYaw: firstStep ? intent.lookYaw : 0,
              lookPitch: firstStep ? intent.lookPitch : 0,
            }, stepSeconds);
            firstStep = false;
          });
          const player = playerController.state;
          camera.position.set(player.position.x, player.position.y, player.position.z);
          camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
          shell.dataset.movementMode = player.movementMode;
          shell.dataset.playerGrounded = String(player.grounded);
          const swimming = player.movementMode === 'swimming-surface'
            || player.movementMode === 'swimming-underwater';
          returnPoolsideButton.hidden = !swimming;
          swimControls.hidden = !swimming || activeInput !== touchInput;
          underwaterEffects.update(player.movementMode);
          rendering.visualAssets.setWalkthroughState?.({
            movementMode: player.movementMode,
            waterSurfaceElevation: graph.water.surfaceElevation,
            poolCutaway: false,
          });
          if (collisionWorld) {
            const sitePosition = collisionWorld.worldPointToSite(player.position);
            shell.dataset.playerSitePosition = [
              sitePosition.x.toFixed(3),
              (sitePosition.y - WALKTHROUGH_CONFIG.player.eyeHeight).toFixed(3),
              sitePosition.z.toFixed(3),
            ].join(',');
          }
          if (areaRegistry) {
            const area = areaRegistry.nearest(player.position);
            if (area.id !== shell.dataset.walkthroughArea) showWalkthroughArea(area.id);
          }
        }
      } else {
        controls.update();
      }
      renderer.info.reset();
      rendering.framePipeline.render(graph.scene, camera);
      if (renderedFrames % 30 === 0) {
        const statistics = frameTimeMonitor.statistics();
        shell.dataset.frameAverageMs = statistics.averageMilliseconds.toFixed(2);
        shell.dataset.frameP95Ms = statistics.p95Milliseconds.toFixed(2);
        shell.dataset.frameSamples = String(statistics.samples);
        shell.dataset.drawCalls = String(renderer.info.render.calls);
        shell.dataset.triangles = String(renderer.info.render.triangles);
        shell.dataset.lines = String(renderer.info.render.lines);
        shell.dataset.geometries = String(renderer.info.memory.geometries);
        shell.dataset.textures = String(renderer.info.memory.textures);
        shell.dataset.shaderPrograms = String(renderer.info.programs?.length ?? 0);
      }
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      rendering.framePipeline.restore();
      shell.dataset.contextRestores = String(Number(shell.dataset.contextRestores ?? '0') + 1);
    });
    window.addEventListener('pagehide', () => {
      void cameraModeManager.dispose();
      desktopInput.dispose();
      touchInput.dispose();
      selectionController.dispose();
      underwaterEffects.dispose();
      rendering.dispose();
    }, { once: true });

    loading.hidden = true;
    shell.dataset.viewerReady = 'true';
    shell.dataset.modelHash = model.modelHash;
    shell.dataset.l3Rotation = formatDegrees(model.geometry.l3.planRotation.value);
    shell.dataset.mirrorLean = formatDegrees(model.geometry.l3.mirror.leanFromVertical.value);
    shell.dataset.l2Elevation = formatElevation(model.geometry.l2.baseElevation);
    shell.dataset.l3Elevation = formatElevation(model.geometry.l3.baseElevation);
    shell.dataset.poolDeckElevation = formatElevation(model.geometry.pool.deckElevation.value);
  }
} catch (error) {
  console.error(error);
  showFailure(error);
}
}

void bootstrap();
