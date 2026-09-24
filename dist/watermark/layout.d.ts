/**
 * Spatial period in DCT blocks. Every tile independently carries repeated frame bits.
 * This makes the layout recoverable after cropping by scanning phaseX/phaseY.
 */
export declare const LEGACY_TILE_BLOCKS = 16;
export declare const TILE_BLOCKS = 18;
export declare const DEFAULT_PLACEMENT_SEED = "freqmark-public-layout";
export declare function placementPermutation(frameBits: number, version?: number, publicSeed?: string): Uint32Array;
export declare function mod(value: number, base: number): number;
/** Map a spatial DCT block to one bit slot in the fingerprint frame. */
export declare function slotForBlock(blockX: number, blockY: number, phaseX?: number, phaseY?: number, tileBlocks?: number, frameBits?: number, version?: number, publicSeed?: string, permutation?: Uint32Array): number;
//# sourceMappingURL=layout.d.ts.map