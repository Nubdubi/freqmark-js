import type { DecodeOptions, DecodeResult } from '../index.js';
export interface DecodeWorkerClient {
    decodeImageData(imageData: ImageData, options?: DecodeOptions): Promise<DecodeResult>;
    terminate(): void;
}
export declare function createDecodeWorker(): DecodeWorkerClient;
//# sourceMappingURL=detector.d.ts.map