# AGENTS.md — freqmark-js v0.3+ Robust Invisible Watermark Roadmap

## 0. 프로젝트 목적

`freqmark-js`는 브라우저/JavaScript 환경에서 동작하는 **비가시성 이미지 fingerprint 워터마크 라이브러리**다.

현재 목표는 단순히 이미지에 비트를 숨기는 것이 아니라 다음을 동시에 달성하는 것이다.

1. 사람 눈으로는 원본과 거의 구분되지 않을 것
2. JPEG 재압축, 밝기 변경, 리사이즈, 부분 크롭 후에도 fingerprint를 복구할 것
3. 임의 회전(rotation) 후에도 동기화하여 복구할 것
4. 휴대폰 카메라로 모니터/인쇄물을 비스듬히 촬영한 원근 왜곡(perspective distortion)에서도 검출 가능성을 높일 것
5. 오류정정코드(ECC)를 적용해 일부 비트 손상에도 payload/fingerprint를 복구할 것
6. 웹 카메라에서 실시간 검출할 수 있을 정도로 성능을 최적화할 것
7. 기존 `encode()`, `decode()`, `reveal()` API와 최대한 호환할 것

이 프로젝트는 **유포자를 법적으로 단정하는 도구가 아니라, 특정 사용자/세션에 배포된 이미지 사본의 fingerprint를 식별하는 도구**로 설계한다.

---

# 1. 절대 지켜야 할 원칙

## 1.1 화질 우선

현재 버전에서 나타날 수 있는 문제:

- 이미지 전체에 미세한 자글거림
- 일정한 방향의 흐름/격자감
- 하늘, 피부, 벽, 그라데이션에서 미세한 노이즈가 눈에 띔
- 높은 `strength`에서 원본 훼손

이 문제를 해결하기 위해 단순히 `strength`를 전체적으로 낮추지 말 것.

대신:

- perceptual masking
- adaptive strength
- textured block selection
- pseudo-random placement
- QIM 기반 최소 변형

을 사용한다.

목표:

```text
육안 품질 > 워터마크 강도
```

단, robustness도 유지한다.

---

## 1.2 Core는 플랫폼 독립적으로 유지

다음 계층을 분리한다.

```text
@freqmark/core
    DCT / IDCT
    QIM
    ECC
    sync
    geometry
    fingerprint
    detection

@freqmark/browser
    Canvas
    ImageBitmap
    VideoFrame
    Webcam
    Web Worker

@freqmark/node
    optional
    Sharp adapter
```

Core 코드에서는 DOM, Canvas, `document`, `window`에 직접 의존하지 않는다.

---

## 1.3 기존 공개 API 최대한 유지

기존:

```ts
encode()
decode()
reveal()
```

는 제거하지 않는다.

추가 API는 backward compatible하게 설계한다.

권장:

```ts
encode(input, options)
decode(input, options)
reveal(input, options)

createCameraDetector(options)
analyzeRobustness(input, options)
```

---

# 2. 최종 목표 API

## 2.1 Encode

```ts
const result = await encode(image, {
  payload: "USER123|CONTENT45|SESSION87",

  quality: "invisible",

  adaptive: true,

  robustness: {
    crop: true,
    resize: true,
    jpeg: true,
    rotation: true,
    perspective: true
  },

  ecc: {
    enabled: true,
    scheme: "bch"
  }
});
```

가능하면 사용자가 `strength`를 몰라도 되도록 한다.

고급 사용자를 위해 숫자 strength도 계속 허용한다.

```ts
encode(image, {
  payload: "...",
  strength: 8
});
```

---

## 2.2 Decode

```ts
const result = await decode(image, {
  robust: true,
  searchRotation: true,
  searchPerspective: true
});
```

권장 반환 형태:

```ts
{
  found: true,

  fingerprint: "A83F71C2D9...",

  confidence: 0.94,

  correctedBits: 11,

  rawBitErrors: 17,

  sync: {
    found: true,
    rotationDeg: -7.4,
    scale: 0.82,
    perspectiveCorrected: true
  },

  transform: {
    cropOffsetX: 13,
    cropOffsetY: 5,
    blockSize: 12.1
  },

  timing: {
    totalMs: 82,
    syncMs: 24,
    decodeMs: 41
  }
}
```

---

## 2.3 Reveal

