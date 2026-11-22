import * as THREE from 'three';
import { markReflectionCapture } from '../lighting/reflection-capture';

/**
 * 反射探針：站在一個定點把四周拍成六面貼圖，水面查它來得到倒影。
 * 場景是靜態的，所以只在光線或可見物件改變時重拍，不是每個畫面都拍。
 */
export interface ReflectionProbe {
  readonly texture: THREE.CubeTexture;
  /** 改貼圖邊長；回傳 true 代表貼圖物件換了，使用者要重新取 `texture` 並重拍。 */
  setSize(size: number): boolean;
  /** 從 worldPosition 拍一次。hidden 裡的物件拍的時候暫時隱藏（例如水面自己）。 */
  capture(scene: THREE.Scene, worldPosition: THREE.Vector3, hidden: readonly THREE.Object3D[]): void;
  dispose(): void;
}

export class CubeReflectionProbe implements ReflectionProbe {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly textureType: THREE.TextureDataType;
  private target: THREE.WebGLCubeRenderTarget;
  private camera: THREE.CubeCamera;
  private size: number;
  private readonly name: string;
  private disposed = false;

  /** @param name 貼圖名稱（除錯與記憶體統計用）。 */
  constructor(renderer: THREE.WebGLRenderer, size: number, name = 'realistic:water-reflection-probe') {
    this.renderer = renderer;
    this.name = name;
    // 半精度浮點才存得下比白色更亮的天窗與燈具；不支援的裝置退回 8 位元，亮部會被截掉但仍可用。
    this.textureType = renderer.extensions.has('EXT_color_buffer_float')
      || renderer.extensions.has('EXT_color_buffer_half_float')
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType;
    this.size = size;
    this.target = this.createTarget(size);
    this.camera = this.createCamera(this.target);
  }

  get texture(): THREE.CubeTexture {
    return this.target.texture;
  }

  setSize(size: number): boolean {
    if (this.disposed || size === this.size) return false;
    this.target.dispose();
    this.size = size;
    this.target = this.createTarget(size);
    this.camera = this.createCamera(this.target);
    return true;
  }

  capture(scene: THREE.Scene, worldPosition: THREE.Vector3, hidden: readonly THREE.Object3D[]): void {
    if (this.disposed) return;
    const visibility = hidden.map((object) => object.visible);
    for (const object of hidden) object.visible = false;
    try {
      this.camera.position.copy(worldPosition);
      this.camera.update(this.renderer, scene);
    } finally {
      hidden.forEach((object, index) => {
        object.visible = visibility[index] ?? true;
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.target.dispose();
  }

  private createCamera(target: THREE.WebGLCubeRenderTarget): THREE.CubeCamera {
    const camera = new THREE.CubeCamera(0.1, 240, target);
    markReflectionCapture(camera);
    return camera;
  }

  private createTarget(size: number): THREE.WebGLCubeRenderTarget {
    const target = new THREE.WebGLCubeRenderTarget(size, {
      type: this.textureType,
      // 縮圖鏈讓波紋把倒影打散時取到較模糊的層，水面不會閃爍。
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    target.texture.name = this.name;
    return target;
  }
}
