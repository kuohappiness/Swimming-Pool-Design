import * as THREE from 'three';
import { SUN_ZENITH_INTENSITY, type LinearColor, type SunLighting } from './sun-lighting';

/**
 * 池館的燈具照明（TASK-152 步驟 5）：池廳與 2F 的天花燈、池壁上的水下燈。
 *
 * 燈具的位置來自燈具配置（`fixture-layout.ts`，場景畫的燈具網格用同一份；視覺用、
 * 不是機電設計），光通量是讓池廳平均照度落在學校訓練池常見範圍的估計值。
 * 實際的燈具數量、配置、照度與水下燈的安全電壓仍待機電專業設計（`OPEN-009`）。
 *
 * 燈光沒有陰影貼圖：每一區的燈只照那一區的盒子（池廳的玻璃牆外留一段溢光），
 * 所以不會穿過樓板與實牆照到別的房間。
 */

type Vector3Tuple = readonly [number, number, number];

/** 一盞燈具：SITE 根節點底下的座標（x、高度、SITE-Y，公尺）與光通量（lm）。 */
export interface LightFixture {
  readonly position: Vector3Tuple;
  readonly lumens: number;
}

/** 池壁上的水下燈：朝 `aim`（SITE 根節點座標的水平單位向量，指向池內）打光。 */
export interface PoolLight extends LightFixture {
  readonly aim: Vector3Tuple;
}

export interface FixtureBox {
  readonly min: Vector3Tuple;
  readonly max: Vector3Tuple;
}

/** 一個室內空間的天花燈。燈光在 `inner` 裡全亮，到 `outer` 漸弱為 0。 */
export interface FixtureZone {
  readonly id: string;
  readonly fixtures: readonly LightFixture[];
  readonly inner: FixtureBox;
  readonly outer: FixtureBox;
  /** 地面高程：估計平均照度（室內補光）用的那個面。 */
  readonly floor: number;
  /** 這一區的燈有沒有照到池水（池廳有、2F 沒有）。 */
  readonly reachesWater: boolean;
  /** 場景裡代表這一區的物件；它或上層被藏起來（圖層關掉）時，這一區的燈不亮。 */
  readonly anchorName: string;
  /** 燈具本身的網格（發光面）。 */
  readonly emitterName: string;
}

export interface FixtureLayout {
  readonly zones: readonly FixtureZone[];
  readonly poolLights: readonly PoolLight[];
  /** 水下燈所在的物件（池廳），藏起來時水下燈不亮。 */
  readonly poolLightAnchorName: string;
  /** 水下燈透鏡的半徑（公尺）；水的著色器畫透鏡用。 */
  readonly poolLightLensRadius: number;
}

/** 太陽低於這個仰角（度）時開燈；陰天、雨天整天開著。 */
export const FIXTURES_ON_BELOW_ALTITUDE = 6;

/**
 * 白天的換算：晴天太陽在天頂時，直射光的照度約 100,000 lux，場景裡是 `SUN_ZENITH_INTENSITY`。
 * 白天燈具照度只有日光的幾個百分點，看得到的主要是發光面本身。
 */
const DAYLIGHT_LUX_AT_ZENITH = 100_000;
export const DAY_LUX_SCALE = SUN_ZENITH_INTENSITY / DAYLIGHT_LUX_AT_ZENITH;
/**
 * 夜裡的換算：場景的夜晚比真實的夜晚亮很多（像眼睛適應暗處、像夜景攝影），燈具也乘同樣的放大，
 * 600 lux 在夜裡等於場景的 1。真實的眼睛適應與曝光變化在鏡頭效果那一步（步驟 6）做。
 */
export const NIGHT_LUX_SCALE = 1 / 600;

/** 天花燈：中性偏暖白（約 4000 K），以亮度為 1 正規化的線性色彩。 */
export const CEILING_FIXTURE_COLOR: LinearColor = normaliseLuminance([1, 0.87, 0.72]);
/** 水下燈：冷白（約 5500 K）。 */
export const POOL_LIGHT_COLOR: LinearColor = normaliseLuminance([0.93, 0.98, 1]);

/** 地面（池畔、池水）把燈光反射回天花與牆面的比例；室內補光用，視覺值。 */
const FLOOR_REFLECTANCE = 0.25;
/** 燈具照度相對於室外日光照度在這個範圍內時，照在構件上的燈光由 0 漸變到全亮。 */
const SURFACE_LIGHT_RATIO = Object.freeze({ from: 0.02, to: 0.05 });
/** 燈光的點光源放在發光面下方這個距離（公尺），緊貼燈具的天花不會被照到爆白。 */
const EMITTER_OFFSET = 0.08;
/** 天花燈與水下燈發光面的面積（平方公尺），算發光面亮度用。 */
const CEILING_EMITTER_AREA = 1.25 * 0.32;

