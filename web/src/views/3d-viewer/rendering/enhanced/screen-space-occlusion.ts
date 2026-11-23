import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { generateMagicSquareNoise, GTAOShader } from 'three/addons/shaders/GTAOShader.js';
import {
  generatePdSamplePointInitializer,
  PoissonDenoiseShader,
} from 'three/addons/shaders/PoissonDenoiseShader.js';

/**
 * 螢幕空間的遮蔽（TASK-152 步驟 6），由畫面深度算兩樣東西，存在同一張貼圖：
 *
 * - r：環境遮蔽。three.js 內附的 GTAO 著色器，法線由深度還原，不另畫一次場景。three.js 的
 *   `GTAOPass` 在給定深度貼圖時會讀不存在的法線繪製目標而出錯，所以這裡直接用它的著色器。
 * - g：接觸陰影。從每一點朝太陽走一小段，途中有沒有被畫面上更靠近鏡頭的面擋住。陰影貼圖的
 *   一格有好幾公分，物件貼地處那一圈很短的影子要靠這裡補。
 *
 * 兩者都在半解析度算。環境遮蔽的取樣點很少，要再用泊松降噪抹平；接觸陰影沿光線走的取樣點逐像素
 * 錯開，本身已經平滑，降噪的隨機取樣反而會讓它邊緣起雜點，所以只降噪 r。套到畫面上的方式見
 * `frame-grade.ts`。
 */
export const AMBIENT_OCCLUSION = Object.freeze({
  /** 相對於畫面的解析度。 */
  resolutionScale: 0.5,
  /** 找遮蔽物的半徑（公尺）：牆角、柱腳、池畔設備與樓板下緣的尺度。 */
  radius: 0.9,
  distanceExponent: 1.5,
  thickness: 1,
  distanceFallOff: 1,
  scale: 1,
  samples: 16,
  denoise: Object.freeze({
    lumaPhi: 10,
    depthPhi: 2,
    normalPhi: 3,
    radius: 6,
    radiusExponent: 1,
    rings: 2,
    samples: 16,
  }),
});

export const CONTACT_SHADOWS = Object.freeze({
  steps: 16,
  /** 朝太陽找多遠（公尺）：人、池梯、出發台、長椅貼地處的影子長度。 */
  lengthMetres: 0.35,
  /** 擋住取樣點的東西最厚算多少（公尺）；比這更厚的是遠處的面從前面經過，不算遮擋。 */
  thicknessMetres: 0.25,
  /** 從這個距離（公尺）開始淡出，兩倍距離完全不算：太遠時一小段在畫面上不到幾個像素。 */
  fadeStartMetres: 20,
});

/** 接在 GTAO 著色器的 main 之前：用它的深度與位置函式。 */
const CONTACT_SHADOW_GLSL = /* glsl */ `
uniform vec3 uTowardSun;  // 鏡頭座標，朝太陽（或月亮）的單位向量
uniform vec3 uContact;    // x：找多遠；y：擋住的東西算多厚；z：開始淡出的距離

float contactVisibility(vec3 position, vec3 normal) {
  float fade = 1.0 - smoothstep(uContact.z, uContact.z * 2.0, -position.z);
  if (fade <= 0.0 || dot(normal, uTowardSun) <= 0.0) return 1.0;
  // 逐像素錯開取樣點；固定的取樣點會在斜面上排成一階一階的條紋。
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 start = position + normal * (0.01 + 0.002 * -position.z);
  for (int index = 0; index < CONTACT_STEPS; index++) {
    float along = (float(index) + jitter) / float(CONTACT_STEPS);
    vec3 probe = start + uTowardSun * (along * uContact.x);
    vec3 scene = getSceneUvAndDepth(probe);
    if (any(lessThan(scene.xy, vec2(0.0))) || any(greaterThan(scene.xy, vec2(1.0)))) break;
    if (scene.z >= 1.0) continue;
    // 正值：畫面上這個位置的面比取樣點更靠近鏡頭，取樣點被它擋住。
    float inFront = getViewPosition(scene.xy, scene.z).z - probe.z;
    float bias = 0.015 + 0.0015 * -probe.z;
    if (inFront > bias && inFront < uContact.y) return mix(1.0, along * along, fade);
  }
  return 1.0;
}
`;

