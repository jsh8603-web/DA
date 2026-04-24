---
name: DA YAML Schema
description: Decision Asset (DA) YAML 스키마 공식 정의 + 인지과학 근거 + runtime 삽입 필드
type: reference
tags:
  - type/schema
  - domain/da-system
date: 2026-04-22
---

# DA (Decision Asset) YAML Schema

## 파일명

`DA-{YYYYMMDD}-{slug}.yaml`

- `YYYYMMDD` = KST 작성일 (하이픈 없음)
- `slug` = kebab-case, 영문 소문자 + 숫자 + 하이픈 (최대 40자)

## 필드 정의

```yaml
---
id: DA-{YYYYMMDD}-{slug}        # 파일명과 동일
kind: guard | heuristic | constraint | pattern | scenario | chain
  # guard      = 반드시 적용 (위반 = 손실). Deontic reasoning (R1).
  # heuristic  = 권장 (trade-off 있음). Kahneman-Tversky (R1).
  # constraint = 범위 한정. Preconditions.
  # pattern    = 긍정 재사용 구성. Case-Based Reasoning (R1).
  # scenario   = 복수 DA 를 순차/분기 조합한 flow aggregate (v2, 2026-04-22). steps 필드 필수.
  # chain      = 시퀀스 관계 명시 DA. Sequence primary 원칙 — agent 는 sequence 만 작성,
  #              input/output/actors 는 md-to-da 가 파생. when/if/then 은 선택적이며
  #              entry-conditions / exit-conditions 로 대체 가능. scenario (분기) 와 구분.
priority: critical | high | medium

trigger:
  keywords: []         # 자연어 매칭 (Rule-based first, R2)
  file-globs: []       # minimatch 패턴 (예: "**/*.md")
  tool-names: []       # Claude Code tool 이름 (Write, Edit, Bash 등)
  context-hints: []    # 소속 디렉토리/맥락 (예: memory/, rules/)

when: ""              # 활성 조건 자연어 1-2줄
if:   ""              # 조건 1줄
then: ""              # 행동/판정 1-2줄
because: ""           # 근거 요약

sources:              # 출처 (사람이 검증 가능)
  - canonical: ""          # 기존 규칙 문서 위치 (예: "~/.claude/rules/file-standards.md §Frontmatter")
    section-sha256: ""     # 섹션 본문 sha256 (rebuild.ts 가 ingest 시 계산/저장). R-U Canonical Drift Audit 의 비교 기준
    last-verified: ""      # YYYY-MM-DD. 감사 wf 순회가 UNCHANGED 또는 MINOR 판정 시 갱신
  - promotion-log: "" # YYYY-MM#section
  - plan: ""          # plan.md 경로
  - commit: ""        # git SHA
  - retrospective: "" # YYYY-MM-DD

counter-example: ""   # 적용 안 되는 케이스 (R1 Proximity Contrast — rule 바로 아래 배치)
anti-pattern: ""      # 잘못 해석 시 오작동 예시

# --- v3 chain kind 전용 필드 (2026-04-24 추가) ---
sequence:              # kind: chain 일 때 필수. Sequence primary 원칙 (B-spec §2.2.5)
  - step: int | string # 스텝 번호 또는 id
    stage: string      # 선택 — 스텝 이름/단계명
    trigger: string    # 선택 — 이 스텝을 활성화하는 조건
    condition: string  # 선택 — 종료/분기 조건
    action: string     # 필수 — 이 스텝에서 일어나는 행동
    actor: string      # 선택 — Worker | Verifier | Healer | SR | Supervisor | System
    da-ref: string     # 선택 — 참조 DA id
    fields-written: [] # 선택 — 이 스텝에서 기록되는 필드 목록

entry-conditions: ""   # kind: chain 선택 — chain 진입 조건 (when 대체 가능)
exit-conditions: ""    # kind: chain 선택 — chain 완료 조건

# chain kind derived fields (md-to-da 자동 파생, agent 가 md 에 직접 작성 금지):
input-role: ""         # sequence[0].actor (자동 파생)
output-role: ""        # sequence[last].actor (자동 파생)
output-condition: ""   # sequence[last].condition (자동 파생)
actors: []             # unique set of sequence[*].actor (자동 파생)

# numeric-bounds: 모든 kind 허용 (chain 에서 주로 사용)
numeric-bounds:        # 선택
  - key: string        # 경계 식별자
    value: number | string
    unit: string       # 선택 — 단위 (예: "ms", "개", "%")
    description: string

# --- v2 관계 필드 (2026-04-22 추가) — E 축 (Relational) ---
depends-on: []         # 선행 DA id 배열. "이 DA 적용 전 완료되어야 하는 DA" (sequential precedence)
applies-with: []       # 동시 활성 DA id 배열. "이 DA 와 같은 context 에서 함께 발동" (concurrent). 양방향 대칭 권장 (check-drift.ts --check 가 asymmetric 감지)
meta-of: []            # 메타 관계 DA id 배열. "이 DA 는 target DA 들의 메타 규칙" (예: violation-3step.meta-of = [folder-placement, frontmatter, ...])

# --- v2 C 축 필드 (표/체크리스트 구조 보존) ---
detail-table:          # 원본 rules 의 표/체크리스트 구조를 필드로 복원 (평면 then 문자열 압축 방지)
  - key: string        # 행의 key (폴더명, 필드명, 항목명 등)
    value: string      # 설명 또는 용도
    example: string    # 선택 — 구체 예시

# --- v2 F 축 필드 (scenario kind 전용) ---
steps:                 # kind: scenario 일 때만 사용. 순차/분기 flow aggregate
  - da_id: string      # 참조 DA id (또는 "(self-...)" placeholder)
    order: int         # 실행 순서 (1부터)
    role: precondition | body | postcondition | exception | meta
    condition: string  # 선택 — 활성 조건 (예: "target ∈ memory/*")
    branches:          # 선택 — 분기 로직 (if-else)
      - cond: string
        target: [DA-id, ...]   # 해당 분기에서 활성화할 DA 배열

version: 1            # semantic version (1, 1.1, 2, ...)
status: active | deprecated | experimental | superseded | draft-v2
effective-from: YYYY-MM-DD
last-verified: YYYY-MM-DD
supersedes: ""         # 선택 — 이 DA 가 superseded 시킨 이전 DA id (승계 chain)

# ACT-R Utility Learning (R1 Dynamic T1 promotion)
utility: 0.0           # [-1, 1] 범위. retrospective 갱신
last-hit: ""           # ISO-8601 (Brown-Peterson decay 기준)
hit-count: 0           # 누적 호출
---

# DA-{id}: {한 줄 제목}

## Signal-to-Action (3-5줄 자연어)

실제 agent 에 주입될 인간 언어 설명. DA 를 한눈에 이해할 수 있는 컨텐츠.

## 적용 사례 (retrospective 연계)

- {date}: {situation} → {outcome: GOOD/NEUTRAL/BAD/INSUFFICIENT}
```

