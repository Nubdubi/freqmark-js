export declare const DEFAULT_PILOT_SEED = "freqmark-v3-sync-pilot";
export declare function pilotBit(blockX: number, blockY: number, seed?: string): 0 | 1;
/** Select roughly one quarter of blocks for the weak pilot carrier. */
export declare function pilotActive(blockX: number, blockY: number, seed?: string): boolean;
export declare function getPilotPattern(seed?: string): {
    bits: Uint8Array;
    active: Uint8Array;
};
export declare function pilotConfidence(matches: number, total: number): number;
//# sourceMappingURL=pilot.d.ts.map