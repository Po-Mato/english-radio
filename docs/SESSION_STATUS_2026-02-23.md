# Session Status (2026-02-23)

## 완료된 범위
- 신규 레포 생성 및 main 브랜치 직접 운영
- 로컬 스트리밍 MVP 구성
  - Fastify API
  - nginx 서빙
  - FFmpeg 기반 HLS 생성
  - docker-compose 실행 구조
- 웹 플레이어 구현
  - 모바일 UI 최적화
  - 자동 재연결
  - Media Session 메타데이터
  - PWA(manifest + service worker + 아이콘)
- 채널 운영 기능
  - `assets/<channel>/*.mp3` 기반 다중 파일 자동 순환 편성
  - `GET /api/assets/channels`
- 텍스트 기반 파이프라인
  - `scripts/<channel>/*.txt` 추가
  - `POST /api/tts/build/:name` 추가
  - `tools/txt_to_tts.sh` 제공
- Cloudflare 배포 뼈대
  - `wrangler.toml`, `worker.js`
  - GitHub Actions: HLS 생성 후 R2 업로드
  - `docs/cloudflare-deploy.md`
- CI 안정화
  - 오디오 파일이 없을 때 워크플로우 실패하지 않도록 수정

## 현재 주의사항
- API의 `/api/tts/build/*`는 macOS `say` 의존이라 컨테이너 내에서 바로 동작하지 않을 수 있음
- 실제 상용 운영 전, 컨테이너 호환 TTS(예: edge-tts)로 교체 필요
- Cloudflare 업로드는 GitHub Secrets 설정 필요

## 다음 우선순위
1. 컨테이너 호환 무료 TTS 엔진으로 교체
2. Auto-DJ 시간대 스케줄링
3. Cloudflare Pages + Worker + R2 실배포 점검
4. 기본 모니터링/헬스체크 강화

## 참고
- Repository: https://github.com/Po-Mato/english-radio
- 최근 CI fix 커밋: `944f0ec`
