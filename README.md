# DA — Decision Asset RAG Framework

**Decision Asset (DA)** 는 `~/.claude/` 같은 LLM agent 환경에 축적된 human-narrative 규칙 (rules / docs / skills) 을 **agent 가 query-able 한 구조화 자산** 으로 변환하여, T1/T2/T3 컨텍스트 주입과 시점별 guard 를 통해 "규칙이 실제로 작동하도록" 만드는 end-to-end 프레임워크다.

> 본 repo 는 개인 환경 (`~/.claude/`) 에 구현된 DA 시스템을 **프레임워크 관점에서 추출** 한 것이다. 실제 DA YAML 305 개는 개인 규칙 콘텐츠이므로 제외했고, `examples/` 에 kind 별 대표 샘플 6 개만 포함한다.

---

## 해결하는 두 한계

원본 규칙 (`~/.claude/rules/*.md` 등) 을 human narrative 로만 두면:

1. **규칙 실행 시점에 inject 불가** — 매 tool call 전 "지금 어떤 규칙이 관련 있나" 를 agent 가 추론해야 함 → 비용 + drift
2. **cross-reference / 시퀀스 / 경계 조회 불가** — "retry-count 가 몇 회여야 Supervisor 개입" 같은 수치·시퀀스 질문에 답을 못 회수

DA 는 이를 **결정론적 md→YAML 변환 + 3축 semantic graph + 시점별 hook inject** 로 해결한다.

---

## 3-Layer 데이터 흐름

```
SOURCE (human narrative)        CANONICAL (structured YAML)       DERIVED (search + runtime)
~/.claude/rules/*.md       ──→  decisions/DA-*.yaml          ──→  .lancedb/ (BGE-M3 vector)
~/.claude/docs/**/*.md          (305 개 @ 2026-04-23)              MCP da-vector-store
~/.claude/skills/**/*.md                                           T1/T2/T3 inject via hooks
↑ 편집 SSOT                      ↑ md-to-da 자동 생성               ↑ read-only runtime
```

- **SOURCE** = 편집 SSOT (사람이 수정하는 유일한 지점)
- **CANONICAL** = `md-to-da.ts` 파서 결과 (수동 편집 금지)
- **DERIVED** = rebuild 또는 post-hook 으로 자동 갱신

## 3축 Semantic Graph

| 축 | 구현 | 커버 쿼리 |
|---|---|---|
| **유사도** | BGE-M3 embed + LanceDB cosine sim + `enrich-cross-ref.ts` | "Verifier FAIL 관련 DA" |
| **시퀀스** | `kind: chain` + `Sequence` 필드 (≥3 step, Terminal A) + `deriveChainMarkers()` | "Worker FAIL 후 단계별 흐름" |
| **경계** | `Numeric-bounds` 필드 (kebab-case key + value + unit) | "retry-count 몇 회에 Supervisor 개입" |

---

## Repo 구조

```
DA/
├── README.md                   # 본 파일
├── CLAUDE.md                   # 본 repo 의 push 규칙 기록 (staging 작업 노트)
├── .gitignore
├── docs/
│   ├── architecture.md         # 전체 아키텍처 SSOT
│   ├── pipeline.md             # md→DA→embed→LanceDB 파이프라인 상세
│   ├── chain-authoring.md      # chain kind 작성 가이드 (Sequence primary)
│   └── schema.md               # DA YAML 공식 스키마 (6 kind)
├── pipeline/                   # 결정론적 파서 + enrich + rebuild
│   ├── md-to-da.ts             # md → YAML 파서 (extractSequence + deriveChainMarkers)
│   ├── rebuild.ts              # YAML → embed → LanceDB 재색인 (drift 체크 포함)
│   ├── structure-check.ts      # S1-S5 린트 (S5 = Chain-Incomplete)
│   ├── enrich-cross-ref.ts     # applies-with 자동 링크
│   ├── enrich-da-keywords.ts   # T2 keyword 역인덱스 pre-build
│   ├── build-index-critical.ts # T1 INDEX-critical.md 자동 생성
│   ├── build-t2-keyword-index.ts
│   ├── lancedb-client.ts       # LanceDB 클라이언트
│   ├── lexicon.yaml            # marker 어휘 SSOT
│   └── llm-free/               # T1 NL 어휘 추출 (LLM-free 파이프라인)
├── embed/
│   └── embed_service.py        # BGE-M3 FastAPI (:8787)
├── mcp/
│   └── mcp_server.ts           # MCP 서버 (search_da tool)
├── hooks/
│   ├── session/da-loader.js    # T1 상시 inject (SessionStart)
│   ├── prompt/da-context.js    # T2 rule-based + T3 embedding fallback (UserPromptSubmit + PreToolUse)
│   ├── tool/da-gate.js         # T3 inhibitory meta-cognition (PreToolUse)
│   └── edit/
│       ├── chain-kind-guard.js     # Layer α — Sequence 위반 block
│       ├── md-edit-preflight.js    # T1 어휘 리마인더
│       └── md-grammar-lint.js      # rule-check + auto-yaml write
├── examples/                   # kind 별 대표 DA (6 개)
│   ├── guard-example.yaml
│   ├── heuristic-example.yaml
│   ├── constraint-example.yaml
│   ├── pattern-example.yaml
│   ├── scenario-example.yaml
│   └── chain-example.yaml
└── scripts/                    # 래퍼
    ├── rebuild-batch.sh
    ├── rollout-sweep.sh
    ├── rollout-structure-sweep.sh
    └── restore-canonical.sh
```

---

## Kind 6 종 (DA 스키마)

