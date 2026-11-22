import * as THREE from 'three';
import { deriveMirrorGeometry } from '../../../../../../core/geometry/mirror-geometry.mjs';
import {
  projectMirrorReflectionFootprint,
  reflectSolarRay,
  reflectionDirectionInLocalCoordinates,
} from '../../../../../../core/solar/solar-reflection.mjs';
import type { ViewerModel } from '../../model-adapter';
import type { LinearColor, SiteVector, SunLighting } from './sun-lighting';

/**
 * 鏡牆反射的日光（階段三步驟 4）。
 *
 * 3F 外傾的鏡牆把陽光反射進池廳，落在池面與池畔，這是「向光」的主張。這裡只決定
 * 「反射光從哪裡來、往哪裡去、落在哪裡」，全部呼叫日照研究頁同一組函式：
 * 鏡面四個角點用 `deriveMirrorGeometry`，反射方向用 `reflectSolarRay`，
 * 落在地面（±0.00）的光斑用 `projectMirrorReflectionFootprint`。網站端不另寫一份幾何。
 *
 * 畫面上，反射光是一盞只從鏡面那個平行四邊形射出來的平行光：一個點收不收得到它，
 * 是從那個點逆著反射方向看回去，看得到鏡面才收得到（`createMirrorBounceChunk`）。
 * 光斑的亮度與邊緣柔度是視覺近似；鏡面的反射率、平整度與眩光尚待專業驗證，
 * 畫面上標示「概念示意」。
 */

/**
 * 鏡面的反射率（視覺用）。一般鍍銀玻璃鏡約 0.85 至 0.9，戶外鏡面不鏽鋼或鋁板約 0.6 至 0.8；
 * 鏡牆的材料尚未定案，取中間偏保守的值。
 */
export const MIRROR_REFLECTANCE = 0.75;

export interface MirrorWallSource {
  /** 鏡牆下緣在旋轉前的 SITE X（3F 靠泳池那一端）。 */
  readonly startX: number;
  /** 3F 沿 SITE Y 的寬度。 */
  readonly width: number;
  readonly pivot: { readonly x: number; readonly y: number };
  /** 3F 平面旋轉角（度，由上往下看順時針）。 */
  readonly planRotation: number;
  /** 鏡牆外傾角（度，自鉛直量起）。 */
  readonly leanFromVertical: number;
  /** 鏡牆的鉛直高度（公尺）。 */
  readonly height: number;
  /** 鏡牆下緣的標高（公尺）。 */
  readonly baseElevation: number;
  readonly positiveXAxisBearingFromTrueNorth: number;
  /** 泳池範圍；用來判斷光斑有沒有落在池面上。 */
  readonly poolRectangle: { readonly x1: number; readonly x2: number; readonly y1: number; readonly y2: number };
}

/** 鏡牆的輸入全部取自網站的模型（和日照研究頁 `activeMirrorFootprintGeometry` 同一份來源）。 */
export function mirrorWallFromViewerModel(model: ViewerModel): MirrorWallSource {
  const { l3, pool } = model.geometry;
  return {
    startX: l3.startX,
    width: l3.width,
    pivot: { x: l3.planPivot.x, y: l3.planPivot.y },
    planRotation: l3.planRotation.value,
    leanFromVertical: l3.mirror.leanFromVertical.value,
    height: l3.mirror.height.value,
    baseElevation: l3.baseElevation,
    positiveXAxisBearingFromTrueNorth: model.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
    poolRectangle: { ...pool.bounds },
  };
}

export interface SitePoint { readonly x: number; readonly y: number; readonly z: number }

export interface MirrorBounce {
  /** 鏡面的四個角點（SITE）：下緣兩點、上緣兩點，依序繞一圈。 */
  readonly corners: readonly [SitePoint, SitePoint, SitePoint, SitePoint];
  /**
   * 這一刻有沒有反射光：太陽在地平線上、照到鏡面正面、反射後往下走。
   * 月光不算（太暗，夜裡的鏡面反射在步驟 5 與燈具一起看）。
   */
  readonly active: boolean;
  /** 反射光前進的方向（SITE，單位向量）；沒有反射光時為 null。 */
  readonly direction: SiteVector | null;
  /** 光斑落在地面（±0.00）的四邊形（SITE XY）；沒有反射光時是空的。 */
  readonly footprint: readonly { readonly x: number; readonly y: number }[];
  /** 光斑和泳池範圍有沒有重疊。 */
  readonly hitsPool: boolean;
  /** 陽光打到鏡面的入射角（度）；沒有照到正面時為 null。 */
  readonly incidenceAngle: number | null;
  /** 反射光的顏色（線性）與強度：陽光乘上鏡面反射率。 */
  readonly color: LinearColor;
  readonly intensity: number;
  /** 光源看起來的半徑（弧度）：和陽光相同，鏡面是平的，不會讓它變大或變小。 */
  readonly angularRadius: number;
}