/** 每一級畫質每一區最多幾盞（多的就近合併）。 */
const FIXTURE_COUNT_BY_TIER = Object.freeze({ high: 12, medium: 6, low: 3 });
const POOL_LIGHT_COUNT_BY_TIER = Object.freeze({ high: 12, medium: 6, low: 4 });
export type FixtureQualityTier = keyof typeof FIXTURE_COUNT_BY_TIER;

/** 著色器的陣列大小。 */
export const FIXTURE_ZONE_SLOTS = 2;
export const FIXTURE_LIGHT_SLOTS = 24;
export const POOL_LIGHT_SLOTS = 12;

/** 光從空氣進到水裡，大多數角度的穿透率。 */
const AIR_TO_WATER_TRANSMISSION = 0.97;

function normaliseLuminance(color: LinearColor): LinearColor {
  const luminance = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
  return [color[0] / luminance, color[1] / luminance, color[2] / luminance];
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** 燈有沒有開：陰天、雨天整天開；晴天在太陽低於 `FIXTURES_ON_BELOW_ALTITUDE` 時開。 */
export function fixturesSwitchedOn(lighting: SunLighting): boolean {
  return lighting.weather !== 'clear' || lighting.altitude < FIXTURES_ON_BELOW_ALTITUDE;
}

/** 這一刻 1 lux 等於場景的多少。白天到夜裡在對數上隨日光漸變，和曝光一樣是連續的。 */
export function fixtureLuxScale(lighting: SunLighting): number {
  const daylight = Math.min(1, Math.max(0, lighting.factors.daylight));
  return Math.exp(
    Math.log(NIGHT_LUX_SCALE) + (Math.log(DAY_LUX_SCALE) - Math.log(NIGHT_LUX_SCALE)) * daylight,
  );
}

/** 室外水平面的照度（場景單位）：天光加上主光源的垂直分量。 */
export function outdoorIlluminance(lighting: SunLighting): number {
  return lighting.sky.intensity + lighting.key.intensity * Math.max(0, lighting.key.direction.z);
}

/** 朝下的朗伯發光面：光通量換成正下方的光強度（cd）。 */
export function lambertianIntensity(lumens: number): number {
  return lumens / Math.PI;
}

/**
 * 把燈具就近兩兩合併，直到不超過 `maximum` 盞：位置依光通量加權平均，光通量相加。
 * 低畫質用較少盞燈，總光量不變。結果與輸入順序無關（同距離時取編號小的一對）。
 */
export function aggregateFixtures<T extends LightFixture>(
  fixtures: readonly T[],
  maximum: number,
): LightFixture[] | PoolLight[] {
  if (!Number.isInteger(maximum) || maximum < 1)
    throw new RangeError('Fixture maximum must be a positive integer.');
  type Cluster = {
    position: [number, number, number];
    lumens: number;
    aim?: [number, number, number];
  };
  const clusters: Cluster[] = fixtures.map((fixture) => ({
    position: [...fixture.position] as [number, number, number],
    lumens: fixture.lumens,
    ...('aim' in fixture
      ? { aim: [...(fixture as unknown as PoolLight).aim] as [number, number, number] }
      : {}),
  }));
  while (clusters.length > maximum) {
    let best: [number, number] = [0, 1];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let a = 0; a < clusters.length; a += 1) {
      for (let b = a + 1; b < clusters.length; b += 1) {
        const pa = clusters[a].position;
        const pb = clusters[b].position;
        const distance = (pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2 + (pa[2] - pb[2]) ** 2;
        if (distance < bestDistance - 1e-9) {
          bestDistance = distance;
          best = [a, b];
        }
      }
    }
    const [a, b] = best;
    const first = clusters[a];
    const second = clusters[b];
    const lumens = first.lumens + second.lumens;
    const weight = lumens > 0 ? second.lumens / lumens : 0.5;
    const merged: Cluster = {
      position: [0, 1, 2].map(
        (axis) => first.position[axis] + (second.position[axis] - first.position[axis]) * weight,
      ) as [number, number, number],
      lumens,
    };
    if (first.aim && second.aim) {
      const aim = [0, 1, 2].map((axis) => first.aim![axis] + second.aim![axis]) as [
        number,
        number,
        number,
      ];
      const length = Math.hypot(...aim) || 1;
      merged.aim = aim.map((value) => value / length) as [number, number, number];
    }
    clusters.splice(b, 1);
    clusters.splice(a, 1, merged);
  }
  return clusters.map((cluster) =>
    Object.freeze({
      position: Object.freeze<Vector3Tuple>(cluster.position),
      lumens: cluster.lumens,
      ...(cluster.aim ? { aim: Object.freeze<Vector3Tuple>(cluster.aim) } : {}),
    }),
  );
}

/**
 * 一區地面的平均照度（lux）：在地面上取格點，加總每盞朝下燈具的直射照度。
 * 只用來估計室內補光與池水的散射亮度，不是照度計算。
 */
export function averageFloorIlluminance(zone: FixtureZone, samples = 6): number {
  const { min, max } = zone.inner;
  const { floor } = zone;
  let total = 0;
  for (let i = 0; i < samples; i += 1) {
    for (let j = 0; j < samples; j += 1) {
      const x = min[0] + ((max[0] - min[0]) * (i + 0.5)) / samples;
      const z = min[2] + ((max[2] - min[2]) * (j + 0.5)) / samples;
      for (const fixture of zone.fixtures) {
        const dx = fixture.position[0] - x;
        const dy = fixture.position[1] - floor;
        const dz = fixture.position[2] - z;
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        if (dy <= 0) continue;
        const cosine = dy / Math.sqrt(distanceSquared);
        // 朗伯發光面：光強度隨離開正下方的角度餘弦遞減；地面也是水平面，再乘一次餘弦。
        total += (lambertianIntensity(fixture.lumens) * cosine * cosine) / distanceSquared;
      }
    }
  }
  return total / (samples * samples);
}

export function assertFixtureLayout(layout: FixtureLayout): FixtureLayout {
  if (layout.zones.length > FIXTURE_ZONE_SLOTS) throw new RangeError('Too many fixture zones.');
  const finite = (values: readonly number[]) => values.every(Number.isFinite);
  for (const zone of layout.zones) {
    if (zone.fixtures.length === 0)
      throw new RangeError(`Fixture zone ${zone.id} has no fixtures.`);
    for (let axis = 0; axis < 3; axis += 1) {
      if (!(
        zone.outer.min[axis] < zone.inner.min[axis] &&
        zone.inner.min[axis] < zone.inner.max[axis] &&
        zone.inner.max[axis] < zone.outer.max[axis]
      )) {
        throw new RangeError(`Fixture zone ${zone.id} boxes must nest with a margin.`);
      }
    }
    if (!(zone.floor >= zone.inner.min[1] && zone.floor < zone.inner.max[1])) {
      throw new RangeError(`Fixture zone ${zone.id} floor must lie inside its box.`);
    }
    for (const fixture of zone.fixtures) {
      if (!finite(fixture.position) || !(fixture.lumens > 0))
        throw new TypeError(`Fixture in ${zone.id} is invalid.`);
      if (!(fixture.position[1] > zone.floor))
        throw new RangeError(`Fixture in ${zone.id} must hang above the floor.`);
    }
  }
  for (const light of layout.poolLights) {
    if (!finite(light.position) || !finite(light.aim) || !(light.lumens > 0))
      throw new TypeError('Pool light is invalid.');
    if (Math.abs(Math.hypot(...light.aim) - 1) > 1e-6 || Math.abs(light.aim[1]) > 1e-6) {
      throw new TypeError('Pool light must aim horizontally.');
    }
  }
  if (layout.poolLights.length > POOL_LIGHT_SLOTS) throw new RangeError('Too many pool lights.');
  if (!(layout.poolLightLensRadius > 0))
    throw new RangeError('Pool light lens radius must be positive.');
  return layout;
}

// ---------------------------------------------------------------------------
// 一般構件（three.js 標準與物理材質）

export interface FixtureLightUniforms {
  /** 要算的區數：燈沒開、或燈光照在構件上的強度為 0 時是 0（著色器的迴圈一次都不跑）。 */
  readonly uFixtureZoneCount: THREE.IUniform<number>;
  readonly uFixtureColor: THREE.IUniform<THREE.Color>;
  /** 世界座標的燈位，w 是光強度（場景單位）。 */
  readonly uFixtureLights: THREE.IUniform<THREE.Vector4[]>;
  /** 世界座標轉到 SITE 根節點座標：判斷一點在哪一區用。 */
  readonly uFixtureWorldToSite: THREE.IUniform<THREE.Matrix4>;
  readonly uFixtureZoneInnerMin: THREE.IUniform<THREE.Vector3[]>;
  readonly uFixtureZoneInnerMax: THREE.IUniform<THREE.Vector3[]>;
  readonly uFixtureZoneOuterMin: THREE.IUniform<THREE.Vector3[]>;
  readonly uFixtureZoneOuterMax: THREE.IUniform<THREE.Vector3[]>;
  /** 每一區在 uFixtureLights 裡的第一盞與盞數。 */
  readonly uFixtureZoneRange: THREE.IUniform<THREE.Vector2[]>;
  /** 每一區地面反射回來的補光（照度，已乘燈色）。 */
  readonly uFixtureZoneFill: THREE.IUniform<THREE.Vector3[]>;
}

const filled = <T>(count: number, create: () => T) => Array.from({ length: count }, create);

export function createFixtureLightUniforms(): FixtureLightUniforms {
  return {
    uFixtureZoneCount: { value: 0 },
    uFixtureColor: { value: new THREE.Color(0, 0, 0) },
    uFixtureLights: { value: filled(FIXTURE_LIGHT_SLOTS, () => new THREE.Vector4()) },
    uFixtureWorldToSite: { value: new THREE.Matrix4() },
    uFixtureZoneInnerMin: { value: filled(FIXTURE_ZONE_SLOTS, () => new THREE.Vector3()) },
    uFixtureZoneInnerMax: { value: filled(FIXTURE_ZONE_SLOTS, () => new THREE.Vector3()) },
    uFixtureZoneOuterMin: { value: filled(FIXTURE_ZONE_SLOTS, () => new THREE.Vector3()) },
    uFixtureZoneOuterMax: { value: filled(FIXTURE_ZONE_SLOTS, () => new THREE.Vector3()) },
    uFixtureZoneRange: { value: filled(FIXTURE_ZONE_SLOTS, () => new THREE.Vector2()) },
    uFixtureZoneFill: { value: filled(FIXTURE_ZONE_SLOTS, () => new THREE.Vector3()) },
  };
}

export const FIXTURE_LIGHTS_GLSL = /* glsl */ `
#define FIXTURE_ZONE_SLOTS ${FIXTURE_ZONE_SLOTS}
#define FIXTURE_LIGHT_SLOTS ${FIXTURE_LIGHT_SLOTS}
uniform int uFixtureZoneCount;
uniform vec3 uFixtureColor;
uniform vec4 uFixtureLights[ FIXTURE_LIGHT_SLOTS ];
uniform mat4 uFixtureWorldToSite;
uniform vec3 uFixtureZoneInnerMin[ FIXTURE_ZONE_SLOTS ];
uniform vec3 uFixtureZoneInnerMax[ FIXTURE_ZONE_SLOTS ];
uniform vec3 uFixtureZoneOuterMin[ FIXTURE_ZONE_SLOTS ];
uniform vec3 uFixtureZoneOuterMax[ FIXTURE_ZONE_SLOTS ];
uniform vec2 uFixtureZoneRange[ FIXTURE_ZONE_SLOTS ];
uniform vec3 uFixtureZoneFill[ FIXTURE_ZONE_SLOTS ];

// 一點在某一區的燈光範圍裡有多少（0 到 1）：內盒全亮，到外盒漸弱。
float fixtureZoneReach( int zone, vec3 site ) {
	vec3 rising = smoothstep( uFixtureZoneOuterMin[ zone ], uFixtureZoneInnerMin[ zone ], site );
	vec3 falling = 1.0 - smoothstep( uFixtureZoneInnerMax[ zone ], uFixtureZoneOuterMax[ zone ], site );
	vec3 reach = rising * falling;
	return reach.x * reach.y * reach.z;
}
`;

const LIGHTS_MAPS = '#include <lights_fragment_maps>';
const COMMON = '#include <common>';

/**
 * 加在 three.js 光照迴圈之後、環境光之前：每一盞燈是朝下的朗伯點光源，只算漫射，加進材質的
 * 間接漫射照度（和環境遮蔽一起作用）。燈的高光不在這裡算：池廳裡的構件反射池廳探針，探針拍得到
 * 發亮的燈具（`rendering/enhanced/hall-reflection.ts`），再算一次高光就重複了。
 * 位置與範圍在世界座標判斷，所以倒影與探針畫面也正確。補光朝下的面拿到最多。
 *
 * 全部的計算都在次數由 uniform 決定的迴圈裡：燈沒開時次數是 0，顯示卡整段跳過。軟體繪圖（沒有
 * 顯示卡的電腦、瀏覽器測試）不一樣，程式碼在就要花時間，所以省電級在燈沒照到構件時不編這一段
 *（見 `FixtureLightProgram`）。
 */
const FIXTURE_LIGHTS_APPLY = /* glsl */ `
#if defined( RE_IndirectDiffuse )
	for ( int zone = 0; zone < min( uFixtureZoneCount, FIXTURE_ZONE_SLOTS ); zone ++ ) {
		vec3 fixtureWorld = ( vec4( geometryPosition - viewMatrix[ 3 ].xyz, 0.0 ) * viewMatrix ).xyz;
		vec3 fixtureNormalWorld = inverseTransformDirection( geometryNormal, viewMatrix );
		float reach = fixtureZoneReach( zone, ( uFixtureWorldToSite * vec4( fixtureWorld, 1.0 ) ).xyz );
		int firstFixture = int( uFixtureZoneRange[ zone ].x );
		int endFixture = min( firstFixture + int( uFixtureZoneRange[ zone ].y ), FIXTURE_LIGHT_SLOTS );
		if ( reach <= 0.0 ) endFixture = firstFixture;
		float fixtureIrradiance = 0.0;
		for ( int index = firstFixture; index < endFixture; index ++ ) {
			vec4 fixture = uFixtureLights[ index ];
			vec3 toFixture = fixture.xyz - fixtureWorld;
			float distanceSquared = max( dot( toFixture, toFixture ), 0.09 );
			vec3 towardFixture = toFixture * inversesqrt( distanceSquared );
			// 燈具朝下：離開正下方越遠越暗，燈具上方完全照不到。
			fixtureIrradiance += fixture.w * max( towardFixture.y, 0.0 )
				* max( dot( fixtureNormalWorld, towardFixture ), 0.0 ) / distanceSquared;
		}
		irradiance += ( uFixtureColor * fixtureIrradiance
			+ uFixtureZoneFill[ zone ] * ( 0.35 + 0.65 * ( 0.5 - 0.5 * fixtureNormalWorld.y ) ) ) * reach;
	}
#endif
`;

/**
 * 材質的著色器要不要編進燈具照明。改了值要讓裝過的材質重編（`material.needsUpdate`）；
 * three.js 每個材質留著編過的版本，切回來不必再編。
 */
export interface FixtureLightProgram {
  readonly compiled: boolean;
}

const ALWAYS_COMPILED: FixtureLightProgram = Object.freeze({ compiled: true });

/**
 * 把燈具照明裝進一個 three.js 內建的受光材質（標準、物理）。uniform 是共用的同一組物件、
 * 世界座標，只在光線或圖層改變時更新。回傳 false 代表這不是會受光的標準材質，不裝。
 */
export function installFixtureLights(
  material: THREE.Material,
  uniforms: FixtureLightUniforms,
  program: FixtureLightProgram = ALWAYS_COMPILED,
): boolean {
  if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial !== true) return false;
  if (material.userData.fixtureLights === uniforms) return true;
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    previous.call(this, shader, renderer);
    if (!shader.fragmentShader.includes(LIGHTS_MAPS) || !shader.fragmentShader.includes(COMMON))
      return;
    // 兩個版本都帶 uniform：three.js 切回已編過的版本時沿用最後一次編譯的 uniform 清單。
    Object.assign(shader.uniforms, uniforms);
    if (!program.compiled) return;
    shader.fragmentShader = shader.fragmentShader
      .replace(COMMON, `${COMMON}\n${FIXTURE_LIGHTS_GLSL}`)
      .replace(LIGHTS_MAPS, `${FIXTURE_LIGHTS_APPLY}\n${LIGHTS_MAPS}`);
  };
  material.customProgramCacheKey = function customProgramCacheKey() {
    return `${previousKey.call(this)}|fixture-lights${program.compiled ? '' : ':off'}`;
  };
  material.userData.fixtureLights = uniforms;
  material.needsUpdate = true;
  return true;
}

