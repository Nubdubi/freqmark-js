export interface QualityMetrics {
  psnr: number;
  ssim: number;
  mse: number;
}

/** Measure RGB distortion. Alpha is intentionally ignored. */
export function measureImageQuality(original: ImageData, changed: ImageData): QualityMetrics {
  if (original.width !== changed.width || original.height !== changed.height) {
    throw new Error('Quality metrics require equal image dimensions.');
  }
  const pixels = original.width * original.height;
  if (pixels === 0) return { mse: 0, psnr: Infinity, ssim: 1 };

  let squaredError = 0;
  let sumX = 0;
  let sumY = 0;
  const lumaX = new Float64Array(pixels);
  const lumaY = new Float64Array(pixels);
  for (let p = 0; p < pixels; p++) {
    const i = p * 4;
    for (let c = 0; c < 3; c++) {
      const delta = original.data[i + c] - changed.data[i + c];
      squaredError += delta * delta;
    }
    const x = 0.299 * original.data[i] + 0.587 * original.data[i + 1] + 0.114 * original.data[i + 2];
    const y = 0.299 * changed.data[i] + 0.587 * changed.data[i + 1] + 0.114 * changed.data[i + 2];
    lumaX[p] = x;
    lumaY[p] = y;
    sumX += x;
    sumY += y;
  }
  const mse = squaredError / (pixels * 3);
  const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
  const meanX = sumX / pixels;
  const meanY = sumY / pixels;
  let varianceX = 0;
  let varianceY = 0;
  let covariance = 0;
  for (let p = 0; p < pixels; p++) {
    const dx = lumaX[p] - meanX;
    const dy = lumaY[p] - meanY;
    varianceX += dx * dx;
    varianceY += dy * dy;
    covariance += dx * dy;
  }
  const divisor = Math.max(1, pixels - 1);
  varianceX /= divisor;
  varianceY /= divisor;
  covariance /= divisor;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const ssim = ((2 * meanX * meanY + c1) * (2 * covariance + c2)) /
    ((meanX * meanX + meanY * meanY + c1) * (varianceX + varianceY + c2));
  return { mse, psnr, ssim: Math.max(-1, Math.min(1, ssim)) };
}
