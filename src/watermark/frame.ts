import { bytesToHex, hexToBytes } from '../core/bits.js';
import { crc16 } from '../core/crc16.js';

const V2_MAGIC_0 = 0x46; // F
const V2_MAGIC_1 = 0x4d; // M
/** Fixed sync word selected to avoid long runs and provide useful transitions. */
export const V3_PREAMBLE = new Uint8Array([0xe5, 0x91]);
export const CURRENT_FRAME_VERSION = 3;
export const FINGERPRINT_BYTES = 8;
export const FRAME_BYTES = 2 + 1 + FINGERPRINT_BYTES + 2;
export const FRAME_BITS = FRAME_BYTES * 8;

export type SupportedFrameVersion = 2 | 3;

export function buildFrame(
  fingerprintHex: string,
  version: SupportedFrameVersion = CURRENT_FRAME_VERSION,
): Uint8Array {
  const fingerprint = hexToBytes(fingerprintHex);
  if (fingerprint.length !== FINGERPRINT_BYTES) {
    throw new Error(`Fingerprint must contain exactly ${FINGERPRINT_BYTES} bytes.`);
  }
  const frame = new Uint8Array(FRAME_BYTES);

  if (version === 2) {
    frame[0] = V2_MAGIC_0;
    frame[1] = V2_MAGIC_1;
    frame[2] = 2;
  } else {
    frame.set(V3_PREAMBLE, 0);
    // High nibble is the frame version; low nibble is payload length in bytes.
    frame[2] = (CURRENT_FRAME_VERSION << 4) | FINGERPRINT_BYTES;
  }
  frame.set(fingerprint, 3);

  const checksum = crc16(frame.slice(0, FRAME_BYTES - 2));
  frame[FRAME_BYTES - 2] = (checksum >> 8) & 0xff;
  frame[FRAME_BYTES - 1] = checksum & 0xff;

  return frame;
}

export interface ParsedFrame {
  valid: boolean;
  fingerprint: string;
  version: SupportedFrameVersion | null;
  preambleValid: boolean;
  magicValid: boolean;
  versionValid: boolean;
  crcValid: boolean;
}

export function parseFrame(frame: Uint8Array): ParsedFrame {
  if (frame.length !== FRAME_BYTES) {
    throw new Error(`Expected ${FRAME_BYTES} frame bytes.`);
  }

  const v2Magic = frame[0] === V2_MAGIC_0 && frame[1] === V2_MAGIC_1;
  const preambleValid = frame[0] === V3_PREAMBLE[0] && frame[1] === V3_PREAMBLE[1];
  const v3Header = frame[2] === ((CURRENT_FRAME_VERSION << 4) | FINGERPRINT_BYTES);
  const version: SupportedFrameVersion | null = v2Magic && frame[2] === 2
    ? 2
    : preambleValid && v3Header
      ? 3
      : null;
  const magicValid = v2Magic || preambleValid;
  const versionValid = version !== null;
  const expected = crc16(frame.slice(0, FRAME_BYTES - 2));
  const actual = (frame[FRAME_BYTES - 2] << 8) | frame[FRAME_BYTES - 1];
  const crcValid = expected === actual;

  return {
    valid: versionValid && crcValid,
    fingerprint: bytesToHex(frame.slice(3, 3 + FINGERPRINT_BYTES)),
    version,
    preambleValid: version === 3 && preambleValid,
    magicValid,
    versionValid,
    crcValid,
  };
}