// ---------------------------------------------------------------------------
// 水（水面、池體、水下畫面三支著色器共用，座標是水面網格的物件座標）

/** 場景上給水讀的燈光（世界座標）。 */
export interface WorldFixtureLights {
  /**
   * 天花燈照在水面（剛進到水裡）的照度，已乘燈色與入水的穿透率（場景單位）。池面上方的燈排得均勻，
   * 水面的照度近似一致，水裡只用這一個平均值，不逐盞計算。
   */
  readonly ceilingIrradiance: THREE.Color;
  readonly pool: readonly {
    readonly position: THREE.Vector3;
    readonly aim: THREE.Vector3;
    readonly intensity: number;
  }[];
  readonly poolColor: THREE.Color;
  /** 水下燈透鏡的亮度（場景單位，已乘燈色前）與半徑（公尺）。 */
  readonly lensLuminance: number;
  readonly lensRadius: number;
  /** 池水裡的平均照度（場景單位，已乘燈色）：水體散射與池壁補光用。 */
  readonly waterIrradiance: THREE.Color;
}

const SCENE_KEY = 'fixtureLights';

export function publishSceneFixtureLights(
  scene: THREE.Scene,
  lights: WorldFixtureLights | null,
): void {
  scene.userData[SCENE_KEY] = lights;
}

