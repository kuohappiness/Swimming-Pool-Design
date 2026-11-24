import * as THREE from 'three';
import {
  createMirrorBounceUniforms,
  pickMirrorBounceUniforms,
  writeMirrorBounceUniforms,
  type MirrorBounceUniforms,
  type WorldMirrorBounce,
} from '../lighting/mirror-bounce';
import {
  createWaterLightUniforms,
  pickWaterLightUniforms,
  writeWaterLightUniforms,
  type WaterLightUniforms,
  type WorldFixtureLights,
} from '../lighting/fixture-lights';
import { withPoolBasin } from './pool-basin-material';
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

/**
 * 泡在水裡的方盒（池梯踏階、教學平台）。折射後的視線先碰到它就看到它，而不是池底。
 * 座標與池體相同；整個方盒必須在水面下、池體內。
 */
export interface SubmergedBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** metal：不鏽鋼構件，用扶手材質的顏色；tile：和池體貼同一種磚。 */
  readonly finish: 'metal' | 'tile';
}

/** @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。 */
export const MAXIMUM_SUBMERGED_BOXES = 12;

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
  /** 池底水道線的寬度（公尺）。 */
  readonly laneLineWidth: number;
  /** 池底水道線兩端距池壁的距離（公尺）。 */
  readonly laneLineInset: number;
  /** 水裡的方盒，最多 12 個。 */
  readonly submergedBoxes?: readonly SubmergedBox[];
}

/**
 * 池廳內部的大小，近似成一個單斜屋頂的方盒，用來修正反射探針的視差。座標與池體相同。
 * 只影響倒影的位置，不是畫出來的幾何。
 */
export interface PoolHallShape {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** 池畔地面高程。 */
  readonly floor: number;
  /** x = minX 處的屋頂高程。 */
  readonly roofAtMinX: number;
  /** x = maxX 處的屋頂高程。 */
  readonly roofAtMaxX: number;
}

/** @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。 */
export function assertPoolHallShape(hall: PoolHallShape, basin: PoolBasinShape): PoolHallShape {
  const values = [
    hall.minX,
    hall.maxX,
    hall.minZ,
    hall.maxZ,
    hall.floor,
    hall.roofAtMinX,
    hall.roofAtMaxX,
  ];
  if (!values.every(Number.isFinite)) throw new TypeError('Pool hall shape must be finite.');
  if (
    hall.minX > basin.minX ||
    hall.maxX < basin.maxX ||
    hall.minZ > basin.minZ ||
    hall.maxZ < basin.maxZ
  ) {
    throw new RangeError('Pool hall must contain the pool basin.');
  }
  if (!(hall.roofAtMinX > basin.waterLevel && hall.roofAtMaxX > basin.waterLevel)) {
    throw new RangeError('Pool hall roof must be above the water level.');
  }
  return hall;
}

interface WaterWave {
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
  /** 池廳內部的大小；有給時探針倒影會依它修正視差。 */
  readonly hall?: PoolHallShape;
  /** 池底水道線的顏色（線性色彩空間）；沒給時用深藍。 */
  readonly laneLineColor?: THREE.Color;
  /** 水裡金屬構件（池梯踏階）的顏色，與扶手材質一致；沒給時用不鏽鋼灰。 */
  readonly metalColor?: THREE.Color;
  /** 水面網格的格距（公尺）；越小長波越圓滑，三角形越多。 */
  readonly cellSize: number;
  readonly waves?: readonly WaterWave[];
}

/** 太陽的陰影貼圖，讓池底、水面反光與水下光束知道哪裡在影子裡。 */
export interface WaterSunShadow {
  /** 深度比較用的陰影貼圖（three.js 的 PCF 陰影）。 */
  readonly map: THREE.DepthTexture;
  /** 世界座標轉到陰影貼圖座標（`light.shadow.matrix`）。 */
  readonly matrix: THREE.Matrix4;
  /** 深度偏移，以陰影相機的深度範圍為 1。 */
  readonly bias: number;
  /** 影子邊緣的取樣半徑，以貼圖寬度為 1。 */
  readonly radius: number;
}

