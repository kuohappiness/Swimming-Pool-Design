import * as THREE from 'three';
import type { EnvironmentId } from '../../scenes';
import type { EnvironmentEffect, EnvironmentTarget } from '../contracts';
import { aimKeyLight, type SceneLighting } from '../lighting/scene-lighting';
import { SkyDome } from '../lighting/sky-dome';
import { PLAIN_SHADOW_RADIUS_TEXELS, shadowFilterRadius } from '../lighting/soft-shadows';
import type { RenderQualityProfile } from '../quality-profile';
import { getToneMappingProfile } from './tone-mapping';

export interface EnvironmentTextureLoader {
  load(url: string): Promise<THREE.Texture>;
}

export interface EnvironmentMapFactory {
  create(source: THREE.Texture): THREE.Texture;
  /** 由一個只有天空的場景產生環境貼圖；沒有實作時，倒影與間接光沿用固定的環境圖。 */
  createFromScene?(scene: THREE.Scene): THREE.Texture;
  dispose(): void;
}

export interface EnhancedEnvironmentEffectOptions {
  readonly renderer: THREE.WebGLRenderer;
  readonly quality: RenderQualityProfile;
  readonly textureLoader?: EnvironmentTextureLoader;
  readonly mapFactory?: EnvironmentMapFactory;
}

const ENVIRONMENT_URL = new URL('../../assets/environments/courtyard-sky.svg', import.meta.url).href;

const ENVIRONMENT_PROFILES: Readonly<Record<EnvironmentId, {
  readonly background: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly sunColor: number;
  readonly sunIntensity: number;
  readonly sunPosition: readonly [number, number, number];
  readonly skyColor: number;
  readonly groundColor: number;
  readonly ambientIntensity: number;
}>> = Object.freeze({
  day: Object.freeze({
    background: 0xd3dde0,
    fogNear: 72,
    fogFar: 148,
    sunColor: 0xfff1d8,
    sunIntensity: 2.85,
    sunPosition: [-20, 34, 23] as const,
    skyColor: 0xeaf7ff,
    groundColor: 0x7a7265,
    ambientIntensity: 1.52,
  }),
  'winter-light': Object.freeze({
    background: 0xcbd9df,
    fogNear: 70,
    fogFar: 142,
    sunColor: 0xffd8a6,
    sunIntensity: 3.18,
    sunPosition: [-27, 20, 31] as const,
    skyColor: 0xdceeff,
    groundColor: 0x766b60,
    ambientIntensity: 1.42,
  }),
  rain: Object.freeze({
    background: 0x94a7b0,
    fogNear: 48,
    fogFar: 112,
    sunColor: 0xc9d8df,
    sunIntensity: 1.08,
    sunPosition: [-12, 26, 16] as const,
    skyColor: 0xc2d0d6,
    groundColor: 0x626b6b,
    ambientIntensity: 1.24,
  }),
  soft: Object.freeze({
    background: 0xd8d2c8,
    fogNear: 68,
    fogFar: 138,
    sunColor: 0xffe4c4,
    sunIntensity: 2.18,
    sunPosition: [24, 25, 18] as const,
    skyColor: 0xf1eee8,
    groundColor: 0x81776b,
    ambientIntensity: 1.45,
  }),
});

class PmremEnvironmentMapFactory implements EnvironmentMapFactory {
  private readonly generator: THREE.PMREMGenerator;
  private target: THREE.WebGLRenderTarget | null = null;
  private sceneTarget: THREE.WebGLRenderTarget | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    this.generator = new THREE.PMREMGenerator(renderer);
    this.generator.compileEquirectangularShader();
  }

  create(source: THREE.Texture) {
    this.target?.dispose();
    this.target = this.generator.fromEquirectangular(source);
    this.target.texture.name = 'enhanced:pmrem-courtyard-sky';
    return this.target.texture;
  }

  createFromScene(scene: THREE.Scene) {
    // 先產生新的再丟掉舊的：場景這時還指著舊的那一張。
    const next = this.generator.fromScene(scene, 0, 0.1, 1000);
    next.texture.name = 'enhanced:pmrem-sky';
    this.sceneTarget?.dispose();
    this.sceneTarget = next;
    return next.texture;
  }

  dispose() {
    this.target?.dispose();
    this.target = null;
    this.sceneTarget?.dispose();
    this.sceneTarget = null;
    this.generator.dispose();
  }
}

export class EnhancedEnvironmentEffect implements EnvironmentEffect {
  readonly id = 'enhanced-pmrem-environment';
  readonly diagnostic: string | null;
  private readonly sourceTexture: THREE.Texture | null;
  private readonly environmentMap: THREE.Texture | null;
  private readonly mapFactory: EnvironmentMapFactory;
  private quality: RenderQualityProfile;
  private currentEnvironment: EnvironmentId = 'day';
  private currentTarget: EnvironmentTarget | null = null;
  private currentLighting: SceneLighting | null = null;
  private lightingFog: THREE.Fog | null = null;
  private sky: SkyDome | null = null;
  /** 由天空產生的環境貼圖，以及產生它那一刻的天光強度。 */
  private skyEnvironment: { map: THREE.Texture; skyIntensity: number } | null = null;
  private skyEnvironmentStale = false;
  private softShadows = false;
  private disposed = false;

