# English Radio MVP

24/7 영어 학습 오디오 스트리밍 플랫폼 MVP.

## 포함 기능 (MVP)
- HLS 기반 라이브 오디오 스트리밍 (`/stream/<channel>/live.m3u8`)
- Fastify API로 채널 송출 시작/중지/상태 확인
- FFmpeg 기반 오디오 -> HLS 세그먼트 생성
- 브라우저 플레이어(`/`)에서 바로 재생/상태 확인
- Docker Compose로 로컬 환경 즉시 실행

## 빠른 시작

### 1) 실행
```bash
docker compose up -d --build
```

### 2) 테스트 오디오 준비
`assets/sample.mp3` 파일을 넣어주세요.

### 3) 채널 송출 시작
```bash
curl -X POST http://localhost:8080/api/channels/beginner/start \
  -H "Content-Type: application/json" \
  -d '{"file":"sample.mp3"}'
```

### 4) 재생
- 웹 플레이어: `http://localhost:8080/`
- HLS 원본 URL: `http://localhost:8080/stream/beginner/live.m3u8`


## 모바일/PWA 지원
- 모바일 브라우저 실시간 청취(HLS)
- 끊김 시 자동 재연결 로직
- Media Session 메타데이터(잠금화면/제어센터 노출)
- PWA 설치 지원(홈 화면 추가)

## API
- `GET /api/health`
- `GET /api/channels`
- `POST /api/channels/:name/start`
- `POST /api/channels/:name/stop`
- `GET /api/channels/:name/now`

## 구조
```text
apps/api            Fastify API
apps/web            정적 플레이어 (hls.js)
infra/nginx         reverse proxy + 정적/HLS 서빙
stream              HLS 출력 디렉터리(런타임)
assets              원본 오디오(런타임)
docs                문서
```

## 주의
- `stream/`, `assets/` 실데이터는 git에 커밋하지 않음
- 프로덕션은 오브젝트 스토리지(R2/S3) + CDN + 워커/큐 분리 권장
