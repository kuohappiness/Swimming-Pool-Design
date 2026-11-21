import * as THREE from 'three';
import type { PlayerVector } from '../player-controller.js';
import type { WalkthroughConfig, WalkthroughSource } from '../types.js';
import {
  createCollisionProxies,
  type CollisionProxySet,
  type GroundCollisionProxy,
  type SolidCollisionProxy,
} from './collision-proxies.js';

export interface CapsuleResolution {
  readonly position: PlayerVector;
  readonly contacts: readonly string[];
  readonly iterations: number;
  readonly unresolved: boolean;
}

const EPSILON = 1e-6;

function insideBounds(x: number, z: number, bounds: { x1: number; x2: number; y1: number; y2: number }) {
  return x >= bounds.x1 - EPSILON
    && x <= bounds.x2 + EPSILON
    && z >= bounds.y1 - EPSILON
    && z <= bounds.y2 + EPSILON;
}

function stairHeight(proxy: Extract<GroundCollisionProxy, { kind: 'stair' }>, localX: number) {
  const stair = proxy.descriptor;
  const distance = localX - stair.bounds.x1;
  const firstFlightEnd = stair.flightRun;
  const landingEnd = firstFlightEnd + stair.midLandingLength;
  const secondFlightEnd = landingEnd + stair.flightRun;
  if (distance <= firstFlightEnd) {
    return stair.lowerElevation
      + (stair.midLandingElevation - stair.lowerElevation) * Math.max(0, distance / stair.flightRun);
  }
  if (distance <= landingEnd) return stair.midLandingElevation;
  if (distance <= secondFlightEnd) {
    return stair.midLandingElevation
      + (stair.upperElevation - stair.midLandingElevation)
      * ((distance - landingEnd) / stair.flightRun);
  }
  return stair.upperElevation;
}

function sampleGround(proxy: GroundCollisionProxy, worldPosition: THREE.Vector3): number | null {
  const local = worldPosition.clone().applyMatrix4(proxy.frame.worldToLocal);
  if (proxy.kind === 'surface') {
    if (!insideBounds(local.x, local.z, proxy.bounds)) return null;
    if (proxy.exclusions.some((bounds) => insideBounds(local.x, local.z, bounds))) return null;
    return new THREE.Vector3(local.x, proxy.elevation, local.z)
      .applyMatrix4(proxy.frame.localToWorld).y;
  }
  if (!insideBounds(local.x, local.z, proxy.descriptor.bounds)) return null;
  if (proxy.kind === 'stair') {
    return new THREE.Vector3(local.x, stairHeight(proxy, local.x), local.z)
      .applyMatrix4(proxy.frame.localToWorld).y;
  }
  const pool = proxy.descriptor;
  const ratio = Math.max(0, Math.min(1, (local.x - pool.shallowEndX) / (pool.deepEndX - pool.shallowEndX)));
  const depth = pool.shallowDepth + (pool.deepDepth - pool.shallowDepth) * ratio;
  return new THREE.Vector3(local.x, pool.waterSurfaceElevation - depth, local.z)
    .applyMatrix4(proxy.frame.localToWorld).y;
}

function verticalOverlap(
  proxy: SolidCollisionProxy,
  worldPosition: THREE.Vector3,
  eyeHeight: number,
  radius: number,
) {
  const localFoot = new THREE.Vector3(
    worldPosition.x,
    worldPosition.y - eyeHeight,
    worldPosition.z,
  ).applyMatrix4(proxy.frame.worldToLocal);
  const localHead = new THREE.Vector3(
    worldPosition.x,
    worldPosition.y + radius,
    worldPosition.z,
  ).applyMatrix4(proxy.frame.worldToLocal);
  const minimum = Math.min(localFoot.y, localHead.y);
  const maximum = Math.max(localFoot.y, localHead.y);
  return maximum > proxy.minimumElevation + EPSILON
    && minimum < proxy.maximumElevation - EPSILON;
}

