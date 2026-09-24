export type WatermarkBit = 0 | 1;
/**
 * Quantize a signed carrier difference onto one of two half-lattices.
 * Positive buckets encode 1 and negative buckets encode 0. When the carrier
 * already has the requested sign, the nearest bucket is used; otherwise only
 * the minimum decision margin is crossed.
 */
export declare function embedSignedQim(value: number, bit: WatermarkBit, step: number): number;
export declare function readSignedQim(value: number): WatermarkBit;
//# sourceMappingURL=qim.d.ts.map