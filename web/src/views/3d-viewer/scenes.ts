import manifest from './scene-manifest.json';
import type { SceneLightingPreset } from './rendering/lighting/lighting-state';

export type EnvironmentId = 'day' | 'winter-light' | 'rain' | 'soft';

export interface ViewerSceneConfig {
  id: string;
  label: string;
  context: {
    title: string;
    summary: string;
    observations: [string, string, string];
    conceptAnchor: string;
  };
  camera: { position: [number, number, number]; target: [number, number, number]; fov: number };
  layers: string[];
  /** 基本繪圖路徑（沒有進階光影時）用的固定環境。 */
  environment: EnvironmentId;
  /** 這個場景自帶的日期、時刻與天氣；太陽位置由它算出來。 */
  lighting: SceneLightingPreset;
}

export const viewerScenes = manifest.scenes as ViewerSceneConfig[];

export function getViewerScene(id: string): ViewerSceneConfig {
  const scene = viewerScenes.find((candidate) => candidate.id === id);
  if (!scene) throw new TypeError(`Unknown Viewer scene: ${id}`);
  return scene;
}
