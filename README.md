# freqmark-js

브라우저와 JavaScript/TypeScript 환경을 위한 비가시성 이미지 fingerprint 워터마크 라이브러리입니다.

JPEG 재압축, 밝기 변경, crop, resize와 검증된 범위의 회전·원근 보정 이후에도 배포 이미지의 fingerprint를 찾을 수 있도록 설계되었습니다. Adaptive perceptual masking, QIM, ECC, 동기화 pilot, Web Worker, 카메라 검출 및 robustness benchmark를 제공합니다.

Browser-first invisible image fingerprinting for JavaScript/TypeScript, with adaptive QIM, ECC, synchronization, geometric correction, worker decoding, camera detection, and robustness benchmarks.

`freqmark-js`는 중주파 DCT 계수에 64-bit fingerprint를 삽입합니다. v0.3은 perceptual block selection, QIM, 반복 ECC, pseudo-random placement와 sync pilot을 사용하며 crop/resize/rotation 및 명시적 corner 기반 perspective rectification을 지원합니다.

> 이 프로젝트는 DRM이나 법적 유포자 단정 도구가 아닙니다. 복구된 fingerprint는 특정 사용자/세션에 배포된 이미지 사본과의 일치 가능성을 나타내며, 계정 소유자가 직접 유포했다는 사실을 증명하지 않습니다. AI 재생성이나 광범위한 이미지 교체 이후의 복구도 보장하지 않습니다.

## v0.3 주요 기능 / Highlights

- Invisible 64-bit fingerprint payload
- Blind decoding: original image is not required
- 16×16-block tiled/repeating payload layout
- Crop/grid-offset recovery
- Resize recovery by testing multiple effective DCT block sizes
- Weighted repeated-bit voting + magic/version/CRC validation
- `reveal()` diagnostic mode that makes the hidden frequency signal human-visible
- Browser-first API using Canvas / OffscreenCanvas
- TypeScript source, MIT license, tests and GitHub Actions CI

## v0.3 구현 내역

STEP 1 adds browser-independent perceptual block analysis. Encoding now skips blocks below a normalized texture threshold by default, reducing changes in flat colors and smooth gradients while retaining the existing `encode()`, `decode()`, and `reveal()` APIs. Use `adaptive: false` only when all-block embedding is required, or tune the advanced `textureThreshold` option after testing representative images.

STEP 2 adds minimum-change signed QIM and texture-driven per-block strength. The `invisible`, `balanced`, and `robust` watermark presets are available through `watermarkQuality`; an explicit numeric `strength` remains supported. PSNR and global SSIM helpers are exported for application-specific quality checks.

STEP 3 adds a 16-bit v3 preamble, an explicit version/payload-length header, and CRC-16 validation. The decoder retains support for the previous fixed-size v2 frame. Detection results expose `frame.version`, `frame.preambleValid`, and `frame.crcValid` so callers can distinguish synchronization/header failure from payload corruption.

STEP 4 applies an interleaved three-copy repetition ECC to v3 frame bits. Majority decoding can recover isolated bit damage, and detection reports `correctedBits` and `rawBitErrors`. The codec is exposed behind a small `EccCodec` interface so a stronger BCH implementation can replace it later.

STEP 5 uses a deterministic public-seed permutation to disperse v3 frame slots across each tile. This seed is for visual pattern distribution, not secrecy. A custom `placementSeed` must be supplied to both `encode()` and `decode()`.

STEP 6 adds a sparse payload-independent pilot on a separate mid-frequency coefficient pair. Robust detection correlates this pilot for each phase hypothesis and reports `sync.found`, `sync.confidence`, estimated scale, and pixel-grid offset. A custom public `pilotSeed` must match during encode and decode.

STEP 7 adds opt-in same-canvas bilinear rotation normalization and coarse-to-fine search through `decode(input, { searchRotation: true })`. Synthetic tests recover a robustness-focused `strength: 40` fixture at ±3°, ±7°, and ±12°. This does not imply the default invisible preset has the same rotation tolerance.

