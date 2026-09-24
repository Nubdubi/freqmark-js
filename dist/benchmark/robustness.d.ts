import { type BrowserImageInput } from '../browser/image.js';
export interface RobustnessCaseResult {
    found: boolean;
    confidence: number;
    fingerprintMatch: boolean;
    elapsedMs: number;
}
export type RobustnessReport = Record<string, RobustnessCaseResult>;
export interface AnalyzeRobustnessOptions {
    payload?: string;
    fingerprint?: string;
    strength?: number;
    includeJpeg?: boolean;
}
export declare function analyzeRobustness(input: BrowserImageInput, options: AnalyzeRobustnessOptions): Promise<RobustnessReport>;
//# sourceMappingURL=robustness.d.ts.map