function resolveCircleAgainstBounds(
  local: THREE.Vector3,
  radius: number,
  bounds: { x1: number; x2: number; y1: number; y2: number },
) {
  const nearestX = Math.max(bounds.x1, Math.min(bounds.x2, local.x));
  const nearestZ = Math.max(bounds.y1, Math.min(bounds.y2, local.z));
  const deltaX = local.x - nearestX;
  const deltaZ = local.z - nearestZ;
  const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (distanceSquared >= radius * radius - EPSILON) return false;

  if (distanceSquared > EPSILON) {
    const distance = Math.sqrt(distanceSquared);
    const push = radius - distance;
    local.x += deltaX / distance * push;
    local.z += deltaZ / distance * push;
    return true;
  }

  const candidates = [
    { distance: Math.abs(local.x - bounds.x1), x: bounds.x1 - radius, z: local.z },
    { distance: Math.abs(bounds.x2 - local.x), x: bounds.x2 + radius, z: local.z },
    { distance: Math.abs(local.z - bounds.y1), x: local.x, z: bounds.y1 - radius },
    { distance: Math.abs(bounds.y2 - local.z), x: local.x, z: bounds.y2 + radius },
  ].sort((left, right) => left.distance - right.distance);
  local.x = candidates[0].x;
  local.z = candidates[0].z;
  return true;
}

function overlapsSolid(
  proxy: SolidCollisionProxy,
  worldPosition: THREE.Vector3,
  eyeHeight: number,
  radius: number,
) {
  if (!verticalOverlap(proxy, worldPosition, eyeHeight, radius)) return false;
  const local = worldPosition.clone().applyMatrix4(proxy.frame.worldToLocal);
  const nearestX = Math.max(proxy.bounds.x1, Math.min(proxy.bounds.x2, local.x));
  const nearestZ = Math.max(proxy.bounds.y1, Math.min(proxy.bounds.y2, local.z));
  return (local.x - nearestX) ** 2 + (local.z - nearestZ) ** 2 < radius ** 2 - EPSILON;
}

export class CollisionWorld {
  readonly proxies: CollisionProxySet;
  private readonly config: WalkthroughConfig;

  constructor(
    source: WalkthroughSource,
    siteToWorld: THREE.Matrix4,
    config: WalkthroughConfig,
  ) {
    this.proxies = createCollisionProxies(source, siteToWorld);
    this.config = config;
  }

  sitePointToWorld(point: PlayerVector): PlayerVector {
    const world = new THREE.Vector3(point.x, point.y, point.z)
      .applyMatrix4(this.proxies.siteFrame.localToWorld);
    return { x: world.x, y: world.y, z: world.z };
  }

  worldPointToSite(point: PlayerVector): PlayerVector {
    const site = new THREE.Vector3(point.x, point.y, point.z)
      .applyMatrix4(this.proxies.siteFrame.worldToLocal);
    return { x: site.x, y: site.y, z: site.z };
  }

  getGroundHeight(position: PlayerVector, maximumElevation = Number.POSITIVE_INFINITY): number | null {
    const worldPosition = new THREE.Vector3(position.x, position.y, position.z);
    let best: number | null = null;
    for (const proxy of this.proxies.grounds) {
      const candidate = sampleGround(proxy, worldPosition);
      if (candidate === null || candidate > maximumElevation + EPSILON) continue;
      if (best === null || candidate > best) best = candidate;
    }
    return best;
  }

  resolveCapsule(position: PlayerVector): CapsuleResolution {
    let worldPosition = new THREE.Vector3(position.x, position.y, position.z);
    const contacts = new Set<string>();
    let iterations = 0;
    for (; iterations < this.config.recovery.maximumResolveIterations; iterations += 1) {
      let changed = false;
      for (const proxy of this.proxies.solids) {
        if (!verticalOverlap(
          proxy,
          worldPosition,
          this.config.player.eyeHeight,
          this.config.player.capsuleRadius,
        )) continue;
        const local = worldPosition.clone().applyMatrix4(proxy.frame.worldToLocal);
        if (!resolveCircleAgainstBounds(local, this.config.player.capsuleRadius, proxy.bounds)) continue;
        worldPosition = local.applyMatrix4(proxy.frame.localToWorld);
        contacts.add(proxy.id);
        changed = true;
      }
      if (!changed) break;
    }
    const unresolved = this.proxies.solids.some((proxy) => overlapsSolid(
      proxy,
      worldPosition,
      this.config.player.eyeHeight,
      this.config.player.capsuleRadius,
    ));
    return {
      position: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
      contacts: [...contacts],
      iterations,
      unresolved,
    };
  }

  isCapsuleClear(position: PlayerVector) {
    const worldPosition = new THREE.Vector3(position.x, position.y, position.z);
    return this.proxies.solids.every((proxy) => !overlapsSolid(
      proxy,
      worldPosition,
      this.config.player.eyeHeight,
      this.config.player.capsuleRadius,
    ));
  }

  isSupported(position: PlayerVector, tolerance = 0.08) {
    const footElevation = position.y - this.config.player.eyeHeight;
    const ground = this.getGroundHeight(position, footElevation + tolerance);
    return ground !== null && Math.abs(ground - footElevation) <= tolerance;
  }
}
