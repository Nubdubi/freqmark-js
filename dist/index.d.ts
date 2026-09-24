import { type BrowserImageInput } from './browser/image.js';
import { type DetectionTransform } from './watermark/engine.js';
import type { Quad } from './geometry/homography.js';
import { createDecodeWorker } from './browser/detector.js';
export type { BrowserImageInput } from './browser/image.js';
export type { DetectionTransform } from './watermark/engine.js';
export { fingerprintFromPayload } from './watermark/fingerprint.js';
export { dct8, idct8 } from './core/dct.js';
export { embedSignedQim, readSignedQim } from './core/qim.js';
export { measureImageQuality } from './core/metrics.js';
export type { QualityMetrics } from './core/metrics.js';
export { buildFrame, parseFrame, V3_PREAMBLE, CURRENT_FRAME_VERSION } from './watermark/frame.js';
export type { ParsedFrame, SupportedFrameVersion } from './watermark/frame.js';
export { RepetitionCodec, repetition3 } from './ecc/repetition.js';
export type { EccCodec, EccDecodeResult } from './ecc/codec.js';
export { createMulberry32, createPermutation, hashSeed } from './core/prng.js';
export { DEFAULT_PLACEMENT_SEED, placementPermutation } from './watermark/layout.js';
export { DEFAULT_PILOT_SEED, getPilotPattern, pilotActive, pilotBit, pilotConfidence } from './sync/pilot.js';
export { rotateImageData } from './geometry/rotate.js';
export { searchRotationFromImageData } from './sync/rotation.js';
export type { RotationSearchOptions } from './sync/rotation.js';
export { computeHomography, invertHomography, transformPoint } from './geometry/homography.js';
export type { Homography, Point2D, Quad } from './geometry/homography.js';
export { rectifyPerspective, warpPerspective } from './geometry/perspective.js';
export { createDecodeWorker };
export type { DecodeWorkerClient } from './browser/detector.js';
export type { DecodeWorkerRequest, DecodeWorkerResponse, WorkerDecodeOptions } from './browser/worker/protocol.js';
export { confidenceLabel, createCameraDetector, trackingDecodeOptions } from './browser/camera.js';
export type { CameraConfidenceLabel, CameraDetectionResult, CameraDetector, CameraDetectorOptions } from './browser/camera.js';
export { adjustBrightness, cropImageData, resizeImageData } from './benchmark/attacks.js';
export { analyzeRobustness } from './benchmark/robustness.js';
export type { AnalyzeRobustnessOptions, RobustnessCaseResult, RobustnessReport } from './benchmark/robustness.js';
export { analyzeTextureBlock } from './perceptual/texture.js';
export type { TextureMetrics, TextureScoreOptions } from './perceptual/texture.js';
export type WatermarkQuality = 'invisible' | 'balanced' | 'robust';
export declare const QUALITY_PRESETS: {
    readonly invisible: {
        readonly strength: 14;
        readonly textureThreshold: 0.1;
        readonly minStrengthFactor: 0.3;
    };
    readonly balanced: {
        readonly strength: 18;
        readonly textureThreshold: 0.08;
        readonly minStrengthFactor: 0.35;
    };
    readonly robust: {
        readonly strength: 22;
        readonly textureThreshold: 0.06;
        readonly minStrengthFactor: 0.45;
    };
};
export interface EncodeOptions {
    /** Any string. It is SHA-256 hashed and truncated to a 64-bit fingerprint. */
    payload?: string;
    /** Advanced mode: supply the exact 64-bit fingerprint as 16 hex characters. */
    fingerprint?: string;
    /** Maximum QIM step. Explicit numeric strengths remain supported. */
    strength?: number;
    /** Spatial thinning. Keep at 1 for strongest crop resistance. */
    density?: number;
    /** Skip smooth blocks using perceptual texture analysis. Default true. */
    adaptive?: boolean;
    /** Advanced: normalized smooth-block cutoff (0..1). Default 0.08. */
    textureThreshold?: number;
    /** Perceptual watermark preset. Default invisible when strength is omitted. */
    watermarkQuality?: WatermarkQuality;
    /** Public layout seed; this disperses artifacts and is not a security key. */
    placementSeed?: string;
    /** Public synchronization pilot seed; not a security key. */
    pilotSeed?: string;
    /** Output MIME type. PNG recommended for the first generated copy. */
    outputType?: 'image/png' | 'image/jpeg' | 'image/webp';
    /** Used for JPEG/WebP. */
    quality?: number;
}
export interface EncodeResult {
    blob: Blob;
    fingerprint: string;
    width: number;
    height: number;
    blocksUsed: number;
    repetitionsPerBit: number;
    tileBlocks: number;
    blocksSkippedSmooth: number;
    averageStrength: number;
}
export declare function encode(input: BrowserImageInput, options: EncodeOptions): Promise<EncodeResult>;
export interface DecodeOptions {
    /** Must match encode density. Default 1. */
    density?: number;
    /** Used to normalize weighted votes. Default 8. */
    minMargin?: number;
    /** Scan crop/grid/resize hypotheses. Default true in public API. */
    robust?: boolean;
    /** Override current-image block sizes. [8] = original size, [6] ~= 75% resize. */
    blockSizes?: number[];
    /** Pixel step for crop/grid alignment search. Smaller = slower/stronger. */
    offsetStep?: number;
    /** Must match encode placementSeed. Default is the library public seed. */
    placementSeed?: string;
    /** Must match encode pilotSeed for v3. */
    pilotSeed?: string;
    /** Search and correct moderate rotation. Default false. */
    searchRotation?: boolean;
    maxRotationDeg?: number;
    coarseRotationStepDeg?: number;
    fineRotationStepDeg?: number;
    rotationCandidates?: number[];
    /** Ordered top-left, top-right, bottom-right, bottom-left source corners. */
    perspectiveCorners?: Quad;
    /** Enables perspective workflow; without corners decode safely falls back. */
    searchPerspective?: boolean;
}
export interface DecodeResult {
    found: boolean;
    fingerprint: string | null;
    confidence: number;
    width: number;
    height: number;
    blocksRead: number;
    repetitionsPerBit: number;
    bitAgreement: number;
    coverage: number;
    candidatesTested: number;
    transform: DetectionTransform | null;
    frame: {
        version: 2 | 3 | null;
        preambleValid: boolean;
        magicValid: boolean;
        versionValid: boolean;
        crcValid: boolean;
    };
    correctedBits: number;
    rawBitErrors: number;
    sync: {
        found: boolean;
        confidence: number;
        scale: number;
        offsetX: number;
        offsetY: number;
        rotationDeg: number;
        perspectiveCorrected: boolean;
    };
}
export declare function decode(input: BrowserImageInput, options?: DecodeOptions): Promise<DecodeResult>;
/** Decode off the UI thread using a short-lived module worker. */
export declare function decodeInWorker(input: BrowserImageInput, options?: DecodeOptions): Promise<DecodeResult>;
export interface RevealOptions extends DecodeOptions {
    /** Contrast multiplier for the human-visible diagnostic map. Default 6. */
    boost?: number;
    /** Reuse a transform from decode() to avoid searching again. */
    transform?: DetectionTransform | null;
    outputType?: 'image/png' | 'image/jpeg' | 'image/webp';
    quality?: number;
}
export interface RevealResult {
    blob: Blob;
    detection: DecodeResult;
}
/**
 * Visualize the otherwise invisible frequency-domain signal.
 * `reveal()` does not alter the protected source; it returns a diagnostic image.
 */
export declare function reveal(input: BrowserImageInput, options?: RevealOptions): Promise<RevealResult>;
//# sourceMappingURL=index.d.ts.map