  private constructor(
    quality: RenderQualityProfile,
    mapFactory: EnvironmentMapFactory,
    sourceTexture: THREE.Texture | null,
    environmentMap: THREE.Texture | null,
    diagnostic: string | null,
  ) {
    this.quality = quality;
    this.mapFactory = mapFactory;
    this.sourceTexture = sourceTexture;
    this.environmentMap = environmentMap;
    this.diagnostic = diagnostic;
  }

  static async create(options: EnhancedEnvironmentEffectOptions) {
    const textureLoader = options.textureLoader ?? {
      load: (url: string) => new THREE.TextureLoader().loadAsync(url),
    };
    const mapFactory = options.mapFactory ?? new PmremEnvironmentMapFactory(options.renderer);
    let sourceTexture: THREE.Texture | null = null;
    let environmentMap: THREE.Texture | null;
    let diagnostic: string | null = null;
    try {
      sourceTexture = await textureLoader.load(ENVIRONMENT_URL);
      sourceTexture.name = 'enhanced:environment-courtyard-sky-v1';
      sourceTexture.mapping = THREE.EquirectangularReflectionMapping;
      sourceTexture.colorSpace = THREE.SRGBColorSpace;
      environmentMap = mapFactory.create(sourceTexture);
    } catch (error) {
      diagnostic = error instanceof Error ? error.message : 'Local environment asset failed to load.';
      sourceTexture?.dispose();
      sourceTexture = null;
      environmentMap = null;
    }
    return new EnhancedEnvironmentEffect(
      options.quality,
      mapFactory,
      sourceTexture,
      environmentMap,
      diagnostic,
    );
  }

  apply(environment: EnvironmentId, target: EnvironmentTarget) {
    if (this.disposed) return;
    const profile = ENVIRONMENT_PROFILES[environment];
    if (!profile) throw new TypeError(`Enhanced environment is unknown: ${environment}`);
    this.currentEnvironment = environment;
    this.currentTarget = target;
    target.scene.background = new THREE.Color(profile.background);
    target.scene.environment = this.quality.id === 'low'
      ? null
      : this.skyEnvironment?.map ?? this.environmentMap;
    target.scene.environmentIntensity = this.environmentIntensity();
    target.scene.fog = new THREE.Fog(profile.background, profile.fogNear, profile.fogFar);
    target.scene.userData.environmentId = environment;
    target.scene.userData.toneMappingExposure = getToneMappingProfile(environment).exposure;
    target.lights.sun.color.set(profile.sunColor);
    target.lights.sun.intensity = profile.sunIntensity;
    target.lights.sun.position.set(...profile.sunPosition);
    target.lights.sun.castShadow = this.quality.shadows;
    target.lights.sun.shadow.mapSize.set(
      this.quality.shadowMapSize,
      this.quality.shadowMapSize,
    );
    target.lights.sun.shadow.radius = PLAIN_SHADOW_RADIUS_TEXELS;
    target.lights.sun.shadow.bias = -0.00015;
    target.lights.sun.shadow.normalBias = this.quality.id === 'high' ? 0.025 : 0.04;
    target.lights.sun.shadow.camera.near = 1;
    target.lights.sun.shadow.camera.far = 105;
    target.lights.sun.shadow.needsUpdate = true;
    target.lights.ambient.color.set(profile.skyColor);
    target.lights.ambient.groundColor.set(profile.groundColor);
    target.lights.ambient.intensity = profile.ambientIntensity;
    // 換場景或換畫質會重寫上面的固定數值；已經有算出來的光時，再蓋回去。
    if (this.currentLighting) this.writeLighting(this.currentLighting, target);
  }

  applyLighting(lighting: SceneLighting, target: EnvironmentTarget) {
    if (this.disposed) return;
    this.currentLighting = lighting;
    this.currentTarget = target;
    this.writeLighting(lighting, target);
  }

  /** 距離柔化的陰影過濾裝好了沒有；沒裝時負的 `shadow.radius` 沒有意義，所以一律用固定半徑。 */
  setSoftShadows(available: boolean) {
    if (this.disposed || this.softShadows === available) return;
    this.softShadows = available;
    if (this.currentLighting && this.currentTarget) this.writeLighting(this.currentLighting, this.currentTarget);
  }

  private environmentIntensity() {
    return this.quality.id === 'high' ? 0.64 : 0.46;
  }