export interface WaterFrameState {
  readonly timeSeconds: number;
  readonly camera: THREE.Camera;
  /** 指向太陽的世界座標單位向量。 */
  readonly sunDirection: THREE.Vector3;
  readonly sunColor: THREE.Color;
  readonly skyColor: THREE.Color;
  /** 沒有陰影（省電級、陰影貼圖還沒畫出來）時給 null，水就當作全部照得到太陽。 */
  readonly sunShadow?: WaterSunShadow | null;
  /** 鏡牆反射的日光（世界座標）；沒有給或關著時池底只有陽光。 */
  readonly mirrorBounce?: WorldMirrorBounce | null;
  /** 池館燈具（世界座標）；沒有給或燈沒開時水裡只有日光。 */
  readonly fixtureLights?: WorldFixtureLights | null;
}

/**
 * 水體散射回來的顏色：晴天正午的天光（亮度約 0.886）下是 `WATER_SCATTER_AT_NOON`，
 * 其餘時候依天光與燈光在水裡的照度等比例變化，夜裡沒開燈的水不會自己發亮。
 */
const WATER_SCATTER_AT_NOON = Object.freeze([0.02, 0.09, 0.11] as const);
const NOON_SKY_LUMINANCE = 0.886;
const luminanceOf = (color: THREE.Color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

/**
 * 沒有陰影貼圖時綁的備用貼圖。著色器裡的陰影取樣器一定要綁一張「深度比較」貼圖，
 * 綁一般貼圖會被瀏覽器擋下來；這一張只有 1×1，強度為 0 時不會真的用到它的內容。
 */
function createFallbackShadowMap(): THREE.DepthTexture {
  const texture = new THREE.DepthTexture(1, 1);
  texture.name = 'realistic:water-sun-shadow-fallback';
  texture.compareFunction = THREE.LessEqualCompare;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // 不掛在繪製目標上的深度貼圖要自己標記，three.js 才會把它建出來。
  texture.needsUpdate = true;
  return texture;
}

/**
 * 平面倒影被波紋推開的幅度，取決於被照出來的東西離水面多遠。池廳屋頂離水面約 6 公尺，
 * 最近的牆與池畔設施約在 8 公尺內；這只影響倒影晃動的大小，不是幾何尺寸。
 */
const PLANAR_REACH = Object.freeze({ roof: 6, wall: 8 });

/** @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。 */
export const MAXIMUM_LANE_LINES = 8;
const UNUSED_LANE_LINE = 1e6;

/**
 * 室內泳池的靜水面：水循環與少數泳者造成的低矮長波，最高約 1 公分。
 * @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。
 */
export const CALM_POOL_WAVES: readonly WaterWave[] = Object.freeze([
  Object.freeze({ directionDegrees: 12, wavelength: 3.1, amplitude: 0.006 }),
  Object.freeze({ directionDegrees: 103, wavelength: 2.2, amplitude: 0.004 }),
  Object.freeze({ directionDegrees: 221, wavelength: 1.3, amplitude: 0.0025 }),
  Object.freeze({ directionDegrees: 318, wavelength: 0.8, amplitude: 0.0015 }),
]);

/** @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。 */
export function assertPoolBasinShape(basin: PoolBasinShape): PoolBasinShape {
  const values = [
    basin.minX,
    basin.maxX,
    basin.minZ,
    basin.maxZ,
    basin.waterLevel,
    basin.shallowBottom,
    basin.deepBottom,
    ...basin.laneLineZ,
    basin.laneLineWidth,
    basin.laneLineInset,
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
  if (!(basin.laneLineWidth > 0) || basin.laneLineInset < 0) {
    throw new RangeError('Pool lane lines need a positive width and a non-negative inset.');
  }
  const boxes = basin.submergedBoxes ?? [];
  if (boxes.length > MAXIMUM_SUBMERGED_BOXES) {
    throw new RangeError(`Pool basin supports at most ${MAXIMUM_SUBMERGED_BOXES} submerged boxes.`);
  }
  for (const box of boxes) {
    const numbers = [box.minX, box.maxX, box.minY, box.maxY, box.minZ, box.maxZ];
    if (!numbers.every(Number.isFinite)) throw new TypeError('Submerged box must be finite.');
    if (!(box.maxX > box.minX && box.maxY > box.minY && box.maxZ > box.minZ)) {
      throw new RangeError('Submerged box must have positive size.');
    }
    if (
      box.minX < basin.minX ||
      box.maxX > basin.maxX ||
      box.minZ < basin.minZ ||
      box.maxZ > basin.maxZ ||
      box.maxY >= basin.waterLevel
    ) {
      throw new RangeError('Submerged box must lie inside the basin, below the water level.');
    }
    if (box.finish !== 'metal' && box.finish !== 'tile') {
      throw new TypeError(`Unknown submerged box finish: ${String(box.finish)}`);
    }
  }
  return basin;
}

/**
 * 貼齊池壁的水面網格。格數取整，所以實際格距會略小於 cellSize。
 * @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。
 */
export function createWaterSurfaceGeometry(
  basin: PoolBasinShape,
  cellSize: number,
): THREE.BufferGeometry {
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

/** @internal 只給單元測試直接載入（knip 看不到 vite.ssrLoadModule），不是給其他模組用的匯出。 */
export function createWaterSurfaceMaterial(options: WaterSurfaceOptions): THREE.ShaderMaterial {
  const basin = assertPoolBasinShape(options.basin);
  const laneLineZ = Array.from(
    { length: MAXIMUM_LANE_LINES },
    (_, index) => basin.laneLineZ[index] ?? UNUSED_LANE_LINE,
  );
  const boxes = basin.submergedBoxes ?? [];
  const metalColor = options.metalColor ?? new THREE.Color(0.45, 0.48, 0.49);
  const boxSlot = <Value>(create: (box: SubmergedBox | undefined) => Value) =>
    Array.from({ length: MAXIMUM_SUBMERGED_BOXES }, (_, index) => create(boxes[index]));
  const material = new THREE.ShaderMaterial({
    name: 'realistic:water-surface',
    vertexShader,
    fragmentShader: withPoolBasin(fragmentSource),
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
        uProbePosition: { value: new THREE.Vector3() },
        uHallMin: { value: new THREE.Vector3() },
        uHallMax: { value: new THREE.Vector3() },
        uHallRoof: { value: new THREE.Vector2() },
        uHallParallax: { value: 0 },
        uPlanarReflection: { value: null },
        uPlanarMatrix: { value: new THREE.Matrix4() },
        uPlanarStrength: { value: 0 },
        uPlanarReach: { value: new THREE.Vector2(PLANAR_REACH.roof, PLANAR_REACH.wall) },
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
        uLaneLineWidth: { value: basin.laneLineWidth },
        uLaneLineInset: { value: basin.laneLineInset },
        uLaneLineZ: { value: laneLineZ },
        uSubmergedBoxCount: { value: boxes.length },
        uSubmergedBoxMin: {
          value: boxSlot((box) =>
            box ? new THREE.Vector3(box.minX, box.minY, box.minZ) : new THREE.Vector3(),
          ),
        },
        uSubmergedBoxMax: {
          value: boxSlot((box) =>
            box ? new THREE.Vector3(box.maxX, box.maxY, box.maxZ) : new THREE.Vector3(),
          ),
        },
        uSubmergedBoxFinish: {
          value: boxSlot((box) =>
            box?.finish === 'tile'
              ? new THREE.Vector4(0, 0, 0, 1)
              : new THREE.Vector4(metalColor.r, metalColor.g, metalColor.b, 0),
          ),
        },
        // 清水對紅光吸收最強，所以深處偏藍綠。單位：每公尺。
        uAbsorption: { value: new THREE.Vector3(0.38, 0.07, 0.045) },
        uScatterColor: { value: new THREE.Color(...WATER_SCATTER_AT_NOON) },
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uSkyColor: { value: new THREE.Color(1, 1, 1) },
        uSunShadowMap: { value: null },
        uSunShadowMatrix: { value: new THREE.Matrix4() },
        uSunShadow: { value: new THREE.Vector3(0, 0, 0) },
      },
    ]),
  });
  // 鏡牆反射光：池體那一段宣告了這組 uniform，開關（color.w）預設關著。
  Object.assign(material.uniforms, createMirrorBounceUniforms());
  // 池館燈具：池體那一段宣告了這組 uniform，燈數預設為 0。
  Object.assign(material.uniforms, createWaterLightUniforms());
  // merge 會複製貼圖物件；貼圖要用原本那一份，所以合併後再指定。
  material.uniforms.uRippleNormal.value = options.rippleNormal;
  material.uniforms.uReflectionCube.value = options.reflectionCube;
  material.uniforms.uCaustics.value = options.caustics;
  if (options.laneLineColor) {
    (material.uniforms.uLaneLineColor.value as THREE.Color).copy(options.laneLineColor);
  }
  if (options.hall) {
    const hall = assertPoolHallShape(options.hall, basin);
    (material.uniforms.uHallMin.value as THREE.Vector3).set(hall.minX, hall.floor, hall.minZ);
    (material.uniforms.uHallMax.value as THREE.Vector3).set(hall.maxX, hall.roofAtMaxX, hall.maxZ);
    (material.uniforms.uHallRoof.value as THREE.Vector2).set(
      hall.roofAtMinX,
      (hall.roofAtMaxX - hall.roofAtMinX) / (hall.maxX - hall.minX),
    );
    material.uniforms.uHallParallax.value = 1;
  }
  return material;
}