## v2 필드 상세 (2026-04-22 추가)

### 관계 필드 3개 (E 축)

| 필드 | 의미 | 예시 |
|---|---|---|
| `depends-on` | 선행 조건 (순서 있음) | `working-notes-format.depends-on: [ckpt-route-by-progress, progress-md-must-exist]` |
| `applies-with` | 동시 활성 (양방향 대칭) | `folder-placement.applies-with: [frontmatter, global-index]` |
| `meta-of` | 메타 규칙 (target DA 들의 상위 제약) | `violation-3step.meta-of: [folder-placement, frontmatter, global-index, promotion-log-duty, ...]` |

### `detail-table` (C 축)

원본 rules 의 표·체크리스트·스키마 구조를 보존. 평면 `then: "rules/(전역강제) / docs/domain/(도메인) / ..."` 대신 구조 보존.

사용 예:
```yaml
detail-table:
  - key: rules/
    value: 시스템 전역 강제 규칙
    example: file-standards.md, pc-tools.md
  - key: docs/domain/
    value: 특정 지식 도메인 상세 가이드
    example: agent-task-api.md
```

### `kind: scenario` + `steps` (F 축)

복수 DA 를 순차/분기 조합. `then` 은 요약 문장 (full flow 는 `steps` 참조) + `kind: scenario` 명시.

사용 예 (`SC-compact-then-ckpt`):
```yaml
kind: scenario
steps:
  - da_id: progress-md-must-exist
    order: 1
    role: precondition
  - da_id: ckpt-route-by-progress
    order: 2
    role: body
    branches:
      - cond: "progress.md 존재"
        target: [working-notes-format, ckpt-format-kst-minute]
      - cond: "progress.md 부재"
        target: [ckpt-format-kst-minute]
```

### `kind: chain` + `sequence` (v3, 2026-04-24)

시퀀스 플로우 명시 DA. `scenario` (DA-id 분기 aggregate) 와 달리 단일 DA 안에 순차 절차를 직접 정의한다.

