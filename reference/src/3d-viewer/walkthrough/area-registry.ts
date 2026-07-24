import type { SafeSpawnRegistry } from './collision/safe-spawn-registry.js';
import type { PlayerState, PlayerVector } from './player-controller.js';
import type { SpawnDescriptor } from './types.js';

export interface WalkthroughArea {
  readonly id: SpawnDescriptor['id'];
  readonly label: string;
}

export interface AreaRegistry {
  readonly id: string;
  readonly areas: readonly WalkthroughArea[];
  get(id: SpawnDescriptor['id']): WalkthroughArea;
  nearest(position: PlayerVector): WalkthroughArea;
  activate(state: PlayerState, id: SpawnDescriptor['id']): WalkthroughArea;
}

const AREA_LABELS: Readonly<Record<SpawnDescriptor['id'], string>> = Object.freeze({
  entrance: '入口前場',
  'l1-pool-deck': '一樓池畔',
  'l2-arrival': '二樓到達',
  'l3-arrival': '三樓到達',
  'l3-terrace': '三樓露台',
  'roof-inspection': '屋頂檢查區',
});

export class SafeSpawnAreaRegistry implements AreaRegistry {
  readonly id = 'semantic-safe-spawn-areas';
  readonly areas: readonly WalkthroughArea[];
  private readonly safeSpawns: SafeSpawnRegistry;
  private readonly byId = new Map<SpawnDescriptor['id'], WalkthroughArea>();

  constructor(safeSpawns: SafeSpawnRegistry) {
    this.safeSpawns = safeSpawns;
    this.areas = Object.freeze(safeSpawns.ids.map((id) => {
      const area = Object.freeze({ id, label: AREA_LABELS[id] });
      this.byId.set(id, area);
      return area;
    }));
  }

  get(id: SpawnDescriptor['id']) {
    const area = this.byId.get(id);
    if (!area) throw new TypeError(`Walkthrough area does not exist: ${id}`);
    return area;
  }

  nearest(position: PlayerVector) {
    return this.get(this.safeSpawns.nearest(position).id);
  }

  activate(state: PlayerState, id: SpawnDescriptor['id']) {
    const area = this.get(id);
    const spawn = this.safeSpawns.get(id);
    state.position = { ...spawn.position };
    state.velocity = { x: 0, y: 0, z: 0 };
    state.movementMode = 'teleporting';
    state.grounded = true;
    return area;
  }
}
