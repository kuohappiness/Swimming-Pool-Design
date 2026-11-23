// 鏡頭效果的整理：在畫面還是線性、未做色調映射時，套上環境遮蔽、接觸陰影與曝光。
//
// 環境遮蔽只該擋天光與燈光（間接光），接觸陰影只該擋陽光（直接光）。畫面已經畫好，分不出
// 每個像素裡兩者各占多少，所以由深度還原位置與法線，查同一張太陽陰影貼圖，估出這一點收到的
// 直接光 D 與間接光 A，再把顏色乘上 (A × 遮蔽 + D × 接觸陰影) ÷ (A + D)。陽光下的地面不會
// 被環境遮蔽壓暗，影子裡的牆角才會。
//
// 水面不套（水的著色器自己處理陰影與水色）：水面輸出的 alpha 是 0。天空的深度是 1，也不套。

uniform sampler2D tScene;
uniform highp sampler2D tDepth;
uniform sampler2D tOcclusion;      // r：環境遮蔽（已降噪）；g：接觸陰影；1 = 沒有遮擋，半解析度
uniform sampler2D tAdaptation;     // 1×1：適應到的平均對數亮度（r）
uniform highp sampler2DShadow uSunShadowMap;
uniform mat4 uSunShadowMatrix;     // 世界座標 → 陰影貼圖座標
uniform vec3 uSunShadow;           // x：有沒有陰影貼圖；y：深度偏移；z：取樣半徑（uv）
uniform mat4 uProjection;
uniform mat4 uProjectionInverse;
uniform mat4 uCameraWorld;         // 鏡頭座標 → 世界座標
uniform vec3 uTowardSun;           // 鏡頭座標，朝太陽（或月亮）的單位向量
uniform float uSunIrradiance;      // 主光源垂直照在面上的亮度（場景單位）
uniform float uSkyIrradiance;      // 整片天空照在水平面上的亮度
uniform float uFixtureIrradiance;  // 燈具照在地面的平均亮度（燈沒開是 0）
uniform vec2 uResolution;
uniform float uExposure;           // 這一刻的基準曝光（時刻與天氣）
uniform vec3 uAdaptation;          // x：目標（畫面平均亮度 ÷ 水平照度）的對數；y：適應的比例；z：最多調幾格（EV）
uniform float uLightLevelLog2;     // 這一刻水平面照度（天光 + 陽光 + 燈具）的對數

varying vec2 vUv;

vec3 viewPositionAt(vec2 uv, float depth) {
  vec4 view = uProjectionInverse * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
  return view.xyz / view.w;
}

vec3 viewPositionAt(vec2 uv) {
  return viewPositionAt(uv, texture(tDepth, uv).r);
}

// 由深度還原法線：左右、上下各取比較連續的那一邊，物件邊緣才不會拿到背景的法線。
vec3 viewNormalAt(vec2 uv, vec3 centre) {
  vec2 texel = 1.0 / uResolution;
  vec3 right = viewPositionAt(uv + vec2(texel.x, 0.0));
  vec3 left = viewPositionAt(uv - vec2(texel.x, 0.0));
  vec3 up = viewPositionAt(uv + vec2(0.0, texel.y));
  vec3 down = viewPositionAt(uv - vec2(0.0, texel.y));
  vec3 dx = abs(right.z - centre.z) < abs(centre.z - left.z) ? right - centre : centre - left;
  vec3 dy = abs(up.z - centre.z) < abs(centre.z - down.z) ? up - centre : centre - down;
  return normalize(cross(dx, dy));
}

#if SCREEN_SPACE_OCCLUSION

float sunVisibility(vec3 world, vec3 worldNormal) {
  if (uSunShadow.x <= 0.0) return 1.0;
  vec4 coordinate = uSunShadowMatrix * vec4(world + worldNormal * 0.04, 1.0);
  coordinate.xyz /= coordinate.w;
  if (any(lessThan(coordinate.xyz, vec3(0.0))) || any(greaterThan(coordinate.xyz, vec3(1.0)))) return 1.0;
  coordinate.z -= uSunShadow.y;
  float radius = uSunShadow.z;
  return 0.25 * (
    texture(uSunShadowMap, coordinate.xyz + vec3(radius, radius * 0.4, 0.0))
    + texture(uSunShadowMap, coordinate.xyz + vec3(-radius * 0.4, radius, 0.0))
    + texture(uSunShadowMap, coordinate.xyz + vec3(-radius, -radius * 0.4, 0.0))
    + texture(uSunShadowMap, coordinate.xyz + vec3(radius * 0.4, -radius, 0.0)));
}

#endif

void main() {
  vec4 scene = texture(tScene, vUv);
  vec3 color = scene.rgb;

  #if SCREEN_SPACE_OCCLUSION
  float depth = texture(tDepth, vUv).r;
  if (depth < 1.0 && scene.a > 0.0) {
    vec3 position = viewPositionAt(vUv, depth);
    vec3 normal = viewNormalAt(vUv, position);
    vec3 world = (uCameraWorld * vec4(position, 1.0)).xyz;
    vec3 worldNormal = normalize(mat3(uCameraWorld) * normal);

    float facing = max(dot(normal, uTowardSun), 0.0);
    float direct = uSunIrradiance * facing * (facing > 0.0 ? sunVisibility(world, worldNormal) : 0.0);
    float indirect = uSkyIrradiance * (0.65 + 0.35 * worldNormal.y) + uFixtureIrradiance;

    vec2 occlusion = texture(tOcclusion, vUv).rg;
    float kept = (indirect * occlusion.r + direct * occlusion.g) / max(indirect + direct, 1.0e-6);
    color *= mix(1.0, kept, scene.a);
  }
  #endif

  float exposure = uExposure;
  #if EXPOSURE_ADAPTATION
  float adapted = texture(tAdaptation, vec2(0.5)).r;
  // 畫面平均亮度和這一刻的照度比：比一般的畫面暗幾格（室內、陰影裡）或亮幾格（看向天空），就補
  // 其中一部分。不補滿，暗的地方仍然看得出暗；雨天與夜裡整體較暗是光線弱，比值不變，不會被拉亮。
  float stops = uAdaptation.y * (uAdaptation.x - (adapted - uLightLevelLog2));
  exposure *= exp2(clamp(stops, -uAdaptation.z, uAdaptation.z));
  #endif

  gl_FragColor = vec4(color * exposure, 1.0);
}
