import { type SupportedFrameVersion } from './frame.js';
export interface EmbedEngineOptions {
    strength: number;
    /** Spatial thinning. 1 is strongly recommended for crop-resistant v2 layout. */
    density: number;
    /** Skip perceptually smooth blocks. Defaults to true. */
    adaptive?: boolean;
    /** Minimum normalized texture score required for embedding. Default 0.08. */
    textureThreshold?: number;
    /** Minimum fraction of strength used just above the texture threshold. */
    minStrengthFactor?: number;
    /** Test/migration hook. New encodes should use the default v3 frame. */
    frameVersion?: SupportedFrameVersion;
    /** Public, non-secret seed used only to disperse the spatial pattern. */
    placementSeed?: string;
    pilotSeed?: string;
}
export interface EmbedEngineResult {
    imageData: ImageData;
    blocksUsed: number;
    repetitionsPerBit: number;
    tileBlocks: number;
    blocksSkippedSmooth: number;
    averageStrength: number;
}
export declare function embedFingerprintIntoImageData(source: ImageData, fingerprint: string, options: EmbedEngineOptions): EmbedEngineResult;
export interface DetectionTransform {
    /** Estimated current-image pixel size corresponding to one original 8x8 block. */
    blockSize: number;
    /** Pixel offset used to reacquire the DCT grid after cropping. */
    offsetX: number;
    offsetY: number;
    /** Spatial tile phase used to reacquire repeated v2 payload layout. */
    phaseX: number;
    phaseY: number;
}
export interface DetectEngineOptions {
    density: number;
    minMargin: number;
    /** Scan multiple geometric hypotheses for crop/resize resilience. Default false at engine level. */
    robust?: boolean;
    /** Candidate current-image block sizes. 8 means no resize. */
    blockSizes?: number[];
    /** Pixel step while searching crop/grid alignment. Lower is slower but stronger. */
    offsetStep?: number;
    /** Must match encode placementSeed for v3. */
    placementSeed?: string;
    pilotSeed?: string;
}
export interface DetectEngineResult {
    found: boolean;
    fingerprint: string | null;
    confidence: number;
    blocksRead: number;
    repetitionsPerBit: number;
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
    bitAgreement: number;
    coverage: number;
    candidatesTested: number;
    transform: DetectionTransform | null;
}
export declare function detectFingerprintFromImageData(source: ImageData, options: DetectEngineOptions): DetectEngineResult;
export declare function detectFingerprintAtTransformFromImageData(source: ImageData, transform: DetectionTransform, options: Pick<DetectEngineOptions, 'density' | 'minMargin' | 'placementSeed' | 'pilotSeed'>): DetectEngineResult;
export interface RevealEngineOptions {
    transform?: DetectionTransform | null;
    boost?: number;
}
/**
 * Produce a human-visible diagnostic map of the hidden DCT signal.
 * This is a decoder visualization, not a visible watermark stored in the source image.
 */
export declare function revealWatermarkFromImageData(source: ImageData, options?: RevealEngineOptions): ImageData;
//# sourceMappingURL=engine.d.ts.map