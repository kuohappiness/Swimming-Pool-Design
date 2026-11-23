import * as THREE from 'three';
import { isReflectionCapture } from '../lighting/reflection-capture';
import type { PoolHallShape } from '../water/water-surface';

/**
 * 池館室內的反射（TASK-152 步驟 5）：池廳裡的不鏽鋼、玻璃與濕地面照出池館本身，
 * 而不是照出天空。沿用水面那一個池廳中央的反射探針（同一張六面貼圖、同一個盒狀視差修正），
 * 不多拍一次。
 *
 * 一點在池廳裡、而且反射方向留在池廳裡（不是從外面看玻璃、往外反射）時，
 * 用探針取代環境貼圖的反射；池廳外面維持環境貼圖。粗糙度越高，取縮圖鏈越模糊的一層。
 */

/** 探針的來源：水面的寫實呈現提供。座標是水面網格的物件座標。 */
export interface HallProbeSource {
  readonly texture: THREE.CubeTexture;
  /** 探針貼圖的邊長（像素）。 */
  readonly size: number;
  readonly probePosition: THREE.Vector3;
  readonly hall: PoolHallShape;
  /** 水面網格的世界矩陣。 */
  readonly localToWorld: THREE.Matrix4;
}

export interface HallReflectionUniforms {
  readonly uHallProbe: THREE.IUniform<THREE.CubeTexture | null>;
  readonly uHallProbeStrength: THREE.IUniform<number>;
  readonly uHallProbeWorldToLocal: THREE.IUniform<THREE.Matrix4>;
  readonly uHallProbeLocalToWorld: THREE.IUniform<THREE.Matrix3>;
  /** x、z 是池廳的範圍，y 是地面。 */
  readonly uHallProbeMin: THREE.IUniform<THREE.Vector3>;
  readonly uHallProbeMax: THREE.IUniform<THREE.Vector3>;
  /** x = 池廳最小 x 處的屋頂高程，y = 沿 x 每公尺升高多少。 */
  readonly uHallProbeRoof: THREE.IUniform<THREE.Vector2>;
  readonly uHallProbePosition: THREE.IUniform<THREE.Vector3>;
  readonly uHallProbeMaxMip: THREE.IUniform<number>;
}

export function createHallReflectionUniforms(): HallReflectionUniforms {
  return {
    uHallProbe: { value: null },
    uHallProbeStrength: { value: 0 },
    uHallProbeWorldToLocal: { value: new THREE.Matrix4() },
    uHallProbeLocalToWorld: { value: new THREE.Matrix3() },
    uHallProbeMin: { value: new THREE.Vector3() },
    uHallProbeMax: { value: new THREE.Vector3() },
    uHallProbeRoof: { value: new THREE.Vector2() },
    uHallProbePosition: { value: new THREE.Vector3() },
    uHallProbeMaxMip: { value: 0 },
  };
}

const HALL_REFLECTION_PARS = /* glsl */ `
uniform samplerCube uHallProbe;
uniform float uHallProbeStrength;
uniform mat4 uHallProbeWorldToLocal;
uniform mat3 uHallProbeLocalToWorld;
uniform vec3 uHallProbeMin;
uniform vec3 uHallProbeMax;
uniform vec2 uHallProbeRoof;
uniform vec3 uHallProbePosition;
uniform float uHallProbeMaxMip;

// 一點在池廳裡有多少（0 到 1）：貼著玻璃牆與屋頂（在邊界上）仍算在裡面，往外 0.3 m 降到 0。
float hallProbeInside( vec3 local ) {
	float roof = uHallProbeRoof.x + uHallProbeRoof.y * ( local.x - uHallProbeMin.x );
	float horizontal = min(
		min( local.x - uHallProbeMin.x, uHallProbeMax.x - local.x ),
		min( local.z - uHallProbeMin.z, uHallProbeMax.z - local.z )
	);
	float vertical = min( local.y - uHallProbeMin.y, roof - local.y );
	return smoothstep( - 0.3, 0.0, min( horizontal, vertical ) );
}

// 從池廳裡一點沿 direction 走到池廳邊界（牆、地面或斜屋頂）的距離；往外走的回傳 0。
float hallProbeReach( vec3 origin, vec3 direction ) {
	vec3 safe = vec3(
		abs( direction.x ) > 1.0e-5 ? direction.x : 1.0e-5,
		direction.y,
		abs( direction.z ) > 1.0e-5 ? direction.z : 1.0e-5
	);
	float tX = ( ( safe.x > 0.0 ? uHallProbeMax.x : uHallProbeMin.x ) - origin.x ) / safe.x;
	float tZ = ( ( safe.z > 0.0 ? uHallProbeMax.z : uHallProbeMin.z ) - origin.z ) / safe.z;
	float roofAtOrigin = uHallProbeRoof.x + uHallProbeRoof.y * ( origin.x - uHallProbeMin.x );
	float roofDenominator = direction.y - uHallProbeRoof.y * direction.x;
	float tY = direction.y < - 1.0e-5
		? ( uHallProbeMin.y - origin.y ) / direction.y
		: ( roofDenominator > 1.0e-5 ? ( roofAtOrigin - origin.y ) / roofDenominator : 1.0e9 );
	return max( min( min( tX, tZ ), tY ), 0.0 );
}
`;

