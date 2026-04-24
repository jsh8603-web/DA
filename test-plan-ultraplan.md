# Test Plan — README Quick Start 섹션 신설 (ultraplan 트리거 테스트 소재)

> **목적**: 이 파일은 `/ultraplan` 원격 refine 트리거의 동작 검증을 위한 **미니 테스트 플랜**이다. 실 구현 여부와 무관하게 ultraplan 이 (a) bundle 생성 → (b) cloud 세션 기동 → (c) needs-input / ready / approved 상태 전이 → (d) `<ultraplan>` 본문 주입 까지 정상 수행하는지 확인하는 것이 유일한 목적이다.

## 배경

DA 리포 (`https://github.com/jsh8603-web/DA`) 의 현재 `README.md` 는 원본 `~/.claude/` 경로 매핑표 · pipeline 폴더 구조 설명에 집중되어 있고, **신규 컨트리뷰터가 clone 직후 어떤 명령을 치면 첫 매칭 실험을 돌려볼 수 있는지** 는 빠져 있다.

## 범위

- **편집**: `README.md` 1 파일만.
- **신규 파일**: 없음 (기존 `examples/` · `pipeline/` 재사용).
- **CI / 테스트**: 변경 없음.

## 초안 단계 (보강 대상)

1. 의존성 설치 명령 나열 — Node.js 및 Python (BGE-M3 FastAPI) 양쪽.
2. 샘플 DA 1~2 건 로드 → query 1 건 실행 → 매칭 결과 확인.
3. 기대 출력 블록 제시.

## 보강 요청 포인트 (ultraplan 에게 refine 요청)

(a) **의존성 설치 실제 커맨드 정밀화** — Node.js 버전 · Python venv · uv/pip 선택 · BGE-M3 모델 다운로드 (`embed_service.py` 기동 선행).
(b) **샘플 query 2 건 선정** — 확실히 hit 되는 query 1 개 + 의도적 miss 로 T3 fallback 경로를 보여주는 query 1 개.
(c) **기대 출력 포맷** — `build-t2-keyword-index.ts` · `pipeline/llm-free/*` 구동 후 stdout 에 표시되어야 하는 JSON 또는 표 형태 명세.

## 전제 컨텍스트 (리포 구조)

- TypeScript pipeline (`pipeline/*.ts`) — `build-t2-keyword-index.ts` 가 T2 매칭 인덱스 빌드 진입점.
- Python FastAPI (`pipeline/llm-free/embed_service.py`) — BGE-M3 임베딩 서버, 포트 8787.
- LanceDB 로컬 벡터 스토어 (`.lancedb/` 는 gitignore 됨, `examples/` 의 샘플 DA 로 부트스트랩).
- `examples/` — kind 별 DA 샘플 3~6 건 포함.

## 성공 판정

ultraplan 이 위 (a) (b) (c) 3 항목에 대해 **파일 경로 · 실행 커맨드 · 기대 stdout** 을 모두 명시한 refined plan 을 `<ultraplan>...</ultraplan>` 태그로 반환하면 테스트 PASS. refined plan 의 실 이행 여부는 본 테스트 범위 밖 (ultraplan 트리거 자체 검증이 목적).