```ts
const result = await reveal(image, {
  mode: "signal",
  boost: 8
});
```

지원 모드 권장:

```text
signal
blocks
sync
confidence
```

- `signal`: 숨겨진 DCT/QIM 신호 강조
- `blocks`: 실제 사용된 블록 위치 표시
- `sync`: 동기화 마커/파일럿 신호 표시
- `confidence`: 영역별 검출 confidence heatmap

---

# 3. Phase 1 — Perceptual Adaptive Watermark

가장 먼저 구현한다.

## 3.1 블록 분석

각 8x8 또는 16x16 후보 블록에 대해 다음 값을 계산한다.

```text
variance
local contrast
gradient magnitude
edge density
entropy
```

가능하면 빠른 구현을 우선한다.

초기 버전에서는 Sobel 전체 구현보다 다음 정도도 허용한다.

```ts
score =
  varianceWeight * variance +
  edgeWeight * localGradient +
  contrastWeight * contrast;
```

---

## 3.2 평탄한 영역 Skip

아래 영역은 기본적으로 watermark를 거의 넣지 않는다.

```text
하늘
피부
벽
단색 배경
부드러운 그라데이션
```

예:

```ts
if (textureScore < threshold) {
  strength = 0;
}
```

단, fingerprint capacity가 부족할 경우 최소 강도를 허용할 수 있다.

---

## 3.3 Adaptive Strength

예상 기본값:

```text
smooth      0 ~ 2
skin-like   1 ~ 3
medium      4 ~ 8
edge        8 ~ 12
texture     10 ~ 16
```

절대 상수로 박지 말고 preset에서 설정 가능하도록 한다.

```ts
QUALITY_PRESETS = {
  invisible: {...},
  balanced: {...},
  robust: {...}
}
```

---

# 4. Phase 2 — QIM 삽입

기존처럼 두 DCT coefficient를 강하게 벌리는 방식은 최소화한다.

## 4.1 QIM

Quantization Index Modulation을 사용한다.

개념:

```text
bit 0 -> even bucket
bit 1 -> odd bucket
```

예시:

```ts
function embedQim(
  value: number,
  bit: 0 | 1,
  step: number
): number {
  let q = Math.round(value / step);

  if ((Math.abs(q) & 1) !== bit) {
    q += q >= 0 ? 1 : -1;
  }

  return q * step;
}
```

실제 구현에서는 음수 계수 처리와 경계값을 테스트한다.

---

## 4.2 coefficient selection

DC 및 지나치게 높은 주파수는 피한다.

후보 예:

```text
(2,3)
(3,2)
(2,4)
(4,2)
(3,3)
```

한 비트당 한 계수에만 의존하지 말고 여러 coefficient를 사용할 수 있도록 추상화한다.

---

# 5. Phase 3 — Pseudo-random Placement

규칙적인 반복 패턴은 육안 artifact를 만들 수 있다.

fingerprint 또는 별도 seed에서 pseudo-random block order를 생성한다.

```ts
const seed = hash(fingerprint + syncSeed);
```

주의:

decoder가 seed를 모르는 상태에서 fingerprint를 먼저 알아야 하는 순환 의존성이 생기지 않도록 설계한다.

권장 방법:

```text
public sync seed
+
version
+
fixed PRNG
```

을 통해 block permutation을 생성한다.

보안 목적이 아니라 artifact 분산 목적이다.

---

# 6. Phase 4 — Frame Format

raw fingerprint 비트만 삽입하지 않는다.

프레임을 정의한다.

예:

```text
| PREAMBLE |
| VERSION  |
| PAYLOAD  |
| CRC      |
| ECC      |
```

권장:

```text
preamble     16 bit
version       4 bit
fingerprint  64~96 bit
CRC16        16 bit
```

이후 ECC 적용.

---

## 6.1 Preamble

decoder가 bit alignment를 찾을 수 있도록 Barker code 또는 pseudo-random sync word를 사용한다.

예:

```text
1110010110010001
```

단순 예시이며 실제 값은 autocorrelation 특성이 좋은 패턴을 선택한다.

---

# 7. Phase 5 — ECC

반드시 추가한다.

우선순위:

```text
1. repetition code (fallback/test)
2. BCH
3. Reed-Solomon optional
```

브라우저 번들 크기를 고려한다.

---

## 7.1 권장 인터페이스

