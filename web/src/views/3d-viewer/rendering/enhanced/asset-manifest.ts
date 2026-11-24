import manifestData from '../../assets/asset-manifest.json';
import type { RenderQualityTier } from '../quality-profile';

type VisualAssetKind = 'texture' | 'environment' | 'model';
type VisualAssetRequirement = 'required' | 'optional';
type VisualAssetLoadingPriority = 'viewer-ready' | 'scene-ready' | 'deferred';

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
  /** 由 `npm run build:textures` 轉出的檔案才有：轉檔設定與來源像素的雜湊。 */
  readonly conversion?: VisualAssetConversion;
}

interface VisualAssetConversion {
  readonly encoder: string;
  readonly format: 'uastc' | 'etc1s';
  readonly width: number;
  readonly height: number;
  readonly mipmaps: boolean;
  readonly colorSpace: 'srgb' | 'linear';
  readonly normalMap: boolean;
  readonly sourceSha256: string;
}

/**
 * 資產清單的唯一來源是 `assets/asset-manifest.json`：網站讀它決定載入什麼，
 * `npm run build:textures` 轉檔後把雜湊與大小寫回同一份。JSON 沒有型別保護，
 * 所以列舉值在 `assertVisualAssetManifest` 逐項檢查。
 */
export const VISUAL_ASSET_MANIFEST: readonly VisualAssetManifestEntry[] = Object.freeze(
  (manifestData.assets as unknown as VisualAssetManifestEntry[]).map((asset) =>
    Object.freeze({
      ...asset,
      qualityTiers: Object.freeze([...asset.qualityTiers]),
      ...(asset.conversion ? { conversion: Object.freeze({ ...asset.conversion }) } : {}),
    }),
  ),
);

const VALID_TIERS = new Set<RenderQualityTier>(['high', 'medium', 'low']);
const VALID_KINDS = new Set<VisualAssetKind>(['texture', 'environment', 'model']);
const VALID_REQUIREMENTS = new Set<VisualAssetRequirement>(['required', 'optional']);
const VALID_PRIORITIES = new Set<VisualAssetLoadingPriority>([
  'viewer-ready',
  'scene-ready',
  'deferred',
]);
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
      !asset.localPath.startsWith('assets/') ||
      asset.localPath.includes('\\') ||
      asset.localPath.includes('..') ||
      EXTERNAL_URL.test(asset.localPath) ||
      paths.has(asset.localPath)
    ) {
      throw new TypeError(
        `Visual asset localPath must be unique and repository-local: ${asset.localPath}`,
      );
    }
    paths.add(asset.localPath);

    if (
      !VALID_KINDS.has(asset.kind) ||
      !VALID_REQUIREMENTS.has(asset.requirement) ||
      !VALID_PRIORITIES.has(asset.loadingPriority)
    ) {
      throw new TypeError(
        `Visual asset kind, requirement or loading priority is invalid: ${asset.id}`,
      );
    }
    if (!asset.source || !asset.author || !asset.license || !asset.purpose) {
      throw new TypeError(`Visual asset provenance is incomplete: ${asset.id}`);
    }
    if (!/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw new TypeError(`Visual asset SHA-256 is invalid: ${asset.id}`);
    }
    if (!Number.isSafeInteger(asset.byteSize) || asset.byteSize <= 0) {
      throw new TypeError(`Visual asset byteSize is invalid: ${asset.id}`);
    }
    if (
      asset.qualityTiers.length === 0 ||
      asset.qualityTiers.some((tier) => !VALID_TIERS.has(tier))
    ) {
      throw new TypeError(`Visual asset quality tiers are invalid: ${asset.id}`);
    }
    if (asset.localPath.endsWith('.ktx2') !== Boolean(asset.conversion)) {
      throw new TypeError(
        `Visual asset conversion record must exist exactly for .ktx2 files: ${asset.id}`,
      );
    }
    if (asset.conversion && !/^[a-f0-9]{64}$/.test(asset.conversion.sourceSha256)) {
      throw new TypeError(`Visual asset conversion source hash is invalid: ${asset.id}`);
    }
    if (asset.loadingPriority === 'viewer-ready' && asset.requirement !== 'required') {
      throw new TypeError(`Viewer-ready assets must be required: ${asset.id}`);
    }
  }

  return manifest;
}

function getVisualAssetsForTier(
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
