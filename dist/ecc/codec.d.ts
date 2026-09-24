export interface EccDecodeResult {
    data: Uint8Array;
    corrected: number;
    success: boolean;
}
export interface EccCodec {
    encode(data: Uint8Array): Uint8Array;
    decode(data: Uint8Array): EccDecodeResult;
}
//# sourceMappingURL=codec.d.ts.map