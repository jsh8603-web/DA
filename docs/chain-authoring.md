---
name: Chain Authoring Guide
description: chain kind DA 작성 가이드. sequence / numeric-bounds 필드 작성 기준 + Opus 세션 중 원본 md Read 허용 + 품질 체크리스트
type: guide
tags:
  - type/guide
  - domain/da-system
  - load/on-demand
date: 2026-04-24
---

# Chain Authoring Guide

> **배경**: DA Semantic Graph Enhancement (2026-04-24 plan) 에서 도입된 `kind: chain` 과 `**Numeric-bounds**:` marker 의 실제 작성 가이드. Opus 가 세션 중에 chain DA 를 생성·수정할 때 본 가이드를 참조한다.
>
> **적용 범위**: `~/.claude/rules/*.md`, `~/.claude/docs/**/*.md`, `~/.claude/skills/**/*.md` 중 `kind: chain` 섹션을 신규 작성·수정할 때.
>
> **Sonnet 대상 아님**: chain kind DA 작성은 Opus 전용. Sonnet 은 Phase B 구현 (파서) 또는 Phase D (numeric-bounds backfill 스크립트 실행) 에 한정.

## 0. 핵심 원칙 (2026-04-24 Ruler ACCEPT 확정) ⚠️ 필독

**Sequence = Primary source. Marker = Derived view.**

agent (Opus) 가 **작성하는 필드**:
- `**Kind**: chain`
- `**Sequence**:` (필수, ≥3 step)
- `**Entry-conditions**:` / `**Exit-conditions**:` (최소 하나)
- `**Numeric-bounds**:` (선택)
- 기존 공통 필드 (Priority / Modality / Severity / Trigger / Because / Examples / Counter-example / Anti-pattern / Signal-to-Action)

agent 가 **작성 금지**:
- `**Input-role**:` — Sequence 첫 step actor 로 자동 파생
- `**Output-role**:` — Sequence 마지막 step actor 로 자동 파생
- `**Output-condition**:` — Sequence 마지막 step condition 으로 자동 파생
- `**Actors**:` — Sequence 전체 actor set 으로 자동 파생

**이유**: 두 representation (marker + sequence) 공존 시 drift 발생 불가피. Sequence 만 primary 로 두면 marker 는 항상 Sequence 의 view — **drift 개념 자체가 존재 불가** (Ruler 회신: "Single Source of Truth = drift 의 교과서적 해법").

**Terminal step 규칙 (A)**: Sequence 마지막 index = terminal step. 루프/분기는 condition 으로만 표현하고 실제 sequence 순서는 선형. lint 가 "terminal step 이 마지막 index 가 아님" 에러를 강제.

## 1. chain kind 언제 쓰나

scenario vs chain 구분:

| kind | 용도 | 예시 |
|---|---|---|
| scenario | **분기 상황** — "X 조건이면 Y, Z 조건이면 W" | `healer-activation-triggers` (3 시그널별 분기) |
| chain | **시퀀스 플로우** — "A → B → C → D" 순차 관계 | `fail-escalation-flow`, `phase-loop-with-registry` |

**판정 기준**:
- 단일 시점 규칙 → 기존 kind (guard/constraint/pattern/scenario)
- 여러 역할이 순차적으로 엮인 end-to-end 플로우 → **chain**
- 숫자 경계 (retry count, threshold) 가 플로우 진행에 영향 → chain + numeric-bounds

## 2. 원본 md Read 허용 (RR7 해소)

chain DA 는 개별 DA 만으로 유도 불가 — 원본 md 의 암묵 지식 (supervisor.md § 페이즈 루프, common.md § 통신 프로토콜 등) 이 필요할 수 있다.

**허용 경로**:
- Opus 가 chain DA 작성 시 `~/.claude/skills/harness-wf/*.md`, `~/.claude/docs/operations/*.md` 등 원본 md **Read 가능**
- Sonnet sub-session 은 chain DA 작성 대상 아님 (Phase C 는 Opus 전용)
- dogfood 테스트 (응시자) 시엔 원본 md Read 금지 (이건 테스트 프로토콜이지 본 가이드 범위 아님)

**정책 정당화**: md → DA 변환은 일회성 설계 투자. 이후 DA 자체가 재사용 자산이 되어 유지보수 0 원칙을 지킨다. chain 작성 중 원본 Read 는 **설계 단계** 에 속하지 운영 단계가 아니다.

## 3. sequence step 필드 선택 기준

### 3.1 필수 필드

| 필드 | 필수 | 역할 |
|---|---|---|
| step | ✓ | 번호 (1부터 순차). 분기 시 `4a`/`4b` 허용. |
| action | ✓ | 수행 동작. **동사로 시작** ("호출한다", "수정 시도", "판정"). |

### 3.2 권장 필드

| 필드 | 권장 조건 |
|---|---|
| actor | 주체가 명확할 때 반드시 기입 (Worker/Verifier/Healer/SR/Supervisor/System) |
| stage | 상위 phase (⑦ 루프, ⑧ 종료 등) 참조가 의미 있을 때 |
| trigger | 이 step 진입 이벤트가 외부 시그널일 때 ("Verifier FAIL 수신") |
| condition | sequence 내부 루프/분기 조건 ("retry-count < 3") |
| da-ref | 이 step 이 의존하는 기존 DA id |
| fields-written | 이 step 이 write 하는 파일·필드 (audit trace 용) |

