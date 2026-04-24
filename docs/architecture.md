---
name: DA System Architecture
description: Decision Asset (DA) 시스템 전체 아키텍처 SSOT — 3-layer 데이터 흐름 / 3축 semantic graph (유사도·시퀀스·경계) / 파이프라인 / hook / MCP / DA 화 coverage 범위 (G 완료 기준) / Phase 이력. 모든 구성 파일의 포인터 맵 허브.
type: operations
tags:
  - type/doc
  - domain/da-system
  - domain/rag-rules
  - load/on-demand
date: 2026-04-23
related-children:
  - ~/.claude/decisions/README.md
  - ~/.claude/decisions/SCHEMA.md
  - ~/.claude/docs/operations/llm-free-da-pipeline.md
  - ~/.claude/docs/operations/chain-authoring-guide.md
---

(root: file-standards.md → 운영 SSOT · OPERATIONS_INDEX 등재)

# DA System Architecture — 전체 구조 SSOT

> **배경**: DA (Decision Asset) 시스템은 `~/.claude/` 하위에 축적된 human-narrative 형태의 규칙·스킬·운영 지식을 **agent 가 query-able 한 구조화 자산** 으로 변환하여, T1/T2/T3 컨텍스트 주입과 시점별 guard 를 통해 "규칙이 실제로 작동하도록" 만드는 end-to-end 시스템이다. 본 문서는 그 전체 구조 (데이터 흐름 / 3축 semantic graph / 구성 파일 포인터 / 편집 사이클 / DA 화 범위 / Phase 이력) 를 한 곳에서 설명하는 허브 SSOT 다. 하위 SSOT (decisions/README.md, SCHEMA.md, llm-free-da-pipeline.md, chain-authoring-guide.md) 는 각 영역 상세로 분리되어 있으며 본 문서가 이들을 연결한다.
>
> **본 문서 수정 시 함께 갱신할 파일**:
> | # | 파일 | 갱신 내용 |
> |---|------|----------|
> | 1 | `~/.claude/docs/operations/OPERATIONS_INDEX.md` | 본 파일 포인터 등재 여부 |
> | 2 | `~/.claude/decisions/README.md` §관련 문서 | 본 architecture 문서 포인터 |
> | 3 | `~/.claude/docs/operations/llm-free-da-pipeline.md` §관련 문서 | 상위 아키텍처 참조 |

## 1. 목적과 배경

`~/.claude/rules/*.md`, `~/.claude/docs/**/*.md`, `~/.claude/skills/**/*.md` 에 축적된 규칙들은 원래 **인간 narrative** (문단 + 예시 + 반례) 이다. 이걸 그대로 두면 두 가지 한계가 생긴다.

1. **규칙 실행 시점에 inject 불가**: 매 tool call 전마다 "지금 어떤 규칙이 관련 있나" 를 agent 가 추론해야 → 비용 + drift
2. **cross-reference / 시퀀스 / 경계 조회 불가**: "retry-count 가 몇 회여야 Supervisor 개입" 같은 수치·시퀀스 질문에 답을 못 회수

DA 시스템은 이 두 한계를 **결정론적 변환 + 3축 semantic graph** 로 해결한다.

## 2. 3-Layer 데이터 흐름

```
┌───────────────────────────────────────┐   ┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│ SOURCE (human narrative)              │   │ CANONICAL (structured YAML)      │   │ DERIVED (search + runtime)       │
├───────────────────────────────────────┤   ├──────────────────────────────────┤   ├──────────────────────────────────┤
│ ~/.claude/rules/*.md                  │   │ ~/.claude/decisions/             │   │ ~/.claude/.lancedb/              │
│ ~/.claude/docs/**/*.md          ─md→da→ │ DA-{YYYYMMDD}-{slug}.yaml        ─embed→│ BGE-M3 vector index (.gitignore)│
│ ~/.claude/skills/**/*.md              │   │ (2026-04-23 기준 305 files)      │   │ MCP `da-vector-store` via T1/T2/T3 inject │
└───────────────────────────────────────┘   └──────────────────────────────────┘   └──────────────────────────────────┘
         ↑ edit here                              ↑ write by audit wf only                ↑ read-only runtime
```