export function readSceneFixtureLights(
  scene: THREE.Scene | null | undefined,
): WorldFixtureLights | null {
  const candidate = scene?.userData[SCENE_KEY] as Partial<WorldFixtureLights> | null | undefined;
  return candidate &&
    candidate.ceilingIrradiance?.isColor === true &&
    Array.isArray(candidate.pool) &&
    candidate.poolColor?.isColor === true &&
    candidate.waterIrradiance?.isColor === true &&
    typeof candidate.lensLuminance === 'number' &&
    typeof candidate.lensRadius === 'number'
    ? (candidate as WorldFixtureLights)
    : null;
}

export interface WaterLightUniforms {
  readonly uWaterCeilingIrradiance: THREE.IUniform<THREE.Color>;
  readonly uPoolLightCount: THREE.IUniform<number>;
  /** 照得到東西的水下燈盞數（水中光暈用）：白天燈光照在構件上的強度為 0 時是 0。 */
  readonly uPoolGlowCount: THREE.IUniform<number>;
  readonly uPoolLights: THREE.IUniform<THREE.Vector4[]>;
  readonly uPoolLightAims: THREE.IUniform<THREE.Vector3[]>;
  readonly uPoolLightColor: THREE.IUniform<THREE.Color>;
  /** x = 透鏡亮度，y = 透鏡半徑。 */
  readonly uPoolLightLens: THREE.IUniform<THREE.Vector2>;
  readonly uWaterLightIrradiance: THREE.IUniform<THREE.Color>;
}

