// 屋頂玻璃上的雨（TASK-152 步驟 7），接在標準材質的法線之後：
// 水珠與往低處流的細水痕改變玻璃的法線與不透明度，菲涅耳倒影跟著被打碎。
uniform float uRainAmount;
uniform float uRainTime;
varying vec3 vRainWorld;
varying vec3 vRainNormal;

float rainHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
}

/** 一點的水量（0 到 1）：p 是玻璃面上的座標（公尺），y 沿坡往下。 */
float rainHeight( vec2 p, float t, float slope ) {
  // 水珠：4 公分一格，一半的格子有一顆；每顆各自的大小，打上來、留一會、被流過的水帶走。
  vec2 cell = floor( p / 0.04 );
  vec2 local = fract( p / 0.04 ) - 0.5;
  float seed = rainHash( cell );
  vec2 offset = ( vec2( rainHash( cell + 1.7 ), rainHash( cell + 3.1 ) ) - 0.5 ) * 0.5;
  float radius = mix( 0.12, 0.3, rainHash( cell + 5.3 ) );
  float life = fract( t * 0.3 + seed * 7.0 );
  float d = length( local - offset ) / radius;
  float drop = step( seed, 0.5 ) * sqrt( max( 1.0 - d * d, 0.0 ) ) * smoothstep( 1.0, 0.7, life );

  // 水痕：10 公分一條，四成的條有水沿坡流下；坡越陡流得越快，平的雨遮上沒有水痕。
  float lane = floor( p.x / 0.1 );
  float laneSeed = rainHash( vec2( lane, 9.1 ) );
  float wander = 0.25 * sin( p.y * 9.0 + laneSeed * 6.2831 ) + 0.1 * sin( p.y * 23.0 + laneSeed * 3.0 );
  float offLane = abs( fract( p.x / 0.1 ) - 0.5 - wander * 0.5 );
  float head = fract( ( p.y - t * mix( 0.05, 0.4, slope ) ) / 0.9 + laneSeed * 5.0 );
  float trail = smoothstep( 0.0, 0.08, head ) * smoothstep( 1.0, 0.35, head );
  float rivulet = step( 0.6, laneSeed ) * smoothstep( 0.1, 0.02, offLane ) * trail * step( 0.03, slope );
  return max( drop, rivulet * 0.7 );
}
