import * as THREE from 'three';
import { markReflectionCapture } from '../lighting/reflection-capture';

/**
 * 平面倒影：把鏡頭對著水面翻到水面下方，從那裡把場景再畫一次到一張較小的貼圖，
 * 水面再依畫面位置去查它。和反射探針不同，它照出來的東西位置是對的（近處的池畔、牆、人
 * 不會偏掉），代價是場景多畫一次，所以只有高與極致級使用，而且：
 *
 * - 場景是靜態的，鏡頭沒動就不重畫；
 * - 鏡頭在水面下時不畫（水下往上看用的是探針）；
 * - 幀率吃緊時由調節器先把這張貼圖的解析度減半（DEC-190 的「水面倒影解析度」）。
 */
export interface PlanarReflection {
  readonly texture: THREE.Texture;
  /** 物件座標（水面網格）轉到倒影貼圖座標；除以 w 之後 xy 落在 0 到 1。 */
  readonly textureMatrix: THREE.Matrix4;
  /** 改貼圖大小（像素）。大小變了下一次一定重畫。 */
  setSize(width: number, height: number): void;
  /** 光線或可見物件改變後呼叫；下一次一定重畫。 */
  invalidate(): void;
  /**
   * 需要時重畫倒影。回傳 false 代表這個鏡頭位置沒有倒影可用（鏡頭在水面下），
   * 呼叫端應改用探針。
   */
  update(input: PlanarReflectionInput): boolean;
  dispose(): void;
}

export interface PlanarReflectionInput {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  /** 水面網格；倒影平面是它物件座標裡 y = waterLevel 的平面。 */
  readonly surface: THREE.Object3D;
  readonly waterLevel: number;
  /** 畫倒影時暫時隱藏的物件：水面自己，以及整個在水面下、反正會被裁掉的池體。 */
  readonly hidden: readonly THREE.Object3D[];
}

/** 鏡頭高於水面這麼多（公尺）才畫倒影；貼著水面時倒影鏡頭的視錐會退化。 */
const MINIMUM_CAMERA_HEIGHT = 0.01;

export class ScenePlanarReflection implements PlanarReflection {
  readonly textureMatrix = new THREE.Matrix4();

