import * as THREE from 'three';
import type { VisualAssetAdapter, VisualAssetContext } from '../contracts';
import type { RenderQualityProfile } from '../quality-profile';
import { type VisualDetailLevel } from '../visual-detail';
export { markVisualDetail } from '../visual-detail';

const LEVEL_RANK: Readonly<Record<VisualDetailLevel, number>> = Object.freeze({
  essential: 0,
  reduced: 1,
  full: 2,
});

const QUALITY_LEVEL: Readonly<Record<RenderQualityProfile['id'], VisualDetailLevel>> = Object.freeze({
  low: 'essential',
  medium: 'reduced',
  high: 'full',
});

export class EnhancedDetailLevelAdapter implements VisualAssetAdapter {
  readonly id = 'enhanced-detail-level-adapter';
  private readonly details: THREE.Object3D[] = [];
  private readonly detailMeshes = new Set<THREE.Mesh>();
  private readonly shadowCasters = new Set<THREE.Mesh>();
  private quality: RenderQualityProfile;
  private attached = false;
  private disposed = false;

  constructor(initialQuality: RenderQualityProfile) {
    this.quality = initialQuality;
  }

  get detailCount() {
    return this.details.length;
  }

  attach(context: VisualAssetContext) {
    if (this.attached || this.disposed) return;
    this.attached = true;
    context.siteRoot.traverse((object) => {
      const level = object.userData.minimumVisualDetail as VisualDetailLevel | undefined;
      if (!level) return;
      if (!(level in LEVEL_RANK)) {
        throw new TypeError(`Unsupported visual detail level: ${String(level)}`);
      }
      if (object.userData.visualOnly !== true || object.userData.collisionExcluded !== true) {
        throw new TypeError('Quality-controlled details must be visual-only and collision-excluded.');
      }
      this.details.push(object);
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        this.detailMeshes.add(child);
        if (object.userData.castVisualShadow === true) this.shadowCasters.add(child);
      });
    });
    this.applyQuality();
  }

  setQuality(profile: RenderQualityProfile) {
    if (this.disposed) return;
    this.quality = profile;
    this.applyQuality();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const detail of this.details) {
      const level = detail.userData.minimumVisualDetail as VisualDetailLevel;
      detail.visible = level === 'essential';
    }
    for (const mesh of this.detailMeshes) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
    this.details.length = 0;
    this.detailMeshes.clear();
    this.shadowCasters.clear();
    this.attached = false;
  }

  private applyQuality() {
    const activeRank = LEVEL_RANK[QUALITY_LEVEL[this.quality.id]];
    for (const detail of this.details) {
      const level = detail.userData.minimumVisualDetail as VisualDetailLevel;
      detail.visible = LEVEL_RANK[level] <= activeRank;
    }
    for (const mesh of this.detailMeshes) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.castShadow = this.quality.shadows
        && this.shadowCasters.has(mesh)
        && materials.every((material) => !material.transparent);
      mesh.receiveShadow = this.quality.shadows;
    }
  }
}
