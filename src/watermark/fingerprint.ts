import { bytesToHex } from '../core/bits.js';

export async function fingerprintFromPayload(payload: string): Promise<string> {
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest).slice(0, 8));
}
