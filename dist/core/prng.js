/** Stable 32-bit FNV-1a hash for public layout seeds. Not cryptographic. */
export function hashSeed(value) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}
export function createMulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
    };
}
export function createPermutation(length, seed) {
    if (!Number.isInteger(length) || length < 0)
        throw new Error('Permutation length must be a non-negative integer.');
    const result = Uint32Array.from({ length }, (_, index) => index);
    const random = createMulberry32(seed);
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const value = result[i];
        result[i] = result[j];
        result[j] = value;
    }
    return result;
}
//# sourceMappingURL=prng.js.map