- **SOURCE = 편집 SSOT** (사람이 수정하는 유일한 지점)
- **CANONICAL = md 파서 결과** (`md-to-da.ts` 가 생성, 수동 편집 금지 — 감사 wf 만 예외적 수정)
- **DERIVED = 자동 갱신** (rebuild 또는 post-hook 트리거)

## 3. 3축 Semantic Graph (Phase A-E 완성)

DA 사전은 **세 축 (axis)** 의 관계망을 표현한다.

| 축 | 구현 방식 | 예시 쿼리 커버 |
|---|---|---|
| **유사도 (similarity)** | BGE-M3 embed + LanceDB cosine sim + `enrich-cross-ref.ts --scope=all` (Phase G) 로 `applies-with` 자동 링크 | "Verifier FAIL 관련 DA 뭐 있어" → 의미 유사 DA 회수 |
| **시퀀스 (sequence)** | `kind: chain` + `Sequence` 필드 (≥3 step, Terminal A 규칙) + `deriveChainMarkers()` 자동 파생 (input-role / output-role / actors) | "Worker FAIL 후 단계별 흐름" → 9 step chain 직접 회수 |
| **경계 (numeric-bounds)** | `Numeric-bounds` 필드 (key / value / unit / description, kebab-case + 의미적 prefix) | "retry-count 몇 회에 Supervisor 개입" → 숫자 경계 직접 회수 |

**Phase A-E 완성 = 3축 모두 harness-wf scope (56 DA) 에 적용된 상태**. Phase G 에서 전체 305 DA 로 확장 예정.

## 4. DA 화 범위 (Phase G 완료 기준)

### 4.1 DA 변환 **대상** (DA 화 O)

| 영역 | 경로 | 이유 |
|---|---|---|
| 전역 규칙 | `~/.claude/rules/*.md` | file-standards / reliability-drift / pc-tools / remote-session / vaultvoice / md-grammar — 매 tool call 전 invariant 필요 |
| 운영 SSOT | `~/.claude/docs/operations/*.md` | model-routing / hook-guard-review / llm-free-da-pipeline / chain-authoring-guide 등 |
| 도메인 | `~/.claude/docs/domain/*.md` | agent-task-api / excel-powerbi / **harness-wf-chains** (Phase C 산출) |
| 패턴 | `~/.claude/docs/patterns/*.md` | 반복 코드·아키텍처 패턴 |
| 감사 | `~/.claude/docs/verification/*.md` | audit-promotion / audit-system / hook-guard-test-plan |
| **스킬** | `~/.claude/skills/**/*.md` | harness-wf / lightweight-wf / enhanced-coding-wf / enhanced-planning-wf / audit-wf / handoff-plan-wf / search-engine / psmux-session / self-wake / debate / animation-wf / task-register / telegram-notify / gmail-fetch / gdrive-upload / email-smtp / ingest 등 **모든 skill md 포함** |

### 4.2 DA 변환 **제외** (DA 화 X)

| 영역 | 경로 | 제외 이유 |
|---|---|---|
| **메모리** | `~/.claude/memory/*.md` + `~/.claude/projects/*/memory/*.md` | **경험·세션 이력 축적용** 이지 판정 자산 아님. ckpt / feedback / research 등 human narrative 그대로 유지 |
| 루트 로드 | `~/.claude/CLAUDE.md` | DA 레이어보다 상위 (루트 auto-load + Model Routing 진입점) |
| DA 자체 | `~/.claude/decisions/*.yaml` | 이미 output |
| 런타임 상태 | `~/.claude/hook-state/` / `audit-log/` / `backup/` / `.lancedb/` / `.session-registry.txt` | 운행 상태·이력 |
| 코드 | `~/.claude/scripts/**/*.ts|.js|.py` + `~/.claude/hooks/*.js` + `~/.claude/settings.json` | 실행 코드는 DA 화 대상 아님 |

