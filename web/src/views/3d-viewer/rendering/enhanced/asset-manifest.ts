import type { RenderQualityTier } from '../quality-profile';

export type VisualAssetKind = 'texture' | 'environment' | 'model';
export type VisualAssetRequirement = 'required' | 'optional';
export type VisualAssetLoadingPriority = 'viewer-ready' | 'scene-ready' | 'deferred';

export interface VisualAssetManifestEntry {
  readonly id: string;
  readonly kind: VisualAssetKind;
  readonly purpose: string;
  readonly localPath: string;
  readonly source: string;
  readonly author: string;
  readonly license: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly qualityTiers: readonly RenderQualityTier[];
  readonly requirement: VisualAssetRequirement;
  readonly loadingPriority: VisualAssetLoadingPriority;
}

const ALL_TIERS = Object.freeze(['high', 'medium', 'low'] as const);
const HIGH_AND_MEDIUM = Object.freeze(['high', 'medium'] as const);

export const VISUAL_ASSET_MANIFEST: readonly VisualAssetManifestEntry[] = Object.freeze([
  Object.freeze({
    id: 'material-concrete-detail-v1',
    kind: 'texture',
    purpose: 'Repeatable fair-faced concrete tonal detail for semantic concrete surfaces.',
    localPath: 'assets/materials/concrete-detail.svg',
    source: 'project-authored:deterministic-svg-pattern',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    sha256: '06d0d982e229028d70ae00e76b9f2ab2352986bb17e56f1309288e29a9c9d0c8',
    byteSize: 650,
    qualityTiers: ALL_TIERS,
    requirement: 'required',
    loadingPriority: 'viewer-ready',
  }),
  Object.freeze({
    id: 'material-concrete-normal-v1',
    kind: 'texture',
    purpose: 'Repeatable tangent-space micro-normal reference for concrete surfaces.',
    localPath: 'assets/materials/concrete-normal.svg',
    source: 'project-authored:deterministic-svg-pattern',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    sha256: '3016fb3ef24a00f5f69031e4dc7de2f57fe976e41978ecdd357ba18c36c6f081',
    byteSize: 614,
    qualityTiers: ALL_TIERS,
    requirement: 'required',
    loadingPriority: 'viewer-ready',
  }),
  Object.freeze({
    id: 'material-concrete-roughness-v1',
    kind: 'texture',
    purpose: 'Repeatable roughness variation for concrete surfaces.',
    localPath: 'assets/materials/concrete-roughness.svg',
    source: 'project-authored:deterministic-svg-pattern',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    sha256: 'e6c71b5c05a18a8527c227f4cc569fb0eb0395269da97ce24597f671437851af',
    byteSize: 613,
    qualityTiers: ALL_TIERS,
    requirement: 'required',
    loadingPriority: 'viewer-ready',
  }),
  Object.freeze({
    id: 'material-pool-tile-grid-v1',
    kind: 'texture',
    purpose: 'Repeatable ceramic tile and grout reference for the pool basin.',
    localPath: 'assets/materials/pool-tile-grid.svg',
    source: 'project-authored:deterministic-svg-pattern',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    sha256: 'cad8ef48ba0311bfdfb477e64741335a3a0af0cd7b705ea5c783759f9f7f024f',
    byteSize: 482,
    qualityTiers: ALL_TIERS,
    requirement: 'required',
    loadingPriority: 'viewer-ready',
  }),
  Object.freeze({
    id: 'material-pool-tile-normal-v1',
    kind: 'texture',
    purpose: 'Repeatable tangent-space grout relief for the pool basin.',
    localPath: 'assets/materials/pool-tile-normal.svg',
    source: 'project-authored:deterministic-svg-pattern',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    sha256: 'e17fbb5613caaefe85a35e6ecc173a09f82de281e5dd15098f1f7ad23578b27b',
    byteSize: 469,
    qualityTiers: ALL_TIERS,
    requirement: 'required',
    loadingPriority: 'viewer-ready',
  }),
  Object.freeze({
    id: 'material-deck-grain-v1',
    kind: 'texture',
    purpose: 'Repeatable non-slip deck aggregate reference without geometry changes.',
    localPath: 'assets/materials/deck-grain.svg',
    source: 'project-authored:deterministic-svg-pattern',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    sha256: 'c22a840ce9df96ec3817df4d901fc6358572e4dd7e0822eb1ce03d1698707698',
    byteSize: 514,
    qualityTiers: ALL_TIERS,
    requirement: 'required',
    loadingPriority: 'viewer-ready',
  }),
  Object.freeze({
    id: 'material-deck-normal-v1',
    kind: 'texture',
    purpose: 'Repeatable tangent-space aggregate relief for pool-deck surfaces.',
    localPath: 'assets/materials/deck-normal.svg',
    source: 'project-authored:deterministic-svg-pattern',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    sha256: '097f86605e15f62cd24cf338546f0bfe1d32611a4866ce29d774ec78b4ffc554',
    byteSize: 538,
    qualityTiers: ALL_TIERS,
    requirement: 'required',
    loadingPriority: 'viewer-ready',
  }),
  Object.freeze({
    id: 'material-water-normal-v1',
    kind: 'texture',
    purpose: 'Repeatable water normal reference for the enhanced water surface.',
    localPath: 'assets/materials/water-normal.svg',
    source: 'project-authored:deterministic-svg-pattern',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    sha256: 'd950eb3a1886704841efe385efa66bd8525955d271afeb5fae9b48b0246dd5c0',
    byteSize: 670,
    qualityTiers: HIGH_AND_MEDIUM,
    requirement: 'optional',
    loadingPriority: 'scene-ready',
  }),
  Object.freeze({
    id: 'environment-courtyard-sky-v1',
    kind: 'environment',
    purpose: 'Local procedural-sky reference for reflections and scene lighting.',
    localPath: 'assets/environments/courtyard-sky.svg',
    source: 'project-authored:deterministic-equirectangular-svg',
    author: 'Swimming Pool Design contributors',
    license: 'CC0-1.0',
    sha256: '90acb2c68ba639180d5afe767a037d1e860c525df79e0a60e541effcf303c268',
    byteSize: 947,
    qualityTiers: HIGH_AND_MEDIUM,
    requirement: 'optional',
    loadingPriority: 'scene-ready',
  }),
]);