**Sequence primary 원칙**: agent 는 `**Sequence**:` 블록만 작성. `input-role` / `output-role` / `output-condition` / `actors` 는 md-to-da.ts 가 `deriveChainMarkers(sequence)` 로 자동 파생 — md 에 직접 작성하면 경고 + 무시.

**Terminal step 규칙 (A)**: sequence 마지막 index = terminal. 후속 step.next 또는 condition.goto 가 마지막 index 를 참조하면 S5 에러.

**필수 제약**: sequence.length >= 3, 각 step.action 필수.

사용 예:
```yaml
kind: chain
sequence:
  - step: 1
    stage: "Worker 실행"
    action: "Worker 가 task 착수"
    actor: Worker
  - step: 2
    condition: "Worker PASS"
    action: "Verifier 가 검수 시작"
    actor: Verifier
  - step: 3
    action: "SR 이 전략 리뷰"
    actor: SR
# 자동 파생 (agent 작성 금지):
input-role: Worker       # sequence[0].actor
output-role: SR          # sequence[last].actor
output-condition: null   # sequence[last].condition
actors: [Worker, Verifier, SR]
```

### Derived Fields (chain kind only)

md-to-da.ts `deriveChainMarkers(sequence)` 가 자동 파생. agent 는 md 에 작성 금지.

| 필드 | 파생 규칙 |
|---|---|
| `input-role` | `sequence[0].actor` |
| `output-role` | `sequence[sequence.length-1].actor` |
| `output-condition` | `sequence[sequence.length-1].condition` |
| `actors` | `Set(sequence[*].actor)` |

agent 가 실수로 md 에 `**Input-role**:` 등을 쓰면 md-to-da 가 경고 + 무시한다.

### `**Sequence**:` marker

chain kind DA 에서 사용하는 bullet-list-structured marker. 각 step 은 인덴트 2+ 공백의 서브 필드로 구성:

```markdown
**Sequence**:
- step: 1
  stage: "단계 이름"
  action: "이 스텝에서 수행하는 행동 (필수)"
  actor: Worker
  condition: "완료 조건 (선택)"
  da-ref: "DA-20260422-some-da (선택)"
  fields-written: "field1, field2 (선택)"
```

### `**Numeric-bounds**:` marker

모든 kind DA 에서 사용 가능. 수치 경계값을 명시:

```markdown
**Numeric-bounds**:
- ctx-warn-threshold: 130000 (tokens, Sonnet warn 임계)
- retry-max: 3 (회, 최대 재시도 횟수)
- timeout: "5min" (분, 작업 타임아웃)
```

파싱 규칙: `- key: value (unit, description)` 형식. unit 은 첫 쉼표 앞, description 은 이후.

### 관계 필드 무결성 감사

`check-drift.ts --check` 가 자동 검증:
- **missing** — 참조된 DA id 가 존재하지 않음
- **superseded** / **deprecated** — 참조된 DA 가 무효 상태
- **asymmetric** — A.applies-with 에 B 있는데 B.applies-with 에 A 없음
- **steps.target missing** — scenario.steps[].branches[].target 의 DA id 검증

## Runtime 삽입 필드 (파일엔 없음, Selector 가 추가)

- `confidence`: T2/T3 매칭 점수 (R2 Maybe-Trigger)
- `retrieval-score`: embedding top-k cosine
- `tier-reason`: "T1 always-on" | "T2 keyword:X" | "T3 embed:0.82"

## K scope vs DA kind (독립 2축)

| 축 | 값 | 의미 |
|---|---|---|
| **K scope** (promotion-log) | factual / judgment / process | 지식 성질 (앎의 종류) |
| **DA kind** (본 스키마) | guard / heuristic / constraint / pattern | 집행 강도 (적용 방식) |

두 축 교차 가능. 예: `K:factual + DA:guard` = 검증 가능한 강제 규칙.

## 인지과학 근거 (R1 요약)

- `guard/constraint` ↔ Deontic reasoning (의무·금지·허가)
- `heuristic` ↔ Kahneman-Tversky 휴리스틱 (제한된 합리성)
- `pattern` ↔ Case-Based Reasoning + schema instance
- `utility`·`last-hit` ↔ ACT-R Utility Learning (`U_new = U_old + α(R - U_old)`, α=0.1)
- `counter-example` 근접 배치 ↔ R1 Proximity Contrast (Gentner-Markman)

## 관련 문서

- Plan §2: `D:/projects/Obsidian/plan.md` (스키마 디자인 근거)
- R1: `.research/r1-brain-cognition.md` (인지과학 매핑)
- R2: `.research/r2-agent-memory-sota.md` (Letta 3-tier + MemBench 지표)
