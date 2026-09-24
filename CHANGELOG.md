# Changelog

## 0.2.0

- Added 16×16-block tiled spatial payload repetition.
- Added crop/grid-offset reacquisition by scanning DCT grid offsets and tile phases.
- Added resize recovery through effective block-size hypotheses.
- Added weighted voting, coverage reporting and recovered transform metadata.
- Added `reveal()` diagnostic frequency-signal visualization.
- Added deterministic robustness tests for crop, resize and brightness changes.
- Bumped watermark frame version to 2.

## 0.1.0

- Initial browser-first 8×8 DCT fingerprint MVP.
- 64-bit fingerprint frame with magic/version/CRC.
- Basic `encode()` / `decode()` APIs.
