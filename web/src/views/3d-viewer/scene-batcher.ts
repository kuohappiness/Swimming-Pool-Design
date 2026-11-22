import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { VisualDetailLevel } from './rendering/visual-detail';

/**
 * Render categories let later passes (reflections, cascaded shadows, AO) pick
 * which parts of the scene they draw. Every mesh keeps Three layer 0, so the
 * main camera, raycaster and shadow cameras still see everything; a pass that
 * wants a subset disables layer 0 on its own camera and enables the category
 * layers it needs.
 */
export const RENDER_CATEGORY_LAYERS = Object.freeze({
  structure: 1,
  'water-surface': 2,
  'small-furnishing': 3,
  people: 4,
  vegetation: 5,
  glass: 6,
  mirror: 7,
  'emissive-fixture': 8,
  'site-context': 9,
} as const);

export type RenderCategory = keyof typeof RENDER_CATEGORY_LAYERS;

export function isRenderCategory(value: unknown): value is RenderCategory {
  return typeof value === 'string' && Object.hasOwn(RENDER_CATEGORY_LAYERS, value);
}

const DETAIL_RANK: Readonly<Record<VisualDetailLevel, number>> = Object.freeze({
  essential: 0,
  reduced: 1,
  full: 2,
});

function materialsOf(mesh: THREE.Mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** Explicit `userData.renderCategory` on the mesh or an ancestor wins; otherwise inferred from the material. */
export function renderCategoryOf(mesh: THREE.Mesh): RenderCategory {
  for (let current: THREE.Object3D | null = mesh; current; current = current.parent) {
    const explicit = current.userData.renderCategory;
    if (explicit !== undefined) {
      if (!isRenderCategory(explicit)) {
        throw new TypeError(`Unknown render category on ${current.name || current.type}: ${String(explicit)}`);
      }
      return explicit;
    }
  }
  const material = materialsOf(mesh)[0];
  const name = (material?.name ?? '').toLowerCase();
  if (name.includes('water')) return 'water-surface';
  if (name.includes('mirror')) return 'mirror';
  if (name.includes('glass')) return 'glass';
  const emissive = (material as THREE.MeshStandardMaterial | undefined)?.emissive;
  if (emissive && emissive.getHex() !== 0) return 'emissive-fixture';
  for (let current: THREE.Object3D | null = mesh; current; current = current.parent) {
    if (current.userData.minimumVisualDetail) return 'small-furnishing';
  }
  if (name.includes('planting') || name.includes('planter')) return 'vegetation';
  if (name.endsWith('ground')) return 'site-context';
  return 'structure';
}

/** Adds the render-category layer to every mesh under `root`, keeping layer 0. */
export function assignRenderCategoryLayers(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const category = renderCategoryOf(object);
    object.userData.renderCategory = category;
    object.layers.enable(RENDER_CATEGORY_LAYERS[category]);
  });
}

export interface StaticBatchOptions {
  /** Objects whose `visible` flag is switched as a unit (model layers, cutaway objects). Merging never crosses one. */
  readonly toggleUnits: Iterable<THREE.Object3D>;
  /** Objects (and their subtrees) that other code looks up, animates or replaces. */
  readonly exclude: Iterable<THREE.Object3D>;
  /** Selection owners, in selectable order; merged triangles remember which one they came from. */
  readonly selectionOwners: readonly THREE.Object3D[];
}

export interface StaticBatchReport {
  readonly sourceMeshes: number;
  readonly mergedSourceMeshes: number;
  readonly batches: number;
  readonly meshesAfter: number;
}

type Batchable = THREE.Mesh | THREE.Line;

interface BatchEntry {
  object: Batchable;
  owner: number;
}

interface BatchGroup {
  kind: 'mesh' | 'line';
  parent: THREE.Object3D;
  material: THREE.Material;
  category: RenderCategory | null;
  template: Batchable;
  entries: BatchEntry[];
}

const KEPT_ATTRIBUTES = ['position', 'normal', 'uv'];
const ANIMATED_NAME_PREFIXES = ['visual-only:POOL-01-caustic:'];

function detailLevelOf(object: THREE.Object3D): VisualDetailLevel | undefined {
  const level = object.userData.minimumVisualDetail as VisualDetailLevel | undefined;
  if (level !== undefined && !(level in DETAIL_RANK)) {
    throw new TypeError(`Unsupported visual detail level: ${String(level)}`);
  }
  return level;
}

