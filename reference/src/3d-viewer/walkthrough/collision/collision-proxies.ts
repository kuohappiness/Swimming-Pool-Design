import * as THREE from 'three';
import type {
  PlanTransform,
  PoolShellDescriptor,
  SiteBounds,
  StairRampDescriptor,
  WalkSurfaceDescriptor,
  WalkthroughSource,
} from '../types.js';

export interface CollisionFrame {
  readonly localToWorld: THREE.Matrix4;
  readonly worldToLocal: THREE.Matrix4;
}

export interface SurfaceCollisionProxy {
  readonly id: string;
  readonly kind: 'surface';
  readonly frame: CollisionFrame;
  readonly bounds: SiteBounds;
  readonly elevation: number;
  readonly exclusions: readonly SiteBounds[];
}

export interface StairCollisionProxy {
  readonly id: string;
  readonly kind: 'stair';
  readonly frame: CollisionFrame;
  readonly descriptor: StairRampDescriptor;
}

export interface PoolBottomCollisionProxy {
  readonly id: string;
  readonly kind: 'pool-bottom';
  readonly frame: CollisionFrame;
  readonly descriptor: PoolShellDescriptor;
}

export interface SolidCollisionProxy {
  readonly id: string;
  readonly kind: 'solid';
  readonly frame: CollisionFrame;
  readonly bounds: SiteBounds;
  readonly minimumElevation: number;
  readonly maximumElevation: number;
}

export type GroundCollisionProxy =
  | SurfaceCollisionProxy
  | StairCollisionProxy
  | PoolBottomCollisionProxy;

export interface CollisionProxySet {
  readonly siteFrame: CollisionFrame;
  readonly grounds: readonly GroundCollisionProxy[];
  readonly solids: readonly SolidCollisionProxy[];
}

const EPSILON = 1e-8;
const WALL_THICKNESS = 0.16;
const SITE_GROUND_MARGIN = 2;

function frameFromMatrix(localToWorld: THREE.Matrix4): CollisionFrame {
  const determinant = localToWorld.determinant();
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= EPSILON) {
    throw new TypeError('Collision frame must be finite and invertible.');
  }
  return Object.freeze({
    localToWorld: localToWorld.clone(),
    worldToLocal: localToWorld.clone().invert(),
  });
}

export function createPlanTransformMatrix(transform: PlanTransform): THREE.Matrix4 {
  if (transform.kind === 'fixed') return new THREE.Matrix4();
  const { pivot } = transform;
  const radians = THREE.MathUtils.degToRad(transform.degrees);
  return new THREE.Matrix4()
    .makeTranslation(pivot.x, 0, pivot.y)
    .multiply(new THREE.Matrix4().makeRotationY(radians))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, 0, -pivot.y));
}

export function applyPlanTransform(
  point: THREE.Vector3,
  transform: PlanTransform,
): THREE.Vector3 {
  return point.clone().applyMatrix4(createPlanTransformMatrix(transform));
}

function surfaceFrame(siteToWorld: THREE.Matrix4, surface: WalkSurfaceDescriptor): CollisionFrame {
  return frameFromMatrix(siteToWorld.clone().multiply(createPlanTransformMatrix(surface.transform)));
}

function cloneBounds(bounds: SiteBounds): SiteBounds {
  return Object.freeze({ x1: bounds.x1, x2: bounds.x2, y1: bounds.y1, y2: bounds.y2 });
}

function wall(
  id: string,
  frame: CollisionFrame,
  bounds: SiteBounds,
  minimumElevation: number,
  maximumElevation: number,
): SolidCollisionProxy {
  return Object.freeze({
    id,
    kind: 'solid',
    frame,
    bounds: cloneBounds(bounds),
    minimumElevation,
    maximumElevation,
  });
}

function createBuildingPerimeter(
  source: WalkthroughSource,
  siteFrame: CollisionFrame,
): SolidCollisionProxy[] {
  const building = source.entities['BLDG-01'].bounds;
  const entrance = source.openings.find(({ id }) => id === 'main-entrance')?.bounds;
  if (!entrance) throw new TypeError('Main entrance bounds are required for collision proxies.');
  const halfWall = WALL_THICKNESS / 2;
  const l2Elevation = source.surfaces.find(({ id }) => id === 'l2-floor')?.elevation;
  if (l2Elevation === undefined) throw new TypeError('L2 floor is required for perimeter collision.');
  const maximumElevation = l2Elevation - 0.05;
  const walls: SolidCollisionProxy[] = [
    wall('building-y0-left', siteFrame, {
      x1: building.x1 - halfWall,
      x2: entrance.x1,
      y1: building.y1 - halfWall,
      y2: building.y1 + halfWall,
    }, 0, maximumElevation),
    wall('building-y0-right', siteFrame, {
      x1: entrance.x2,
      x2: building.x2 + halfWall,
      y1: building.y1 - halfWall,
      y2: building.y1 + halfWall,
    }, 0, maximumElevation),
    wall('building-y14', siteFrame, {
      x1: building.x1 - halfWall,
      x2: building.x2 + halfWall,
      y1: building.y2 - halfWall,
      y2: building.y2 + halfWall,
    }, 0, maximumElevation),
    wall('building-x-min', siteFrame, {
      x1: building.x1 - halfWall,
      x2: building.x1 + halfWall,
      y1: building.y1 + halfWall,
      y2: building.y2 - halfWall,
    }, 0, maximumElevation),
    wall('building-x-max', siteFrame, {
      x1: building.x2 - halfWall,
      x2: building.x2 + halfWall,
      y1: building.y1 + halfWall,
      y2: building.y2 - halfWall,
    }, 0, maximumElevation),
  ];
  return walls;
}

