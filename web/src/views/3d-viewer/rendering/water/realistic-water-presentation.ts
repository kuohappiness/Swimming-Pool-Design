import * as THREE from 'three';
import type {
  VisualAssetContext,
  VisualFrameState,
  VisualWalkthroughState,
} from '../contracts';
import { readSceneMirrorBounce } from '../lighting/mirror-bounce';
import { readSceneFixtureLights } from '../lighting/fixture-lights';
import type { HallProbeSource } from '../enhanced/hall-reflection';
import type { RenderQualityProfile, RenderQualityTier } from '../quality-profile';
import { Ktx2TextureSource } from '../textures/ktx2-texture-source';
import { createPoolBasinMaterial } from './pool-basin-material';
import { ScenePlanarReflection, type PlanarReflection } from './planar-reflection';
import { CubeReflectionProbe, type ReflectionProbe } from './reflection-probe';
import { UnderwaterMotes } from './underwater-motes';
import { ScreenUnderwaterView, type UnderwaterView } from './underwater-view';
import {
  WATER_SURFACE_NAME,
  WaterSurface,
  type PoolBasinShape,
  type PoolHallShape,
  type WaterSunShadow,
} from './water-surface';

const RIPPLE_NORMAL_URL = new URL(
  '../../assets/materials/water/ripple-normal.ktx2',
  import.meta.url,
).href;
const CAUSTICS_URL = new URL(
  '../../assets/materials/water/caustics.ktx2',
  import.meta.url,
).href;

/** 探針放在池面中央上方這麼高（公尺）：太低會被池緣擋住地平線附近的景物。 */
const PROBE_HEIGHT_ABOVE_WATER = 0.5;
const ALIGNMENT_TOLERANCE = 1e-4;
/** 查水面上一點在不在影子裡時的深度偏移：池緣這類貼著水面的構件不會因為誤差把水邊染黑。 */
const WATER_SHADOW_BIAS_METRES = 0.03;
/** 水裡影子邊緣的取樣半徑（陰影貼圖的格數）：屋架離水面幾公尺，影子落到水裡已經有點柔。 */
const WATER_SHADOW_RADIUS_TEXELS = 2;

interface WaterDetail {
  /** 水面網格的格距（公尺）。 */
  readonly cellSize: number;
  /** 反射探針每一面的邊長（像素）。 */
  readonly probeSize: number;
  /**
   * 鏡頭在水裡時要不要用水下畫面（場景先畫到貼圖再加水色）。低畫質不用：
   * 多一張全螢幕的貼圖對最弱的裝置太重，水色改由漫遊的場景霧近似。
   */
  readonly underwaterView: boolean;
  /** 水下光束沿視線取樣幾次；0 不畫光束。 */
  readonly shaftSteps: number;
  /** 水下懸浮微粒的數量。 */
  readonly moteCount: number;
}

const WATER_DETAIL: Readonly<Record<RenderQualityTier, WaterDetail>> = Object.freeze({
  high: Object.freeze({ cellSize: 0.25, probeSize: 256, underwaterView: true, shaftSteps: 14, moteCount: 700 }),
  medium: Object.freeze({ cellSize: 0.5, probeSize: 128, underwaterView: true, shaftSteps: 8, moteCount: 350 }),
  low: Object.freeze({ cellSize: 1, probeSize: 64, underwaterView: false, shaftSteps: 0, moteCount: 0 }),
});

export interface WaterTextureSource {
  loadTexture(url: string): Promise<THREE.Texture>;
  dispose(): void;
}

export interface RealisticWaterOptions {
  readonly basin: PoolBasinShape;
  /** 池廳內部的大小（來自模型）；有給時探針倒影依它修正視差。 */
  readonly hall?: PoolHallShape;
  /** 池底水道線的顏色，與實體標線的材質一致。 */
  readonly laneLineColor?: THREE.Color;
  /** 水裡金屬構件（池梯踏階）的顏色，與扶手材質一致。 */
  readonly metalColor?: THREE.Color;
  /**
   * 場景裡池底與池壁目前使用的材質。有給時，用到它的網格會換成與水面共用著色的池體材質，
   * 從水面上（折射）與潛到水下（直接看）看到的磁磚、標線與光網才一致。
   */
  readonly basinMaterial?: THREE.Material;
  /** 正式環境給繪圖器，貼圖來源與探針由它建立；測試可改給下面兩個替身。 */
  readonly renderer?: THREE.WebGLRenderer;
  readonly textureSource?: WaterTextureSource;
  readonly createReflectionProbe?: (size: number) => ReflectionProbe;
  /** 測試用的平面倒影替身；沒給時由繪圖器建立，兩者都沒有就只用探針。 */
  readonly createPlanarReflection?: (width: number, height: number) => PlanarReflection;
  /** 測試用的水下畫面替身；沒給時自己建立。 */
  readonly createUnderwaterView?: (surface: WaterSurface) => UnderwaterView;
}

