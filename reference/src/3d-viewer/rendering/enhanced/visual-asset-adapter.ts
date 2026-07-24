import * as THREE from 'three';
import type {
  VisualAssetAdapter,
  VisualAssetContext,
  VisualWalkthroughState,
} from '../contracts';
import type { RenderQualityProfile } from '../quality-profile';
import { EnhancedSurfaceDetailAdapter } from './surface-details';
import { EnhancedWaterPresentation } from './water-presentation';

export interface EnhancedVisualAssetAdapterOptions {
  readonly createOptionalAssets?: (siteBounds: THREE.Box3) => THREE.Group;
}

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
  private readonly water: EnhancedWaterPresentation;
  private readonly createOptionalAssets: (siteBounds: THREE.Box3) => THREE.Group;
  private profile: RenderQualityProfile;
  private optionalAssets: THREE.Group | null = null;
  private status: 'idle' | 'attached' | 'degraded' | 'disposed' = 'idle';
  private attached = false;
  private disposed = false;

  constructor(
    initialProfile: RenderQualityProfile,
    options: EnhancedVisualAssetAdapterOptions = {},
  ) {
    this.profile = initialProfile;
    this.surfaceDetails = new EnhancedSurfaceDetailAdapter(initialProfile);
    this.water = new EnhancedWaterPresentation(initialProfile);
    this.createOptionalAssets = options.createOptionalAssets ?? createProceduralScaleAssets;
  }

  get assetStatus() {
    return this.status;
  }

  attach(context: VisualAssetContext) {
    if (this.attached || this.disposed) return;
    this.attached = true;
    this.surfaceDetails.attach(context);
    this.water.attach(context);
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
    this.water.setQuality(profile);
    this.applyQuality();
  }

  setWalkthroughState(state: VisualWalkthroughState) {
    this.water.setWalkthroughState(state);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.optionalAssets) disposeGroup(this.optionalAssets);
    this.optionalAssets = null;
    this.water.dispose();
    this.surfaceDetails.dispose();
    this.status = 'disposed';
    this.attached = false;
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
