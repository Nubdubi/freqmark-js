import { FRAME_BITS } from './frame.js';
import { createPermutation, hashSeed } from '../core/prng.js';
/**
 * Spatial period in DCT blocks. Every tile independently carries repeated frame bits.
 * This makes the layout recoverable after cropping by scanning phaseX/phaseY.
 */
export const LEGACY_TILE_BLOCKS = 16;
export const TILE_BLOCKS = 18;
export const DEFAULT_PLACEMENT_SEED = 'freqmark-public-layout';
const permutationCache = new Map();
const MAX_CACHE_ENTRIES = 32;
function validatePublicSeed(seed) {
    if (seed.length === 0 || seed.length > 256) {
        throw new Error('Public placement seed must contain 1..256 characters.');
    }
}
export function placementPermutation(frameBits, version = 3, publicSeed = DEFAULT_PLACEMENT_SEED) {
    validatePublicSeed(publicSeed);
    const key = `${version}:${frameBits}:${publicSeed}`;
    let permutation = permutationCache.get(key);
    if (!permutation) {
        permutation = createPermutation(frameBits, hashSeed(key));
        if (permutationCache.size >= MAX_CACHE_ENTRIES) {
            const oldest = permutationCache.keys().next().value;
            if (oldest !== undefined)
                permutationCache.delete(oldest);
        }
        permutationCache.set(key, permutation);
    }
    return permutation;
}
export function mod(value, base) {
    return ((value % base) + base) % base;
}
/** Map a spatial DCT block to one bit slot in the fingerprint frame. */
export function slotForBlock(blockX, blockY, phaseX = 0, phaseY = 0, tileBlocks = TILE_BLOCKS, frameBits = FRAME_BITS * 3, version = 3, publicSeed = DEFAULT_PLACEMENT_SEED, permutation) {
    const localX = mod(blockX + phaseX, tileBlocks);
    const localY = mod(blockY + phaseY, tileBlocks);
    const linearSlot = (localY * tileBlocks + localX) % frameBits;
    return version >= 3
        ? (permutation ?? placementPermutation(frameBits, version, publicSeed))[linearSlot]
        : linearSlot;
}
//# sourceMappingURL=layout.js.map