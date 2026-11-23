import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * 暈光（TASK-152 步驟 6）：極亮的光源（夜裡的燈具、太陽在水面與金屬上的反光）在眼睛與鏡頭裡
 * 會往四周散開一點。只有曝光之後遠比白色亮的地方才暈：陽光下的白牆剛好到白色，不暈。
 *
 * three.js 的 `UnrealBloomPass` 原本把超過門檻的整個顏色拿去暈，五層模糊加起來還乘 3，夜裡的
 * 燈具會把整個池廳蓋成一片霧。這裡改成只暈「比門檻亮出來的那一部分」，每個像素最多貢獻
 * `cap`，窄的光暈比寬的重；暈開的總量約是亮出來那一部分的 `strength × 9`。
 */
export const BLOOM = Object.freeze({
  /** 門檻（線性亮度，曝光之後；白色約為 1）。 */
  threshold: 2,
  /** 門檻附近漸強的寬度，避免一圈硬邊。 */
  knee: 1,
  /** 一個像素最多貢獻多少亮度去暈開。 */
  cap: 8,
  strength: 0.04,
  /** 0：越寬的光暈越淡（three.js 的權重 1、0.8、0.6、0.4、0.2）。 */
  radius: 0,
});

const HIGH_PASS_FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float luminosityThreshold;
uniform float smoothWidth;
uniform float luminosityCap;

varying vec2 vUv;

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;
  float value = luminance(color);
  // 柔和的門檻：門檻前後各 smoothWidth ÷ 2 之間以二次曲線接上，之後就是超出門檻的部分。
  float knee = max(smoothWidth * 0.5, 1.0e-4);
  float soft = clamp(value - luminosityThreshold + knee, 0.0, 2.0 * knee);
  float excess = max(soft * soft / (4.0 * knee), value - luminosityThreshold);
  gl_FragColor = vec4(color * (min(excess, luminosityCap) / max(value, 1.0e-4)), 1.0);
}
`;

/** 照上面的設定建一個暈光。 */
export function createBloomPass(width: number, height: number): UnrealBloomPass {
  const pass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    BLOOM.strength,
    BLOOM.radius,
    BLOOM.threshold,
  );
  const uniforms = pass.highPassUniforms as Record<string, THREE.IUniform>;
  uniforms.smoothWidth!.value = BLOOM.knee;
  uniforms.luminosityCap = { value: BLOOM.cap };
  const original = pass.materialHighPassFilter;
  // 沿用同一份 uniform：UnrealBloomPass 每一格會把畫面與門檻寫進 highPassUniforms。
  pass.materialHighPassFilter = new THREE.ShaderMaterial({
    name: 'realistic:bloom-high-pass',
    uniforms,
    vertexShader: original.vertexShader,
    fragmentShader: HIGH_PASS_FRAGMENT,
  });
  original.dispose();
  return pass;
}

/** UnrealBloomPass 的 dispose 不釋放門檻材質，這裡補上。 */
export function disposeBloomPass(pass: UnrealBloomPass): void {
  pass.materialHighPassFilter.dispose();
  pass.dispose();
}