/**
 * 把寫實水面（`WaterSurface`）接到場景裡既有的水面網格上。
 *
 * 貼圖是非同步載入的：`load()` 完成前畫面維持原本的水，完成後呼叫 `activate()` 才換上；
 * 載入失敗就不換，由呼叫端決定退回哪一種呈現。
 */
export class RealisticWaterPresentation {
  readonly id = 'realistic-water-presentation';
  private readonly options: RealisticWaterOptions;
  private profile: RenderQualityProfile;
  private textureSource: WaterTextureSource | null = null;
  private textures: { rippleNormal: THREE.Texture; caustics: THREE.Texture } | null = null;
  private probe: ReflectionProbe | null = null;
  private planar: PlanarReflection | null = null;
  private underwaterView: UnderwaterView | null = null;
  private motes: UnderwaterMotes | null = null;
  private originalOnBeforeRender: THREE.Object3D['onBeforeRender'] | null = null;
  private readonly planarHidden: THREE.Object3D[] = [];
  private readonly drawingBufferSize = new THREE.Vector2();
  private surface: WaterSurface | null = null;
  private basinMaterial: THREE.ShaderMaterial | null = null;
  private readonly basinMeshes: Array<{ mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }> = [];
  private scene: THREE.Scene | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private ambient: THREE.HemisphereLight | null = null;
  private expectedSurfaceElevation: number | null = null;
  private reflectionStale = true;
  /** 探針拍過至少一次（池廳反射要等它）。 */
  private probeCaptured = false;
  private disposed = false;
  private readonly probePosition = new THREE.Vector3();
  private readonly sunPosition = new THREE.Vector3();
  private readonly sunTarget = new THREE.Vector3();
  private readonly sunDirection = new THREE.Vector3(0, 1, 0);
  private readonly sunColor = new THREE.Color();
  private readonly skyColor = new THREE.Color();
  private readonly sunShadow: { -readonly [Key in keyof WaterSunShadow]: WaterSunShadow[Key] | null } = {
    map: null, matrix: null, bias: 0, radius: 0,
  };

  constructor(initialProfile: RenderQualityProfile, options: RealisticWaterOptions) {
    if (!options.renderer && !(options.textureSource && options.createReflectionProbe)) {
      throw new TypeError('Realistic water needs a renderer, or a texture source and a reflection probe.');
    }
    this.profile = initialProfile;
    this.options = options;
  }

  get active(): boolean {
    return this.surface !== null;
  }

  /** 下載並轉碼兩張貼圖。失敗時丟出錯誤，已載入的那一張會被釋放。 */
  async load(): Promise<void> {
    if (this.disposed || this.textures) return;
    const source = this.options.textureSource
      ?? new Ktx2TextureSource(this.options.renderer as THREE.WebGLRenderer);
    this.textureSource = source;
    const results = await Promise.allSettled([
      source.loadTexture(RIPPLE_NORMAL_URL),
      source.loadTexture(CAUSTICS_URL),
    ]);
    const [rippleNormal, caustics] = results;
    if (
      this.disposed
      || rippleNormal?.status !== 'fulfilled'
      || caustics?.status !== 'fulfilled'
    ) {
      for (const result of results) if (result.status === 'fulfilled') result.value.dispose();
      if (this.disposed) return;
      const failure = results.find((result) => result.status === 'rejected');
      throw failure?.reason instanceof Error
        ? failure.reason
        : new TypeError('Realistic water textures failed to load.');
    }
    rippleNormal.value.name = 'realistic:water-ripple-normal';
    caustics.value.name = 'realistic:water-caustics';
    this.textures = { rippleNormal: rippleNormal.value, caustics: caustics.value };
  }

