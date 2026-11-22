// 池體的形狀、磁磚與水中光線。水面著色器（折射後看到的池底）與池體材質共用這一段，
// 兩邊的磁磚、水道線與顏色才會一致。所有座標都在水面網格的物件座標：x 沿池長、y 向上、z 沿池寬。

#define MAXIMUM_SUBMERGED_BOXES 12

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
// 泡在水裡的方盒（池梯踏階、教學平台）：折射後的視線先碰到它們就看到它們，而不是池底。
uniform int uSubmergedBoxCount;
uniform vec3 uSubmergedBoxMin[MAXIMUM_SUBMERGED_BOXES];
uniform vec3 uSubmergedBoxMax[MAXIMUM_SUBMERGED_BOXES];
// rgb 是表面顏色；a 為 1 時改用池體的磁磚（教學平台和池底貼同一種磚）。
uniform vec4 uSubmergedBoxFinish[MAXIMUM_SUBMERGED_BOXES];

// 太陽的陰影貼圖（和場景其他材質用的是同一張）。沒有陰影時綁的是一張 1×1 的備用貼圖，uSunShadow.x 為 0。
uniform highp sampler2DShadow uSunShadowMap;
uniform mat4 uSunShadowMatrix;  // 水面網格的物件座標轉到陰影貼圖座標
// x 強度（0 不查陰影）、y 深度偏移、z 取樣半徑（貼圖座標）。
uniform vec3 uSunShadow;

const float WATER_IOR = 1.333;
const float NO_HIT = 1.0e9;
const float CAUSTIC_MAXIMUM_GAIN = 4.0;
// 兩層取較暗者會讓平均變暗，乘回這個倍率，整體照度才不會因為開焦散而下降。
const float CAUSTIC_ENERGY_COMPENSATION = 1.27;
// 池底漫射的光有多少比例落到池壁上（半空間的一半，再扣掉被對面池壁擋住的部分）。
const float FLOOR_BOUNCE_TO_WALL = 0.35;

struct BasinHit {
  vec3 position;
  vec3 normal;
  float distance;
  // 碰到的是水裡的方盒時 a 大於 0：rgb 是它的顏色，a 為 1 代表用池體磁磚。池底與池壁是 vec4(0)。
  vec4 object;
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
  hit.object = vec4(0.0);

