# 구현 완료 기록

## STEP 1 — Perceptual block scoring

상태: 완료 (2026-09-24)

### 변경 파일

- `src/perceptual/texture.ts`: 플랫폼 독립적인 8-bit luminance 블록 분석 추가
- `src/watermark/engine.ts`: 평탄 블록 제외 및 삽입 통계 연결
- `src/index.ts`: perceptual API와 encode 옵션 공개
- `tests/perceptual.mjs`: score 순서와 smooth block 제외 검증
- `package.json`: perceptual 테스트를 기본 테스트 명령에 포함
- `README.md`: 실제 구현 범위와 미지원 항목 명시

### 구현 내용

- variance, local contrast, 인접 픽셀 gradient, edge density, 16-bin entropy를 계산한다.
- 각 metric을 정규화하고 가중 합산해 `0..1` 범위의 texture score를 반환한다.
- `encode()`는 기본적으로 `adaptive: true`, `textureThreshold: 0.08`을 사용한다.
- 임계값 미만의 smooth block은 DCT 삽입 전에 제외한다.
- 기존 `encode()`, `decode()`, `reveal()` API와 숫자 `strength` 옵션을 유지한다.
- 결과의 `blocksSkippedSmooth`로 제외된 블록 수를 확인할 수 있다.
- hot path의 texture sample buffer는 한 번 할당해 재사용한다.

### 테스트 결과

- `npm test`: 통과
  - perceptual ordering: smooth `0`, gradient `0.04598`, textured `0.97395`
  - 혼합 synthetic fixture: smooth block 512개 제외, textured block 512개 사용
  - 기존 smoke decode 통과
  - original, crop, 75%/125% resize, brightness, crop+resize 기존 robustness 회귀 테스트 통과
- `npm run build`: 통과 (`npm test`의 선행 build로 검증)

### 남은 문제 / 다음 단계

- 현재 선택된 textured block에는 동일 strength를 사용한다. texture score 기반 adaptive strength는 STEP 2 대상이다.
- coefficient pair separation 방식은 유지 중이며 QIM은 STEP 2에서 구현한다.
- 실제 사진군의 PSNR/SSIM 비교와 smooth-gradient artifact 수치화가 필요하다.
- 이미지 대부분이 평탄하여 frame 반복 용량이 부족하면 encode가 명시적으로 실패한다. 향후 capacity-aware 최소 강도 fallback을 검토한다.
- ECC, pseudo-random placement, sync, rotation, perspective, worker/camera는 아직 구현되지 않았다.

## STEP 2 — Adaptive strength + QIM

상태: 완료 (2026-09-25)

### 변경 파일

- `src/core/qim.ts`: signed half-lattice QIM 삽입/판독 구현
- `src/core/metrics.ts`: RGB PSNR 및 luminance global SSIM 측정 구현
- `src/watermark/coefficients.ts`: 강제 coefficient separation을 최소 이동 QIM으로 교체
- `src/watermark/engine.ts`: texture score 기반 블록별 strength와 평균 강도 통계 추가
- `src/index.ts`: quality preset, QIM, 품질 metric 공개 API 추가
- `tests/qim-quality.mjs`: 음수/경계 QIM, 이동량, 품질, decode 검증
- `README.md`: STEP 2 지원 범위와 preset 사용법 반영

### 구현 내용

- bit 1은 양의 half-lattice, bit 0은 음의 half-lattice로 coefficient 차이를 양자화한다.
- 이미 올바른 판정 영역인 coefficient는 가장 가까운 bucket으로 이동하고, 잘못된 영역일 때만 최소 margin을 넘긴다.
- midpoint를 보존하여 두 mid-frequency coefficient에 변경량을 분산한다.
- texture threshold 직후에는 낮은 strength를, 강한 texture에는 설정된 최대 strength를 사용한다.
- `invisible`, `balanced`, `robust` preset과 기존 숫자 `strength`를 함께 지원한다.
- `measureImageQuality()`이 MSE, PSNR, global SSIM을 반환한다.

### 테스트 결과

