#include <common>
#include <fog_pars_vertex>
#include <clipping_planes_pars_vertex>

uniform float uTime;
// 每一道波：xy 是在水平面上的前進方向（單位向量），z 是波長（公尺），w 是振幅（公尺）。
uniform vec4 uWaves[4];

varying vec3 vLocalPosition;
varying vec3 vWaveNormal;

void main() {
  vec3 displaced = position;
  vec2 gradient = vec2(0.0);

  for (int index = 0; index < 4; index += 1) {
    vec4 wave = uWaves[index];
    float waveNumber = 6.2831853 / wave.z;
    // 重力波的色散關係：波長越長跑得越快。
    float phase = waveNumber * dot(wave.xy, position.xz) - sqrt(9.81 * waveNumber) * uTime;
    displaced.y += wave.w * sin(phase);
    gradient += wave.w * waveNumber * cos(phase) * wave.xy;
  }

  vLocalPosition = displaced;
  vWaveNormal = normalize(vec3(-gradient.x, 1.0, -gradient.y));

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  #include <clipping_planes_vertex>
  #include <fog_vertex>
}
