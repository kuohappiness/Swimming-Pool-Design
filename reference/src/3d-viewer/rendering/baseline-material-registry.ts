import * as THREE from 'three';
import type { MaterialRegistry, SemanticMaterialId } from './contracts';
import type { RenderQualityProfile } from './quality-profile';

const PALETTE = {
  l1: 0xb9b6b0,
  l2: 0xaaa7a1,
  l3: 0x9d9a94,
  water: 0x3c9eb8,
  roof: 0x9bd4d9,
  stair: 0x303b42,
  deferred: 0x8b65a7,
  ground: 0xe8e4da,
  planting: 0x829f77,
};

type MaterialEntries = ReadonlyArray<readonly [SemanticMaterialId, THREE.Material]>;

function createEntries(): MaterialEntries {
  const roofGlass = new THREE.MeshPhysicalMaterial({
    color: PALETTE.roof,
    transparent: true,
    opacity: 0.34,
    roughness: 0.16,
    metalness: 0,
    transmission: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const safetyGlass = roofGlass.clone();
  safetyGlass.name = 'SHARED-SAFETY-GLASS-FACADE-MATERIAL';
  safetyGlass.color.set(0x8fd7e5);
  safetyGlass.opacity = 0.34;
  safetyGlass.roughness = 0.1;
  safetyGlass.transmission = 0.16;

  return [
    ['ground', new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 })],
    ['planting', new THREE.MeshStandardMaterial({ color: PALETTE.planting, roughness: 1 })],
    ['exposed-concrete-l1', new THREE.MeshStandardMaterial({ color: PALETTE.l1, roughness: 0.94, metalness: 0 })],
    ['exposed-concrete-l2', new THREE.MeshStandardMaterial({ color: PALETTE.l2, roughness: 0.92, metalness: 0 })],
    ['exposed-concrete-l3', new THREE.MeshStandardMaterial({ color: PALETTE.l3, roughness: 0.9, metalness: 0 })],
    ['service-overlay', new THREE.MeshStandardMaterial({
      color: 0xb87938,
      roughness: 0.58,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    })],
    ['structural-steel', new THREE.MeshStandardMaterial({ color: PALETTE.stair, roughness: 0.54, metalness: 0.24 })],
    ['deferred', new THREE.MeshStandardMaterial({
      color: PALETTE.deferred,
      roughness: 0.55,
      transparent: true,
      opacity: 0.68,
    })],
    ['roof-glass', roofGlass],
    ['safety-glass', safetyGlass],
    ['water', new THREE.MeshPhysicalMaterial({
      color: PALETTE.water,
      transparent: true,
      opacity: 0.68,
      roughness: 0.16,
      metalness: 0.03,
      transmission: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })],
    ['pool-basin', new THREE.MeshStandardMaterial({ color: 0xd3e1df, roughness: 0.7, side: THREE.DoubleSide })],
    ['mirror', new THREE.MeshPhysicalMaterial({
      color: 0xc1d7dc,
      roughness: 0.06,
      metalness: 0.86,
      side: THREE.DoubleSide,
    })],
    ['site-boundary', new THREE.LineDashedMaterial({ color: 0x72858c, dashSize: 0.55, gapSize: 0.35 })],
    ['program-zone', new THREE.MeshStandardMaterial({
      color: 0xdcc9a9,
      roughness: 0.88,
      transparent: true,
      opacity: 0.7,
    })],
    ['equipment-zone', new THREE.MeshStandardMaterial({
      color: 0x9eb4b3,
      roughness: 0.78,
      transparent: true,
      opacity: 0.62,
    })],
    ['opening-marker', new THREE.MeshStandardMaterial({ color: 0x3f4c51, roughness: 0.72 })],
    ['sanitary-fixture', new THREE.MeshStandardMaterial({ color: 0xf4f6f4, roughness: 0.42 })],
    ['cubicle', new THREE.MeshStandardMaterial({ color: 0xc8d1ce, roughness: 0.78 })],
    ['cubicle-door', new THREE.MeshStandardMaterial({ color: 0x65736f, roughness: 0.68 })],
    ['pool-deck', new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.88 })],
    ['lane-line', new THREE.LineBasicMaterial({ color: 0xf7f5df })],
    ['lane-float-light', new THREE.MeshStandardMaterial({ color: 0xf4f1de, roughness: 0.54 })],
    ['lane-float-red', new THREE.MeshStandardMaterial({ color: 0xc75d4b, roughness: 0.54 })],
    ['pool-rail', new THREE.MeshStandardMaterial({ color: 0xaeb8ba, roughness: 0.32, metalness: 0.72 })],
    ['l2-circulation', new THREE.MeshStandardMaterial({
      color: 0xc7d8d2,
      roughness: 0.82,
      transparent: true,
      opacity: 0.74,
      side: THREE.DoubleSide,
    })],
    ['l2-stair-zone', new THREE.MeshStandardMaterial({
      color: 0xd0ccc2,
      roughness: 0.86,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    })],
    ['glass-edge', new THREE.LineBasicMaterial({ color: 0x5ab8d0, transparent: true, opacity: 0.92 })],
    ['shower-partition', new THREE.MeshStandardMaterial({ color: 0xd9e4e1, roughness: 0.78 })],
    ['interior-fixture', new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.5 })],
    ['locker', new THREE.MeshStandardMaterial({ color: 0x6d827f, roughness: 0.76 })],
    ['l3-extension', new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.82, side: THREE.DoubleSide })],
    ['l3-arrival', new THREE.MeshStandardMaterial({ color: 0xd7ddd9, roughness: 0.7, side: THREE.DoubleSide })],
    ['terrace', new THREE.MeshStandardMaterial({ color: 0x99b48c, roughness: 0.92, side: THREE.DoubleSide })],
    ['planter', new THREE.MeshStandardMaterial({ color: PALETTE.planting, roughness: 0.95 })],
    ['equipment', new THREE.MeshStandardMaterial({ color: 0x8aa8ae, roughness: 0.62, metalness: 0.15 })],
    ['roof-grid', new THREE.LineBasicMaterial({ color: 0x5e9cac, transparent: true, opacity: 0.62 })],
    ['canopy-frame', new THREE.LineBasicMaterial({ color: 0x4e96a7, transparent: true, opacity: 0.85 })],
    ['photovoltaic', new THREE.MeshPhysicalMaterial({
      color: 0x8fd9ee,
      roughness: 0.22,
      metalness: 0.08,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.44,
      transmission: 0.12,
      depthWrite: false,
    })],
    ['photovoltaic-grid', new THREE.LineBasicMaterial({ color: 0x4f9fc1, transparent: true, opacity: 0.86 })],
    ['rain', new THREE.LineBasicMaterial({ color: 0x568eaf, transparent: true, opacity: 0.62 })],
    ['rain-path', new THREE.LineDashedMaterial({ color: PALETTE.deferred, dashSize: 0.45, gapSize: 0.3 })],
    ['west-rain-path', new THREE.LineDashedMaterial({ color: PALETTE.deferred, dashSize: 0.4, gapSize: 0.24 })],
    ['cutaway-water', new THREE.MeshBasicMaterial({
      color: 0x39a9cf,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })],
    ['cutaway-depth', new THREE.LineBasicMaterial({ color: 0xe87451, linewidth: 2, depthTest: false })],
    ['cutaway-guide', new THREE.LineDashedMaterial({
      color: 0xf2b26f,
      dashSize: 0.22,
      gapSize: 0.14,
      depthTest: false,
    })],
    ['cutaway-waterline', new THREE.LineBasicMaterial({ color: 0xe9fbff, depthTest: false })],
  ];
}

export class BaselineMaterialRegistry implements MaterialRegistry {
  readonly id = 'baseline-material-registry';
  readonly semanticIds: readonly SemanticMaterialId[];
  private readonly materials: ReadonlyMap<SemanticMaterialId, THREE.Material>;
  private disposed = false;

  constructor() {
    const entries = createEntries();
    const ids = entries.map(([id]) => id);
    if (new Set(ids).size !== ids.length) {
      throw new TypeError('Baseline material registry contains duplicate semantic IDs.');
    }
    this.semanticIds = Object.freeze(ids);
    this.materials = new Map(entries);
    for (const [id, material] of entries) {
      if (!material.name) material.name = `baseline:${id}`;
    }
  }

  get(id: SemanticMaterialId) {
    if (this.disposed) throw new TypeError('Baseline material registry has been disposed.');
    const material = this.materials.get(id);
    if (!material) throw new TypeError(`Unknown semantic material: ${id}`);
    return material;
  }

  setQuality(_profile: RenderQualityProfile) {}

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const material of this.materials.values()) material.dispose();
  }
}
