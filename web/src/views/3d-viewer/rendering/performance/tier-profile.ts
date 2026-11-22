import type { RenderQualityProfile } from '../quality-profile';
import type { RealismTier, ShedStep } from './realism-tiers';

/** 卸載「水面倒影解析度」時，倒影貼圖的邊長剩下的比例。 */
export const SHED_REFLECTION_RATIO = 0.5;

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
  shed: readonly ShedStep[] = [],
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
    // 幀率吃緊時調節器先把倒影的解析度減半（面積剩四分之一），而不是直接關掉倒影。
    waterReflectionScale: shed.includes('water-reflection-resolution')
      ? tier.waterReflectionScale * SHED_REFLECTION_RATIO
      : tier.waterReflectionScale,
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
