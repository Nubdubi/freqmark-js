import type { Block8 } from '../core/dct.js';
import { embedSignedQim, readSignedQim } from '../core/qim.js';

// Mid-frequency coefficient pair. Kept away from DC and very high frequencies.
export const COEFF_A = { x: 3, y: 2 } as const;
export const COEFF_B = { x: 2, y: 3 } as const;
export const PILOT_COEFF_A = { x: 4, y: 2 } as const;
export const PILOT_COEFF_B = { x: 2, y: 4 } as const;

export function embedCoefficientPair(
  coeff: Block8,
  first: { x: number; y: number },
  second: { x: number; y: number },
  bit: number,
  strength: number,
): void {
  const a = coeff[first.y][first.x];
  const b = coeff[second.y][second.x];
  const midpoint = (a + b) / 2;
  const difference = embedSignedQim(a - b, bit === 1 ? 1 : 0, strength);
  coeff[first.y][first.x] = midpoint + difference / 2;
  coeff[second.y][second.x] = midpoint - difference / 2;
}

export function embedBit(coeff: Block8, bit: number, strength: number): void {
  embedCoefficientPair(coeff, COEFF_A, COEFF_B, bit, strength);
}

export function readBit(coeff: Block8): { bit: number; margin: number; signedMargin: number } {
  const a = coeff[COEFF_A.y][COEFF_A.x];
  const b = coeff[COEFF_B.y][COEFF_B.x];
  const signedMargin = a - b;
  return {
    bit: readSignedQim(signedMargin),
    margin: Math.abs(signedMargin),
    signedMargin,
  };
}
