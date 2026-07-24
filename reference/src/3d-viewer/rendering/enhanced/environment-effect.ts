import * as THREE from 'three';
import type { EnvironmentId } from '../../scenes';
import type { EnvironmentEffect, EnvironmentTarget } from '../contracts';
import type { RenderQualityProfile } from '../quality-profile';
import { getToneMappingProfile } from './tone-mapping';

export interface EnvironmentTextureLoader {
  load(url: string): Promise<THREE.Texture>;
}

export interface EnvironmentMapFactory {
  create(source: THREE.Texture): THREE.Texture;
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

  dispose() {
    this.target?.dispose();
    this.target = null;
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
    let environmentMap: THREE.Texture | null = null;
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
    target.scene.environment = this.quality.id === 'low' ? null : this.environmentMap;
    target.scene.environmentIntensity = this.quality.id === 'high' ? 0.64 : 0.46;
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
    target.lights.sun.shadow.bias = -0.00015;
    target.lights.sun.shadow.normalBias = this.quality.id === 'high' ? 0.025 : 0.04;
    target.lights.sun.shadow.camera.near = 1;
    target.lights.sun.shadow.camera.far = 105;
    target.lights.sun.shadow.needsUpdate = true;
    target.lights.ambient.color.set(profile.skyColor);
    target.lights.ambient.groundColor.set(profile.groundColor);
    target.lights.ambient.intensity = profile.ambientIntensity;
  }

  setQuality(profile: RenderQualityProfile) {
    if (this.disposed) return;
    this.quality = profile;
    if (this.currentTarget) this.apply(this.currentEnvironment, this.currentTarget);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.currentTarget) this.currentTarget.scene.environment = null;
    this.sourceTexture?.dispose();
    this.mapFactory.dispose();
    this.currentTarget = null;
  }
}
