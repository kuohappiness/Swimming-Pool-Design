import * as THREE from 'three';
import { SKY_NOON_INTENSITY, type LinearColor, type SiteVector, type SunLighting } from './sun-lighting';

/**
 * 把 `SunLighting`（SITE 座標、與繪圖無關）換成場景可以直接套用的數值（three.js 世界座標）。
 * 座標轉換只用場景自己的 siteRoot 矩陣，所以模型怎麼擺，光就跟著怎麼轉，不會有第二份方位。
 */
export interface SceneLighting {
  readonly source: SunLighting;
  /** 指向主光源的單位向量（世界座標）。 */
  readonly keyDirection: THREE.Vector3;
  /** 指向太陽的單位向量（世界座標）；太陽在地平線下時 y 為負。天空用它，不用主光源的方向。 */
  readonly sunDirection: THREE.Vector3;
  /** 指向月亮的單位向量（世界座標）。 */
  readonly moonDirection: THREE.Vector3;
  readonly keyColor: LinearColor;
  readonly keyIntensity: number;
  /** 主光源看起來的半徑（弧度）；影子邊緣的柔度由它決定。 */
  readonly keyAngularRadius: number;
  readonly skyColor: LinearColor;
  readonly groundColor: LinearColor;
  readonly skyIntensity: number;
  readonly horizon: LinearColor;
  readonly fog: { readonly near: number; readonly far: number };
  readonly exposure: number;
  /** 環境貼圖（倒影與間接光）相對於晴天正午的亮度，0 到 1。 */
  readonly environmentScale: number;
  /** 陰影要涵蓋的範圍：世界座標的球。 */
  readonly shadowFocus: { readonly centre: THREE.Vector3; readonly radius: number };
}

export interface ShadowFocusSource {
  /** SITE 座標的範圍（公尺）。 */
  readonly bounds: { readonly x1: number; readonly x2: number; readonly y1: number; readonly y2: number };
  readonly height: number;
  /** 往外多留的距離：旋轉後超出基地的樓層、雨庇與地面上的影子。 */
  readonly margin: number;
}

/** SITE 座標（Z 向上）的方向換成世界座標。siteRoot 的子座標是 X、高度、SITE-Y。 */
export function siteDirectionToWorld(direction: SiteVector, siteRoot: THREE.Object3D, out = new THREE.Vector3()) {
  siteRoot.updateWorldMatrix(true, false);
  return out.set(direction.x, direction.z, direction.y).transformDirection(siteRoot.matrixWorld);
}

export function deriveShadowFocus(source: ShadowFocusSource, siteRoot: THREE.Object3D) {
  const { bounds, height, margin } = source;
  if (![bounds.x1, bounds.x2, bounds.y1, bounds.y2, height, margin].every(Number.isFinite)
    || bounds.x2 <= bounds.x1 || bounds.y2 <= bounds.y1 || height <= 0 || margin < 0) {
    throw new TypeError('Shadow focus bounds are invalid.');
  }
  siteRoot.updateWorldMatrix(true, false);
  const centre = new THREE.Vector3(
    (bounds.x1 + bounds.x2) / 2,
    height / 2,
    (bounds.y1 + bounds.y2) / 2,
  ).applyMatrix4(siteRoot.matrixWorld);
  const radius = Math.hypot(
    (bounds.x2 - bounds.x1) / 2 + margin,
    (bounds.y2 - bounds.y1) / 2 + margin,
    height / 2,
  );
  return Object.freeze({ centre, radius });
}

export function toSceneLighting(
  lighting: SunLighting,
  siteRoot: THREE.Object3D,
  shadowFocus: SceneLighting['shadowFocus'],
): SceneLighting {
  return Object.freeze({
    source: lighting,
    keyDirection: siteDirectionToWorld(lighting.key.direction, siteRoot),
    sunDirection: siteDirectionToWorld(lighting.sunDirection, siteRoot),
    moonDirection: siteDirectionToWorld(lighting.moonDirection, siteRoot),
    keyColor: lighting.key.color,
    keyIntensity: lighting.key.intensity,
    keyAngularRadius: lighting.key.angularRadius,
    skyColor: lighting.sky.color,
    groundColor: lighting.sky.groundColor,
    skyIntensity: lighting.sky.intensity,
    horizon: lighting.horizon,
    fog: lighting.fog,
    exposure: lighting.exposure,
    environmentScale: Math.min(1, lighting.sky.intensity / SKY_NOON_INTENSITY),
    shadowFocus,
  });
}

/**
 * 把主光源擺到「陰影範圍的球」外面，並讓陰影相機剛好包住這顆球。
 * 太陽移動時，陰影貼圖涵蓋的範圍不變，解析度也就不會忽大忽小。
 */
export function aimKeyLight(light: THREE.DirectionalLight, lighting: SceneLighting) {
  const { centre, radius } = lighting.shadowFocus;
  const distance = radius * 2;
  light.target.position.copy(centre);
  light.position.copy(centre).addScaledVector(lighting.keyDirection, distance);
  light.target.updateMatrixWorld();
  light.updateMatrixWorld();
  const camera = light.shadow.camera;
  camera.left = -radius;
  camera.right = radius;
  camera.top = radius;
  camera.bottom = -radius;
  camera.near = Math.max(0.5, distance - radius);
  camera.far = distance + radius;
  camera.updateProjectionMatrix();
  light.shadow.needsUpdate = true;
}
