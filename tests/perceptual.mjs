globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

const { analyzeTextureBlock } = await import('../dist/perceptual/texture.js');
const { embedFingerprintIntoImageData } = await import('../dist/watermark/engine.js');

const smooth = new Float32Array(64).fill(120);
const gradient = Float32Array.from({ length: 64 }, (_, i) => (i % 8) * 2);
const textured = Float32Array.from({ length: 64 }, (_, i) => ((i * 73 + (i % 7) * 41) % 256));
const scores = {
  smooth: analyzeTextureBlock(smooth, 8, 8).score,
  gradient: analyzeTextureBlock(gradient, 8, 8).score,
  textured: analyzeTextureBlock(textured, 8, 8).score,
};

if (scores.smooth !== 0 || !(scores.textured > scores.gradient && scores.gradient > scores.smooth)) {
  console.error('Unexpected perceptual ordering', scores);
  process.exit(1);
}

const width = 256;
const height = 256;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const value = x < width / 2 ? 128 : (x * 31 + y * 47 + x * y) % 256;
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  }
}
const result = embedFingerprintIntoImageData(
  new ImageData(data, width, height),
  '7a91fc12deadbeef',
  { strength: 22, density: 1, adaptive: true, textureThreshold: 0.08 },
);
if (result.blocksSkippedSmooth < 400 || result.blocksUsed < 224) {
  console.error('Smooth block filtering did not behave as expected', result);
  process.exit(1);
}

console.log('freqmark-js perceptual test passed', { scores, blocksUsed: result.blocksUsed, blocksSkippedSmooth: result.blocksSkippedSmooth });