function createPoolWalls(
  pool: PoolShellDescriptor,
  siteFrame: CollisionFrame,
): SolidCollisionProxy[] {
  const halfWall = WALL_THICKNESS / 2;
  const bottom = pool.rimElevation - pool.deepDepth - 0.2;
  // Stop below the rim so TASK-056 can transition naturally from deck to water.
  const top = pool.rimElevation - 0.04;
  return [
    wall('pool-wall-x-min', siteFrame, {
      x1: pool.bounds.x1 - halfWall,
      x2: pool.bounds.x1 + halfWall,
      y1: pool.bounds.y1,
      y2: pool.bounds.y2,
    }, bottom, top),
    wall('pool-wall-x-max', siteFrame, {
      x1: pool.bounds.x2 - halfWall,
      x2: pool.bounds.x2 + halfWall,
      y1: pool.bounds.y1,
      y2: pool.bounds.y2,
    }, bottom, top),
    wall('pool-wall-y-min', siteFrame, {
      x1: pool.bounds.x1,
      x2: pool.bounds.x2,
      y1: pool.bounds.y1 - halfWall,
      y2: pool.bounds.y1 + halfWall,
    }, bottom, top),
    wall('pool-wall-y-max', siteFrame, {
      x1: pool.bounds.x1,
      x2: pool.bounds.x2,
      y1: pool.bounds.y2 - halfWall,
      y2: pool.bounds.y2 + halfWall,
    }, bottom, top),
  ];
}

function createStairSides(
  stair: StairRampDescriptor,
  siteFrame: CollisionFrame,
): SolidCollisionProxy[] {
  const halfWall = WALL_THICKNESS / 2;
  return [
    wall(`${stair.entityId}-side-y-min`, siteFrame, {
      x1: stair.bounds.x1,
      x2: stair.bounds.x2,
      y1: stair.bounds.y1 - halfWall,
      y2: stair.bounds.y1 + halfWall,
    }, stair.lowerElevation, stair.upperElevation + 1.2),
    wall(`${stair.entityId}-side-y-max`, siteFrame, {
      x1: stair.bounds.x1,
      x2: stair.bounds.x2,
      y1: stair.bounds.y2 - halfWall,
      y2: stair.bounds.y2 + halfWall,
    }, stair.lowerElevation, stair.upperElevation + 1.2),
  ];
}

export function createCollisionProxies(
  source: WalkthroughSource,
  siteToWorld: THREE.Matrix4,
): CollisionProxySet {
  const siteFrame = frameFromMatrix(siteToWorld);
  const poolBounds = new Map<string, SiteBounds>(
    source.poolShells.map((pool) => [pool.entityId, pool.bounds]),
  );
  const grounds: GroundCollisionProxy[] = source.surfaces.map((surface) => {
    const exclusionBounds = surface.exclusions.map((entityId) => {
      const bounds = poolBounds.get(entityId);
      if (!bounds) throw new TypeError(`Collision surface exclusion is unknown: ${entityId}`);
      return cloneBounds(bounds);
    });
    if (surface.id === 'site-ground') {
      // The building has its own elevated deck and pool-bottom supports; leaving
      // the site plane under it would create an invisible floor across the pool.
      exclusionBounds.push(cloneBounds(source.entities['BLDG-01'].bounds));
    }
    const proxyBounds = surface.id === 'site-ground'
      ? {
          x1: surface.bounds.x1 - SITE_GROUND_MARGIN,
          x2: surface.bounds.x2 + SITE_GROUND_MARGIN,
          y1: surface.bounds.y1 - SITE_GROUND_MARGIN,
          y2: surface.bounds.y2 + SITE_GROUND_MARGIN,
        }
      : surface.bounds;
    return Object.freeze({
      id: surface.id,
      kind: 'surface' as const,
      frame: surfaceFrame(siteToWorld, surface),
      bounds: cloneBounds(proxyBounds),
      elevation: surface.elevation,
      exclusions: Object.freeze(exclusionBounds),
    });
  });
  grounds.push(...source.stairs.map((descriptor) => Object.freeze({
    id: descriptor.id,
    kind: 'stair' as const,
    frame: siteFrame,
    descriptor,
  })));
  grounds.push(...source.poolShells.map((descriptor) => Object.freeze({
    id: `${descriptor.id}-bottom`,
    kind: 'pool-bottom' as const,
    frame: siteFrame,
    descriptor,
  })));

  const solids = [
    ...createBuildingPerimeter(source, siteFrame),
    ...source.poolShells.flatMap((pool) => createPoolWalls(pool, siteFrame)),
    ...source.stairs.flatMap((stair) => createStairSides(stair, siteFrame)),
  ];

  return Object.freeze({
    siteFrame,
    grounds: Object.freeze(grounds),
    solids: Object.freeze(solids),
  });
}
