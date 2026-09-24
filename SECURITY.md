# Security policy / 보안 정책

## 운영 원칙

- 브라우저 코드, 저장소, 이미지 또는 watermark seed에 HMAC secret을 저장하지 마세요.
- `placementSeed`와 `pilotSeed`는 패턴 분산용 공개 값이며 보안 키가 아닙니다.
- raw 사용자 ID를 payload로 직접 삽입하지 마세요.
- 서버에서 `HMAC(secret, userId | contentId | sessionId | nonce)`를 계산하고 64-bit fingerprint 또는 무작위 lookup token으로 변환하세요.
- fingerprint와 사용자 정보의 매핑은 접근 제어된 서버 데이터베이스에만 저장하세요.
- `.env`, private key, 배포 token과 사용자 매핑 자료는 Git에 commit하지 마세요.

## 위협 모델과 한계

이 라이브러리는 배포된 이미지 사본을 식별하기 위한 보조 수단입니다. 공개된 알고리즘을 아는 공격자가 targeted filtering, 강한 재압축, collusion, 재촬영 또는 이미지 재생성을 사용해 신호를 약화하거나 제거할 가능성이 있습니다. 검출 결과만으로 특정 사람이 유포했다고 법적으로 단정해서는 안 됩니다.

## 취약점 제보

공개 issue에 secret, 사용자 데이터 또는 재현 가능한 공격 자료를 그대로 게시하지 마세요. 저장소 관리자가 제공하는 비공개 보안 제보 채널을 사용하고, 채널이 없다면 최소한의 비민감 정보만으로 먼저 연락하세요.
