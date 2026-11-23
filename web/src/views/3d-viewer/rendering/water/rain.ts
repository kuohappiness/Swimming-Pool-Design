import * as THREE from 'three';
import type { SunLighting, Weather } from '../lighting/sun-lighting';
import curtainFragmentShader from './shaders/rain-curtain.frag.glsl?raw';
import curtainVertexShader from './shaders/rain-curtain.vert.glsl?raw';
import rainOnGlassGlsl from './shaders/rain-on-glass.glsl?raw';

/**
 * 雨（TASK-152 步驟 7）：屋頂玻璃上的水珠與水痕、屋頂低端的雨簾落進承接溝。
 *
 * 只在天氣是雨時出現，中級以上才有；省電級維持原本的示意線。雨簾的水量、
 * 承接溝的尺寸與水花都是視覺示意（`OPEN-014`），畫面上標示「概念示意」。
 *
 * - 玻璃：裝進屋頂玻璃材質（`onBeforeCompile`），不多畫任何東西。
 * - 雨簾：一片網格、一次繪製呼叫；雨天時換掉原本的 19 條示意線（那些線各是一次繪製呼叫）。
 */

export type RainQualityTier = 'high' | 'medium' | 'low';
export type RainState = 'none' | 'glass curtain';

/** 每一種天氣的雨量（0 到 1）。 */
export const RAIN_AMOUNT: Readonly<Record<Weather, number>> = Object.freeze({
  clear: 0,
  overcast: 0,
  rain: 1,
});

/** 雨簾照到的光：天光的比例。水柱是透明的，看到的是它反射的天空與透過來的背景。 */
const CURTAIN_SKY_SHARE = 0.85;
/** 主光（太陽或月亮）照在水柱上的比例；雨天的太陽隔著雲層，只剩一點。 */
const CURTAIN_KEY_SHARE = 0.08;

/** 雨的 uniform：玻璃材質與雨簾共用同一份。 */
export interface RainUniforms {
  readonly uRainAmount: THREE.IUniform<number>;
  readonly uRainTime: THREE.IUniform<number>;
}

export function createRainUniforms(): RainUniforms {
  return { uRainAmount: { value: 0 }, uRainTime: { value: 0 } };
}

const VERTEX_COMMON = '#include <common>';
const VERTEX_PROJECT = '#include <project_vertex>';
const FRAGMENT_COMMON = '#include <common>';
const FRAGMENT_NORMAL = '#include <normal_fragment_maps>';

const RAIN_VERTEX_DECLARATIONS = /* glsl */`
varying vec3 vRainWorld;
varying vec3 vRainNormal;
`;
const RAIN_VERTEX_APPLY = /* glsl */`
vRainWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vRainNormal = normalize( mat3( modelMatrix ) * objectNormal );
`;
/**
 * 水的高度（公尺）乘在 `rainHeight` 上；法線照真正的表面坡度傾斜（和畫面解析度無關）。
 */
const RAIN_FRAGMENT_APPLY = /* glsl */`
if ( uRainAmount > 0.0 ) {
  vec3 rainNormal = normalize( vRainNormal );
  vec3 rainDownhill = vec3( 0.0, -1.0, 0.0 ) + rainNormal * rainNormal.y;
  float rainSlope = length( rainDownhill );
  rainDownhill = rainSlope > 1e-3 ? rainDownhill / rainSlope : normalize( cross( rainNormal, vec3( 0.0, 0.0, 1.0 ) ) );
  vec3 rainAcross = normalize( cross( rainNormal, rainDownhill ) );
  vec2 rainPoint = vec2( dot( vRainWorld, rainAcross ), dot( vRainWorld, rainDownhill ) );
  float rainFootprint = length( fwidth( rainPoint ) );
  float rainWater = rainHeight( rainPoint, uRainTime, rainSlope );
  // 起伏（法線）在一個像素蓋過約 3 公釐時就收掉，免得閃爍；水的霧面（不透明度）留到約 4 公分。
  float rainBump = rainWater * ( 1.0 - smoothstep( 0.003, 0.012, rainFootprint ) ) * 0.003 * uRainAmount;
  rainWater = mix( rainWater, 0.18, smoothstep( 0.01, 0.04, rainFootprint ) );
  vec3 rainDx = dFdx( -vViewPosition );
  vec3 rainDy = dFdy( -vViewPosition );
  vec3 rainR1 = cross( rainDy, normal );
  vec3 rainR2 = cross( normal, rainDx );
  float rainDet = dot( rainDx, rainR1 );
  vec3 rainGradient = sign( rainDet ) * ( dFdx( rainBump ) * rainR1 + dFdy( rainBump ) * rainR2 );
  normal = normalize( abs( rainDet ) * normal - rainGradient );
  diffuseColor.a = min( 1.0, diffuseColor.a + uRainAmount * ( 0.03 + 0.3 * rainWater ) );
}
`;

/** 只有標準材質、而且三段錨點都在才裝；找不到錨點（three.js 改版）就不裝，回報 false。 */
export function patchRainOnGlassShader(shader: { vertexShader: string; fragmentShader: string }): boolean {
  if (
    !shader.vertexShader.includes(VERTEX_COMMON)
    || !shader.vertexShader.includes(VERTEX_PROJECT)
    || !shader.fragmentShader.includes(FRAGMENT_COMMON)
    || !shader.fragmentShader.includes(FRAGMENT_NORMAL)
  ) {
    return false;
  }
  shader.vertexShader = shader.vertexShader
    .replace(VERTEX_COMMON, `${VERTEX_COMMON}\n${RAIN_VERTEX_DECLARATIONS}`)
    .replace(VERTEX_PROJECT, `${VERTEX_PROJECT}\n${RAIN_VERTEX_APPLY}`);
  shader.fragmentShader = shader.fragmentShader
    .replace(FRAGMENT_COMMON, `${FRAGMENT_COMMON}\n${rainOnGlassGlsl}`)
    .replace(FRAGMENT_NORMAL, `${FRAGMENT_NORMAL}\n${RAIN_FRAGMENT_APPLY}`);
  return true;
}