export const WATER_LIGHT_UNIFORM_NAMES = Object.freeze([
  'uWaterCeilingIrradiance',
  'uPoolLightCount',
  'uPoolGlowCount',
  'uPoolLights',
  'uPoolLightAims',
  'uPoolLightColor',
  'uPoolLightLens',
  'uWaterLightIrradiance',
] as const satisfies readonly (keyof WaterLightUniforms)[]);

export function createWaterLightUniforms(): WaterLightUniforms {
  return {
    uWaterCeilingIrradiance: { value: new THREE.Color(0, 0, 0) },
    uPoolLightCount: { value: 0 },
    uPoolGlowCount: { value: 0 },
    uPoolLights: { value: filled(POOL_LIGHT_SLOTS, () => new THREE.Vector4()) },
    uPoolLightAims: { value: filled(POOL_LIGHT_SLOTS, () => new THREE.Vector3(0, 0, 1)) },
    uPoolLightColor: { value: new THREE.Color(0, 0, 0) },
    uPoolLightLens: { value: new THREE.Vector2(0, 0.1) },
    uWaterLightIrradiance: { value: new THREE.Color(0, 0, 0) },
  };
}

/** 從水面材質的 uniform 裡挑出燈光那幾個（同一批物件，不複製）。 */
export function pickWaterLightUniforms(
  uniforms: Readonly<Record<string, THREE.IUniform>>,
): WaterLightUniforms {
  const picked: Record<string, THREE.IUniform> = {};
  for (const name of WATER_LIGHT_UNIFORM_NAMES) {
    const uniform = uniforms[name];
    if (!uniform) throw new TypeError(`Water material is missing ${name}.`);
    picked[name] = uniform;
  }
  return picked as unknown as WaterLightUniforms;
}

