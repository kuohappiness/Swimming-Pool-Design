import * as THREE from 'three';

/**
 * 玻璃與濕地面水膜共用的「薄膜」材質：不用 transmission。
 *
 * three.js 的 transmission 會把整個不透明場景再畫一次到另一張畫布，繪製呼叫幾乎加倍，
 * 而且玻璃後面的玻璃會消失。這裡改用一次混合就算完的寫法：
 *
 *   畫面 = 反射 + 霧面色 × 不透明度 + 背景 ×（1 − 不透明度）×（1 − 菲涅耳反射率）
 *
 * 反射不被不透明度打折，所以正看幾乎透明、斜看倒影變強，和真的玻璃一樣。沒有環境貼圖時
 * （低畫質）拿不到倒影的顏色，就不加菲涅耳那一項，退回單純的半透明色片。
 */
export interface GlossyFilmMaterialOptions {
  readonly color: THREE.ColorRepresentation;
  readonly roughness: number;
  /** 每一層表面的霧面不透明度；方盒玻璃前後兩面各算一次。 */
  readonly opacity: number;
  readonly side?: THREE.Side;
  /** 倒影亮度相對於環境貼圖（天空）的比例；室內地面照到的是天花板而不是天空，要調低。預設 1。 */
  readonly reflectionIntensity?: number;
}

export const GLOSSY_FILM_PROGRAM_KEY = 'glossy-film-v1';

const FILM_FRAGMENT = /* glsl */ `
	float filmFresnel = 0.0;
	#ifdef USE_ENVMAP
		float filmCos = saturate( dot( normalize( vViewPosition ), normal ) );
		filmFresnel = 0.04 + 0.96 * pow( 1.0 - filmCos, 5.0 );
	#endif
	float filmAlpha = 1.0 - ( 1.0 - diffuseColor.a ) * ( 1.0 - filmFresnel );
	// 先除以 alpha 變回「未預乘」的顏色，色調映射、色彩空間與霧都照標準流程做，
	// 最後由 premultiplied_alpha_fragment 乘回去。直接輸出預乘色的話，沒有後製的畫質級
	// 會在編碼後的色彩空間相加，玻璃會整片發亮。
	gl_FragColor = vec4(
		( totalDiffuse * diffuseColor.a + totalSpecular + totalEmissiveRadiance ) / max( filmAlpha, 1e-4 ),
		filmAlpha
	);
`;

/** 把標準材質的片段著色器改成薄膜混合；找不到要換的片段就丟錯，不默默用錯的結果。 */
export function patchGlossyFilmFragmentShader(fragmentShader: string) {
  const anchor = '#include <opaque_fragment>';
  if (!fragmentShader.includes(anchor)) {
    throw new TypeError(
      `Glossy film material expects the three.js fragment shader to contain ${anchor}.`,
    );
  }
  return fragmentShader.replace(anchor, FILM_FRAGMENT);
}

export function createGlossyFilmMaterial(options: GlossyFilmMaterialOptions) {
  const material = new THREE.MeshStandardMaterial({
    color: options.color,
    roughness: options.roughness,
    metalness: 0,
    transparent: true,
    opacity: options.opacity,
    envMapIntensity: options.reflectionIntensity ?? 1,
    // 混合式用「來源 + 背景 ×（1 − alpha）」，倒影才不會被不透明度打折。
    premultipliedAlpha: true,
    side: options.side ?? THREE.FrontSide,
    depthWrite: false,
    // 雙面時一次畫完前後兩面，不拆成兩次繪製呼叫；兩層都很薄，先後順序看不出差別。
    forceSinglePass: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = patchGlossyFilmFragmentShader(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => GLOSSY_FILM_PROGRAM_KEY;
  return material;
}