/**
 * 把雨裝進玻璃材質。`program.compiled` 為 false（省電級）時不改著色器、也不改程式的快取鍵，
 * 屋頂玻璃就和其他玻璃共用同一支程式，省電級不多編任何一支。
 */
export function installRainOnGlass(
  material: THREE.Material,
  uniforms: RainUniforms,
  program: { readonly compiled: boolean },
): boolean {
  if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial !== true) return false;
  if (material.userData.rain === uniforms) return true;
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    previous.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    if (program.compiled) patchRainOnGlassShader(shader);
  };
  material.customProgramCacheKey = function customProgramCacheKey() {
    const key = previousKey.call(this);
    return program.compiled ? `${key}|rain` : key;
  };
  material.userData.rain = uniforms;
  material.needsUpdate = true;
  return true;
}

export function createRainCurtainMaterial(uniforms: RainUniforms, top: number, bottom: number) {
  return new THREE.ShaderMaterial({
    name: 'realistic:rain-curtain',
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...uniforms,
      uCurtainTop: { value: top },
      uCurtainBottom: { value: bottom },
      uCurtainRadiance: { value: new THREE.Color(0, 0, 0) },
    },
    vertexShader: curtainVertexShader,
    fragmentShader: curtainFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
}

/** 雨簾照到的光（線性色、場景單位）。 */
export function rainCurtainRadiance(lighting: SunLighting, target = new THREE.Color()): THREE.Color {
  const sky = lighting.sky;
  const key = lighting.key;
  const keyLift = Math.max(key.direction.z, 0) * key.intensity * CURTAIN_KEY_SHARE;
  return target.setRGB(
    sky.color[0] * sky.intensity * CURTAIN_SKY_SHARE + key.color[0] * keyLift,
    sky.color[1] * sky.intensity * CURTAIN_SKY_SHARE + key.color[1] * keyLift,
    sky.color[2] * sky.intensity * CURTAIN_SKY_SHARE + key.color[2] * keyLift,
  );
}

/** 場景裡的雨簾：網格（物件座標的 y 是高程）與它取代的示意線。 */
export interface RainCurtainTargets {
  readonly curtain: THREE.Mesh;
  readonly schematic: THREE.Object3D | null;
}

export class RainEffects {
  readonly uniforms: RainUniforms = createRainUniforms();
  // 先當作省電級（不編進雨），等 setQuality 說是中級以上才編，省電級就不會多編一版。
  private readonly program = { compiled: false };
  private readonly curtainMaterial: THREE.ShaderMaterial;
  /** 雨簾第一次出現前沿用場景給的材質，省電級就不會編雨簾的著色器。 */
  private readonly placeholderMaterial: THREE.Material | THREE.Material[];
  private readonly glass = new Set<THREE.Material>();
  private tier: RainQualityTier = 'low';
  private amount = 0;
  private disposed = false;

  constructor(private readonly targets: RainCurtainTargets) {
    const geometry = targets.curtain.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box || !(box.max.y > box.min.y)) throw new TypeError('Rain curtain mesh must span a height.');
    this.curtainMaterial = createRainCurtainMaterial(this.uniforms, box.max.y, box.min.y);
    this.placeholderMaterial = targets.curtain.material;
    targets.curtain.castShadow = false;
    targets.curtain.receiveShadow = false;
    this.sync();
  }

  /** 把雨裝進屋頂玻璃（已裝過的略過）。 */
  install(glass: THREE.Material): boolean {
    const installed = installRainOnGlass(glass, this.uniforms, this.program);
    if (installed) this.glass.add(glass);
    return installed;
  }

  setQuality(tier: RainQualityTier): void {
    if (tier !== 'high' && tier !== 'medium' && tier !== 'low') {
      throw new TypeError(`Unknown rain quality tier: ${String(tier)}`);
    }
    this.tier = tier;
    this.sync();
  }

  setLighting(lighting: SunLighting): void {
    this.amount = RAIN_AMOUNT[lighting.weather] ?? 0;
    rainCurtainRadiance(lighting, this.curtainMaterial.uniforms.uCurtainRadiance.value as THREE.Color);
    this.sync();
  }

  /** 每一幀：雨的時間。減少動態時停在同一格。 */
  update(elapsedSeconds: number, reducedMotion: boolean): void {
    this.uniforms.uRainTime.value = reducedMotion ? 0 : elapsedSeconds;
  }

  get state(): RainState {
    return this.active ? 'glass curtain' : 'none';
  }

  private get active() {
    return this.tier !== 'low' && this.amount > 0;
  }

  private sync(): void {
    const active = this.active;
    const compiled = this.tier !== 'low';
    if (compiled !== this.program.compiled) {
      this.program.compiled = compiled;
      for (const material of this.glass) material.needsUpdate = true;
    }
    this.uniforms.uRainAmount.value = active ? this.amount : 0;
    if (active) this.targets.curtain.material = this.curtainMaterial;
    this.targets.curtain.visible = active;
    if (this.targets.schematic) this.targets.schematic.visible = !active;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.targets.curtain.material = this.placeholderMaterial;
    this.curtainMaterial.dispose();
  }
}
