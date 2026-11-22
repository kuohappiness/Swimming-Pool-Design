import * as THREE from 'three';
import type {
  VisualAssetAdapter,
  VisualAssetContext,
  VisualFrameState,
  VisualWalkthroughState,
} from '../contracts';
import type { RenderQualityProfile } from '../quality-profile';
import { EnhancedDetailLevelAdapter } from './detail-level';
import { EnhancedSurfaceDetailAdapter } from './surface-details';
import { EnhancedWaterPresentation } from './water-presentation';
import {
  RealisticWaterPresentation,
  type RealisticWaterOptions,
} from '../water/realistic-water-presentation';
import { WATER_SURFACE_NAME } from '../water/water-surface';

export interface EnhancedVisualAssetAdapterOptions {
  readonly createOptionalAssets?: (siteBounds: THREE.Box3) => THREE.Group;
  /** 有給才啟用寫實水面；沒給（或貼圖載入失敗）時維持原本的水。 */
  readonly realisticWater?: RealisticWaterOptions;
}

/** 目前畫面上的水是哪一種，寫在水面網格的 userData.waterPresentation。 */
export type WaterPresentationStatus = 'legacy' | 'realistic-loading' | 'realistic' | 'legacy-fallback';

function disposeGroup(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
    }
  });
  group.removeFromParent();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function siteBoundsFromVisualEntity(context: VisualAssetContext) {
  const ground = context.siteRoot.getObjectByName('CUTAWAY-HIDE-SITE-GROUND');
  if (!(ground instanceof THREE.Mesh)) {
    throw new TypeError('SITE-01 visual anchor mesh is missing.');
  }
  ground.geometry.computeBoundingBox();
  if (!ground.geometry.boundingBox) throw new TypeError('SITE-01 visual anchor bounds are missing.');
  ground.updateMatrix();
  return ground.geometry.boundingBox.clone().applyMatrix4(ground.matrix);
}

function addTree(
  group: THREE.Group,
  x: number,
  z: number,
  scale: number,
  trunkMaterial: THREE.Material,
  foliageMaterial: THREE.Material,
) {
  const tree = new THREE.Group();
  tree.name = 'visual-only:SITE-01-planting-scale';
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.15, 7), trunkMaterial);
  trunk.position.y = 0.575;
  const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.85, 9), foliageMaterial);
  foliage.position.y = 1.72;
  tree.add(trunk, foliage);
  group.add(tree);
}

function createProceduralScaleAssets(siteBounds: THREE.Box3) {
  const group = new THREE.Group();
  group.name = 'visual-only:SITE-01-scale-assets';
  group.userData = {
    visualOnly: true,
    collisionExcluded: true,
    anchorEntityId: 'SITE-01',
    source: 'project-authored-procedural',
  };
  const width = siteBounds.max.x - siteBounds.min.x;
  const depth = siteBounds.max.z - siteBounds.min.z;
  const point = (normalizedX: number, normalizedZ: number) => ({
    x: siteBounds.min.x + width * normalizedX,
    z: siteBounds.min.z + depth * normalizedZ,
  });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x665445, roughness: 0.95 });
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x54765d, roughness: 0.92 });
  for (const [normalizedX, normalizedZ, scale] of [
    [0.08, 0.12, 1],
    [0.92, 0.18, 0.85],
    [0.9, 0.86, 1.1],
  ] as const) {
    const anchor = point(normalizedX, normalizedZ);
    addTree(group, anchor.x, anchor.z, scale, trunkMaterial, foliageMaterial);
  }

  const figureMaterial = new THREE.MeshStandardMaterial({ color: 0xb86f4c, roughness: 0.78 });
  const figureAnchor = point(0.08, 0.48);
  const figure = new THREE.Group();
  figure.name = 'visual-only:SITE-01-human-scale';
  figure.position.set(figureAnchor.x, 0, figureAnchor.z);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.9, 4, 8), figureMaterial);
  body.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), figureMaterial);
  head.position.y = 1.52;
  figure.add(body, head);
  group.add(figure);

  const equipmentMaterial = new THREE.MeshStandardMaterial({
    color: 0x69777b,
    roughness: 0.56,
    metalness: 0.34,
  });
  const equipmentAnchor = point(0.78, 0.16);
  const equipment = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.9, 0.7),
    equipmentMaterial,
  );
  equipment.name = 'visual-only:SITE-01-equipment-scale';
  equipment.position.set(equipmentAnchor.x, 0.45, equipmentAnchor.z);
  group.add(equipment);
  group.traverse((object) => {
    object.userData.visualOnly = true;
    object.userData.collisionExcluded = true;
    object.userData.anchorEntityId = 'SITE-01';
  });
  return group;
}

export class EnhancedVisualAssetAdapter implements VisualAssetAdapter {
  readonly id = 'enhanced-water-and-scale-assets';
  private readonly surfaceDetails: EnhancedSurfaceDetailAdapter;
  private readonly detailLevels: EnhancedDetailLevelAdapter;
  private readonly water: EnhancedWaterPresentation;
  private readonly realisticWater: RealisticWaterPresentation | null;
  private waterStatus: WaterPresentationStatus = 'legacy';
  private waterFailure: string | null = null;
  private context: VisualAssetContext | null = null;
  /** 寫實水面載入並換上（或確定退回）後才完成；沒有啟用寫實水面時立刻完成。 */
  waterReady: Promise<void> = Promise.resolve();
  private readonly createOptionalAssets: (siteBounds: THREE.Box3) => THREE.Group;
  private profile: RenderQualityProfile;
  private optionalAssets: THREE.Group | null = null;
  private readonly caustics: Array<{ mesh: THREE.Mesh; baseX: number; phase: number }> = [];
  private status: 'idle' | 'attached' | 'degraded' | 'disposed' = 'idle';
  private attached = false;
  private disposed = false;