const INACTIVE_FOOTPRINT: readonly { x: number; y: number }[] = Object.freeze([]);

export function computeMirrorBounce(lighting: SunLighting, wall: MirrorWallSource): MirrorBounce {
  const mirror = deriveMirrorGeometry(wall);
  const corners = Object.freeze([
    Object.freeze({ ...mirror.lower[0] }),
    Object.freeze({ ...mirror.lower[1] }),
    Object.freeze({ ...mirror.upper[1] }),
    Object.freeze({ ...mirror.upper[0] }),
  ]) as MirrorBounce['corners'];
  const inactive = (incidenceAngle: number | null): MirrorBounce => Object.freeze({
    corners,
    active: false,
    direction: null,
    footprint: INACTIVE_FOOTPRINT,
    hitsPool: false,
    incidenceAngle,
    color: lighting.key.color,
    intensity: 0,
    angularRadius: lighting.key.angularRadius,
  });
  if (lighting.key.source !== 'sun' || lighting.altitude <= 0 || lighting.key.intensity <= 0) return inactive(null);

  const reflection = reflectSolarRay({
    solarAltitude: lighting.altitude,
    solarAzimuth: lighting.azimuth,
    wallNormalAzimuth: mirror.normalAzimuth,
    wallLeanFromVertical: wall.leanFromVertical,
  });
  if (!reflection.frontLit) return inactive(null);
  const projected = projectMirrorReflectionFootprint({ ...wall, reflection });
  if (!projected.reachesPoolPlane) return inactive(reflection.incidenceAngle);
  const direction = reflectionDirectionInLocalCoordinates(reflection, wall.positiveXAxisBearingFromTrueNorth);
  return Object.freeze({
    corners,
    active: true,
    direction: Object.freeze(direction),
    footprint: Object.freeze(projected.footprint.map((point) => Object.freeze({ x: point.x, y: point.y }))),
    hitsPool: projected.hitsPool,
    incidenceAngle: reflection.incidenceAngle,
    color: lighting.key.color,
    intensity: lighting.key.intensity * MIRROR_REFLECTANCE,
    angularRadius: lighting.key.angularRadius,
  });
}

/**
 * 給著色器用的反射光：鏡面一角、兩條邊、反射方向都在同一個座標系（場景材質用世界座標，
 * 水用水面網格的物件座標），`color.w` 是開關。同一個座標系的材質共用同一組物件。
 */
export interface MirrorBounceUniforms {
  readonly uMirrorBounceColor: { value: THREE.Vector4 };
  readonly uMirrorBounceDirection: { value: THREE.Vector3 };
  readonly uMirrorBounceOrigin: { value: THREE.Vector3 };
  readonly uMirrorBounceEdgeU: { value: THREE.Vector3 };
  readonly uMirrorBounceEdgeV: { value: THREE.Vector3 };
  /** 光源半徑的正切：遮罩邊緣的半影寬度 = 到鏡面的距離 × 這個值。 */
  readonly uMirrorBounceSoftness: { value: number };
}

export function createMirrorBounceUniforms(): MirrorBounceUniforms {
  return {
    uMirrorBounceColor: { value: new THREE.Vector4(0, 0, 0, 0) },
    uMirrorBounceDirection: { value: new THREE.Vector3(0, -1, 0) },
    uMirrorBounceOrigin: { value: new THREE.Vector3() },
    uMirrorBounceEdgeU: { value: new THREE.Vector3(1, 0, 0) },
    uMirrorBounceEdgeV: { value: new THREE.Vector3(0, 1, 0) },
    uMirrorBounceSoftness: { value: 0 },
  };
}

const MIRROR_BOUNCE_UNIFORM_NAMES = Object.freeze(
  Object.keys(createMirrorBounceUniforms()) as Array<keyof MirrorBounceUniforms>,
);