### 4.3 현재 상태 vs Phase G 완료 기준

| 시점 | 상태 |
|---|---|
| **현재 (2026-04-23 Phase E 완료)** | 전체 305 DA 중 **harness-wf scope (56 DA)** 만 3축 전부 적용 (chain 3개 + numeric-bounds 6 DA + cross-ref 일부). 나머지 249 DA 는 유사도 축만 (부분 enrich) |
| **Phase G 완료 기준 (예정)** | 전체 305 DA `enrich-cross-ref --scope=all` + rebuild.ts 에 enrich auto 호출 삽입 → **모든 영역 3축 완전 적용** (단 chain kind 는 필요 도메인에만 추가, 전면 확장은 선택) |
| **Phase H 완료 기준 (예정)** | 전체 확장 후 9문제 재풀이 + 답지 "점검 4" 섹션 + promotion-log K entry + plan/progress/guide `.plan-archive/` 이동 |

### 4.4 현재 실구현 gap (2026-04-23 기준)

허브 SSOT 신뢰성 유지를 위해 **설계 vs 실구현 괴리**를 명시한다. 아래 gap 은 `plan-da-lifecycle.md` Phase L10/L11 에서 해결 예정이며, 본 문서는 gap 해결 시점에 동기 갱신한다.

| # | Gap | 영향 | 해결 |
|---|---|---|---|
| G1 | **T1 `INDEX-critical.md` 미작성** | `da-loader.js` 가 파일 없음 → empty-safe skip. "T1 5k 슈퍼청크 상시 활성" 효익 **실질 0** (설계만 존재, 실제 주입 없음) | plan-da-lifecycle.md **Phase L10** (0.5 세션, 최우선) — 15-25 DA 를 2차원 매트릭스로 선별 Write |
| G2 | **T2 DA 스캔 상한 50** | `da-context.js` `daFiles.slice(0, 50)` — 305 DA 중 앞 50 개만 rule-based 매칭. 나머지 255 DA 는 T3 embedding fallback 에만 의존 (T2 rule 매칭 기회 누락) | plan-da-lifecycle.md **Phase L11** (0.5 세션) — keyword 역인덱스 pre-build + slice 제거 |
| G3 | **T3 Role Weighting 미적용** | T3 cosine sim 순위만 — agent role (worker/verifier/supervisor) 반영 없음. cross-role 맥락은 확보되지만 role-specific 우선순위 선별 불가 | plan-da-lifecycle.md **Phase L9** (1.5 세션) |
| G4 | **β Layer (auto-render mirror)** | `render-canonical.ts` 설계오류 (canonical 경로해석 불가 + §섹션 분리없음 + 원본 덮어쓰기 위험) — **보류 상태**. rules/*.md → DA 자동 mirror 기능 미동작 | Phase D/G 이관 (당장 필요도 낮음) |
| G5 | **Projection mode (minimal/standard/rich)** | 현재 DA 는 "풀 필드" 만 inject. mode 별 축소 render 미구현 | plan-da-lifecycle.md **Phase L4+L5** |
| G6 | **DA 상태 전환 자동화** | active ↔ dormant ↔ archived 4-state 설계만 존재, Read 빈도 추적 · 자동 전환 worker 미구현 | plan-da-lifecycle.md **Phase L1-L3** |

**현재 실효 동작 요약**:
- T1 상시 inject: **실질 0** (G1)
- T2 rule-based: **부분 동작** (앞 50 DA 만, G2)
- T3 embedding: **동작** (passive fallback + active MCP search_da)
- Drift 방어 Layer α/γ: **동작**
- Drift 방어 Layer β: **보류** (G4)

즉 현재 T2 + T3 의 혼합이 주력 경로이고 T1 상시 활성은 **Phase L10 로 해결 예정**. Phase E 에서 측정한 "9/9 high" 준수율도 이 gap 상태 하에서 달성한 것이므로, L10/L11 완료 시 추가 개선 여지가 있다.

## 5. 구성 파일 포인터 맵

### 5.1 데이터 / 스키마

| 파일 | 역할 |
|---|---|
| `~/.claude/decisions/*.yaml` | 305개 DA canonical YAML |
| [`~/.claude/decisions/README.md`](~/.claude/decisions/README.md) | 폴더 단위 3-layer 소개 + 편집 규칙 |
| [`~/.claude/decisions/SCHEMA.md`](~/.claude/decisions/SCHEMA.md) | kind 6종 (guard/heuristic/constraint/pattern/scenario/chain) / 필수 필드 / Derived Fields 알고리즘 |
| `~/.claude/.lancedb/` | LanceDB vector 인덱스 (`.gitignore`) |
| `~/.claude/decisions/.mirror-state.json` | rules/*.md sha256 drift 감지 상태 (β render 보류) |

### 5.2 파이프라인 코드

| 파일 | 역할 |
|---|---|
| `~/.claude/scripts/da-vector/md-to-da.ts` | md → YAML 결정론적 파서 (`extractSequence` + `deriveChainMarkers` + `sequence-sha256`) |
| `~/.claude/scripts/da-vector/structure-check.ts` | S1-S5 린트 (S5 = Chain-Incomplete: Sequence 필수 / len≥3 / action 필수 / actor enum / Terminal A) |
| `~/.claude/scripts/da-vector/rebuild.ts` | YAML → embed → LanceDB 재색인 (sequence-sha256 drift 체크 = Layer γ, `--force-rebuild` 우회) |
| `~/.claude/scripts/da-vector/lancedb-client.ts` | LanceDB 클라이언트 (connect / openTable / ingestDA / searchDA) |
| `~/.claude/scripts/da-vector/embed_service.py` | BGE-M3 FastAPI (:8787, `/embed` + `/health`) |
| `~/.claude/scripts/da-vector/lexicon.yaml` | marker 어휘 SSOT (Kind/Priority/Modality/Severity/Trigger/Sequence/Numeric-bounds/Entry-conditions/Exit-conditions) |
| `~/.claude/scripts/da-vector/llm-free/lexicon-nl-grammar.yaml` | T1 NL 어휘 (endings 7 / connectives 33 / verbs 34) |
| `~/.claude/scripts/da-vector/_backfill_numeric_bounds.ts` | Phase D 일회성 (harness-wf 52 DA numeric-bounds 추출) |
| `~/.claude/scripts/da-vector/render-canonical.ts` | β auto-render mirror (설계오류로 보류, Phase D/G 이관) |
| `~/.claude/scripts/da-vector/restore-canonical.sh` | `docs/backup/` 에서 원본 md 복원 |
| `~/.claude/scripts/da-vector/mcp_server.ts` | MCP 서버 (CLI 전용 프라이빗) |
| `~/.claude/scripts/da-vector/rebuild-batch.sh` / `rollout-sweep.sh` | 수동·cron 래퍼 |

### 5.3 훅 / 가드

| 파일 | 시점 | 역할 | 실구현 상태 |
|---|---|---|---|
| `~/.claude/scripts/da-vector/hooks/da-loader.js` (33 줄) | SessionStart | T1 상시 inject — `decisions/INDEX-critical.md` 내용 통째 additionalContext | ⚠ empty-safe skip (G1: INDEX 파일 미작성) |
| `~/.claude/scripts/da-vector/hooks/da-context.js` (225 줄) | UserPromptSubmit + PreToolUse | T2 rule-based (keyword + tool-name 매칭) + T3 embedding fallback (threshold 0.7 / 0.85) | ⚠ `slice(0, 50)` 상한 (G2: 앞 50 DA 만) |
| `~/.claude/scripts/da-vector/hooks/da-gate.js` (126 줄) | PreToolUse | Inhibitory meta-cognition gating — counter-example 매칭 시 warn inject (deny 아님) | 동작 중 |
| `~/.claude/hooks/chain-kind-guard.js` | PreToolUse (Write/Edit) | **Layer α** — Sequence 위반 차단 (누락 / step<3 / actor invalid) | 동작 중 (Phase B.6 완료) |
| `~/.claude/hooks/md-edit-preflight.js` | PreToolUse (Write/Edit, rules/docs 하위 .md) | T1 어휘 리마인더 inject | 동작 중 |
| `~/.claude/hooks/md-grammar-lint.js` | PostToolUse | rule-check 통과 시 auto-yaml write, 실패 시 unmatched feedback | 동작 중 |
| `~/.claude/scripts/da-vector/mcp_server.ts` (269 줄) | agent 명시 호출 | T3 active MCP — `search_da` tool 등록, `searchDA(vec, k, FIXED_FILTER)` LanceDB 쿼리 | 동작 중 |

**Drift 방어 3층**:
| 레이어 | 방어 대상 | 구현 |
|---|---|---|
| Layer α | chain kind Sequence 편집 시 위반 | `chain-kind-guard.js` PreToolUse block |
| Layer β | md 섹션 본문 drift (auto-render mirror) | `render-canonical.ts` (설계 문제로 보류) |
| Layer γ | chain Sequence 블록 drift (rebuild 시) | `rebuild.ts` + `sequence-sha256` mismatch → exit=2 block |

### 5.4 설정

| 파일 | 역할 |
|---|---|
| `~/.claude/settings.json` | PreToolUse / PostToolUse hook 등록 + `mcpServers.da-vector-store` (node + tsx) |

### 5.5 작성 가이드 / 파이프라인 상세

| 파일 | 범위 |
|---|---|
| [`~/.claude/docs/operations/chain-authoring-guide.md`](~/.claude/docs/operations/chain-authoring-guide.md) | chain DA 작성 (Sequence primary / Terminal A / numeric-bounds 포맷 / 품질 체크리스트) |
| [`~/.claude/docs/operations/llm-free-da-pipeline.md`](~/.claude/docs/operations/llm-free-da-pipeline.md) | 파이프라인 상세 (md-edit-preflight + md-grammar-lint + md-to-da + rebuild 엔드투엔드) |

## 6. 편집 사이클 + Drift 방어

### 6.1 정상 사이클

```
사용자 (또는 agent) 가 rules/*.md / docs/**/*.md / skills/**/*.md 의 ## {slug} 섹션 Edit
    ↓ [PreToolUse]  md-edit-preflight.js     — T1 어휘 리마인더 inject
    ↓ [PreToolUse]  chain-kind-guard.js      — Sequence 위반 block (Layer α, chain kind 섹션만)