| Kind | 용도 | 대표 필드 |
|---|---|---|
| `guard` | 특정 조건에서 **차단/강제** | modality `must` / `must-not`, trigger.tools |
| `heuristic` | 휴리스틱 판정 (조건부 권고) | trigger.keywords + entry-conditions |
| `constraint` | 수치/상태 경계 | numeric-bounds (key/value/unit) |
| `pattern` | 반복 코드·아키텍처 패턴 | examples + counter-examples |
| `scenario` | 특정 상황 시나리오 (단일 흐름) | entry-conditions + exit-conditions |
| `chain` | 다단계 시퀀스 (≥3 step) | Sequence (actor/action/output-role) + Terminal A |

상세: [`docs/schema.md`](docs/schema.md)

---

## 런타임 Hook 시점별 역할

| 시점 | Hook | 역할 |
|---|---|---|
| SessionStart | `hooks/session/da-loader.js` | **T1 상시 inject** — `INDEX-critical.md` (critical+invariant 15 DA 요약) 주입 |
| UserPromptSubmit + PreToolUse | `hooks/prompt/da-context.js` | **T2 rule-based** (keyword + tool-name 매칭) + **T3 embedding fallback** (threshold 0.7 / 0.85) |
| PreToolUse | `hooks/tool/da-gate.js` | **Inhibitory meta-cognition** — counter-example 매칭 시 warn inject (deny 아님) |
| PreToolUse (Write/Edit) | `hooks/edit/chain-kind-guard.js` | **Layer α** — Sequence 위반 block (chain kind 편집 시) |
| PreToolUse (.md Write/Edit) | `hooks/edit/md-edit-preflight.js` | T1 어휘 리마인더 |
| PostToolUse | `hooks/edit/md-grammar-lint.js` | rule-check 통과 시 auto-yaml write |

**Drift 방어 3층**:
- **Layer α**: `chain-kind-guard.js` — chain Sequence 편집 시점 block
- **Layer β**: `render-canonical.ts` — md 섹션 본문 drift (설계 보류)
- **Layer γ**: `rebuild.ts` + `sequence-sha256` — rebuild 시점 drift 검증

---

## 의존성

| 기능 | 요구사항 |
|---|---|
| `pipeline/*.ts`, `mcp/mcp_server.ts` | Node.js 20+ / `tsx` / LanceDB (`@lancedb/lancedb`) |
| `embed/embed_service.py` | Python 3.11+ / `FastAPI` / `sentence-transformers` / BGE-M3 모델 |
| `hooks/*.js` | Claude Code hook 시스템 (또는 동등 agent harness) |

간단 기동 순서:

```bash
# 1. BGE-M3 embed 서비스 기동 (:8787)
cd embed && python embed_service.py &

# 2. md → DA 변환 + LanceDB 재색인
cd pipeline && tsx rebuild.ts

# 3. MCP 서버 기동 (agent 에서 search_da tool 사용)
cd mcp && tsx mcp_server.ts

# 4. (옵션) 주기 재색인 cron
bash scripts/rebuild-batch.sh
```

Hook 연동은 agent harness 측 설정에 따라 달라지므로 본 repo 는 실행 파일만 포함하고 settings 통합은 생략했다 (`docs/architecture.md` §5.4 참조).

---

## 원본 → repo 경로 매핑표

본 프레임워크의 **원본 환경** (`~/.claude/`) 과 repo 구조의 대응 관계.

| repo path | 원본 path |
|---|---|
| `docs/architecture.md` | `~/.claude/docs/operations/da-system-architecture.md` |
| `docs/pipeline.md` | `~/.claude/docs/operations/llm-free-da-pipeline.md` |
| `docs/chain-authoring.md` | `~/.claude/docs/operations/chain-authoring-guide.md` |
| `docs/schema.md` | `~/.claude/decisions/SCHEMA.md` |
| `pipeline/*.ts`, `pipeline/lexicon.yaml` | `~/.claude/scripts/da-vector/*.ts`, `lexicon.yaml` |
| `pipeline/llm-free/*` | `~/.claude/scripts/da-vector/llm-free/*` (drafts 제외) |
| `embed/embed_service.py` | `~/.claude/scripts/da-vector/embed_service.py` |
| `mcp/mcp_server.ts` | `~/.claude/scripts/da-vector/mcp_server.ts` |
| `hooks/session/da-loader.js` | `~/.claude/scripts/da-vector/hooks/da-loader.js` |
| `hooks/prompt/da-context.js` | `~/.claude/scripts/da-vector/hooks/da-context.js` |
| `hooks/tool/da-gate.js` | `~/.claude/scripts/da-vector/hooks/da-gate.js` |
| `hooks/edit/*.js` | `~/.claude/hooks/{chain-kind-guard,md-edit-preflight,md-grammar-lint}.js` |
| `scripts/*.sh` | `~/.claude/scripts/da-vector/*.sh` |
| `examples/*.yaml` | `~/.claude/decisions/DA-*.yaml` (선별 6 개) |

---

## 현재 상태 (2026-04-23 Phase E 완료)

- DA YAML: **305 개** 원본 환경에 축적 (본 repo 는 프레임워크만)
- 3축 semantic graph: **harness-wf scope (56 DA)** 에 완전 적용 (chain 3 개 + numeric-bounds 6 DA + cross-ref 일부)
- Phase G (예정): 전체 305 DA `enrich-cross-ref --scope=all` + rebuild.ts 에 enrich auto 호출 삽입
- 실구현 gap (G1-G6): `docs/architecture.md` §4.4 참조

---

## 라이선스

별도 명시 전까지 모든 권리 유보. 본 프레임워크는 개인 환경용으로 설계되었으며 공개 재사용 전 스키마·경로 가정을 검토해야 한다.

<!-- ultraplan-test: 2026-04-24 -->