STEP 8 adds platform-independent homography and bilinear perspective rectification when ordered `perspectiveCorners` are supplied. A moderate synthetic trapezoid was recovered with a robustness-focused `strength: 50` fixture. Automatic edge/quadrilateral detection is not implemented; without usable corners decoding falls back to the unrectified image.

STEP 9 adds opt-in module-worker decoding through `decodeInWorker()` and reusable `createDecodeWorker()`. Pixel buffers are copied once and transferred to the worker; perspective, rotation, sync, ECC, and payload decoding execute off the UI thread.

STEP 10 adds `createCameraDetector()` with `getUserMedia`, downscaled non-overlapping scans, worker reuse, and transform tracking. A locked detector searches near the previous scale/rotation and periodically returns to a full search. Result labels follow the documented Not detected/Possible/Likely/Strong thresholds.

STEP 11 adds `analyzeRobustness()` and demo panels for Encode, Decode/Reveal, Camera, and Benchmark. The report covers original, JPEG qualities, crop, resize, brightness, rotation, and a crop+resize combination with measured confidence and elapsed time.

These steps do not yet claim BCH or automatic camera-perspective detection; those remain roadmap work.

```ts
import { decodeInWorker } from 'freqmark-js';

const result = await decodeInWorker(file, {
  robust: true,
  searchRotation: true,
});
```

For repeated camera frames, reuse one worker:

```ts
const detector = createDecodeWorker();
const result = await detector.decodeImageData(frameImageData, { robust: true });
detector.terminate();
```

```ts
const camera = createCameraDetector({
  video: document.querySelector('video')!,
  scanIntervalMs: 200,
  resolution: 720,
  searchRotation: true,
});

camera.onResult((result) => {
  console.log(result.label, result.fingerprint, result.confidence);
});
await camera.start();
// camera.stop(); when leaving the page
```

## Install

```bash
npm install freqmark-js
```

For this source archive:

```bash
npm install
npm test
npm run dev
```

## Encode

```ts
import { encode } from 'freqmark-js';

const result = await encode(file, {
  payload: 'USER123|CONTENT45|SESSION87',
  watermarkQuality: 'invisible',
  outputType: 'image/png',
});

console.log(result.fingerprint);
// e.g. 7a91fc12deadbeef
```

You can also provide an exact 16-character hexadecimal fingerprint:

```ts
const result = await encode(file, {
  fingerprint: '7a91fc12deadbeef',
});
```

`payload` is SHA-256 hashed and truncated to 64 bits. For production tracing, generate the user/content/session token on your server. Do not place a secret HMAC key in frontend JavaScript.

## Decode

```ts
import { decode } from 'freqmark-js';

const result = await decode(suspectedImage, {
  robust: true,
});

console.log(result);
```

Typical result:

```json
{
  "found": true,
  "fingerprint": "7a91fc12deadbeef",
  "confidence": 0.96,
  "coverage": 1,
  "bitAgreement": 0.97,
  "transform": {
    "blockSize": 6,
    "offsetX": 2,
    "offsetY": 2,
    "phaseX": 2,
    "phaseY": 3
  }
}
```

`blockSize: 6` means the decoder estimated that an original 8×8 watermark block is currently about 6×6 pixels, which corresponds roughly to a 75% resize.

## Reveal hidden signal

The watermark is not normally visible to the human eye. `reveal()` generates a diagnostic image that boosts the DCT signal so an inspection app can show it.

```ts
import { reveal } from 'freqmark-js';

const result = await reveal(file, {
  robust: true,
  boost: 7,
});

const url = URL.createObjectURL(result.blob);
imageElement.src = url;

console.log(result.detection.fingerprint);
```

This is useful for a camera inspection UI:

```text
camera/video frame
       ↓
draw to canvas
       ↓
decode(canvas)
       ↓
fingerprint + confidence
       ↓
lookup in your database
       ↓
show distribution/session metadata
```