  constructor(
    initialProfile: RenderQualityProfile,
    options: EnhancedVisualAssetAdapterOptions = {},
  ) {
    this.profile = initialProfile;
    this.surfaceDetails = new EnhancedSurfaceDetailAdapter(initialProfile);
    this.detailLevels = new EnhancedDetailLevelAdapter(initialProfile);
    this.water = new EnhancedWaterPresentation(initialProfile);
    this.realisticWater = options.realisticWater
      ? new RealisticWaterPresentation(initialProfile, options.realisticWater)
      : null;
    this.createOptionalAssets = options.createOptionalAssets ?? createProceduralScaleAssets;
  }

  get assetStatus() {
    return this.status;
  }

  get waterPresentation(): WaterPresentationStatus {
    return this.waterStatus;
  }

  /** 寫實水面沒能啟用的原因；正常時是 null。 */
  get waterDiagnostic(): string | null {
    return this.waterFailure;
  }

  attach(context: VisualAssetContext) {
    if (this.attached || this.disposed) return;
    this.attached = true;
    this.surfaceDetails.attach(context);
    this.detailLevels.attach(context);
    this.water.attach(context);
    this.context = context;
    this.setWaterStatus(this.realisticWater ? 'realistic-loading' : 'legacy');
    if (this.realisticWater) this.waterReady = this.startRealisticWater(this.realisticWater, context);
    context.siteRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.name.startsWith('visual-only:POOL-01-caustic:')) return;
      this.caustics.push({
        mesh: object,
        baseX: object.position.x,
        phase: Number(object.userData.causticPhase ?? 0),
      });
    });
    try {
      const group = this.createOptionalAssets(siteBoundsFromVisualEntity(context));
      context.siteRoot.add(group);
      this.optionalAssets = group;
      this.status = 'attached';
    } catch {
      if (this.optionalAssets) disposeGroup(this.optionalAssets);
      this.optionalAssets = null;
      this.status = 'degraded';
    }
    this.applyQuality();
  }

  setQuality(profile: RenderQualityProfile) {
    if (this.disposed) return;
    this.profile = profile;
    this.surfaceDetails.setQuality(profile);
    this.detailLevels.setQuality(profile);
    this.water.setQuality(profile);
    this.realisticWater?.setQuality(profile);
    this.applyQuality();
  }

  setWalkthroughState(state: VisualWalkthroughState) {
    this.water.setWalkthroughState(state);
    this.realisticWater?.setWalkthroughState(state);
  }

  invalidateLighting() {
    this.realisticWater?.invalidateReflection();
  }

  updateFrame(state: VisualFrameState) {
    if (this.disposed) return;
    this.water.updateFrame(state);
    this.realisticWater?.updateFrame(state);
    // 寫實水面的焦散在著色器裡，舊的滑動光帶已隱藏，不必再移動。
    if (this.waterStatus === 'realistic') return;
    if (state.reducedMotion || this.profile.id !== 'high') return;
    for (const { mesh, baseX, phase } of this.caustics) {
      mesh.position.x = baseX + Math.sin(state.elapsedSeconds * 0.55 + phase * Math.PI * 2) * 0.12;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.optionalAssets) disposeGroup(this.optionalAssets);
    this.optionalAssets = null;
    for (const { mesh, baseX } of this.caustics) {
      mesh.position.x = baseX;
      mesh.visible = true;
    }
    this.caustics.length = 0;
    this.realisticWater?.dispose();
    this.water.dispose();
    this.context = null;
    this.detailLevels.dispose();
    this.surfaceDetails.dispose();
    this.status = 'disposed';
    this.attached = false;
  }

  private async startRealisticWater(water: RealisticWaterPresentation, context: VisualAssetContext) {
    try {
      await water.load();
      if (this.disposed) return;
      // 先把舊的水拆掉（它會把原本的材質還回去），寫實水面再接手同一個網格。
      this.water.dispose();
      water.activate(context);
      for (const { mesh, baseX } of this.caustics) {
        mesh.position.x = baseX;
        mesh.visible = false;
      }
      this.setWaterStatus('realistic');
    } catch (error) {
      if (this.disposed) return;
      this.waterFailure = error instanceof Error ? error.message : 'Realistic water could not be created.';
      this.setWaterStatus('legacy-fallback');
    }
  }

  private setWaterStatus(status: WaterPresentationStatus) {
    this.waterStatus = status;
    const surface = this.context?.siteRoot.getObjectByName(WATER_SURFACE_NAME);
    if (surface) surface.userData.waterPresentation = status;
  }

  private applyQuality() {
    if (!this.optionalAssets) return;
    this.optionalAssets.visible = this.profile.id !== 'low';
    this.optionalAssets.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = this.profile.shadows;
      object.receiveShadow = this.profile.shadows;
    });
  }
}
