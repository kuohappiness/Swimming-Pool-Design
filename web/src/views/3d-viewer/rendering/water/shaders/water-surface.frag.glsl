#include <common>
#include <fog_pars_fragment>
#include <clipping_planes_pars_fragment>

// #include pool-basin

uniform vec3 uCameraLocal;            // 鏡頭位置（物件座標）
uniform mat3 uLocalToWorld;           // 物件座標的方向轉到世界座標，用來查反射貼圖
uniform samplerCube uReflectionCube;  // 池廳中央的反射探針
uniform float uReflectionIntensity;
// 探針只在一個定點拍，直接用反射方向去查會把近處的牆和屋頂當成無限遠，倒影位置會偏。
// 池廳內部近似成一個斜屋頂的方盒：先算反射線打到方盒哪一點，再從探針的位置看向那一點。
uniform vec3 uProbePosition;          // 探針位置（物件座標）
uniform vec3 uHallMin;                // 池廳內部最小角；y 是地面高程
uniform vec3 uHallMax;                // 池廳內部最大角；y 不使用，屋頂另給
uniform vec2 uHallRoof;               // x = uHallMin.x 處的屋頂高程，以及沿 x 每公尺升高多少
uniform float uHallParallax;          // 0 不修正（沒有池廳尺寸時），1 修正
uniform sampler2D uPlanarReflection;  // 平面倒影（高與極致級）；沒有時 uPlanarStrength 為 0
uniform mat4 uPlanarMatrix;           // 物件座標轉到平面倒影的貼圖座標
uniform float uPlanarStrength;        // 0 只用探針，1 用平面倒影
// 波紋把倒影推開多少，取決於被照出來的東西有多遠：x 是屋頂離水面的高度，y 是到牆的距離上限（公尺）。
uniform vec2 uPlanarReach;
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

vec3 sampleReflection(vec3 origin, vec3 direction) {
  vec3 lookup = direction;
  if (uHallParallax > 0.5) {
    vec3 safe = vec3(
      abs(direction.x) > 1.0e-5 ? direction.x : 1.0e-5,
      direction.y,
      abs(direction.z) > 1.0e-5 ? direction.z : 1.0e-5
    );
    float tX = ((safe.x > 0.0 ? uHallMax.x : uHallMin.x) - origin.x) / safe.x;
    float tZ = ((safe.z > 0.0 ? uHallMax.z : uHallMin.z) - origin.z) / safe.z;
    float roofAtOrigin = uHallRoof.x + uHallRoof.y * (origin.x - uHallMin.x);
    float roofDenominator = direction.y - uHallRoof.y * direction.x;
    float tY = direction.y < -1.0e-5
      ? (uHallMin.y - origin.y) / direction.y
      : (roofDenominator > 1.0e-5 ? (roofAtOrigin - origin.y) / roofDenominator : 1.0e9);
    float reach = max(min(min(tX, tZ), tY), 0.0);
    lookup = origin + direction * reach - uProbePosition;
  }
  return textureCube(uReflectionCube, uLocalToWorld * lookup).rgb * uReflectionIntensity;
}

// 平面倒影是「水面完全平坦」時看到的畫面。波紋讓反射線偏向別處：沿偏掉的反射線走到
// 大約會碰到屋頂或牆的地方，看那一點落在倒影畫面的哪裡，就取那裡的顏色。
// 回傳值的 a 是可信度：落在畫面外時為 0，呼叫端改用探針。
vec4 samplePlanarReflection(vec3 surfacePosition, vec3 reflected) {
  float reach = min(uPlanarReach.x / max(reflected.y, 1.0e-3), uPlanarReach.y);
  vec4 projected = uPlanarMatrix * vec4(surfacePosition + reflected * reach, 1.0);
  if (projected.w <= 1.0e-4) return vec4(0.0);
  vec2 uv = projected.xy / projected.w;
  vec2 edge = smoothstep(vec2(0.0), vec2(0.04), uv) * smoothstep(vec2(0.0), vec2(0.04), 1.0 - uv);
  return vec4(texture2D(uPlanarReflection, clamp(uv, 0.0, 1.0)).rgb * uReflectionIntensity, edge.x * edge.y);
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

  // 水裡看到的只追一條光線：從空氣看是折射進水的那條，從水裡看是全反射往下的那條。
  // 池底著色與水中光暈都只算一次（著色器裡也只有一份，軟體繪圖時省很多）。
  vec3 intoBasin;
  if (cameraAbove) {
    intoBasin = refract(viewDirection, refractionNormal, AIR_TO_WATER);
  } else {
    // 全反射照出來的是幾公尺外的池底；和折射一樣用較平滑的波紋，鏡面才不會碎成雜訊。
    intoBasin = reflect(viewDirection, -refractionNormal);
    intoBasin.y = -abs(intoBasin.y);
  }
  BasinHit hit = intersectBasin(vLocalPosition, intoBasin);
  vec3 inWater = applyWaterColumn(shadePoolBasin(hit), hit.distance)
    + poolLightGlow(vLocalPosition, intoBasin, hit.distance);

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
    vec3 reflection = sampleReflection(vLocalPosition, reflected);
    if (uPlanarStrength > 0.0) {
      vec4 planar = samplePlanarReflection(vec3(vLocalPosition.x, uWaterLevel, vLocalPosition.z), reflected);
      reflection = mix(reflection, planar.rgb, planar.a * uPlanarStrength);
    }

    float sunAbove = smoothstep(0.0, 0.08, uSunDirection.y);
    float glint = pow(max(dot(reflected, uSunDirection), 0.0), uSunGlintSharpness);
    vec3 sunGlint = uSunColor * sunAbove * glint * (uSunGlintSharpness + 2.0) * 0.0795775;
    // 影子裡的水面沒有太陽的反光。
    if (glint > 1.0e-4) sunGlint *= sunVisibilityAtSurface(vLocalPosition.xz, 4);

    color = mix(inWater, reflection, fresnel) + sunGlint * fresnel;
  } else {
    // 從水裡往上看：超過臨界角時水面像鏡子（全反射），照出池底（inWater）；
    // 臨界角以內是一圈能看到水面上方的「斯涅爾窗」。
    vec3 downNormal = -normal;
    vec3 refracted = refract(viewDirection, downNormal, WATER_IOR);

    if (dot(refracted, refracted) < 1.0e-6) {
      color = inWater;
    } else {
      // 由水到空氣的反射率：以折射角計算，接近臨界角時迅速升到 1。
      float fresnel = fresnelSchlick(dot(refracted, normal));
      vec3 above = sampleReflection(vLocalPosition, refracted);
      float sunAbove = smoothstep(0.0, 0.08, uSunDirection.y);
      float disc = pow(max(dot(refracted, uSunDirection), 0.0), uSunGlintSharpness * 0.25);
      if (disc > 1.0e-4) above += uSunColor * sunAbove * disc * 4.0 * sunVisibilityAtSurface(vLocalPosition.xz, 4);
      color = mix(above, inWater, fresnel);
    }
    // 鏡頭到水面這一段的水色由場景的水下霧處理（最後的 fog_fragment），其他水下物件也是同一套，
    // 這裡不重複計算；池體剖面視角從池外往上看時也就不會多一層水色。
  }

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
