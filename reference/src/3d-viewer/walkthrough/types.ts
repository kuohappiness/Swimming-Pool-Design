import type { ViewerModel } from '../model-adapter.js';

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T
    : T extends readonly (infer Item)[] ? readonly DeepReadonly<Item>[]
      : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T;

export type ReadonlyViewerModel = DeepReadonly<ViewerModel>;
export type SiteCoordinateSystemId = 'SITE-XY';

export interface SiteBounds {
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

export interface SitePoint {
  readonly x: number;
  readonly y: number;
}

export interface WalkthroughIdentity {
  readonly schemaVersion: '1.0.0';
  readonly modelVersion: string;
  readonly revision: string;
  readonly activeGeometryRevisionId: string;
  readonly sourceModelHash: string;
}

export interface WalkthroughReferenceFrame {
  readonly coordinateSystemId: SiteCoordinateSystemId;
  readonly adapterId: 'SITE-XYZ-TO-THREE-RH';
  readonly siteX: 'threeX';
  readonly siteY: 'negativeThreeZ';
  readonly siteZ: 'threeY';
  readonly worldBearingDegrees: number;
}

export interface WalkthroughEntityDescriptor {
  readonly entityId: string;
  readonly coordinateSystemId: SiteCoordinateSystemId;
  readonly bounds: SiteBounds;
}

export interface FixedPlanTransform {
  readonly kind: 'fixed';
}

export interface RotatedPlanTransform {
  readonly kind: 'rotate-around-pivot';
  readonly degrees: number;
  readonly pivot: SitePoint;
}

export type PlanTransform = FixedPlanTransform | RotatedPlanTransform;

export interface WalkSurfaceDescriptor {
  readonly id: string;
  readonly kind: 'walk-surface';
  readonly entityId: string;
  readonly coordinateSystemId: SiteCoordinateSystemId;
  readonly bounds: SiteBounds;
  readonly elevation: number;
  readonly transform: PlanTransform;
  readonly exclusions: readonly string[];
}

export interface StairRampDescriptor {
  readonly id: string;
  readonly kind: 'stair-ramp';
  readonly entityId: 'ST-01' | 'ST-02';
  readonly coordinateSystemId: SiteCoordinateSystemId;
  readonly bounds: SiteBounds;
  readonly axis: '+x';
  readonly lowerElevation: number;
  readonly midLandingElevation: number;
  readonly upperElevation: number;
  readonly flightRun: number;
  readonly midLandingLength: number;
  readonly upperLandingLength: number;
  readonly transform: FixedPlanTransform;
}

export interface PoolShellDescriptor {
  readonly id: 'main-pool-shell';
  readonly kind: 'pool-shell';
  readonly entityId: 'POOL-01';
  readonly coordinateSystemId: SiteCoordinateSystemId;
  readonly bounds: SiteBounds;
  readonly rimElevation: number;
  readonly shallowEndX: number;
  readonly deepEndX: number;
  readonly shallowDepth: number;
  readonly deepDepth: number;
  readonly bottomProfile: 'linear-x-slope';
}

export interface OpeningDescriptor {
  readonly id: string;
  readonly kind: 'opening';
  readonly entityId: string;
  readonly level: 'l1' | 'l2';
  readonly side: string;
  readonly clearWidth: number;
  readonly clearHeight: number | null;
  readonly heightStatus: 'canonical-working' | 'unresolved';
  readonly centre?: SitePoint;
  readonly bounds?: SiteBounds;
}

export type CollisionDescriptor =
  | WalkSurfaceDescriptor
  | StairRampDescriptor
  | PoolShellDescriptor
  | OpeningDescriptor;

export interface WaterVolumeDescriptor {
  readonly id: 'main-pool-water';
  readonly kind: 'water-volume';
  readonly entityId: 'POOL-01';
  readonly coordinateSystemId: SiteCoordinateSystemId;
  readonly bounds: SiteBounds;
  readonly surfaceElevation: number;
  readonly shallowEndX: number;
  readonly deepEndX: number;
  readonly shallowDepth: number;
  readonly deepDepth: number;
  readonly bottomProfile: 'linear-x-slope';
}

export type SpawnElevationRole =
  | 'site-ground'
  | 'pool-deck'
  | 'l2-floor'
  | 'l3-floor'
  | 'roof-surface';

export interface SpawnDescriptor {
  readonly id:
    | 'entrance'
    | 'l1-pool-deck'
    | 'l2-arrival'
    | 'l3-arrival'
    | 'l3-terrace'
    | 'roof-inspection';
  readonly entityId: string;
  readonly coordinateSystemId: SiteCoordinateSystemId;
  readonly normalizedAnchor: SitePoint;
  readonly siteOffset: { readonly x: number; readonly y: number; readonly z: number };
  readonly elevationRole: SpawnElevationRole;
  readonly facingEntityId?: string;
}

export type MovementMode =
  | 'walking'
  | 'falling'
  | 'swimming-surface'
  | 'swimming-underwater'
  | 'teleporting'
  | 'recovering';

export interface MovementIntent {
  readonly moveX: number;
  readonly moveZ: number;
  readonly lookYaw: number;
  readonly lookPitch: number;
  readonly ascend: number;
  readonly descend: number;
  readonly fast: boolean;
  readonly exitRequested: boolean;
}

export interface WalkthroughCapabilities {
  readonly inspectModePreserved: true;
  readonly desktopInput: true;
  readonly touchInput: true;
  readonly walking: true;
  readonly stairTraversal: true;
  readonly areaJump: true;
  readonly surfaceSwimming: true;
  readonly underwaterSwimming: true;
  readonly futureVisualAssetAdapter: true;
}

export interface WalkthroughSource {
  readonly identity: WalkthroughIdentity;
  readonly referenceFrame: WalkthroughReferenceFrame;
  readonly entities: Readonly<Record<string, WalkthroughEntityDescriptor>>;
  readonly surfaces: readonly WalkSurfaceDescriptor[];
  readonly stairs: readonly StairRampDescriptor[];
  readonly poolShells: readonly PoolShellDescriptor[];
  readonly openings: readonly OpeningDescriptor[];
  readonly waterVolumes: readonly WaterVolumeDescriptor[];
  readonly spawns: readonly SpawnDescriptor[];
  readonly capabilities: WalkthroughCapabilities;
}

export interface WalkthroughConfig {
  readonly schemaVersion: '1.0.0';
  readonly player: {
    readonly eyeHeight: number;
    readonly capsuleRadius: number;
    readonly walkSpeed: number;
    readonly fastWalkSpeed: number;
    readonly maxPitchDegrees: number;
  };
  readonly physics: {
    readonly gravity: number;
    readonly fixedStepSeconds: number;
    readonly maxFrameDeltaSeconds: number;
    readonly maxSubsteps: number;
  };
  readonly swimming: {
    readonly surfaceSwimSpeed: number;
    readonly underwaterSwimSpeed: number;
    readonly verticalSwimSpeed: number;
    readonly waterlineHysteresis: number;
  };
  readonly recovery: {
    readonly minimumWorldElevation: number;
    readonly maximumResolveIterations: number;
  };
}