Write / Edit 성공
    ↓ [PostToolUse] md-grammar-lint.js        — rule-check 통과 시 auto-yaml write
                                                (section-sha256 + sequence-sha256 동시 산출)
주기 rebuild (cron 또는 수동)
    ↓ rebuild.ts  → sequence-sha256 drift 체크 (Layer γ)
                  → BGE-M3 embed → LanceDB 재색인
런타임 agent query
    ↓ MCP da-vector-store  → T1/T2/T3 context inject via da-loader/da-context/da-gate hooks
```

### 6.2 Drift 방어 해시 2종

| 해시 | 대상 | 생성 시점 | 검증 시점 |
|---|---|---|---|
| `section-sha256` | md `## {slug}` 전체 섹션 본문 | md-to-da 변환 시 | 감사 wf 주기 스윕 |
| `sequence-sha256` | chain kind `Sequence` 블록만 | md-to-da 변환 시 | rebuild.ts 매 실행 (Layer γ) |

## 7. Phase 이력 요약

| 단계 | 일자 | 주요 산출 |
|---|---|---|
| llm-free-da-rollout | 2026-04-22 ~ 04-23 | md-to-da / lexicon / md-grammar-lint / rebuild / LanceDB / MCP server / DA YAML 292개 |
| DA Semantic Graph Phase A (설계) | 2026-04-23 | chain kind / numeric-bounds / Layer α·γ / B·D·G-spec / chain-authoring-guide / 예상 스냅샷 |
| Phase B (lightweight-wf Sonnet) | 2026-04-23 | md-to-da chain 파싱 + deriveChainMarkers + Sequence primary / structure-check S5 / chain-kind-guard.js / rebuild sequence-sha256 drift 체크 |
| Phase C (Opus 직접) | 2026-04-23 | `docs/domain/harness-wf-chains.md` 3 scenario-chain (23 step + 13 numeric-bounds key) |
| Phase D (lightweight-wf + D.2 Opus) | 2026-04-23 | `_backfill_numeric_bounds.ts` + 6 harness-wf DA 에 bounds 추가 (D.2 수동 보강 2건) |
| Phase E (Opus, PoC 검증 게이트) | 2026-04-23 | **PASS** — 9문제 재풀이 9/9 high, Q1/Q3/Q6 medium→high 승격, 추가 시나리오 3/3, 스냅샷 비교 PASS |
| Phase F | 2026-04-23 | **skip** (E PASS 로 조건부 미실행) |
| **Phase G (예정)** | — | rebuild auto-enrich + 292→305 전체 확장 + `enrich-cross-ref --scope=all` + 기존 실패 7 DA 처리 |
| **Phase H (예정)** | — | 전체 확장 후 9문제 재풀이 + 답지 "점검 4" + promotion-log K + plan/progress/guide `.plan-archive/` 이동 |

