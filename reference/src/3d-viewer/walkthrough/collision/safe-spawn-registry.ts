import * as THREE from 'three';
import type { PlayerVector } from '../player-controller.js';
import type {
  PlanTransform,
  SpawnDescriptor,
  SpawnElevationRole,
  WalkSurfaceDescriptor,
  WalkthroughConfig,
  WalkthroughSource,
} from '../types.js';
import { applyPlanTransform } from './collision-proxies.js';
import type { CollisionWorld } from './collision-world.js';

export interface ResolvedSafeSpawn {
  readonly id: SpawnDescriptor['id'];
  readonly entityId: string;
  readonly position: PlayerVector;
  readonly elevationRole: SpawnElevationRole;
}

const FIXED_TRANSFORM: PlanTransform = Object.freeze({ kind: 'fixed' });

export class SafeSpawnRegistry {
  private readonly spawns = new Map<SpawnDescriptor['id'], ResolvedSafeSpawn>();

  constructor(
    source: WalkthroughSource,
    collisionWorld: CollisionWorld,
    config: WalkthroughConfig,
  ) {
    for (const descriptor of source.spawns) {
      const entity = source.entities[descriptor.entityId];
      if (!entity) throw new TypeError(`Safe spawn entity is missing: ${descriptor.entityId}`);
      const surface = this.resolveSurface(source, descriptor);
      const sitePoint = applyPlanTransform(new THREE.Vector3(
        entity.bounds.x1
          + (entity.bounds.x2 - entity.bounds.x1) * descriptor.normalizedAnchor.x
          + descriptor.siteOffset.x,
        surface.elevation + descriptor.siteOffset.z + config.player.eyeHeight,
        entity.bounds.y1
          + (entity.bounds.y2 - entity.bounds.y1) * descriptor.normalizedAnchor.y
          + descriptor.siteOffset.y,
      ), surface.transform);
      const position = collisionWorld.sitePointToWorld({
        x: sitePoint.x,
        y: sitePoint.y,
        z: sitePoint.z,
      });
      if (!collisionWorld.isCapsuleClear(position) || !collisionWorld.isSupported(position)) {
        throw new TypeError(`Safe spawn is not clear and supported: ${descriptor.id}`);
      }
      this.spawns.set(descriptor.id, Object.freeze({
        id: descriptor.id,
        entityId: descriptor.entityId,
        position: Object.freeze({ ...position }),
        elevationRole: descriptor.elevationRole,
      }));
    }
  }

  get ids(): readonly SpawnDescriptor['id'][] {
    return [...this.spawns.keys()];
  }

  get(id: SpawnDescriptor['id']): ResolvedSafeSpawn {
    const spawn = this.spawns.get(id);
    if (!spawn) throw new TypeError(`Safe spawn does not exist: ${id}`);
    return spawn;
  }

  nearest(position: PlayerVector): ResolvedSafeSpawn {
    let nearest: ResolvedSafeSpawn | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const spawn of this.spawns.values()) {
      const distance = (spawn.position.x - position.x) ** 2
        + (spawn.position.y - position.y) ** 2
        + (spawn.position.z - position.z) ** 2;
      if (distance < nearestDistance) {
        nearest = spawn;
        nearestDistance = distance;
      }
    }
    if (!nearest) throw new TypeError('Safe spawn registry is empty.');
    return nearest;
  }

  private resolveSurface(
    source: WalkthroughSource,
    spawn: SpawnDescriptor,
  ): Pick<WalkSurfaceDescriptor, 'elevation' | 'transform'> {
    const byId = (id: string) => source.surfaces.find((surface) => surface.id === id);
    const surface = {
      'site-ground': () => byId('site-ground'),
      'pool-deck': () => byId('l1-pool-deck'),
      'l2-floor': () => byId('l2-floor'),
      'l3-floor': () => source.surfaces.find(({ entityId }) => entityId === spawn.entityId)
        ?? byId('l3-rotated-floor'),
      'roof-surface': () => byId('roof-inspection'),
    }[spawn.elevationRole]();
    if (!surface) throw new TypeError(`Safe spawn elevation role has no surface: ${spawn.elevationRole}`);
    return surface ?? { elevation: 0, transform: FIXED_TRANSFORM };
  }
}
