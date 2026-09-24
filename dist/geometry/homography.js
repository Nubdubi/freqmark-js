function solveLinearSystem(matrix, values) {
    const n = values.length;
    const augmented = matrix.map((row, i) => [...row, values[i]]);
    for (let column = 0; column < n; column++) {
        let pivot = column;
        for (let row = column + 1; row < n; row++) {
            if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column]))
                pivot = row;
        }
        if (Math.abs(augmented[pivot][column]) < 1e-10)
            throw new Error('Degenerate homography points.');
        [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
        const divisor = augmented[column][column];
        for (let j = column; j <= n; j++)
            augmented[column][j] /= divisor;
        for (let row = 0; row < n; row++) {
            if (row === column)
                continue;
            const factor = augmented[row][column];
            for (let j = column; j <= n; j++)
                augmented[row][j] -= factor * augmented[column][j];
        }
    }
    return Float64Array.from(augmented.map((row) => row[n]));
}
export function computeHomography(source, destination) {
    const matrix = [];
    const values = [];
    for (let i = 0; i < 4; i++) {
        const { x, y } = source[i];
        const { x: u, y: v } = destination[i];
        matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
        values.push(u);
        matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
        values.push(v);
    }
    const solved = solveLinearSystem(matrix, values);
    return Float64Array.from([...solved, 1]);
}
export function transformPoint(h, point) {
    const denominator = h[6] * point.x + h[7] * point.y + h[8];
    if (Math.abs(denominator) < 1e-12)
        throw new Error('Homography maps point to infinity.');
    return {
        x: (h[0] * point.x + h[1] * point.y + h[2]) / denominator,
        y: (h[3] * point.x + h[4] * point.y + h[5]) / denominator,
    };
}
export function invertHomography(h) {
    const a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], i = h[7], j = h[8];
    const determinant = a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
    if (Math.abs(determinant) < 1e-12)
        throw new Error('Singular homography.');
    return Float64Array.from([
        (e * j - f * i) / determinant, (c * i - b * j) / determinant, (b * f - c * e) / determinant,
        (f * g - d * j) / determinant, (a * j - c * g) / determinant, (c * d - a * f) / determinant,
        (d * i - e * g) / determinant, (b * g - a * i) / determinant, (a * e - b * d) / determinant,
    ]);
}
//# sourceMappingURL=homography.js.map