```ts
interface EccCodec {
  encode(data: Uint8Array): Uint8Array;
  decode(data: Uint8Array): {
    data: Uint8Array;
    corrected: number;
    success: boolean;
  };
}
```

Core가 특정 ECC 구현에 강하게 결합되지 않게 한다.

---

## 7.2 최소 목표

다음 상황에서 fingerprint가 복구되어야 한다.

```text
5% bit corruption
10% bit corruption
일부 반복 tile 완전 손실
```

ECC 성능은 테스트에서 수치로 기록한다.

---

# 8. Phase 6 — Sync Marker / Pilot Signal

회전, 크롭, 스케일, perspective에 대응하려면 payload와 별도로 동기화 신호가 필요하다.

중요:

**눈에 보이는 AR marker를 삽입하는 것이 아니다.**

주파수 영역에 반복되는 약한 pilot pattern을 삽입한다.

---

## 8.1 Synchronization Layer

구조:

```text
Image
 ├── Payload watermark
 └── Synchronization pilot
```

sync 신호는 fingerprint payload와 독립적이다.

---

## 8.2 Pilot Pattern

가능한 전략:

```text
2D periodic lattice
pseudo-random spectral peaks
log-polar compatible frequency pattern
```

최초 구현은 너무 복잡하게 시작하지 않는다.

v0.3에서는:

```text
고정 간격의 약한 pilot carrier
+
FFT/DCT correlation
```

부터 구현한다.

---

# 9. Phase 7 — Rotation Detection

## 9.1 목표

최소:

```text
±15°
```

권장:

```text
±30°
```

회전 후 자동 보정.

---

## 9.2 1차 구현

coarse-to-fine search를 허용한다.

예:

```text
-20°
-18°
...
0°
...
+20°
```

각 회전 후보에서 sync correlation score를 측정하고 최고 점수를 선택한다.

이 방식은 느리지만 correctness baseline으로 먼저 구현한다.

---

## 9.3 이후 최적화

가능하면 FFT magnitude + log-polar transform을 이용한다.

```text
FFT magnitude
↓
log-polar
↓
phase correlation
↓
rotation + scale
```

단, v0.3 초기 완료를 늦추지 말 것.

---

# 10. Phase 8 — Scale Detection

현재 block size search를 확장한다.

예:

```text
0.5x
0.6x
0.75x
0.9x
1.0x
1.1x
1.25x
1.5x
2.0x
```

coarse search 후 주변 값을 fine search.

---

# 11. Phase 9 — Perspective Correction

카메라 촬영에서 가장 중요한 단계 중 하나다.

## 11.1 목표

다음 상황을 고려한다.

```text
모니터를 정면 촬영
모니터를 좌/우에서 촬영
위/아래 각도
사다리꼴 왜곡
부분 화면만 촬영
```

---

## 11.2 1차 방식

이미지 경계가 명확한 경우:

```text
edge detection
↓
quadrilateral detection
↓
4 corners
↓
homography
↓
rectify
↓
watermark decode
```

브라우저에서 직접 구현이 복잡하면 OpenCV.js adapter를 optional dependency로 허용한다.

Core에는 OpenCV.js를 넣지 않는다.

---

## 11.3 fallback

사각형 경계를 찾지 못하면:

```text
decode without rectification
```

으로 자동 fallback한다.

실패로 끝내지 않는다.

---

# 12. Phase 10 — Camera Real-time Detection

브라우저 카메라 기능을 추가한다.

사용 예:

```ts
const detector = await createCameraDetector({
  video,
  scanIntervalMs: 200,
  resolution: 720,
  searchRotation: true,
  perspective: true
});

detector.onResult((result) => {
  console.log(result);
});

detector.start();
```

---

## 12.1 처리 흐름

```text
getUserMedia
↓
video frame
↓
downscale
↓
grayscale/luminance
↓
optional perspective detection
↓
sync search
↓
decode
↓
confidence
```

---

## 12.2 실시간 전략

매 프레임 전체 robust search를 하면 안 된다.

다음 stateful tracking 사용:

```text
Frame 1
full search
↓
rotation = -4°
scale = 0.82
offset = ...

Frame 2
previous transform 주변만 탐색

Frame 3
previous transform 주변만 탐색

confidence 감소
↓
full search 다시 수행
```

---

## 12.3 목표 성능

일반 스마트폰/노트북 브라우저 기준:

```text
scan interval: 150~300 ms
UI blocking 금지
```

반드시 Web Worker 사용을 고려한다.

---

# 13. Web Worker

DCT/FFT/search가 UI thread를 막지 않도록 한다.

구조:

```text
main thread
  Camera/UI
     ↓
ImageBitmap
     ↓
worker
  sync/detect
     ↓
result
```

가능하면 transferable object를 사용한다.

---

# 14. Multi-resolution Detection

카메라 4K frame을 그대로 처리하지 않는다.

예:

```text
1920x1080
↓
960x540 coarse sync
↓
candidate ROI
↓
high resolution fine decode
```

---

# 15. Robustness Benchmark

라이브러리에 benchmark utility를 추가한다.

```ts
const report = await analyzeRobustness(image, {
  payload: "TEST123"
});
```

결과:

```ts
{
  original: {...},
  jpeg90: {...},
  jpeg75: {...},
  jpeg60: {...},
  jpeg45: {...},

  resize75: {...},
  resize50: {...},
  resize125: {...},

  crop10: {...},
  crop25: {...},

  rotate5: {...},
  rotate10: {...},
  rotate15: {...},

  brightnessPlus20: {...}
}
```

각 항목:

```ts
{
  found: true,
  confidence: 0.91,
  fingerprintMatch: true,
  elapsedMs: 73
}
```

---

# 16. Quality Metrics

원본 훼손 여부를 자동 측정한다.

최소:

```text
PSNR
```

가능하면:

```text
SSIM
```

도 추가.

권장 기본 목표:

```text
PSNR >= 40 dB
SSIM >= 0.995
```

단, 이미지 특성에 따라 다르므로 hard failure로만 쓰지 말고 quality report로 반환한다.

---

# 17. Auto Quality Controller

encode 시 원하는 품질을 지정할 수 있도록 한다.

```ts
quality: "invisible"
```

내부 흐름:

```text
candidate strength
↓
embed
↓
PSNR / SSIM
↓
quality threshold 실패
↓
strength 감소
↓
다시 embed
```

단 무한 반복하지 않는다.

최대 2~4회 정도로 제한한다.

---

# 18. Skin / Face 영역

현재 MVP에서는 AI face detector를 필수 의존성으로 넣지 않는다.

대신 기본적으로:

```text
낮은 texture score
+
smooth chroma
```

영역은 strength를 낮춘다.

향후 optional face mask adapter를 추가할 수 있다.

```ts
encode(image, {
  perceptualMask: {
    faceMaskProvider
  }
});
```

---

# 19. Chroma 사용

Y channel만 과도하게 변경하지 않는다.

실험 옵션:

```text
Y 70%
Cb 15%
Cr 15%
```

단 JPEG chroma subsampling 때문에 Cb/Cr payload를 핵심 데이터로 사용하지 않는다.

기본 fingerprint는 Y에 남긴다.

---

# 20. Versioning

워터마크 frame에 version을 포함한다.

```text
v1: legacy DCT
v2: tiled robust
v3: QIM + ECC + sync
```

decoder는 여러 버전을 읽을 수 있어야 한다.

```ts
decode(image, {
  versions: "auto"
});
```

---

# 21. Security / Privacy

fingerprint에 raw `userId`를 직접 넣지 않는다.

권장:

```text
server
↓
HMAC(userId | contentId | sessionId | nonce)
↓
64~96bit fingerprint
```

브라우저 오픈소스 라이브러리는 HMAC secret을 요구하거나 보관하지 않는다.

secret key는 서버에 있어야 한다.

---

# 22. 파일 구조 권장

```text
src/
├── core/
│   ├── dct.ts
│   ├── idct.ts
│   ├── qim.ts
│   ├── blocks.ts
│   ├── metrics.ts
│   └── prng.ts
│
├── perceptual/
│   ├── texture.ts
│   ├── variance.ts
│   ├── gradient.ts
│   └── mask.ts
│
├── frame/
│   ├── frame.ts
│   ├── preamble.ts
│   ├── crc16.ts
│   └── version.ts
│
├── ecc/
│   ├── codec.ts
│   ├── repetition.ts
│   └── bch.ts
│
├── watermark/
│   ├── embed.ts
│   ├── decode.ts
│   └── reveal.ts
│
├── sync/
│   ├── pilot.ts
│   ├── correlation.ts
│   ├── rotation.ts
│   ├── scale.ts
│   └── offset.ts
│
├── geometry/
│   ├── homography.ts
│   ├── perspective.ts
│   └── rectify.ts
│
├── browser/
│   ├── image.ts
│   ├── camera.ts
│   ├── detector.ts
│   └── worker/
│       ├── detector.worker.ts
│       └── protocol.ts
│
├── benchmark/
│   ├── attacks.ts
│   └── robustness.ts
│
└── index.ts
```