  /** 把場景裡的水面換成寫實水面。要在 `load()` 成功之後呼叫。 */
  activate(context: VisualAssetContext): void {
    if (this.disposed || this.surface) return;
    if (!this.textures) throw new TypeError('Realistic water textures are not loaded.');
    const target = context.siteRoot.getObjectByName(WATER_SURFACE_NAME);
    if (!(target instanceof THREE.Mesh)) {
      throw new TypeError(`Realistic water surface is missing: ${WATER_SURFACE_NAME}`);
    }
    this.assertAligned(target);

    const detail = WATER_DETAIL[this.profile.id];
    this.probe = this.options.createReflectionProbe?.(detail.probeSize)
      ?? new CubeReflectionProbe(this.options.renderer as THREE.WebGLRenderer, detail.probeSize);
    this.surface = new WaterSurface({
      basin: this.options.basin,
      rippleNormal: this.textures.rippleNormal,
      caustics: this.textures.caustics,
      reflectionCube: this.probe.texture,
      hall: this.options.hall,
      laneLineColor: this.options.laneLineColor,
      metalColor: this.options.metalColor,
      cellSize: detail.cellSize,
    }, target);
    this.adoptBasin(context, target);
    this.scene = context.scene;
    this.expectedSurfaceElevation = this.options.basin.waterLevel;
    context.scene.traverse((object) => {
      if (!this.sun && object instanceof THREE.DirectionalLight) this.sun = object;
      if (!this.ambient && object instanceof THREE.HemisphereLight) this.ambient = object;
    });
    this.reflectionStale = true;

    // 平面倒影要在主畫面畫到水面之前才知道鏡頭在哪，所以掛在水面網格的 onBeforeRender；
    // 這樣水面不在視野裡時也不會白畫，繪製呼叫也算在同一個畫面的統計裡。
    this.originalOnBeforeRender = target.onBeforeRender;
    target.onBeforeRender = (renderer, scene, camera) => this.renderPlanarReflection(renderer, scene, camera);
    this.planarHidden.length = 0;
    this.planarHidden.push(target, ...this.basinMeshes.map(({ mesh }) => mesh));
    this.syncPlanarReflection();

    this.motes = new UnderwaterMotes(this.surface.material.uniforms, target, detail.moteCount);
    this.underwaterView = this.options.createUnderwaterView?.(this.surface)
      ?? new ScreenUnderwaterView({
        basin: this.options.basin,
        waterUniforms: this.surface.material.uniforms,
        surface: target,
        maximumWaveHeight: this.surface.maximumWaveHeight,
        underwaterOnly: [this.motes.points],
      });
    this.underwaterView.setShaftSteps(detail.shaftSteps);
  }

  /** 這一級畫質有沒有平面倒影（沒有時只用探針）。 */
  /**
   * 池廳中央的反射探針，給池館室內的反射共用（`rendering/enhanced/hall-reflection.ts`）。
   * 沒有池廳尺寸或還沒拍過時為 null。
   */
  get hallProbe(): HallProbeSource | null {
    const { surface, probe } = this;
    const hall = this.options.hall;
    if (this.disposed || !surface || !probe || !hall || !this.probeCaptured) return null;
    return {
      texture: probe.texture,
      size: WATER_DETAIL[this.profile.id].probeSize,
      probePosition: this.probePosition,
      hall,
      localToWorld: surface.mesh.matrixWorld,
    };
  }

  get usesPlanarReflection(): boolean {
    return this.planar !== null;
  }

  /** 鏡頭在水下時的水色是否由這裡處理（低畫質不處理，由漫遊的場景霧近似）。 */
  get handlesUnderwaterView(): boolean {
    return this.surface !== null && WATER_DETAIL[this.profile.id].underwaterView;
  }

  /** 鏡頭在水裡時畫出水下畫面並回傳 true；否則回傳 false，由呼叫端照常畫。 */
  renderUnderwaterView(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): boolean {
    if (this.disposed || !this.underwaterView || !this.handlesUnderwaterView) return false;
    return this.underwaterView.render(renderer, scene, camera);
  }

