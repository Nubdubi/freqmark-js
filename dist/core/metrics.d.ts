export interface QualityMetrics {
    psnr: number;
    ssim: number;
    mse: number;
}
/** Measure RGB distortion. Alpha is intentionally ignored. */
export declare function measureImageQuality(original: ImageData, changed: ImageData): QualityMetrics;
//# sourceMappingURL=metrics.d.ts.map