/** CRC-16/CCITT-FALSE */
export function crc16(bytes) {
    let crc = 0xffff;
    for (const byte of bytes) {
        crc ^= byte << 8;
        for (let i = 0; i < 8; i++) {
            crc = (crc & 0x8000) !== 0
                ? ((crc << 1) ^ 0x1021) & 0xffff
                : (crc << 1) & 0xffff;
        }
    }
    return crc;
}
//# sourceMappingURL=crc16.js.map