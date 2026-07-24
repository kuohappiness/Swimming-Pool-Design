import * as THREE from 'three';
import { BaselineMaterialRegistry } from '../baseline-material-registry';
import type { MaterialRegistry, SemanticMaterialId } from '../contracts';
import {
  assertRenderQualityProfile,
  type RenderQualityProfile,
} from '../quality-profile';
import {
  EnhancedTextureLoader,
  REQUIRED_MATERIAL_TEXTURE_IDS,
  type TextureSourceLoader,
} from './texture-loader';

export interface EnhancedPbrMaterialRegistryOptions {
  readonly quality: RenderQualityProfile;
  readonly textureSourceLoader?: TextureSourceLoader;
}

export class EnhancedPbrMaterialRegistry implements MaterialRegistry {
  readonly id = 'enhanced-pbr-material-registry';
  readonly semanticIds: readonly SemanticMaterialId[];
  readonly textureLoader: EnhancedTextureLoader;
  private readonly baseline = new BaselineMaterialRegistry();
  private readonly overrides = new Map<SemanticMaterialId, THREE.Material>();
  private quality: RenderQualityProfile;
  private disposed = false;

  private constructor(options: EnhancedPbrMaterialRegistryOptions) {
    this.quality = assertRenderQualityProfile(options.quality);
    this.textureLoader = new EnhancedTextureLoader(this.quality, options.textureSourceLoader);
    this.semanticIds = this.baseline.semanticIds;
  }

  static async create(options: EnhancedPbrMaterialRegistryOptions) {
    const registry = new EnhancedPbrMaterialRegistry(options);
    try {
      await registry.textureLoader.preload(REQUIRED_MATERIAL_TEXTURE_IDS);
      await registry.textureLoader.load('material-water-normal-v1').catch(() => null);
      registry.createOverrides();
      registry.setQuality(options.quality);
      return registry;
    } catch (error) {
      registry.dispose();
      throw error;
    }
  }

  get(id: SemanticMaterialId): THREE.Material {
    if (this.disposed) throw new TypeError('Enhanced PBR material registry has been disposed.');
    return this.overrides.get(id) ?? this.baseline.get(id);
  }

  setQuality(profile: RenderQualityProfile) {
    if (this.disposed) return;
    this.quality = assertRenderQualityProfile(profile);
    this.textureLoader.setQuality(this.quality);
    this.baseline.setQuality(this.quality);

    const water = this.overrides.get('water') as THREE.MeshPhysicalMaterial;
    if (water) {
      water.normalMap = this.quality.enhancedWater
        ? this.optionalTexture('material-water-normal-v1')
        : null;
      water.normalScale.setScalar(this.quality.id === 'high' ? 0.34 : 0.2);
      water.needsUpdate = true;
    }
    for (const id of ['roof-glass', 'safety-glass'] as const) {
      const glass = this.overrides.get(id) as THREE.MeshPhysicalMaterial;
      glass.transmission = this.quality.id === 'low' ? 0 : id === 'safety-glass' ? 0.74 : 0.62;
      glass.opacity = this.quality.id === 'low' ? 0.48 : 0.32;
      glass.needsUpdate = true;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const material of this.overrides.values()) material.dispose();
    this.overrides.clear();
    this.textureLoader.dispose();
    this.baseline.dispose();
  }

  private optionalTexture(id: 'material-water-normal-v1') {
    try {
      return this.textureLoader.get(id);
    } catch {
      return null;
    }
  }

  private createOverrides() {
    const concreteColor = this.textureLoader.get('material-concrete-detail-v1');
    const concreteNormal = this.textureLoader.get('material-concrete-normal-v1');
    const concreteRoughness = this.textureLoader.get('material-concrete-roughness-v1');
    const poolTileColor = this.textureLoader.get('material-pool-tile-grid-v1');
    const poolTileNormal = this.textureLoader.get('material-pool-tile-normal-v1');
    const deckColor = this.textureLoader.get('material-deck-grain-v1');
    const deckNormal = this.textureLoader.get('material-deck-normal-v1');
    const concrete = (color: number, roughness: number) => new THREE.MeshStandardMaterial({
      color,
      map: concreteColor,
      normalMap: concreteNormal,
      normalScale: new THREE.Vector2(0.16, 0.16),
      roughness,
      roughnessMap: concreteRoughness,
      metalness: 0,
    });
    const roofGlass = new THREE.MeshPhysicalMaterial({
      color: 0xb9e9ef,
      roughness: 0.12,
      metalness: 0,
      transmission: 0.62,
      thickness: 0.018,
      ior: 1.5,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const safetyGlass = roofGlass.clone();
    safetyGlass.color.set(0xa8dce5);
    safetyGlass.roughness = 0.09;
    safetyGlass.transmission = 0.74;
    safetyGlass.thickness = 0.024;

    this.overrides.set('exposed-concrete-l1', concrete(0xc3c0b9, 0.9));
    this.overrides.set('exposed-concrete-l2', concrete(0xb5b2ab, 0.88));
    this.overrides.set('exposed-concrete-l3', concrete(0xa8a59e, 0.86));
    this.overrides.set('structural-steel', new THREE.MeshStandardMaterial({
      color: 0x263238,
      roughness: 0.36,
      metalness: 0.62,
    }));
    this.overrides.set('roof-glass', roofGlass);
    this.overrides.set('safety-glass', safetyGlass);
    this.overrides.set('water', new THREE.MeshPhysicalMaterial({
      color: 0x2f94ac,
      roughness: 0.1,
      metalness: 0,
      transmission: 0.52,
      thickness: 0.42,
      ior: 1.333,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    this.overrides.set('pool-basin', new THREE.MeshStandardMaterial({
      color: 0xe5eeee,
      map: poolTileColor,
      normalMap: poolTileNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.62,
      metalness: 0,
      side: THREE.DoubleSide,
    }));
    this.overrides.set('pool-deck', new THREE.MeshStandardMaterial({
      color: 0xddd7cb,
      map: deckColor,
      normalMap: deckNormal,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughness: 0.92,
      metalness: 0,
    }));
    this.overrides.set('pool-rail', new THREE.MeshStandardMaterial({
      color: 0xc7d0d2,
      roughness: 0.24,
      metalness: 0.82,
    }));
    this.overrides.set('mirror', new THREE.MeshPhysicalMaterial({
      color: 0xd7e6e8,
      roughness: 0.025,
      metalness: 1,
      clearcoat: 0.35,
      clearcoatRoughness: 0.06,
      side: THREE.DoubleSide,
    }));
    this.overrides.set('photovoltaic', new THREE.MeshPhysicalMaterial({
      color: 0x236a86,
      roughness: 0.2,
      metalness: 0.32,
      clearcoat: 0.72,
      clearcoatRoughness: 0.11,
      side: THREE.DoubleSide,
    }));

    for (const [id, material] of this.overrides) {
      material.name = `enhanced:${id}`;
      material.userData = {
        ...material.userData,
        semanticMaterialId: id,
        visualOnly: true,
      };
    }
  }
}
