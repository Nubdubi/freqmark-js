const { RepetitionCodec } = await import('../dist/ecc/repetition.js');

const codec = new RepetitionCodec(3);
const source = Uint8Array.from({ length: 104 }, (_, i) => ((i * 17 + 3) % 5) < 2 ? 1 : 0);

for (const corruption of [0, 0.05, 0.10]) {
  const encoded = codec.encode(source);
  const groups = Math.floor(source.length * corruption);
  for (let i = 0; i < groups; i++) encoded[(i % 3) * source.length + i] ^= 1;
  const result = codec.decode(encoded);
  if (!result.success || result.data.some((bit, i) => bit !== source[i]) || result.corrected !== groups) {
    console.error('ECC recovery failed', { corruption, groups, result });
    process.exit(1);
  }
}

const invalid = codec.decode(new Uint8Array(5));
if (invalid.success) process.exit(1);
console.log('freqmark-js ECC test passed');
