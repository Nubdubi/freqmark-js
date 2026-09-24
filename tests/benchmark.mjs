globalThis.ImageData = class ImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
};
const { adjustBrightness, cropImageData, resizeImageData } = await import('../dist/benchmark/attacks.js');
const width = 100; const height = 80;
const data = new Uint8ClampedArray(width * height * 4).fill(100);
for (let i = 3; i < data.length; i += 4) data[i] = 255;
const image = new ImageData(data, width, height);
const crop = cropImageData(image, 0.20);
const resize = resizeImageData(image, 0.75);
const bright = adjustBrightness(image, 20);
if (crop.width !== 80 || crop.height !== 64 || resize.width !== 75 || resize.height !== 60 || bright.data[0] !== 120) process.exit(1);
console.log('freqmark-js benchmark attacks test passed');