현재 구조와 충돌하면 전체를 억지로 이동하지 말고 점진적으로 정리한다.

---

# 23. 테스트 요구사항

기존 테스트를 삭제하지 않는다.

다음 테스트를 추가한다.

## 23.1 Quality

```text
encode -> PSNR 측정
encode -> SSIM 측정
smooth gradient artifact 검사
```

가능하면 synthetic gradient image를 테스트에 포함한다.

---

## 23.2 Basic decode

```text
original
brightness
JPEG
resize
crop
```

---

## 23.3 Rotation

최소:

```text
+3°
-3°
+7°
-7°
+12°
-12°
```

---

## 23.4 Combined attacks

중요.

단일 변형만 테스트하지 않는다.

예:

```text
crop 15%
+
resize 75%
+
JPEG 60
```

```text
rotate 7°
+
JPEG 75
```

```text
perspective
+
resize
+
JPEG
```

---

## 23.5 ECC

의도적으로 bit corruption을 주입한다.

```text
0%
5%
10%
```

복구 성공 여부와 corrected bit count를 검증한다.

---

# 24. 카메라 테스트 페이지

브라우저 demo에 탭을 만든다.

```text
[Encode]
[Decode]
[Reveal]
[Camera]
[Benchmark]
```

Camera 화면:

```text
┌───────────────────────────────┐
│                               │
│            CAMERA             │
│                               │
│     fingerprint detected      │
│                               │
│     A83F71C2...               │
│     confidence 92%            │
│     rotation -6.2°            │
│                               │
└───────────────────────────────┘
```

---

# 25. Camera UX

검출 confidence:

```text
0.00 ~ 0.49
Not detected

0.50 ~ 0.69
Possible

0.70 ~ 0.84
Likely

0.85+
Strong
```

UI에서 색상을 hard-code하지 않아도 된다.

문구만 제공해도 된다.

---

# 26. Performance

Hot path에서는 다음을 피한다.

```text
Array<Array<number>>
매 블록마다 객체 생성
JSON 변환
불필요한 slice()
```

가능하면:

```text
Float32Array
Uint8Array
preallocated buffers
```

를 사용한다.

---

# 27. Wasm은 지금 필수 아님

먼저 TypeScript correctness 확보.

순서:

```text
TypeScript baseline
↓
benchmark
↓
hotspot 확인
↓
WASM/SIMD 고려
```

성능 이유 없이 WASM부터 도입하지 않는다.

---

# 28. 절대 하지 말 것

1. 모든 블록에 동일 strength 적용
2. 하늘/피부/단색 영역을 강하게 수정
3. 화면에 규칙적인 격자 artifact 생성
4. decode 성공률을 높이기 위해 육안 품질을 크게 희생
5. UI thread에서 장시간 full robust search
6. raw user ID를 watermark에 직접 삽입
7. AI 재생성 후에도 무조건 추적 가능하다고 문서에 주장
8. 회전/원근 보정을 구현하지 않았는데 지원한다고 README에 작성
9. 테스트 없이 robustness 수치 작성
10. 기존 v0.2 API를 이유 없이 깨뜨림

---

# 29. README 표현

다음과 같이 정확하게 설명한다.

좋은 표현:

```text
Designed to survive common transformations such as
JPEG recompression, moderate resizing, cropping,
and supported geometric corrections.
```

피해야 할 표현:

```text
Impossible to remove
Unbreakable watermark
Always survives AI editing
Guaranteed leak attribution
```

---

# 30. 구현 순서

반드시 아래 순서로 진행한다.

## STEP 1

Perceptual block scoring 구현

완료 조건:

```text
texture score 생성 가능
smooth block 제외 가능
```

---

## STEP 2

Adaptive strength + QIM

완료 조건:

```text
기존 방식보다 PSNR/SSIM 개선
decode 정상
```

---

