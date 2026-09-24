import { rotateImageData } from '../geometry/rotate.js';
import { detectFingerprintFromImageData } from '../watermark/engine.js';
function candidateScore(result) {
    return (result.found ? 2 : 0) + result.confidence + result.sync.confidence * 0.25;
}
export function searchRotationFromImageData(source, detectOptions, searchOptions = {}) {
    const max = Math.max(0, Math.min(30, searchOptions.maxRotationDeg ?? 15));
    const coarseStep = Math.max(1, searchOptions.coarseStepDeg ?? 3);
    const fineStep = Math.max(0.25, searchOptions.fineStepDeg ?? 1);
    const explicit = searchOptions.rotationCandidates;
    const coarse = explicit?.length
        ? [...new Set(explicit.map((angle) => Math.max(-max, Math.min(max, angle))))]
        : Array.from({ length: Math.floor((max * 2) / coarseStep) + 1 }, (_, i) => -max + i * coarseStep);
    let best = null;
    let bestAngle = 0;
    let totalCandidates = 0;
    const evaluatedAngles = new Set();
    const evaluate = (angle) => {
        const key = Math.round(angle * 1000) / 1000;
        if (evaluatedAngles.has(key))
            return;
        evaluatedAngles.add(key);
        const normalized = rotateImageData(source, angle);
        const result = detectFingerprintFromImageData(normalized, {
            ...detectOptions,
            robust: false,
            blockSizes: detectOptions.blockSizes?.length ? detectOptions.blockSizes : [8],
        });
        totalCandidates += result.candidatesTested;
        if (!best || candidateScore(result) > candidateScore(best)) {
            best = result;
            bestAngle = angle;
        }
    };
    for (const angle of coarse)
        evaluate(angle);
    if (!explicit?.length) {
        const coarseBest = best;
        if (coarseBest?.found) {
            for (let angle = bestAngle - coarseStep; angle <= bestAngle + coarseStep + 1e-9; angle += fineStep) {
                if (angle >= -max && angle <= max)
                    evaluate(angle);
            }
        }
        else {
            // Pilot-only rankings can be ambiguous after resampling. Preserve the
            // correctness baseline by filling the fine grid when coarse search has no valid CRC.
            for (let angle = -max; angle <= max + 1e-9; angle += fineStep)
                evaluate(angle);
        }
    }
    const result = best;
    return {
        ...result,
        candidatesTested: totalCandidates,
        sync: { ...result.sync, rotationDeg: bestAngle },
    };
}
//# sourceMappingURL=rotation.js.map