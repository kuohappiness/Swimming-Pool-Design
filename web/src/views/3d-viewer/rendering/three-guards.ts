import * as THREE from 'three';

/**
 * 判斷是不是網格。直接寫 `instanceof THREE.Mesh` 收窄出來的是 `Mesh<any, any, any>`，
 * any 會沿著 geometry、material 一路外流，型別規則抓不到錯；這裡收窄成預設的 `THREE.Mesh`。
 */
export function isMesh(object: unknown): object is THREE.Mesh {
  return object instanceof THREE.Mesh;
}

/** 判斷是不是線段物件；理由同 `isMesh`。 */
export function isLine(object: unknown): object is THREE.Line {
  return object instanceof THREE.Line;
}