/** 從一支著色器材質的 uniforms 取出反射光那一組（同一批物件，不複製）。 */
export function pickMirrorBounceUniforms(uniforms: Readonly<Record<string, THREE.IUniform>>): MirrorBounceUniforms {
  const picked: Partial<Record<keyof MirrorBounceUniforms, THREE.IUniform>> = {};
  for (const name of MIRROR_BOUNCE_UNIFORM_NAMES) {
    const uniform = uniforms[name];
    if (!uniform) throw new TypeError(`The material has no ${name} uniform.`);
    picked[name] = uniform;
  }
  return picked as unknown as MirrorBounceUniforms;
}

/** 反射光在世界座標：鏡面一角、兩條邊與前進方向。 */
export interface WorldMirrorBounce {
  readonly enabled: boolean;
  readonly color: THREE.Color;
  readonly direction: THREE.Vector3;
  readonly origin: THREE.Vector3;
  readonly edgeU: THREE.Vector3;
  readonly edgeV: THREE.Vector3;
  readonly softness: number;
}

const sitePointToWorld = (point: SitePoint, siteRoot: THREE.Object3D, out: THREE.Vector3) =>
  siteRoot.localToWorld(out.set(point.x, point.z, point.y));

/** SITE 座標的反射光換到世界座標（只經過場景自己的 SITE 根節點）。 */
export function mirrorBounceToWorld(bounce: MirrorBounce, siteRoot: THREE.Object3D): WorldMirrorBounce {
  siteRoot.updateWorldMatrix(true, false);
  const origin = sitePointToWorld(bounce.corners[0], siteRoot, new THREE.Vector3());
  const edgeU = sitePointToWorld(bounce.corners[1], siteRoot, new THREE.Vector3()).sub(origin);
  const edgeV = sitePointToWorld(bounce.corners[3], siteRoot, new THREE.Vector3()).sub(origin);
  const direction = bounce.direction
    ? new THREE.Vector3(bounce.direction.x, bounce.direction.z, bounce.direction.y)
      .transformDirection(siteRoot.matrixWorld)
    : new THREE.Vector3(0, -1, 0);
  return Object.freeze({
    enabled: bounce.active && bounce.intensity > 0,
    color: new THREE.Color().setRGB(...bounce.color).multiplyScalar(bounce.active ? bounce.intensity : 0),
    direction,
    origin,
    edgeU,
    edgeV,
    softness: Math.tan(bounce.angularRadius),
  });
}

/**
 * 場景上目前的反射光放在 `scene.userData.mirrorBounce`（和半球光的 `skyIrradiance` 同一種做法），
 * 水的著色器從這裡讀同一份，不另算。
 */
export function publishSceneMirrorBounce(scene: THREE.Scene, bounce: WorldMirrorBounce | null): void {
  scene.userData.mirrorBounce = bounce;
}

export function readSceneMirrorBounce(scene: THREE.Scene): WorldMirrorBounce | null {
  const bounce: unknown = scene.userData.mirrorBounce;
  if (!bounce || typeof bounce !== 'object') return null;
  const candidate = bounce as Partial<WorldMirrorBounce>;
  const isVector = (value: unknown) => (value as THREE.Vector3 | undefined)?.isVector3 === true;
  return typeof candidate.enabled === 'boolean'
    && candidate.color?.isColor === true
    && isVector(candidate.direction)
    && isVector(candidate.origin)
    && isVector(candidate.edgeU)
    && isVector(candidate.edgeV)
    && typeof candidate.softness === 'number'
    ? candidate as WorldMirrorBounce
    : null;
}

/** 把世界座標的反射光寫進一組 uniform，換到 `toSpace` 指定的座標系（世界座標傳單位矩陣）。 */
export function writeMirrorBounceUniforms(
  uniforms: MirrorBounceUniforms,
  bounce: WorldMirrorBounce | null,
  toSpace: THREE.Matrix4,
): void {
  if (!bounce || !bounce.enabled) {
    uniforms.uMirrorBounceColor.value.set(0, 0, 0, 0);
    return;
  }
  uniforms.uMirrorBounceColor.value.set(bounce.color.r, bounce.color.g, bounce.color.b, 1);
  uniforms.uMirrorBounceOrigin.value.copy(bounce.origin).applyMatrix4(toSpace);
  uniforms.uMirrorBounceEdgeU.value.copy(bounce.edgeU).transformDirection(toSpace)
    .multiplyScalar(bounce.edgeU.length() * scaleAlong(toSpace, bounce.edgeU));
  uniforms.uMirrorBounceEdgeV.value.copy(bounce.edgeV).transformDirection(toSpace)
    .multiplyScalar(bounce.edgeV.length() * scaleAlong(toSpace, bounce.edgeV));
  uniforms.uMirrorBounceDirection.value.copy(bounce.direction).transformDirection(toSpace);
  uniforms.uMirrorBounceSoftness.value = bounce.softness;
}

