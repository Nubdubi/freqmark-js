globalThis.ImageData = class ImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
};

const { computeHomography, transformPoint } = await import('../dist/geometry/homography.js');
const { rectifyPerspective, warpPerspective } = await import('../dist/geometry/perspective.js');
const { embedFingerprintIntoImageData, detectFingerprintFromImageData } = await import('../dist/watermark/engine.js');

const width = 512; const height = 512;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4; const base = (x * 3 + y * 5 + x * y % 97) % 256;
  data[i] = base; data[i + 1] = (base * 7 + 33) % 256; data[i + 2] = (base * 11 + 77) % 256; data[i + 3] = 255;
}
const sourceQuad = [{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }];
const trapezoid = [{ x: 42, y: 24 }, { x: 475, y: 55 }, { x: 496, y: 474 }, { x: 18, y: 493 }];
const h = computeHomography(sourceQuad, trapezoid);
for (let i = 0; i < 4; i++) {
  const mapped = transformPoint(h, sourceQuad[i]);
  if (Math.hypot(mapped.x - trapezoid[i].x, mapped.y - trapezoid[i].y) > 1e-6) process.exit(1);
}
const fingerprint = '7a91fc12deadbeef';
const embedded = embedFingerprintIntoImageData(new ImageData(data, width, height), fingerprint, { strength: 50, density: 1, adaptive: false }).imageData;
const attacked = warpPerspective(embedded, h, width, height);
const rectified = rectifyPerspective(attacked, trapezoid, width, height);
const result = detectFingerprintFromImageData(rectified, { density: 1, minMargin: 8, robust: false, blockSizes: [8] });
if (!result.found || result.fingerprint !== fingerprint) {
  console.error('perspective recovery failed', result); process.exit(1);
}
console.log('freqmark-js perspective test passed', { confidence: result.confidence, sync: result.sync.confidence });
