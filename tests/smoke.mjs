// Node-only smoke test for the core engine. No browser canvas is required.
globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

const {
  embedFingerprintIntoImageData,
  detectFingerprintFromImageData,
} = await import('../dist/watermark/engine.js');

const width = 640;
const height = 480;
const data = new Uint8ClampedArray(width * height * 4);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const base = (x * 3 + y * 5 + (x * y) % 97) % 256;
    data[i] = base;
    data[i + 1] = (base * 7 + 33) % 256;
    data[i + 2] = (base * 11 + 77) % 256;
    data[i + 3] = 255;
  }
}

const fingerprint = '7a91fc12deadbeef';
const image = new ImageData(data, width, height);
const embedded = embedFingerprintIntoImageData(image, fingerprint, {
  strength: 22,
  density: 1,
});

const result = detectFingerprintFromImageData(embedded.imageData, {
  density: 1,
  minMargin: 8,
});

if (!result.found || result.fingerprint !== fingerprint) {
  console.error(result);
  process.exit(1);
}
if (!Number.isInteger(result.correctedBits) || result.correctedBits < 0) process.exit(1);

const legacy = embedFingerprintIntoImageData(image, fingerprint, {
  strength: 22,
  density: 1,
  adaptive: false,
  frameVersion: 2,
});
const legacyResult = detectFingerprintFromImageData(legacy.imageData, {
  density: 1,
  minMargin: 8,
});
if (!legacyResult.found || legacyResult.fingerprint !== fingerprint || legacyResult.frame.version !== 2) {
  console.error('v2 spatial compatibility failed', legacyResult);
  process.exit(1);
}

const customSeed = 'tenant-public-layout-v1';
const custom = embedFingerprintIntoImageData(image, fingerprint, {
  strength: 22,
  density: 1,
  placementSeed: customSeed,
});
const customResult = detectFingerprintFromImageData(custom.imageData, {
  density: 1,
  minMargin: 8,
  placementSeed: customSeed,
});
if (!customResult.found || customResult.fingerprint !== fingerprint) {
  console.error('custom placement seed roundtrip failed', customResult);
  process.exit(1);
}

console.log('freqmark-js smoke test passed');
console.log({
  fingerprint: result.fingerprint,
  confidence: result.confidence,
  blocksRead: result.blocksRead,
  repetitionsPerBit: result.repetitionsPerBit,
});