const scaleProbe = new THREE.Vector3();
/** 變換矩陣沿某個方向的伸縮比例（水面網格的物件座標是 1，但不假設）。 */
function scaleAlong(matrix: THREE.Matrix4, direction: THREE.Vector3): number {
  const length = direction.length();
  if (length === 0) return 1;
  scaleProbe.copy(direction).divideScalar(length);
  const elements = matrix.elements;
  const x = elements[0]! * scaleProbe.x + elements[4]! * scaleProbe.y + elements[8]! * scaleProbe.z;
  const y = elements[1]! * scaleProbe.x + elements[5]! * scaleProbe.y + elements[9]! * scaleProbe.z;
  const z = elements[2]! * scaleProbe.x + elements[6]! * scaleProbe.y + elements[10]! * scaleProbe.z;
  return Math.hypot(x, y, z);
}

/**
 * 著色器片段：一個點收不收得到鏡面反射光（0 到 1）。從那個點逆著反射方向往回走，
 * 碰到鏡面所在的平面時落在平行四邊形裡面就收得到；鏡面後方（3F 裡面、屋頂）的點不算。
 * 邊緣依到鏡面的距離與光源大小變柔，和陽光的影子同一個道理。
 */
export const MIRROR_BOUNCE_GLSL = /* glsl */`
uniform vec4 uMirrorBounceColor;
uniform vec3 uMirrorBounceDirection;
uniform vec3 uMirrorBounceOrigin;
uniform vec3 uMirrorBounceEdgeU;
uniform vec3 uMirrorBounceEdgeV;
uniform float uMirrorBounceSoftness;

float mirrorBounceMask( vec3 position ) {
	vec3 towardMirror = - uMirrorBounceDirection;
	vec3 mirrorNormal = cross( uMirrorBounceEdgeU, uMirrorBounceEdgeV );
	float approach = dot( mirrorNormal, towardMirror );
	if ( abs( approach ) < 1e-6 ) return 0.0;
	float travel = dot( uMirrorBounceOrigin - position, mirrorNormal ) / approach;
	// 鏡面上與鏡面後方的點收不到自己反射的光。
	if ( travel <= 0.02 ) return 0.0;
	vec3 offset = position + towardMirror * travel - uMirrorBounceOrigin;
	float uu = dot( uMirrorBounceEdgeU, uMirrorBounceEdgeU );
	float uv = dot( uMirrorBounceEdgeU, uMirrorBounceEdgeV );
	float vv = dot( uMirrorBounceEdgeV, uMirrorBounceEdgeV );
	float du = dot( offset, uMirrorBounceEdgeU );
	float dv = dot( offset, uMirrorBounceEdgeV );
	float determinant = uu * vv - uv * uv;
	if ( determinant <= 0.0 ) return 0.0;
	vec2 coordinate = vec2( du * vv - dv * uv, dv * uu - du * uv ) / determinant;
	vec2 feather = max( vec2( travel * uMirrorBounceSoftness ) / sqrt( vec2( uu, vv ) ), vec2( 1e-4 ) );
	vec2 inside = smoothstep( - feather, feather, coordinate ) * smoothstep( - feather, feather, 1.0 - coordinate );
	return inside.x * inside.y;
}
`;

const LIGHTS_MAPS = '#include <lights_fragment_maps>';
const COMMON = '#include <common>';

/**
 * 加在 three.js 光照迴圈之後：把反射光當成多一盞平行光，用材質自己的 BRDF 算。
 * 遮罩在世界座標算（uniform 是世界座標），所以水面倒影、反射探針這些用別的鏡頭畫的畫面
 * 也正確；光的方向再換回這一次的 view 座標給 BRDF。
 */
