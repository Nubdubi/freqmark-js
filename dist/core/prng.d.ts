/** Stable 32-bit FNV-1a hash for public layout seeds. Not cryptographic. */
export declare function hashSeed(value: string): number;
export declare function createMulberry32(seed: number): () => number;
export declare function createPermutation(length: number, seed: number): Uint32Array;
//# sourceMappingURL=prng.d.ts.map