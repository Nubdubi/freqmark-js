export interface TextureMetrics {
    variance: number;
    contrast: number;
    gradient: number;
    edgeDensity: number;
    entropy: number;
    /** Normalized perceptual texture score in the inclusive range 0..1. */
    score: number;
}
export interface TextureScoreOptions {
    varianceWeight?: number;
    contrastWeight?: number;
    gradientWeight?: number;
    edgeWeight?: number;
    entropyWeight?: number;
}
/**
 * Analyze an 8-bit luminance block without depending on Canvas or browser APIs.
 * The input can be centered DCT samples (-128..127) or ordinary luma (0..255).
 */
export declare function analyzeTextureBlock(samples: ArrayLike<number>, width: number, height: number, options?: TextureScoreOptions): TextureMetrics;
//# sourceMappingURL=texture.d.ts.map