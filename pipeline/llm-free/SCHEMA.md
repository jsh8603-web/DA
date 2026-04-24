---
tags: [type/schema, project/llm-free-da]
date: 2026-04-22
---

# lexicon-nl-grammar.yaml — SCHEMA

> **목적**: md 본문을 DA 필드로 결정론적 변환하기 위한 표준 어휘 사전 (L2, 본문 문법). L1 `lexicon.yaml` (bold-marker 헤더) 과 쌍을 이룬다.

## 1. 구조

```yaml
version: v1.0
source: draft-v0.5
stats:
  verbs: 136
  endings: 87
  connectives: 108
  total: 331
  tier_distribution: {...}

verbs: [...]         # 동사 어간
endings: [...]       # 어미 / 종결 표현
connectives: [...]   # 조건·인과·대조 연결어
```

## 2. 필드 정의

### 2.1 verbs

| 필드 | 타입 | 설명 |
|---|---|---|
| `stem` | string | 동사 어간 (예: `확인`, `사용`) |
| `forms` | list | 실제 등장한 활용형 (예: `[확인한다, 확인해야 한다, 확인 시]`) |
| `occurrences` | int | 전 코퍼스 등장 횟수 |
| `file_coverage` | int | 등장한 고유 파일 수 |
| `tier` | 1/2/3 | Tier 분류 |

### 2.2 endings

| 필드 | 타입 | 설명 |
|---|---|---|
| `text` | string | 어미 또는 종결 표현 (예: `-해야 한다`) |
| `modality` | enum | `must / must-not / should / may / neutral` |
| `negate` | bool | (선택) 부정형 여부 |
| `occurrences` | int | |
| `file_coverage` | int | |
| `tier` | 1/2/3 | |

### 2.3 connectives

| 필드 | 타입 | 설명 |
|---|---|---|
| `text` | string | 연결어 (placeholder `{X}`, `{Y}` 허용) |
| `da_field` | enum | `when / if / then / because / counter-example / anti-pattern / neutral` |
| `occurrences` | int | |
| `file_coverage` | int | |
| `tier` | 1/2/3 | |

## 3. Modality 분류 기준

| Modality | 자연어 표현 | DA 동작 |
|---|---|---|
| `must` | "반드시 ~", "~해야 한다", "⛔ 금지", "필수" | Guard 차단 / Hook 강제 주입 |
| `must-not` | "~지 말 것", "~하면 안 된다", "금지한다" | 반대 조건 강제 |
| `should` | "~이 좋다", "권장", "기본값" | 경고 inject 만 |
| `may` | "~해도 된다", "허용" | 정보성 |
| `neutral` | "-한다", "-이다" | 기술 평어체 |

## 4. DA field 분류 기준

| da_field | 자연어 패턴 | 예시 |
|---|---|---|
| `when` | "~할 때", "~에서", "~ 시점" | `~할 때` occ=82 |
| `if` | "만약 ~라면", "~이면", "~이 있으면" | `~이면` occ=89 |
| `then` | "~해야 한다", "반드시 ~", "→" | `반드시 {X}한다` occ=46 |
| `because` | "왜냐하면 ~", "~이므로", "~ 때문이다" | `~이므로` occ=37 |
| `counter-example` | "단, ~", "예외: ~" | `단, ~` occ=13 |
| `anti-pattern` | "~하면 안 됨 (위반 사례)" | |
| `neutral` | 논리 접속사 (또는, 그리고) | `또는` occ=17 |

## 5. Tier 정의

**coverage-ratio 기반** (누적 occurrences %):

| Tier | 범위 | 용도 | 크기 (v1.0) |
|---|---|---|---|
| **T1** | 0-70% | auto-load (agent inject, rules/md-grammar.md 본문) | verbs 34 / endings 7 / connectives 33 = **74** |
| **T2** | 70-90% | reference (필요 시 Read) | 47 / 31 / 38 = 116 |
| **T3** | 90-100% | domain-specific, long-tail (검증용) | 55 / 49 / 37 = 141 |

**per_da_field_min = 3**: connective 의 각 `da_field` (when/if/then/because 등) 최소 top-3 는 T1 보장 — 롱테일 DA field 가 T1 에서 배제되는 것 방지.

## 6. LLM Inject 가이드

### Agent write-time (rules/md-grammar.md)

- **T1 전체를 rule 본문에 내장** (~2.7k tokens, auto-load)
- T2/T3 는 pointer 만: `"전체 사전: scripts/da-vector/llm-free/lexicon-nl-grammar.yaml"`
- agent 가 md 작성 시 T1 어휘 우선 사용, 벗어나는 자유 서술은 `**Narrative**:` 블록으로 격리

### Rule parser (md-to-da.ts)

- **전체 lexicon (T1+T2+T3) load** — 모든 tier 매칭 시도
- T1 매칭 = 강한 신호 / T2 = 중간 / T3 = 약한 신호 (동점 시 T1 우선)
- 매칭 실패 시 `unmatched[]` 에 기록 → linter 가 사용자/agent 에 피드백

## 7. Extension Policy (확장 정책)

**incident-driven only** — batch 재추출 없음.

1. Agent 가 md 작성 → linter 가 unmatched 감지
2. **기본 경로**: agent 가 narrative 이동 or 표준 문법으로 교정 (md 수정)
3. **예외 경로** (신규 어휘 필요): lexicon 항목 추가 제안 → **사용자 승인 게이트**
4. 추가 후 `tierize.py` 재실행 → tier 자동 재분류 (batch 재스캔 없음)

## 8. 호환성

- **L1 `lexicon.yaml`** (bold-marker 헤더): 섹션 구조 파싱 담당. **본 L2 와 독립 운용**
- **DA YAML 스키마** (`decisions/SCHEMA.md`): L2 파싱 결과의 타겟 포맷
- **md-to-da.ts**: L1 로 섹션 추출 → 각 섹션 본문에 L2 `rulePass()` 적용

## 9. 변경 이력

| Version | Date | 변경 |
|---|---|---|
| v1.0 | 2026-04-22 | 초기 릴리스. Batch-1~5 (37 파일) 부트스트랩 + 정규화 + Tier 분류 |
