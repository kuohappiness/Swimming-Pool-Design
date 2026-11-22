#include <common>
#include <fog_pars_vertex>
#include <clipping_planes_pars_vertex>

// 世界座標轉到水面網格的物件座標；池體著色全部在那個座標系裡算，才和水面折射看到的池底一致。
uniform mat4 uWorldToBasin;

varying vec3 vBasinPosition;
varying vec3 vBasinNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vBasinPosition = (uWorldToBasin * worldPosition).xyz;
  vBasinNormal = mat3(uWorldToBasin) * (mat3(modelMatrix) * normal);

  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;

  #include <clipping_planes_vertex>
  #include <fog_vertex>
}