const MIRROR_BOUNCE_APPLY = /* glsl */`
#if defined( RE_Direct )
	if ( uMirrorBounceColor.w > 0.0 ) {
		vec3 mirrorBounceWorld = ( vec4( geometryPosition - viewMatrix[ 3 ].xyz, 0.0 ) * viewMatrix ).xyz;
		float mirrorBounce = mirrorBounceMask( mirrorBounceWorld );
		if ( mirrorBounce > 0.0 ) {
			directLight.direction = normalize( ( viewMatrix * vec4( - uMirrorBounceDirection, 0.0 ) ).xyz );
			directLight.color = uMirrorBounceColor.rgb * mirrorBounce;
			directLight.visible = true;
			RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
		}
	}
#endif
`;

/**
 * 把反射光裝進一個 three.js 內建的受光材質（標準、物理）。uniform 是共用的同一組物件、
 * 世界座標，只在光線改變時更新。回傳 false 代表這不是會受光的標準材質，不裝。
 */
export function installMirrorBounce(material: THREE.Material, uniforms: MirrorBounceUniforms): boolean {
  // 用旗標而不是 instanceof：標準與物理材質都有 isMeshStandardMaterial，不受打包出幾份 three.js 影響。
  if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial !== true) return false;
  if (material.userData.mirrorBounce === uniforms) return true;
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    previous.call(this, shader, renderer);
    if (!shader.fragmentShader.includes(LIGHTS_MAPS) || !shader.fragmentShader.includes(COMMON)) return;
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(COMMON, `${COMMON}\n${MIRROR_BOUNCE_GLSL}`)
      .replace(LIGHTS_MAPS, `${MIRROR_BOUNCE_APPLY}\n${LIGHTS_MAPS}`);
  };
  material.customProgramCacheKey = function customProgramCacheKey() {
    return `${previousKey.call(this)}|mirror-bounce`;
  };
  material.userData.mirrorBounce = uniforms;
  material.needsUpdate = true;
  return true;
}

/** 這一刻反射光落在哪裡：池面、只落在池外，或沒有（太陽不在鏡面正面、夜裡、鏡牆圖層關著）。 */
export type MirrorBounceLanding = 'pool' | 'outside-pool' | 'none';

/**
 * 場景裡的鏡牆反射光：持有共用的 uniform（世界座標），光線或圖層改變時更新它們，
 * 並把同一份放到場景上給水用。鏡牆圖層關著（鏡面不在畫面上）時沒有反射光，
 * 和被藏起來的構件不投影是同一個道理。
 */
export class MirrorBounceLight {
  readonly uniforms: MirrorBounceUniforms = createMirrorBounceUniforms();
  private bounce: MirrorBounce | null = null;
  private readonly identity = new THREE.Matrix4();

  constructor(
    private readonly wall: MirrorWallSource,
    private readonly scene: THREE.Scene,
    private readonly siteRoot: THREE.Object3D,
    /** 場景裡的鏡面；找不到時視為一直看得到。 */
    private readonly mirror: THREE.Object3D | null,
  ) {}

  /** 把反射光裝進這棵樹裡所有受光的標準材質（已裝過的略過）。 */
  install(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const { material } = object as THREE.Mesh;
      const materials = Array.isArray(material) ? material : [material];
      for (const material of materials) installMirrorBounce(material, this.uniforms);
    });
  }

  /** 光線改變時呼叫。 */
  setLighting(lighting: SunLighting): MirrorBounce {
    this.bounce = computeMirrorBounce(lighting, this.wall);
    this.sync();
    return this.bounce;
  }

  /** 圖層改變時呼叫：鏡面藏起來或重新出現。 */
  sync(): void {
    const world = this.bounce && this.mirrorVisible() ? mirrorBounceToWorld(this.bounce, this.siteRoot) : null;
    writeMirrorBounceUniforms(this.uniforms, world, this.identity);
    publishSceneMirrorBounce(this.scene, world);
  }

  get landing(): MirrorBounceLanding {
    if (!this.bounce?.active || !this.mirrorVisible()) return 'none';
    return this.bounce.hitsPool ? 'pool' : 'outside-pool';
  }

  /** 陽光打到鏡面的入射角（度）；沒有照到正面時為 null。 */
  get incidenceAngle(): number | null {
    return this.bounce?.incidenceAngle ?? null;
  }

  private mirrorVisible(): boolean {
    for (let current: THREE.Object3D | null = this.mirror; current; current = current.parent) {
      if (!current.visible) return false;
    }
    return true;
  }
}
