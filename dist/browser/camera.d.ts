import type { DecodeOptions, DecodeResult } from '../index.js';
import { type DecodeWorkerClient } from './detector.js';
export type CameraConfidenceLabel = 'Not detected' | 'Possible' | 'Likely' | 'Strong';
export declare function confidenceLabel(confidence: number, found?: boolean): CameraConfidenceLabel;
export interface CameraDetectorOptions {
    video: HTMLVideoElement;
    scanIntervalMs?: number;
    /** Maximum captured frame dimension. Default 720. */
    resolution?: number;
    searchRotation?: boolean;
    robust?: boolean;
    placementSeed?: string;
    pilotSeed?: string;
    mediaConstraints?: MediaStreamConstraints;
    /** Force a full search after this many tracked scans. Default 10. */
    fullSearchEvery?: number;
    worker?: DecodeWorkerClient;
}
export interface CameraDetectionResult extends DecodeResult {
    label: CameraConfidenceLabel;
    tracked: boolean;
    frameWidth: number;
    frameHeight: number;
}
export interface CameraDetector {
    start(): Promise<void>;
    stop(): void;
    onResult(callback: (result: CameraDetectionResult) => void): () => void;
    readonly running: boolean;
}
export declare function trackingDecodeOptions(base: DecodeOptions, previous: DecodeResult | null, trackedScans: number, fullSearchEvery?: number): {
    options: DecodeOptions;
    tracked: boolean;
};
export declare function createCameraDetector(options: CameraDetectorOptions): CameraDetector;
//# sourceMappingURL=camera.d.ts.map