// 測光：把畫面（線性、未做色調映射）縮成一小張，每個像素存「亮度對數 × 權重」與權重。
// 這張圖產生縮圖層，最小的一層就是整個畫面的加權平均；平均對數亮度（幾何平均）不會被
// 少數極亮的點（太陽在水面的反光、燈具）拉走。

uniform sampler2D tScene;
uniform vec2 uSpacing;  // 一格裡 4×4 個取樣點的間距（uv）

varying vec2 vUv;

void main() {
  float logSum = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 offset = (vec2(float(x), float(y)) - 1.5) * uSpacing;
      vec3 color = texture(tScene, vUv + offset).rgb;
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      logSum += log2(max(luminance, 1.0e-4));
    }
  }
  // 中央重點：畫面中央的權重是四角的四倍，眼睛和相機都比較在意看著的地方。
  vec2 fromCentre = (vUv - 0.5) * 2.0;
  float weight = 1.0 - 0.75 * smoothstep(0.0, 1.0, dot(fromCentre, fromCentre) * 0.5);
  gl_FragColor = vec4(logSum / 16.0 * weight, weight, 0.0, 1.0);
}