/** 把世界座標的燈光寫進水的 uniform，換到 `toSpace`（世界座標轉水面網格物件座標）。 */
export function writeWaterLightUniforms(
  uniforms: WaterLightUniforms,
  lights: WorldFixtureLights | null,
  toSpace: THREE.Matrix4,
): void {
  if (!lights) {
    uniforms.uWaterCeilingIrradiance.value.setRGB(0, 0, 0);
    uniforms.uPoolLightCount.value = 0;
    uniforms.uPoolGlowCount.value = 0;
    uniforms.uPoolLightLens.value.x = 0;
    uniforms.uWaterLightIrradiance.value.setRGB(0, 0, 0);
    return;
  }
  uniforms.uWaterCeilingIrradiance.value.copy(lights.ceilingIrradiance);
  const pool = lights.pool.slice(0, POOL_LIGHT_SLOTS);
  pool.forEach((light, index) => {
    uniforms.uPoolLights.value[index]
      .set(light.position.x, light.position.y, light.position.z, 1)
      .applyMatrix4(toSpace)
      .setW(light.intensity);
    uniforms.uPoolLightAims.value[index].copy(light.aim).transformDirection(toSpace);
  });
  uniforms.uPoolLightCount.value = pool.length;
  uniforms.uPoolGlowCount.value = pool.some((light) => light.intensity > 0) ? pool.length : 0;
  uniforms.uPoolLightColor.value.copy(lights.poolColor);
  uniforms.uPoolLightLens.value.set(lights.lensLuminance, lights.lensRadius);
  uniforms.uWaterLightIrradiance.value.copy(lights.waterIrradiance);
}

// ---------------------------------------------------------------------------

export type FixtureState = 'on' | 'off';

/**
 * 場景裡的燈具照明：依時刻與天氣開關燈，寫共用的 uniform（世界座標），控制發光面的亮度，
 * 並把照到池水的那一份放到場景上給水用。圖層關掉（燈具不在畫面上）時那一區不亮。
 */
export class FixtureLights {
  readonly uniforms: FixtureLightUniforms = createFixtureLightUniforms();
  private readonly program = { compiled: true };
  private readonly layout: FixtureLayout;
  private lighting: SunLighting | null = null;
  private tier: FixtureQualityTier = 'high';
  private switchedOn = false;
  private surfaceStrength = 0;
  private readonly world = new THREE.Vector3();

  constructor(
    layout: FixtureLayout,
    private readonly scene: THREE.Scene,
    private readonly siteRoot: THREE.Object3D,
  ) {
    this.layout = assertFixtureLayout(layout);
  }

