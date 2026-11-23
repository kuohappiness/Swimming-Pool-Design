// 屋頂接到多少雨：只做「雨量 × 屋頂水平投影面積」的幾何換算，供水循環頁使用。
// 這是落在屋頂上的雨水總量，沒有扣掉蒸發、濺出、初雨分流與溢流，不是可回收量；
// 逕流係數、儲水槽容量與用水量都還沒有設計值（OPEN-014），所以這裡不估。

const MONTH_COUNT = 12;
/** 暖季是 5～9 月，和日照研究用的季節一致。 */
export const WARM_SEASON_MONTHS = [5, 6, 7, 8, 9];
const EARTH_RADIUS_KM = 6371.0088;

const requireFinite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number.`);
  return value;
};

const requirePositive = (value, name) => {
  if (!(requireFinite(value, name) > 0)) throw new RangeError(`${name} must be greater than zero.`);
  return value;
};

/** Horizontal projection of an axis-aligned roof, in m². */
export function roofPlanArea(bounds) {
  const width =
    requireFinite(bounds?.x2, 'roof bounds x2') - requireFinite(bounds?.x1, 'roof bounds x1');
  const depth =
    requireFinite(bounds?.y2, 'roof bounds y2') - requireFinite(bounds?.y1, 'roof bounds y1');
  return requirePositive(width, 'roof width') * requirePositive(depth, 'roof depth');
}

/** Great-circle distance between two points given in decimal degrees, in km. */
export function distanceKm(from, to) {
  const radians = (degrees) => (requireFinite(degrees, 'coordinate') * Math.PI) / 180;
  const deltaLatitude = radians(to.latitude) - radians(from.latitude);
  const deltaLongitude = radians(to.longitude) - radians(from.longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Rain falling on a roof, month by month.
 * 1 mm of rain on 1 m² is 1 litre, so volume in m³ is `mm × m² ÷ 1000`.
 */
export function roofRainfall({ roofAreaM2, monthlyMm, annualMm }) {
  requirePositive(roofAreaM2, 'roof area');
  if (!Array.isArray(monthlyMm) || monthlyMm.length !== MONTH_COUNT) {
    throw new TypeError(`monthly rainfall needs exactly ${MONTH_COUNT} values.`);
  }
  const months = monthlyMm.map((millimetres, index) => {
    if (!(requireFinite(millimetres, `rainfall of month ${index + 1}`) >= 0)) {
      throw new RangeError(`rainfall of month ${index + 1} must not be negative.`);
    }
    return { month: index + 1, millimetres, volumeM3: (millimetres * roofAreaM2) / 1000 };
  });
  const totalMm = months.reduce((total, { millimetres }) => total + millimetres, 0);
  // The published annual value is the owner; refuse a transcription whose months do not add up to it.
  if (
    annualMm !== undefined &&
    Math.abs(totalMm - requireFinite(annualMm, 'annual rainfall')) > 0.5
  ) {
    throw new RangeError(
      `monthly rainfall adds up to ${totalMm.toFixed(1)} mm, not the stated ${annualMm} mm.`,
    );
  }
  const annual = annualMm ?? totalMm;
  const warmMm = months
    .filter(({ month }) => WARM_SEASON_MONTHS.includes(month))
    .reduce((total, { millimetres }) => total + millimetres, 0);
  const coolMm = totalMm - warmMm;
  const byRain = [...months].sort((left, right) => left.millimetres - right.millimetres);
  return {
    roofAreaM2,
    months,
    annualMm: annual,
    annualVolumeM3: (annual * roofAreaM2) / 1000,
    warmSeasonMm: warmMm,
    warmSeasonVolumeM3: (warmMm * roofAreaM2) / 1000,
    warmSeasonShare: warmMm / totalMm,
    coolSeasonMm: coolMm,
    coolSeasonVolumeM3: (coolMm * roofAreaM2) / 1000,
    wettestMonth: byRain.at(-1),
    driestMonth: byRain[0],
  };
}

/**
 * Everything the water-cycle page shows: the registered rainfall normals applied to the active glass roof,
 * with the pool's water volume (owned by the active geometry) as a familiar yardstick.
 */
export function buildWaterCycleData({ rainfallSource, roofBounds, poolVolumeM3, site }) {
  const rainfall = roofRainfall({
    roofAreaM2: roofPlanArea(roofBounds),
    monthlyMm: rainfallSource?.monthlyPrecipitation?.values,
    annualMm: rainfallSource?.monthlyPrecipitation?.annual,
  });
  requirePositive(poolVolumeM3, 'pool volume');
  return {
    sourceId: rainfallSource.id,
    provider: rainfallSource.provider,
    statisticalPeriod: rainfallSource.statisticalPeriod,
    retrievedOn: rainfallSource.retrievedOn,
    stationName: rainfallSource.station.name,
    stationNumber: rainfallSource.station.number,
    stationDistanceKm: distanceKm(site, rainfallSource.station),
    unit: rainfallSource.monthlyPrecipitation.unit,
    ...rainfall,
    poolVolumeM3,
    annualVolumeInPools: rainfall.annualVolumeM3 / poolVolumeM3,
  };
}