- `npm test`: 통과
- `npm run build`: 통과
- QIM 음수 계수, 0 인접 경계, 양수 계수의 bit 판독 통과
- 반대 판정 영역의 carrier에서 QIM 이동량이 동일 step의 기존 강제 separation 목표보다 작음을 검증
- synthetic quality fixture (`strength: 22`):
  - 최초 STEP 2 검증 당시 adaptive: PSNR `36.1905 dB`, SSIM `0.997695`
  - 최초 STEP 2 검증 당시 all-block: PSNR `35.9864 dB`, SSIM `0.997583`
  - v3 frame 적용 후 재검증에서도 PSNR 약 `+0.2042 dB`, SSIM 약 `+0.000110` 개선
- adaptive QIM 원본 decode 및 기존 original/crop/resize/brightness/crop+resize 회귀 테스트 통과

### 남은 문제 / 다음 단계

- 품질 수치는 합성 fixture 한 종류의 결과이며 실제 사진군 전체를 대표하지 않는다.
- 권장 PSNR 40 dB는 hard failure가 아니며, 현재 `strength: 22` 합성 fixture에서는 미달했다.
- 현재 SSIM은 빠른 전역 통계 방식이다. windowed SSIM 및 실제 이미지 corpus 검증은 후속 개선 대상이다.
- 당시 frame은 v2 구조였으며, 아래 STEP 3에서 v3 preamble/version 구조로 개선했다.

## STEP 3 — Frame + preamble + CRC

상태: 완료 (2026-09-25)

### 변경 파일

- `src/watermark/frame.ts`: v3 frame, 16-bit preamble, version/header parsing 및 v2 호환 추가
- `src/watermark/engine.ts`: 검출 결과에 frame version과 preamble 상태 추가
- `src/index.ts`: frame builder/parser와 관련 타입 공개
- `tests/frame.mjs`: v3, v2 호환, CRC 손상, 알 수 없는 version 테스트 추가
- `package.json`: frame 테스트를 기본 테스트 명령에 포함
- `README.md`: 실제 v3 frame 지원 범위 명시

### 구현 내용

- v3 frame은 `16-bit preamble | 4-bit version + 4-bit payload length | 64-bit fingerprint | CRC16` 구조다.
- preamble은 `0xE591`을 사용하며 frame alignment/header 검증 신호로 활용한다.
- frame 전체 크기는 기존과 같은 13 bytes(104 bits)로 유지해 타일 layout을 변경하지 않았다.
- encoder는 기본적으로 v3 frame을 생성한다.
- parser는 v2 `FM + version byte` frame과 v3 frame을 자동 판별한다.
- 지원하지 않는 version/header와 CRC 손상을 각각 구분해 거부한다.
- decode 결과에 `frame.version`, `frame.preambleValid`, `frame.versionValid`, `frame.crcValid`를 반환한다.

### 테스트 결과

- `npm test`: 통과
- v3 build/parse, fingerprint, preamble, version 검증 통과
- 기존 v2 frame build/parse 하위 호환 통과
- payload bit corruption 주입 시 CRC 실패 검출 통과
- 알 수 없는 version 4 header 거부 통과
- v3 frame으로 기존 original/crop/75% resize/125% resize/brightness/crop+resize decode 회귀 테스트 통과
- `npm run build`: 통과 (`npm test` 선행 build 및 별도 실행으로 검증)

### 남은 문제 / 다음 단계

- preamble은 frame 유효성 판별에 사용되지만 현재 layout 자체가 고정 slot이므로 별도의 bit-stream sliding alignment search는 아직 없다.
- CRC는 오류 검출만 제공하며 손상 bit를 복구하지 않는다.
- STEP 4에서 ECC codec interface와 repetition fallback을 추가하고, bit corruption 복구 및 `correctedBits` 반환을 구현한다.

## STEP 4 — ECC

상태: 완료 (2026-09-25, repetition fallback)

### 변경 파일

- `src/ecc/codec.ts`: 구현 독립적인 `EccCodec` 및 decode result 인터페이스 추가
- `src/ecc/repetition.ts`: 3중 repetition majority codec 및 interleave 구현
- `src/watermark/layout.ts`: v3 ECC tile과 v2 legacy tile 분리
- `src/watermark/engine.ts`: v3 ECC encode/decode, correction 통계, v2 layout fallback 연결
- `src/index.ts`: ECC codec과 `correctedBits`/`rawBitErrors` 공개
- `tests/ecc.mjs`: 0%, 5%, 10% corruption 복구 테스트 추가
- `tests/smoke.mjs`: correction 필드 및 v2 spatial decode 호환 검증 추가
- `README.md`: 실제 repetition ECC 범위와 BCH 미구현 상태 명시

