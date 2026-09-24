export function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];

  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit--) {
      bits.push((byte >> bit) & 1);
    }
  }

  return bits;
}

export function bitsToBytes(bits: number[]): Uint8Array {
  if (bits.length % 8 !== 0) {
    throw new Error('Bit length must be divisible by 8.');
  }

  const out = new Uint8Array(bits.length / 8);

  for (let i = 0; i < bits.length; i++) {
    out[Math.floor(i / 8)] |= (bits[i] & 1) << (7 - (i % 8));
  }

  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(normalized)) {
    throw new Error('Fingerprint must be exactly 16 hexadecimal characters (64 bits).');
  }

  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
