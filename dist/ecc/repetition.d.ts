import type { EccCodec, EccDecodeResult } from './codec.js';
export declare class RepetitionCodec implements EccCodec {
    readonly repetitions: number;
    constructor(repetitions?: number);
    encode(data: Uint8Array): Uint8Array;
    decode(data: Uint8Array): EccDecodeResult;
}
export declare const repetition3: RepetitionCodec;
//# sourceMappingURL=repetition.d.ts.map