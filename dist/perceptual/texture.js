const DEFAULT_WEIGHTS = {
    variance: 0.28,
    contrast: 0.12,
    gradient: 0.28,
    edge: 0.18,
    entropy: 0.14,
};
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
/**
 * Analyze an 8-bit luminance block without depending on Canvas or browser APIs.
 * The input can be centered DCT samples (-128..127) or ordinary luma (0..255).
 */
export function analyzeTextureBlock(samples, width, height, options = {}) {
    if (width < 1 || height < 1 || samples.length < width * height) {
        throw new Error('Texture block dimensions do not match the supplied samples.');
    }
    const count = width * height;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    const histogram = new Uint16Array(16);
    for (let i = 0; i < count; i++) {
        const value = samples[i];
        sum += value;
        min = Math.min(min, value);
        max = Math.max(max, value);
    }
    const centered = min < 0;
    for (let i = 0; i < count; i++) {
        const luma = samples[i] + (centered ? 128 : 0);
        histogram[Math.max(0, Math.min(15, Math.floor(luma / 16)))]++;
    }
    const mean = sum / count;
    let squared = 0;
    let gradientSum = 0;
    let gradientCount = 0;
    let edges = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const delta = samples[i] - mean;
            squared += delta * delta;
            if (x + 1 < width) {
                const g = Math.abs(samples[i + 1] - samples[i]);
                gradientSum += g;
                gradientCount++;
                if (g >= 12)
                    edges++;
            }
            if (y + 1 < height) {
                const g = Math.abs(samples[i + width] - samples[i]);
                gradientSum += g;
                gradientCount++;
                if (g >= 12)
                    edges++;
            }
        }
    }
    let entropy = 0;
    for (const bin of histogram) {
        if (bin === 0)
            continue;
        const p = bin / count;
        entropy -= p * Math.log2(p);
    }
    const variance = squared / count;
    const contrast = max - min;
    const gradient = gradientCount ? gradientSum / gradientCount : 0;
    const edgeDensity = gradientCount ? edges / gradientCount : 0;
    const normalized = {
        variance: clamp01(Math.sqrt(variance) / 48),
        contrast: clamp01(contrast / 160),
        gradient: clamp01(gradient / 32),
        edge: edgeDensity,
        entropy: clamp01(entropy / 4),
    };
    const weights = {
        variance: options.varianceWeight ?? DEFAULT_WEIGHTS.variance,
        contrast: options.contrastWeight ?? DEFAULT_WEIGHTS.contrast,
        gradient: options.gradientWeight ?? DEFAULT_WEIGHTS.gradient,
        edge: options.edgeWeight ?? DEFAULT_WEIGHTS.edge,
        entropy: options.entropyWeight ?? DEFAULT_WEIGHTS.entropy,
    };
    const weightTotal = Object.values(weights).reduce((total, value) => total + Math.max(0, value), 0);
    const score = weightTotal === 0 ? 0 : clamp01((normalized.variance * Math.max(0, weights.variance) +
        normalized.contrast * Math.max(0, weights.contrast) +
        normalized.gradient * Math.max(0, weights.gradient) +
        normalized.edge * Math.max(0, weights.edge) +
        normalized.entropy * Math.max(0, weights.entropy)) / weightTotal);
    return { variance, contrast, gradient, edgeDensity, entropy, score };
}
//# sourceMappingURL=texture.js.map