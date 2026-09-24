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

function makeImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const base = (x * 3 + y * 5 + (x * y) % 97) % 256;
      data[i] = base;
      data[i + 1] = (base * 7 + 33 + ((x >> 3) * 11)) % 256;
      data[i + 2] = (base * 11 + 77 + ((y >> 3) * 17)) % 256;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

function cropImage(src, left, top, right, bottom) {
  const width = src.width - left - right;
  const height = src.height - top - bottom;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcStart = ((y + top) * src.width + left) * 4;
    const dstStart = y * width * 4;
    out.set(src.data.subarray(srcStart, srcStart + width * 4), dstStart);
  }
  return new ImageData(out, width, height);
}

function resizeNearest(src, scale) {
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      const si = (sy * src.width + sx) * 4;
      const di = (y * width + x) * 4;
      out[di] = src.data[si];
      out[di + 1] = src.data[si + 1];
      out[di + 2] = src.data[si + 2];
      out[di + 3] = 255;
    }
  }
  return new ImageData(out, width, height);
}


function resizeBilinear(src, scale) {
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = (y + 0.5) / scale - 0.5;
    const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(sy)));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, sy - y0));
    for (let x = 0; x < width; x++) {
      const sx = (x + 0.5) / scale - 0.5;
      const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(sx)));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, sx - x0));
      const di = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = src.data[(y0 * src.width + x0) * 4 + c] * (1 - tx) + src.data[(y0 * src.width + x1) * 4 + c] * tx;
        const b = src.data[(y1 * src.width + x0) * 4 + c] * (1 - tx) + src.data[(y1 * src.width + x1) * 4 + c] * tx;
        out[di + c] = Math.round(a * (1 - ty) + b * ty);
      }
      out[di + 3] = 255;
    }
  }
  return new ImageData(out, width, height);
}

function changeBrightness(src, delta) {
  const out = new Uint8ClampedArray(src.data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = Math.max(0, Math.min(255, out[i] + delta));
    out[i + 1] = Math.max(0, Math.min(255, out[i + 1] + delta));
    out[i + 2] = Math.max(0, Math.min(255, out[i + 2] + delta));
  }
  return new ImageData(out, src.width, src.height);
}

const fingerprint = '7a91fc12deadbeef';
const original = makeImage(640, 480);
const embedded = embedFingerprintIntoImageData(original, fingerprint, {
  strength: 22,
  density: 1,
}).imageData;

const cases = [
  ['original', embedded, [8]],
  ['crop-unaligned', cropImage(embedded, 13, 21, 57, 39), [8]],
  ['resize-75', resizeBilinear(embedded, 0.75), [6]],
  ['resize-125', resizeBilinear(embedded, 1.25), [10]],
  ['brightness+18', changeBrightness(embedded, 18), [8]],
  ['crop+resize75', resizeBilinear(cropImage(embedded, 13, 21, 57, 39), 0.75), [6]],
];

for (const [name, image, blockSizes] of cases) {
  const start = performance.now();
  const result = detectFingerprintFromImageData(image, {
    density: 1,
    minMargin: 8,
    robust: true,
    blockSizes,
    offsetStep: 1,
  });
  const ms = Math.round(performance.now() - start);
  console.log(name, { found: result.found, fingerprint: result.fingerprint, confidence: result.confidence.toFixed(3), sync: result.sync, transform: result.transform, candidatesTested: result.candidatesTested, ms });
  if (!result.found || result.fingerprint !== fingerprint || !result.sync.found) process.exit(1);
}

console.log('freqmark-js robustness test passed');