### 구현 내용

- `EccCodec.encode/decode` 계약을 추가해 core가 특정 ECC에 고정되지 않도록 했다.
- v3의 104 raw frame bits를 각각 3회 반복한 312-bit stream으로 변환한다.
- 반복본을 연속 배치하지 않고 3개 plane으로 interleave해 국소 crop/resize 손상이 세 복사본에 동시에 집중되는 문제를 줄였다.
- decoder는 각 3-bit group을 majority vote로 복구하고 minority bit 수를 `correctedBits`로 반환한다.
- 현재 hard-decision 단계에서 `rawBitErrors`는 ECC가 뒤집은 minority bit 수와 동일한 추정값이다.
- v3는 18×18 tile을 사용하고, decoder는 기존 v2 16×16 non-ECC layout도 fallback으로 탐색한다.

### 테스트 결과

- repetition ECC의 0%, 5%, 10% 단일-bit-per-group corruption에서 원본 104 bits 완전 복구
- 잘못된 encoded length를 codec failure로 반환
- v3 ECC encode/decode 및 `correctedBits` 반환 검증 통과
- 기존 v2 spatial watermark decode fallback 검증 통과
- initial adjacent repetition 배치에서 실패했던 crop+resize75를 interleave 후 복구
- original, crop, 75%/125% resize, brightness, crop+resize 회귀 테스트 통과
- `npm run build`, `npm test` 통과

### 남은 문제 / 다음 단계

- repetition code는 단순 fallback이며 BCH보다 용량 효율이 낮다. BCH 구현은 후속 개선 대상이다.
- 10% 테스트는 각 repetition group당 최대 1-bit 손상을 주입한 조건이다. 같은 group에서 2 bits가 손상되면 복구할 수 없다.
- `rawBitErrors`는 ground-truth가 없는 실제 decode에서 정확한 채널 bit error 수가 아니라 correction 기반 추정치다.
- STEP 5에서 public seed + version 기반 pseudo-random placement를 적용해 규칙적 spatial pattern을 더 분산한다.

## STEP 5 — Pseudo-random placement

상태: 완료 (2026-09-25)

### 변경 파일

- `src/core/prng.ts`: FNV-1a seed hash, Mulberry32 PRNG, Fisher–Yates permutation 추가
- `src/watermark/layout.ts`: public seed와 version 기반 slot permutation 및 cache 추가
- `src/watermark/engine.ts`: encode/decode hot path에 동일 permutation 연결
- `src/index.ts`: PRNG utility, 기본 seed, `placementSeed` 옵션 공개
- `tests/placement.mjs`: 재현성, 전단사, seed 분리, encoder/decoder mapping 검증
- `tests/smoke.mjs`: custom seed encode/decode roundtrip 추가
- `README.md`: placement seed의 목적과 사용 조건 명시

### 구현 내용

- 기본 공개 seed `freqmark-public-layout`과 frame version, frame bit 길이를 함께 hash한다.
- 고정 Mulberry32 PRNG와 Fisher–Yates shuffle로 deterministic permutation을 생성한다.
- fingerprint를 seed에 사용하지 않아 decoder가 payload를 알기 전에 동일 배치를 재현할 수 있다.
- v3 312-bit ECC stream의 slot 순서를 permutation하며 v2 legacy layout은 변경하지 않는다.
- custom `placementSeed`는 보안 키가 아니며 encode/decode 양쪽에 같은 값이 필요하다.
- permutation을 cache하고 블록/phase hot path에서는 미리 계산한 typed array를 재사용한다.

### 테스트 결과

- 동일 seed의 permutation 재현성 및 312개 slot 전단사 검증 통과
- 다른 public seed가 다른 permutation을 생성함을 검증
- custom seed encode/decode roundtrip 통과
- v2 fallback 및 v3 기본 seed decode 통과
- original, crop, resize, brightness, crop+resize robustness 회귀 테스트 통과
- 초기 구현에서 crop 탐색이 약 10초로 증가한 회귀를 발견했으며, hot-path cache 재사용 후 약 1.4초 수준으로 복구
- `npm run build`, `npm test` 통과

