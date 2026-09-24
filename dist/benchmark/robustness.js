import { imageDataToBlob, loadImage } from '../browser/image.js';
import { fingerprintFromPayload } from '../watermark/fingerprint.js';
import { detectFingerprintFromImageData, embedFingerprintIntoImageData } from '../watermark/engine.js';
import { searchRotationFromImageData } from '../sync/rotation.js';
import { adjustBrightness, cropImageData, resizeImageData, rotateImageData } from './attacks.js';
async function jpegAttack(image, quality) {
    const blob = await imageDataToBlob(image, 'image/jpeg', quality);
    return (await loadImage(blob)).imageData;
}
export async function analyzeRobustness(input, options) {
    if (!options.payload && !options.fingerprint)
        throw new Error('Provide payload or fingerprint.');
    const fingerprint = (options.fingerprint ?? await fingerprintFromPayload(options.payload)).toLowerCase();
    const source = (await loadImage(input)).imageData;
    const embedded = embedFingerprintIntoImageData(source, fingerprint, {
        strength: options.strength ?? 30, density: 1, adaptive: true,
    }).imageData;
    const cases = [
        ['original', embedded, [8]],
        ['resize75', resizeImageData(embedded, 0.75), [6]],
        ['resize125', resizeImageData(embedded, 1.25), [10]],
        ['crop10', cropImageData(embedded, 0.10), [8]],
        ['crop25', cropImageData(embedded, 0.25), [8]],
        ['brightnessPlus20', adjustBrightness(embedded, 20), [8]],
        ['rotate5', rotateImageData(embedded, 5), [8], -5],
        ['rotate10', rotateImageData(embedded, 10), [8], -10],
        ['rotate15', rotateImageData(embedded, 15), [8], -15],
        ['crop15Resize75', resizeImageData(cropImageData(embedded, 0.15), 0.75), [6]],
    ];
    if (options.includeJpeg ?? true) {
        for (const quality of [0.90, 0.75, 0.60, 0.45])
            cases.push([`jpeg${Math.round(quality * 100)}`, await jpegAttack(embedded, quality), [8]]);
    }
    const report = {};
    for (const [name, image, blockSizes, rotation] of cases) {
        const start = performance.now();
        const detectOptions = { density: 1, minMargin: 8, robust: true, blockSizes, offsetStep: 1 };
        const result = rotation === undefined
            ? detectFingerprintFromImageData(image, detectOptions)
            : searchRotationFromImageData(image, detectOptions, { maxRotationDeg: 20, rotationCandidates: [rotation - 1, rotation, rotation + 1] });
        report[name] = {
            found: result.found,
            confidence: result.confidence,
            fingerprintMatch: result.fingerprint === fingerprint,
            elapsedMs: performance.now() - start,
        };
    }
    return report;
}
//# sourceMappingURL=robustness.js.map