const { buildFrame, parseFrame, V3_PREAMBLE, CURRENT_FRAME_VERSION } = await import('../dist/watermark/frame.js');

const fingerprint = '7a91fc12deadbeef';
const v3 = buildFrame(fingerprint);
const parsedV3 = parseFrame(v3);
if (!parsedV3.valid || parsedV3.version !== 3 || !parsedV3.preambleValid || parsedV3.fingerprint !== fingerprint) {
  console.error('v3 frame failed', parsedV3);
  process.exit(1);
}
if (v3[0] !== V3_PREAMBLE[0] || v3[1] !== V3_PREAMBLE[1] || (v3[2] >> 4) !== CURRENT_FRAME_VERSION) {
  process.exit(1);
}

const v2 = buildFrame(fingerprint, 2);
const parsedV2 = parseFrame(v2);
if (!parsedV2.valid || parsedV2.version !== 2 || parsedV2.preambleValid || parsedV2.fingerprint !== fingerprint) {
  console.error('v2 compatibility failed', parsedV2);
  process.exit(1);
}

const corrupted = new Uint8Array(v3);
corrupted[6] ^= 0x04;
const parsedCorrupt = parseFrame(corrupted);
if (parsedCorrupt.valid || parsedCorrupt.crcValid || parsedCorrupt.fingerprint === fingerprint) {
  console.error('CRC corruption was not detected', parsedCorrupt);
  process.exit(1);
}

const wrongVersion = new Uint8Array(v3);
wrongVersion[2] = (4 << 4) | 8;
const parsedWrongVersion = parseFrame(wrongVersion);
if (parsedWrongVersion.valid || parsedWrongVersion.versionValid || parsedWrongVersion.version !== null) {
  console.error('Unknown version was accepted', parsedWrongVersion);
  process.exit(1);
}

console.log('freqmark-js frame test passed', { v3: parsedV3, v2: parsedV2, corrupted: parsedCorrupt });
