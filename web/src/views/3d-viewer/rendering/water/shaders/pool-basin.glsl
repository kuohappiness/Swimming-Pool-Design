// 池體的形狀、磁磚與水中光線。水面著色器（折射後看到的池底）與池體材質共用這一段，
// 兩邊的磁磚、水道線與顏色才會一致。所有座標都在水面網格的物件座標：x 沿池長、y 向上、z 沿池寬。

uniform vec2 uPoolMin;          // 池體最小角 (x, z)
uniform vec2 uPoolMax;          // 池體最大角 (x, z)
uniform float uWaterLevel;      // 水面高程
uniform float uShallowBottom;   // x = uPoolMin.x 處的池底高程
uniform float uDeepBottom;      // x = uPoolMax.x 處的池底高程
uniform float uTileSize;        // 磁磚邊長（公尺）
uniform float uGroutWidth;      // 磁磚縫寬（公尺）
uniform vec3 uTileColor;
uniform vec3 uGroutColor;
uniform vec3 uLaneLineColor;
uniform float uLaneLineWidth;   // 池底水道線寬（公尺）
uniform float uLaneLineInset;   // 水道線兩端距池壁（公尺）
uniform float uLaneLineZ[8];    // 各水道線的 z；沒用到的填 1e6
uniform vec3 uAbsorption;       // 水對紅、綠、藍光每公尺的吸收係數
uniform vec3 uScatterColor;     // 水體散射回來的顏色（已含環境光）
uniform vec3 uSunDirection;     // 指向太陽的單位向量
uniform vec3 uSunColor;         // 太陽直射光
uniform vec3 uSkyColor;         // 天空與室內的漫射光
uniform float uTime;
uniform sampler2D uCaustics;    // 焦散明暗圖樣；灰階 1.0 代表平均照度的 CAUSTIC_MAXIMUM_GAIN 倍
// 兩層焦散：x 是每公尺重複幾次，zw 是每秒捲動的距離（公尺）。
uniform vec4 uCausticLayers[2];
uniform float uCausticStrength; // 0 關閉，1 全開

const float WATER_IOR = 1.333;
const float NO_HIT = 1.0e9;
const float CAUSTIC_MAXIMUM_GAIN = 4.0;
// 兩層取較暗者會讓平均變暗，乘回這個倍率，整體照度才不會因為開焦散而下降。
const float CAUSTIC_ENERGY_COMPENSATION = 1.27;

struct BasinHit {
  vec3 position;
  vec3 normal;
  float distance;
};

float poolFloorElevation(float x) {
  float along = clamp((x - uPoolMin.x) / (uPoolMax.x - uPoolMin.x), 0.0, 1.0);
  return mix(uShallowBottom, uDeepBottom, along);
}

// 從池內一點沿 direction 前進，回傳先碰到的池底或池壁。
BasinHit intersectBasin(vec3 origin, vec3 direction) {
  float slope = (uDeepBottom - uShallowBottom) / (uPoolMax.x - uPoolMin.x);
  float floorAtOrigin = uShallowBottom + slope * (origin.x - uPoolMin.x);
  float floorDenominator = direction.y - slope * direction.x;
  float tFloor = floorDenominator < -1.0e-5 ? (floorAtOrigin - origin.y) / floorDenominator : NO_HIT;

  float tX = NO_HIT;
  vec3 normalX = vec3(0.0);
  if (direction.x > 1.0e-5) {
    tX = (uPoolMax.x - origin.x) / direction.x;
    normalX = vec3(-1.0, 0.0, 0.0);
  } else if (direction.x < -1.0e-5) {
    tX = (uPoolMin.x - origin.x) / direction.x;
    normalX = vec3(1.0, 0.0, 0.0);
  }

  float tZ = NO_HIT;
  vec3 normalZ = vec3(0.0);
  if (direction.z > 1.0e-5) {
    tZ = (uPoolMax.y - origin.z) / direction.z;
    normalZ = vec3(0.0, 0.0, -1.0);
  } else if (direction.z < -1.0e-5) {
    tZ = (uPoolMin.y - origin.z) / direction.z;
    normalZ = vec3(0.0, 0.0, 1.0);
  }

  BasinHit hit;
  hit.distance = max(0.0, min(tFloor, min(tX, tZ)));
  hit.position = origin + direction * hit.distance;
  hit.normal = tFloor <= min(tX, tZ)
    ? normalize(vec3(-slope, 1.0, 0.0))
    : (tX <= tZ ? normalX : normalZ);
  return hit;
}

// 一條寬 width 的線在 coordinate 處的覆蓋率；footprint 是這個像素涵蓋的長度，用來消除鋸齒。
float lineCoverage(float distanceToCentre, float width, float footprint) {
  float halfWidth = width * 0.5;
  return clamp((halfWidth - distanceToCentre) / max(footprint, 1.0e-4) + 0.5, 0.0, 1.0);
}