/**
 * 加在 three.js 的環境光照（lights_fragment_maps）之後：radiance 已經有環境貼圖的反射，
 * 在池廳裡換成探針的反射。反射方向的算法與 three.js 的 getIBLRadiance 相同。
 */
const HALL_REFLECTION_APPLY = /* glsl */ `
#if defined( RE_IndirectSpecular ) && defined( USE_ENVMAP )
	if ( uHallProbeStrength > 0.0 ) {
		vec3 hallWorld = ( vec4( geometryPosition - viewMatrix[ 3 ].xyz, 0.0 ) * viewMatrix ).xyz;
		vec3 hallLocal = ( uHallProbeWorldToLocal * vec4( hallWorld, 1.0 ) ).xyz;
		float hallInside = hallProbeInside( hallLocal );
		if ( hallInside > 0.0 ) {
			vec3 hallReflect = reflect( - geometryViewDir, geometryNormal );
			hallReflect = normalize( mix( hallReflect, geometryNormal, pow4( material.roughness ) ) );
			hallReflect = inverseTransformDirection( hallReflect, viewMatrix );
			vec3 hallDirection = normalize( mat3( uHallProbeWorldToLocal ) * hallReflect );
			float hallTravel = hallProbeReach( hallLocal, hallDirection );
			// 從外面看玻璃（反射往池廳外走）時走不了多遠，維持環境貼圖。
			float hallWeight = hallInside * smoothstep( 0.2, 1.0, hallTravel ) * uHallProbeStrength;
			if ( hallWeight > 0.0 ) {
				vec3 hallLookup = uHallProbeLocalToWorld * ( hallLocal + hallDirection * hallTravel - uHallProbePosition );
				// 粗糙度換成縮圖鏈的層：反射光瓣的寬度（約 roughness² 弧度）對應到一格的大小。
				float hallAlpha = max( material.roughness * material.roughness, exp2( - uHallProbeMaxMip ) );
				float hallLod = clamp( uHallProbeMaxMip + log2( hallAlpha / 1.5708 ), 0.0, uHallProbeMaxMip );
				vec3 hallRadiance = textureLod( uHallProbe, hallLookup, hallLod ).rgb;
				radiance = mix( radiance, hallRadiance, hallWeight );
			}
		}
	}
#endif
`;

const LIGHTS_MAPS = '#include <lights_fragment_maps>';
const COMMON = '#include <common>';

/**
 * 把池廳反射裝進一個 three.js 內建的受光材質（標準、物理）。回傳 false 代表不裝
 * （不是標準材質，或它已經有自己的反射探針，例如鏡牆）。
 */
export function installHallReflection(
  material: THREE.Material,
  uniforms: HallReflectionUniforms,
): boolean {
  if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial !== true) return false;
  if (material.userData.hallReflection === uniforms) return true;
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    previous.call(this, shader, renderer);
    if (!shader.fragmentShader.includes(LIGHTS_MAPS) || !shader.fragmentShader.includes(COMMON))
      return;
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(COMMON, `${COMMON}\n${HALL_REFLECTION_PARS}`)
      .replace(LIGHTS_MAPS, `${LIGHTS_MAPS}\n${HALL_REFLECTION_APPLY}`);
  };
  material.customProgramCacheKey = function customProgramCacheKey() {
    return `${previousKey.call(this)}|hall-reflection`;
  };
  material.userData.hallReflection = uniforms;
  material.needsUpdate = true;
  return true;
}

/**
 * 場景裡的池館室內反射：每個畫面從水的探針取最新的貼圖與位置寫進共用的 uniform。
 *
 * 拍倒影（探針、平面倒影）的時候不用它：探針不能一邊被畫、一邊被讀（瀏覽器會擋下這次繪製），
 * 拍到的畫面也不該包含上一次拍的倒影（否則每重拍一次就多反射一層）。
 */