For real-time scanning, use a narrower search after the first successful lock:

```ts
const first = await decode(canvas, { robust: true });

if (first.found && first.transform) {
  const revealed = await reveal(canvas, {
    transform: first.transform,
  });
}
```

## Robustness model

v0.2 does two things that v0.1 did not:

1. The frame is repeated over a 16×16 DCT-block spatial tile, so a crop can still contain complete copies of the information.
2. The decoder scans pixel offsets, tile phase and effective block size, allowing it to reacquire the watermark after a crop and common resizes.

The included synthetic test suite currently checks successful recovery for:

- original watermarked image
- unaligned crop (crop does not start on an 8-pixel boundary)
- 75% bilinear resize
- 125% bilinear resize
- brightness +18
- unaligned crop followed by 75% bilinear resize

A separate maintainer-side codec check on the same synthetic fixture also recovered the fingerprint after JPEG re-encoding at quality 90, 75, 60 and 45. This JPEG check is not part of the default `npm test` because the test runner intentionally has no external image-codec dependency.

These tests are deterministic engineering tests, not a guarantee for every photograph or editing pipeline.

## Decoder tuning

Default robust search checks effective block sizes around the original 8-pixel grid. You can narrow or expand it:

```ts
await decode(file, {
  robust: true,
  blockSizes: [8, 6, 10, 7, 9],
  offsetStep: 1,
});
```

Useful approximations:

```text
blockSize 8  ≈ original size
blockSize 6  ≈ 75% resize
blockSize 10 ≈ 125% resize
blockSize 4  ≈ 50% resize (slower/noisier; opt in explicitly)
blockSize 12 ≈ 150% resize (opt in explicitly)
```

For a fast known-size scan:

```ts
await decode(file, {
  robust: false,
  blockSizes: [8],
});
```

## Strength

```ts
await encode(file, {
  payload: '...',
  strength: 22,
});
```

Higher strength generally improves survival but increases image distortion. If `strength` is omitted, the `invisible` preset is used. The current presets are `invisible`, `balanced`, and `robust`; always evaluate them on the image types and delivery pipeline you actually use.

## Recommended service architecture

```text
server
  ├─ create random delivery/session id
  ├─ HMAC(user + content + session + nonce)
  └─ store 64-bit lookup fingerprint
            ↓
freqmark-js encode()
            ↓
user-specific distributed image
            ↓
leaked/edited candidate
            ↓
freqmark-js decode()
            ↓
fingerprint
            ↓
server-side lookup
```

Suggested table:

```text
content_deliveries
- id
- fingerprint (unique)
- user_id
- content_id
- session_id
- issued_at
```

A recovered fingerprint means the candidate is consistent with a particular distributed copy. It does not by itself prove that the account owner intentionally leaked it.

## What v0.2 does NOT guarantee

The current implementation does not guarantee recovery after:

- arbitrary rotation
- perspective/skew from camera capture
- severe blur/noise
- very aggressive JPEG/re-encoding chains
- large or nonuniform scaling outside searched block sizes
- AI inpainting that replaces most watermarked pixels
- full image-to-image regeneration / screenshot-to-redraw workflows

Those require additional synchronization, geometric normalization, stronger ECC and/or a learned watermark model.

## Roadmap

- v0.3: BCH/Reed-Solomon style ECC and stronger JPEG stress tests
- v0.4: rotation/perspective synchronization for camera capture
- v0.5: Web Worker/WASM/SIMD acceleration
- v0.6: camera scanner helper and frame-to-frame tracking
- research branch: hybrid DWT/DCT and learned watermark experiments

## Development

Run a browser-codec robustness report:

```ts
const report = await analyzeRobustness(file, {
  payload: 'TEST123',
  strength: 30,
});
console.table(report);
```

```bash
npm install
npm run build
npm test
npm run dev
```

## License

MIT
