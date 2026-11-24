/**
 * 日照研究頁平面圖的座標換算（SVG 座標，y 向下）。純函式，不碰畫面。
 */

export type PlanPoint = [number, number];

/**
 * 平面圖上的方位圓心（SVG 座標）。
 * @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。
 */
export const PLAN_CENTER: PlanPoint = [280, 235];

/** 從 `origin` 沿方位角（正北 0°、順時針）走 `radius`。 */
export function pointFromAzimuth(origin: PlanPoint, azimuth: number, radius: number): PlanPoint {
  const radians = (azimuth * Math.PI) / 180;
  return [origin[0] + radius * Math.sin(radians), origin[1] - radius * Math.cos(radians)];
}

/** 以平面圖圓心為起點的 `pointFromAzimuth`。 */
export function polar(azimuth: number, radius: number): PlanPoint {
  return pointFromAzimuth(PLAN_CENTER, azimuth, radius);
}

/** 從 `origin` 朝 `target` 走 `distance`；兩點重合時回傳 `origin`。 */
export function pointFromOriginToward(
  origin: PlanPoint,
  target: PlanPoint,
  distance: number,
): PlanPoint {
  const deltaX = target[0] - origin[0];
  const deltaY = target[1] - origin[1];
  const length = Math.hypot(deltaX, deltaY);
  if (length <= 1e-9) return origin;
  return [origin[0] + (deltaX / length) * distance, origin[1] + (deltaY / length) * distance];
}

/** 以 `pivot` 為中心旋轉 `degrees`（SVG 座標，正值在畫面上順時針）。 */
export function rotateSvgPoint(point: PlanPoint, pivot: PlanPoint, degrees: number): PlanPoint {
  const radians = (degrees * Math.PI) / 180;
  const x = point[0] - pivot[0];
  const y = point[1] - pivot[1];
  return [
    pivot[0] + x * Math.cos(radians) - y * Math.sin(radians),
    pivot[1] + x * Math.sin(radians) + y * Math.cos(radians),
  ];
}

/** 太陽在平面天空圖上的位置：高度越高越靠近圓心（天頂 42、地平 178）。 */
export function skyPoint(solar: { altitude: number; azimuth: number }): PlanPoint {
  const altitude = Math.max(0, Math.min(90, solar.altitude));
  const radius = 42 + 136 * Math.cos((altitude * Math.PI) / 180);
  return polar(solar.azimuth, radius);
}

/** 角度文字：「+25.5°」「-3.0°」「0.0°」。 */
export function signed(value: number): string {
  return (value > 0 ? '+' : '') + value.toFixed(1) + '°';
}
