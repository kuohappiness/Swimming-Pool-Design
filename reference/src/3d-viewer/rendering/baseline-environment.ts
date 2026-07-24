import * as THREE from 'three';
import type { EnvironmentId } from '../scenes';
import type { EnvironmentEffect, EnvironmentTarget } from './contracts';
import type { RenderQualityProfile } from './quality-profile';

const ENVIRONMENTS: Record<EnvironmentId, {
  background: number;
  fog: number;
  sun: number;
  ambient: number;
  sunPosition: [number, number, number];
}> = {
  day: { background: 0xe9eef0, fog: 0xe9eef0, sun: 3.4, ambient: 2.2, sunPosition: [-18, 32, 22] },
  'winter-light': { background: 0xe8edf2, fog: 0xe8edf2, sun: 4.2, ambient: 1.7, sunPosition: [-24, 11, 9] },
  rain: { background: 0x9aaab2, fog: 0x9aaab2, sun: 1.2, ambient: 2.6, sunPosition: [-8, 18, 12] },
  soft: { background: 0xe8e3da, fog: 0xe8e3da, sun: 2.5, ambient: 2.4, sunPosition: [12, 25, -14] },
};

export class BaselineEnvironmentEffect implements EnvironmentEffect {
  readonly id = 'baseline-environment';

  apply(environment: EnvironmentId, target: EnvironmentTarget) {
    const settings = ENVIRONMENTS[environment];
    target.scene.background = new THREE.Color(settings.background);
    target.scene.fog = new THREE.Fog(settings.fog, 65, 135);
    target.lights.sun.intensity = settings.sun;
    target.lights.ambient.intensity = settings.ambient;
    target.lights.sun.position.set(...settings.sunPosition);
  }

  setQuality(_profile: RenderQualityProfile) {}

  dispose() {}
}
