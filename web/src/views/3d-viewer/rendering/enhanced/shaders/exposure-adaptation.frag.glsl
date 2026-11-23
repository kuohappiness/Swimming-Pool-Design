// 曝光適應：上一格適應到的平均對數亮度，往這一格測到的值靠近。變亮時快（瞳孔縮小），
// 變暗時慢（眼睛要比較久才看清暗處）。結果存在 1×1 的貼圖裡，整個過程不讀回 CPU。

uniform sampler2D tMeter;
uniform sampler2D tPrevious;
uniform float uMeterLevel;  // 測光圖最小一層（1×1）的層號
uniform float uBrighten;    // 這一格往亮處靠近的比例：1 − exp(−Δt ÷ 變亮的時間常數)
uniform float uDarken;      // 這一格往暗處靠近的比例
uniform float uReset;       // 1：直接用這一格測到的值（第一格、換場景）

varying vec2 vUv;

void main() {
  vec2 meter = textureLod(tMeter, vec2(0.5), uMeterLevel).rg;
  float measured = meter.x / max(meter.y, 1.0e-4);
  float previous = texture(tPrevious, vec2(0.5)).r;
  float rate = measured > previous ? uBrighten : uDarken;
  float adapted = uReset > 0.5 ? measured : mix(previous, measured, rate);
  gl_FragColor = vec4(adapted, measured, 0.0, 1.0);
}