### 3.3 actor 허용 값

`Worker`, `Verifier`, `Healer`, `SR`, `Supervisor`, `System`.

`System` = 자동 hook / 시스템 automation (예: rebuild post-hook, md-grammar-lint). 사람이 수행하는 역할과 구분.

### 3.4 step 번호 관례

- 기본: 1, 2, 3, ... 순차 정수
- 분기: `4a`, `4b` (step 4 에서 조건에 따라 둘 중 하나)
- 루프: step 번호 재사용 허용하지만 **condition 필드로 루프 경계 명시**

## 4. numeric-bounds 작성 규칙

### 4.1 md 본문 포맷

```markdown
**Numeric-bounds**:
- {key}: {value} ({unit}, {description})
- {key}: "{string-value}" ({description})
```

**key 명명 규칙**:
- kebab-case 영문 identifier
- 의미적 도메인 prefix 권장 (`worker-retry-limit`, `sr-mode-for-healer-fail`)
- 범용 이름 회피 (`threshold`, `limit` 단독 금지)

**value 허용 타입**:
- 정수 (`3`, `10`)
- 소수 (`0.75`)
- 문자열 (따옴표 필수): `"T3 Creative Window"`, `"없음"`, `"IDLE 전환마다 1회"`

**unit 표기**:
- 숫자 값: 단위 필수 (`회`, `%`, `개`, `점`, `분`, `k`)
- 문자열 값: unit 생략 (괄호 안에 description 만)

### 4.2 예시 완전판

```markdown
**Numeric-bounds**:
- worker-retry-limit: 3 (회, Worker 자동 재시도 상한 — escalation-chain ① 경계)
- context-threshold: 10 (%, Worker 장시간 작업 금지선)
- spark-threshold: 3 (개, Ignite 시그널 발동)
- round2-score-diff-threshold: 3 (점, SR 재반박 임계값)
- sr-mode-for-healer-fail: "T3 Creative Window" (Mode A/C/G 아님)
- watchdog-interval: "IDLE 전환마다 1회" (고정 주기 아닌 이벤트 기반)
```

### 4.3 chain 외 일반 DA 에도 사용 가능

numeric-bounds 는 **모든 kind** 에서 사용 가능. 단 다음 조건에만 추가:
- DA 본문에 수치가 **경계 역할** (임계값 / 상한 / 하한) 로 쓰일 때
- 단순 예시 수치 (예: "3~5 개") 는 대상 아님

## 5. 완전판 예시 — `harness-wf-fail-escalation-flow`

```markdown
## harness-wf-fail-escalation-flow

**Kind**: chain
**Priority**: high
**Modality**: must
**Severity**: ux-failure (에스컬레이션 체인 건너뛰기 = 과도한 직접 수정 또는 불필요한 인간 개입)

**Trigger**:
- Keywords: `Worker FAIL`, `Healer 실패`, `에스컬레이션`, `retry-count`, `DEADLOCK`
- Context: harness-wf Phase 루프 ⑦ 내 FAIL 순환

**Sequence**:
- step: 1
  stage: "Phase 루프 ⑦"
  trigger: "Worker 구현 완료 + Verifier 통보"
  action: "Verifier 가 즉시 검증 → PASS 판정"
  actor: Verifier
  da-ref: DA-20260422-harness-wf-verifier-trigger-events
- step: 2
  trigger: "Verifier PASS"
  condition: "Sub-obj PASS"
  action: "다음 Sub-obj 로 진행 — chain 탈출"
  actor: Worker
- step: 3
  trigger: "Verifier FAIL (첫 번째)"
  action: "Healer 호출 + retry-count 증가"
  actor: System
  da-ref: DA-20260422-harness-wf-healer-activation-triggers
- step: 4
  condition: "retry-count < 3"
  action: "Healer 가 수정 + 재검증 요청"
  actor: Healer
  da-ref: DA-20260422-harness-wf-healer-fix-complete-format
  fields-written:
    - "execution-log.md:💡"
- step: 5
  trigger: "Verifier FAIL (2번째 이상)"
  condition: "retry-count < 3"
  action: "step 3 으로 루프 — Healer 재호출"
  actor: System
- step: 6
  condition: "retry-count >= 3"
  action: "Supervisor 중재 (escalation-chain ②)"
  actor: Supervisor
  da-ref: DA-20260422-harness-wf-supervisor-escalation-chain
- step: 7
  condition: "Supervisor 중재 실패"
  action: "SR T3 Creative Window 호출 — 창의 대안 요청"
  actor: Supervisor
  da-ref: DA-20260422-harness-wf-sr-event-triggers-t1-t4
- step: 8
  condition: "SR 대안 후에도 실패"
  action: "Supervisor 직접 수정 (escalation-chain ③)"
  actor: Supervisor
- step: 9
  condition: "직접 수정 실패"
  action: "[DEADLOCK] 인간 에스컬레이션 (escalation-chain ④)"
  actor: Supervisor
  fields-written:
    - ".harness/improvement-registry.md:new-row"

**Entry-conditions**: "Worker 가 Sub-obj 구현 완료 + Verifier 에 시그널 전송한 직후"
**Exit-conditions**: "PASS (step 2 탈출) 또는 DEADLOCK (step 9)"

**Numeric-bounds**:
- worker-retry-limit: 3 (회, step 6 Supervisor 중재 진입 임계값)
- sr-mode-for-healer-fail: "T3 Creative Window" (Mode A/C/G 아님)

**When**: Phase 루프 ⑦ 내에서 Worker Sub-obj 실행 후 Verifier 피드백 순환 시.
**Because**: 에스컬레이션 체인 건너뛰기는 Worker 학습 기회 상실 (너무 이른 Supervisor 개입) 또는 불필요한 사용자 방해 (너무 늦은 인간 에스컬레이션) 를 유발한다. 4단계 순차 승격과 retry-count 3 임계값이 자율성/개입 균형점이다.

**Examples**:
- "Worker 가 3 번 실패하면 뭐 해"
- "Healer 도 실패했을 때 SR 언제 호출해"
- "DEADLOCK 이 뭐야 어떻게 보고해"

**Counter-example**: 첫 FAIL 에서 명백한 오류 (타이포 등) 감지 시 Supervisor 가 1단계 생략하고 즉시 수정 허용. 사용자가 긴급 표시한 경우 step 9 (인간 에스컬레이션) 로 바로 진입 허용.

**Anti-pattern**: 1회 FAIL 후 즉시 Supervisor 직접 수정 → Worker 학습 기회 상실 + Healer 루프 3회 기회 낭비. SR 트리거 생략 → 창의 개입 타이밍 상실.

**Signal-to-Action**:
Worker 구현 → Verifier FAIL → Healer 수정 → 재검증 FAIL 순환에서 retry-count 3 도달 시 Supervisor 중재 (step 6), Supervisor 실패 시 SR T3 호출 (step 7), SR 후에도 실패 시 Supervisor 직접 수정 (step 8), 최종 실패 시 [DEADLOCK] 인간 에스컬레이션 + improvement-registry 기록 (step 9).
```

