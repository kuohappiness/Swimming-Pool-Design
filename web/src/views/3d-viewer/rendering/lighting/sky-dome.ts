import * as THREE from 'three';
import { createCloudNoise } from './cloud-noise';
import type { SceneLighting } from './scene-lighting';
import fragmentShader from './shaders/sky-dome.frag.glsl?raw';
import vertexShader from './shaders/sky-dome.vert.glsl?raw';
import { deriveSkyParameters } from './sky-parameters';

/** 天空球的半徑：只要比鏡頭可能離原點的距離大就好，著色器不看它（天空在無限遠）。 */
const DOME_RADIUS = 190;

type Uniforms = Record<string, THREE.IUniform>;

function createUniforms(noise: THREE.Texture): Uniforms {
  return {
    uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDirection: { value: new THREE.Vector3(0, 1, 0) },
    uTurbidity: { value: 4 },
    uRayleigh: { value: 1.7 },
    uMieCoefficient: { value: 0.005 },
    uMieDirectionalG: { value: 0.8 },
    uAtmosphereScale: { value: 1 },
    uSunDiscColor: { value: new THREE.Vector3() },
    uNightColor: { value: new THREE.Vector3() },
    uTwilightColor: { value: new THREE.Vector3() },
    uStars: { value: 0 },
    uMoonColor: { value: new THREE.Vector3() },
    uCloudCover: { value: 0 },
    uCloudLit: { value: new THREE.Vector3(1, 1, 1) },
    uCloudShade: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    uCloudOffset: { value: new THREE.Vector2() },
    uCloudDetail: { value: 1 },
    uNoise: { value: noise },
    uGroundColor: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
  };
}

/**
 * 天空球：一個永遠畫在最遠處的球，顏色由太陽位置、時刻與天氣算出來。
 *
 * 另外準備一個只有天空的小場景（`environmentScene`），用來產生倒影與間接光的環境貼圖。
 * 那一份不畫日面、月面與星星：直射的陽光已經由主光源負責，環境貼圖裡再放一個極亮的點，
 * 光滑表面會出現兩個太陽。兩份共用其餘所有數值。
 */
export class SkyDome {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly environmentScene: THREE.Scene;
  private readonly geometry: THREE.SphereGeometry;
  private readonly noise: THREE.DataTexture;
  private readonly uniforms: Uniforms;
  private disposed = false;

  constructor() {
    const noise = createCloudNoise();
    this.noise = new THREE.DataTexture(noise.data, noise.size, noise.size, THREE.RedFormat, THREE.UnsignedByteType);
    this.noise.name = 'sky:cloud-noise';
    this.noise.wrapS = THREE.RepeatWrapping;
    this.noise.wrapT = THREE.RepeatWrapping;
    this.noise.minFilter = THREE.LinearMipmapLinearFilter;
    this.noise.magFilter = THREE.LinearFilter;
    this.noise.generateMipmaps = true;
    this.noise.needsUpdate = true;

    this.uniforms = createUniforms(this.noise);
    this.geometry = new THREE.SphereGeometry(DOME_RADIUS, 32, 16);
    const material = this.createMaterial(this.uniforms);
    material.name = 'sky:dome';
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.name = 'SKY-DOME';
    this.configure(this.mesh);
    // 排在所有不透明物件之後才畫：被建築擋住的像素直接略過。
    this.mesh.renderOrder = 1000;

    const environmentMaterial = this.createMaterial({
      ...this.uniforms,
      uSunDiscColor: { value: new THREE.Vector3() },
      uMoonColor: { value: new THREE.Vector3() },
      uStars: { value: 0 },
    });
    environmentMaterial.name = 'sky:environment-source';
    const environmentMesh = new THREE.Mesh(this.geometry, environmentMaterial);
    this.configure(environmentMesh);
    this.environmentScene = new THREE.Scene();
    this.environmentScene.name = 'SKY-ENVIRONMENT-SOURCE';
    this.environmentScene.add(environmentMesh);
  }

  private createMaterial(uniforms: Uniforms) {
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
  }

  private configure(mesh: THREE.Mesh) {
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.userData.visualOnly = true;
    mesh.userData.collisionExcluded = true;
  }

  /** 雲的細節層數：省電級只疊兩層雜訊。 */
  setCloudDetail(detailed: boolean) {
    this.uniform('uCloudDetail').value = detailed ? 1 : 0;
  }

  update(lighting: SceneLighting) {
    if (this.disposed) return;
    const sky = deriveSkyParameters(lighting.source);
    (this.uniform('uSunDirection').value as THREE.Vector3).copy(lighting.sunDirection);
    (this.uniform('uMoonDirection').value as THREE.Vector3).copy(lighting.moonDirection);
    this.uniform('uTurbidity').value = sky.turbidity;
    this.uniform('uRayleigh').value = sky.rayleigh;
    this.uniform('uMieCoefficient').value = sky.mieCoefficient;
    this.uniform('uMieDirectionalG').value = sky.mieDirectionalG;
    this.uniform('uAtmosphereScale').value = sky.atmosphereScale;
    (this.uniform('uSunDiscColor').value as THREE.Vector3).fromArray(sky.sunDiscColor);
    (this.uniform('uNightColor').value as THREE.Vector3).fromArray(sky.nightColor);
    (this.uniform('uTwilightColor').value as THREE.Vector3).fromArray(sky.twilightColor);
    this.uniform('uStars').value = sky.stars;
    (this.uniform('uMoonColor').value as THREE.Vector3).fromArray(sky.moonColor);
    this.uniform('uCloudCover').value = sky.cloudCover;
    (this.uniform('uCloudLit').value as THREE.Vector3).fromArray(sky.cloudLit);
    (this.uniform('uCloudShade').value as THREE.Vector3).fromArray(sky.cloudShade);
    (this.uniform('uCloudOffset').value as THREE.Vector2).fromArray(sky.cloudOffset);
    (this.uniform('uGroundColor').value as THREE.Vector3).fromArray(sky.groundColor);
  }

  private uniform(name: string): THREE.IUniform {
    const uniform = this.uniforms[name];
    if (!uniform) throw new TypeError(`Sky uniform is missing: ${name}`);
    return uniform;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.material.dispose();
    for (const child of this.environmentScene.children) {
      if (child instanceof THREE.Mesh) (child.material as THREE.Material).dispose();
    }
    this.environmentScene.clear();
    this.geometry.dispose();
    this.noise.dispose();
  }
}