const VALID_TIERS = new Set<RenderQualityTier>(['high', 'medium', 'low']);
const EXTERNAL_URL = /^(?:https?:)?\/\//i;

export function assertVisualAssetManifest(
  manifest: readonly VisualAssetManifestEntry[] = VISUAL_ASSET_MANIFEST,
): readonly VisualAssetManifestEntry[] {
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const asset of manifest) {
    if (!asset.id || ids.has(asset.id)) {
      throw new TypeError(`Visual asset ID must be present and unique: ${asset.id}`);
    }
    ids.add(asset.id);

    if (
      !asset.localPath.startsWith('assets/')
      || asset.localPath.includes('\\')
      || asset.localPath.includes('..')
      || EXTERNAL_URL.test(asset.localPath)
      || paths.has(asset.localPath)
    ) {
      throw new TypeError(`Visual asset localPath must be unique and repository-local: ${asset.localPath}`);
    }
    paths.add(asset.localPath);

    if (!asset.source || !asset.author || !asset.license || !asset.purpose) {
      throw new TypeError(`Visual asset provenance is incomplete: ${asset.id}`);
    }
    if (!/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw new TypeError(`Visual asset SHA-256 is invalid: ${asset.id}`);
    }
    if (!Number.isSafeInteger(asset.byteSize) || asset.byteSize <= 0) {
      throw new TypeError(`Visual asset byteSize is invalid: ${asset.id}`);
    }
    if (asset.qualityTiers.length === 0 || asset.qualityTiers.some((tier) => !VALID_TIERS.has(tier))) {
      throw new TypeError(`Visual asset quality tiers are invalid: ${asset.id}`);
    }
    if (asset.loadingPriority === 'viewer-ready' && asset.requirement !== 'required') {
      throw new TypeError(`Viewer-ready assets must be required: ${asset.id}`);
    }
  }

  return manifest;
}

export function getVisualAssetsForTier(
  tier: RenderQualityTier,
  manifest: readonly VisualAssetManifestEntry[] = VISUAL_ASSET_MANIFEST,
): readonly VisualAssetManifestEntry[] {
  assertVisualAssetManifest(manifest);
  return manifest.filter((asset) => asset.qualityTiers.includes(tier));
}

export function getVisualAssetByteSize(
  tier: RenderQualityTier,
  manifest: readonly VisualAssetManifestEntry[] = VISUAL_ASSET_MANIFEST,
): number {
  return getVisualAssetsForTier(tier, manifest).reduce((total, asset) => total + asset.byteSize, 0);
}