  // 水裡的方盒：視線在碰到池體之前先穿進哪一個，就改成看到它。
  vec3 safeDirection = vec3(
    abs(direction.x) > 1.0e-5 ? direction.x : 1.0e-5,
    abs(direction.y) > 1.0e-5 ? direction.y : 1.0e-5,
    abs(direction.z) > 1.0e-5 ? direction.z : 1.0e-5
  );
  for (int index = 0; index < MAXIMUM_SUBMERGED_BOXES; index += 1) {
    if (index >= uSubmergedBoxCount) break;
    vec3 toMin = (uSubmergedBoxMin[index] - origin) / safeDirection;
    vec3 toMax = (uSubmergedBoxMax[index] - origin) / safeDirection;
    vec3 entry = min(toMin, toMax);
    vec3 leave = max(toMin, toMax);
    float tEnter = max(max(entry.x, entry.y), entry.z);
    float tLeave = min(min(leave.x, leave.y), leave.z);
    if (tEnter > 0.0 && tEnter < tLeave && tEnter < hit.distance) {
      hit.distance = tEnter;
      hit.position = origin + direction * tEnter;
      hit.normal = entry.x >= entry.y && entry.x >= entry.z
        ? vec3(-sign(safeDirection.x), 0.0, 0.0)
        : (entry.y >= entry.z ? vec3(0.0, -sign(safeDirection.y), 0.0) : vec3(0.0, 0.0, -sign(safeDirection.z)));
      // a 留一點起跳值，顏色是純黑也認得出「這是方盒」。
      hit.object = vec4(uSubmergedBoxFinish[index].rgb, 0.5 + 0.5 * uSubmergedBoxFinish[index].a);
    }
  }
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

// 貼磚表面在 position 處的顏色（未打光）。laneLines 為 true 時在朝上的面加畫池底水道線。
vec3 poolTileAlbedo(vec3 position, vec3 normal, bool laneLines) {
  bool isFloor = normal.y > 0.5;
  vec2 surfaceCoordinate = isFloor
    ? position.xz
    : (abs(normal.x) > 0.5 ? position.zy : position.xy);
  vec2 footprint = max(fwidth(surfaceCoordinate), vec2(1.0e-4));
  vec3 albedo = mix(uTileColor, uGroutColor, groutCoverage(surfaceCoordinate, footprint));

  if (isFloor && laneLines) {
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

// 視線碰到的那一點的表面顏色（未打光）：池底、池壁，或水裡的方盒。
vec3 poolBasinAlbedo(BasinHit hit) {
  if (hit.object.a < 0.25) return poolTileAlbedo(hit.position, hit.normal, true);
  // 池底的水道線只畫在池底，方盒頂面即使貼磚也不畫。
  return hit.object.a > 0.75 ? poolTileAlbedo(hit.position, hit.normal, false) : hit.object.rgb;
}

// 光在水中走 distance 公尺後剩下的比例。
vec3 waterTransmittance(float distance) {
  return exp(-uAbsorption * max(distance, 0.0));
}

// 靜水面上一點照不照得到太陽：1 照得到，0 在屋架、牆或 3F 量體的影子裡。
// taps 為 1 時只取一次（光束與微粒用），否則取四次，影子邊緣比較柔。
float sunVisibilityAtSurface(vec2 surface, int taps) {
  if (uSunShadow.x <= 0.0) return 1.0;
  vec4 projected = uSunShadowMatrix * vec4(surface.x, uWaterLevel, surface.y, 1.0);
  vec3 coordinate = projected.xyz / projected.w;
  if (coordinate.x < 0.0 || coordinate.x > 1.0 || coordinate.y < 0.0 || coordinate.y > 1.0 || coordinate.z > 1.0) {
    return 1.0;
  }
  coordinate.z -= uSunShadow.y;
  float lit;
  if (taps <= 1) {
    lit = texture(uSunShadowMap, coordinate);
  } else {
    float radius = uSunShadow.z;
    lit = 0.25 * (
      texture(uSunShadowMap, coordinate + vec3(radius, radius * 0.4, 0.0))
      + texture(uSunShadowMap, coordinate + vec3(-radius * 0.4, radius, 0.0))
      + texture(uSunShadowMap, coordinate + vec3(-radius, -radius * 0.4, 0.0))
      + texture(uSunShadowMap, coordinate + vec3(radius * 0.4, -radius, 0.0))
    );
  }
  return mix(1.0, lit, uSunShadow.x);
}

// 水裡一點照不照得到太陽。陽光在水面折射過，所以從這一點沿折射後的方向回推到水面，
// 查光線穿出水面的那個位置；回推到池外代表光線被池壁擋住（池壁在池底留下的影子）。
float sunVisibility(vec3 position, int taps) {
  vec3 towardSun = -refract(-uSunDirection, vec3(0.0, 1.0, 0.0), 1.0 / WATER_IOR);
  float depth = max(uWaterLevel - position.y, 0.0);
  vec2 entry = position.xz + towardSun.xz * (depth / max(towardSun.y, 0.2));
  vec2 inside = min(entry - uPoolMin, uPoolMax - entry);
  float withinPool = smoothstep(-0.03, 0.03, min(inside.x, inside.y));
  if (withinPool <= 0.0) return 0.0;
  return withinPool * sunVisibilityAtSurface(entry, taps);
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
  vec3 albedo = poolBasinAlbedo(hit);
  float depth = max(uWaterLevel - hit.position.y, 0.0);

  // 陽光穿過水面後的方向（指向光源）。太陽在地平線下時沒有直射光。
  vec3 towardSun = -refract(-uSunDirection, vec3(0.0, 1.0, 0.0), 1.0 / WATER_IOR);
  float sunAbove = smoothstep(0.0, 0.08, uSunDirection.y);
  float sunPath = depth / max(towardSun.y, 0.2);
  float facingSun = max(dot(hit.normal, towardSun), 0.0);
  vec3 direct = vec3(0.0);
  if (facingSun * sunAbove > 0.0) {
    direct = uSunColor * sunAbove * facingSun * waterTransmittance(sunPath)
      * poolCaustic(hit.position) * sunVisibility(hit.position, 4);
  }
  vec3 diffuse = uSkyColor * waterTransmittance(depth) * (0.55 + 0.45 * hit.normal.y);

  // 池壁還會被照亮的池底打亮：池底把收到的光漫射出來，池壁大約看得到半個池底。
  // 沒有這一項，背光的池壁會比實際暗得多。
  float averageDepth = uWaterLevel - 0.5 * (uShallowBottom + uDeepBottom);
  vec3 floorIrradiance = uSunColor * sunAbove * towardSun.y * waterTransmittance(averageDepth / max(towardSun.y, 0.2))
    + uSkyColor * waterTransmittance(averageDepth);
  vec3 bounce = floorIrradiance * uTileColor * FLOOR_BOUNCE_TO_WALL
    * (1.0 - hit.normal.y) * waterTransmittance(1.5);
  return albedo * (direct + diffuse + bounce) * 0.3183099;
}

// 透過水看到 radiance 時的結果：沿視線被吸收，並加上水體本身散射的光。
vec3 applyWaterColumn(vec3 radiance, float distance) {
  vec3 transmittance = waterTransmittance(distance);
  return radiance * transmittance + uScatterColor * (1.0 - transmittance);
}
