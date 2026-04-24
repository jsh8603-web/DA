# PROJECT DA — 외부 공개 repo 준비 작업 공간

이 폴더는 `~/.claude/` 하위에 분산된 **Decision Asset (DA) 시스템** 을 외부 repo (https://github.com/jsh8603-web/DA) 로 push 하기 위한 staging 작업 공간이다. 원본 환경 자체가 아니라, push 전용으로 구조·파일을 재배치한 산출물을 보관한다.

---

## 배경

- **원본 위치**: `~/.claude/` 하위 여러 경로에 DA 시스템이 분산되어 있음 (decisions / scripts/da-vector / hooks / docs/operations)
- **Push 대상**: https://github.com/jsh8603-web/DA — 아직 push 이력 없음
- **목표**: 리포와 앞으로 개선할 보수 계획을 ULTRA PLAN 에 리뷰시키는 것. 리뷰어 이해도를 최우선 고려
- **역할 분리**: 보수 계획의 작성은 별도 agent 담당. 본 세션은 **PUSH 까지** 수행

---

## PUSH 규칙 (2026-04-24 결정)

### 규칙 1. 작업 위치

- 원본 `~/.claude/` 은 건드리지 않는다. 모든 재배치·복사는 `D:\projects\DA\` 안에서 이루어진다
- Git remote 연결도 이 폴더를 기준으로 설정한다 (`git init` → `git remote add origin https://github.com/jsh8603-web/DA`)

### 규칙 2. Repo 구조 — 옵션 C (기능 중심 재배치)

절대경로 미러링 (옵션 A) 이 아니라 **기능 단위 재배치** 를 채택한다. 이유: 리뷰어가 tree 만 봐도 "어느 시점에 뭐가 돌아가는지" (session/prompt/tool/edit) 파악 가능 + 구성요소 독립 이해 + 모듈 재사용성.

```
DA/
├── README.md                          # 프레임워크 개요 + quickstart
├── CLAUDE.md                          # (본 파일) push 규칙 기록
├── .gitignore                         # .lancedb/, *.log, *.bak-*, _coverage_*, _regression_*
├── docs/
│   ├── architecture.md                # ← docs/operations/da-system-architecture.md
│   ├── pipeline.md                    # ← docs/operations/llm-free-da-pipeline.md
│   ├── chain-authoring.md             # ← docs/operations/chain-authoring-guide.md
│   └── schema.md                      # ← decisions/SCHEMA.md
├── pipeline/                          # md-to-da / rebuild / structure-check / enrich
│   ├── md-to-da.ts
│   ├── rebuild.ts
│   ├── structure-check.ts
│   ├── enrich-cross-ref.ts
│   ├── enrich-da-keywords.ts
│   ├── build-index-critical.ts
│   ├── build-t2-keyword-index.ts
│   ├── lancedb-client.ts
│   └── lexicon.yaml
├── embed/                             # BGE-M3 FastAPI
│   └── embed_service.py
├── mcp/                               # MCP server
│   └── mcp_server.ts
├── hooks/
│   ├── session/da-loader.js           # T1 상시 inject
│   ├── prompt/da-context.js           # T2 rule-based + T3 embedding fallback
│   ├── tool/da-gate.js                # T3 inhibitory meta-cognition
│   └── edit/
│       ├── chain-kind-guard.js        # Layer α — Sequence 위반 block
│       ├── md-edit-preflight.js       # T1 어휘 리마인더
│       └── md-grammar-lint.js         # rule-check + auto-yaml write
├── examples/                          # kind 별 대표 DA 샘플 (3-6 개)
│   ├── guard-example.yaml
│   ├── heuristic-example.yaml
│   ├── constraint-example.yaml
│   ├── pattern-example.yaml
│   ├── scenario-example.yaml
│   └── chain-example.yaml
└── scripts/                           # 래퍼
    ├── rebuild-batch.sh
    └── rollout-sweep.sh
```

**원본 → repo 경로 매핑표는 README.md 에 기재**해서 원본 환경 복원 시 참고하도록 한다.

### 규칙 3. DA YAML 전량 제외 (examples 만 포함)

**305 개 DA YAML 파일은 push 하지 않는다**. 이유:

| # | 이유 |
|---|---|
| 1 | **개인 규칙 덤프** — 305개 전부 내 `~/.claude/` 규칙 파생물이라 외부 재사용 가치 0 |
| 2 | **오해 유발** — repo 의 본질이 "DA 를 작성하는 **프레임워크**" 인데 YAML 305개가 있으면 "내 규칙 **덤프**" 로 왜곡됨 |
| 3 | **스키마 이해엔 불필요** — kind 6종 (guard/heuristic/constraint/pattern/scenario/chain) 각 1-2개 샘플이면 충분 |
| 4 | **drift 위험** — 305개를 repo 에 고정하면 원본 수정 시 sync 부담 |
| 5 | **파생 산출물은 재현 가능** — `INDEX-critical.md` / `.t2-keyword-index.json` 등은 생성 로직만 있으면 재생성 가능 |

**대신 `examples/` 에 kind 별 3-6 개 대표 샘플만 포함** — 프레임워크 이해에 필요한 최소 집합.

### 추가 제외 대상 (명백)

- `.lancedb/` (vector index, 재생성 가능)
- `.archive/`, `.draft-v2/`, `.secretary/` (작업 히스토리)
- `__pycache__/` (Python 캐시)
- `*.bak-*` (백업 파일)
- `_coverage_baseline*`, `_regression_test_*`, `_rebuild.log` (내부 테스트/로그)
- `.t2-miss.jsonl`, `.mirror-state.json` (runtime 상태)
- `~/.claude/settings.json` (개인 hook 등록 전체는 제외, 관련 snippet 만 README 에 예시로)

---

## 실제 작업 순서 (다음 세션)

1. `cd /d/projects/DA` → `git init`
2. `.gitignore` 작성
3. 위 tree 대로 파일 복사 (원본 건드리지 않음, copy only)
4. README.md 작성 (개요 + quickstart + 원본 경로 매핑표)
5. examples/ 에 kind 별 샘플 YAML 선별·복사
6. `git remote add origin https://github.com/jsh8603-web/DA`
7. `git add . && git commit -m "feat(DA): initial import"` → `git push -u origin main`

---

## 원본 참조 (편집 대상 아님, 복사 소스)

| 영역 | 원본 경로 |
|---|---|
| DA YAML (305) | `~/.claude/decisions/*.yaml` |
| 스키마·README | `~/.claude/decisions/SCHEMA.md`, `README.md` |
| 파이프라인 코드 | `~/.claude/scripts/da-vector/*.ts` + `embed_service.py` + `lexicon.yaml` |
| llm-free 서브트리 | `~/.claude/scripts/da-vector/llm-free/` |
| T1/T2/T3 hooks | `~/.claude/scripts/da-vector/hooks/{da-loader,da-context,da-gate}.js` |
| 편집 사이클 hooks | `~/.claude/hooks/{chain-kind-guard,md-edit-preflight,md-grammar-lint}.js` |
| 운영 SSOT | `~/.claude/docs/operations/{da-system-architecture,llm-free-da-pipeline,chain-authoring-guide}.md` |

---

## 합의 요약 (한 줄)

**옵션 C (기능 중심 재배치) + YAML 전량 제외 (examples 만) + `D:\projects\DA\` staging + 다음 세션에서 push 실행.**