export class HallReflection {
  readonly uniforms: HallReflectionUniforms = createHallReflectionUniforms();
  private scene: THREE.Scene | null = null;
  private previousBefore: THREE.Scene['onBeforeRender'] | null = null;
  private previousAfter: THREE.Scene['onAfterRender'] | null = null;
  private readonly saved: { texture: THREE.CubeTexture | null; strength: number }[] = [];
  private active = false;
  private readonly owned = new Set<THREE.Material>();
  private readonly skipped = new Set<THREE.Material>();

  constructor(private readonly source: () => HallProbeSource | null) {}

  /** 池廳反射有沒有在用（水的探針已經拍好）。 */
  get enabled(): boolean {
    return this.active;
  }

  attach(scene: THREE.Scene): void {
    if (this.scene === scene) return;
    this.detach();
    this.scene = scene;
    this.previousBefore = scene.onBeforeRender;
    this.previousAfter = scene.onAfterRender;
    // 場景的這兩個鉤子在每一次 renderer.render(scene, camera) 的開頭與結尾各呼叫一次；
    // 平面倒影是在主畫面中途另畫一次，所以用堆疊存回原本的值。
    scene.onBeforeRender = (...args) => {
      this.previousBefore?.apply(scene, args);
      const camera = args[2];
      this.saved.push({
        texture: this.uniforms.uHallProbe.value,
        strength: this.uniforms.uHallProbeStrength.value,
      });
      if (isReflectionCapture(camera)) {
        this.uniforms.uHallProbe.value = null;
        this.uniforms.uHallProbeStrength.value = 0;
      }
    };
    scene.onAfterRender = (...args) => {
      const saved = this.saved.pop();
      if (saved) {
        this.uniforms.uHallProbe.value = saved.texture;
        this.uniforms.uHallProbeStrength.value = saved.strength;
      }
      this.previousAfter?.apply(scene, args);
    };
    this.install(scene);
  }

  /**
   * 裝進這棵樹裡受光的標準材質。已經有自己環境貼圖的材質（鏡牆的探針）不裝：
   * 它們的反射已經是拍出來的場景。
   */
  install(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const { material } = object as THREE.Mesh;
      for (const entry of Array.isArray(material) ? material : [material]) {
        if (this.owned.has(entry) || this.skipped.has(entry)) continue;
        const ownEnvironment = (entry as THREE.MeshStandardMaterial).envMap;
        if (ownEnvironment && (ownEnvironment as THREE.CubeTexture).isCubeTexture === true) {
          this.skipped.add(entry);
          continue;
        }
        if (installHallReflection(entry, this.uniforms)) this.owned.add(entry);
      }
    });
  }

  /** 每個畫面呼叫一次（在水拍完探針之後）。 */
  updateFrame(): void {
    const source = this.source();
    const uniforms = this.uniforms;
    if (!source) {
      this.active = false;
      uniforms.uHallProbe.value = null;
      uniforms.uHallProbeStrength.value = 0;
      return;
    }
    this.active = true;
    const { hall } = source;
    uniforms.uHallProbe.value = source.texture;
    uniforms.uHallProbeStrength.value = 1;
    uniforms.uHallProbeWorldToLocal.value.copy(source.localToWorld).invert();
    uniforms.uHallProbeLocalToWorld.value.setFromMatrix4(source.localToWorld);
    uniforms.uHallProbeMin.value.set(hall.minX, hall.floor, hall.minZ);
    uniforms.uHallProbeMax.value.set(
      hall.maxX,
      Math.max(hall.roofAtMinX, hall.roofAtMaxX),
      hall.maxZ,
    );
    uniforms.uHallProbeRoof.value.set(
      hall.roofAtMinX,
      (hall.roofAtMaxX - hall.roofAtMinX) / (hall.maxX - hall.minX),
    );
    uniforms.uHallProbePosition.value.copy(source.probePosition);
    uniforms.uHallProbeMaxMip.value = Math.log2(Math.max(source.size, 1));
  }

  detach(): void {
    if (!this.scene) return;
    this.scene.onBeforeRender = this.previousBefore ?? (() => {});
    this.scene.onAfterRender = this.previousAfter ?? (() => {});
    this.scene = null;
    this.previousBefore = null;
    this.previousAfter = null;
    this.saved.length = 0;
  }

  dispose(): void {
    this.detach();
    this.uniforms.uHallProbe.value = null;
    this.uniforms.uHallProbeStrength.value = 0;
    this.active = false;
  }
}
