globalThis.ImageData = class ImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
};

const { embedSignedQim, readSignedQim } = await import('../dist/core/qim.js');
const { measureImageQuality } = await import('../dist/core/metrics.js');
const { embedFingerprintIntoImageData, detectFingerprintFromImageData } = await import('../dist/watermark/engine.js');

for (const value of [-91, -22, -0.01, 0, 0.01, 19, 87]) {
  for (const bit of [0, 1]) {
    const embedded = embedSignedQim(value, bit, 14);
    if (readSignedQim(embedded) !== bit || !Number.isFinite(embedded)) process.exit(1);
  }
}
// When the carrier is in the wrong decision region, QIM crosses by only half
// a step instead of forcing the full legacy separation target.
for (const [value, bit] of [[-91, 1], [87, 0]]) {
  const qim = embedSignedQim(value, bit, 22);
  const legacy = bit === 1 ? 22 : -22;
  if (Math.abs(qim - value) > Math.abs(legacy - value) + 1e-9) process.exit(1);
}

const width = 640;
const height = 480;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4;
  const value = x < width / 3 ? 120 + Math.round(y * 8 / height) : (x * 3 + y * 5 + x * y % 97) % 256;
  data[i] = value; data[i + 1] = (value + (x % 17)) % 256; data[i + 2] = value; data[i + 3] = 255;
}
const original = new ImageData(data, width, height);
const fingerprint = '7a91fc12deadbeef';
const adaptive = embedFingerprintIntoImageData(original, fingerprint, { strength: 22, density: 1, adaptive: true, textureThreshold: 0.08 });
const allBlocks = embedFingerprintIntoImageData(original, fingerprint, { strength: 22, density: 1, adaptive: false });
const adaptiveQuality = measureImageQuality(original, adaptive.imageData);
const baselineQuality = measureImageQuality(original, allBlocks.imageData);
const decoded = detectFingerprintFromImageData(adaptive.imageData, { density: 1, minMargin: 4 });

if (!decoded.found || decoded.fingerprint !== fingerprint) process.exit(1);
if (!(adaptiveQuality.psnr > baselineQuality.psnr && adaptiveQuality.ssim >= baselineQuality.ssim)) {
  console.error({ adaptiveQuality, baselineQuality }); process.exit(1);
}
console.log('freqmark-js QIM/quality test passed', { adaptiveQuality, baselineQuality, averageStrength: adaptive.averageStrength });
