#include <common>
#include <fog_pars_fragment>
#include <clipping_planes_pars_fragment>

// #include pool-basin

varying vec3 vBasinPosition;
varying vec3 vBasinNormal;

void main() {
  #include <clipping_planes_fragment>

  // 只用頂點法線判斷這一面是池底還是哪一道池壁，真正的法線一律取「朝向池內」的那一個：
  // 池體的面是雙面的，頂點法線可能朝外。
  vec3 axis = abs(vBasinNormal);
  BasinHit hit;
  hit.position = vBasinPosition;
  hit.distance = 0.0;
  if (axis.y >= axis.x && axis.y >= axis.z) {
    float slope = (uDeepBottom - uShallowBottom) / (uPoolMax.x - uPoolMin.x);
    hit.normal = normalize(vec3(-slope, 1.0, 0.0));
  } else if (axis.x >= axis.z) {
    hit.normal = vec3(vBasinPosition.x < (uPoolMin.x + uPoolMax.x) * 0.5 ? 1.0 : -1.0, 0.0, 0.0);
  } else {
    hit.normal = vec3(0.0, 0.0, vBasinPosition.z < (uPoolMin.y + uPoolMax.y) * 0.5 ? 1.0 : -1.0);
  }

  // 鏡頭到池體這一段的水色由場景的水下霧處理，和其他水下物件同一套。
  gl_FragColor = vec4(shadePoolBasin(hit), 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
