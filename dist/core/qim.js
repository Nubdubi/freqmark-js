/**
 * Quantize a signed carrier difference onto one of two half-lattices.
 * Positive buckets encode 1 and negative buckets encode 0. When the carrier
 * already has the requested sign, the nearest bucket is used; otherwise only
 * the minimum decision margin is crossed.
 */
export function embedSignedQim(value, bit, step) {
    if (!(step > 0) || !Number.isFinite(step))
        throw new Error('QIM step must be positive.');
    const wantedSign = bit === 1 ? 1 : -1;
    const half = step / 2;
    if (value * wantedSign <= 0)
        return wantedSign * half;
    const magnitude = Math.abs(value);
    const bucket = Math.max(0, Math.round((magnitude - half) / step));
    return wantedSign * (bucket * step + half);
}
export function readSignedQim(value) {
    return value >= 0 ? 1 : 0;
}
//# sourceMappingURL=qim.js.map