const MAIN = 'void main() {';

function occlusionFragmentShader(): string {
  const source = GTAOShader.fragmentShader;
  if (!source.includes(MAIN) || !source.includes('getSceneUvAndDepth')) {
    throw new TypeError(
      'The three.js GTAO shader no longer has the functions the contact shadows use.',
    );
  }
  return source.replace(MAIN, `${CONTACT_SHADOW_GLSL}\n${MAIN}`);
}

function createDenoiseNoise(size = 64): THREE.DataTexture {
  const simplex = new SimplexNoise();
  const data = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const offset = (row * size + column) * 4;
      data[offset] = (simplex.noise(row, column) * 0.5 + 0.5) * 255;
      data[offset + 1] = (simplex.noise(row + size, column) * 0.5 + 0.5) * 255;
      data[offset + 2] = (simplex.noise(row, column + size) * 0.5 + 0.5) * 255;
      data[offset + 3] = (simplex.noise(row + size, column + size) * 0.5 + 0.5) * 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export class ScreenSpaceOcclusion {
  private readonly occlusionTarget: THREE.WebGLRenderTarget;
  private readonly denoisedTarget: THREE.WebGLRenderTarget;
  private readonly occlusionMaterial: THREE.ShaderMaterial;
  private readonly denoiseMaterial: THREE.ShaderMaterial;
  private readonly occlusionNoise = generateMagicSquareNoise();
  private readonly denoiseNoise = createDenoiseNoise();
  private readonly quad = new FullScreenQuad();
  private readonly clearColor = new THREE.Color();
  private disposed = false;

  constructor() {
    this.occlusionTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    this.occlusionTarget.texture.name = 'realistic:screen-space-occlusion';
    this.denoisedTarget = this.occlusionTarget.clone();
    this.denoisedTarget.texture.name = 'realistic:screen-space-occlusion-denoised';

    this.occlusionMaterial = new THREE.ShaderMaterial({
      name: 'realistic:screen-space-occlusion',
      defines: {
        ...GTAOShader.defines,
        // 法線由深度還原（NORMAL_VECTOR_TYPE 0），深度取 r。
        NORMAL_VECTOR_TYPE: 0,
        DEPTH_SWIZZLING: 'x',
        SAMPLES: AMBIENT_OCCLUSION.samples,
        CONTACT_STEPS: CONTACT_SHADOWS.steps,
        FRAGMENT_OUTPUT: 'vec4(ao, contactVisibility(viewPos, viewNormal), 0.0, 1.0)',
      },
      uniforms: {
        ...THREE.UniformsUtils.clone(GTAOShader.uniforms),
        uTowardSun: { value: new THREE.Vector3(0, 1, 0) },
        uContact: {
          value: new THREE.Vector3(
            CONTACT_SHADOWS.lengthMetres,
            CONTACT_SHADOWS.thicknessMetres,
            CONTACT_SHADOWS.fadeStartMetres,
          ),
        },
      },
      vertexShader: GTAOShader.vertexShader,
      fragmentShader: occlusionFragmentShader(),
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    const occlusion = this.occlusionMaterial.uniforms;
    occlusion.tNoise.value = this.occlusionNoise;
    occlusion.radius.value = AMBIENT_OCCLUSION.radius;
    occlusion.distanceExponent.value = AMBIENT_OCCLUSION.distanceExponent;
    occlusion.thickness.value = AMBIENT_OCCLUSION.thickness;
    occlusion.distanceFallOff.value = AMBIENT_OCCLUSION.distanceFallOff;
    occlusion.scale.value = AMBIENT_OCCLUSION.scale;

    const { denoise } = AMBIENT_OCCLUSION;
    this.denoiseMaterial = new THREE.ShaderMaterial({
      name: 'realistic:screen-space-occlusion-denoise',
      defines: {
        ...PoissonDenoiseShader.defines,
        NORMAL_VECTOR_TYPE: 0,
        DEPTH_VALUE_SOURCE: 0,
        SAMPLES: denoise.samples,
        SAMPLE_VECTORS: generatePdSamplePointInitializer(
          denoise.samples,
          denoise.rings,
          denoise.radiusExponent,
        ),
        // 只降噪環境遮蔽（r），接觸陰影（g）照原樣保留。
        SAMPLE_LUMINANCE: 'a.r',
        FRAGMENT_OUTPUT: 'vec4(denoised.r, texel.g, 0.0, 1.0)',
      },
      uniforms: THREE.UniformsUtils.clone(PoissonDenoiseShader.uniforms),
      vertexShader: PoissonDenoiseShader.vertexShader,
      fragmentShader: PoissonDenoiseShader.fragmentShader,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    const smoothing = this.denoiseMaterial.uniforms;
    smoothing.tDiffuse.value = this.occlusionTarget.texture;
    smoothing.tNoise.value = this.denoiseNoise;
    smoothing.lumaPhi.value = denoise.lumaPhi;
    smoothing.depthPhi.value = denoise.depthPhi;
    smoothing.normalPhi.value = denoise.normalPhi;
    smoothing.radius.value = denoise.radius;
  }

  /** 畫面的繪製解析度（實際像素）。遮蔽用其中一半。 */
  setSize(width: number, height: number): void {
    const scaledWidth = Math.max(1, Math.round(width * AMBIENT_OCCLUSION.resolutionScale));
    const scaledHeight = Math.max(1, Math.round(height * AMBIENT_OCCLUSION.resolutionScale));
    this.occlusionTarget.setSize(scaledWidth, scaledHeight);
    this.denoisedTarget.setSize(scaledWidth, scaledHeight);
    this.occlusionMaterial.uniforms.resolution.value.set(scaledWidth, scaledHeight);
    this.denoiseMaterial.uniforms.resolution.value.set(scaledWidth, scaledHeight);
  }

  /**
   * 算出遮蔽，回傳最後的貼圖：r 是降噪後的環境遮蔽、g 是接觸陰影，1 代表沒有遮擋。
   * @param towardSun 鏡頭座標，朝主光源的單位向量。
   */
  render(
    renderer: THREE.WebGLRenderer,
    depth: THREE.DepthTexture,
    camera: THREE.Camera,
    towardSun: THREE.Vector3,
  ): THREE.Texture {
    const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true ? 1 : 0;
    if (this.occlusionMaterial.defines.PERSPECTIVE_CAMERA !== perspective) {
      this.occlusionMaterial.defines.PERSPECTIVE_CAMERA = perspective;
      this.occlusionMaterial.needsUpdate = true;
    }
    const projection = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const occlusion = this.occlusionMaterial.uniforms;
    occlusion.tDepth.value = depth;
    occlusion.cameraNear.value = projection.near;
    occlusion.cameraFar.value = projection.far;
    occlusion.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
    occlusion.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
    occlusion.cameraWorldMatrix.value.copy(camera.matrixWorld);
    (occlusion.uTowardSun.value as THREE.Vector3).copy(towardSun);
    const smoothing = this.denoiseMaterial.uniforms;
    smoothing.tDepth.value = depth;
    smoothing.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);

    // 兩支著色器在天空（深度 1）都不畫，先清成白色：沒有遮擋。
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0xffffff, 1);
    renderer.setRenderTarget(this.occlusionTarget);
    renderer.clear(true, false, false);
    this.quad.material = this.occlusionMaterial;
    this.quad.render(renderer);
    renderer.setRenderTarget(this.denoisedTarget);
    renderer.clear(true, false, false);
    this.quad.material = this.denoiseMaterial;
    this.quad.render(renderer);
    renderer.setClearColor(this.clearColor, clearAlpha);
    return this.denoisedTarget.texture;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.occlusionTarget.dispose();
    this.denoisedTarget.dispose();
    this.occlusionMaterial.dispose();
    this.denoiseMaterial.dispose();
    this.occlusionNoise.dispose();
    this.denoiseNoise.dispose();
    this.quad.dispose();
  }
}