  private readonly target: THREE.WebGLRenderTarget;
  private readonly virtualCamera = new THREE.PerspectiveCamera();
  private readonly plane = new THREE.Plane();
  private readonly planePoint = new THREE.Vector3();
  private readonly planeNormal = new THREE.Vector3();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly mirroredPosition = new THREE.Vector3();
  private readonly lookAtPosition = new THREE.Vector3();
  private readonly mirroredTarget = new THREE.Vector3();
  private readonly rotation = new THREE.Matrix4();
  private readonly clipPlane = new THREE.Vector4();
  private readonly corner = new THREE.Vector4();
  private readonly offset = new THREE.Vector3();
  private readonly lastCameraWorld = new THREE.Matrix4();
  private readonly lastProjection = new THREE.Matrix4();
  private readonly lastSurfaceWorld = new THREE.Matrix4();
  private stale = true;
  private rendering = false;
  private disposed = false;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
      // 半精度浮點才存得下比白色更亮的天窗與燈具，倒影裡的亮點才不會被截成灰色。
      type:
        renderer.extensions.has('EXT_color_buffer_float') ||
        renderer.extensions.has('EXT_color_buffer_half_float')
          ? THREE.HalfFloatType
          : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    this.target.texture.name = 'realistic:water-planar-reflection';
    markReflectionCapture(this.virtualCamera);
  }

  get texture(): THREE.Texture {
    return this.target.texture;
  }

  setSize(width: number, height: number): void {
    if (this.disposed) return;
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (nextWidth === this.target.width && nextHeight === this.target.height) return;
    this.target.setSize(nextWidth, nextHeight);
    this.stale = true;
  }

  invalidate(): void {
    this.stale = true;
  }

  update(input: PlanarReflectionInput): boolean {
    // 畫倒影時場景裡的水面是隱藏的，但保險起見不允許巢狀呼叫。
    if (this.disposed || this.rendering) return false;
    const { renderer, scene, camera, surface } = input;

    this.planePoint.set(0, input.waterLevel, 0).applyMatrix4(surface.matrixWorld);
    this.normalMatrix.getNormalMatrix(surface.matrixWorld);
    this.planeNormal.set(0, 1, 0).applyMatrix3(this.normalMatrix).normalize();
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    const height = this.offset
      .subVectors(this.cameraPosition, this.planePoint)
      .dot(this.planeNormal);
    if (height < MINIMUM_CAMERA_HEIGHT) return false;

    const unchanged =
      !this.stale &&
      this.lastCameraWorld.equals(camera.matrixWorld) &&
      this.lastProjection.equals(camera.projectionMatrix) &&
      this.lastSurfaceWorld.equals(surface.matrixWorld);
    if (unchanged) return true;

    this.placeVirtualCamera(camera, surface);
    this.render(renderer, scene, input.hidden);
    this.lastCameraWorld.copy(camera.matrixWorld);
    this.lastProjection.copy(camera.projectionMatrix);
    this.lastSurfaceWorld.copy(surface.matrixWorld);
    this.stale = false;
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.target.dispose();
  }

  /** 把鏡頭的位置、視線與上方向都對水面做鏡射，並把近裁面換成水面，水面下的東西不會畫進倒影。 */
  private placeVirtualCamera(camera: THREE.Camera, surface: THREE.Object3D): void {
    const virtual = this.virtualCamera;
    const normal = this.planeNormal;

    this.mirroredPosition
      .subVectors(this.planePoint, this.cameraPosition)
      .reflect(normal)
      .negate()
      .add(this.planePoint);
    this.rotation.extractRotation(camera.matrixWorld);
    this.lookAtPosition.set(0, 0, -1).applyMatrix4(this.rotation).add(this.cameraPosition);
    this.mirroredTarget
      .subVectors(this.planePoint, this.lookAtPosition)
      .reflect(normal)
      .negate()
      .add(this.planePoint);

    virtual.position.copy(this.mirroredPosition);
    virtual.up.set(0, 1, 0).applyMatrix4(this.rotation).reflect(normal);
    virtual.lookAt(this.mirroredTarget);
    virtual.layers.mask = camera.layers.mask;
    if (camera instanceof THREE.PerspectiveCamera) {
      virtual.near = camera.near;
      virtual.far = camera.far;
    }
    virtual.updateMatrixWorld();
    virtual.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(virtual.projectionMatrix);
    this.textureMatrix.multiply(virtual.matrixWorldInverse);
    this.textureMatrix.multiply(surface.matrixWorld);

    // 斜近裁面（Lengyel, Oblique View Frustum Depth Projection and Clipping）。
    this.plane.setFromNormalAndCoplanarPoint(normal, this.planePoint);
    this.plane.applyMatrix4(virtual.matrixWorldInverse);
    this.clipPlane.set(
      this.plane.normal.x,
      this.plane.normal.y,
      this.plane.normal.z,
      this.plane.constant,
    );
    const projection = virtual.projectionMatrix.elements;
    this.corner.set(
      (Math.sign(this.clipPlane.x) + (projection[8] ?? 0)) / (projection[0] ?? 1),
      (Math.sign(this.clipPlane.y) + (projection[9] ?? 0)) / (projection[5] ?? 1),
      -1,
      (1 + (projection[10] ?? 0)) / (projection[14] ?? 1),
    );
    this.clipPlane.multiplyScalar(2 / this.clipPlane.dot(this.corner));
    projection[2] = this.clipPlane.x;
    projection[6] = this.clipPlane.y;
    projection[10] = this.clipPlane.z + 1;
    projection[14] = this.clipPlane.w;
    virtual.projectionMatrixInverse.copy(virtual.projectionMatrix).invert();
  }

  private render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    hidden: readonly THREE.Object3D[],
  ): void {
    const visibility = hidden.map((object) => object.visible);
    const previousTarget = renderer.getRenderTarget();
    const previousCubeFace = renderer.getActiveCubeFace();
    const previousMipmapLevel = renderer.getActiveMipmapLevel();
    const previousXr = renderer.xr.enabled;
    const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate;

    this.rendering = true;
    for (const object of hidden) object.visible = false;
    try {
      renderer.xr.enabled = false;
      // 陰影貼圖和主畫面共用，倒影這一次不需要重算。
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this.target);
      renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, this.virtualCamera);
    } finally {
      hidden.forEach((object, index) => {
        object.visible = visibility[index] ?? true;
      });
      renderer.xr.enabled = previousXr;
      renderer.shadowMap.autoUpdate = previousShadowAutoUpdate;
      renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmapLevel);
      this.rendering = false;
    }
  }
}
