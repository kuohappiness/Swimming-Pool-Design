import * as THREE from 'three';
import { MIRROR_FRONT_NORMAL_KEY, MIRROR_SURFACE_NAME, type VisualAssetContext } from '../contracts';
import type { RenderQualityProfile, RenderQualityTier } from '../quality-profile';
import { CubeReflectionProbe, type ReflectionProbe } from '../water/reflection-probe';

/**
 * 鏡牆的倒影（階段三步驟 4）。
 *
 * 鏡面原本只照出環境貼圖（天空與一片虛擬地面），向下外傾 23° 的鏡面看起來是一片深灰；
 * 省電級沒有環境貼圖，更是全黑。這裡在鏡面前方放一個反射探針，把真正的池廳、池面、
 * 地面與天空拍下來給鏡面用，並做「盒狀視差修正」：從鏡面上每一點沿反射方向走到包住基地的
 * 盒子，再從探針的位置去查那一點，近處的地面與池子才不會像凸面鏡一樣變形。
 *
 * 和水面的探針一樣，場景是靜態的，只在光線、圖層、剖視或畫質改變時重拍；拍的時候把鏡面
 * 自己藏起來。拍照與產生模糊層級都不在每一幀的繪製裡。
 */

/** 各畫質的探針邊長（像素）：和水面探針相同。 */
const PROBE_SIZE: Readonly<Record<RenderQualityTier, number>> = Object.freeze({ high: 256, medium: 128, low: 64 });

/** 探針放在鏡面中心正前方這麼遠（公尺）：太近會拍到鏡框，太遠視差修正的起點就偏了。 */
const PROBE_OFFSET_METRES = 0.6;

/** 視差修正的盒子往上延伸到這麼高（公尺）：天空在無限遠，盒頂只要比所有建築高就好。 */
const BOX_HEIGHT_METRES = 80;

const PARS_ANCHOR = '#include <envmap_physical_pars_fragment>';
const REFLECT_ANCHOR = 'reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );';
const MAPS_ANCHOR = '#include <lights_fragment_maps>';

/** 盒狀視差修正：所有向量都在「盒子座標」（基地的 SITE 根節點），盒子是軸對齊的。 */
const PARALLAX_PARS = /* glsl */`
uniform mat4 uMirrorProbeWorldToBox;
uniform mat3 uMirrorProbeBoxToWorld;
uniform vec3 uMirrorProbeBoxMin;
uniform vec3 uMirrorProbeBoxMax;
uniform vec3 uMirrorProbePosition;
vec3 mirrorProbeWorldPosition;

vec3 mirrorProbeParallax( vec3 worldDirection ) {
	vec3 origin = ( uMirrorProbeWorldToBox * vec4( mirrorProbeWorldPosition, 1.0 ) ).xyz;
	vec3 direction = normalize( mat3( uMirrorProbeWorldToBox ) * worldDirection );
	vec3 safe = vec3(
		abs( direction.x ) > 1e-5 ? direction.x : 1e-5,
		abs( direction.y ) > 1e-5 ? direction.y : 1e-5,
		abs( direction.z ) > 1e-5 ? direction.z : 1e-5
	);
	vec3 exit = max( ( uMirrorProbeBoxMax - origin ) / safe, ( uMirrorProbeBoxMin - origin ) / safe );
	float travel = min( min( exit.x, exit.y ), exit.z );
	// 起點不在盒子裡（不會發生，保險）就不修正。
	if ( travel <= 0.0 ) return worldDirection;
	return normalize( uMirrorProbeBoxToWorld * ( origin + direction * travel - uMirrorProbePosition ) );
}
`;

const PARALLAX_POSITION = /* glsl */`
mirrorProbeWorldPosition = ( vec4( geometryPosition - viewMatrix[ 3 ].xyz, 0.0 ) * viewMatrix ).xyz;
`;

export interface MirrorProbeUniforms {
  readonly uMirrorProbeWorldToBox: { value: THREE.Matrix4 };
  readonly uMirrorProbeBoxToWorld: { value: THREE.Matrix3 };
  readonly uMirrorProbeBoxMin: { value: THREE.Vector3 };
  readonly uMirrorProbeBoxMax: { value: THREE.Vector3 };
  readonly uMirrorProbePosition: { value: THREE.Vector3 };
}

