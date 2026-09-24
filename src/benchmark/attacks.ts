import { rotateImageData } from '../geometry/rotate.js';

export function cropImageData(source: ImageData, fraction: number): ImageData {
  const amount = Math.max(0, Math.min(0.45, fraction));
  const left = Math.round(source.width * amount / 2);
  const top = Math.round(source.height * amount / 2);
  const width = source.width - left * 2;
  const height = source.height - top * 2;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const start = ((y + top) * source.width + left) * 4;
    out.set(source.data.subarray(start, start + width * 4), y * width * 4);
  }
  return new ImageData(out, width, height);
}

export function resizeImageData(source: ImageData, scale: number): ImageData {
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = (x + 0.5) / scale - 0.5; const sy = (y + 0.5) / scale - 0.5;
    const x0 = Math.max(0, Math.min(source.width - 1, Math.floor(sx)));
    const y0 = Math.max(0, Math.min(source.height - 1, Math.floor(sy)));
    const x1 = Math.min(source.width - 1, x0 + 1); const y1 = Math.min(source.height - 1, y0 + 1);
    const tx = Math.max(0, Math.min(1, sx - x0)); const ty = Math.max(0, Math.min(1, sy - y0));
    const di = (y * width + x) * 4;
    for (let c = 0; c < 4; c++) {
      const top = source.data[(y0 * source.width + x0) * 4 + c] * (1 - tx) + source.data[(y0 * source.width + x1) * 4 + c] * tx;
      const bottom = source.data[(y1 * source.width + x0) * 4 + c] * (1 - tx) + source.data[(y1 * source.width + x1) * 4 + c] * tx;
      out[di + c] = Math.round(top * (1 - ty) + bottom * ty);
    }
  }
  return new ImageData(out, width, height);
}

export function adjustBrightness(source: ImageData, delta: number): ImageData {
  const out = new Uint8ClampedArray(source.data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = Math.max(0, Math.min(255, out[i] + delta));
    out[i + 1] = Math.max(0, Math.min(255, out[i + 1] + delta));
    out[i + 2] = Math.max(0, Math.min(255, out[i + 2] + delta));
  }
  return new ImageData(out, source.width, source.height);
}

export { rotateImageData };