## 6. 품질 체크리스트 (작성 완료 후 반드시 확인)

**반드시 pass 해야 md-to-da 변환 성공**:
- [ ] `kind: chain` 선언
- [ ] `sequence` 최소 3 step
- [ ] 모든 step 에 `action` 필드 있음 (빈 문자열 금지)
- [ ] `because` 필드 있음

**권장 확인**:
- [ ] 모든 step 에 `actor` 필드 있음 (Worker/Verifier/Healer/SR/Supervisor/System 중)
- [ ] `entry-conditions` + `exit-conditions` 둘 다 있음 (최소 하나 필수)
- [ ] `numeric-bounds` 에 수치 경계 1개+ (이 chain 이 수치와 무관하면 생략)
- [ ] `da-ref` 를 활용해 기존 DA 와 연결 (chain 이 기존 DA 들의 orchestration 임을 명시)

**Anti-pattern 확인**:
- [ ] sequence step 이 단순 선형 나열 아님 (분기/루프/condition 이 플로우를 표현)
- [ ] action 필드가 서술식 문장 (`~을 ~한다`) 가 아닌 **동사구**
- [ ] numeric-bounds 의 key 가 범용 이름 (`threshold`) 아닌 의미적 prefix 포함

## 7. Opus 세션 중 작성 순서

1. **설계 의도 확인**: 이 플로우가 scenario (분기) 인가 chain (시퀀스) 인가?
2. **원본 md Read**: 해당 skill/rule md 의 §페이즈 루프, §에스컬레이션 등 관련 섹션
3. **step 뼈대 작성**: stage + trigger + action + actor 4 필드 우선
4. **da-ref 연결**: 각 step 이 기존 DA 중 어느 것과 연관되는지 매핑
5. **numeric-bounds 추출**: step 에서 언급한 수치를 구조화
6. **품질 체크리스트** 전체 점검
7. **md-to-da 변환 실행** → yaml 검증

## 8. 실패 사례 회피

### 8.1 sequence 가 너무 짧다 (< 3 step)
→ chain 으로 만들 가치 없음. scenario/pattern 으로 대체.

### 8.2 action 이 추상적
→ "처리한다" / "진행한다" 대신 "Verifier 호출" / "yaml Write" 같이 구체.

### 8.3 numeric-bounds 에 의미 없는 수치
→ 단순 예시 수치는 detail-table 로. numeric-bounds 는 **경계값** 전용.

### 8.4 actor 생략
→ 대부분의 step 에 주체가 있어야 책임 명확. 생략하면 audit trace 품질 저하.

### 8.5 chain 남용
→ "모든 플로우를 chain 으로" 는 오답. 단일 규칙 (guard/constraint) 도 여전히 유효. chain 은 **여러 역할 + 시퀀스 + 수치 경계** 가 동시에 있을 때만.
