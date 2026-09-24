export const BLOCK_SIZE = 8;
const COS = Array.from({ length: BLOCK_SIZE }, (_, x) => Array.from({ length: BLOCK_SIZE }, (_, u) => Math.cos(((2 * x + 1) * u * Math.PI) / 16)));
const C = Array.from({ length: BLOCK_SIZE }, (_, i) => i === 0 ? 1 / Math.sqrt(2) : 1);
export function dct8(block) {
    if (block.length !== BLOCK_SIZE || block.some((row) => row.length !== BLOCK_SIZE)) {
        throw new Error('dct8 expects an 8x8 block.');
    }
    const out = Array.from({ length: BLOCK_SIZE }, () => Array(BLOCK_SIZE).fill(0));
    for (let u = 0; u < BLOCK_SIZE; u++) {
        for (let v = 0; v < BLOCK_SIZE; v++) {
            let sum = 0;
            for (let x = 0; x < BLOCK_SIZE; x++) {
                for (let y = 0; y < BLOCK_SIZE; y++) {
                    sum += block[y][x] * COS[x][u] * COS[y][v];
                }
            }
            out[v][u] = 0.25 * C[u] * C[v] * sum;
        }
    }
    return out;
}
export function idct8(coeff) {
    if (coeff.length !== BLOCK_SIZE || coeff.some((row) => row.length !== BLOCK_SIZE)) {
        throw new Error('idct8 expects an 8x8 coefficient block.');
    }
    const out = Array.from({ length: BLOCK_SIZE }, () => Array(BLOCK_SIZE).fill(0));
    for (let x = 0; x < BLOCK_SIZE; x++) {
        for (let y = 0; y < BLOCK_SIZE; y++) {
            let sum = 0;
            for (let u = 0; u < BLOCK_SIZE; u++) {
                for (let v = 0; v < BLOCK_SIZE; v++) {
                    sum += C[u] * C[v] * coeff[v][u] * COS[x][u] * COS[y][v];
                }
            }
            out[y][x] = 0.25 * sum;
        }
    }
    return out;
}
//# sourceMappingURL=dct.js.map