export const WATER_SURFACE_NAME = 'POOL-01-WATER-SURFACE';

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  /** 長波的振幅總和（公尺）：水面最高可能比靜水面高這麼多。 */
  readonly maximumWaveHeight: number;
  private readonly basin: PoolBasinShape;
  private readonly adopted: {
    readonly geometry: THREE.BufferGeometry;
    readonly material: THREE.Material | THREE.Material[];
  } | null;
  private geometry: THREE.BufferGeometry;
  private cellSize: number;
  private readonly inverseWorld = new THREE.Matrix4();
  private readonly localSun = new THREE.Vector3();
  private readonly fallbackShadowMap = createFallbackShadowMap();
  /** 鏡牆反射光的 uniform（水面網格的物件座標）；池體材質與水下畫面共用同一組物件。 */
  private readonly mirrorBounce: MirrorBounceUniforms;
  /** 池館燈具的 uniform（水面網格的物件座標），同樣共用。 */
  private readonly waterLights: WaterLightUniforms;
  private disposed = false;

  /**
   * @param target 場景裡既有的水面網格。有給時直接換掉它的幾何與材質（名稱、圖層、
   *   點選資料都留在原物件上），`dispose()` 會換回去；沒給時自己建一個網格。
   */
  constructor(options: WaterSurfaceOptions, target?: THREE.Mesh) {
    for (const texture of [options.rippleNormal, options.caustics]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
    }
    this.basin = assertPoolBasinShape(options.basin);
    this.cellSize = options.cellSize;
    this.geometry = createWaterSurfaceGeometry(this.basin, options.cellSize);
    this.material = createWaterSurfaceMaterial(options);
    this.material.uniforms.uSunShadowMap.value = this.fallbackShadowMap;
    this.mirrorBounce = pickMirrorBounceUniforms(this.material.uniforms);
    this.waterLights = pickWaterLightUniforms(this.material.uniforms);
    this.maximumWaveHeight = (options.waves ?? CALM_POOL_WAVES).reduce(
      (sum, wave) => sum + wave.amplitude,
      0,
    );
    if (target) {
      this.adopted = { geometry: target.geometry, material: target.material };
      target.geometry = this.geometry;
      target.material = this.material;
      this.mesh = target;
    } else {
      this.adopted = null;
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.name = WATER_SURFACE_NAME;
      this.mesh.userData.visualOnly = true;
      this.mesh.userData.collisionExcluded = true;
    }
    this.mesh.userData.waterSurfaceElevation = this.basin.waterLevel;
  }

  /** 換水面網格的格距（畫質改變時）。只換幾何，材質與著色器不動。 */
  setCellSize(cellSize: number): void {
    if (this.disposed || cellSize === this.cellSize) return;
    const next = createWaterSurfaceGeometry(this.basin, cellSize);
    this.mesh.geometry = next;
    this.geometry.dispose();
    this.geometry = next;
    this.cellSize = cellSize;
  }

  setReflectionCube(texture: THREE.CubeTexture): void {
    this.material.uniforms.uReflectionCube.value = texture;
  }

  /** 探針拍攝的位置（物件座標）；視差修正要知道倒影是從哪裡拍的。 */
  setProbePosition(position: THREE.Vector3): void {
    (this.material.uniforms.uProbePosition.value as THREE.Vector3).copy(position);
  }

  /**
   * 指定平面倒影。`texture` 給 null 代表沒有（只用探針）；`matrix` 是由倒影那一方持續更新的同一個物件。
   */
  setPlanarReflection(texture: THREE.Texture | null, matrix?: THREE.Matrix4): void {
    const { uniforms } = this.material;
    uniforms.uPlanarReflection.value = texture;
    if (matrix) uniforms.uPlanarMatrix.value = matrix;
    if (!texture) uniforms.uPlanarStrength.value = 0;
  }

  /** 這個畫面要不要用平面倒影（鏡頭在水面下或倒影還沒畫好時不用）。 */
  setPlanarReflectionVisible(visible: boolean): void {
    const { uniforms } = this.material;
    uniforms.uPlanarStrength.value = visible && uniforms.uPlanarReflection.value ? 1 : 0;
  }

  /** 每個畫面呼叫一次，只改 uniform。呼叫前場景的世界矩陣要已經更新。 */
  update(frame: WaterFrameState): void {
    if (this.disposed) return;
    const { uniforms } = this.material;
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

    const shadow = frame.sunShadow ?? null;
    if (shadow) {
      uniforms.uSunShadowMap.value = shadow.map;
      (uniforms.uSunShadowMatrix.value as THREE.Matrix4).multiplyMatrices(
        shadow.matrix,
        this.mesh.matrixWorld,
      );
      (uniforms.uSunShadow.value as THREE.Vector3).set(1, shadow.bias, shadow.radius);
    } else {
      uniforms.uSunShadowMap.value = this.fallbackShadowMap;
      (uniforms.uSunShadow.value as THREE.Vector3).set(0, 0, 0);
    }
    writeMirrorBounceUniforms(this.mirrorBounce, frame.mirrorBounce ?? null, this.inverseWorld);
    const fixtureLights = frame.fixtureLights ?? null;
    writeWaterLightUniforms(this.waterLights, fixtureLights, this.inverseWorld);
    const light =
      (luminanceOf(frame.skyColor) +
        (fixtureLights ? luminanceOf(fixtureLights.waterIrradiance) : 0)) /
      NOON_SKY_LUMINANCE;
    (uniforms.uScatterColor.value as THREE.Color).setRGB(
      WATER_SCATTER_AT_NOON[0] * light,
      WATER_SCATTER_AT_NOON[1] * light,
      WATER_SCATTER_AT_NOON[2] * light,
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.adopted) {
      this.mesh.geometry = this.adopted.geometry;
      this.mesh.material = this.adopted.material;
    }
    this.fallbackShadowMap.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
