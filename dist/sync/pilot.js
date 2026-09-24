import { hashSeed } from '../core/prng.js';
export const DEFAULT_PILOT_SEED = 'freqmark-v3-sync-pilot';
const patternCache = new Map();
const combinedCache = new Map();
const MAX_CACHE_ENTRIES = 32;
function validatePublicSeed(seed) {
    if (seed.length === 0 || seed.length > 256) {
        throw new Error('Public pilot seed must contain 1..256 characters.');
    }
}
function pilotPattern(seed) {
    validatePublicSeed(seed.replace(/:active-[ab]$/, ''));
    let pattern = patternCache.get(seed);
    if (!pattern) {
        pattern = new Uint8Array(32 * 32);
        for (let y = 0; y < 32; y++)
            for (let x = 0; x < 32; x++) {
                const mixed = hashSeed(`${seed}:${x}:${y}`);
                pattern[y * 32 + x] = (mixed ^ (mixed >>> 13) ^ (mixed >>> 23)) & 1;
            }
        if (patternCache.size >= MAX_CACHE_ENTRIES * 3) {
            const oldest = patternCache.keys().next().value;
            if (oldest !== undefined)
                patternCache.delete(oldest);
        }
        patternCache.set(seed, pattern);
    }
    return pattern;
}
export function pilotBit(blockX, blockY, seed = DEFAULT_PILOT_SEED) {
    return pilotPattern(seed)[((blockY & 31) * 32) + (blockX & 31)];
}
/** Select roughly one quarter of blocks for the weak pilot carrier. */
export function pilotActive(blockX, blockY, seed = DEFAULT_PILOT_SEED) {
    const pattern = getPilotPattern(seed);
    return pattern.active[((blockY & 31) * 32) + (blockX & 31)] === 1;
}
export function getPilotPattern(seed = DEFAULT_PILOT_SEED) {
    validatePublicSeed(seed);
    let combined = combinedCache.get(seed);
    if (!combined) {
        const bits = pilotPattern(seed);
        const a = pilotPattern(`${seed}:active-a`);
        const b = pilotPattern(`${seed}:active-b`);
        const active = new Uint8Array(32 * 32);
        for (let i = 0; i < active.length; i++)
            active[i] = a[i] & b[i];
        combined = { bits, active };
        if (combinedCache.size >= MAX_CACHE_ENTRIES) {
            const oldest = combinedCache.keys().next().value;
            if (oldest !== undefined)
                combinedCache.delete(oldest);
        }
        combinedCache.set(seed, combined);
    }
    return combined;
}
export function pilotConfidence(matches, total) {
    if (total <= 0)
        return 0;
    return Math.max(0, Math.min(1, (matches / total - 0.5) * 2));
}
//# sourceMappingURL=pilot.js.map