## STEP 3

Frame + preamble + CRC

완료 조건:

```text
payload framing
version detection
CRC validation
```

---

## STEP 4

ECC

완료 조건:

```text
일부 bit error 자동 복구
correctedBits 반환
```

---

## STEP 5

Pseudo-random placement

완료 조건:

```text
규칙적 visual pattern 감소
decode reproducible
```

---

## STEP 6

Sync pilot

완료 조건:

```text
crop offset/scale detection 안정화
sync confidence 반환
```

---

## STEP 7

Rotation

완료 조건:

```text
±12° 테스트 통과
```

---

## STEP 8

Perspective rectification

완료 조건:

```text
synthetic trapezoid transform 테스트 통과
```

---

## STEP 9

Web Worker

완료 조건:

```text
decode 중 UI thread 장시간 block 없음
```

---

## STEP 10

Camera detector

완료 조건:

```text
getUserMedia
실시간 frame scan
fingerprint 표시
tracking state 재사용
```

---

## STEP 11

Benchmark UI

완료 조건:

```text
JPEG
crop
resize
rotation
combined attack
```

결과 확인 가능.

---

# 31. 각 STEP 완료 후 행동

한 STEP에서 다음 STEP까지 임의로 대규모 작업하지 않는다.

각 단계 완료 후:

```text
1. 변경 파일
2. 구현 내용
3. 테스트 결과
4. 남은 문제
```

를 짧게 기록한다.

사용자가 다음 메시지에서:

```text
다음단계
```

라고 입력하면 다음 STEP부터 바로 진행할 수 있도록 한다.

단, 자동화된 Codex 환경에서 전체 구현을 한 번에 요청받은 경우에는 위 순서대로 계속 진행해도 된다.

---

# 32. 완료 기준

v0.3 목표는 아래와 같다.

## 필수

```text
[ ] adaptive perceptual masking
[ ] QIM
[ ] pseudo-random placement
[ ] frame/preamble/version
[ ] CRC
[ ] ECC
[ ] crop detection
[ ] resize detection
[ ] JPEG robustness
[ ] rotation correction
[ ] reveal modes
[ ] benchmark
```

## v0.4 후보

```text
[ ] perspective correction
[ ] camera real-time detection
[ ] Web Worker
[ ] multi-resolution search
```

하지만 가능하면 이번 작업에서 v0.4 후보까지 구현한다.

---

# 33. 테스트 목표 예시

테스트 이미지 특성에 따라 결과가 달라질 수 있으므로 수치를 무조건 하드코딩하지 않는다.

최소 개발 목표 예:

```text
Original
100% detection

JPEG 75
high reliability

Resize 75%
high reliability

Crop 15%
high reliability

Rotate ±7°
high reliability

Crop 15% + Resize 75% + JPEG 60
recoverable with ECC

Perspective moderate
recoverable when rectification succeeds
```

---

# 34. 최우선 판단 기준

모든 설계 결정에서 아래 순서를 따른다.

```text
1. 원본 화질
2. 실제 decode reliability
3. geometric robustness
4. 성능
5. 코드 단순성
```

단순히 robustness 수치를 올리기 위해 원본에 자글거림이나 물결 패턴이 보이게 만들지 않는다.

---

# 35. 최종 목표

사용자가 보는 이미지:

```text
원본과 거의 동일
```

검출 앱:

```text
Fingerprint detected

ID
A83F71C2D9...

Confidence
93%

Rotation
-5.8°

Scale
0.76

ECC corrected
9 bits
```

그리고 카메라로 화면을 비추면:

```text
카메라
↓
sync detection
↓
perspective / rotation correction
↓
ECC decode
↓
fingerprint
↓
optional server lookup
```

이 흐름을 구현한다.

---

# 36. Codex에게 주는 마지막 지시

현재 코드를 먼저 읽고 기존 동작을 유지한 상태에서 수정한다.

**새로 전부 다시 작성하지 말 것.**

먼저:

```text
package.json
src/
tests/
demo/
README
```

를 확인한다.

이후 기존 구현과 이 문서의 설계를 비교해서 최소 변경으로 단계적으로 개선한다.

각 기능은 반드시 테스트를 동반한다.

`npm test` 및 `npm run build`가 최종적으로 통과해야 한다.

완료 후 README에 실제로 검증한 변형만 지원한다고 명시한다.