export function createMirrorProbeUniforms(): MirrorProbeUniforms {
  return {
    uMirrorProbeWorldToBox: { value: new THREE.Matrix4() },
    uMirrorProbeBoxToWorld: { value: new THREE.Matrix3() },
    uMirrorProbeBoxMin: { value: new THREE.Vector3(-1, -1, -1) },
    uMirrorProbeBoxMax: { value: new THREE.Vector3(1, 1, 1) },
    uMirrorProbePosition: { value: new THREE.Vector3() },
  };
}

/**
 * 換掉這個材質查環境貼圖的方向，加上盒狀視差修正。只改這一個材質，不動 three.js 的共用片段。
 * three.js 的著色器對不上（改版）時不硬換，回傳 false，鏡面仍有倒影，只是沒有視差修正。
 */
export function installMirrorProbeParallax(
  material: THREE.MeshStandardMaterial,
  uniforms: MirrorProbeUniforms,
  chunks: Readonly<Record<string, string>> = THREE.ShaderChunk,
): boolean {
  const pars = chunks.envmap_physical_pars_fragment;
  if (typeof pars !== 'string' || pars.split(REFLECT_ANCHOR).length !== 2) return false;
  const patchedPars = pars.replace(REFLECT_ANCHOR, `${REFLECT_ANCHOR}\n\t\t\treflectVec = mirrorProbeParallax( reflectVec );`);
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    previous.call(this, shader, renderer);
    if (!shader.fragmentShader.includes(PARS_ANCHOR) || !shader.fragmentShader.includes(MAPS_ANCHOR)) return;
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(PARS_ANCHOR, `${PARALLAX_PARS}\n${patchedPars}`)
      .replace(MAPS_ANCHOR, `${PARALLAX_POSITION}\n${MAPS_ANCHOR}`);
  };
  material.customProgramCacheKey = function customProgramCacheKey() {
    return `${previousKey.call(this)}|mirror-probe-parallax`;
  };
  material.needsUpdate = true;
  return true;
}

export interface MirrorReflectionOptions {
  readonly renderer?: THREE.WebGLRenderer;
  /** 測試用的探針替身；沒給時由繪圖器建立。 */
  readonly createProbe?: (size: number) => ReflectionProbe;
}

interface AttachedMirror {
  readonly scene: THREE.Scene;
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly originalEnvMap: THREE.Texture | null;
  readonly originalIntensity: number;
  readonly probe: ReflectionProbe;
  readonly probePosition: THREE.Vector3;
  readonly parallax: boolean;
}

export class MirrorReflection {
  private readonly options: MirrorReflectionOptions;
  private profile: RenderQualityProfile;
  private attached: AttachedMirror | null = null;
  private readonly uniforms = createMirrorProbeUniforms();
  private stale = true;
  private disposed = false;

  constructor(initialProfile: RenderQualityProfile, options: MirrorReflectionOptions) {
    if (!options.renderer && !options.createProbe) {
      throw new TypeError('Mirror reflection needs a renderer or a reflection probe.');
    }
    this.options = options;
    this.profile = initialProfile;
  }

  /** 鏡面有沒有用上自己的倒影；場景裡沒有鏡面（例如圖面預覽）時是 false。 */
  get active(): boolean {
    return this.attached !== null;
  }

  /** 視差修正有沒有裝上。 */
  get parallaxCorrected(): boolean {
    return this.attached?.parallax ?? false;
  }

