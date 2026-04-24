# Round 1 — Rebuttal: Attack 에 대한 Steelman 저자 방어/양보/중재

> 대상: `debate-R1-attack.md` (이하 A)
> 전제: 기 확정 L12.4 는 debate 범위 밖. Rebuttal 은 Steelman 저자 (Proposer) 관점.
> 형식: 각 WEAK 에 대해 **(a) defend / (b) concede + accept alternative / (c) compromise middle-ground** 중 하나로 명시 판정. Evidence 인용 + P-grid 재조정.

---

## 0. Opening — Attack §0 재프레이밍에 대한 응답

A §0 은 Steelman 의 "3단계 분할" 을 **"의존성 DAG 로 엮인 6 단계 빌드"** 로 재해석했다. 이 재해석의 **핵심 주장은 유효** — 6 확장 동시 편입 시 cold start 가 합산 대기하며, 실측 정당화 종료 시점이 3개월 단위까지 늘어날 수 있다는 부분은 **concede**.

그러나 재해석의 **결론은 부분 수용**:
- 동시 편입 반려는 타당 → **순차 enable** 로 동의 (A §5 제안과 정렬).
- "선지불/후지불" 비대칭은 **Tier 팽창을 단계별 분할** 로 해소 가능 — 전체 +1-1.5 세션을 한 번에 적용하지 않고, 즉시 편입분 (E1+E3) 의 +0.5 세션만 선편입 후 나머지는 실측 gate 통과 시 단계 확장.
- ROI attribution 불가 주장은 A §5 의 A/B framework 수용 시 해소됨 → **Rebuttal 의 통합 조건**으로 채택.

**Rebuttal 의 전체 포지션**: P1 (L12.2 재발 방지) + E1/E3 의 실체적 가치는 방어 유지. 나머지 4 확장 (E2/E4/E5/E6) 은 **구조 수정 + 조건부 편입** 으로 compromise. A 의 대안 중 실질 기여도가 높은 안은 적극 accept.

---

## 1. WEAK 5건 응답

### WEAK-1 — E2 cold start → **(c) Compromise**

**Attack Evidence 인용** (A §WEAK-1): *"L12.4 (1-2주) + E2 활성화 대기 (7일) = 21-28일 cold start"* + *""정상 동작" 은 저자 framing. 실질은 E2 uplift = 0 인 구간"*.

**판정**: **Compromise** — "정상 동작" 수사학 문제는 인정 (**concede**), 그러나 E2 자체 폐기는 과도. A 의 두 대안 (`E2-deferred 30건 임계` / `E2-manual-seed`) 을 **하이브리드로 결합** 해 cold start 를 구조적으로 해결.

**새 방어 논리**:
- "21-28일 ROI 0" 주장의 전제는 "E2 가 활성화되기 전까진 아무것도 못 한다" 인데, 1인 사용자라는 특성 자체가 manual seed 의 **저비용 대안** 을 가능케 한다.
- Manual seed 는 초기 3-5 pair 사용자 수동 기입 → cold start 즉시 해결. 자동 파이프는 L12.4 누적 30건 돌파 후 manual seed 를 **대체** — manual seed 는 점진적으로 자연 수확분으로 교체됨.
- 즉 "manual seed 부담 ↔ 자동 파이프 cold start" 이중 딜레마를 **manual first, auto-replace later** 로 풀 수 있다.

**새 제안 — E2-hybrid**:
```
Phase 1 (Day 0): .t2-fewshot-seed.json 에 사용자 수동 입력 3 pair
                 (예: grandfather → file-standards-frontmatter)
Phase 2 (Day 1-30): 자동 파이프 비활성, seed 만 few-shot 으로 주입
Phase 3 (Day 30+): L12.4 누적 promote ≥30건 AND 고유 DA ≥10개 → 자동 활성
                   seed 는 자동 수확분에 덮어써짐 (cap=3 고정)
롤백: enableFewshot=false 또는 .t2-fewshot*.json 삭제 (1줄)
```

**P-grid 조정**: P5 FAIL → **WARN** (seed 로 cold start 해소). P2 FAIL → **WARN** (Phase 3 전환 시 자연 측정가능, uplift-commit 적용 가능).

---

### WEAK-2 — E4 한국어 파편화 + DA-ID-enum → **(b) Concede + accept alternative**

**Attack Evidence 인용** (A §WEAK-2): *"Obs 1: 'frontmatter date 필드 필요' / Obs 2: 'YAML 헤더 date 누락 시 처리' / Obs 3: '파일 생성 날짜 규칙' — 세 observation 은 모두 동일 개념을 가리키지만 세 개의 서로 다른 naked string 으로 저장됨. N=3 문턱 도달 전에 파편화"*.

