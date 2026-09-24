import { embedSignedQim, readSignedQim } from '../core/qim.js';
// Mid-frequency coefficient pair. Kept away from DC and very high frequencies.
export const COEFF_A = { x: 3, y: 2 };
export const COEFF_B = { x: 2, y: 3 };
export const PILOT_COEFF_A = { x: 4, y: 2 };
export const PILOT_COEFF_B = { x: 2, y: 4 };
export function embedCoefficientPair(coeff, first, second, bit, strength) {
    const a = coeff[first.y][first.x];
    const b = coeff[second.y][second.x];
    const midpoint = (a + b) / 2;
    const difference = embedSignedQim(a - b, bit === 1 ? 1 : 0, strength);
    coeff[first.y][first.x] = midpoint + difference / 2;
    coeff[second.y][second.x] = midpoint - difference / 2;
}
export function embedBit(coeff, bit, strength) {
    embedCoefficientPair(coeff, COEFF_A, COEFF_B, bit, strength);
}
export function readBit(coeff) {
    const a = coeff[COEFF_A.y][COEFF_A.x];
    const b = coeff[COEFF_B.y][COEFF_B.x];
    const signedMargin = a - b;
    return {
        bit: readSignedQim(signedMargin),
        margin: Math.abs(signedMargin),
        signedMargin,
    };
}
//# sourceMappingURL=coefficients.js.map