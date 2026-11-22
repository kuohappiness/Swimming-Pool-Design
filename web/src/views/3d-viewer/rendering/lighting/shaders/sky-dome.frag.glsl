// 天空：大氣散射（Preetham 等 1999 的晴空模型，寫法沿用 three.js 的 Sky 範例）加上
// 雲、曙暮光、夜空、星星、月亮，以及地平線以下的「虛擬地面」。
// 輸出是線性的亮度，和場景裡被太陽與天光照到的表面用同一個尺度，再交給色調映射。
uniform vec3 uSunDirection;
uniform vec3 uMoonDirection;
uniform float uTurbidity;
uniform float uRayleigh;
uniform float uMieCoefficient;
uniform float uMieDirectionalG;
uniform float uAtmosphereScale;
uniform vec3 uSunDiscColor;
uniform vec3 uNightColor;
uniform vec3 uTwilightColor;
uniform float uStars;
uniform vec3 uMoonColor;
uniform float uCloudCover;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec2 uCloudOffset;
uniform float uCloudDetail;
uniform sampler2D uNoise;
uniform vec3 uGroundColor;

varying vec3 vDirection;

const float PI = 3.141592653589793;
const float EULER = 2.718281828459045;
const vec3 TOTAL_RAYLEIGH = vec3(5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5);
const vec3 MIE_CONST = vec3(1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14);
const float CUTOFF_ANGLE = 1.6110731556870734;
const float STEEPNESS = 1.5;
const float SUN_ILLUMINANCE = 1000.0;
const float RAYLEIGH_ZENITH_LENGTH = 8.4e3;
const float MIE_ZENITH_LENGTH = 1.25e3;
// 日面與月面的角半徑都放大過：真實的 0.27° 在畫面上只有兩三個像素。
const float SUN_DISC_COS = 0.99985;
const float MOON_DISC_COS = 0.99975;

float sunIlluminance(float zenithAngleCos) {
  zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0);
  return SUN_ILLUMINANCE * max(0.0, 1.0 - pow(EULER, -((CUTOFF_ANGLE - acos(zenithAngleCos)) / STEEPNESS)));
}

vec3 totalMie(float turbidity) {
  float c = (0.2 * turbidity) * 10e-18;
  return 0.434 * c * MIE_CONST;
}

// 晴空的散射光。direction 必須在地平線以上（y >= 0）。
vec3 atmosphere(vec3 direction, float cosTheta) {
  float sunE = sunIlluminance(uSunDirection.y);
  vec3 betaR = TOTAL_RAYLEIGH * uRayleigh;
  vec3 betaM = totalMie(uTurbidity) * uMieCoefficient;

  float zenithAngle = acos(clamp(direction.y, 0.0, 1.0));
  float inverse = 1.0 / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / PI), -1.253));
  vec3 extinction = exp(-(betaR * RAYLEIGH_ZENITH_LENGTH * inverse + betaM * MIE_ZENITH_LENGTH * inverse));

  float rayleighPhase = (3.0 / (16.0 * PI)) * (1.0 + pow(cosTheta * 0.5 + 0.5, 2.0));
  float g = uMieDirectionalG;
  float miePhase = (1.0 / (4.0 * PI)) * ((1.0 - g * g) / pow(1.0 - 2.0 * g * cosTheta + g * g, 1.5));
  vec3 scattering = (betaR * rayleighPhase + betaM * miePhase) / (betaR + betaM);

  vec3 inscatter = pow(sunE * scattering * (1.0 - extinction), vec3(1.5));
  inscatter *= mix(
    vec3(1.0),
    pow(sunE * scattering * extinction, vec3(0.5)),
    clamp(pow(1.0 - uSunDirection.y, 5.0), 0.0, 1.0)
  );
  // 原模型在這裡另加一點固定的藍綠色當夜空；夜空改由 uNightColor 負責，太陽下山後這一項就是零。
  return pow(inscatter * 0.04, vec3(1.0 / 2.4)) * uAtmosphereScale;
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float cloudNoise(vec2 uv) {
  float n = texture2D(uNoise, uv).r * 0.5;
  n += texture2D(uNoise, uv * 2.03 + vec2(0.37, 0.11)).r * 0.25;
  if (uCloudDetail > 0.5) {
    n += texture2D(uNoise, uv * 4.01 + vec2(0.71, 0.43)).r * 0.125;
    n += texture2D(uNoise, uv * 8.13 + vec2(0.13, 0.67)).r * 0.0625;
    return n / 0.9375;
  }
  return n / 0.75;
}