**판정**: **Concede + accept alternative** — 한국어 agglutinative 파편화 주장은 **구체 예문 3개로 실증** 되어 defend 불가. A 의 `E4-DA-ID-enum` 대안 **전면 수용** + `E4-MVP (auditor only)` 도 함께 수용.

**수용 이유**:
- Steelman §E4 "판정자 vs 생산자" 구조 논리는 유지됨 — DA-ID-enum 구조에서도 LLM 은 기존 DA 목록에서 enum 선택 (판정자), keyword 를 상상하지 않음 (생산자 아님).
- 자연어 missing_context 의 "신규 DA 발견 경로" 상실은 A 가 지적한 대로 **E1 Read 증거원이 이미 담당** (사용자가 MD 를 열면 그 MD 가 곧 신규 DA candidate). 중복 경로 제거.
- JSON schema 준수율 문제도 enum 목록 제한으로 대폭 완화 (자유 문자열 대비 schema violation 감소).

**수정된 E4 최종안 — E4-enum-MVP**:
```
schema:   {is_sufficient: bool, missing_da_ids: string[]}  # enum from existing DA
profile:  auditor only (coder / harness-worker 는 보류)
누적:     DA ID 별 카운팅 (naked string N 누적 제거)
보조:     선택적 missing_context_note: str 필드 (로그 진단용, N 카운트 제외)
롤백:     profile gating 에서 auditor 제거 (1줄)
확장:     auditor 에서 JSON 준수율 ≥ 80% 검증 후 profile 추가 단계별 확장
```

**P-grid 조정**: P3 FAIL → **PASS** (자연어 정규화 제거로 복잡도 해결). P2 FAIL → **WARN** (MVP 로 측정 범위 축소, uplift-commit 적용 가능).

---

### WEAK-3 — E5 premature optimization → **(b) Concede**

**Attack Evidence 인용** (A §WEAK-3): *"E5 는 이미 binary 로 작동하는 시스템을 smooth 하게 만드는 것. 현재 pain (T2 80% plateau, keyword 공백) 과 직접 관련 없음"* + *"주입 공간 경쟁의 quantification 은 관측되지 않은 병목"*.

**판정**: **Concede** — E5 가 현재 pain 과 무관하다는 주장은 실증 근거와 정합. Steelman §E5 "주입 공간 경쟁 quantification" 은 **hypothetical 가치** 였지 **관측된 병목** 이 아니었다. `E5-trigger-gated` 수용.

**수용 조건 수정**:
- A 의 trigger-gated 조건 ("주입된 DA 중 세션 내 hit 안 된 비율 ≥ 50% 가 3 세션 연속") 을 적용.
- 관측 수단 = verifier signal (E4-enum-MVP) 또는 기존 hit rate 지표 재사용 — 신규 측정축 없음.
- 트리거 발동 시 `E5-micro` dry-run 실행 (τ 2값 × 1지표 × 1반복 = 1-2주).
- 미발동 시 영구 보류 (사문화 아님, 필요 없는 상태).

**부분 defend 한 가지**: E5 를 완전 폐기가 아니라 **trigger-gated 보류** 로 둔 이유 — decay 의 가치가 미래에도 영영 0 이라고 단정하기 어렵다. 주입 공간 경쟁은 DA 수가 305 → 500+ 로 늘어날 경우 자연 발생 가능. 트리거 조건을 명시해 두면 그 시점이 왔을 때 즉시 재활성화 가능.

**P-grid 조정**: P2 FAIL → **WARN** (trigger 미발동 시 ROI 논의 불요, 발동 시 micro dry-run 1-2주로 축소). P5 FAIL → **WARN** (1인 사용자 데이터 밀도 문제는 trigger 로 우회).

---

### WEAK-4 — E6 임계 20% 근거 → **(c) Compromise**

**Attack Evidence 인용** (A §WEAK-4): *""예: 20%" = 근거 0. 임계 낮음 → bundling 남발 / 임계 높음 → 영원히 activation 안 됨"* + *"E4 naked string 파편화가 E6 에 전염"*.

**판정**: **Compromise** — 임계 20% 근거 부재는 **concede**. E4 파편화 전염은 WEAK-2 에서 DA-ID-enum 수용으로 해소되지만, 임계 근거 문제는 별도 해결 필요. A 의 `E6-whitelist` 를 **entry point** 로 수용 + 관측 임계를 **upgrade path** 로 보존하는 compromise.

