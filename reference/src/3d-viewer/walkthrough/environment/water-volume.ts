import * as THREE from 'three';
import type { PlayerVector } from '../player-controller.js';
import type {
  PoolShellDescriptor,
  WaterVolumeDescriptor,
} from '../types.js';

export interface WaterlineState {
  readonly horizontal: boolean;
  readonly bodySubmerged: boolean;
  readonly eyeSubmerged: boolean;
  readonly surfaceElevation: number;
  readonly bottomElevation: number;
}

export class WaterVolume {
  readonly id: WaterVolumeDescriptor['id'];
  readonly descriptor: WaterVolumeDescriptor;
  readonly poolShell: PoolShellDescriptor;
  private readonly siteToWorld: THREE.Matrix4;
  private readonly worldToSite: THREE.Matrix4;

  constructor(
    descriptor: WaterVolumeDescriptor,
    poolShell: PoolShellDescriptor,
    siteToWorld: THREE.Matrix4,
  ) {
    if (descriptor.entityId !== poolShell.entityId
      || descriptor.surfaceElevation !== poolShell.waterSurfaceElevation) {
      throw new TypeError('Water volume and pool shell must share one entity and water surface.');
    }
    this.id = descriptor.id;
    this.descriptor = descriptor;
    this.poolShell = poolShell;
    this.siteToWorld = siteToWorld.clone();
    this.worldToSite = siteToWorld.clone().invert();
  }

  worldPointToSite(position: PlayerVector): PlayerVector {
    const site = new THREE.Vector3(position.x, position.y, position.z)
      .applyMatrix4(this.worldToSite);
    return { x: site.x, y: site.y, z: site.z };
  }

  sitePointToWorld(position: PlayerVector): PlayerVector {
    const world = new THREE.Vector3(position.x, position.y, position.z)
      .applyMatrix4(this.siteToWorld);
    return { x: world.x, y: world.y, z: world.z };
  }

  get surfaceWorldElevation() {
    return this.sitePointToWorld({
      x: this.descriptor.bounds.x1,
      y: this.descriptor.surfaceElevation,
      z: this.descriptor.bounds.y1,
    }).y;
  }

  depthAtSiteX(siteX: number) {
    const ratio = Math.max(0, Math.min(
      1,
      (siteX - this.descriptor.shallowEndX)
        / (this.descriptor.deepEndX - this.descriptor.shallowEndX),
    ));
    return this.descriptor.shallowDepth
      + (this.descriptor.deepDepth - this.descriptor.shallowDepth) * ratio;
  }

  bottomWorldElevation(position: PlayerVector) {
    const site = this.worldPointToSite(position);
    return this.sitePointToWorld({
      x: site.x,
      y: this.descriptor.surfaceElevation - this.depthAtSiteX(site.x),
      z: site.z,
    }).y;
  }

  containsHorizontal(position: PlayerVector, inset = 0) {
    const site = this.worldPointToSite(position);
    return site.x >= this.descriptor.bounds.x1 + inset
      && site.x <= this.descriptor.bounds.x2 - inset
      && site.z >= this.descriptor.bounds.y1 + inset
      && site.z <= this.descriptor.bounds.y2 - inset;
  }

  stateAt(
    position: PlayerVector,
    eyeHeight: number,
    hysteresis: number,
  ): WaterlineState {
    const site = this.worldPointToSite(position);
    const horizontal = this.containsHorizontal(position);
    const bottomElevation = this.bottomWorldElevation(position);
    const bodyCentre = position.y - eyeHeight * 0.5;
    return {
      horizontal,
      bodySubmerged: horizontal
        && bodyCentre <= this.surfaceWorldElevation - hysteresis
        && position.y >= bottomElevation,
      eyeSubmerged: horizontal && position.y <= this.surfaceWorldElevation - hysteresis,
      surfaceElevation: this.surfaceWorldElevation,
      bottomElevation,
    };
  }

  assistedClimbTarget(
    position: PlayerVector,
    eyeHeight: number,
    capsuleRadius: number,
    maximumEdgeDistance = 0.72,
  ): PlayerVector | null {
    if (!this.containsHorizontal(position)) return null;
    const site = this.worldPointToSite(position);
    const bounds = this.descriptor.bounds;
    const edges = [
      { distance: site.x - bounds.x1, x: bounds.x1 - capsuleRadius - 0.12, z: site.z },
      { distance: bounds.x2 - site.x, x: bounds.x2 + capsuleRadius + 0.12, z: site.z },
      { distance: site.z - bounds.y1, x: site.x, z: bounds.y1 - capsuleRadius - 0.12 },
      { distance: bounds.y2 - site.z, x: site.x, z: bounds.y2 + capsuleRadius + 0.12 },
    ].sort((left, right) => left.distance - right.distance);
    if (edges[0].distance > maximumEdgeDistance) return null;
    return this.sitePointToWorld({
      x: edges[0].x,
      y: this.poolShell.rimElevation + eyeHeight,
      z: edges[0].z,
    });
  }
}
