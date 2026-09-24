const { createPermutation, hashSeed } = await import('../dist/core/prng.js');
const { placementPermutation, slotForBlock } = await import('../dist/watermark/layout.js');

const a = placementPermutation(312, 3, 'public-a');
const again = placementPermutation(312, 3, 'public-a');
const b = placementPermutation(312, 3, 'public-b');
if (!a.every((value, index) => value === again[index])) process.exit(1);
if (new Set(a).size !== 312 || a.some((value) => value >= 312)) process.exit(1);
if (a.every((value, index) => value === b[index])) process.exit(1);
if (!(() => { try { placementPermutation(312, 3, 'x'.repeat(257)); return false; } catch { return true; } })()) process.exit(1);

const direct = createPermutation(64, hashSeed('deterministic'));
const directAgain = createPermutation(64, hashSeed('deterministic'));
if (!direct.every((value, index) => value === directAgain[index])) process.exit(1);

for (let by = 0; by < 18; by++) for (let bx = 0; bx < 18; bx++) {
  const encoded = slotForBlock(bx, by, 0, 0, 18, 312, 3, 'public-a');
  const decoded = slotForBlock(bx, by, 0, 0, 18, 312, 3, 'public-a');
  if (encoded !== decoded) process.exit(1);
}

console.log('freqmark-js placement test passed', { firstSlots: [...a.slice(0, 12)] });
