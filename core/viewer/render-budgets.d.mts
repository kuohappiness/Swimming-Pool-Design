export type RealismTierBudgetId = 'ultra' | 'high' | 'medium' | 'saver';

export interface RenderBudget {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly downloadBytes: number;
}

export interface AssetFileLimits {
  readonly textureBytes: number;
  readonly modelBytes: number;
  readonly audioBytes: number;
  readonly otherBytes: number;
  readonly totalBytes: number;
}

export interface AssetFileRecord {
  readonly path: string;
  readonly byteSize: number;
}

export const REALISM_TIER_IDS: readonly RealismTierBudgetId[];
export const RENDER_BUDGETS: Readonly<Record<RealismTierBudgetId, RenderBudget>>;
export const ASSET_FILE_LIMITS: AssetFileLimits;
export const ASSET_EXTENSION_KINDS: Readonly<Record<string, 'texture' | 'model' | 'audio' | 'other'>>;

export function isRealismTierId(value: unknown): value is RealismTierBudgetId;
export function assertRenderBudgets(
  budgets?: Readonly<Record<RealismTierBudgetId, RenderBudget>>,
): Readonly<Record<RealismTierBudgetId, RenderBudget>>;
export function findAssetBudgetErrors(
  files: readonly AssetFileRecord[],
  limits?: AssetFileLimits,
): string[];
export function formatBytes(bytes: number): string;
