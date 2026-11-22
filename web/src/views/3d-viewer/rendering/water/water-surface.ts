import * as THREE from 'three';
import poolBasinChunk from './shaders/pool-basin.glsl?raw';
import fragmentSource from './shaders/water-surface.frag.glsl?raw';
import vertexShader from './shaders/water-surface.vert.glsl?raw';

/**
 * 寫實水面（階段二）。一個獨立的網格加一支著色器：
 *
 * - 水面起伏：幾道長波在頂點著色器位移，兩層細波紋法線貼圖疊在上面。
 * - 反射：依菲涅耳公式混合；正看水面幾乎全透，斜看才變成鏡子。
 * - 折射：池體是已知形狀的斜底方盒，所以折射後看到池底哪一點可以直接用算的，
 *   不必把整個場景多畫一次。這是「不犧牲流暢度」的關鍵：四級畫質都負擔得起。
 * - 水下：同一支著色器從下往上看，自然得到全反射與斯涅爾窗。
 *
 * 每個畫面只更新幾個 uniform，不重傳貼圖、不重編著色器。
 */

/** 池體形狀，全部來自模型；座標是水面網格的物件座標（x 沿池長、y 向上、z 沿池寬）。 */
export interface PoolBasinShape {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly waterLevel: number;
  /** x = minX 處的池底高程。 */
  readonly shallowBottom: number;
  /** x = maxX 處的池底高程。 */
  readonly deepBottom: number;
  /** 池底水道線中心的 z，最多 8 條。 */
  readonly laneLineZ: readonly number[];
}

export interface WaterWave {
  /** 前進方向與 +x 的夾角（度），在水平面上量。 */
  readonly directionDegrees: number;
  readonly wavelength: number;
  readonly amplitude: number;
}

export interface WaterSurfaceOptions {
  readonly basin: PoolBasinShape;
  readonly rippleNormal: THREE.Texture;
  /** 焦散明暗圖樣（`materials/water/caustics.ktx2`）。 */
  readonly caustics: THREE.Texture;
  readonly reflectionCube: THREE.CubeTexture;
  /** 水面網格的格距（公尺）；越小長波越圓滑，三角形越多。 */
  readonly cellSize: number;
  readonly waves?: readonly WaterWave[];
}

export interface WaterFrameState {
  readonly timeSeconds: number;
  readonly camera: THREE.Camera;
  /** 指向太陽的世界座標單位向量。 */
  readonly sunDirection: THREE.Vector3;
  readonly sunColor: THREE.Color;
  readonly skyColor: THREE.Color;
}

export const MAXIMUM_LANE_LINES = 8;
const UNUSED_LANE_LINE = 1e6;

/** 室內泳池的靜水面：水循環與少數泳者造成的低矮長波，最高約 1 公分。 */
export const CALM_POOL_WAVES: readonly WaterWave[] = Object.freeze([
  Object.freeze({ directionDegrees: 12, wavelength: 3.1, amplitude: 0.006 }),
  Object.freeze({ directionDegrees: 103, wavelength: 2.2, amplitude: 0.004 }),
  Object.freeze({ directionDegrees: 221, wavelength: 1.3, amplitude: 0.0025 }),
  Object.freeze({ directionDegrees: 318, wavelength: 0.8, amplitude: 0.0015 }),
]);

export function assertPoolBasinShape(basin: PoolBasinShape): PoolBasinShape {
  const values = [
    basin.minX, basin.maxX, basin.minZ, basin.maxZ,
    basin.waterLevel, basin.shallowBottom, basin.deepBottom, ...basin.laneLineZ,
  ];
  if (!values.every(Number.isFinite)) throw new TypeError('Pool basin shape must be finite.');
  if (!(basin.maxX > basin.minX && basin.maxZ > basin.minZ)) {
    throw new TypeError('Pool basin must have positive length and width.');
  }
  if (!(basin.waterLevel > basin.shallowBottom && basin.waterLevel > basin.deepBottom)) {
    throw new TypeError('Pool basin floor must be below the water level.');
  }
  if (basin.laneLineZ.length > MAXIMUM_LANE_LINES) {
    throw new RangeError(`Pool basin supports at most ${MAXIMUM_LANE_LINES} lane lines.`);
  }
  if (basin.laneLineZ.some((z) => z <= basin.minZ || z >= basin.maxZ)) {
    throw new RangeError('Pool lane lines must lie inside the basin.');
  }
  return basin;
}

/** 貼齊池壁的水面網格。格數取整，所以實際格距會略小於 cellSize。 */
export function createWaterSurfaceGeometry(basin: PoolBasinShape, cellSize: number): THREE.BufferGeometry {
  assertPoolBasinShape(basin);
  if (!(cellSize > 0)) throw new RangeError('Water surface cellSize must be positive.');
  const length = basin.maxX - basin.minX;
  const width = basin.maxZ - basin.minZ;
  const columns = Math.max(1, Math.ceil(length / cellSize));
  const rows = Math.max(1, Math.ceil(width / cellSize));
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  const indices: number[] = [];

  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const offset = (row * (columns + 1) + column) * 3;
      positions[offset] = basin.minX + (length * column) / columns;
      positions[offset + 1] = basin.waterLevel;
      positions[offset + 2] = basin.minZ + (width * row) / rows;
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  // 波浪只有幾公分高，包圍盒加一點厚度就不會被誤判成看不到。
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(basin.minX, basin.waterLevel - 0.05, basin.minZ),
    new THREE.Vector3(basin.maxX, basin.waterLevel + 0.05, basin.maxZ),
  );
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  return geometry;
}

