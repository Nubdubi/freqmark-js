const { confidenceLabel, trackingDecodeOptions } = await import('../dist/browser/camera.js');

if (confidenceLabel(0.49, true) !== 'Not detected') process.exit(1);
if (confidenceLabel(0.50, true) !== 'Possible') process.exit(1);
if (confidenceLabel(0.70, true) !== 'Likely') process.exit(1);
if (confidenceLabel(0.85, true) !== 'Strong') process.exit(1);
if (confidenceLabel(0.99, false) !== 'Not detected') process.exit(1);

const previous = {
  found: true, confidence: 0.92,
  transform: { blockSize: 6, offsetX: 2, offsetY: 2, phaseX: 2, phaseY: 3 },
  sync: { rotationDeg: -7, found: true, confidence: 0.8, scale: 0.75, offsetX: 2, offsetY: 2, perspectiveCorrected: false },
};
const tracked = trackingDecodeOptions({ robust: true, searchRotation: true }, previous, 2, 10);
if (!tracked.tracked || tracked.options.blockSizes.join(',') !== '6,5,7' || tracked.options.rotationCandidates.join(',') !== '-8,-7,-6') process.exit(1);
const reacquire = trackingDecodeOptions({ robust: true, searchRotation: true }, previous, 10, 10);
if (reacquire.tracked || reacquire.options.blockSizes) process.exit(1);
const lost = trackingDecodeOptions({}, { ...previous, confidence: 0.4 }, 1, 10);
if (lost.tracked) process.exit(1);
console.log('freqmark-js camera tracking test passed');