**새 방어 논리**:
- A 의 whitelist 안은 자동 활성화 철학을 포기한다고 했으나 이는 **"1인 사용자 + 초기 관측 부족"** 이라는 현 조건에서 합리적. 관측이 축적되면 임계 기반으로 승격 가능.
- E6-whitelist 자체가 **upgrade 의 bootstrapping** — whitelist 에 등재된 쌍의 verifier signal 을 관측하면 임계 산정 데이터가 자연 누적됨. 즉 whitelist 는 **dead end 가 아니라 data generator**.
- 완전 폐기 (plan.md L493 원래 판단) 가 아닌 이유: L493 은 "L9.6 E2E dogfood 에서 chain DA 누락 관찰될 때 착수" 라고 했는데, debate-context.md §5 §E6 은 이미 그 조건의 발전형. L493 원안 복귀 = 원점 회귀로 정당화 약함.

**수정된 E6 최종안 — E6-whitelist-first**:
```
Phase 1: applies-with 쌍 중 사용자 수동 선정 3-5 쌍 whitelist 활성
         (예: file-standards ↔ pc-tools / reliability-drift ↔ hook-guard-review)
Phase 2: whitelist 쌍의 verifier signal (E4-enum-MVP) 관측 데이터 축적 (1-2개월)
Phase 3: 관측 ≥ 20건 / 임계 dry-run 데이터 충분 → 임계 기반 자동 활성화 upgrade
안전장치 유지: 1-hop cap + visited set + token cap 8k + 쌍 단위 활성화
롤백: whitelist 비우기 (1줄)
```

**P-grid 조정**: P2 FAIL → **WARN** (임계 dry-run 제거, Phase 1 은 whitelist uplift 직접 측정). E4 의존 전염은 enum 수용으로 해소.

---

### WEAK-5 — P2 전 확장 empirical 공백 → **(b) Concede + accept alternative**

**Attack Evidence 인용** (A §WEAK-5): *""80% → X%" 의 X 가 6 확장 어디에도 수치 없음"* + *"롤백 기준의 비대칭 — L12.2 원칙 6 (10%p 감소) 만 있고 "기대 미달 롤백" 은 설계에 없음"* + *"ROI attribution 불가"*.

**판정**: **Concede + accept alternative** — A 의 `A/B-attribution + uplift-commit + Tier 회복 조항` 3중 프레임워크를 **전면 수용**. 이는 Steelman 을 **약화시키는 것이 아니라 강화**하는 제안 — "empirical 공백" 을 "empirical 축적 + 정량 commit" 으로 구조화.

**수용 근거**:
- A 제안한 확장별 최소 기대치는 L12.2 원칙 6 의 **명시적 확장판**. 원칙 6 ("10%p 감소 시 즉시 롤백") 은 악화 방어만 있었는데, uplift-commit 은 **기대 미달도 롤백 기준**에 포함 → 회색 지대 제거.
- A/B framework 의 "enable flag 독립 + 1주 순차" 는 Steelman §공통 §4 ("6 독립 토글") 주장의 **실행 가능 방법** 을 보탠다. Steelman 의 독립 토글이 "표면적" 이라는 Attack 지적은 타당 → A/B enable 로 실효성 확보.
- "Tier 팽창 회복 조항" (2개월 후 uplift < +3%p 시 Tier 2 원복) 은 본질적으로 **sunset clause** — 확장 리스크의 상한을 시간으로 cap.

**일부 수정 제안**:
- A 가 제시한 **확장별 최소 기대치**는 대체로 타당하나 일부는 상향/명료화 필요:
  - E1: *"1개월 누적 승격 DA ≥ 5"* — **유지** (보수적 적정).
  - E2 (hybrid): *"15-dogfood +2%p (활성화 후 2주)"* — **유지**, 단 manual seed phase (Day 1-30) 는 측정 대상 제외.
  - E3: *"T3 fallback 트리거 ≥ 10건/월 AND 승격 기여 ≥ 1건"* — **유지**.
  - E4 (enum-MVP): *"JSON 준수율 ≥ 80% AND 승격 기여 ≥ 1건/월"* — **"JSON 준수율 ≥ 95%"** 로 상향 (enum 제약으로 달성 가능성 높음).
  - E5: *"τ fit 지표 변동 유의 범위"* — **trigger 발동 시에만 적용** (미발동 시 무관).
  - E6 (whitelist-first): *"bundling 활성화 쌍의 hit rate ≥ 비활성화 대비 +5%p"* — **유지**, Phase 1 에 2개월 관측 후 판정.

**P-grid 조정**: 전 확장 P2 FAIL → **WARN** (empirical 공백은 A/B framework + uplift-commit 으로 미래 정량화 확보, attribution 해결).

---

## 2. 통합 수정안 — 최종 6 확장 상태 매트릭스

