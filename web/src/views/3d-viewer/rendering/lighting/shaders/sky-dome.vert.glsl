// 天空球：只取鏡頭的旋轉、不取位置，所以不管哪一台相機（主畫面、水面倒影、反射探針、
// 環境貼圖）來畫，天空都在無限遠；深度固定在最遠，被建築擋住的像素不會算到。
varying vec3 vDirection;

void main() {
  vDirection = position;
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = clip.xyww;
}
