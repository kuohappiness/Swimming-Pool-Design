#include <common>

// #include pool-basin

// 鏡頭在水裡時的整個畫面：場景先畫到一張貼圖（線性、未做色調映射），這裡再依每個像素
// 到鏡頭的距離加上水的吸收與散射、陽光穿過波紋形成的光束，最後才做色調映射。
// 吸收與散射的係數和水面、池體用的是同一批 uniform，所以潛下去之後的水色和從岸上看到的一致。

uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform mat4 uProjectionInverse;  // 裁剪座標轉回鏡頭座標
uniform mat4 uViewToBasin;        // 鏡頭座標轉到水面網格的物件座標
uniform vec4 uWaves[4];           // 與水面頂點著色器相同的長波，水線才會跟著水面起伏
uniform int uShaftSteps;          // 光束沿視線取樣幾次；0 不畫光束
uniform float uShaftStrength;

varying vec2 vUv;

const int MAXIMUM_SHAFT_STEPS = 16;
// 光束只算到這麼遠（公尺）；更遠的地方已經被水色蓋過。
const float SHAFT_REACH = 12.0;
// 焦散倍率高於這個值的地方才算有光束，低於的地方是光束之間的暗處。
const float SHAFT_THRESHOLD = 0.85;

float waveHeight(vec2 surfacePosition) {
  float height = 0.0;
  for (int index = 0; index < 4; index += 1) {
    vec4 wave = uWaves[index];
    float waveNumber = 6.2831853 / wave.z;
    height += wave.w * sin(waveNumber * dot(wave.xy, surfacePosition) - sqrt(9.81 * waveNumber) * uTime);
  }
  return height;
}

vec3 basinPosition(vec2 ndc, float depth) {
  vec4 view = uProjectionInverse * vec4(ndc, depth * 2.0 - 1.0, 1.0);
  return (uViewToBasin * vec4(view.xyz / view.w, 1.0)).xyz;
}

// 每個像素錯開取樣起點，少少幾次取樣也不會出現一圈一圈的階梯。
float interleavedGradientNoise(vec2 pixel) {
  return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}

// 光束用的焦散倍率：取較模糊的層，空氣中的光柱邊緣本來就比池底的光網柔和。
float shaftGain(vec3 position, vec3 towardSun) {
  float depth = max(uWaterLevel - position.y, 0.0);
  vec2 entry = position.xz + towardSun.xz * (depth / max(towardSun.y, 0.2));
  float first = textureLod(uCaustics, (entry + uCausticLayers[0].zw * uTime) * uCausticLayers[0].x, 1.5).r;
  float second = textureLod(uCaustics, (entry + uCausticLayers[1].zw * uTime) * uCausticLayers[1].x, 1.5).r;
  return min(first, second) * CAUSTIC_MAXIMUM_GAIN * CAUSTIC_ENERGY_COMPENSATION;
}

void main() {
  vec3 color = texture2D(tScene, vUv).rgb;
  vec2 ndc = vUv * 2.0 - 1.0;

  // 這個像素在近裁面上的位置在不在水裡：鏡頭半浮在水面時，畫面上半在水上、下半在水下。
  vec3 nearPosition = basinPosition(ndc, 0.0);
  bool insidePool = nearPosition.x > uPoolMin.x && nearPosition.x < uPoolMax.x
    && nearPosition.z > uPoolMin.y && nearPosition.z < uPoolMax.y;
  float below = uWaterLevel + waveHeight(nearPosition.xz) - nearPosition.y;
  float pixelHeight = fwidth(nearPosition.y) + 1.0e-6;
  float wet = insidePool ? clamp(below / pixelHeight + 0.5, 0.0, 1.0) : 0.0;

  if (wet > 0.0) {
    vec3 eye = uViewToBasin[3].xyz;
    vec3 target = basinPosition(ndc, texture2D(tDepth, vUv).x);
    float distanceToScene = distance(eye, target);
    vec3 direction = (target - eye) / max(distanceToScene, 1.0e-4);
    vec3 underwater = applyWaterColumn(color, distanceToScene);

    if (uShaftSteps > 0) {
      vec3 towardSun = -refract(-uSunDirection, vec3(0.0, 1.0, 0.0), 1.0 / WATER_IOR);
      float sunAbove = smoothstep(0.0, 0.08, uSunDirection.y);
      float reach = min(distanceToScene, SHAFT_REACH);
      float stepLength = reach / float(uShaftSteps);
      float jitter = interleavedGradientNoise(gl_FragCoord.xy);
      vec3 shafts = vec3(0.0);
      for (int index = 0; index < MAXIMUM_SHAFT_STEPS; index += 1) {
        if (index >= uShaftSteps) break;
        float along = (float(index) + jitter) * stepLength;
        vec3 position = eye + direction * along;
        float depth = uWaterLevel - position.y;
        float lit = max(shaftGain(position, towardSun) - SHAFT_THRESHOLD, 0.0) * step(0.0, depth);
        // 陽光從水面走到這一點，再從這一點走到鏡頭，兩段都被水吸收。
        shafts += waterTransmittance(max(depth, 0.0) / max(towardSun.y, 0.2) + along) * lit * stepLength;
      }
      // 水裡的微粒把光往前散射得比較多：朝著太陽看時光束最明顯。
      float forward = 0.35 + 1.65 * pow(max(dot(direction, towardSun), 0.0), 3.0);
      vec3 scatterTint = uScatterColor / max(max(uScatterColor.r, uScatterColor.g), max(uScatterColor.b, 1.0e-4));
      underwater += uSunColor * sunAbove * scatterTint * shafts * forward * uShaftStrength;
    }

    // 水線：水面貼在鏡頭上的那一道彎月面，比兩邊暗一點。
    float meniscus = 1.0 - smoothstep(0.0, 3.0 * pixelHeight, abs(below));
    color = mix(color, underwater, wet) * (1.0 - 0.3 * meniscus);
  }

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