  /** 把燈光裝進這棵樹裡所有受光的標準材質（已裝過的略過；燈具本身的發光面不裝）。 */
  install(root: THREE.Object3D): void {
    const emitters = new Set(this.layout.zones.map((zone) => zone.emitterName));
    root.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh || emitters.has(object.name)) return;
      const { material } = object as THREE.Mesh;
      for (const entry of Array.isArray(material) ? material : [material]) {
        installFixtureLights(entry, this.uniforms, this.program);
      }
    });
    this.sync();
  }

  setQuality(tier: FixtureQualityTier): void {
    if (!Object.hasOwn(FIXTURE_COUNT_BY_TIER, tier))
      throw new TypeError(`Unknown fixture quality tier: ${String(tier)}`);
    this.tier = tier;
    this.sync();
  }

  /** 光線改變時呼叫。 */
  setLighting(lighting: SunLighting): void {
    this.lighting = lighting;
    this.sync();
  }

  get state(): FixtureState {
    return this.switchedOn ? 'on' : 'off';
  }

  /** 燈光照在構件上的強度（0 到 1）：白天開著燈時接近 0，看得到的主要是發光面。 */
  get surfaceLighting(): number {
    return this.surfaceStrength;
  }

  /** 圖層或光線改變時呼叫。 */
  sync(): void {
    const lighting = this.lighting;
    const on = lighting !== null && fixturesSwitchedOn(lighting);
    this.switchedOn = on;
    const scale = lighting ? fixtureLuxScale(lighting) : 0;
    const uniforms = this.uniforms;
    const fixtureCount = FIXTURE_COUNT_BY_TIER[this.tier];

    this.siteRoot.updateWorldMatrix(true, false);
    uniforms.uFixtureWorldToSite.value.copy(this.siteRoot.matrixWorld).invert();
    uniforms.uFixtureColor.value.setRGB(...CEILING_FIXTURE_COLOR);

    // 燈具照度相對於室外日光夠大，照在構件上的燈光才值得算（白天陰雨天開燈時省下迴圈）。
    const typicalLux = Math.max(
      0,
      ...this.layout.zones.map((zone) => averageFloorIlluminance(zone)),
    );
    const ratio =
      lighting && on ? (typicalLux * scale) / Math.max(outdoorIlluminance(lighting), 1e-6) : 0;
    this.surfaceStrength = on
      ? smoothstep(SURFACE_LIGHT_RATIO.from, SURFACE_LIGHT_RATIO.to, ratio)
      : 0;

    let slot = 0;
    let waterLux = 0;
    this.layout.zones.forEach((zone, index) => {
      const visible = on && this.objectVisible(zone.anchorName);
      const range = uniforms.uFixtureZoneRange.value[index];
      uniforms.uFixtureZoneInnerMin.value[index].set(...zone.inner.min);
      uniforms.uFixtureZoneInnerMax.value[index].set(...zone.inner.max);
      uniforms.uFixtureZoneOuterMin.value[index].set(...zone.outer.min);
      uniforms.uFixtureZoneOuterMax.value[index].set(...zone.outer.max);
      if (!visible) {
        range.set(slot, 0);
        uniforms.uFixtureZoneFill.value[index].set(0, 0, 0);
        return;
      }
      const fixtures = aggregateFixtures(
        zone.fixtures,
        Math.min(fixtureCount, FIXTURE_LIGHT_SLOTS - slot),
      );
      range.set(slot, this.surfaceStrength > 0 ? fixtures.length : 0);
      for (const fixture of fixtures) {
        const intensity = lambertianIntensity(fixture.lumens) * scale * this.surfaceStrength;
        this.world.set(
          fixture.position[0],
          fixture.position[1] - EMITTER_OFFSET,
          fixture.position[2],
        );
        this.siteRoot.localToWorld(this.world);
        uniforms.uFixtureLights.value[slot].set(
          this.world.x,
          this.world.y,
          this.world.z,
          intensity,
        );
        slot += 1;
      }
      const fill = averageFloorIlluminance(zone) * scale * FLOOR_REFLECTANCE * this.surfaceStrength;
      uniforms.uFixtureZoneFill.value[index].set(
        fill * CEILING_FIXTURE_COLOR[0],
        fill * CEILING_FIXTURE_COLOR[1],
        fill * CEILING_FIXTURE_COLOR[2],
      );
      if (zone.reachesWater) waterLux += averageFloorIlluminance(zone);
    });
    for (let index = this.layout.zones.length; index < FIXTURE_ZONE_SLOTS; index += 1) {
      uniforms.uFixtureZoneRange.value[index].set(0, 0);
    }
    uniforms.uFixtureZoneCount.value =
      on && slot > 0 && this.surfaceStrength > 0 ? this.layout.zones.length : 0;
    // 省電級（繪圖管線 low，軟體繪圖一律用這一級）燈沒照到構件時不編燈具照明；其他級一直編著，開關燈不必重編。
    this.setCompiled(this.tier !== 'low' || uniforms.uFixtureZoneCount.value > 0);

    this.updateEmitters(on, scale);
    this.publishWater(on, scale, waterLux);
  }

  /** 著色器 `compiled` 改變時，讓場景裡裝過燈光的材質重編。 */
  private setCompiled(compiled: boolean): void {
    if (this.program.compiled === compiled) return;
    this.program.compiled = compiled;
    const installed = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      const { material } = object as THREE.Mesh;
      if (!material) return;
      for (const entry of Array.isArray(material) ? material : [material]) {
        if (entry.userData.fixtureLights === this.uniforms) installed.add(entry);
      }
    });
    for (const material of installed) material.needsUpdate = true;
  }

  private updateEmitters(on: boolean, scale: number): void {
    const brightest = Math.max(
      0,
      ...this.layout.zones.flatMap((zone) => zone.fixtures.map((fixture) => fixture.lumens)),
    );
    // 朗伯發光面的亮度 = 光通量 ÷（π × 面積）；兩區共用一個材質，取池廳燈具的亮度。
    const luminance = on ? (brightest / (Math.PI * CEILING_EMITTER_AREA)) * scale : 0;
    for (const zone of this.layout.zones) {
      const mesh = this.scene.getObjectByName(zone.emitterName) as THREE.Mesh | undefined;
      const material = mesh?.material as THREE.MeshStandardMaterial | undefined;
      if (material?.isMeshStandardMaterial !== true) continue;
      material.emissive.setRGB(...CEILING_FIXTURE_COLOR, THREE.LinearSRGBColorSpace);
      material.emissiveIntensity = luminance;
    }
  }

  private publishWater(on: boolean, scale: number, ceilingWaterLux: number): void {
    // 白天燈光照不到構件時，水下燈只剩透鏡發亮；省電級（含軟體繪圖）連透鏡也不算，省下水裡的迴圈。
    const poolVisible =
      on &&
      (this.surfaceStrength > 0 || this.tier !== 'low') &&
      this.layout.poolLights.length > 0 &&
      this.objectVisible(this.layout.poolLightAnchorName);
    if (!on) {
      publishSceneFixtureLights(this.scene, null);
      return;
    }
    const poolLights = poolVisible
      ? (aggregateFixtures(
          this.layout.poolLights,
          POOL_LIGHT_COUNT_BY_TIER[this.tier],
        ) as PoolLight[])
      : [];
    const pool = poolLights.map((light) => ({
      position: this.siteRoot.localToWorld(new THREE.Vector3(...light.position)),
      aim: new THREE.Vector3(...light.aim).transformDirection(this.siteRoot.matrixWorld),
      intensity: lambertianIntensity(light.lumens) * scale,
    }));
    const lens = this.layout.poolLights[0];
    const lensArea = Math.PI * this.layout.poolLightLensRadius ** 2;
    // 水下燈照在池水裡的平均照度：總光通量平均分到池水的體積表面上（粗估），加上天花燈照進水裡的部分。
    const poolLumens = poolVisible
      ? this.layout.poolLights.reduce((sum, light) => sum + light.lumens, 0)
      : 0;
    const poolLux = poolLumens / Math.max(this.poolSurfaceArea(), 1);
    const waterIrradiance = new THREE.Color().setRGB(
      (ceilingWaterLux * CEILING_FIXTURE_COLOR[0] + poolLux * POOL_LIGHT_COLOR[0]) *
        scale *
        this.surfaceStrength,
      (ceilingWaterLux * CEILING_FIXTURE_COLOR[1] + poolLux * POOL_LIGHT_COLOR[1]) *
        scale *
        this.surfaceStrength,
      (ceilingWaterLux * CEILING_FIXTURE_COLOR[2] + poolLux * POOL_LIGHT_COLOR[2]) *
        scale *
        this.surfaceStrength,
    );
    const ceiling = ceilingWaterLux * scale * this.surfaceStrength * AIR_TO_WATER_TRANSMISSION;
    publishSceneFixtureLights(
      this.scene,
      Object.freeze({
        ceilingIrradiance: new THREE.Color().setRGB(
          ceiling * CEILING_FIXTURE_COLOR[0],
          ceiling * CEILING_FIXTURE_COLOR[1],
          ceiling * CEILING_FIXTURE_COLOR[2],
        ),
        pool: pool.map((light) => ({
          ...light,
          intensity: light.intensity * this.surfaceStrength,
        })),
        poolColor: new THREE.Color().setRGB(...POOL_LIGHT_COLOR),
        lensLuminance: poolVisible && lens ? (lens.lumens / (Math.PI * lensArea)) * scale : 0,
        lensRadius: this.layout.poolLightLensRadius,
        waterIrradiance,
      }),
    );
  }

  /** 水下燈照亮的面積：兩道長池壁與池底的粗估（公尺平方）。 */
  private poolSurfaceArea(): number {
    const lights = this.layout.poolLights;
    if (lights.length === 0) return 1;
    const xs = lights.map((light) => light.position[0]);
    const zs = lights.map((light) => light.position[2]);
    const length = Math.max(...xs) - Math.min(...xs) + 4;
    const width = Math.max(...zs) - Math.min(...zs);
    return length * Math.max(width, 1) + 2 * length * 1.4;
  }

  private objectVisible(name: string): boolean {
    let object: THREE.Object3D | null | undefined = this.scene.getObjectByName(name);
    if (!object) return true;
    for (; object; object = object.parent) {
      if (!object.visible) return false;
    }
    return true;
  }
}
