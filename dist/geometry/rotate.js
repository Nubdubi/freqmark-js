function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}
/** Rotate around the image center into a same-size canvas using bilinear sampling. */
export function rotateImageData(source, angleDeg) {
    if (Math.abs(angleDeg) < 1e-9) {
        return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
    }
    const out = new Uint8ClampedArray(source.data.length);
    const radians = angleDeg * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const cx = (source.width - 1) / 2;
    const cy = (source.height - 1) / 2;
    for (let y = 0; y < source.height; y++)
        for (let x = 0; x < source.width; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const sx = cos * dx + sin * dy + cx;
            const sy = -sin * dx + cos * dy + cy;
            const di = (y * source.width + x) * 4;
            if (sx < 0 || sy < 0 || sx > source.width - 1 || sy > source.height - 1) {
                out[di + 3] = 255;
                continue;
            }
            const x0 = Math.floor(sx);
            const y0 = Math.floor(sy);
            const x1 = Math.min(source.width - 1, x0 + 1);
            const y1 = Math.min(source.height - 1, y0 + 1);
            const tx = sx - x0;
            const ty = sy - y0;
            for (let c = 0; c < 4; c++) {
                const top = source.data[(y0 * source.width + x0) * 4 + c] * (1 - tx) + source.data[(y0 * source.width + x1) * 4 + c] * tx;
                const bottom = source.data[(y1 * source.width + x0) * 4 + c] * (1 - tx) + source.data[(y1 * source.width + x1) * 4 + c] * tx;
                out[di + c] = clampByte(top * (1 - ty) + bottom * ty);
            }
        }
    return new ImageData(out, source.width, source.height);
}
//# sourceMappingURL=rotate.js.map