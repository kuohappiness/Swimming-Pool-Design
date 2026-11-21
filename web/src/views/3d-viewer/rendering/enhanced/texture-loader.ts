import * as THREE from 'three';
import type { RenderQualityProfile } from '../quality-profile';
import {
  assertVisualAssetManifest,
  VISUAL_ASSET_MANIFEST,
} from './asset-manifest';

export type MaterialTextureAssetId =
  | 'material-concrete-detail-v1'
  | 'material-concrete-normal-v1'
  | 'material-concrete-roughness-v1'
  | 'material-pool-tile-grid-v1'
  | 'material-pool-tile-normal-v1'
  | 'material-deck-grain-v1'
  | 'material-deck-normal-v1'
  | 'material-water-normal-v1';

type TextureChannel = 'color' | 'normal' | 'roughness';

interface TextureDefinition {
  readonly url: string;
  readonly channel: TextureChannel;
  readonly metresPerRepeat: number;
}

export interface TextureSourceLoader {
  loadTexture(url: string, id: MaterialTextureAssetId): Promise<THREE.Texture>;
}

const TEXTURE_DEFINITIONS: Readonly<Record<MaterialTextureAssetId, TextureDefinition>> =
  Object.freeze({
    'material-concrete-detail-v1': {
      url: new URL('../../assets/materials/concrete-detail.svg', import.meta.url).href,
      channel: 'color',
      metresPerRepeat: 1.2,
    },
    'material-concrete-normal-v1': {
      url: new URL('../../assets/materials/concrete-normal.svg', import.meta.url).href,
      channel: 'normal',
      metresPerRepeat: 1.2,
    },
    'material-concrete-roughness-v1': {
      url: new URL('../../assets/materials/concrete-roughness.svg', import.meta.url).href,
      channel: 'roughness',
      metresPerRepeat: 1.2,
    },
    'material-pool-tile-grid-v1': {
      url: new URL('../../assets/materials/pool-tile-grid.svg', import.meta.url).href,
      channel: 'color',
      metresPerRepeat: 0.25,
    },
    'material-pool-tile-normal-v1': {
      url: new URL('../../assets/materials/pool-tile-normal.svg', import.meta.url).href,
      channel: 'normal',
      metresPerRepeat: 0.25,
    },
    'material-deck-grain-v1': {
      url: new URL('../../assets/materials/deck-grain.svg', import.meta.url).href,
      channel: 'color',
      metresPerRepeat: 0.8,
    },
    'material-deck-normal-v1': {
      url: new URL('../../assets/materials/deck-normal.svg', import.meta.url).href,
      channel: 'normal',
      metresPerRepeat: 0.8,
    },
    'material-water-normal-v1': {
      url: new URL('../../assets/materials/water-normal.svg', import.meta.url).href,
      channel: 'normal',
      metresPerRepeat: 2,
    },
  });

const DEFAULT_SOURCE_LOADER: TextureSourceLoader = {
  async loadTexture(url) {
    return new THREE.TextureLoader().loadAsync(url);
  },
};

export const REQUIRED_MATERIAL_TEXTURE_IDS = Object.freeze([
  'material-concrete-detail-v1',
  'material-concrete-normal-v1',
  'material-concrete-roughness-v1',
  'material-pool-tile-grid-v1',
  'material-pool-tile-normal-v1',
  'material-deck-grain-v1',
  'material-deck-normal-v1',
] as const satisfies readonly MaterialTextureAssetId[]);

export class EnhancedTextureLoader {
  private readonly sourceLoader: TextureSourceLoader;
  private readonly promises = new Map<MaterialTextureAssetId, Promise<THREE.Texture>>();
  private readonly textures = new Map<MaterialTextureAssetId, THREE.Texture>();
  private quality: RenderQualityProfile;
  private disposed = false;

  constructor(
    quality: RenderQualityProfile,
    sourceLoader: TextureSourceLoader = DEFAULT_SOURCE_LOADER,
  ) {
    assertVisualAssetManifest();
    this.quality = quality;
    this.sourceLoader = sourceLoader;
  }

  async load(id: MaterialTextureAssetId): Promise<THREE.Texture> {
    if (this.disposed) throw new TypeError('Enhanced texture loader has been disposed.');
    const cached = this.promises.get(id);
    if (cached) return cached;
    const definition = TEXTURE_DEFINITIONS[id];
    const manifestEntry = VISUAL_ASSET_MANIFEST.find((entry) => entry.id === id);
    if (!definition || !manifestEntry || manifestEntry.kind !== 'texture') {
      throw new TypeError(`Enhanced texture is not registered: ${id}`);
    }
    const promise = this.sourceLoader.loadTexture(definition.url, id).then((texture) => {
      if (this.disposed) {
        texture.dispose();
        throw new TypeError('Enhanced texture loader was disposed during loading.');
      }
      texture.name = `enhanced:${id}`;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1 / definition.metresPerRepeat, 1 / definition.metresPerRepeat);
      texture.colorSpace = definition.channel === 'color'
        ? THREE.SRGBColorSpace
        : THREE.NoColorSpace;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.userData = {
        ...texture.userData,
        assetId: id,
        channel: definition.channel,
        localPath: manifestEntry.localPath,
        metresPerRepeat: definition.metresPerRepeat,
      };
      this.textures.set(id, texture);
      this.applyQuality(texture);
      return texture;
    });
    this.promises.set(id, promise);
    return promise;
  }

  async preload(ids: readonly MaterialTextureAssetId[]) {
    return Promise.all(ids.map((id) => this.load(id)));
  }

  get(id: MaterialTextureAssetId): THREE.Texture {
    if (this.disposed) throw new TypeError('Enhanced texture loader has been disposed.');
    const texture = this.textures.get(id);
    if (!texture) throw new TypeError(`Enhanced texture has not finished loading: ${id}`);
    return texture;
  }

  setQuality(profile: RenderQualityProfile) {
    if (this.disposed) return;
    this.quality = profile;
    for (const texture of this.textures.values()) this.applyQuality(texture);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
    this.promises.clear();
  }

  private applyQuality(texture: THREE.Texture) {
    texture.anisotropy = this.quality.textureTier === 'high'
      ? 8
      : this.quality.textureTier === 'medium' ? 4 : 1;
    texture.needsUpdate = true;
  }
}
