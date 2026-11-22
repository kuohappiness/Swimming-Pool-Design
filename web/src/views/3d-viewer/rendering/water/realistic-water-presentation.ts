import * as THREE from 'three';
import type {
  VisualAssetContext,
  VisualFrameState,
  VisualWalkthroughState,
} from '../contracts';
import type { RenderQualityProfile, RenderQualityTier } from '../quality-profile';
import { Ktx2TextureSource } from '../textures/ktx2-texture-source';
import { createPoolBasinMaterial } from './pool-basin-material';
import { CubeReflectionProbe, type ReflectionProbe } from './reflection-probe';
import { WATER_SURFACE_NAME, WaterSurface, type PoolBasinShape } from './water-surface';

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

interface WaterDetail {
  /** 水面網格的格距（公尺）。 */
  readonly cellSize: number;
  /** 反射探針每一面的邊長（像素）。 */
  readonly probeSize: number;
}

const WATER_DETAIL: Readonly<Record<RenderQualityTier, WaterDetail>> = Object.freeze({
  high: Object.freeze({ cellSize: 0.25, probeSize: 256 }),
  medium: Object.freeze({ cellSize: 0.5, probeSize: 128 }),
  low: Object.freeze({ cellSize: 1, probeSize: 64 }),
});

export interface WaterTextureSource {
  loadTexture(url: string): Promise<THREE.Texture>;
  dispose(): void;
}

export interface RealisticWaterOptions {
  readonly basin: PoolBasinShape;
  /** 池底水道線的顏色，與實體標線的材質一致。 */
  readonly laneLineColor?: THREE.Color;
  /**
   * 場景裡池底與池壁目前使用的材質。有給時，用到它的網格會換成與水面共用著色的池體材質，
   * 從水面上（折射）與潛到水下（直接看）看到的磁磚、標線與光網才一致。
   */
  readonly basinMaterial?: THREE.Material;
  /** 正式環境給繪圖器，貼圖來源與探針由它建立；測試可改給下面兩個替身。 */
  readonly renderer?: THREE.WebGLRenderer;
  readonly textureSource?: WaterTextureSource;
  readonly createReflectionProbe?: (size: number) => ReflectionProbe;
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
  private surface: WaterSurface | null = null;
  private basinMaterial: THREE.ShaderMaterial | null = null;
  private readonly basinMeshes: Array<{ mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }> = [];
  private scene: THREE.Scene | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private ambient: THREE.HemisphereLight | null = null;
  private expectedSurfaceElevation: number | null = null;
  private reflectionStale = true;
  private disposed = false;
  private readonly probePosition = new THREE.Vector3();
  private readonly sunPosition = new THREE.Vector3();
  private readonly sunTarget = new THREE.Vector3();
  private readonly sunDirection = new THREE.Vector3(0, 1, 0);
  private readonly sunColor = new THREE.Color();
  private readonly skyColor = new THREE.Color();

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
      laneLineColor: this.options.laneLineColor,
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
  }

  setQuality(profile: RenderQualityProfile): void {
    if (this.disposed) return;
    this.profile = profile;
    if (!this.surface || !this.probe) return;
    const detail = WATER_DETAIL[profile.id];
    this.surface.setCellSize(detail.cellSize);
    if (this.probe.setSize(detail.probeSize)) this.surface.setReflectionCube(this.probe.texture);
    // 畫質會改變陰影與環境光，倒影要跟著重拍。
    this.reflectionStale = true;
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
      probe.capture(scene, mesh.localToWorld(this.probePosition), [mesh]);
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
    if (this.ambient) {
      this.skyColor.copy(this.ambient.color)
        .multiplyScalar(this.ambient.visible ? this.ambient.intensity : 0);
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
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { mesh, original } of this.basinMeshes) mesh.material = original;
    this.basinMeshes.length = 0;
    this.basinMaterial?.dispose();
    this.basinMaterial = null;
    this.surface?.dispose();
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
