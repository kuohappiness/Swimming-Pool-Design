import type * as THREE from 'three';

/**
 * 拍倒影的相機（水面與鏡牆的反射探針、水面的平面倒影）在 `userData.reflectionCapture` 標 true。
 *
 * 天空球在這些相機裡不畫日面、月面與星星：光滑表面上的太陽亮點已經由方向光的高光負責，
 * 倒影裡再放一個極亮的日面，水面與鏡面會出現兩個太陽。和環境貼圖不畫日面是同一個道理。
 */
const REFLECTION_CAPTURE = 'reflectionCapture';

/** 把一支相機（含 CubeCamera 底下的六支）標成拍倒影用。 */
export function markReflectionCapture(camera: THREE.Object3D): void {
  camera.traverse((object) => {
    object.userData[REFLECTION_CAPTURE] = true;
  });
}

export function isReflectionCapture(camera: THREE.Object3D): boolean {
  return camera.userData[REFLECTION_CAPTURE] === true;
}
