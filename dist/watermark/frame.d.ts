/** Fixed sync word selected to avoid long runs and provide useful transitions. */
export declare const V3_PREAMBLE: Uint8Array<ArrayBuffer>;
export declare const CURRENT_FRAME_VERSION = 3;
export declare const FINGERPRINT_BYTES = 8;
export declare const FRAME_BYTES: number;
export declare const FRAME_BITS: number;
export type SupportedFrameVersion = 2 | 3;
export declare function buildFrame(fingerprintHex: string, version?: SupportedFrameVersion): Uint8Array;
export interface ParsedFrame {
    valid: boolean;
    fingerprint: string;
    version: SupportedFrameVersion | null;
    preambleValid: boolean;
    magicValid: boolean;
    versionValid: boolean;
    crcValid: boolean;
}
export declare function parseFrame(frame: Uint8Array): ParsedFrame;
//# sourceMappingURL=frame.d.ts.map