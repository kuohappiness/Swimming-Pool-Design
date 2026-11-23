import * as THREE from 'three';

/**
 * 影子邊緣隨距離變柔。
 *
 * 太陽不是一個點，所以影子的邊緣有一圈半影：遮蔽物離受光面越遠，半影越寬。貼著地面的欄杆腳
 * 影子是利的，十公尺高的屋簷落到地上的影子邊緣是柔的。three.js 內建的陰影過濾用固定半徑，
 * 這裡把它換成「先估遮蔽物多遠，再決定模糊多少」的版本。
 *
 * 做法受限於 three.js 的陰影貼圖是「深度比較」貼圖：只能問「這個深度被擋住了嗎」，讀不到
 * 遮蔽物的實際深度。所以改成多問幾次：把受光點的深度往光源方向推 0.35、1.5、5 公尺再比較，
 * 被擋的比例掉得越慢，遮蔽物就越遠。只有落在影子邊緣的像素才做這些額外的比較，
 * 完全照得到或完全在影子裡的像素和原本一樣只取 5 次。
 *
 * 開關藏在既有的 `shadow.radius` 裡，不必重新編譯材質：
 * - 0 以上：和 three.js 原本一樣，固定半徑（單位：陰影貼圖的格）。
 * - 負值：距離柔化；絕對值是「遮蔽物每遠一公尺，半影半徑多幾格」。
 */

const CHUNK_NAME = 'shadowmap_pars_fragment';
const FUNCTION_START = 'float getShadow( sampler2DShadow shadowMap,';

/** 估遮蔽距離時把比較深度往光源推多遠（公尺），以及超過最後一層之後假設還有多遠。 */
export const SOFT_SHADOW_PROBE_METRES = Object.freeze([0.35, 1.5, 5] as const);
const SOFT_SHADOW_TAIL_METRES = 6;
/** 找遮蔽物的範圍假設遮蔽物最遠這麼遠（公尺）：約等於建築全高在低角度陽光下的斜距。 */
const SOFT_SHADOW_REACH_METRES = 16;
/** 半影半徑的下限與上限（陰影貼圖的格）。下限讓貼地的影子邊緣不出現鋸齒。 */
const SOFT_SHADOW_MINIMUM_TEXELS = 0.75;
const SOFT_SHADOW_MAXIMUM_TEXELS = 8;

/** 不做距離柔化時（中畫質）的固定半徑。 */
export const PLAIN_SHADOW_RADIUS_TEXELS = 1.5;

export interface SoftShadowOptions {
  /** 陰影相機近、遠平面之間的距離（公尺）；用來把公尺換成陰影貼圖裡的深度。 */
  readonly depthRangeMetres: number;
}

