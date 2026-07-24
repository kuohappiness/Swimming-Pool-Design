import * as THREE from 'three';
import type { VisualAssetAdapter, VisualAssetContext } from '../contracts';
import type { RenderQualityProfile } from '../quality-profile';

const DETAIL_STYLE_BY_MATERIAL = new Map<string, 'concrete' | 'frame' | 'coping'>([
  ['enhanced:exposed-concrete-l1', 'concrete'],
  ['enhanced:exposed-concrete-l2', 'concrete'],
  ['enhanced:exposed-concrete-l3', 'concrete'],
  ['enhanced:roof-glass', 'frame'],
  ['enhanced:safety-glass', 'frame'],
  ['enhanced:pool-basin', 'coping'],
  ['enhanced:pool-deck', 'coping'],
]);

export class EnhancedSurfaceDetailAdapter implements VisualAssetAdapter {
  readonly id = 'enhanced-surface-details';
  private readonly details: THREE.LineSegments[] = [];
  private readonly detailMaterials = {
    concrete: new THREE.LineBasicMaterial({
      color: 0x85847f,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      toneMapped: true,
    }),
    frame: new THREE.LineBasicMaterial({
      color: 0x263b42,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      toneMapped: true,
    }),
    coping: new THREE.LineBasicMaterial({
      color: 0xb4c8c7,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: true,
    }),
  };
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
      if (!(object instanceof THREE.Mesh) || object.userData.visualOnly) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const style = materials
        .map(({ name }) => DETAIL_STYLE_BY_MATERIAL.get(name))
        .find((candidate) => candidate !== undefined);
      if (!style) return;
      const geometry = new THREE.EdgesGeometry(object.geometry, style === 'concrete' ? 36 : 24);
      if (geometry.getAttribute('position').count === 0) {
        geometry.dispose();
        return;
      }
      const detail = new THREE.LineSegments(geometry, this.detailMaterials[style]);
      detail.name = `visual-only:${style}-edge`;
      detail.renderOrder = style === 'frame' ? 3 : 1;
      detail.userData = {
        visualOnly: true,
        collisionExcluded: true,
        sourceMeshUuid: object.uuid,
      };
      object.add(detail);
      this.details.push(detail);
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
      detail.removeFromParent();
      detail.geometry.dispose();
    }
    this.details.length = 0;
    for (const material of Object.values(this.detailMaterials)) material.dispose();
    this.attached = false;
  }

  private applyQuality() {
    const visible = this.quality.id !== 'low';
    for (const detail of this.details) detail.visible = visible;
    this.detailMaterials.concrete.opacity = this.quality.id === 'high' ? 0.22 : 0.14;
    this.detailMaterials.frame.opacity = this.quality.id === 'high' ? 0.78 : 0.62;
    this.detailMaterials.coping.opacity = this.quality.id === 'high' ? 0.42 : 0.28;
  }
}
