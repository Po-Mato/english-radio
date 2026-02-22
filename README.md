# English Radio MVP

24/7 영어 학습 오디오 스트리밍 플랫폼 MVP.

## 포함 기능 (MVP)
- HLS 기반 라이브 오디오 스트리밍 (`/stream/<channel>/live.m3u8`)
- Fastify API로 채널 송출 시작/상태 확인
- FFmpeg 기반 오디오 -> HLS 세그먼트 생성
- Docker Compose로 로컬 1명 개발 환경 즉시 실행

## 빠른 시작

### 1) 실행
```bash
docker compose up -d
```

### 2) 테스트 오디오 준비
`assets/sample.mp3` 파일을 넣어주세요.

### 3) 채널 송출 시작
```bash
curl -X POST http://localhost:3000/channels/beginner/start \
  -H "Content-Type: application/json" \
  -d '{"file":"sample.mp3"}'
```

### 4) 재생 URL
- `http://localhost:8080/stream/beginner/live.m3u8`

VLC 또는 hls.js 플레이어에서 열면 재생됩니다.

## API
- `GET /health` : API 헬스체크
- `POST /channels/:name/start` : 지정 파일로 채널 송출 시작
- `POST /channels/:name/stop` : 채널 송출 중지
- `GET /channels/:name/now` : 현재 재생 상태 (MVP mock)

## 구조
```text
apps/api            Fastify API
infra/nginx         HLS 정적 서빙용 nginx 설정
stream              HLS 출력 디렉터리(런타임)
assets              원본 오디오(런타임)
docs                추가 문서
```

## 주의
- `stream/`, `assets/` 내부 실데이터는 git에 커밋하지 않음
- 프로덕션에서는 S3/R2 + CDN + 별도 워커/큐로 확장 권장
