import { type DetectEngineOptions, type DetectEngineResult } from '../watermark/engine.js';
export interface RotationSearchOptions {
    maxRotationDeg?: number;
    coarseStepDeg?: number;
    fineStepDeg?: number;
    /** Optional explicit correction angles, useful for constrained camera tracking. */
    rotationCandidates?: number[];
}
export declare function searchRotationFromImageData(source: ImageData, detectOptions: DetectEngineOptions, searchOptions?: RotationSearchOptions): DetectEngineResult;
//# sourceMappingURL=rotation.d.ts.map