### 남은 문제 / 다음 단계

- pseudo-random placement는 규칙적 payload 반복을 분산하지만 암호학적 은닉이나 공격 방지를 제공하지 않는다.
- 실제 사진의 artifact 감소를 정량 비교하는 visual corpus benchmark는 추가로 필요하다.
- STEP 6에서 payload와 독립적인 sync pilot 및 crop offset/scale confidence를 구현한다.

## STEP 6 — Sync pilot

상태: 완료 (2026-09-25)

### 변경 파일

- `src/sync/pilot.ts`: deterministic pilot pattern, sparse selection, confidence 계산 추가
- `src/watermark/coefficients.ts`: 별도 coefficient pair에 대한 QIM helper 추가
- `src/watermark/engine.ts`: pilot 삽입, phase correlation, sync result 연결
- `src/index.ts`: `pilotSeed` 옵션과 sync 결과 공개
- `tests/sync.mjs`: pilot 재현성, seed 분리, sparse density, confidence 검증
- `tests/robustness.mjs`: 각 변형에서 sync 검출 및 scale/offset 결과 검증
- `README.md`: 실제 sync pilot 지원 범위 명시

### 구현 내용

- payload `(3,2)/(2,3)` pair와 다른 `(4,2)/(2,4)` DCT coefficient pair에 pilot을 삽입한다.
- pilot은 fingerprint와 독립적인 public seed에서 생성된다.
- 화질 영향을 줄이기 위해 texture-selected block 중 deterministic 약 25%에만 약한 pilot을 넣는다.
- crop tile phase 후보마다 observed pilot과 expected pilot의 correlation을 계산한다.
- 검출 결과에 `sync.found`, `sync.confidence`, `sync.scale`, `sync.offsetX/Y`를 반환한다.
- 32×32 pilot bit/active pattern을 typed array로 cache해 phase-search hot path에서 문자열 hash를 반복하지 않는다.

### 테스트 결과

- original sync confidence 약 `0.882`, scale `1.0`
- unaligned crop sync confidence 약 `0.900`, offset `(3,3)`
- resize 75% sync confidence 약 `0.556`, scale `0.75`
- resize 125% sync confidence 약 `0.615`, scale `1.25`
- brightness +18 sync confidence 약 `0.517`
- crop+resize75 sync confidence 약 `0.218`, scale `0.75`, offset `(2,2)`
- synthetic quality fixture: adaptive PSNR 약 `35.57 dB`, SSIM 약 `0.99734`; all-block 대비 품질 우위 유지
- pilot pattern cache 최적화 후 crop 탐색 약 `2.0초`, crop+resize 약 `1.1초`
- `npm run build`, `npm test` 통과

### 남은 문제 / 다음 단계

- pilot confidence는 correlation 지표이며 법적·통계적 확률값이 아니다.
- combined crop+resize의 pilot confidence가 낮아 추가 공격군에서 threshold calibration이 필요하다.
- 현재 pilot은 phase/scale 후보를 평가하지만 회전 각도를 직접 추정하지 않는다.
- STEP 7에서 coarse-to-fine rotation search와 ±12° 합성 테스트를 구현한다.

## STEP 7 — Rotation

상태: 완료 (2026-09-25, correctness baseline)

### 변경 파일

- `src/geometry/rotate.ts`: same-size bilinear center rotation 구현
- `src/sync/rotation.ts`: coarse-to-fine correction angle search 구현
- `src/watermark/engine.ts`: sync 결과에 `rotationDeg` 추가
- `src/index.ts`: `searchRotation` 및 rotation search 옵션 공개
- `tests/rotation.mjs`: ±3°, ±7°, ±12°와 coarse-to-fine 탐색 검증
- `README.md`: 검증 조건과 지원 한계 명시

### 구현 내용

- core 회전 함수는 DOM/Canvas 없이 `ImageData`와 typed array만 사용한다.
- `searchRotation: true`일 때만 회전 검색을 수행해 기존 decode 경로의 비용을 유지한다.
- 기본 범위는 ±15°, coarse step 3°, fine step 1°다.
- tracker 등에서 후보가 알려진 경우 `rotationCandidates`로 탐색 범위를 제한할 수 있다.
- coarse 단계에서 CRC-valid 후보를 찾지 못하면 resampling에 따른 pilot ranking 모호성을 피하기 위해 전체 fine grid를 탐색한다.
- `sync.rotationDeg`는 입력을 정규화하기 위해 실제 적용한 correction angle이다.

