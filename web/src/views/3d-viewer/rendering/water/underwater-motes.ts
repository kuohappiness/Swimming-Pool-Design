import * as THREE from 'three';
import fragmentShader from './shaders/underwater-motes.frag.glsl?raw';
import vertexShader from './shaders/underwater-motes.vert.glsl?raw';

/**
 * 水裡的懸浮微粒：幾百個小光點散在池水裡緩慢漂移，飄進光束時亮起來。
 * 一次繪製呼叫；只在水下畫面裡出現（由 `UnderwaterView` 控制顯示）。
 */
const SHARED_UNIFORM_NAMES = Object.freeze([
  'uPoolMin',
  'uPoolMax',
  'uWaterLevel',
  'uShallowBottom',
  'uDeepBottom',
  'uTime',
  'uSunDirection',
  'uSunColor',
  'uSkyColor',
  'uAbsorption',
  'uCaustics',
  'uCausticLayers',
  'uSunShadowMap',
  'uSunShadowMatrix',
  'uSunShadow',
] as const);

export const UNDERWATER_MOTES_NAME = 'realistic:underwater-motes';

/** 可重現的亂數（mulberry32）：每次載入微粒都在同樣的位置，截圖比對才穩定。 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createUnderwaterMotesGeometry(count: number): THREE.BufferGeometry {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('Underwater mote count must be a non-negative integer.');
  }
  const random = createRandom(0x51ed270b);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = random();
    positions[index * 3 + 1] = random();
    positions[index * 3 + 2] = random();
    seeds[index] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

export class UnderwaterMotes {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private count: number;
  private readonly bufferSize = new THREE.Vector2();
  private disposed = false;

  /**
   * @param waterUniforms 水面材質的 uniforms；共用的項目以同一個物件傳入（不複製）。
   * @param parent 水面網格；微粒用它的物件座標，水面被隱藏（拍倒影）時也跟著隱藏。
   */
  constructor(
    waterUniforms: Readonly<Record<string, THREE.IUniform>>,
    parent: THREE.Object3D,
    count: number,
  ) {
    const uniforms: Record<string, THREE.IUniform> = {
      uMoteSize: { value: 0.006 },
      uMoteOpacity: { value: 0.55 },
      uViewportHeight: { value: 1 },
    };
    for (const name of SHARED_UNIFORM_NAMES) {
      const shared = waterUniforms[name];
      if (!shared) throw new TypeError(`Water material is missing the shared uniform ${name}.`);
      uniforms[name] = shared;
    }
    const material = new THREE.ShaderMaterial({
      name: UNDERWATER_MOTES_NAME,
      vertexShader,
      fragmentShader,
      uniforms,
      clipping: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.count = count;
    this.points = new THREE.Points(createUnderwaterMotesGeometry(count), material);
    this.points.name = UNDERWATER_MOTES_NAME;
    // 位置在頂點著色器裡才決定，包圍盒沒有意義；也不參與點選與碰撞。
    this.points.frustumCulled = false;
    this.points.raycast = () => {};
    this.points.userData.visualOnly = true;
    this.points.userData.collisionExcluded = true;
    this.points.visible = false;
    this.points.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(this.bufferSize);
      material.uniforms.uViewportHeight.value = this.bufferSize.y;
    };
    parent.add(this.points);
  }

  /** 換微粒數量（畫質改變時）。 */
  setCount(count: number): void {
    if (this.disposed || count === this.count) return;
    const next = createUnderwaterMotesGeometry(count);
    this.points.geometry.dispose();
    this.points.geometry = next;
    this.count = count;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
