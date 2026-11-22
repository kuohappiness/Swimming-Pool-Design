#include <common>
#include <clipping_planes_pars_vertex>

// 水裡的懸浮微粒。每一顆的位置由 0 到 1 的亂數攤到池體裡，所以池體尺寸改了不必重建幾何。

uniform vec2 uPoolMin;
uniform vec2 uPoolMax;
uniform float uWaterLevel;
uniform float uShallowBottom;
uniform float uDeepBottom;
uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uAbsorption;
uniform sampler2D uCaustics;
uniform vec4 uCausticLayers[2];
uniform float uMoteSize;        // 微粒直徑（公尺）
uniform float uViewportHeight;  // 畫布高度（像素）

attribute float aSeed;

varying vec3 vColor;
varying float vOpacity;

const float WATER_IOR = 1.333;
// 與 pool-basin.glsl 相同：灰階 1.0 代表平均照度的 4 倍，兩層取暗後補回 1.27 倍。
const float CAUSTIC_GAIN = 4.0 * 1.27;

void main() {
  // 緩慢漂移：每一顆的相位不同，幅度只有十幾公分。
  float phase = aSeed * 6.2831853;
  vec3 drift = vec3(
    sin(uTime * 0.07 + phase),
    sin(uTime * 0.11 + phase * 1.7) * 0.35,
    cos(uTime * 0.05 + phase * 2.3)
  ) * 0.15;

  float x = mix(uPoolMin.x, uPoolMax.x, position.x);
  float z = mix(uPoolMin.y, uPoolMax.y, position.z);
  float bottom = mix(uShallowBottom, uDeepBottom, position.x);
  vec3 local = vec3(x, mix(bottom + 0.05, uWaterLevel - 0.05, position.y), z) + drift;

  // 微粒飄進光束時才亮起來：和池底光網用同一張焦散圖樣。
  vec3 towardSun = -refract(-uSunDirection, vec3(0.0, 1.0, 0.0), 1.0 / WATER_IOR);
  float depth = max(uWaterLevel - local.y, 0.0);
  vec2 entry = local.xz + towardSun.xz * (depth / max(towardSun.y, 0.2));
  float first = textureLod(uCaustics, (entry + uCausticLayers[0].zw * uTime) * uCausticLayers[0].x, 1.0).r;
  float second = textureLod(uCaustics, (entry + uCausticLayers[1].zw * uTime) * uCausticLayers[1].x, 1.0).r;
  float gain = min(first, second) * CAUSTIC_GAIN;
  float sunAbove = smoothstep(0.0, 0.08, uSunDirection.y);
  vec3 sunlight = uSunColor * sunAbove * gain * exp(-uAbsorption * depth / max(towardSun.y, 0.2));
  vColor = (sunlight + uSkyColor * exp(-uAbsorption * depth) * 0.5) * 0.3183099;

  vec4 mvPosition = modelViewMatrix * vec4(local, 1.0);
  float viewDistance = -mvPosition.z;
  // 太近的會變成一大團，太遠的看不到：只留 0.3 到 5 公尺之間的。
  vOpacity = smoothstep(0.15, 0.5, viewDistance) * (1.0 - smoothstep(2.5, 5.0, viewDistance));
  gl_PointSize = clamp(
    uMoteSize * projectionMatrix[1][1] * uViewportHeight * 0.5 / max(viewDistance, 0.05),
    1.0,
    8.0
  );
  gl_Position = projectionMatrix * mvPosition;

  #include <clipping_planes_vertex>
}
