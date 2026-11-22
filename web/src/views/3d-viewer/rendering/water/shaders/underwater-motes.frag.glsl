#include <common>
#include <clipping_planes_pars_fragment>

uniform float uMoteOpacity;

varying vec3 vColor;
varying float vOpacity;

void main() {
  #include <clipping_planes_fragment>

  float falloff = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vColor, falloff * vOpacity * uMoteOpacity);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
