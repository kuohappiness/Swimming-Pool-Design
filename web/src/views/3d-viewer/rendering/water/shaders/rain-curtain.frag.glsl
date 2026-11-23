#include <common>
#include <fog_pars_fragment>
#include <clipping_planes_pars_fragment>

uniform float uRainAmount;
uniform float uRainTime;
/** 屋頂低端的高程與承接溝頂面的高程（物件座標）。 */
uniform float uCurtainTop;
uniform float uCurtainBottom;
/** 水柱照到的光（場景單位，線性色）：天光加上燈具的溢光。 */
uniform vec3 uCurtainRadiance;

varying vec3 vCurtainPosition;

// 水柱的間距（公尺）：整片寬度的水從溢流槽邊緣落下，很快就斷成一條條細水柱。
const float THREAD_SPACING = 0.018;
const float GRAVITY = 9.81;

float curtainHash( float n ) {
  return fract( sin( n * 127.1 ) * 43758.5453 );
}

void main() {
  #include <clipping_planes_fragment>

  float across = vCurtainPosition.z / THREAD_SPACING;
  float fall = max( uCurtainTop - vCurtainPosition.y, 0.0 );
  float height = max( uCurtainTop - uCurtainBottom, 1e-3 );

  // 一條水柱：每條各自的粗細、亮度與相位，越往下越細、略為擺動。
  float column = floor( across );
  float seed = curtainHash( column );
  float centre = 0.5 + 0.28 * ( curtainHash( column + 17.0 ) - 0.5 )
    + 0.08 * sin( fall * 5.0 + seed * 6.2831 + uRainTime * 1.7 );
  float width = mix( 0.42, 0.16, smoothstep( 0.0, 0.8, fall ) ) * mix( 0.6, 1.0, seed );
  float thread = smoothstep( width, width * 0.35, abs( fract( across ) - centre ) );

  // 沿水柱往下跑的水團：落到深度 d 要 sqrt(2d/g) 秒，用它當相位，水團就照自由落體加速。
  float fallTime = sqrt( 2.0 * fall / GRAVITY );
  float pulse = fract( ( fallTime - uRainTime ) * 5.5 + seed * 13.0 );
  float clump = mix( 0.45, 1.0, smoothstep( 0.0, 0.25, pulse ) * smoothstep( 1.0, 0.55, pulse ) );

  // 剛離開溢流槽邊緣的 6 公分是連成一片的水膜，之後才斷成水柱。
  float sheet = 1.0 - smoothstep( 0.0, 0.06, fall );
  float water = max( thread * clump * mix( 0.55, 1.0, curtainHash( column + 41.0 ) ), sheet * 0.7 );

  // 遠處一個像素蓋過好幾條水柱時，改用平均值，不閃爍。
  float footprint = fwidth( across );
  water = mix( water, 0.32, smoothstep( 0.35, 1.2, footprint ) );

  // 落進承接溝前的水花：底部 25 公分內變白、變寬。
  float splashZone = smoothstep( height - 0.25, height, fall );
  float spray = curtainHash( floor( across * 3.0 ) + floor( ( fall - uRainTime * 2.3 ) * 40.0 ) * 7.0 );
  water = max( water, splashZone * smoothstep( 0.55, 1.0, spray ) * 0.85 );

  float alpha = uRainAmount * water * mix( 0.42, 0.62, splashZone );
  vec3 colour = uCurtainRadiance * mix( 0.75, 1.15, clump ) * mix( 1.0, 1.4, splashZone );
  gl_FragColor = vec4( colour, alpha );

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