## 8. 관련 문서 cross-ref

| # | 파일 | 관계 |
|---|---|---|
| 1 | [`~/.claude/decisions/README.md`](~/.claude/decisions/README.md) | decisions 폴더 단위 3-layer 소개 (child) |
| 2 | [`~/.claude/decisions/SCHEMA.md`](~/.claude/decisions/SCHEMA.md) | DA YAML 스키마 명세 (child) |
| 3 | [`~/.claude/docs/operations/llm-free-da-pipeline.md`](~/.claude/docs/operations/llm-free-da-pipeline.md) | 파이프라인 상세 (child) |
| 4 | [`~/.claude/docs/operations/chain-authoring-guide.md`](~/.claude/docs/operations/chain-authoring-guide.md) | chain 작성 가이드 (child) |
| 5 | [`~/.claude/docs/operations/OPERATIONS_INDEX.md`](~/.claude/docs/operations/OPERATIONS_INDEX.md) | 본 문서 포함 운영 SSOT 인덱스 (parent index) |
| 6 | [`~/.claude/docs/domain/harness-wf-chains.md`](~/.claude/docs/domain/harness-wf-chains.md) | Phase C 산출물 (3 scenario-chain 본문) |
| 7 | `D:/projects/Obsidian/plan-da-semantic-graph.md` | Phase A-H 구현 계획 (본 세션 local) |
| 8 | `D:/projects/Obsidian/progress-da-semantic-graph.md` | Phase 체크박스 + Working Notes (본 세션 local) |
| 9 | `D:/projects/Obsidian/.research/phase-a-f-expected-snapshot-2026-04-24.md` | Phase E.5 비교 기준 스냅샷 |
| 10 | `D:/projects/Obsidian/.research/da-dogfood-questions-2026-04-24.md` + `da-dogfood-answers-opus-2026-04-24.md` | 9문제 dogfood + baseline + 점검 3 (Phase E.1) |
