import type { Block8 } from '../core/dct.js';
export declare const COEFF_A: {
    readonly x: 3;
    readonly y: 2;
};
export declare const COEFF_B: {
    readonly x: 2;
    readonly y: 3;
};
export declare const PILOT_COEFF_A: {
    readonly x: 4;
    readonly y: 2;
};
export declare const PILOT_COEFF_B: {
    readonly x: 2;
    readonly y: 4;
};
export declare function embedCoefficientPair(coeff: Block8, first: {
    x: number;
    y: number;
}, second: {
    x: number;
    y: number;
}, bit: number, strength: number): void;
export declare function embedBit(coeff: Block8, bit: number, strength: number): void;
export declare function readBit(coeff: Block8): {
    bit: number;
    margin: number;
    signedMargin: number;
};
//# sourceMappingURL=coefficients.d.ts.map