function waveUniforms(waves: readonly WaterWave[]): THREE.Vector4[] {
  if (waves.length > 4) throw new RangeError('Water surface supports at most 4 waves.');
  return Array.from({ length: 4 }, (_, index) => {
    const wave = waves[index];
    if (!wave) return new THREE.Vector4(1, 0, 1, 0);
    if (!(wave.wavelength > 0) || !(wave.amplitude >= 0)) {
      throw new RangeError('Water wave needs a positive wavelength and a non-negative amplitude.');
    }
    const angle = THREE.MathUtils.degToRad(wave.directionDegrees);
    return new THREE.Vector4(Math.cos(angle), Math.sin(angle), wave.wavelength, wave.amplitude);
  });
}

export function createWaterSurfaceMaterial(options: WaterSurfaceOptions): THREE.ShaderMaterial {
  const basin = assertPoolBasinShape(options.basin);
  const laneLineZ = Array.from(
    { length: MAXIMUM_LANE_LINES },
    (_, index) => basin.laneLineZ[index] ?? UNUSED_LANE_LINE,
  );
  const material = new THREE.ShaderMaterial({
    name: 'realistic:water-surface',
    vertexShader,
    fragmentShader: fragmentSource.replace('// #include pool-basin', poolBasinChunk),
    fog: true,
    clipping: true,
    // 水面兩面都看得到：池畔往下看，或潛到水裡往上看。
    side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uWaves: { value: waveUniforms(options.waves ?? CALM_POOL_WAVES) },
        uCameraLocal: { value: new THREE.Vector3() },
        uLocalToWorld: { value: new THREE.Matrix3() },
        uReflectionCube: { value: null },
        uReflectionIntensity: { value: 1 },
        uRippleNormal: { value: null },
        uRippleLayers: {
          value: [
            new THREE.Vector4(1 / 2.6, 0.26, 0.021, 0.013),
            new THREE.Vector4(1 / 0.9, 0.15, -0.017, 0.024),
          ],
        },
        uSunGlintSharpness: { value: 900 },
        uRefractionLodBias: { value: 2.5 },
        uCaustics: { value: null },
        uCausticLayers: {
          value: [
            new THREE.Vector4(1 / 5.2, 0, 0.034, 0.021),
            new THREE.Vector4(1 / 3.3, 0, -0.027, 0.031),
          ],
        },
        uCausticStrength: { value: 1 },
        uPoolMin: { value: new THREE.Vector2(basin.minX, basin.minZ) },
        uPoolMax: { value: new THREE.Vector2(basin.maxX, basin.maxZ) },
        uWaterLevel: { value: basin.waterLevel },
        uShallowBottom: { value: basin.shallowBottom },
        uDeepBottom: { value: basin.deepBottom },
        uTileSize: { value: 0.25 },
        uGroutWidth: { value: 0.006 },
        uTileColor: { value: new THREE.Color(0.62, 0.8, 0.86) },
        uGroutColor: { value: new THREE.Color(0.5, 0.62, 0.66) },
        uLaneLineColor: { value: new THREE.Color(0.012, 0.03, 0.075) },
        uLaneLineWidth: { value: 0.25 },
        uLaneLineInset: { value: 2 },
        uLaneLineZ: { value: laneLineZ },
        // 清水對紅光吸收最強，所以深處偏藍綠。單位：每公尺。
        uAbsorption: { value: new THREE.Vector3(0.38, 0.07, 0.045) },
        uScatterColor: { value: new THREE.Color(0.02, 0.09, 0.11) },
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uSkyColor: { value: new THREE.Color(1, 1, 1) },
      },
    ]),
  });
  // merge 會複製貼圖物件；貼圖要用原本那一份，所以合併後再指定。
  material.uniforms.uRippleNormal.value = options.rippleNormal;
  material.uniforms.uReflectionCube.value = options.reflectionCube;
  material.uniforms.uCaustics.value = options.caustics;
  return material;
}

export class WaterSurface {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly inverseWorld = new THREE.Matrix4();
  private readonly localSun = new THREE.Vector3();
  private disposed = false;

  constructor(options: WaterSurfaceOptions) {
    for (const texture of [options.rippleNormal, options.caustics]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
    }
    this.mesh = new THREE.Mesh(
      createWaterSurfaceGeometry(options.basin, options.cellSize),
      createWaterSurfaceMaterial(options),
    );
    this.mesh.name = 'POOL-01-WATER-SURFACE';
    this.mesh.userData.waterSurfaceElevation = options.basin.waterLevel;
    this.mesh.userData.visualOnly = true;
    this.mesh.userData.collisionExcluded = true;
  }

  /** 每個畫面呼叫一次，只改 uniform。呼叫前場景的世界矩陣要已經更新。 */
  update(frame: WaterFrameState): void {
    if (this.disposed) return;
    const { uniforms } = this.mesh.material;
    this.inverseWorld.copy(this.mesh.matrixWorld).invert();

    uniforms.uTime.value = frame.timeSeconds;
    (uniforms.uCameraLocal.value as THREE.Vector3)
      .setFromMatrixPosition(frame.camera.matrixWorld)
      .applyMatrix4(this.inverseWorld);
    (uniforms.uLocalToWorld.value as THREE.Matrix3).setFromMatrix4(this.mesh.matrixWorld);
    // 方向用逆矩陣的 3×3 轉進物件座標；基地根節點只有旋轉與鏡射，轉完長度不變。
    this.localSun.copy(frame.sunDirection).transformDirection(this.inverseWorld);
    (uniforms.uSunDirection.value as THREE.Vector3).copy(this.localSun);
    (uniforms.uSunColor.value as THREE.Color).copy(frame.sunColor);
    (uniforms.uSkyColor.value as THREE.Color).copy(frame.skyColor);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
