#include <common>
#include <fog_pars_fragment>
#include <clipping_planes_pars_fragment>

// #include pool-basin

uniform vec3 uCameraLocal;            // 鏡頭位置（物件座標）
uniform mat3 uLocalToWorld;           // 物件座標的方向轉到世界座標，用來查反射貼圖
uniform samplerCube uReflectionCube;  // 池廳中央的反射探針
uniform float uReflectionIntensity;
uniform sampler2D uRippleNormal;      // 無縫細波紋法線貼圖
// 兩層細波紋：x 是每公尺重複幾次，y 是強度，zw 是每秒捲動的距離（公尺）。
uniform vec4 uRippleLayers[2];
uniform float uSunGlintSharpness;
uniform float uRefractionLodBias;

varying vec3 vLocalPosition;
varying vec3 vWaveNormal;

const float AIR_TO_WATER = 1.0 / WATER_IOR;
const float FRESNEL_F0 = 0.02;

// lodBias 大於 0 時取較模糊的波紋：折射看的是整段水深累積的偏移，細碎的波紋會互相抵銷，
// 用全解析度的法線反而讓池底的線條碎成鋸齒。
vec2 rippleSlope(vec2 surfacePosition, float lodBias) {
  vec2 slope = vec2(0.0);
  for (int index = 0; index < 2; index += 1) {
    vec4 layer = uRippleLayers[index];
    vec2 uv = (surfacePosition + layer.zw * uTime) * layer.x;
    slope += (texture2D(uRippleNormal, uv, lodBias).xy * 2.0 - 1.0) * layer.y;
  }
  return slope;
}

vec3 sampleReflection(vec3 localDirection) {
  return textureCube(uReflectionCube, uLocalToWorld * localDirection).rgb * uReflectionIntensity;
}

float fresnelSchlick(float cosine) {
  return FRESNEL_F0 + (1.0 - FRESNEL_F0) * pow(1.0 - clamp(cosine, 0.0, 1.0), 5.0);
}

void main() {
  #include <clipping_planes_fragment>

  vec2 slope = rippleSlope(vLocalPosition.xz, 0.0);
  vec3 normal = normalize(vec3(vWaveNormal.x + slope.x, vWaveNormal.y, vWaveNormal.z + slope.y));
  vec2 smoothSlope = rippleSlope(vLocalPosition.xz, uRefractionLodBias);
  vec3 refractionNormal = normalize(
    vec3(vWaveNormal.x + smoothSlope.x, vWaveNormal.y, vWaveNormal.z + smoothSlope.y)
  );

  vec3 viewDirection = normalize(vLocalPosition - uCameraLocal);  // 由鏡頭指向水面
  bool cameraAbove = uCameraLocal.y >= vLocalPosition.y;
  vec3 color;

  if (cameraAbove) {
    // 從空氣看水：部分反射天空與建築，其餘折射進水裡看到池底。
    float cosine = dot(-viewDirection, normal);
    // 掠射角下波紋背面朝向鏡頭時，法線往鏡頭方向扶正，避免反射線鑽進水裡。
    if (cosine < 0.02) {
      normal = normalize(normal - viewDirection * (0.02 - cosine));
      cosine = dot(-viewDirection, normal);
    }
    float fresnel = fresnelSchlick(cosine);

    vec3 reflected = reflect(viewDirection, normal);
    reflected.y = abs(reflected.y);
    vec3 reflection = sampleReflection(reflected);

    vec3 refracted = refract(viewDirection, refractionNormal, AIR_TO_WATER);
    BasinHit hit = intersectBasin(vLocalPosition, refracted);
    vec3 refraction = applyWaterColumn(shadePoolBasin(hit), hit.distance);

    float sunAbove = smoothstep(0.0, 0.08, uSunDirection.y);
    float glint = pow(max(dot(reflected, uSunDirection), 0.0), uSunGlintSharpness);
    vec3 sunGlint = uSunColor * sunAbove * glint * (uSunGlintSharpness + 2.0) * 0.0795775;

    color = mix(refraction, reflection, fresnel) + sunGlint * fresnel * 8.0;
  } else {
    // 從水裡往上看：超過臨界角時水面像鏡子（全反射），照出池底；
    // 臨界角以內是一圈能看到水面上方的「斯涅爾窗」。
    vec3 downNormal = -normal;
    vec3 refracted = refract(viewDirection, downNormal, WATER_IOR);
    vec3 reflected = reflect(viewDirection, downNormal);
    reflected.y = -abs(reflected.y);
    BasinHit hit = intersectBasin(vLocalPosition, reflected);
    vec3 internal = applyWaterColumn(shadePoolBasin(hit), hit.distance);

    if (dot(refracted, refracted) < 1.0e-6) {
      color = internal;
    } else {
      // 由水到空氣的反射率：以折射角計算，接近臨界角時迅速升到 1。
      float fresnel = fresnelSchlick(dot(refracted, normal));
      vec3 above = sampleReflection(refracted);
      float sunAbove = smoothstep(0.0, 0.08, uSunDirection.y);
      float disc = pow(max(dot(refracted, uSunDirection), 0.0), uSunGlintSharpness * 0.25);
      above += uSunColor * sunAbove * disc * 4.0;
      color = mix(above, internal, fresnel);
    }
    // 鏡頭到水面這一段也在水裡。
    color = applyWaterColumn(color, distance(uCameraLocal, vLocalPosition));
  }

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