void main() {
  vec3 view = normalize(vDirection);
  // 地平線以下的方向先夾到地平線：天空只定義在上半球，下半球最後換成虛擬地面。
  vec3 direction = normalize(vec3(view.x, max(view.y, 0.0), view.z) + vec3(0.0, 1.0e-4, 0.0));
  float height = direction.y;
  float cosTheta = dot(direction, uSunDirection);

  vec3 color = atmosphere(direction, cosTheta);

  // 曙暮光：太陽剛落到地平線下，朝太陽那一側的地平線還亮著。
  vec2 sunAzimuth = normalize(uSunDirection.xz + vec2(1.0e-5));
  float towardSun = 0.5 + 0.5 * dot(normalize(direction.xz + vec2(1.0e-5)), sunAzimuth);
  color += uTwilightColor * pow(1.0 - height, 5.0) * (0.25 + 0.75 * towardSun * towardSun);

  // 夜空的底色：地平線附近受城市光害影響，比天頂亮一點。
  color += uNightColor * (0.7 + 0.6 * pow(1.0 - height, 3.0));

  // 雲：把視線投影到一片高空的平面上取雜訊，越靠近地平線越遠、越扁。
  vec2 cloudUv = direction.xz / (height + 0.12) * 0.11 + uCloudOffset;
  float noise = cloudNoise(cloudUv);
  float threshold = mix(0.74, 0.16, uCloudCover);
  float cloud = smoothstep(threshold - 0.05, threshold + 0.16, noise);
  float overcast = smoothstep(0.75, 1.0, uCloudCover);
  // 晴天的雲在地平線附近淡出；陰天與雨天是整片雲層，沒有破洞。
  cloud = mix(cloud * smoothstep(0.015, 0.2, height), 1.0, overcast);
  // 雲越厚，從底下看越暗；邊緣薄的地方透光。
  float thickness = smoothstep(threshold + 0.04, threshold + 0.4, noise);
  // 遠處的雲隔著很厚的空氣，明暗差被沖淡；少了這一步，地平線上的雲會被投影拉成一條條直紋。
  thickness = mix(0.45, thickness, smoothstep(0.0, 0.16, height));
  vec3 cloudColor = mix(uCloudLit, uCloudShade, thickness * 0.6);
  cloudColor += uCloudLit * pow(max(cosTheta, 0.0), 10.0) * 0.5 * (1.0 - thickness);

  float clearSky = 1.0 - cloud;
  if (uStars > 0.001) {
    vec3 cell = direction * 170.0;
    vec3 id = floor(cell);
    float seed = hash13(id);
    vec3 offset = vec3(hash13(id + 17.0), hash13(id + 41.0), hash13(id + 73.0)) - 0.5;
    float distanceToStar = length(fract(cell) - 0.5 - offset * 0.6);
    float star = step(0.9, seed) * smoothstep(0.16, 0.0, distanceToStar) * (0.35 + 0.65 * hash13(id + 5.0));
    color += vec3(0.85, 0.9, 1.0) * star * uStars * clearSky * smoothstep(0.03, 0.3, height);
  }

  float cosMoon = dot(direction, uMoonDirection);
  float moonDisc = smoothstep(MOON_DISC_COS, MOON_DISC_COS + 0.00006, cosMoon);
  color += uMoonColor * (moonDisc + 0.04 * pow(max(cosMoon, 0.0), 600.0)) * clearSky;

  float sunDisc = smoothstep(SUN_DISC_COS, SUN_DISC_COS + 0.00004, cosTheta);
  color += uSunDiscColor * (sunDisc + 0.012 * pow(max(cosTheta, 0.0), 900.0)) * clearSky * clearSky;

  color = mix(color, cloudColor, cloud);

  // 虛擬地面：基地以外沒有模型，地平線以下用地面的顏色，往地平線漸漸融進天空。
  if (view.y < 0.0) {
    color = mix(uGroundColor, color, exp(view.y * 16.0));
  }

  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  // 天空是大片平滑的漸層，八位元輸出會看到色階；加不到一階的雜訊把它打散。
  gl_FragColor.rgb += (hash13(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;
}
