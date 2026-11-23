import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { readSceneFixtureLights } from '../lighting/fixture-lights';
import { EXPOSURE_ADAPTATION } from './exposure-adaptation';
import gradeFragment from './shaders/frame-grade.frag.glsl?raw';
import fullscreenVertex from './shaders/fullscreen.vert.glsl?raw';

/** 查太陽陰影貼圖時的偏移（公尺）與取樣半徑（格）。 */
const SHADOW_LOOKUP = Object.freeze({ biasMetres: 0.06, radiusTexels: 1.5 });

const LUMINANCE = new THREE.Vector3(0.2126, 0.7152, 0.0722);

function luminance(color: THREE.Color): number {
  return color.r * LUMINANCE.x + color.g * LUMINANCE.y + color.b * LUMINANCE.z;
}

function createFallbackShadowMap(): THREE.DepthTexture {
  const texture = new THREE.DepthTexture(1, 1);
  texture.name = 'realistic:frame-grade-shadow-fallback';
  texture.compareFunction = THREE.LessEqualCompare;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // 不掛在繪製目標上的深度貼圖要自己標記，three.js 才會把它建出來。
  texture.needsUpdate = true;
  return texture;
}

export interface FrameGradeInputs {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly color: THREE.Texture;
  readonly depth: THREE.DepthTexture | null;
  /** 環境遮蔽；沒開時為 null。 */
  readonly occlusion: THREE.Texture | null;
  /** 曝光適應的 1×1 貼圖；沒開時為 null。 */
  readonly adaptation: THREE.Texture | null;
  /** 這一刻的基準曝光。 */
  readonly exposure: number;
  /** 畫面的繪製解析度（實際像素）。 */
  readonly width: number;
  readonly height: number;
}

export interface FrameGradeOptions {
  /** 環境遮蔽與接觸陰影。 */
  readonly occlusion: boolean;
  readonly adaptation: boolean;
}

/**
 * 畫面還是線性時的最後整理：環境遮蔽只擋間接光、接觸陰影只擋陽光，再乘上曝光。
 * 太陽、天光與燈具的強度從場景讀（和水的著色器用同一份）。
 */
export class FrameGrade {
  private readonly material: THREE.ShaderMaterial;
  private readonly quad = new FullScreenQuad();
  private readonly fallbackShadowMap = createFallbackShadowMap();
  private readonly whiteTexture: THREE.DataTexture;
  private scene: THREE.Scene | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private ambient: THREE.HemisphereLight | null = null;
  private readonly sunPosition = new THREE.Vector3();
  private readonly sunTarget = new THREE.Vector3();
  private readonly skyColor = new THREE.Color();
  private readonly towardSunWorld = new THREE.Vector3();
  private lightLevel = 0;
  private disposed = false;

  constructor(options: FrameGradeOptions) {
    this.whiteTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.whiteTexture.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      name: 'realistic:frame-grade',
      vertexShader: fullscreenVertex,
      fragmentShader: gradeFragment,
      defines: {
        SCREEN_SPACE_OCCLUSION: options.occlusion ? 1 : 0,
        EXPOSURE_ADAPTATION: options.adaptation ? 1 : 0,
      },
      uniforms: {
        tScene: { value: null },
        tDepth: { value: null },
        tOcclusion: { value: this.whiteTexture },
        tAdaptation: { value: this.whiteTexture },
        uSunShadowMap: { value: this.fallbackShadowMap },
        uSunShadowMatrix: { value: new THREE.Matrix4() },
        uSunShadow: { value: new THREE.Vector3() },
        uProjection: { value: new THREE.Matrix4() },
        uProjectionInverse: { value: new THREE.Matrix4() },
        uCameraWorld: { value: new THREE.Matrix4() },
        uTowardSun: { value: new THREE.Vector3(0, 1, 0) },
        uSunIrradiance: { value: 0 },
        uSkyIrradiance: { value: 0 },
        uFixtureIrradiance: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uExposure: { value: 1 },
        uAdaptation: {
          value: new THREE.Vector3(
            EXPOSURE_ADAPTATION.targetLog2,
            EXPOSURE_ADAPTATION.strength,
            EXPOSURE_ADAPTATION.rangeStops,
          ),
        },
        uLightLevelLog2: { value: 0 },
      },
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
  }

  setOptions(options: FrameGradeOptions): void {
    const defines = this.material.defines;
    const occlusion = options.occlusion ? 1 : 0;
    const adaptation = options.adaptation ? 1 : 0;
    if (defines.SCREEN_SPACE_OCCLUSION === occlusion && defines.EXPOSURE_ADAPTATION === adaptation) return;
    defines.SCREEN_SPACE_OCCLUSION = occlusion;
    defines.EXPOSURE_ADAPTATION = adaptation;
    this.material.needsUpdate = true;
  }