### 테스트 결과

- robustness fixture: 384×384, adaptive off, `strength: 40`
- 공격 +3° → correction -3°, confidence 약 `0.979`
- 공격 -3° → correction +3°, confidence 약 `0.975`
- 공격 +7° → correction -7°, confidence 약 `0.972`
- 공격 -7° → correction +7°, confidence 약 `0.971`
- 공격 +12° → correction -12°, confidence 약 `0.970`
- 공격 -12° → correction +12°, confidence 약 `0.973`
- +7° 공격에서 coarse 4° / fine 1° 자동 탐색 복구 통과
- 기존 quality, crop, resize, brightness, ECC, v2 호환 테스트 유지
- `npm run build`, `npm test` 통과

### 남은 문제 / 다음 단계

- 회전 테스트는 품질 기본값이 아니라 높은 robustness 강도 40 조건이다.
- coarse 후보가 CRC-valid가 아니면 fine grid 전체 fallback으로 느려질 수 있으므로 이후 pilot-only prefilter 최적화가 필요하다.
- same-size 회전은 모서리를 잘라내며 검은 padding이 생긴다. crop이 심한 실제 촬영에서는 추가 ROI 처리가 필요하다.
- 회전과 JPEG/crop을 결합한 테스트는 아직 없다.
- STEP 8에서 homography와 synthetic trapezoid rectification을 구현한다.

## STEP 8 — Perspective rectification

상태: 완료 (2026-09-25, explicit-corners baseline)

### 변경 파일

- `src/geometry/homography.ts`: 4-point homography 계산, 역행렬, point transform 구현
- `src/geometry/perspective.ts`: bilinear perspective warp와 rectification 구현
- `src/watermark/engine.ts`: sync 결과에 `perspectiveCorrected` 추가
- `src/index.ts`: geometry API 및 `perspectiveCorners` decode 옵션 공개
- `tests/perspective.mjs`: moderate synthetic trapezoid warp/rectify/decode 검증
- `README.md`: explicit corners만 지원하며 자동 quad detection은 미지원임을 명시

### 구현 내용

- 8×8 linear system을 partial pivoting으로 풀어 3×3 homography를 계산한다.
- singular/degenerate homography는 명시적인 오류로 거부한다.
- inverse mapping과 bilinear sampling으로 perspective warp를 수행한다.
- corners 순서는 top-left, top-right, bottom-right, bottom-left다.
- `decode()`에 `perspectiveCorners`가 있으면 rectification 후 기존 rotation/payload decode pipeline을 실행한다.
- rectification 계산이 실패하면 원본 입력으로 자동 fallback하며 `perspectiveCorrected`는 false다.
- corners가 없는 `searchPerspective: true`는 자동 검출을 가장하지 않고 기존 decode 경로로 fallback한다.

### 테스트 결과

- 512×512, adaptive off, `strength: 50` robustness fixture 사용
- source rectangle을 moderate trapezoid `(42,24) (475,55) (496,474) (18,493)`로 변형
- 네 corner의 homography projection 오차 `1e-6` 이하 검증
- perspective warp 후 supplied corners로 rectification 및 fingerprint 복구 통과
- decode confidence 약 `0.971`, sync confidence 약 `0.422`
- 기존 rotation ±3°/±7°/±12°, crop, resize, brightness, ECC, v2 호환 테스트 유지
- `npm run build`, `npm test` 통과

### 남은 문제 / 다음 단계

- 자동 edge detection 및 quadrilateral detection은 구현하지 않았다.
- 검증은 명시적 corner를 사용하는 합성 trapezoid와 높은 robustness 강도 50 조건이다.
- 실제 휴대폰 촬영의 blur, moiré, glare, lens distortion, JPEG가 결합된 조건은 아직 검증하지 않았다.
- perspective와 resize/JPEG를 결합한 테스트는 아직 없다.
- STEP 9에서 robust decode를 Web Worker로 분리해 UI thread blocking을 줄인다.

