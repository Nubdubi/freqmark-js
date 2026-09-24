# Changelog

## 0.3.0

- 한국어: perceptual masking, adaptive QIM, v3 frame/preamble/CRC, 반복 ECC와 pseudo-random placement를 추가했습니다.
- 한국어: crop/resize 동기화 pilot, 제한적 회전 보정, 명시적 corner 기반 perspective rectification을 추가했습니다.
- 한국어: Web Worker decode, 카메라 detector, robustness benchmark API와 demo UI를 추가했습니다.
- English: Added perceptual masking, adaptive QIM, v3 framing, repetition ECC, randomized placement, sync pilot, geometric correction, worker/camera detection, and benchmark tooling.

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