// 磁磚縫的覆蓋率。像素比磁磚大時退成平均值，遠處不會出現摩爾紋。
float groutCoverage(vec2 surfaceCoordinate, vec2 footprint) {
  vec2 cell = abs(fract(surfaceCoordinate / uTileSize + 0.5) - 0.5) * uTileSize;
  vec2 sharp = vec2(
    lineCoverage(cell.x, uGroutWidth, footprint.x),
    lineCoverage(cell.y, uGroutWidth, footprint.y)
  );
  float average = uGroutWidth / uTileSize;
  vec2 blend = clamp(footprint / uTileSize * 1.5 - 0.5, 0.0, 1.0);
  vec2 coverage = mix(sharp, vec2(average), blend);
  return 1.0 - (1.0 - coverage.x) * (1.0 - coverage.y);
}

// 池底或池壁在 position 處的表面顏色（未打光）。
vec3 poolBasinAlbedo(vec3 position, vec3 normal) {
  bool isFloor = normal.y > 0.5;
  vec2 surfaceCoordinate = isFloor
    ? position.xz
    : (abs(normal.x) > 0.5 ? position.zy : position.xy);
  vec2 footprint = max(fwidth(surfaceCoordinate), vec2(1.0e-4));
  vec3 albedo = mix(uTileColor, uGroutColor, groutCoverage(surfaceCoordinate, footprint));

  if (isFloor) {
    float withinLength = step(uPoolMin.x + uLaneLineInset, position.x)
      * step(position.x, uPoolMax.x - uLaneLineInset);
    float lane = 0.0;
    for (int index = 0; index < 8; index += 1) {
      lane = max(lane, lineCoverage(abs(position.z - uLaneLineZ[index]), uLaneLineWidth, footprint.y));
    }
    albedo = mix(albedo, uLaneLineColor, lane * withinLength);
  }
  return albedo;
}

// 光在水中走 distance 公尺後剩下的比例。
vec3 waterTransmittance(float distance) {
  return exp(-uAbsorption * max(distance, 0.0));
}

// 池底或池壁的焦散倍率，1 代表沒有聚光也沒有散光。
// 從落點往太陽方向回推到水面，用那裡的位置取樣，光網才會隨太陽角度斜斜地落在池壁上。
float poolCaustic(vec3 position) {
  vec3 towardSun = -refract(-uSunDirection, vec3(0.0, 1.0, 0.0), 1.0 / WATER_IOR);
  float depth = max(uWaterLevel - position.y, 0.0);
  vec2 entry = position.xz + towardSun.xz * (depth / max(towardSun.y, 0.2));
  float first = texture2D(uCaustics, (entry + uCausticLayers[0].zw * uTime) * uCausticLayers[0].x).r;
  float second = texture2D(uCaustics, (entry + uCausticLayers[1].zw * uTime) * uCausticLayers[1].x).r;
  float gain = min(first, second) * CAUSTIC_MAXIMUM_GAIN * CAUSTIC_ENERGY_COMPENSATION;
  // 水面正下方還來不及聚焦，光網隨深度才成形。
  float focus = smoothstep(0.0, 0.6, depth);
  return mix(1.0, gain, uCausticStrength * focus);
}

// 池底或池壁上一點被照亮後的顏色：陽光折射入水、沿途被水吸收，再加上漫射光。
vec3 shadePoolBasin(BasinHit hit) {
  vec3 albedo = poolBasinAlbedo(hit.position, hit.normal);
  float depth = max(uWaterLevel - hit.position.y, 0.0);

  // 陽光穿過水面後的方向（指向光源）。太陽在地平線下時沒有直射光。
  vec3 towardSun = -refract(-uSunDirection, vec3(0.0, 1.0, 0.0), 1.0 / WATER_IOR);
  float sunAbove = smoothstep(0.0, 0.08, uSunDirection.y);
  float sunPath = depth / max(towardSun.y, 0.2);
  vec3 direct = uSunColor * sunAbove * max(dot(hit.normal, towardSun), 0.0)
    * waterTransmittance(sunPath) * poolCaustic(hit.position);
  vec3 diffuse = uSkyColor * waterTransmittance(depth) * (0.55 + 0.45 * hit.normal.y);
  return albedo * (direct + diffuse) * 0.3183099;
}

// 透過水看到 radiance 時的結果：沿視線被吸收，並加上水體本身散射的光。
vec3 applyWaterColumn(vec3 radiance, float distance) {
  vec3 transmittance = waterTransmittance(distance);
  return radiance * transmittance + uScatterColor * (1.0 - transmittance);
}
