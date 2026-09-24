import type { DecodeOptions, DecodeResult } from '../index.js';
import type { DecodeWorkerRequest, DecodeWorkerResponse, WorkerDecodeOptions } from './worker/protocol.js';

interface PendingRequest {
  resolve: (result: DecodeResult) => void;
  reject: (error: Error) => void;
  width: number;
  height: number;
}

export interface DecodeWorkerClient {
  decodeImageData(imageData: ImageData, options?: DecodeOptions): Promise<DecodeResult>;
  terminate(): void;
}

function workerOptions(options: DecodeOptions): WorkerDecodeOptions {
  return {
    density: Math.max(1, Math.floor(options.density ?? 1)),
    minMargin: options.minMargin ?? 8,
    robust: options.robust ?? true,
    blockSizes: options.blockSizes,
    offsetStep: options.offsetStep,
    placementSeed: options.placementSeed,
    pilotSeed: options.pilotSeed,
    searchRotation: options.searchRotation,
    maxRotationDeg: options.maxRotationDeg,
    coarseRotationStepDeg: options.coarseRotationStepDeg,
    fineRotationStepDeg: options.fineRotationStepDeg,
    rotationCandidates: options.rotationCandidates,
    perspectiveCorners: options.perspectiveCorners,
  };
}

export function createDecodeWorker(): DecodeWorkerClient {
  if (typeof Worker === 'undefined') throw new Error('Web Worker is not available in this environment.');
  const worker = new Worker(new URL('./worker/detector.worker.js', import.meta.url), { type: 'module' });
  const pending = new Map<number, PendingRequest>();
  let nextId = 1;
  worker.onmessage = (event: MessageEvent<DecodeWorkerResponse>) => {
    const item = pending.get(event.data.id);
    if (!item) return;
    pending.delete(event.data.id);
    if (event.data.type === 'error') item.reject(new Error(event.data.message));
    else item.resolve({ ...event.data.result, width: item.width, height: item.height });
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || 'Decode worker failed.');
    for (const item of pending.values()) item.reject(error);
    pending.clear();
  };
  return {
    decodeImageData(imageData, options = {}) {
      const id = nextId++;
      const pixels = new Uint8ClampedArray(imageData.data);
      const request: DecodeWorkerRequest = {
        type: 'decode', id, width: imageData.width, height: imageData.height,
        pixels: pixels.buffer,
        options: workerOptions(options),
      };
      return new Promise<DecodeResult>((resolve, reject) => {
        pending.set(id, { resolve, reject, width: imageData.width, height: imageData.height });
        worker.postMessage(request, [request.pixels]);
      });
    },
    terminate() {
      worker.terminate();
      const error = new Error('Decode worker terminated.');
      for (const item of pending.values()) item.reject(error);
      pending.clear();
    },
  };
}
