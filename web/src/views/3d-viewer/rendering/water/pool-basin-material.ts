import * as THREE from 'three';
import poolBasinChunk from './shaders/pool-basin.glsl?raw';
import fragmentSource from './shaders/pool-basin.frag.glsl?raw';
import vertexShader from './shaders/pool-basin.vert.glsl?raw';

/**
 * `pool-basin.glsl` 宣告的 uniform。池體材質直接沿用水面材質的同一批 uniform 物件，
 * 所以時間、太陽、焦散只要更新一次，水面折射看到的池底與實體池底永遠一致。
 */
export const POOL_BASIN_UNIFORM_NAMES = Object.freeze([
  'uPoolMin', 'uPoolMax', 'uWaterLevel', 'uShallowBottom', 'uDeepBottom',
  'uTileSize', 'uGroutWidth', 'uTileColor', 'uGroutColor',
  'uLaneLineColor', 'uLaneLineWidth', 'uLaneLineInset', 'uLaneLineZ',
  'uAbsorption', 'uScatterColor', 'uSunDirection', 'uSunColor', 'uSkyColor',
  'uTime', 'uCaustics', 'uCausticLayers', 'uCausticStrength',
  'uSubmergedBoxCount', 'uSubmergedBoxMin', 'uSubmergedBoxMax', 'uSubmergedBoxFinish',
] as const);

/**
 * 實體池底與池壁的材質。
 *
 * @param waterUniforms 水面材質的 uniforms；共用的項目以同一個物件傳入（不複製）。
 * @param worldToBasin 世界座標轉到水面網格物件座標的矩陣。
 */
export function createPoolBasinMaterial(
  waterUniforms: Readonly<Record<string, THREE.IUniform>>,
  worldToBasin: THREE.Matrix4,
): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uWorldToBasin: { value: worldToBasin.clone() },
  };
  for (const name of POOL_BASIN_UNIFORM_NAMES) {
    const shared = waterUniforms[name];
    if (!shared) throw new TypeError(`Water material is missing the shared uniform ${name}.`);
    uniforms[name] = shared;
  }
  return new THREE.ShaderMaterial({
    name: 'realistic:pool-basin',
    vertexShader,
    fragmentShader: fragmentSource.replace('// #include pool-basin', poolBasinChunk),
    uniforms,
    fog: true,
    clipping: true,
    // 池體的面從池內、池外（剖面視角）都看得到。
    side: THREE.DoubleSide,
    // 池壁上緣和池畔方塊的內側面在同一個平面上；往鏡頭方向偏一點，池壁才不會被池畔的面蓋掉。
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
}
