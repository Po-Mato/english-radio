# Cloudflare 0원 근접 배포 가이드

## 1) R2 버킷 생성
- Bucket name: `english-radio-stream`
- Public access 허용 (또는 Worker 통해 공개)

## 2) GitHub Secrets 설정
레포 Settings > Secrets and variables > Actions 에 아래 추가:
- `CF_ACCOUNT_ID`
- `CF_R2_ACCESS_KEY_ID`
- `CF_R2_SECRET_ACCESS_KEY`

## 3) GitHub Actions 실행
- `assets/sample.mp3` 커밋 후 main 푸시
- 또는 Actions 탭에서 `Build and Upload HLS to R2` 수동 실행

## 4) Cloudflare Pages 배포
- `apps/web` 디렉터리를 Pages로 배포
- 빌드 없음(정적)

## 5) 플레이어 설정
- 앱 접속 후 `스트림 베이스 URL`에 Worker 또는 R2 공개 도메인 입력
  - 예: `https://english-radio-worker.<subdomain>.workers.dev`
- 채널 `beginner` 재생

## 참고
- 현재 워크플로우는 `assets/sample.mp3` 기준 단일 채널(`beginner`)을 생성
- 다음 단계에서 다중 파일/다중 채널 자동 편성으로 확장 가능
