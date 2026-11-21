import type { DeepReadonly, WalkthroughConfig } from './types.js';

function deepFreezeConfig<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreezeConfig(nested);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export const WALKTHROUGH_CONFIG = deepFreezeConfig({
  schemaVersion: '1.0.0',
  player: {
    eyeHeight: 1.65,
    capsuleRadius: 0.28,
    walkSpeed: 1.4,
    fastWalkSpeed: 2.8,
    maxPitchDegrees: 85,
  },
  physics: {
    gravity: 9.81,
    fixedStepSeconds: 1 / 120,
    maxFrameDeltaSeconds: 0.1,
    maxSubsteps: 8,
  },
  swimming: {
    surfaceSwimSpeed: 1.1,
    underwaterSwimSpeed: 1,
    verticalSwimSpeed: 0.8,
    waterlineHysteresis: 0.08,
  },
  recovery: {
    minimumWorldElevation: -8,
    maximumResolveIterations: 8,
  },
} satisfies WalkthroughConfig);
