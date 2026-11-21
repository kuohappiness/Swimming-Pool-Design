import * as THREE from 'three';
import type { EnvironmentId } from '../../scenes';

export interface ToneMappingProfile {
  readonly environmentId: EnvironmentId;
  readonly toneMapping: THREE.ToneMapping;
  readonly exposure: number;
  readonly outputColorSpace: THREE.ColorSpace;
}

export const TONE_MAPPING_PROFILES: Readonly<Record<EnvironmentId, ToneMappingProfile>> =
  Object.freeze({
    day: Object.freeze({
      environmentId: 'day',
      toneMapping: THREE.ACESFilmicToneMapping,
      exposure: 0.9,
      outputColorSpace: THREE.SRGBColorSpace,
    }),
    'winter-light': Object.freeze({
      environmentId: 'winter-light',
      toneMapping: THREE.ACESFilmicToneMapping,
      exposure: 0.96,
      outputColorSpace: THREE.SRGBColorSpace,
    }),
    rain: Object.freeze({
      environmentId: 'rain',
      toneMapping: THREE.ACESFilmicToneMapping,
      exposure: 0.76,
      outputColorSpace: THREE.SRGBColorSpace,
    }),
    soft: Object.freeze({
      environmentId: 'soft',
      toneMapping: THREE.ACESFilmicToneMapping,
      exposure: 0.84,
      outputColorSpace: THREE.SRGBColorSpace,
    }),
  });

export function getToneMappingProfile(environmentId: EnvironmentId): ToneMappingProfile {
  const profile = TONE_MAPPING_PROFILES[environmentId];
  if (!profile) throw new TypeError(`Tone mapping environment is unknown: ${environmentId}`);
  return profile;
}
