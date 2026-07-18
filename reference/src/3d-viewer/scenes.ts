import manifest from './scene-manifest.json';

export type EnvironmentId = 'day' | 'winter-light' | 'rain' | 'soft';

export interface ViewerSceneConfig {
  id: string;
  label: string;
  camera: { position: [number, number, number]; target: [number, number, number]; fov: number };
  layers: string[];
  environment: EnvironmentId;
}

export const viewerScenes = manifest.scenes as ViewerSceneConfig[];

export function getViewerScene(id: string): ViewerSceneConfig {
  const scene = viewerScenes.find((candidate) => candidate.id === id);
  if (!scene) throw new TypeError(`Unknown Viewer scene: ${id}`);
  return scene;
}