function glslFloat(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Soft shadow constant is not finite: ${value}`);
  const text = value.toPrecision(8);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

/** 從 `start` 那個函式的開頭找到它的結尾（大括號配對）。找不到回傳 null。 */
function functionRange(source: string, start: string): { from: number; to: number } | null {
  const from = source.indexOf(start);
  if (from < 0 || source.indexOf(start, from + 1) >= 0) return null;
  const open = source.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return { from, to: index + 1 };
    }
  }
  return null;
}

/**
 * 把 three.js 陰影著色器片段裡的 PCF `getShadow` 換成距離柔化的版本。
 * three.js 改版後若找不到那個函式就回傳 null，呼叫端維持原本的陰影。
 */
export function createSoftShadowChunk(source: string, options: SoftShadowOptions): string | null {
  if (!(options.depthRangeMetres > 0)) {
    throw new RangeError('Soft shadows need a positive shadow camera depth range.');
  }
  const range = functionRange(source, FUNCTION_START);
  if (!range || !source.includes('vogelDiskSample') || !source.includes('interleavedGradientNoise'))
    return null;
  const [first, second, third] = SOFT_SHADOW_PROBE_METRES;
  const toDepth = (metres: number) => glslFloat(metres / options.depthRangeMetres);
  const replacement = /* glsl */ `
		// 距離柔化的陰影（rendering/lighting/soft-shadows.ts）。
		#ifdef USE_REVERSED_DEPTH_BUFFER
			#define SOFT_SHADOW_TOWARD_LIGHT 1.0
		#else
			#define SOFT_SHADOW_TOWARD_LIGHT -1.0
		#endif

		float softShadowDisk5( sampler2DShadow shadowMap, vec3 coordinate, float radius, float phi ) {

			return (
				texture( shadowMap, vec3( coordinate.xy + vogelDiskSample( 0, 5, phi ) * radius, coordinate.z ) ) +
				texture( shadowMap, vec3( coordinate.xy + vogelDiskSample( 1, 5, phi ) * radius, coordinate.z ) ) +
				texture( shadowMap, vec3( coordinate.xy + vogelDiskSample( 2, 5, phi ) * radius, coordinate.z ) ) +
				texture( shadowMap, vec3( coordinate.xy + vogelDiskSample( 3, 5, phi ) * radius, coordinate.z ) ) +
				texture( shadowMap, vec3( coordinate.xy + vogelDiskSample( 4, 5, phi ) * radius, coordinate.z ) )
			) * 0.2;

		}

		float softShadowDisk8( sampler2DShadow shadowMap, vec3 coordinate, float radius, float phi ) {

			float lit = 0.0;
			for ( int index = 0; index < 8; index ++ ) {

				lit += texture( shadowMap, vec3( coordinate.xy + vogelDiskSample( index, 8, phi ) * radius, coordinate.z ) );

			}
			return lit * 0.125;

		}

		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

			float shadow = 1.0;

			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;

			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

			if ( frustumTest ) {

				float texel = 1.0 / shadowMapSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;

				if ( shadowRadius >= 0.0 ) {

					// 固定半徑：和 three.js 原本的過濾相同。
					shadow = softShadowDisk5( shadowMap, shadowCoord.xyz, shadowRadius * texel, phi );

				} else {

					// 每公尺遮蔽距離的半影半徑（格）。
					float slope = - shadowRadius;
					float widest = clamp( slope * ${glslFloat(SOFT_SHADOW_REACH_METRES)}, ${glslFloat(SOFT_SHADOW_MINIMUM_TEXELS)}, ${glslFloat(SOFT_SHADOW_MAXIMUM_TEXELS)} );
					float lit = softShadowDisk5( shadowMap, shadowCoord.xyz, widest * texel, phi );

					if ( lit > 0.999 || lit < 0.001 ) {

						// 最寬的半影範圍內全亮或全暗：不在影子邊緣，不必再算。
						shadow = step( 0.5, lit );

					} else {

						// 把比較深度往光源推，問「還被更遠的東西擋住嗎」，由此估遮蔽物平均多遠。
						float blocked = 1.0 - lit;
						vec3 probe = shadowCoord.xyz;
						probe.z = shadowCoord.z + SOFT_SHADOW_TOWARD_LIGHT * ${toDepth(first)};
						float beyondFirst = 1.0 - softShadowDisk5( shadowMap, probe, widest * texel, phi );
						probe.z = shadowCoord.z + SOFT_SHADOW_TOWARD_LIGHT * ${toDepth(second)};
						float beyondSecond = 1.0 - softShadowDisk5( shadowMap, probe, widest * texel, phi );
						probe.z = shadowCoord.z + SOFT_SHADOW_TOWARD_LIGHT * ${toDepth(third)};
						float beyondThird = 1.0 - softShadowDisk5( shadowMap, probe, widest * texel, phi );
						float blockerDistance = (
							0.5 * ( blocked + beyondFirst ) * ${glslFloat(first)} +
							0.5 * ( beyondFirst + beyondSecond ) * ${glslFloat(second - first)} +
							0.5 * ( beyondSecond + beyondThird ) * ${glslFloat(third - second)} +
							beyondThird * ${glslFloat(SOFT_SHADOW_TAIL_METRES)}
						) / blocked;
						float radius = clamp( slope * blockerDistance, ${glslFloat(SOFT_SHADOW_MINIMUM_TEXELS)}, widest );
						shadow = softShadowDisk8( shadowMap, shadowCoord.xyz, radius * texel, phi );

					}

				}

			}

			return mix( 1.0, shadow, shadowIntensity );

		}`;
  return `${source.slice(0, range.from)}${replacement.trimStart()}${source.slice(range.to)}`;
}

type ShaderChunkTable = Record<string, string>;
const installed = new WeakMap<ShaderChunkTable, { original: string; users: number }>();

/**
 * 把距離柔化的陰影裝進 three.js 的著色器片段。要在材質第一次編譯之前呼叫。
 * 回傳的函式把片段還原；three.js 的片段格式變了、裝不上時回傳 null。
 * 同一頁有好幾個 3D 畫面時共用同一份，最後一個還原時才真的換回去。
 */
export function installSoftShadows(
  options: SoftShadowOptions,
  chunks: ShaderChunkTable = THREE.ShaderChunk as ShaderChunkTable,
): (() => void) | null {
  let state = installed.get(chunks);
  if (!state) {
    const original = chunks[CHUNK_NAME];
    const next = typeof original === 'string' ? createSoftShadowChunk(original, options) : null;
    if (!original || !next) return null;
    chunks[CHUNK_NAME] = next;
    state = { original, users: 0 };
    installed.set(chunks, state);
  }
  const current = state;
  current.users += 1;
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    current.users -= 1;
    if (current.users === 0 && installed.get(chunks) === current) {
      chunks[CHUNK_NAME] = current.original;
      installed.delete(chunks);
    }
  };
}

export interface ShadowFilterInput {
  /** 光源看起來的半徑（弧度）：晴天的太陽很小，隔著雲層時整片雲都在發光。 */
  readonly angularRadius: number;
  /** 陰影相機涵蓋的寬度（公尺）。 */
  readonly coverageMetres: number;
  /** 陰影貼圖的邊長（格）。 */
  readonly mapSize: number;
  /** 這一級畫質做不做距離柔化。 */
  readonly distanceSoftening: boolean;
}

/**
 * 要寫進 `light.shadow.radius` 的值：做距離柔化時是負的「每公尺幾格」，否則是固定半徑。
 */
export function shadowFilterRadius(input: ShadowFilterInput): number {
  if (!(input.coverageMetres > 0) || !(input.mapSize > 0) || !(input.angularRadius >= 0)) {
    throw new RangeError(
      'Shadow filter needs a positive coverage, map size and a non-negative angular radius.',
    );
  }
  if (!input.distanceSoftening) return PLAIN_SHADOW_RADIUS_TEXELS;
  const texelMetres = input.coverageMetres / input.mapSize;
  // 斜率至少留一點，負號才不會變成 0（0 會被當成固定半徑 0）。
  return -Math.max(Math.tan(input.angularRadius) / texelMetres, 1e-4);
}
