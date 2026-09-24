import { imageDataToBlob, loadImage } from './browser/image.js';
import { detectFingerprintFromImageData, detectFingerprintAtTransformFromImageData, embedFingerprintIntoImageData, revealWatermarkFromImageData, } from './watermark/engine.js';
import { fingerprintFromPayload } from './watermark/fingerprint.js';
import { searchRotationFromImageData } from './sync/rotation.js';
import { rectifyPerspective } from './geometry/perspective.js';
import { createDecodeWorker } from './browser/detector.js';
export { fingerprintFromPayload } from './watermark/fingerprint.js';
export { dct8, idct8 } from './core/dct.js';
export { embedSignedQim, readSignedQim } from './core/qim.js';
export { measureImageQuality } from './core/metrics.js';
export { buildFrame, parseFrame, V3_PREAMBLE, CURRENT_FRAME_VERSION } from './watermark/frame.js';
export { RepetitionCodec, repetition3 } from './ecc/repetition.js';
export { createMulberry32, createPermutation, hashSeed } from './core/prng.js';
export { DEFAULT_PLACEMENT_SEED, placementPermutation } from './watermark/layout.js';
export { DEFAULT_PILOT_SEED, getPilotPattern, pilotActive, pilotBit, pilotConfidence } from './sync/pilot.js';
export { rotateImageData } from './geometry/rotate.js';
export { searchRotationFromImageData } from './sync/rotation.js';
export { computeHomography, invertHomography, transformPoint } from './geometry/homography.js';
export { rectifyPerspective, warpPerspective } from './geometry/perspective.js';
export { createDecodeWorker };
export { confidenceLabel, createCameraDetector, trackingDecodeOptions } from './browser/camera.js';
export { adjustBrightness, cropImageData, resizeImageData } from './benchmark/attacks.js';
export { analyzeRobustness } from './benchmark/robustness.js';
export { analyzeTextureBlock } from './perceptual/texture.js';
export const QUALITY_PRESETS = {
    invisible: { strength: 14, textureThreshold: 0.10, minStrengthFactor: 0.30 },
    balanced: { strength: 18, textureThreshold: 0.08, minStrengthFactor: 0.35 },
    robust: { strength: 22, textureThreshold: 0.06, minStrengthFactor: 0.45 },
};
export async function encode(input, options) {
    if (!options.payload && !options.fingerprint) {
        throw new Error('Provide either options.payload or options.fingerprint.');
    }
    if (options.payload && options.fingerprint) {
        throw new Error('Provide payload or fingerprint, not both.');
    }
    const fingerprint = options.fingerprint ?? await fingerprintFromPayload(options.payload);
    if (!/^[0-9a-fA-F]{16}$/.test(fingerprint)) {
        throw new Error('Fingerprint must be exactly 16 hexadecimal characters.');
    }
    const preset = QUALITY_PRESETS[options.watermarkQuality ?? 'invisible'];
    const strength = options.strength ?? preset.strength;
    const density = Math.max(1, Math.floor(options.density ?? 1));
    if (!(strength > 0 && strength <= 100)) {
        throw new Error('strength must be > 0 and <= 100.');
    }
    const loaded = await loadImage(input);
    const embedded = embedFingerprintIntoImageData(loaded.imageData, fingerprint.toLowerCase(), {
        strength,
        density,
        adaptive: options.adaptive ?? true,
        textureThreshold: options.textureThreshold ?? preset.textureThreshold,
        minStrengthFactor: preset.minStrengthFactor,
        placementSeed: options.placementSeed,
        pilotSeed: options.pilotSeed,
    });
    const blob = await imageDataToBlob(embedded.imageData, options.outputType ?? 'image/png', options.quality ?? 0.92);
    return {
        blob,
        fingerprint: fingerprint.toLowerCase(),
        width: loaded.width,
        height: loaded.height,
        blocksUsed: embedded.blocksUsed,
        repetitionsPerBit: embedded.repetitionsPerBit,
        tileBlocks: embedded.tileBlocks,
        blocksSkippedSmooth: embedded.blocksSkippedSmooth,
        averageStrength: embedded.averageStrength,
    };
}
export async function decode(input, options = {}) {
    const density = Math.max(1, Math.floor(options.density ?? 1));
    const loaded = await loadImage(input);
    let workingImage = loaded.imageData;
    let perspectiveCorrected = false;
    if (options.perspectiveCorners) {
        try {
            workingImage = rectifyPerspective(loaded.imageData, options.perspectiveCorners);
            perspectiveCorrected = true;
        }
        catch {
            workingImage = loaded.imageData;
        }
    }
    const engineOptions = {
        density,
        minMargin: options.minMargin ?? 8,
        robust: options.robust ?? true,
        blockSizes: options.blockSizes,
        offsetStep: options.offsetStep,
        placementSeed: options.placementSeed,
        pilotSeed: options.pilotSeed,
    };
    const result = options.searchRotation
        ? searchRotationFromImageData(workingImage, engineOptions, {
            maxRotationDeg: options.maxRotationDeg,
            coarseStepDeg: options.coarseRotationStepDeg,
            fineStepDeg: options.fineRotationStepDeg,
            rotationCandidates: options.rotationCandidates,
        })
        : detectFingerprintFromImageData(workingImage, engineOptions);
    result.sync.perspectiveCorrected = perspectiveCorrected;
    return {
        ...result,
        width: loaded.width,
        height: loaded.height,
    };
}
/** Decode off the UI thread using a short-lived module worker. */
export async function decodeInWorker(input, options = {}) {
    const loaded = await loadImage(input);
    const client = createDecodeWorker();
    try {
        return await client.decodeImageData(loaded.imageData, options);
    }
    finally {
        client.terminate();
    }
}
/**
 * Visualize the otherwise invisible frequency-domain signal.
 * `reveal()` does not alter the protected source; it returns a diagnostic image.
 */
export async function reveal(input, options = {}) {
    const loaded = await loadImage(input);
    const density = Math.max(1, Math.floor(options.density ?? 1));
    const detectionEngine = options.transform
        ? detectFingerprintAtTransformFromImageData(loaded.imageData, options.transform, {
            density,
            minMargin: options.minMargin ?? 8,
            placementSeed: options.placementSeed,
            pilotSeed: options.pilotSeed,
        })
        : detectFingerprintFromImageData(loaded.imageData, {
            density,
            minMargin: options.minMargin ?? 8,
            robust: options.robust ?? true,
            blockSizes: options.blockSizes,
            offsetStep: options.offsetStep,
            placementSeed: options.placementSeed,
            pilotSeed: options.pilotSeed,
        });
    const transform = options.transform ?? detectionEngine.transform;
    const revealed = revealWatermarkFromImageData(loaded.imageData, {
        transform,
        boost: options.boost ?? 6,
    });
    const blob = await imageDataToBlob(revealed, options.outputType ?? 'image/png', options.quality ?? 0.92);
    return {
        blob,
        detection: {
            ...detectionEngine,
            width: loaded.width,
            height: loaded.height,
        },
    };
}
//# sourceMappingURL=index.js.map