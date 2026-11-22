import type { RenderQualityProfile } from '../quality-profile';
import type { RealismTier } from './realism-tiers';

/**
 * 把四級畫質（DEC-190）套到繪圖管線吃的設定上。
 *
 * 管線內部目前仍以舊的三級（high／medium／low）決定材質與貼圖版本；`base` 是該舊級別的
 * 完整設定，這裡只覆寫四級定義裡已經有對應開關的欄位。往後每接上一個新效果，
 * 就把它的開關從這裡帶進去，不另開第二條路。
 */
export function renderQualityProfileForTier<Profile extends RenderQualityProfile>(
  base: Profile,
  tier: RealismTier,
): Profile {
  if (base.id !== tier.legacyTier) {
    throw new TypeError(
      `Realism tier ${tier.id} expects the ${tier.legacyTier} pipeline profile, got ${base.id}.`,
    );
  }
  return Object.freeze({
    ...base,
    pixelRatioCap: tier.pixelRatioCap,
    shadows: tier.shadowCascades > 0 && base.shadows,
    shadowMapSize: tier.shadowCascades > 0 && base.shadows ? tier.shadowMapSize : 0,
  });
}

/** 實際的繪製像素比：裝置像素比不超過該級上限，再乘上調節器的動態解析度。 */
export function effectivePixelRatio(
  devicePixelRatio: number,
  tier: RealismTier,
  resolutionScale: number,
): number {
  const device = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const scale = Number.isFinite(resolutionScale)
    ? Math.min(1, Math.max(tier.minimumResolutionScale, resolutionScale))
    : 1;
  return Math.min(device, tier.pixelRatioCap) * scale;
}