  private writeLighting(lighting: SceneLighting, target: EnvironmentTarget) {
    const { scene, lights } = target;
    lights.sun.color.setRGB(...lighting.keyColor);
    lights.sun.intensity = lighting.keyIntensity;
    aimKeyLight(lights.sun, lighting);
    // 影子邊緣：高畫質依遮蔽物的距離與天氣決定柔度，其餘級別用固定半徑。
    if (this.quality.shadows && this.quality.shadowMapSize > 0) {
      lights.sun.shadow.radius = shadowFilterRadius({
        angularRadius: lighting.keyAngularRadius,
        coverageMetres: lighting.shadowFocus.radius * 2,
        mapSize: this.quality.shadowMapSize,
        distanceSoftening: this.softShadows && this.quality.id === 'high',
      });
    }
    lights.ambient.color.setRGB(...lighting.skyColor);
    lights.ambient.groundColor.setRGB(...lighting.groundColor);
    // 天空的漫射光由半球光和環境貼圖一起提供：有環境貼圖時它已經照亮了一部分，半球光只補剩下的，
    // 兩者加起來才是算出來的天光；否則同一片天空會被算兩次，影子裡太亮、整個畫面發白。
    const environmentShare = this.quality.id === 'low' ? 0 : this.environmentIntensity();
    lights.ambient.intensity = lighting.skyIntensity * (1 - environmentShare);
    // 水的著色器不吃環境貼圖，它要的是整片天空的照度。
    lights.ambient.userData.skyIrradiance = lighting.skyIntensity;
    if (scene.background instanceof THREE.Color) scene.background.setRGB(...lighting.horizon);
    else scene.background = new THREE.Color().setRGB(...lighting.horizon);
    // 霧固定用同一個物件：漫遊的水下霧會暫時換掉 scene.fog 並記住原本那一個，
    // 之後換回來的必須是仍在更新的這一個，而不是某個時刻的舊顏色。
    this.lightingFog ??= new THREE.Fog(0x000000, lighting.fog.near, lighting.fog.far);
    this.lightingFog.color.setRGB(...lighting.horizon);
    this.lightingFog.near = lighting.fog.near;
    this.lightingFog.far = lighting.fog.far;
    if (!(scene.fog instanceof THREE.FogExp2)) scene.fog = this.lightingFog;
    scene.userData.toneMappingExposure = lighting.exposure;

    // 天空：同一份光照狀態畫出來的天空球，蓋住單色背景。
    this.sky ??= new SkyDome();
    this.sky.setCloudDetail(this.quality.id !== 'low');
    if (this.sky.mesh.parent !== scene) scene.add(this.sky.mesh);
    this.sky.update(lighting);
    this.skyEnvironmentStale = true;
    scene.environmentIntensity = this.environmentIntensity() * this.environmentScale(lighting);
  }

  /**
   * 環境貼圖相對於基準強度的倍率。由天空產生的那一張本身就帶著當時的亮度，
   * 重新產生之前先按天光強度的比例縮放，拖動時刻時倒影的明暗才跟得上。
   */
  private environmentScale(lighting: SceneLighting) {
    if (!this.skyEnvironment || this.quality.id === 'low') return lighting.environmentScale;
    return Math.min(4, lighting.skyIntensity / Math.max(this.skyEnvironment.skyIntensity, 1e-3));
  }

  /** 診斷用：倒影與間接光目前來自天空、固定的環境圖，或沒有（省電級）。 */
  get environmentSource(): 'sky' | 'fixed' | 'none' {
    const environment = this.currentTarget?.scene.environment ?? null;
    if (!environment) return 'none';
    return environment === this.skyEnvironment?.map ? 'sky' : 'fixed';
  }

  /**
   * 依目前的天空重新產生倒影與間接光用的環境貼圖。產生一次要把天空畫六個方向再做多層模糊，
   * 比其他更新貴得多，所以不在每次光線改變時做，由呼叫端在時刻停下來之後呼叫。
   * 有重新產生就回傳 true。
   */
  refreshEnvironment(): boolean {
    const target = this.currentTarget;
    const lighting = this.currentLighting;
    if (this.disposed || !target || !lighting || !this.sky || !this.skyEnvironmentStale) return false;
    if (this.quality.id === 'low' || !this.mapFactory.createFromScene) return false;
    this.skyEnvironmentStale = false;
    this.skyEnvironment = {
      map: this.mapFactory.createFromScene(this.sky.environmentScene),
      skyIntensity: lighting.skyIntensity,
    };
    target.scene.environment = this.skyEnvironment.map;
    target.scene.environmentIntensity = this.environmentIntensity();
    return true;
  }

  setQuality(profile: RenderQualityProfile) {
    if (this.disposed) return;
    this.quality = profile;
    // 省電級沒有環境貼圖；回到其他級別時，當初那一張可能已經不是現在的天空。
    this.skyEnvironmentStale = this.sky !== null;
    if (this.currentTarget) this.apply(this.currentEnvironment, this.currentTarget);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.currentTarget) this.currentTarget.scene.environment = null;
    this.sky?.dispose();
    this.sky = null;
    this.skyEnvironment = null;
    this.sourceTexture?.dispose();
    this.mapFactory.dispose();
    this.currentTarget = null;
  }
}
