import * as THREE from 'three';
import type {
  VisualAssetContext,
  VisualWalkthroughState,
} from '../contracts';
import type { RenderQualityProfile } from '../quality-profile';

const WATER_SURFACE_NAME = 'POOL-01-WATER-SURFACE';

function isUnderwater(state: VisualWalkthroughState) {
  return state.movementMode === 'swimming-underwater';
}

export class EnhancedWaterPresentation {
  readonly id = 'enhanced-shared-water-presentation';
  private profile: RenderQualityProfile;
  private surface: THREE.Mesh | null = null;
  private originalMaterial: THREE.Material | THREE.Material[] | null = null;
  private presentationMaterial: THREE.Material | null = null;
  private waterline: THREE.LineSegments | null = null;
  private expectedSurfaceElevation: number | null = null;
  private state: VisualWalkthroughState | null = null;
  private disposed = false;

  constructor(initialProfile: RenderQualityProfile) {
    this.profile = initialProfile;
  }

  attach(context: VisualAssetContext) {
    if (this.surface || this.disposed) return;
    const candidate = context.siteRoot.getObjectByName(WATER_SURFACE_NAME);
    if (!(candidate instanceof THREE.Mesh)) {
      throw new TypeError(`Enhanced water surface is missing: ${WATER_SURFACE_NAME}`);
    }
    const sourceMaterial = Array.isArray(candidate.material)
      ? candidate.material[0]
      : candidate.material;
    if (!sourceMaterial) throw new TypeError('Enhanced water surface has no material.');
    const expected = candidate.userData.waterSurfaceElevation;
    if (!Number.isFinite(expected)) {
      throw new TypeError('Enhanced water surface must expose its shared surface elevation.');
    }
    const material = sourceMaterial.clone();
    material.name = 'enhanced:shared-water-presentation';
    this.surface = candidate;
    this.originalMaterial = candidate.material;
    this.presentationMaterial = material;
    candidate.material = material;
    this.expectedSurfaceElevation = expected;

    const waterlineMaterial = new THREE.LineBasicMaterial({
      color: 0xc9f5f5,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      toneMapped: true,
    });
    const waterline = new THREE.LineSegments(
      new THREE.EdgesGeometry(candidate.geometry, 1),
      waterlineMaterial,
    );
    waterline.name = 'visual-only:POOL-01-waterline';
    waterline.renderOrder = 5;
    waterline.userData = {
      visualOnly: true,
      collisionExcluded: true,
      waterStateSource: candidate.userData.waterStateSource,
    };
    candidate.add(waterline);
    this.waterline = waterline;
    this.apply();
  }

  setQuality(profile: RenderQualityProfile) {
    if (this.disposed) return;
    this.profile = profile;
    this.apply();
  }

  setWalkthroughState(state: VisualWalkthroughState) {
    if (this.disposed) return;
    if (
      this.expectedSurfaceElevation !== null
      && Math.abs(state.waterSurfaceElevation - this.expectedSurfaceElevation) > 1e-9
    ) {
      throw new TypeError('Enhanced water presentation received a second water surface state.');
    }
    this.state = state;
    this.apply();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.surface && this.originalMaterial) this.surface.material = this.originalMaterial;
    this.waterline?.removeFromParent();
    this.waterline?.geometry.dispose();
    (this.waterline?.material as THREE.Material | undefined)?.dispose();
    this.presentationMaterial?.dispose();
    this.surface = null;
    this.originalMaterial = null;
    this.presentationMaterial = null;
    this.waterline = null;
    this.state = null;
  }

  private apply() {
    if (!this.presentationMaterial) return;
    const underwater = this.state ? isUnderwater(this.state) : false;
    const cutaway = this.state?.poolCutaway ?? false;
    const expensiveWater = this.profile.enhancedWater && this.profile.id !== 'low';
    const material = this.presentationMaterial;
    material.transparent = true;
    material.opacity = underwater ? 0.5 : expensiveWater ? 0.74 : 0.64;
    material.depthWrite = false;
    const physical = material as THREE.MeshPhysicalMaterial;
    if ('transmission' in physical) {
      physical.transmission = expensiveWater ? 0.52 : 0;
      physical.roughness = expensiveWater ? 0.1 : 0.28;
      if (!expensiveWater) physical.normalMap = null;
    }
    material.needsUpdate = true;
    if (this.waterline) {
      this.waterline.visible = expensiveWater && !underwater && !cutaway;
      const waterlineMaterial = this.waterline.material as THREE.LineBasicMaterial;
      waterlineMaterial.opacity = this.profile.id === 'high' ? 0.72 : 0.48;
    }
  }
}