| 확장 | Steelman 원안 | Attack 공격 | Rebuttal 판정 | 최종 상태 |
|---|---|---|---|---|
| **E1** | 삼중화 | WARN (변동 없음) | — (방어 유지) | **즉시 편입** (원안) |
| **E3** | T2→T3 즉시 fallback | WARN (변동 없음) | — (방어 유지) | **즉시 편입** (원안) |
| **E4** | Verifier (coder/harness/auditor) | FAIL (파편화 + 복잡도) | **Concede** | **E4-enum-MVP** (auditor only + DA-ID-enum) |
| **E6** | 임계 20% 자동 활성화 | FAIL (근거 전무) | **Compromise** | **E6-whitelist-first** (Phase 1/2/3 upgrade) |
| **E2** | 7일 cold start | FAIL (21-28일 ROI 0) | **Compromise** | **E2-hybrid** (manual seed + 30건 auto) |
| **E5** | τ 3값 dry-run | FAIL (premature) | **Concede** | **E5-trigger-gated** (관측 조건 충족 시만) |

**공통 조건** (전면 수용):
1. **A/B enable 프레임워크**: 확장별 flag 독립 + 1주 간격 순차 enable.
2. **Uplift-commit**: 확장별 최소 기대치 사전 선언, 미달 시 해당 확장 단독 롤백.
3. **Tier 팽창 회복 조항**: 2개월 후 전체 uplift < +3%p 시 Tier 2 원복 검토.

**Tier 영향 재추정**:
- 즉시 편입 (E1+E3): Tier 2 **4.5 → 5.0** (+0.5 세션).
- 조건부 편입 Phase 1 (E4-enum-MVP + E6-whitelist-first): Tier 2 **+0.3**, Tier 3 **+0.2**. → Tier 2 **5.3**, Tier 3 **1.7**.
- Deferred (E2-hybrid 30일 후 + E5-trigger-gated 관측 후): 활성화 시점 **+0.2** 추가 가능, 미활성 시 0.
- **2개월 후 uplift 미달 시 Tier 2 원복 (5.3 → 4.5)** 조항으로 상방 리스크 cap.

---

## 3. 최종 P-grid (Rebuttal 반영)

| 확장 | P1 | P2 | P3 | P4 | P5 | 종합 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **E1** | PASS | WARN | PASS | PASS | PASS | 즉시 편입 |
| **E3** | PASS | WARN | PASS | PASS | PASS | 즉시 편입 |
| **E4-enum-MVP** | PASS | WARN | **PASS** ↑ | PASS | PASS | 편입 (MVP 형태) |
| **E6-whitelist-first** | PASS | WARN | PASS | PASS | PASS | 편입 (whitelist 형태) |
| **E2-hybrid** | PASS | WARN | PASS | PASS | WARN | 편입 (hybrid 형태) |
| **E5-trigger-gated** | PASS | WARN | PASS | PASS | WARN | **보류** (트리거 조건) |

**Attack 대비 변동**:
- E4 P3: FAIL → **PASS** (DA-ID-enum 수용).
- 전 확장 P2: FAIL → **WARN** (A/B framework + uplift-commit 수용).
- E2 P5 / E5 P2-P5 / E6 P2: FAIL → **WARN** (각 compromise/concede 로 우회).
- E1/E3 및 P1 전원: 변동 없음 (방어 유지).

---

## 4. 종합 — Judge 전달 합의안

**합의된 분류**:
1. **즉시 plan 편입 (2건)**: E1 (삼중화), E3 (T3 즉시 fallback).
2. **편입 가능 + 구조 수정 (2건)**: E4-enum-MVP, E6-whitelist-first.
3. **조건부 deferred (1건)**: E2-hybrid (manual seed 로 cold start 해소, 30건 임계 도달 시 auto).
4. **보류 trigger-gated (1건)**: E5-trigger-gated (주입 공간 경쟁 관측 시만 발동).

**편입 필수 조건 (공통)**:
- A/B enable flag 독립 + 1주 순차 enable.
- 확장별 uplift-commit 선언 (미달 시 개별 롤백).
- Tier 회복 조항 (2개월 후 +3%p 미달 시 Tier 2 원복 검토).

**L12.2 불변 원칙 준수**:
- 원칙 1 (증거 없는 확장 금지) 전 확장 통과 — LLM 을 생산자로 세운 경로 없음.
- 원칙 6 (10%p 감소 롤백) 에 **uplift-commit (기대 미달 롤백)** 추가 — 회색 지대 제거.

**debate 종결 후속**:
- Clean Room Judge 는 본 합의안을 기준으로 1/2/3 분류 확정 권장.
- Judge 가 추가 수정 제안 시 Supervisor 가 plan.md §L12.4 이후 신규 섹션 (§L12.7 확장 편입 계획) 으로 명문화.
