import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import rawViewerModel from '../../generated/viewer-model.json';
import rawConceptContent from '../../generated/concept-content.json';
import { adaptViewerData, formatDegrees, formatElevation } from './model-adapter';
import { getViewerPoolBasinShape, getViewerPoolHallShape } from './pool-state';
import { createViewerScene, type SelectableInfo } from './scene-factory';
import { deriveViewerOrientation } from './orientation';
import { setupSelection } from './interactions';
import { createBaselineRenderingRuntime, type ViewerRenderingRuntime } from './rendering';
import {
  BENCHMARK_FRAMES,
  BENCHMARK_TIME_LIMIT_MILLISECONDS,
  effectivePixelRatio,
  estimateDisplayIntervalMilliseconds,
  QUALITY_CHOICES,
  QualitySession,
  renderQualityProfileForTier,
  summarizeBenchmarkRun,
  type RealismTier,
  type ShedStep,
} from './rendering/performance';
import { BASELINE_QUALITY_PROFILE, type RenderQualityProfile, type RenderQualityTier } from './rendering/quality-profile';
import { getViewerScene, viewerScenes } from './scenes';
import { LightingControl } from './lighting-control';
import {
  lightingStateFromPreset,
  readLightingParameters,
  sameLightingState,
  siteMomentAt,
  writeLightingParameters,
  type LightingState,
} from './rendering/lighting/lighting-state';
import { deriveShadowFocus, toSceneLighting } from './rendering/lighting/scene-lighting';
import { formatSolarMoment } from './rendering/lighting/solar-moment';
import { computeSunLighting, describeSunLighting } from './rendering/lighting/sun-lighting';
import { FrameStatistics } from './frame-statistics';
import {
  adaptRenderQualityProfile,
  advancePlayerFrame,
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
/** 陰影範圍比基地多留的距離：旋轉後超出基地的 3F、雨庇，以及落在基地外地面上的影子。 */
const SHADOW_FOCUS_MARGIN_METRES = 8;
/** 拖動時刻時，水面倒影取樣最快多久重拍一次。 */
const REFLECTION_REFRESH_INTERVAL_MILLISECONDS = 160;
// The public site ships no Markdown, so open items link to the repository copy.
const BACKLOG_URL = 'https://github.com/kuohappiness/Swimming-Pool-Design/blob/main/docs/backlog.md';

let viewerCleanup: (() => void | Promise<void>) | null = null;

export async function destroyViewer(): Promise<void> {
  const cleanup = viewerCleanup;
  viewerCleanup = null;
  await cleanup?.();
}

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
const selectionPanel = required<HTMLElement>('[data-selection-info]');
const objectSelect = required<HTMLSelectElement>('[data-object-select]');
const orientationCue = required<HTMLElement>('[data-orientation-cue]');
const poolCutawayKey = required<HTMLElement>('[data-pool-cutaway-key]');
const walkthroughEntry = required<HTMLElement>('[data-walkthrough-entry]');
const enterWalkthroughButton = required<HTMLButtonElement>('[data-enter-walkthrough]');
const walkthroughHud = required<HTMLElement>('[data-walkthrough-hud]');
const walkthroughArea = required<HTMLElement>('[data-walkthrough-area]');
const walkthroughAreaSelect = required<HTMLSelectElement>('[data-walkthrough-area-select]');
const walkthroughNotice = required<HTMLElement>('[data-walkthrough-notice]');
const walkthroughQuality = required<HTMLElement>('[data-walkthrough-quality]');
const qualitySelect = required<HTMLSelectElement>('[data-quality-select]');
const qualityStatus = required<HTMLElement>('[data-quality-status]');
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

/**
 * 載入期間記錄 requestAnimationFrame 的間隔，用來估計螢幕更新率（見 display-interval.ts）。
 * 回傳的函式停止記錄並交出估計值。
 */
function sampleDisplayInterval() {
  const intervals: number[] = [];
  let previous: number | null = null;
  let handle = requestAnimationFrame(function tick(time) {
    if (previous !== null) intervals.push(time - previous);
    previous = time;
    handle = requestAnimationFrame(tick);
  });
  return () => {
    cancelAnimationFrame(handle);
    return estimateDisplayIntervalMilliseconds(intervals);
  };
}

function qualityStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function bootstrap() {
const bootstrapStartedAt = performance.now();
const finishDisplayIntervalSampling = sampleDisplayInterval();
try {
  const { model } = adaptViewerData(rawViewerModel, rawConceptContent);
  const orientation = deriveViewerOrientation(model.referenceSystem);
  const northPlanDirection = orientation.northPlanDirection;
  const northGlyph = {
    'upper-left': '↖',
    'upper-right': '↗',
    'lower-left': '↙',
    'lower-right': '↘',
  }[northPlanDirection];
  const northDirectionLabel = {
    'upper-left': '畫面左上',
    'upper-right': '畫面右上',
    'lower-left': '畫面左下',
    'lower-right': '畫面右下',
  }[northPlanDirection];
  orientationCue.setAttribute('data-north-direction', northPlanDirection);
  orientationCue.setAttribute(
    'aria-label',
    `真北 N 指向${northDirectionLabel}；基地 +X 方位 ${orientation.bearingFromTrueNorth} 度`,
  );
  required<HTMLElement>('[data-orientation-arrow]').textContent = northGlyph;

  if (!supportsWebGL()) {
    finishDisplayIntervalSampling();
    qualitySelect.replaceChildren(new Option('WebGL 靜態模式', ''));
    qualityStatus.textContent = '靜態模式沒有畫質選項。';
    walkthroughEntry.hidden = true;
    const renderFallbackContent = (sceneId: string) => {
      sceneNav.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        const active = button.dataset.sceneId === sceneId;
        button.dataset.active = String(active);
        button.setAttribute('aria-pressed', String(active));
      });
      shell.dataset.scene = sceneId;
    };
    for (const sceneConfig of viewerScenes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = sceneConfig.label;
      button.dataset.sceneId = sceneConfig.id;
      button.addEventListener('click', () => renderFallbackContent(sceneConfig.id));
      sceneNav.append(button);
    }
    layerList.innerHTML = '<p class="fallback-layer-note">靜態模式不提供模型圖層。</p>';
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
    const qualitySession = new QualitySession({
      requested: renderingParameters.get('quality'),
      softwareRenderer,
      deviceClass: matchMedia('(pointer: coarse)').matches || innerWidth <= 640 ? 'mobile' : 'desktop',
      adaptive: renderingParameters.get('adaptive') !== 'off',
      storage: qualityStorage(),
      // 調節器在解析度與級別之間能單獨調的效果：目前只有水面平面倒影的解析度，
      // 而且只有寫實水面才有平面倒影。
      availableShedSteps: baselineRenderingRequested || renderingParameters.get('water') === 'legacy'
        ? []
        : ['water-reflection-resolution'],
    });
    // 繪圖管線內部仍以舊的三級決定材質與貼圖版本；四級的設定由 renderQualityProfileForTier 蓋上去。
    let pipelineProfileFor: (tier: RenderQualityTier) => RenderQualityProfile =
      (tier) => adaptRenderQualityProfile(BASELINE_QUALITY_PROFILE, tier);
    let rendering: ViewerRenderingRuntime;
    if (!baselineRenderingRequested) {
      try {
        const {
          createEnhancedRenderingRuntime,
          getEnhancedQualityProfile,
        } = await import('./rendering/enhanced');
        const previewQuality = renderQualityProfileForTier(
          getEnhancedQualityProfile(qualitySession.tier.legacyTier),
          qualitySession.tier,
        );
        const simulateOptionalEnvironmentFailure =
          renderingParameters.get('simulateOptionalAssetFailure') === 'environment';
        const simulateRequiredMaterialFailure =
          renderingParameters.get('simulateRequiredAssetFailure') === 'material';
        rendering = await createEnhancedRenderingRuntime(
          renderer,
          previewQuality,
          {
            // water=legacy 保留原本的水，方便對照與排查。
            ...(renderingParameters.get('water') === 'legacy'
              ? {}
              : { poolBasin: getViewerPoolBasinShape(model), poolHall: getViewerPoolHallShape(model) }),
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
          },
        );
        pipelineProfileFor = getEnhancedQualityProfile;
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
    // 鏡頭的方向鍵平移聽的是整個視窗，而且會取消按鍵的預設動作。
    // 焦點在滑桿或下拉選單上時，方向鍵要留給那個控制項，不然鍵盤無法調整它。
    const keepKeysInFormControls = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement
        || (target instanceof HTMLInputElement && target.type === 'range')) {
        event.stopPropagation();
      }
    };
    shell.addEventListener('keydown', keepKeysInFormControls);

    const graph = createViewerScene(model, rendering, {
      batchStaticGeometry: renderingParameters.get('batch') !== 'off',
    });
    if (graph.staticBatch) {
      shell.dataset.staticBatchSourceMeshes = String(graph.staticBatch.sourceMeshes);
      shell.dataset.staticBatchMeshes = String(graph.staticBatch.meshesAfter);
    }
    renderer.shadowMap.autoUpdate = false;
    const requestShadowRefresh = () => {
      if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
      // 光線或可見物件變了，水面的倒影也要重拍。
      rendering.visualAssets.invalidateLighting?.();
    };
    requestShadowRefresh();
    shell.dataset.shadowUpdateMode = 'on-demand-static-scene';
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
    shell.dataset.adaptiveQuality = String(qualitySession.controller.adaptive);
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
        requestShadowRefresh();
      });
      layerInputs.set(modelLayer.id, input);
      layerList.append(label);
    }

    const renderSelection = (selection: SelectableInfo) => {
      selectionPanel.innerHTML = `
        <div class="selection-heading"><span class="status-dot" data-status="${selection.status}"></span><strong>${selection.entityId}</strong></div>
        <h3>${selection.label}</h3>
        <p>${selection.description}</p>
        ${selection.openItemId ? `<a href="${BACKLOG_URL}" target="_blank" rel="noopener">${selection.openItemId} · 尚待確認</a>` : ''}`;
    };
    const selectionController = setupSelection({
      canvas: renderer.domElement, camera, controls,
      selectables: graph.selectables, objectSelect, onSelect: renderSelection,
      pickRoot: graph.siteRoot,
    });

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
      requestShadowRefresh();
      if (!enabled) {
        required<HTMLElement>('[data-view-controls]').querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((button) => {
          button.dataset.active = 'false';
          button.setAttribute('aria-pressed', 'false');
        });
      }
    };
    const setEnvironment = (environment: ReturnType<typeof getViewerScene>['environment']) => {
      rendering.environment.apply(environment, graph);
      requestShadowRefresh();
      shell.dataset.environment = environment;
    };

    // 真實太陽（DEC-191）：光由校址、基地方位、日期、時刻與天氣算出來。
    // 基本繪圖路徑沒有 applyLighting，維持各場景固定的環境，也不顯示時刻控制。
    const siteLocation = model.referenceSystem.siteLocation;
    const solarLocation = {
      latitude: siteLocation.latitude.value,
      longitude: siteLocation.longitude.value,
      utcOffsetHours: siteLocation.utcOffsetHours,
    };
    const currentSiteMoment = () => siteMomentAt(Date.now(), siteLocation.utcOffsetHours);
    const lightingYear = currentSiteMoment().year;
    const shadowFocus = deriveShadowFocus({
      bounds: model.geometry.site.bounds,
      height: Math.max(
        model.geometry.roof.highElevation,
        model.geometry.l3.roof.baseElevation + model.geometry.l3.roof.thickness,
      ),
      margin: SHADOW_FOCUS_MARGIN_METRES,
    }, graph.siteRoot);
    const realSunAvailable = typeof rendering.environment.applyLighting === 'function';
    shell.dataset.realSun = String(realSunAvailable);
    let lightingState: LightingState | null = null;
    let scenePresetLighting: LightingState | null = null;
    let lastReflectionRefresh = Number.NEGATIVE_INFINITY;
    let reflectionRefreshTimer: number | null = null;
    const refreshReflections = () => {
      reflectionRefreshTimer = null;
      lastReflectionRefresh = performance.now();
      rendering.visualAssets.invalidateLighting?.();
    };
    // 拖滑桿時每一格都重畫陰影（只多一次深度繪製）；倒影取樣要多畫六個方向，隔一小段時間才重拍。
    const requestLightingRefresh = () => {
      if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
      const wait = REFLECTION_REFRESH_INTERVAL_MILLISECONDS - (performance.now() - lastReflectionRefresh);
      if (wait <= 0) refreshReflections();
      else reflectionRefreshTimer ??= window.setTimeout(refreshReflections, wait);
    };
    const syncLocation = (sceneId: string) => {
      const parameters = new URLSearchParams(location.search);
      if (lightingState && scenePresetLighting) {
        writeLightingParameters(parameters, lightingState, scenePresetLighting);
      }
      const query = parameters.toString();
      history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}#${sceneId}`);
    };
    let lightingControl: LightingControl | null = null;
    const setLighting = (state: LightingState) => {
      if (!realSunAvailable) return;
      const lighting = computeSunLighting({
        moment: state.moment,
        location: solarLocation,
        positiveXAxisBearingFromTrueNorth:
          model.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
        weather: state.weather,
      });
      lightingState = state;
      rendering.environment.applyLighting?.(toSceneLighting(lighting, graph.siteRoot, shadowFocus), graph);
      requestLightingRefresh();
      shell.dataset.lightingMoment = formatSolarMoment(state.moment);
      shell.dataset.weather = state.weather;
      shell.dataset.sunAltitude = lighting.altitude.toFixed(2);
      shell.dataset.sunAzimuth = lighting.azimuth.toFixed(2);
      shell.dataset.keyLight = lighting.key.source;
      shell.dataset.dayPhase = lighting.phase;
      lightingControl?.show(state, describeSunLighting(lighting));
    };
    if (realSunAvailable) {
      lightingControl = new LightingControl({
        elements: {
          root: required<HTMLElement>('[data-light-control]'),
          date: required<HTMLInputElement>('[data-light-date]'),
          dateLabel: required<HTMLElement>('[data-light-date-label]'),
          terms: required<HTMLElement>('[data-light-terms]'),
          time: required<HTMLInputElement>('[data-light-time]'),
          timeLabel: required<HTMLElement>('[data-light-time-label]'),
          weather: required<HTMLElement>('[data-light-weather]'),
          status: required<HTMLElement>('[data-light-status]'),
          now: required<HTMLButtonElement>('[data-light-now]'),
        },
        currentMoment: currentSiteMoment,
        onChange: (state) => {
          if (lightingState && sameLightingState(state, lightingState)) return;
          setLighting(state);
          syncLocation(shell.dataset.scene ?? 'overview');
        },
      });
    }

    /**
     * `lighting`：`preset` 用場景自帶的時刻與天氣；`keep` 保留使用者調過的（重設視角時）；
     * 傳網址參數時，參數裡的 time、weather 蓋過場景設定（剛開啟頁面時）。
     */
    const applyScene = (sceneId: string, lighting: 'preset' | 'keep' | URLSearchParams = 'preset') => {
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
      // 場景自帶日期、時刻與天氣；只有剛開啟頁面時，網址上的 time、weather 會蓋過它。
      scenePresetLighting = lightingStateFromPreset(config.lighting, lightingYear);
      if (lighting === 'keep' && lightingState) setLighting(lightingState);
      else if (lighting instanceof URLSearchParams) setLighting(readLightingParameters(lighting, scenePresetLighting));
      else setLighting(scenePresetLighting);
      for (const [id, button] of sceneButtons) {
        const active = id === sceneId;
        button.dataset.active = String(active);
        button.setAttribute('aria-pressed', String(active));
      }
      shell.dataset.scene = sceneId;
      syncLocation(sceneId);
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
            perspective: { position: [30, 25, -34], target: [0, 2.4, 0] },
            top: { position: [0.01, 58, 0], target: [0, 0, 0] },
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
    required<HTMLButtonElement>('[data-reset-view]').addEventListener('click', () => applyScene(shell.dataset.scene ?? 'overview', 'keep'));

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
      waterColorHandled: () => rendering.visualAssets.handlesUnderwaterView === true,
    });
    // 鏡頭是否在池水裡：水下的水色跟著鏡頭，不跟著移動狀態（移動狀態有遲滯）。
    const poolBasin = getViewerPoolBasinShape(model);
    const eyeInBasin = new THREE.Vector3();
    const eyeInPoolWater = () => {
      graph.water.surface.worldToLocal(eyeInBasin.copy(camera.position));
      return eyeInBasin.y < poolBasin.waterLevel
        && eyeInBasin.x > poolBasin.minX && eyeInBasin.x < poolBasin.maxX
        && eyeInBasin.z > poolBasin.minZ && eyeInBasin.z < poolBasin.maxZ;
    };
    shell.dataset.reducedMotion = String(reducedMotion);
    walkthroughQuality.textContent = qualitySession.tier.label;
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

    // 四級畫質（DEC-190）套到畫面：繪圖管線的設定，加上漫遊用的陰影、鏡頭阻尼與水下效果。
    const applyRealismTier = (tier: RealismTier, shed: readonly ShedStep[] = []) => {
      const legacyTier = tier.legacyTier;
      const capability = getWalkthroughCapabilityProfile(legacyTier, reducedMotion);
      rendering.setQuality(renderQualityProfileForTier(pipelineProfileFor(legacyTier), tier, shed));
      renderer.shadowMap.enabled = rendering.quality.shadows;
      requestShadowRefresh();
      controls.enableDamping = capability.cameraMotion;
      underwaterEffects.setQuality(capability.underwaterEffect === 'essential' ? 'low' : 'high');
      walkthroughQuality.textContent = tier.label;
      shell.dataset.renderQuality = rendering.quality.id;
      shell.dataset.performanceProfile = legacyTier;
      shell.dataset.cameraMotion = String(capability.cameraMotion);
      shell.dataset.underwaterEffect = capability.underwaterEffect;
    };
    applyRealismTier(qualitySession.tier);

    const resize = () => {
      const rect = canvasHost.getBoundingClientRect();
      rendering.framePipeline.resize(
        rect.width,
        rect.height,
        effectivePixelRatio(
          devicePixelRatio,
          qualitySession.tier,
          qualitySession.controller.state.resolutionScale,
        ),
      );
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvasHost);
    resize();
    const initialId = location.hash.slice(1);
    applyScene(
      viewerScenes.some((scene) => scene.id === initialId) ? initialId : 'overview',
      renderingParameters,
    );
    const shaderCompileStartedAt = performance.now();
    await renderer.compileAsync(graph.scene, camera);
    shell.dataset.shaderCompileMs = (performance.now() - shaderCompileStartedAt).toFixed(2);
    shell.dataset.shaderPrograms = String(renderer.info.programs?.length ?? 0);
    shell.dataset.renderingInitMs = (performance.now() - bootstrapStartedAt).toFixed(2);
    let elapsedFrameTime = 0;
    let renderedFrames = 0;
    let peakDrawCalls = 0;
    const frameStatistics = new FrameStatistics();

    // 啟動檢測：連畫幾幀，每幀讀回一個像素逼顯示卡把工作做完，量到的才是真正的繪製時間
    // （只看 requestAnimationFrame 的間隔會被螢幕同步鎖住）。載入畫面還蓋著，使用者看不到。
    const runStartupBenchmark = () => {
      const pixel = new Uint8Array(4);
      const frames: number[] = [];
      const startedAt = performance.now();
      let timedOut = false;
      for (let frame = 0; frame < BENCHMARK_FRAMES; frame += 1) {
        const frameStartedAt = performance.now();
        rendering.visualAssets.updateFrame?.({
          deltaSeconds: 1 / 60,
          elapsedSeconds: frame / 60,
          reducedMotion,
          camera,
        });
        rendering.framePipeline.render(graph.scene, camera);
        graphicsContext.readPixels(
          0, 0, 1, 1, graphicsContext.RGBA, graphicsContext.UNSIGNED_BYTE, pixel,
        );
        const frameEndedAt = performance.now();
        frames.push(frameEndedAt - frameStartedAt);
        if (frameEndedAt - startedAt > BENCHMARK_TIME_LIMIT_MILLISECONDS) {
          timedOut = frame + 1 < BENCHMARK_FRAMES;
          break;
        }
      }
      return summarizeBenchmarkRun(frames, timedOut);
    };

    qualitySelect.replaceChildren(
      ...QUALITY_CHOICES.map((choice) => new Option(choice.label, choice.value)),
    );
    qualitySession.start({
      applyTier: applyRealismTier,
      applyResolution: () => {
        resize();
        // 換了畫質之後，舊的幀時間不能拿來判斷新的畫質。
        frameStatistics.reset();
      },
      runBenchmark: runStartupBenchmark,
      announce: announceWalkthrough,
      publish: (snapshot) => {
        qualitySelect.value = snapshot.choice;
        qualityStatus.textContent = snapshot.description;
        shell.dataset.realismTier = snapshot.tier;
        shell.dataset.realismTierSource = snapshot.source;
        shell.dataset.resolutionScale = snapshot.resolutionScale.toFixed(2);
        shell.dataset.displayIntervalMs = snapshot.displayIntervalMilliseconds?.toFixed(2) ?? 'unknown';
        shell.dataset.benchmarkMedianMs = snapshot.benchmark?.medianMilliseconds.toFixed(2) ?? 'none';
      },
    }, finishDisplayIntervalSampling());
    const handleQualityChoice = () => qualitySession.choose(qualitySelect.value);
    qualitySelect.disabled = false;
    qualitySelect.addEventListener('change', handleQualityChoice);

    let previousFrameTime = performance.now();
    let previousQualityObservation = previousFrameTime;
    const statisticsStart = previousFrameTime;
    renderer.setAnimationLoop(() => {
      const currentFrameTime = performance.now();
      const frameDelta = (currentFrameTime - previousFrameTime) / 1000;
      previousFrameTime = currentFrameTime;
      elapsedFrameTime += Math.min(frameDelta, 0.1);
      renderedFrames += 1;
      if (cameraModeManager.state === 'walkthrough') {
        const intent = activeInput.readIntent();
        if (intent.exitRequested) {
          void cameraModeManager.exit();
        } else {
          advancePlayerFrame(playerController, fixedStepLoop, intent, frameDelta);
          const player = playerController.state;
          camera.position.set(player.position.x, player.position.y, player.position.z);
          camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
          shell.dataset.movementMode = player.movementMode;
          shell.dataset.playerGrounded = String(player.grounded);
          const swimming = player.movementMode === 'swimming-surface'
            || player.movementMode === 'swimming-underwater';
          returnPoolsideButton.hidden = !swimming;
          swimControls.hidden = !swimming || activeInput !== touchInput;
          underwaterEffects.update(player.movementMode, eyeInPoolWater());
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
      rendering.visualAssets.updateFrame?.({
        deltaSeconds: Math.min(frameDelta, 0.1),
        elapsedSeconds: elapsedFrameTime,
        reducedMotion,
        camera,
      });
      renderer.info.reset();
      rendering.framePipeline.render(graph.scene, camera);
      peakDrawCalls = Math.max(peakDrawCalls, renderer.info.render.calls);
      const frameEnd = performance.now();
      frameStatistics.observe(
        (frameEnd - statisticsStart) / 1000,
        frameDelta * 1000,
        frameEnd - currentFrameTime,
      );
      // 幀率調節器（DEC-190）：統計每十幀看一次；幀率很低時改成至少每 0.25 秒看一次，
      // 免得兩次觀測相隔太久被當成分頁切到背景。
      if (renderedFrames % 10 === 0 || frameEnd - previousQualityObservation >= 250) {
        previousQualityObservation = frameEnd;
        qualitySession.observe(frameStatistics.snapshot());
      }
      if (renderedFrames === 1 || renderedFrames % 30 === 0) {
        const observation = frameStatistics.snapshot();
        shell.dataset.frameAverageMs = observation.intervalAverageMilliseconds.toFixed(2);
        shell.dataset.frameP95Ms = observation.intervalP95Milliseconds.toFixed(2);
        shell.dataset.frameSamples = String(observation.samples);
        shell.dataset.renderedFrames = String(renderedFrames);
        shell.dataset.frameIntervalP95Ms = observation.intervalP95Milliseconds.toFixed(2);
        shell.dataset.frameWorkP95Ms = observation.workP95Milliseconds.toFixed(2);
        shell.dataset.drawCalls = String(renderer.info.render.calls);
        // 鏡頭移動時平面倒影會把場景多畫一次；這段期間最多的一幀記在這裡，公布後歸零。
        shell.dataset.drawCallsPeak = String(peakDrawCalls);
        peakDrawCalls = 0;
        shell.dataset.waterReflection = rendering.visualAssets.waterReflection ?? 'none';
        shell.dataset.underwaterView = String(rendering.visualAssets.underwaterViewActive === true);
        shell.dataset.triangles = String(renderer.info.render.triangles);
        shell.dataset.lines = String(renderer.info.render.lines);
        shell.dataset.geometries = String(renderer.info.memory.geometries);
        shell.dataset.textures = String(renderer.info.memory.textures);
        shell.dataset.shaderPrograms = String(renderer.info.programs?.length ?? 0);
        shell.dataset.waterPresentation = String(
          graph.water.surface.userData.waterPresentation ?? 'baseline',
        );
      }
    });
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);
    function handleContextRestored() {
      rendering.framePipeline.restore();
      requestShadowRefresh();
      shell.dataset.contextRestores = String(Number(shell.dataset.contextRestores ?? '0') + 1);
    }
    let runtimeDisposed = false;
    viewerCleanup = async () => {
      if (runtimeDisposed) return;
      runtimeDisposed = true;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      qualitySelect.removeEventListener('change', handleQualityChoice);
      shell.removeEventListener('keydown', keepKeysInFormControls);
      if (reflectionRefreshTimer !== null) window.clearTimeout(reflectionRefreshTimer);
      lightingControl?.dispose();
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      await cameraModeManager.dispose();
      desktopInput.dispose();
      touchInput.dispose();
      selectionController.dispose();
      underwaterEffects.dispose();
      controls.dispose();
      rendering.dispose();
      renderer.dispose();
      shell.dataset.viewerReady = 'destroyed';
    };

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
  finishDisplayIntervalSampling();
  console.error(error);
  showFailure(error);
}
}

void bootstrap();
window.addEventListener('pagehide', () => {
  void destroyViewer();
}, { once: true });