## STEP 9 — Web Worker

상태: 완료 (2026-09-25, opt-in worker path)

### 변경 파일

- `src/browser/worker/protocol.ts`: transferable request/response protocol 정의
- `src/browser/worker/processor.ts`: worker 내부 perspective/rotation/decode pipeline 구현
- `src/browser/worker/detector.worker.ts`: module worker entrypoint 및 오류 전달 구현
- `src/browser/detector.ts`: 재사용 가능한 worker client 구현
- `src/index.ts`: `decodeInWorker()`와 `createDecodeWorker()` 공개
- `tests/worker.mjs`: structured request와 worker processor decode 검증
- `README.md`: one-shot 및 reusable worker 사용 예제 추가

### 구현 내용

- main thread에서 `ImageData` pixel buffer를 복사한 뒤 transferable `ArrayBuffer`로 worker에 전달한다.
- worker는 perspective rectification, rotation search, sync, ECC, frame parsing을 수행한다.
- request id와 pending promise map으로 하나의 worker에서 여러 요청을 순차/병렬 추적할 수 있다.
- `decodeInWorker()`는 one-shot 편의 API이며 완료 후 worker를 종료한다.
- `createDecodeWorker()`는 카메라 프레임처럼 반복 호출할 때 worker 생성 비용을 재사용한다.
- worker 오류 및 강제 종료 시 pending promise를 모두 reject한다.
- 기존 동기 `decode()` API와 동작은 유지한다.

### 테스트 결과

- TypeScript module worker entrypoint 및 protocol build 통과
- 256×256 synthetic watermarked buffer를 structured request로 processor에 전달해 fingerprint 복구 통과
- processor 측정 시간 약 `13ms` (현재 개발 환경의 단일 synthetic fixture)
- perspective/rotation 및 기존 전체 회귀 테스트 유지
- `npm run build`, `npm test` 통과

### 남은 문제 / 다음 단계

- Node 테스트는 processor를 직접 실행하므로 실제 브라우저 event loop/UI responsiveness를 측정하지 않는다.
- 브라우저 bundler가 module-worker URL을 배포 자산으로 처리하는지 Vite demo 통합 검증이 추가로 필요하다.
- 입력 픽셀 보존을 위해 현재 한 번 복사 후 transfer한다. 카메라에서는 `ImageBitmap` 직접 transfer 최적화를 검토할 수 있다.
- worker 내부 작업 취소와 timeout protocol은 아직 없다.
- STEP 10에서 getUserMedia, scan interval, confidence tracking을 포함한 camera detector를 구현한다.

## STEP 10 — Camera detector

상태: 완료 (2026-09-25, browser API baseline)

### 변경 파일

- `src/browser/camera.ts`: camera lifecycle, frame capture, worker scan, tracking state 구현
- `src/index.ts`: `createCameraDetector()`와 camera 타입 공개
- `tests/camera.mjs`: confidence label과 tracking/reacquisition 정책 검증
- `README.md`: camera detector 사용 예제 및 범위 추가

### 구현 내용

- video에 stream이 없을 때 `start()`에서만 `getUserMedia` 권한을 요청한다.
- 기본 environment-facing video와 ideal 720p constraint를 사용하며 사용자 constraint로 교체할 수 있다.
- 4K frame을 그대로 처리하지 않고 최대 dimension을 기본 720으로 downscale한다.
- 기본 200ms 간격이며 최소 100ms로 제한한다.
- worker decode가 끝난 후 다음 timer를 예약해 여러 full search가 동시에 실행되지 않도록 한다.
- 이전 결과 confidence가 0.7 이상이면 이전 block size ±1과 rotation ±1° 주변을 탐색한다.
- confidence 하락, 검출 실패 또는 기본 10회 추적 후 full search로 재획득한다.
- confidence 문구는 `<0.50 Not detected`, `0.50–0.69 Possible`, `0.70–0.84 Likely`, `0.85+ Strong`이다.
- detector가 직접 생성한 stream과 worker는 `stop()`에서 정리한다. 외부에서 전달한 stream/worker는 소유권을 침범하지 않는다.

### 테스트 결과