  render(renderer: THREE.WebGLRenderer, inputs: FrameGradeInputs, target: THREE.WebGLRenderTarget): void {
    if (this.disposed) return;
    const uniforms = this.material.uniforms;
    uniforms.tScene.value = inputs.color;
    uniforms.tDepth.value = inputs.depth;
    uniforms.tOcclusion.value = inputs.occlusion ?? this.whiteTexture;
    uniforms.tAdaptation.value = inputs.adaptation ?? this.whiteTexture;
    uniforms.uExposure.value = inputs.exposure;
    uniforms.uResolution.value.set(inputs.width, inputs.height);

    renderer.setRenderTarget(target);
    this.quad.material = this.material;
    this.quad.render(renderer);
  }

  /** 鏡頭座標，朝主光源（太陽或月亮）的單位向量；`prepare` 之後有效。 */
  get towardSun(): THREE.Vector3 {
    return this.material.uniforms.uTowardSun.value as THREE.Vector3;
  }

  /**
   * 這一刻水平面上的照度（場景單位）：天光、主光源的垂直分量與燈具，三者相加。曝光適應拿畫面
   * 平均亮度和它比，雨天與夜裡畫面整體比較暗是光線本來就弱，不會被當成要補的差距。
   */
  get horizontalIlluminance(): number {
    return this.lightLevel;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.material.dispose();
    this.quad.dispose();
    this.fallbackShadowMap.dispose();
    this.whiteTexture.dispose();
  }

  /** 每一格先呼叫：讀場景的太陽、天光與燈具，算鏡頭座標的光線方向（遮蔽也要用）。 */
  prepare(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.scene !== scene) {
      this.scene = scene;
      this.sun = null;
      this.ambient = null;
      scene.traverse((object) => {
        if (!this.sun && (object as THREE.DirectionalLight).isDirectionalLight) this.sun = object as THREE.DirectionalLight;
        if (!this.ambient && (object as THREE.HemisphereLight).isHemisphereLight) this.ambient = object as THREE.HemisphereLight;
      });
    }
    const uniforms = this.material.uniforms;
    (uniforms.uProjection.value as THREE.Matrix4).copy(camera.projectionMatrix);
    (uniforms.uProjectionInverse.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
    (uniforms.uCameraWorld.value as THREE.Matrix4).copy(camera.matrixWorld);

    const sun = this.sun;
    const towardSun = uniforms.uTowardSun.value as THREE.Vector3;
    if (sun?.visible) {
      sun.getWorldPosition(this.sunPosition);
      sun.target.getWorldPosition(this.sunTarget);
      this.towardSunWorld.subVectors(this.sunPosition, this.sunTarget);
      if (this.towardSunWorld.lengthSq() > 0) this.towardSunWorld.normalize();
      else this.towardSunWorld.set(0, 1, 0);
      towardSun.copy(this.towardSunWorld).transformDirection(camera.matrixWorldInverse);
      uniforms.uSunIrradiance.value = luminance(sun.color) * sun.intensity;
    } else {
      this.towardSunWorld.set(0, 1, 0);
      towardSun.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
      uniforms.uSunIrradiance.value = 0;
    }

    const shadow = sun?.castShadow && sun.visible ? sun.shadow : null;
    const shadowMap = shadow?.map?.depthTexture ?? null;
    // 只認深度比較用的貼圖（PCF 陰影），和水的著色器一樣。
    if (shadow && shadowMap && shadowMap.compareFunction !== null) {
      uniforms.uSunShadowMap.value = shadowMap;
      (uniforms.uSunShadowMatrix.value as THREE.Matrix4).copy(shadow.matrix);
      (uniforms.uSunShadow.value as THREE.Vector3).set(
        1,
        SHADOW_LOOKUP.biasMetres / Math.max(shadow.camera.far - shadow.camera.near, 1e-3),
        SHADOW_LOOKUP.radiusTexels / Math.max(shadow.mapSize.x, 1),
      );
    } else {
      uniforms.uSunShadowMap.value = this.fallbackShadowMap;
      (uniforms.uSunShadow.value as THREE.Vector3).set(0, 0, 0);
    }

    const ambient = this.ambient;
    if (ambient?.visible) {
      // 整片天空的照度（半球光只是其中一部分，其餘在環境貼圖裡），和水的著色器相同。
      const skyIrradiance = ambient.userData.skyIrradiance;
      this.skyColor.copy(ambient.color).multiplyScalar(
        typeof skyIrradiance === 'number' ? skyIrradiance : ambient.intensity,
      );
      uniforms.uSkyIrradiance.value = luminance(this.skyColor);
    } else {
      uniforms.uSkyIrradiance.value = 0;
    }
    // 燈具：池廳地面的平均照度（給水用的那一份已乘入水穿透率 0.97，差距可以忽略）。
    const fixtures = readSceneFixtureLights(scene);
    uniforms.uFixtureIrradiance.value = fixtures ? luminance(fixtures.ceilingIrradiance) : 0;

    this.lightLevel = uniforms.uSkyIrradiance.value
      + uniforms.uSunIrradiance.value * Math.max(0, this.towardSunWorld.y)
      + uniforms.uFixtureIrradiance.value;
    uniforms.uLightLevelLog2.value = Math.log2(Math.max(this.lightLevel, 1e-6));
  }
}
