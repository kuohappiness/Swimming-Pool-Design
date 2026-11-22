import * as THREE from 'three';
import poolBasinChunk from './shaders/pool-basin.glsl?raw';
import fragmentSource from './shaders/underwater-view.frag.glsl?raw';
import vertexShader from './shaders/underwater-view.vert.glsl?raw';
import { POOL_BASIN_UNIFORM_NAMES } from './pool-basin-material';
import type { PoolBasinShape } from './water-surface';

/**
 * 水下畫面：鏡頭在池水裡時，場景先畫到一張貼圖，再用一個全螢幕的著色器加上水的吸收與散射、
 * 陽光穿過波紋的光束與水線，最後才色調映射到螢幕上。
 *
 * 只在鏡頭（近裁面的任一角）真的在水裡時才啟用；平常完全不花成本。是否在水裡看的是鏡頭位置，
 * 不是人物的移動狀態，所以水色不會比畫面早一步或晚一步出現。
 */
export interface UnderwaterView {
  /** 光束沿視線取樣幾次；0 代表不畫光束。 */
  setShaftSteps(steps: number): void;
  /**
   * 鏡頭在水裡時把這個畫面畫完並回傳 true；不在水裡時什麼都不做並回傳 false，由呼叫端照常畫。
   */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): boolean;
  dispose(): void;
}

export interface UnderwaterViewOptions {
  readonly basin: PoolBasinShape;
  /** 水面材質的 uniforms；共用的項目以同一個物件傳入（不複製）。 */
  readonly waterUniforms: Readonly<Record<string, THREE.IUniform>>;
  /** 水面網格；它的物件座標就是池體座標。 */
  readonly surface: THREE.Object3D;
  /** 長波的振幅總和（公尺）：判斷鏡頭是否碰到水時留的餘裕。 */
  readonly maximumWaveHeight: number;
  /** 只在水下畫面出現的物件（懸浮微粒）；不在水裡時保持隱藏。 */
  readonly underwaterOnly?: readonly THREE.Object3D[];
}

export const MAXIMUM_SHAFT_STEPS = 16;
/** 取樣 14 次時光束取焦散圖樣的第幾層縮圖；次數每減半就再模糊一層。 */
const SHAFT_BASE_LOD = 1.5;
const SHAFT_REFERENCE_STEPS = 14;

const SHARED_UNIFORM_NAMES = Object.freeze([...POOL_BASIN_UNIFORM_NAMES, 'uWaves'] as const);
/** 近裁面的四個角與中心（裁剪座標），用來判斷鏡頭有沒有碰到水。 */
const NEAR_PLANE_PROBES: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1],
]);

/** 鏡頭的近裁面有沒有任何一角在池水裡。 */
export function cameraTouchesWater(
  camera: THREE.Camera,
  worldToBasin: THREE.Matrix4,
  basin: PoolBasinShape,
  maximumWaveHeight: number,
  scratch: THREE.Vector3 = new THREE.Vector3(),
): boolean {
  for (const [x, y] of NEAR_PLANE_PROBES) {
    scratch.set(x, y, -1).applyMatrix4(camera.projectionMatrixInverse)
      .applyMatrix4(camera.matrixWorld).applyMatrix4(worldToBasin);
    if (
      scratch.y < basin.waterLevel + maximumWaveHeight
      && scratch.x > basin.minX && scratch.x < basin.maxX
      && scratch.z > basin.minZ && scratch.z < basin.maxZ
    ) return true;
  }
  return false;
}

export class ScreenUnderwaterView implements UnderwaterView {
  private readonly options: UnderwaterViewOptions;
  private readonly material: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly worldToBasin = new THREE.Matrix4();
  private readonly bufferSize = new THREE.Vector2();
  private readonly scratch = new THREE.Vector3();
  private target: THREE.WebGLRenderTarget | null = null;
  private disposed = false;

  constructor(options: UnderwaterViewOptions) {
    this.options = options;
    const uniforms: Record<string, THREE.IUniform> = {
      tScene: { value: null },
      tDepth: { value: null },
      uProjectionInverse: { value: new THREE.Matrix4() },
      uViewToBasin: { value: new THREE.Matrix4() },
      uShaftSteps: { value: 0 },
      // 光束在清水裡本來就淡；再強整片水會發白。
      uShaftStrength: { value: 0.07 },
      uShaftLod: { value: SHAFT_BASE_LOD },
    };
    for (const name of SHARED_UNIFORM_NAMES) {
      const shared = options.waterUniforms[name];
      if (!shared) throw new TypeError(`Water material is missing the shared uniform ${name}.`);
      uniforms[name] = shared;
    }
    this.material = new THREE.ShaderMaterial({
      name: 'realistic:underwater-view',
      vertexShader,
      fragmentShader: fragmentSource.replace('// #include pool-basin', poolBasinChunk),
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    // 一個蓋滿畫面的大三角形，比兩個三角形拼的四邊形少一條對角線接縫。
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geometry, this.material);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    for (const object of options.underwaterOnly ?? []) object.visible = false;
  }

  setShaftSteps(steps: number): void {
    if (!Number.isInteger(steps) || steps < 0 || steps > MAXIMUM_SHAFT_STEPS) {
      throw new RangeError(`Underwater shaft steps must be an integer within [0, ${MAXIMUM_SHAFT_STEPS}].`);
    }
    this.material.uniforms.uShaftSteps.value = steps;
    this.material.uniforms.uShaftLod.value = steps > 0
      ? SHAFT_BASE_LOD + Math.max(0, Math.log2(SHAFT_REFERENCE_STEPS / steps))
      : SHAFT_BASE_LOD;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): boolean {
    if (this.disposed) return false;
    const { basin, surface, maximumWaveHeight } = this.options;
    camera.updateMatrixWorld();
    this.worldToBasin.copy(surface.matrixWorld).invert();
    if (!cameraTouchesWater(camera, this.worldToBasin, basin, maximumWaveHeight, this.scratch)) return false;

    const target = this.ensureTarget(renderer);
    const underwaterOnly = this.options.underwaterOnly ?? [];
    for (const object of underwaterOnly) object.visible = true;
    try {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
    } finally {
      for (const object of underwaterOnly) object.visible = false;
      renderer.setRenderTarget(null);
    }

    const { uniforms } = this.material;
    uniforms.tScene.value = target.texture;
    uniforms.tDepth.value = target.depthTexture;
    (uniforms.uProjectionInverse.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
    (uniforms.uViewToBasin.value as THREE.Matrix4).multiplyMatrices(this.worldToBasin, camera.matrixWorld);
    renderer.render(this.quadScene, this.quadCamera);
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.target?.depthTexture?.dispose();
    this.target?.dispose();
    this.target = null;
    this.quad.geometry.dispose();
    this.material.dispose();
  }

  private ensureTarget(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
    renderer.getDrawingBufferSize(this.bufferSize);
    const width = Math.max(1, this.bufferSize.x);
    const height = Math.max(1, this.bufferSize.y);
    if (this.target) {
      if (this.target.width !== width || this.target.height !== height) this.target.setSize(width, height);
      return this.target;
    }
    this.target = new THREE.WebGLRenderTarget(width, height, {
      // 色調映射在最後才做，中間這張要存得下比白色更亮的值。
      type: renderer.extensions.has('EXT_color_buffer_float')
        || renderer.extensions.has('EXT_color_buffer_half_float')
        ? THREE.HalfFloatType
        : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthTexture: new THREE.DepthTexture(width, height),
    });
    this.target.texture.name = 'realistic:underwater-scene';
    return this.target;
  }
}