- confidence 경계값 0.49/0.50/0.70/0.85 및 found=false 문구 검증 통과
- 이전 scale 0.75/block size 6에서 `[6,5,7]` narrow search 생성 검증
- 이전 rotation -7°에서 `[-8,-7,-6]` 후보 생성 검증
- 10회 후 full search 복귀 및 낮은 confidence에서 즉시 reacquisition 검증
- worker processor 및 전체 decode 회귀 테스트 유지
- `npm run build`, `npm test` 통과

### 남은 문제 / 다음 단계

- CI/Node 환경에서는 실제 camera permission, device stream, frame pacing을 자동 검증하지 않는다.
- demo에 Camera 탭과 시각적 결과 패널을 아직 추가하지 않았다.
- 자동 quadrilateral detection이 없어 perspective corners를 camera frame에서 자동 추출하지 않는다.
- `stop()`은 detector 소유 worker를 종료하므로 같은 instance 재시작은 현재 지원하지 않는다.
- STEP 11에서 benchmark API/UI와 JPEG/crop/resize/rotation/combined 결과 표시를 구현한다.

## STEP 11 — Benchmark API/UI

상태: 완료 (2026-09-25)

### 변경 파일

- `src/benchmark/attacks.ts`: crop, bilinear resize, brightness, rotation attack utility 추가
- `src/benchmark/robustness.ts`: `analyzeRobustness()` report pipeline 추가
- `src/index.ts`: benchmark API와 타입 공개
- `tests/benchmark.mjs`: attack dimension/pixel 결과 검증
- `demo/index.html`: Encode, Decode/Reveal, Camera, Benchmark UI로 정리
- `demo/app.ts`: camera 및 benchmark 실행 연결, 손상된 기존 문자열 수정
- `README.md`: benchmark 범위 추가

### 구현 내용

- 입력 이미지를 한 번 watermark encode한 뒤 각 attack을 독립적으로 적용한다.
- 기본 report 항목은 original, JPEG 90/75/60/45, resize 75%/125%, crop 10%/25%, brightness +20, rotate 5°/10°/15°, crop15+resize75다.
- 각 항목은 `found`, `confidence`, `fingerprintMatch`, `elapsedMs`를 반환한다.
- resize별 예상 block size를 지정하고 rotation별 correction 후보를 제한해 benchmark 비용을 통제한다.
- JPEG attack은 브라우저 Canvas codec으로 재인코딩한다.
- demo에서 선택한 이미지와 payload/strength로 report를 직접 실행하고 JSON 결과를 확인할 수 있다.
- demo에 Camera 패널도 연결해 STEP 10의 미완료 UI 항목을 보완했다.

### 테스트 결과

- 20% center crop의 100×80 → 80×64 dimension 검증 통과
- 75% bilinear resize의 100×80 → 75×60 dimension 검증 통과
- brightness +20의 pixel 결과 검증 통과
- 기존 deterministic robustness suite에서 original, crop, resize, brightness, crop+resize fingerprint 복구 유지
- rotation ±3°/±7°/±12° 및 perspective synthetic test 유지
- `npm run build`, `npm test` 통과

### 남은 문제

- JPEG benchmark는 브라우저 제공 codec에 의존하며 Node 기본 테스트에서는 자동 실행하지 않는다.
- report 수치는 입력 이미지, strength, browser codec에 따라 달라지므로 고정 성공률을 보장하지 않는다.
- rotate 15°와 낮은 기본 strength 조합은 이미지에 따라 실패할 수 있다.
- perspective+resize+JPEG 결합 benchmark와 실제 카메라 corpus는 아직 없다.
- benchmark 실행 취소/progress callback 및 결과 chart는 후속 개선 대상이다.

## Decode UI 멈춤 수정

상태: 완료 (2026-09-25)

- 원인: demo Decode 버튼이 CPU 집약적인 robust search를 main thread의 `decode()`로 실행해 UI event loop를 장시간 점유했다.
- 수정: demo Decode를 `decodeInWorker()`로 변경해 DCT/offset/phase 탐색을 module worker에서 수행한다.
- 중복 decode 요청을 막기 위해 실행 중 버튼을 비활성화하고 `finally`에서 복구한다.
- 검출 실패 또는 큰 변형에서는 전체 후보를 확인하므로 시간이 걸릴 수 있다는 진행 문구를 표시한다.
