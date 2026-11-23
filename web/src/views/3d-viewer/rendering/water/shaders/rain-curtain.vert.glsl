#include <common>
#include <fog_pars_vertex>
#include <clipping_planes_pars_vertex>

// 雨簾網格的物件座標：x 是屋頂低端（固定），y 是高程，z 沿屋頂寬度。
varying vec3 vCurtainPosition;

void main() {
  vCurtainPosition = position;
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
  #include <fog_vertex>
}
