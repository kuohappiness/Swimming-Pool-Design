import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import transcoderScriptUrl from 'three/examples/jsm/libs/basis/basis_transcoder.js?url';
import transcoderWasmUrl from 'three/examples/jsm/libs/basis/basis_transcoder.wasm?url';

/**
 * KTX2 壓縮貼圖的載入器（DEC-190）。貼圖在顯示卡記憶體裡維持壓縮，
 * 同樣的解析度只占未壓縮的四分之一到八分之一，手機才放得下寫實材質。
 *
 * three.js 內附的 Basis 轉碼器（一支腳本加一個 WASM）由 Vite 當成一般資產打包，
 * 檔名會帶雜湊；KTX2Loader 只認固定檔名，所以用 LoadingManager 把兩個固定檔名
 * 換成打包後的網址。轉碼器因此和網站同源，不連任何外部網域。
 */

const TRANSCODER_PATH = 'basis-transcoder:/';

export interface TranscoderUrls {
  readonly script: string;
  readonly wasm: string;
}

export const BUNDLED_TRANSCODER_URLS: TranscoderUrls = Object.freeze({
  script: transcoderScriptUrl,
  wasm: transcoderWasmUrl,
});

/** 把 KTX2Loader 要的兩個固定檔名換成實際網址；其他網址原樣通過。 */
export function resolveTranscoderUrl(
  url: string,
  urls: TranscoderUrls = BUNDLED_TRANSCODER_URLS,
): string {
  if (url === `${TRANSCODER_PATH}basis_transcoder.js`) return urls.script;
  if (url === `${TRANSCODER_PATH}basis_transcoder.wasm`) return urls.wasm;
  return url;
}

export class Ktx2TextureSource {
  private readonly loader: KTX2Loader;
  private disposed = false;

  constructor(renderer: THREE.WebGLRenderer, urls: TranscoderUrls = BUNDLED_TRANSCODER_URLS) {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => resolveTranscoderUrl(url, urls));
    this.loader = new KTX2Loader(manager)
      .setTranscoderPath(TRANSCODER_PATH)
      // 轉碼在 Worker 裡做，不卡住畫面；手機核心少，兩個就夠。
      .setWorkerLimit(2)
      .detectSupport(renderer);
  }

  /**
   * 載入一張 .ktx2。回傳的貼圖已含各層縮圖，呼叫端不得再開 generateMipmaps；
   * 色彩空間由檔案決定，重複方式與各向異性由呼叫端設定。
   */
  async loadTexture(url: string): Promise<THREE.CompressedTexture> {
    if (this.disposed) throw new TypeError('KTX2 texture source has been disposed.');
    const texture = await this.loader.loadAsync(url);
    if (this.disposed) {
      texture.dispose();
      throw new TypeError('KTX2 texture source was disposed during loading.');
    }
    return texture;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loader.dispose();
  }
}
