import type * as THREE from 'three';

export type VisualDetailLevel = 'essential' | 'reduced' | 'full';

export function markVisualDetail<T extends THREE.Object3D>(
  object: T,
  minimumLevel: VisualDetailLevel,
): T {
  object.userData = {
    ...object.userData,
    visualOnly: true,
    collisionExcluded: true,
    minimumVisualDetail: minimumLevel,
  };
  object.visible = minimumLevel === 'essential';
  return object;
}