  attach(context: VisualAssetContext): void {
    if (this.disposed || this.attached) return;
    const found = context.siteRoot.getObjectByName(MIRROR_SURFACE_NAME) as THREE.Mesh | undefined;
    if (!found?.isMesh) return;
    const mesh = found;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (Array.isArray(material) || material.isMeshStandardMaterial !== true) return;
    const front: unknown = mesh.userData[MIRROR_FRONT_NORMAL_KEY];
    if (!Array.isArray(front) || front.length !== 3 || !front.every(Number.isFinite)) {
      throw new TypeError(`Mirror surface ${MIRROR_SURFACE_NAME} has no front normal.`);
    }
    const probe = this.createProbe(PROBE_SIZE[this.profile.id]);

    // 盒子：基地地坪的範圍（SITE 根節點的物件座標），從地面往上 80 m。
    const ground = context.siteRoot.getObjectByName('CUTAWAY-HIDE-SITE-GROUND') as THREE.Mesh | undefined;
    const box = new THREE.Box3();
    if (ground?.isMesh) {
      ground.geometry.computeBoundingBox();
      ground.updateMatrix();
      if (ground.geometry.boundingBox) box.copy(ground.geometry.boundingBox).applyMatrix4(ground.matrix);
      // 盒底是地坪的上表面：反射光線碰到的是地面，不是地坪板的底。
      box.min.y = box.max.y;
    }
    context.siteRoot.updateWorldMatrix(true, true);
    mesh.geometry.computeBoundingBox();
    const centre = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
    const normal = new THREE.Vector3(front[0], front[1], front[2]).normalize();
    // 鏡面網格 → SITE 根節點的物件座標。
    const meshToSite = new THREE.Matrix4()
      .copy(context.siteRoot.matrixWorld).invert().multiply(mesh.matrixWorld);
    const siteCentre = centre.clone().applyMatrix4(meshToSite);
    const siteNormal = normal.clone().transformDirection(meshToSite);
    const siteProbe = siteCentre.clone().addScaledVector(siteNormal, PROBE_OFFSET_METRES);
    if (box.isEmpty()) box.setFromCenterAndSize(siteProbe, new THREE.Vector3(80, 0, 80));
    box.max.y = Math.max(box.max.y, siteProbe.y) + BOX_HEIGHT_METRES;
    box.expandByPoint(siteProbe);

    this.uniforms.uMirrorProbeWorldToBox.value.copy(context.siteRoot.matrixWorld).invert();
    this.uniforms.uMirrorProbeBoxToWorld.value.setFromMatrix4(context.siteRoot.matrixWorld);
    this.uniforms.uMirrorProbeBoxMin.value.copy(box.min);
    this.uniforms.uMirrorProbeBoxMax.value.copy(box.max);
    this.uniforms.uMirrorProbePosition.value.copy(siteProbe);
    const parallax = installMirrorProbeParallax(material, this.uniforms);

    this.attached = {
      scene: context.scene,
      mesh,
      material,
      originalEnvMap: material.envMap,
      originalIntensity: material.envMapIntensity,
      probe,
      probePosition: siteProbe.clone().applyMatrix4(context.siteRoot.matrixWorld),
      parallax,
    };
    material.envMap = probe.texture;
    // 探針拍到的是場景本身的亮度，不再乘環境光的強度。
    material.envMapIntensity = 1;
    material.needsUpdate = true;
    this.stale = true;
  }

  setQuality(profile: RenderQualityProfile): void {
    if (this.disposed) return;
    this.profile = profile;
    const attached = this.attached;
    if (!attached) return;
    if (attached.probe.setSize(PROBE_SIZE[profile.id])) {
      attached.material.envMap = attached.probe.texture;
      attached.material.needsUpdate = true;
    }
    this.stale = true;
  }

  invalidate(): void {
    this.stale = true;
  }

  /** 需要時重拍。呼叫前場景的世界矩陣要已經更新。 */
  updateFrame(): void {
    const attached = this.attached;
    if (this.disposed || !attached || !this.stale) return;
    // 鏡面不在畫面上（3F 圖層關著）時不拍，等它出現再拍。
    if (!isVisibleInScene(attached.mesh)) return;
    this.stale = false;
    attached.probe.capture(attached.scene, attached.probePosition, [attached.mesh]);
    // 鏡面是光滑金屬，three.js 依粗糙度從這張貼圖產生模糊層級；貼圖內容換了要通知它重做。
    attached.probe.texture.needsPMREMUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const attached = this.attached;
    this.attached = null;
    if (!attached) return;
    attached.material.envMap = attached.originalEnvMap;
    attached.material.envMapIntensity = attached.originalIntensity;
    attached.material.needsUpdate = true;
    attached.probe.dispose();
  }

  private createProbe(size: number): ReflectionProbe {
    if (this.options.createProbe) return this.options.createProbe(size);
    return new CubeReflectionProbe(this.options.renderer!, size, 'realistic:mirror-reflection-probe');
  }
}

function isVisibleInScene(object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}
