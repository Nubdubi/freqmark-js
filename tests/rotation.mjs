globalThis.ImageData = class ImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
};

const { rotateImageData } = await import('../dist/geometry/rotate.js');
const { searchRotationFromImageData } = await import('../dist/sync/rotation.js');
const { embedFingerprintIntoImageData } = await import('../dist/watermark/engine.js');

const width = 384;
const height = 384;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4;
  const base = (x * 3 + y * 5 + (x * y) % 97) % 256;
  data[i] = base; data[i + 1] = (base * 7 + 33) % 256; data[i + 2] = (base * 11 + 77) % 256; data[i + 3] = 255;
}
const fingerprint = '7a91fc12deadbeef';
const embedded = embedFingerprintIntoImageData(new ImageData(data, width, height), fingerprint, { strength: 40, density: 1, adaptive: false }).imageData;

for (const attackAngle of [3, -3, 7, -7, 12, -12]) {
  const attacked = rotateImageData(embedded, attackAngle);
  const correction = -attackAngle;
  const result = searchRotationFromImageData(attacked, { density: 1, minMargin: 8 }, {
    maxRotationDeg: 15,
    rotationCandidates: [correction - 1, correction, correction + 1],
  });
  if (!result.found || result.fingerprint !== fingerprint || Math.abs(result.sync.rotationDeg - correction) > 1.01) {
    console.error('rotation recovery failed', { attackAngle, result });
    process.exit(1);
  }
  console.log('rotation', attackAngle, { correction: result.sync.rotationDeg, confidence: result.confidence, sync: result.sync.confidence });
}
const coarseAttack = rotateImageData(embedded, 7);
const coarseResult = searchRotationFromImageData(coarseAttack, { density: 1, minMargin: 8 }, {
  maxRotationDeg: 12,
  coarseStepDeg: 4,
  fineStepDeg: 1,
});
if (!coarseResult.found || coarseResult.fingerprint !== fingerprint || Math.abs(coarseResult.sync.rotationDeg + 7) > 1.01) {
  console.error('coarse-to-fine rotation search failed', coarseResult);
  process.exit(1);
}
console.log('freqmark-js rotation test passed');