function normalisedGeometry(mesh: THREE.Mesh, toScope: THREE.Matrix4) {
  const source = mesh.geometry;
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  for (const name of Object.keys(geometry.attributes)) {
    if (!KEPT_ATTRIBUTES.includes(name)) geometry.deleteAttribute(name);
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  geometry.clearGroups();
  geometry.morphAttributes = {};
  geometry.applyMatrix4(toScope);
  if (toScope.determinant() < 0) {
    // A mirrored transform flips triangle winding; swap two corners so front faces stay front.
    for (const attribute of Object.values(geometry.attributes) as THREE.BufferAttribute[]) {
      const size = attribute.itemSize;
      const array = attribute.array;
      for (let vertex = 0; vertex + 2 < attribute.count; vertex += 3) {
        for (let component = 0; component < size; component += 1) {
          const second = (vertex + 1) * size + component;
          const third = (vertex + 2) * size + component;
          const swap = array[second];
          array[second] = array[third];
          array[third] = swap;
        }
      }
    }
  }
  return geometry;
}

function attributeSignature(mesh: THREE.Mesh) {
  const names = Object.keys(mesh.geometry.attributes).filter((name) => KEPT_ATTRIBUTES.includes(name));
  if (!names.includes('normal')) names.push('normal');
  return names.sort().join(',');
}

/** Line, LineLoop and LineSegments all become plain segment pairs in scope space. */
function lineSegmentGeometry(line: THREE.Line, toScope: THREE.Matrix4) {
  const position = line.geometry.getAttribute('position');
  const index = line.geometry.index;
  const vertexCount = index ? index.count : position.count;
  const vertexAt = (i: number) => (index ? index.getX(i) : i);
  const pairs: number[] = [];
  if (line instanceof THREE.LineSegments) {
    for (let i = 0; i + 1 < vertexCount; i += 2) pairs.push(vertexAt(i), vertexAt(i + 1));
  } else {
    for (let i = 0; i + 1 < vertexCount; i += 1) pairs.push(vertexAt(i), vertexAt(i + 1));
    if (line instanceof THREE.LineLoop && vertexCount > 2) pairs.push(vertexAt(vertexCount - 1), vertexAt(0));
  }
  const vertex = new THREE.Vector3();
  const positions = new Float32Array(pairs.length * 3);
  pairs.forEach((source, target) => {
    vertex.fromBufferAttribute(position, source).applyMatrix4(toScope);
    positions.set([vertex.x, vertex.y, vertex.z], target * 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/**
 * Merges static meshes that share a material into one draw call per material
 * inside each toggle unit (model layer, cutaway object) and each visual-detail
 * level. Merged triangles keep their selection owner in `userData.faceOwners`,
 * so picking still resolves to the original model entity. Lines, sprites,
 * helpers and excluded objects are left as they are.
 */
export function batchStaticMeshes(root: THREE.Object3D, options: StaticBatchOptions): StaticBatchReport {
  root.updateMatrixWorld(true);
  const toggleUnits = new Set(options.toggleUnits);
  toggleUnits.add(root);
  const excluded = new Set(options.exclude);
  const ownerIndex = new Map<THREE.Object3D, number>();
  options.selectionOwners.forEach((owner, index) => ownerIndex.set(owner, index));

  const detailContainers = new Map<string, THREE.Group>();
  const groups = new Map<string, BatchGroup>();
  const geometryUsers = new Map<THREE.BufferGeometry, number>();
  let sourceMeshes = 0;

  const containerFor = (unit: THREE.Object3D, level: VisualDetailLevel, castVisualShadow: boolean) => {
    const key = `${unit.uuid}|${level}|${castVisualShadow}`;
    let container = detailContainers.get(key);
    if (!container) {
      container = new THREE.Group();
      container.name = `batch-detail:${unit.name || unit.type}:${level}`;
      container.userData = {
        visualOnly: true,
        collisionExcluded: true,
        minimumVisualDetail: level,
        castVisualShadow,
        batchContainer: true,
      };
      container.visible = level === 'essential';
      unit.add(container);
      container.updateMatrixWorld(true);
      detailContainers.set(key, container);
    }
    return container;
  };

  const candidates: Batchable[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) sourceMeshes += 1;
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      geometryUsers.set(object.geometry, (geometryUsers.get(object.geometry) ?? 0) + 1);
      candidates.push(object);
    }
  });

  for (const mesh of candidates) {
    const isLine = mesh instanceof THREE.Line;
    if (
      mesh instanceof THREE.InstancedMesh
      || mesh instanceof THREE.SkinnedMesh
      || Array.isArray(mesh.material)
      || mesh.children.length > 0
      || toggleUnits.has(mesh)
      || mesh.userData.batchExclude === true
      || ANIMATED_NAME_PREFIXES.some((prefix) => mesh.name.startsWith(prefix))
      || Object.keys(mesh.geometry.morphAttributes).length > 0
      || mesh.geometry.drawRange.count !== Infinity
      || !mesh.geometry.getAttribute('position')
      // Dashed lines need per-line distances; vertex-coloured lines are helpers.
      || (isLine && (
        mesh.material instanceof THREE.LineDashedMaterial
        || (mesh.material as THREE.Material).vertexColors
        || !(mesh.parent instanceof THREE.Group || mesh.parent instanceof THREE.Scene)
      ))
    ) continue;

    let unit: THREE.Object3D | null = null;
    let detailRank = -1;
    let castVisualShadow = false;
    let visibleChain = true;
    let excludedChain = false;
    let owner = -1;
    for (let current: THREE.Object3D | null = mesh; current; current = current.parent) {
      if (excluded.has(current)) excludedChain = true;
      if (owner < 0 && ownerIndex.has(current)) owner = ownerIndex.get(current)!;
      if (unit) continue;
      const level = detailLevelOf(current);
      if (level) {
        if (DETAIL_RANK[level] > detailRank) {
          detailRank = DETAIL_RANK[level];
          castVisualShadow = current.userData.castVisualShadow === true;
        }
      } else if (!current.visible && !toggleUnits.has(current)) {
        visibleChain = false;
      }
      if (toggleUnits.has(current) && current !== mesh) unit = current;
    }
    if (excludedChain || !visibleChain || !unit) continue;
    if (mesh.userData.selectionOwner && owner < 0) {
      const selectionOwner = mesh.userData.selectionOwner as THREE.Object3D;
      owner = ownerIndex.get(selectionOwner) ?? -1;
    }

    const level = (Object.keys(DETAIL_RANK) as VisualDetailLevel[])[detailRank];
    const parent = level ? containerFor(unit, level, castVisualShadow) : unit;
    const material = mesh.material as THREE.Material;
    const category = isLine ? null : renderCategoryOf(mesh as THREE.Mesh);
    const key = [
      isLine ? 'line' : 'mesh',
      parent.uuid,
      material.uuid,
      category,
      mesh.castShadow,
      mesh.receiveShadow,
      mesh.renderOrder,
      mesh.frustumCulled,
      mesh.userData.visualOnly === true,
      mesh.userData.collisionExcluded === true,
      isLine ? 'position' : attributeSignature(mesh as THREE.Mesh),
    ].join('|');
    let group = groups.get(key);
    if (!group) {
      group = { kind: isLine ? 'line' : 'mesh', parent, material, category, template: mesh, entries: [] };
      groups.set(key, group);
    }
    group.entries.push({ object: mesh, owner });
  }

  let mergedSourceMeshes = 0;
  let batches = 0;
  const inverseParent = new THREE.Matrix4();
  const toScope = new THREE.Matrix4();
  for (const group of groups.values()) {
    if (group.entries.length < 2) continue;
    inverseParent.copy(group.parent.matrixWorld).invert();
    const geometries: THREE.BufferGeometry[] = [];
    // One owner per triangle (meshes) or per segment (lines).
    const faceOwners: number[] = [];
    const verticesPerElement = group.kind === 'mesh' ? 3 : 2;
    for (const { object, owner } of group.entries) {
      toScope.multiplyMatrices(inverseParent, object.matrixWorld);
      const geometry = object instanceof THREE.Line
        ? lineSegmentGeometry(object, toScope)
        : normalisedGeometry(object, toScope);
      geometries.push(geometry);
      const elements = geometry.getAttribute('position').count / verticesPerElement;
      for (let element = 0; element < elements; element += 1) faceOwners.push(owner);
    }
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) throw new TypeError(`Static batch could not merge ${group.material.name || group.material.type}.`);
    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    const { template } = group;
    const batch = group.kind === 'mesh'
      ? new THREE.Mesh(merged, group.material)
      : new THREE.LineSegments(merged, group.material);
    batch.name = `batch:${group.parent.name || group.parent.type}:${group.material.name || group.material.type}`;
    batch.castShadow = template.castShadow;
    batch.receiveShadow = template.receiveShadow;
    batch.renderOrder = template.renderOrder;
    batch.frustumCulled = template.frustumCulled;
    batch.userData = {
      batched: true,
      ...(group.category ? { renderCategory: group.category } : {}),
      sourceMeshCount: group.entries.length,
      faceOwners: Int32Array.from(faceOwners),
      ...(template.userData.visualOnly === true ? { visualOnly: true } : {}),
      ...(template.userData.collisionExcluded === true ? { collisionExcluded: true } : {}),
    };
    group.parent.add(batch);

    for (const { object } of group.entries) {
      object.removeFromParent();
      const users = (geometryUsers.get(object.geometry) ?? 1) - 1;
      geometryUsers.set(object.geometry, users);
      if (users === 0) object.geometry.dispose();
    }
    if (group.kind === 'mesh') mergedSourceMeshes += group.entries.length;
    batches += 1;
  }

  assignRenderCategoryLayers(root);
  let meshesAfter = 0;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshesAfter += 1;
  });
  return { sourceMeshes, mergedSourceMeshes, batches, meshesAfter };
}
