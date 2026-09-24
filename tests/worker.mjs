globalThis.ImageData = class ImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
};

const { processDecodeRequest } = await import('../dist/browser/worker/processor.js');
const { embedFingerprintIntoImageData } = await import('../dist/watermark/engine.js');
const width = 256; const height = 256;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4; const value = (x * 7 + y * 11 + x * y) % 256;
  data[i] = value; data[i + 1] = (value * 3) % 256; data[i + 2] = (value * 5) % 256; data[i + 3] = 255;
}
const fingerprint = '7a91fc12deadbeef';
const embedded = embedFingerprintIntoImageData(new ImageData(data, width, height), fingerprint, { strength: 30, density: 1, adaptive: false }).imageData;
const pixels = new Uint8ClampedArray(embedded.data);
const response = processDecodeRequest({
  type: 'decode', id: 42, width, height, pixels: pixels.buffer,
  options: { density: 1, minMargin: 8, robust: false },
});
if (response.id !== 42 || !response.result.found || response.result.fingerprint !== fingerprint || response.elapsedMs < 0) process.exit(1);
console.log('freqmark-js worker processor test passed', { elapsedMs: response.elapsedMs });
