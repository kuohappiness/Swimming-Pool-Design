import type { RenderQualityProfile } from './quality-profile';
import type { VisualAssetAdapter, VisualAssetContext } from './contracts';

export class BaselineVisualAssetAdapter implements VisualAssetAdapter {
  readonly id = 'baseline-visual-assets';
  private attached = false;

  attach(_context: VisualAssetContext) {
    this.attached = true;
  }

  setQuality(_profile: RenderQualityProfile) {}

  dispose() {
    this.attached = false;
  }
}
