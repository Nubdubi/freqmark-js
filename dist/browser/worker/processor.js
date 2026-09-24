import { rectifyPerspective } from '../../geometry/perspective.js';
import { searchRotationFromImageData } from '../../sync/rotation.js';
import { detectFingerprintFromImageData } from '../../watermark/engine.js';
export function processDecodeRequest(request) {
    const start = performance.now();
    const { options } = request;
    let image = new ImageData(new Uint8ClampedArray(request.pixels), request.width, request.height);
    let perspectiveCorrected = false;
    if (options.perspectiveCorners) {
        try {
            image = rectifyPerspective(image, options.perspectiveCorners);
            perspectiveCorrected = true;
        }
        catch {
            // Preserve the documented unrectified fallback.
        }
    }
    const detectOptions = {
        density: options.density,
        minMargin: options.minMargin,
        robust: options.robust,
        blockSizes: options.blockSizes,
        offsetStep: options.offsetStep,
        placementSeed: options.placementSeed,
        pilotSeed: options.pilotSeed,
    };
    const result = options.searchRotation
        ? searchRotationFromImageData(image, detectOptions, {
            maxRotationDeg: options.maxRotationDeg,
            coarseStepDeg: options.coarseRotationStepDeg,
            fineStepDeg: options.fineRotationStepDeg,
            rotationCandidates: options.rotationCandidates,
        })
        : detectFingerprintFromImageData(image, detectOptions);
    result.sync.perspectiveCorrected = perspectiveCorrected;
    return { type: 'result', id: request.id, result, elapsedMs: performance.now() - start };
}
//# sourceMappingURL=processor.js.map