  setQuality(profile: RenderQualityProfile): void {
    if (this.disposed) return;
    this.profile = profile;
    if (!this.surface || !this.probe) return;
    const detail = WATER_DETAIL[profile.id];
    this.surface.setCellSize(detail.cellSize);
    if (this.probe.setSize(detail.probeSize)) this.surface.setReflectionCube(this.probe.texture);
    this.syncPlanarReflection();
    this.underwaterView?.setShaftSteps(detail.shaftSteps);
    this.motes?.setCount(detail.moteCount);
    // 畫質會改變陰影與環境光，倒影要跟著重拍。
    this.reflectionStale = true;
    this.planar?.invalidate();
  }

  setWalkthroughState(state: VisualWalkthroughState): void {
    if (this.disposed) return;
    if (
      this.expectedSurfaceElevation !== null
      && Math.abs(state.waterSurfaceElevation - this.expectedSurfaceElevation) > 1e-9
    ) {
      throw new TypeError('Realistic water presentation received a second water surface state.');
    }
  }

  /** 光線或可見物件改變後呼叫；下一個畫面會重拍倒影。 */
  invalidateReflection(): void {
    this.reflectionStale = true;
    this.planar?.invalidate();
  }

  updateFrame(state: VisualFrameState): void {
    const { surface, probe, scene } = this;
    if (this.disposed || !surface || !probe || !scene) return;
    const mesh = surface.mesh;
    if (this.reflectionStale) {
      this.reflectionStale = false;
      mesh.updateWorldMatrix(true, false);
      const { basin } = this.options;
      this.probePosition.set(
        (basin.minX + basin.maxX) / 2,
        basin.waterLevel + PROBE_HEIGHT_ABOVE_WATER,
        (basin.minZ + basin.maxZ) / 2,
      );
      surface.setProbePosition(this.probePosition);
      probe.capture(scene, mesh.localToWorld(this.probePosition), [mesh]);
      this.probeCaptured = true;
    }

    if (this.sun) {
      this.sun.getWorldPosition(this.sunPosition);
      this.sun.target.getWorldPosition(this.sunTarget);
      this.sunDirection.subVectors(this.sunPosition, this.sunTarget);
      if (this.sunDirection.lengthSq() > 0) this.sunDirection.normalize();
      else this.sunDirection.set(0, 1, 0);
      this.sunColor.copy(this.sun.color).multiplyScalar(this.sun.visible ? this.sun.intensity : 0);
    } else {
      this.sunDirection.set(0, 1, 0);
      this.sunColor.setScalar(0);
    }
    const shadow = this.sun?.castShadow && this.sun.visible ? this.sun.shadow : null;
    const shadowMap = shadow?.map?.depthTexture ?? null;
    // 只認深度比較用的貼圖（PCF 陰影）；其他陰影類型的貼圖格式不同，水就不查陰影。
    let sunShadow: WaterSunShadow | null = null;
    if (shadow && shadowMap && shadowMap.compareFunction !== null) {
      this.sunShadow.map = shadowMap;
      this.sunShadow.matrix = shadow.matrix;
      this.sunShadow.bias = WATER_SHADOW_BIAS_METRES / Math.max(shadow.camera.far - shadow.camera.near, 1e-3);
      this.sunShadow.radius = WATER_SHADOW_RADIUS_TEXELS / Math.max(shadow.mapSize.x, 1);
      sunShadow = this.sunShadow as WaterSunShadow;
    }

    if (this.ambient) {
      // 有算出來的天光時用整片天空的照度（半球光只是其中一部分，其餘在環境貼圖裡，水不吃環境貼圖）。
      const skyIrradiance = this.ambient.userData.skyIrradiance;
      this.skyColor.copy(this.ambient.color).multiplyScalar(
        this.ambient.visible ? (typeof skyIrradiance === 'number' ? skyIrradiance : this.ambient.intensity) : 0,
      );
    } else {
      this.skyColor.setScalar(1);
    }

    // 鏡頭這個畫面才被移動過，世界矩陣要先更新，折射才不會慢一拍。
    state.camera.updateMatrixWorld();
    surface.update({
      // 減少動態效果時水面靜止，但折射、倒影與顏色照常。
      timeSeconds: state.reducedMotion ? 0 : state.elapsedSeconds,
      camera: state.camera,
      sunDirection: this.sunDirection,
      sunColor: this.sunColor,
      skyColor: this.skyColor,
      sunShadow,
      mirrorBounce: readSceneMirrorBounce(scene),
      fixtureLights: readSceneFixtureLights(scene),
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { mesh, original } of this.basinMeshes) mesh.material = original;
    this.basinMeshes.length = 0;
    this.basinMaterial?.dispose();
    this.basinMaterial = null;
    if (this.surface && this.originalOnBeforeRender) {
      this.surface.mesh.onBeforeRender = this.originalOnBeforeRender;
    }
    this.originalOnBeforeRender = null;
    this.planarHidden.length = 0;
    this.surface?.dispose();
    this.planar?.dispose();
    this.planar = null;
    this.underwaterView?.dispose();
    this.underwaterView = null;
    this.motes?.dispose();
    this.motes = null;
    this.probe?.dispose();
    this.textures?.rippleNormal.dispose();
    this.textures?.caustics.dispose();
    this.textureSource?.dispose();
    this.surface = null;
    this.probe = null;
    this.textures = null;
    this.textureSource = null;
    this.scene = null;
    this.sun = null;
    this.ambient = null;
  }

  /** 依目前的畫質建立或拿掉平面倒影。倒影比例是 0（中與省電級）時只用探針。 */
  private syncPlanarReflection(): void {
    const { surface } = this;
    if (!surface) return;
    const wanted = (this.profile.waterReflectionScale ?? 0) > 0
      && Boolean(this.options.createPlanarReflection ?? this.options.renderer);
    if (!wanted) {
      this.planar?.dispose();
      this.planar = null;
      surface.setPlanarReflection(null);
      return;
    }
    if (this.planar) return;
    // 先給最小的貼圖，真正的大小在第一次要畫時依畫布決定。
    this.planar = this.options.createPlanarReflection?.(1, 1)
      ?? new ScenePlanarReflection(this.options.renderer as THREE.WebGLRenderer, 1, 1);
    surface.setPlanarReflection(this.planar.texture, this.planar.textureMatrix);
  }

  private renderPlanarReflection(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    const { surface, planar } = this;
    if (this.disposed || !surface || !planar) return;
    const scale = this.profile.waterReflectionScale ?? 0;
    renderer.getDrawingBufferSize(this.drawingBufferSize);
    planar.setSize(this.drawingBufferSize.x * scale, this.drawingBufferSize.y * scale);
    surface.setPlanarReflectionVisible(planar.update({
      renderer,
      scene,
      camera,
      surface: surface.mesh,
      waterLevel: this.options.basin.waterLevel,
      hidden: this.planarHidden,
    }));
  }

  /** 把實體池底與池壁換成與水面共用著色的材質。 */
  private adoptBasin(context: VisualAssetContext, target: THREE.Mesh): void {
    const source = this.options.basinMaterial;
    if (!source || !this.surface) return;
    target.updateWorldMatrix(true, false);
    const material = createPoolBasinMaterial(
      this.surface.material.uniforms,
      new THREE.Matrix4().copy(target.matrixWorld).invert(),
    );
    context.siteRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.material !== source) return;
      this.basinMeshes.push({ mesh: object, original: object.material });
      object.material = material;
    });
    this.basinMaterial = material;
  }

  /** 場景裡的水面必須和模型給的池體形狀重合，否則折射算出來的池底會對不上實體池底。 */
  private assertAligned(target: THREE.Mesh): void {
    const { basin } = this.options;
    target.geometry.computeBoundingBox();
    const box = target.geometry.boundingBox;
    if (!box) throw new TypeError('Scene water surface has no bounds.');
    const pairs: ReadonlyArray<readonly [number, number]> = [
      [box.min.x, basin.minX], [box.max.x, basin.maxX],
      [box.min.z, basin.minZ], [box.max.z, basin.maxZ],
      [box.min.y, basin.waterLevel], [box.max.y, basin.waterLevel],
    ];
    if (pairs.some(([actual, expected]) => Math.abs(actual - expected) > ALIGNMENT_TOLERANCE)) {
      throw new TypeError('Scene water surface and the model pool basin are not aligned.');
    }
  }
}
