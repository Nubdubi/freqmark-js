import type { Quad } from '../../geometry/homography.js';
import type { DetectEngineResult } from '../../watermark/engine.js';

export interface WorkerDecodeOptions {
  density: number;
  minMargin: number;
  robust: boolean;
  blockSizes?: number[];
  offsetStep?: number;
  placementSeed?: string;
  pilotSeed?: string;
  searchRotation?: boolean;
  maxRotationDeg?: number;
  coarseRotationStepDeg?: number;
  fineRotationStepDeg?: number;
  rotationCandidates?: number[];
  perspectiveCorners?: Quad;
}

export interface DecodeWorkerRequest {
  type: 'decode';
  id: number;
  width: number;
  height: number;
  pixels: ArrayBuffer;
  options: WorkerDecodeOptions;
}

export interface DecodeWorkerSuccess {
  type: 'result';
  id: number;
  result: DetectEngineResult;
  elapsedMs: number;
}

export interface DecodeWorkerFailure {
  type: 'error';
  id: number;
  message: string;
}

export type DecodeWorkerResponse = DecodeWorkerSuccess | DecodeWorkerFailure;
