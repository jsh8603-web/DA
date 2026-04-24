# Debate Verdict — DA 시스템 T2 매칭 확장안 6건

> Clean Room Judge. Argument-Level Synthesis (분해 → 개별 판정 → 충돌 해소 → 유효 논점 조립).
> 에이전트 단위 점수 비교 금지. 논점 단위 판정.

---

## 1. Self-Verification Findings

> 상세: `C:\Users\jsh86\debate-judge-findings.md`

- **F1 — L12.2 6 원칙**: 6 확장안 모두 원칙 1 (증거 없는 확장 금지) 우회 경로 없음. LLM 을 관측자/판정자로 제한하는 구조는 유지됨.
- **F2 — Attack DAG 주장**: `E2 → L12.4` / `E6 → E4` 의존 관계는 debate-context §5 원문과 정확히 정합. Steelman 의 "3단계 분할 (생성 → 수렴 → 활용)" 과 Attack 의 "의존성 DAG" 는 동일 구조의 재해석이며, 실질적 충돌 없음.
- **F3 — 한국어 파편화 예시**: Attack 의 3 observation ("frontmatter date 필드" / "YAML 헤더 date 누락" / "파일 생성 날짜 규칙") 이 "조사 제거 + 경량 stemming" 정규화 후에도 **토큰 집합 교집합이 최대 1 개 ({date})** 에 그침 → N=3 문턱 도달 구조적 불가. Attack VALID.
- **F4 — E6 임계 20% 근거**: Steelman §E6 Line 194 "예: 20%" 는 placeholder 예시값, empirical 또는 이론적 derivation 없음. Attack VALID.
- **F5 — Empirical 리서치 정합성**:
  - Few-shot cap=3: 권고 3-5 범위 하단, VALID
  - JSON ≥95%: PARTIAL — schema-enforced API 모드 전제 시 달성 가능 (>99.5% 가능), 프롬프트만 시 상단 경계
  - Sunset 2개월 <+3%p: 업계 관행 1-3개월 <+2-5%p 정합, VALID
  - **1인 사용자 통계 유의성 불가** (CRITICAL): Rebuttal 의 uplift-commit 수치는 정량 threshold 가 아니라 **정성적 방향성 지표** 로 해석해야 함. 수치 기반 자동 롤백 판단은 noise 오판 위험.

---

## 2. Argument Decomposition

### Agent A Claims (steelman + rebuttal)

- **[A1] 6 확장은 단일 관측 파이프라인의 3단계 분할**
  - Premise: L12.4 증거 파이프 재사용 + LLM 을 관측자/판정자로 제한
  - Evidence: steelman §공통 전제 §1, §2 + P-grid 전 확장 P1 PASS 자체 판정

- **[A2] E1 삼중화는 Read 단일 증거원의 회수 속도 1.5-2배 가속**
  - Premise: T3/Verifier 추가 증거원이 사용자 행동 없이도 데이터 축적
  - Evidence: steelman §E1 "1-2주 5-10건 → 삼중화 10-20건 (추정)"

- **[A3] E2 cold start 는 manual seed + 자동 승격 hybrid 로 구조적 해결**
  - Premise: 1인 사용자 특성상 3-5 pair 수동 기입은 저비용, L12.4 누적 30건+ 임계 충족 시 자동 교체
  - Evidence: rebuttal §WEAK-1 Compromise — A §WEAK-1 대안 2건 hybrid 결합

- **[A4] E4-enum-MVP (DA-ID-enum + auditor only) 로 구조 수정 후 편입 적격**
  - Premise: 자연어 naked string 제거 → 한국어 파편화 구조적 불가 + profile gating 1개 로 복잡도 1/3
  - Evidence: rebuttal §WEAK-2 Concede — Attack 대안 전면 수용

- **[A5] E5 는 trigger-gated 보류, 현재 pain 과 무관하나 미래 필요 시 재활성화 경로 보존**
  - Premise: 주입 공간 경쟁은 관측되지 않은 병목 — premature
  - Evidence: rebuttal §WEAK-3 Concede — "trigger-gated 조건 충족 시만 E5-micro 발동"

- **[A6] E6-whitelist-first 로 임계 근거 공백 + E4 의존성 동시 해결, whitelist = data generator for upgrade**
  - Premise: 1인 사용자 + 초기 관측 부족 → 수동 3-5 쌍으로 bootstrap, 관측 축적 후 임계 기반 upgrade
  - Evidence: rebuttal §WEAK-4 Compromise — Phase 1/2/3 단계화

- **[A7] A/B enable + uplift-commit + Tier 회복 조항 3중 프레임워크 전면 수용**
  - Premise: "empirical 공백" 을 "empirical 축적 + 정량 commit" 으로 구조화 → 회색 지대 제거
  - Evidence: rebuttal §WEAK-5 Concede + accept

- **[A8] Tier 재매핑: 즉시 4.5→5.0, Phase 1 확장 5.3, 2개월 후 미달 시 Tier 2 원복**
  - Premise: Tier 팽창 상방 리스크를 시간으로 cap
  - Evidence: rebuttal §2 매트릭스 "sunset clause" 적용

### Agent B Claims (attack)

- **[B1] 6 확장은 의존성 DAG 로 엮인 6 단계 빌드 — 동시 편입 시 cold start 합산 대기, Tier 팽창 선지불 + 정당화 후지불**
  - Premise: E2/E4/E6 이 L12.4/E1/E4 에 의존 → 독립 토글 주장은 표면적
  - Evidence: attack §0 + §WEAK-5 "ROI attribution 불가"

- **[B2] E2 cold start 21-28일 ROI 0 — "정상 동작" 수사학**
  - Premise: L12.4 1-2주 누적 + E2 7일 window = 3-4주 구간 E2 uplift = 0
  - Evidence: attack §WEAK-1 L28-31

- **[B3] E4 naked string 정규화의 한국어 파편화로 N=3 누적 구조적 실패**
  - Premise: agglutinative 한국어 + "조사 제거 + 경량 stemming" 은 synonym 매핑 부재
  - Evidence: attack §WEAK-2 3 observation 구체 예시

- **[B4] E4 schema 대체안 — `missing_da_ids:string[]` DA-ID enum, 파편화 구조적 불가능**
  - Premise: LLM 을 기존 DA 목록에서 enum 선택 = 판정자 유지 + 파편화 제거
  - Evidence: attack §WEAK-2 Concrete Alternative

- **[B5] E5 premature — 주입 공간 경쟁은 관측되지 않은 병목 + 1인 데이터 밀도로 τ 판별 신뢰성 낮음**
  - Premise: binary→continuous 전환은 현재 pain 과 직접 관련 없음
  - Evidence: attack §WEAK-3 P5 FAIL

- **[B6] E6 임계 20% 근거 0 + E4 의존 전염 이중 실패**
  - Premise: 임계값 empirical/이론 근거 없음 + E4 naked string 파편화가 E6 트리거 불가능하게 만듦
  - Evidence: attack §WEAK-4 L103-107

- **[B7] E6-whitelist 대안 — 사용자 수동 3-5 쌍, 임계 의존성 + E4 의존성 동시 제거**
  - Premise: 1인 사용자 수동 관리 부담 거의 없음
  - Evidence: attack §WEAK-4 Concrete Alternative

- **[B8] 전 확장 P2 empirical 공백 + 기대 미달 롤백 부재 + attribution 불가 3중 결함**
  - Premise: "80% → X%" 의 X 수치가 어느 확장에도 없음, 롤백은 -10%p 악화 방어만
  - Evidence: attack §WEAK-5 L131-134

- **[B9] A/B enable + uplift-commit + Tier 회복 조항 대안 프레임워크**
  - Premise: 확장별 순차 enable → 단독 uplift 측정 가능, 기대 미달 = 회색 지대 제거
  - Evidence: attack §WEAK-5 Concrete Alternative

- **[B10] Tier 재매핑: 2-3 확장 편입 시 +0.5 세션 수준, 6 확장 동시 편입 ROI attribution 불가로 반려**
  - Premise: 6 확장 모두 P2 FAIL → 2-3 우선 편입 + 3 보류가 ROI/리소스 최적점
  - Evidence: attack §5 종합 결론

---

## 3. Per-Claim Evaluation

| ID | Claim | Premise valid? | Evidence sufficient? | Self-verified? | Verdict |
|----|-------|:---:|:---:|:---:|:---:|
| A1 | 6 확장 = 단일 파이프라인 3단계 | Y | Y | F1 (원칙 1 우회 없음 확인) | **VALID** |
| A2 | E1 삼중화 1.5-2배 가속 | Partial | N (추정치) | — (empirical 없음) | **UNVERIFIED** |
| A3 | E2-hybrid 로 cold start 구조적 해결 | Y | Y | F2 (L12.4 하류 의존 인정 후 manual seed 로 Phase 1 흡수) | **VALID** |
| A4 | E4-enum-MVP 구조 수정 후 편입 적격 | Y | Y | F3 (파편화 입증) + F5.2 (JSON 95% PARTIAL) | **VALID** (조건부) |
| A5 | E5-trigger-gated 경로 보존 | Y | Y | — (현재 pain 과 무관 자체 인정) | **VALID** |
| A6 | E6-whitelist-first + upgrade path | Y | Y | F4 (임계 20% 근거 공백) | **VALID** |
| A7 | A/B + uplift-commit + 회복 조항 수용 | Y | Partial | F5.4 (**1인 통계 유의성 한계 미반영**) | **PARTIAL** |
| A8 | Tier 재매핑 4.5→5.0→5.3→2개월 후 재검토 | Y | Y | F5.3 (업계 sunset 관행 정합) | **VALID** |
| B1 | 의존성 DAG + 선지불/후지불 비대칭 | Y | Y | F2 (DAG 정합) | **VALID** (단 Rebuttal 순차 enable 수용으로 결론 완화) |
| B2 | E2 21-28일 ROI 0 | Y | Y | F2 (E2→L12.4 하류) | **VALID** |
| B3 | E4 한국어 파편화로 N=3 실패 | Y | Y | F3 (3 예시 토큰 집합 교차 1 token) | **VALID** |
| B4 | E4-DA-ID-enum 대체안 | Y | Y | F3 (구조적 해결 확인) | **VALID** |
| B5 | E5 premature + 1인 τ 판별 신뢰성 낮음 | Y | Y | — (Steelman P5 WARN 자체 인정) | **VALID** |
| B6 | E6 20% 근거 0 + E4 의존 전염 | Y | Y | F4 (근거 공백) + F3 (E4 파편화) | **VALID** |
| B7 | E6-whitelist 대안 | Y | Y | F4 해결 경로 | **VALID** |
| B8 | P2 공백 + 기대 미달 롤백 부재 + attribution 불가 | Y | Y | F5.4 (1인 유의성 불가 → 수치 threshold 한계) | **VALID** |
| B9 | A/B + uplift-commit 대안 프레임 | Y | Y | F5.3 정합 | **VALID** |
| B10 | Tier 재매핑 +0.5 우선 | Y | Partial | — (구조 수정 후 A 의 5.3 으로 수렴 가능) | **PARTIAL** |

---

## 4. Conflict Resolution

### [A1] vs [B1]: 6 확장 구조 해석 — 3단계 분할 vs 의존성 DAG

- A 입장: "생성 → 수렴 → 활용" 3 단계 파이프라인 분할, 독립 토글 6개 운영
- B 입장: 6 단계 빌드 의존성 DAG, 하류만 끄는 것 무의미 → 독립 토글은 표면적
- My verification (F2): 두 주장이 기술적으로 **동일 구조의 다른 재해석**. E2→L12.4 / E6→E4 / E4→E1 의존은 양측 모두 전제. 차이점은 "순차 enable + uplift attribution 측정" 이 가능한가 — 가능함 (A/B framework 적용 시).
- **Resolution**: 두 주장 모두 VALID. **A/B enable 프레임워크 수용 시 (Rebuttal §WEAK-5, Attack §WEAK-5 대안) DAG 의 선지불/후지불 비대칭은 "1주 간격 순차 enable" 로 완화됨.** 즉 구조 해석 자체는 B 정확, 해결 경로는 A/B 공통 제안.

### [A2] vs [B2]: E2 초기 구간 해석 — "정상 동작" vs "ROI 0"

- A 입장: cap 미달 시 few-shot 주입 없이 정상 동작 (uplift 0 은 허용)
- B 입장: 21-28일 cold start 구간 Tier 팽창 선지불 + 이득 후지불
- My verification (F2): B 의 숫자 정확. 단 Rebuttal 이 이미 Compromise 로 수렴 → manual seed (Day 0-30) + 자동 (Day 30+) hybrid 수용.
- **Resolution**: **A3 (E2-hybrid) 이 B2 를 흡수해 해결.** manual seed phase 동안 cold start 구간 측정 대상 제외 + Tier 팽창도 Phase 별 단계 분할. Attack 의 치명성 공격은 Rebuttal concede 로 해소.

### [A4] vs [B3]+[B4]: E4 원안 vs enum 대체안

- A 원안: `missing_context:str` + "조사 제거 + 경량 stemming"
- B 대안: `missing_da_ids:string[]` enum + "DA ID 별 카운팅"
- My verification (F3): B 의 한국어 파편화 예시 실증. N=3 도달 불가 입증.
- **Resolution**: **Rebuttal §WEAK-2 가 이미 Concede + accept alternative** → E4-enum-MVP 채택. 판정자 vs 생산자 구조 논리는 enum 에서도 유지. 단 F5.2 (JSON 준수율 95% PARTIAL) 에 따라 **Anthropic SDK 의 tool-use / schema-enforced mode 명시 전제** 로 편입해야 함.

### [A5] vs [B5]: E5 보류 경로

- A 입장: trigger-gated 조건 (hit 안 된 비율 ≥ 50% 3 세션 연속) 충족 시만 E5-micro dry-run
- B 입장: premature, 관측되지 않은 병목, 1인 τ 판별 신뢰성 부족
- My verification: B 실증 강, A 는 이를 concede 후 trigger 조건으로 우회.
- **Resolution**: 충돌 해소됨. **E5-trigger-gated 로 편입 (보류 상태, 트리거 발동 시 활성화 경로 보존)**. 미발동 시 무관 → Tier 0 기여.

### [A6] vs [B6]+[B7]: E6 활성화 경로

- A 입장: whitelist-first (Phase 1) → verifier 관측 (Phase 2) → 임계 upgrade (Phase 3)
- B 입장: whitelist 대안 (임계 + E4 의존 동시 제거) 또는 폐기
- My verification (F4): 20% 근거 공백 실증, whitelist 대안은 양측 일치.
- **Resolution**: Rebuttal A6 (whitelist-first + upgrade path) 로 수렴. B7 과 실질 동일, A6 이 추가로 Phase 3 upgrade 경로 보존 (미래 임계 기반 자동화 가능성).

### [A7] vs [B8]+[B9]: uplift-commit 프레임워크

- A 입장: 전면 수용 + 일부 수치 조정 (E4 JSON 80%→95%)
- B 입장: 동일 프레임워크 원안 제안
- My verification (F5.4): 1인 사용자 통계 유의성 불가 → 수치 commit 은 정량 threshold 가 아니라 **정성적 방향성 지표**.
- **Resolution**: **프레임워크 자체는 A/B 공통 VALID**. 단 Rebuttal 이 이 insight 를 명시적으로 구분하지 않음 — **Judge 보강 필요**: uplift-commit 수치는 (a) 자동 롤백 thresholds **아님**, (b) 추세 분석 + 정성 평가 병행, (c) 최소 50-100 query 수집 후 평가.

### [A8] vs [B10]: Tier 재매핑 스케일

- A 입장: 즉시 5.0, Phase 1 5.3, 2개월 후 미달 시 원복
- B 입장: 2-3 확장 편입 시 +0.5 세션, 6 확장 동시 편입 반려
- My verification (F2): 두 제안의 수치적 종착점은 Rebuttal 4 분류 적용 시 사실상 정합 — 즉시 편입 (E1+E3) +0.5 = 5.0, 구조 수정 편입 (E4-MVP+E6-whitelist) +0.3 = 5.3 동일.
- **Resolution**: **Tier 5.3 을 목표 상한으로 채택, 단 2개월 후 uplift <+3%p 시 sunset clause 로 Tier 2 원복 검토.** B 의 보수적 초기값 (5.0) 은 A Phase 1 이전 단계와 동일.

---

## 5. Synthesis — Valid Claims Assembly

### Accepted Facts (VALID + PARTIAL)

- [A1]: 6 확장은 L12.4 증거 파이프를 공유하는 관측 파이프라인이며, LLM 을 생산자로 세운 경로가 없어 L12.2 원칙 1 을 구조적으로 우회하지 않는다.
- [A3]: E2-hybrid (manual seed Day 0-30 + 자동 Day 30+ 임계) 로 cold start 는 구조적 해결.
- [A4] + [B4]: E4-enum-MVP (DA-ID-enum + profile=auditor only) 로 한국어 파편화 제거 + 복잡도 1/3 축소.
- [A5] + [B5]: E5-trigger-gated (주입된 DA 중 hit 안 된 비율 ≥ 50% 3 세션 연속 관측 시 micro dry-run) 로 보류 + 미래 재활성화 경로 보존.
- [A6] + [B7]: E6-whitelist-first (Phase 1 수동 3-5 쌍 → Phase 2 관측 → Phase 3 임계 upgrade) 로 임계 근거 공백 해결.
- [A7] + [B8] + [B9]: A/B enable 프레임워크 + 확장별 uplift-commit + Tier 회복 조항 수용 (단 1인 통계 한계 반영 필요 — 아래 Assembled Conclusion §C 참조).
- [A8] + [B10]: Tier 2 = 4.5 → 5.0 (즉시 편입) → 5.3 (Phase 1 완료 후). 2개월 후 uplift < +3%p 시 Tier 2 원복 검토.
- [B1]: DAG 의존성 구조는 팩트 (E2→L12.4, E6→E4). 순차 enable 로 완화.
- [B2]: E2 cold start 21-28일 실증 정확 — 해결책은 A3 에서 흡수됨.
- [B3]: 한국어 파편화 N=3 실패 실증 — 해결책은 A4/B4 enum 에서 흡수.
- [B6]: E6 임계 20% 근거 공백 실증 — 해결책은 A6/B7 whitelist 에서 흡수.
- [A2] (UNVERIFIED): E1 1.5-2배 가속은 추정치, 1-2주 실측으로만 확인 가능 → Unresolved 섹션.

### Conflicts Resolved

- [A1 vs B1] → **순차 enable 수용으로 DAG 의 선지불 비대칭 완화**. 구조 해석은 B 정확.
- [A2 vs B2] → **E2-hybrid (A3) 로 흡수**. Manual seed 가 cold start 0 구간 해소.
- [A4 vs B3+B4] → **E4-enum-MVP 채택 + Anthropic SDK tool-use/schema-enforced mode 명시 전제**.
- [A5 vs B5] → **trigger-gated 보류 합의**.
- [A6 vs B6+B7] → **whitelist-first + upgrade path 합의**.
- [A7 vs B8+B9] → **프레임워크 채택 + 1인 통계 한계 명시 보강**.
- [A8 vs B10] → **Tier 5.3 상한 + sunset clause 채택**.

### Assembled Conclusion

> 이 결론은 어느 한 Agent 의 원안이 아니라, 양측의 VALID/PARTIAL 논점을 조립한 결과다.

#### §A. 6 확장안 4 분류 최종 합의

| 분류 | 확장 | 형태 | Trace |
|---|---|---|---|
| **즉시 편입 (2건)** | **E1 삼중화** | 원안 (Read + T3 + Verifier, N 차등) | A1+A2(UNVERIFIED)+A7 |
| | **E3 T3 즉시 fallback** | 원안 (threshold 0.3, `.t2-miss.jsonl` 재사용) | 양측 공통 즉시 편입 |
| **구조 수정 편입 (2건)** | **E4-enum-MVP** | `{is_sufficient:bool, missing_da_ids:string[]}` + profile=auditor only | A4+B3+B4 |
| | **E6-whitelist-first** | Phase 1 사용자 수동 3-5 쌍 / Phase 2 관측 축적 / Phase 3 임계 upgrade | A6+B6+B7 |
| **Deferred (1건)** | **E2-hybrid** | Phase 1 manual seed 3 pair / Phase 2 자동 L12.4 누적 30건 AND 고유 DA ≥10 임계 | A3+B2 |
| **Trigger-gated 보류 (1건)** | **E5-trigger-gated** | "주입된 DA 중 hit 안 된 비율 ≥ 50% 가 3 세션 연속" 관측 시 E5-micro (τ 2값 × 1지표 × 1반복) 발동 | A5+B5 |

**Supervisor 질문 1 응답**: Rebuttal 의 4 분류 합의안은 **타당하다.** 단 아래 3 가지 보강 필요:
1. E4-enum-MVP 는 **Anthropic SDK 의 tool-use 또는 JSON schema-enforced mode 명시 전제** — 프롬프트 기반 JSON 준수율 95% 목표는 상단 경계로 달성 불확실 (F5.2 PARTIAL).
2. E6-whitelist-first Phase 1 의 **초기 3-5 쌍 선정 기준** 명시 필요 — "사용자 수동" 은 seed selection heuristic 이 필요 (예: applies-with 링크 수 상위 + 감사 wf 에서 유의미 관찰된 쌍 등).
3. E5 trigger 조건의 **"3 세션 연속"** 정의 — 세션 경계 규칙 (compact 직후 세션 리셋 여부, WF 세션 제외 여부) 명시 필요.

#### §B. Tier 재매핑 수치

**Supervisor 질문 2 응답**: Tier 2 4.5 → 5.0 (즉시) + Phase 1 5.3 은 **합리적.** 근거:
- E1+E3 즉시 편입은 L12.4 기 확정 증거 파이프의 자연 확장 — Tier 2 +0.5 는 +11% 증가로 선 편입 리스크 수용 가능.
- E4-enum-MVP (auditor only) + E6-whitelist-first Phase 1 은 실제 Tier 2 contribution 이 낮음 (auditor profile + whitelist 수동 = 호출 빈도 제한). **+0.3 세션 추정은 상향 편향** — 실측에서 +0.2 이하 가능성 높음.
- 2개월 후 sunset clause (5.3 → 4.5 원복) 는 업계 관행 1-3개월 정합. **단 F5.4 (1인 통계 유의성 불가) 로 인해 uplift <+3%p 기계적 판정은 부적절** — Judge 권고: **정량 (15-dogfood hit rate) + 정성 (사용자 피드백 log, 승격 DA 의 실사용 hit 추적) 양축 병행 평가**.

#### §C. 숨은 리스크 (Rebuttal 미반영)

**Supervisor 질문 3 응답**:

1. **F5.4 (최우선 리스크) — 1인 사용자 통계 유의성 불가**: Rebuttal 의 uplift-commit 수치 (E1=5/월, E2=+2%p, E6=+5%p 등) 는 15-dogfood 기준 **1-3 query 차이 범주** — noise 와 구별 불가. 기계적 threshold 롤백 판단 시 **false rollback** 위험. 해결: (a) 수치는 **정성적 방향성 지표** 로 재정의, (b) 롤백 판정은 **수치 미달 + 정성 피드백 (사용자 불만 / 승격 DA 의 감사 wf 발견) 2 조건 AND** 로 강화, (c) 최소 query 수 ≥ 50-100 도달 후 평가 개시.

2. **E4-enum-MVP JSON 준수율 95% 달성 수단 미명시**: 프롬프트 기반 80-95% 상단 경계 목표. Anthropic SDK 의 tool-use 또는 schema-enforced JSON mode 사용 시 >99.5% 가능. **구현 단계에서 이 모드 명시 필요** — 현재 plan 에 "JSON schema 강제" 만 있고 구현 메커니즘 미상.

3. **E1 삼중화 증거원별 N 차등의 dry-run 근거 부재**: Read within-session=3 / Read across-session=2 / Verifier=3 / Vector=5 수치의 empirical 근거 없음 — 이것은 L12.4 의 N=3 단일값 논리와 대비되는 **신규 임계값 4 개** 도입. 초기 배포 후 1-2주 실측으로 재조정 경로 필요 (현재 dry-run 축에 미포함).

4. **E3 fallback threshold 0.3 dry-run 축 부재**: Steelman §E3 에 "threshold 0.3 은 dry-run 으로 조정 가능" 언급만 있고, dry-run 계획 미포함 — 초기 배포 시 0.3 고정은 empirical 공백.

5. **A/B enable 순차 시 순서 결정 기준 미명시**: 1주 간격 enable 시 E1 먼저 / E3 먼저 / 병렬 어느 것이 attribution 가능성 최대인지 설계 없음. 권고: **E3 (단발 fallback) → E1 (삼중화, E3 신호 수집 완료 후) → E4-enum-MVP → E6-whitelist-first** 순서 (상류 → 하류 순).

6. **L12.4 기존 6 원칙의 "원칙 1" 은 debate-context 에서 "증거 없는 확장 금지" 로 재진술** — 실제 plan-da-lifecycle.md §안전장치는 DF/N/길이/Levenshtein/manual/rollback 6개. **두 리스트의 구체 필드 정합성 감사 후 통일 문서화 필요** (Unresolved 로 이관).

#### §D. Uplift-commit 수치 적정성

**Supervisor 질문 4 응답**:

| 확장 | Rebuttal 수치 | 공개 벤치마크 | 판정 |
|---|---|---|:---:|
| E1 | 1개월 누적 승격 ≥ 5건 | 성숙 RAG +1-5%p 유의 | **VALID** (보수적) |
| E2-hybrid | 활성화 후 2주 +2%p (seed phase 제외) | few-shot 3-5개 적정 도메인 효과 | **VALID** (권고 범위) |
| E3 | T3 fallback ≥ 10건/월 + 승격 기여 ≥ 1건 | T3 호출 빈도 empirical 없음 | **UNVERIFIED** (1인 환경 baseline 없음) |
| E4-enum-MVP | JSON 준수율 ≥ 95% + 승격 기여 ≥ 1건/월 | schema-enforced >99.5%, prompt 80-95% | **PARTIAL** (API mode 전제 필요) |
| E5 | τ fit 변동 유의 범위 | dry-run 축 명확 | **VALID** (trigger 발동 시) |
| E6-whitelist | 활성화 쌍 hit rate 비활성 대비 +5%p | RAG keyword expansion +5-20%p | **VALID** (초기 시스템 범위) |

**공통 재해석** (F5.4): 위 수치는 **자동 롤백 threshold 아님**, 50-100 query 수집 후 **추세 분석 + 정성 평가** 와 병행할 때만 유의미.

#### §E. 데이터로만 해결 가능한 항목 (dry-run 이관)

**Supervisor 질문 5 응답**: 토론 수렴 후 데이터 축적으로만 판정 가능한 항목:

1. **E1 증거원별 N 차등 최적화**: Read within/across, Verifier, Vector 의 N 값 empirical 조정 (1-2주 실측 후)
2. **E1 삼중화 1.5-2배 가속 추정치 검증** (A2 UNVERIFIED)
3. **E3 threshold 0.3 최적화**: T2 miss 분포 관측 후 조정 (1-2주)
4. **E3 fallback 호출 빈도 baseline**: 1인 사용자 기준 월간 기대치 미정
5. **E4-enum-MVP JSON 준수율 실측**: Haiku + schema-enforced mode 실제 성능 (1주 실측)
6. **E4 auditor 이외 profile 확장 (coder/harness-worker) 판정**: auditor 에서 JSON 준수율 ≥ 80% 검증 후 단계 확장 (Rebuttal L68)
7. **E5 τ 값 (trigger 발동 시)**: τ 2 값 (30/60일) × hit rate × 1반복 = 1-2주 micro dry-run
8. **E6-whitelist Phase 3 임계값**: whitelist 쌍 1-2개월 관측 축적 후 임계 산정
9. **Tier 팽창 sunset clause 판정 (2개월 후)**: uplift <+3%p 기계적 판정 대신 정량+정성 병행

### Traceability Map

| Conclusion element | Source claim(s) |
|---|---|
| §A 4 분류 최종 합의 | A3+B2 (E2) / A4+B3+B4 (E4) / A5+B5 (E5) / A6+B6+B7 (E6) |
| §A E1+E3 즉시 편입 | 양측 공통 (A1+ Attack §5 권장) |
| §A E4-enum-MVP + schema-enforced 전제 | A4+B4 + F5.2 (PARTIAL) |
| §A E5 trigger 조건 상세 | A5+B5 + F5.4 정성 평가 보강 |
| §B Tier 5.3 + sunset | A8+B10+F5.3 (업계 관행) |
| §C 1인 통계 유의성 리스크 | F5.4 단독 (양측 미반영) |
| §C JSON 95% 구현 메커니즘 | A4 + F5.2 (Anthropic SDK mode 전제) |
| §C A/B 순서 결정 | B1 (DAG) + §Conflict [A1 vs B1] resolution |
| §D uplift 수치 적정성 | A7+B8+B9 + F5 전체 대조 |
| §E dry-run 이관 | A2 (UNVERIFIED) + §C 리스크 분해 |

### Coverage Check

debate-keypoints.md §핵심 충돌점 K1~K6 전수 확인:

- **K1 (E2 cold start)**: §Conflict [A2 vs B2] + §A Deferred(1건) 분류에서 E2-hybrid 로 해소. deferred 조건 (30건 AND 고유 DA ≥10) 채택.
- **K2 (E4 naked string)**: §Conflict [A4 vs B3+B4] + §A 구조 수정 편입(2건) 에서 E4-enum-MVP 채택 (schema 변경 수용).
- **K3 (E5 ROI)**: §Conflict [A5 vs B5] + §A Trigger-gated 보류(1건) 에서 trigger-gated 축소 채택.
- **K4 (E6 임계 근거)**: §Conflict [A6 vs B6+B7] + §A 구조 수정 편입(2건) 에서 E6-whitelist-first 채택 (whitelist + upgrade path).
- **K5 (독립 토글)**: §Conflict [A1 vs B1] 에서 A/B 순차 enable 로 uplift-commit attribution 가능성 확보.
- **K6 (Tier 팽창)**: §Conflict [A8 vs B10] + §B Tier 재매핑 에서 Tier 5.3 상한 + sunset clause 채택 (회복 조항 추가).

**Unresolved 잔존**: 위 K1~K6 중 empirical 공백 관련 sub-item (A2 UNVERIFIED, E3 fallback baseline, Tier sunset 판정 기준) 은 §E 로 이관.

### Self-Review

> 최종화 전 자문:

1. **특정 Agent 주장에 치우친 판정이 있는가?** — §Conflict 섹션에서 Attack 의 3 개 핵심 공격 (DAG / 파편화 / 20% 근거) 모두 VALID 판정 → 표면상 Attack 우위처럼 보일 수 있음. 그러나 **Rebuttal 이 이미 Concede/Compromise 로 이 공격을 흡수**했으므로, 최종 Assembled Conclusion 은 Rebuttal 의 4 분류 합의안에 수렴. 이는 "Attack 이 이겼다" 가 아니라 "Rebuttal 의 구조 수정이 Attack 의 실증적 공격을 흡수하고 양측 VALID 논점이 조립된 결과" — 에이전트 단위 승패 판정 회피 원칙 준수.

2. **사실 검증 없이 한쪽 주장을 수용한 곳이 있는가?** — [A2] E1 1.5-2배 가속만 UNVERIFIED 처리, Unresolved 로 이관. 나머지는 모두 F1-F5 또는 debate-context.md 원문 대조를 거쳤다.

3. **Traceability Map 에서 근거 없는 결론이 있는가?** — §C 의 "1인 통계 유의성 리스크" 는 양측 모두 명시 안 한 리스크를 F5.4 (Gemini 연구) 에서 도입했다. 이는 **Judge 의 독립 검증 역할이 명시적으로 요구된 항목** (judge-brief §3.5) 이므로 외부 insight 도입 정당.

4. **에이전트 단위 점수 산출 회피?** — 본 Verdict 전체에서 "Agent A 총점" / "Agent B 총점" 없음. 논점 단위 VALID/PARTIAL/UNVERIFIED/INVALID 만 기재.

문제 없음. 최종화 진행.

### Unresolved (needs data, not debate)

- **[A2-UNVERIFIED]** E1 삼중화 회수 속도 1.5-2배 가속 — 1-2주 실측 필요
- **[Tier sunset 판정]** 2개월 후 uplift <+3%p 정량 + 정성 병행 평가 기준 수립 — 현재 수치 단독으로는 1인 환경 noise 로 false judgment 위험
- **[E3 baseline]** T3 fallback 호출 빈도 1인 사용자 기준 월간 기대치 — baseline 없음
- **[E4 JSON 준수율]** enum + schema-enforced mode 실측 — Haiku 실제 성능 미측정
- **[E1 N 차등 empirical]** Read within/across/Verifier/Vector 의 N 값 (3/2/3/5) 근거 축적

### Action Items

- [ ] **[A4] E4-enum-MVP 구현 spec** 에 Anthropic SDK tool-use 또는 JSON schema-enforced mode 명시 (F5.2 PARTIAL 해소)
- [ ] **[A7 + F5.4] Uplift-commit 재정의 문서** 작성: "정량 threshold 아님 + 최소 50-100 query 후 평가 + 정성 (사용자 피드백) 병행"
- [ ] **[A6] E6-whitelist-first Phase 1 초기 3-5 쌍 선정 기준** 명시 (applies-with 링크 수 상위 + 감사 wf 유의미 관찰 쌍)
- [ ] **[A5] E5-trigger 조건 "3 세션 연속" 세션 경계 규칙** 명시 (compact 후 리셋, WF 세션 제외 등)
- [ ] **[B1 resolution] A/B enable 순서** = E3 → E1 → E4-enum-MVP → E6-whitelist-first 로 plan 에 고정 (상류 → 하류)
- [ ] **[§C.6] L12.2 불변 원칙 2 리스트 정합성 감사** — debate-context.md §3 의 6 원칙 vs plan-da-lifecycle.md §안전장치의 6 원칙 필드 매핑 통일 문서화
- [ ] **[§E 전체 9 항목] dry-run 이관 목록** 을 plan.md §L12.7 (확장 편입 계획) 신규 섹션에 명문화
- [ ] **[A8 + §B] Tier sunset 2개월 후 판정 프로토콜** 작성: 수치 미달 + 정성 신호 AND 조건 명시

---

## 종합 — Clean Room Judge 권고

1. **6 확장안 4 분류 최종 합의안** (§A) 은 Rebuttal 원안 대비 3가지 보강 (E4 SDK mode / E6 seed 기준 / E5 세션 경계 정의) 후 즉시 plan 반영 가능.
2. **Tier 5.3 상한 + 2개월 sunset** (§B) 채택, 단 sunset 판정은 정량 + 정성 병행.
3. **최대 리스크** = F5.4 **1인 사용자 통계 유의성 불가** → uplift-commit 수치는 정성적 방향성 지표로 재정의.
4. **데이터 의존 미해결 9 항목** (§E) 은 토론 대상 아님, dry-run 이관.
5. **A/B enable 순서** 는 상류 → 하류 (E3 → E1 → E4-enum-MVP → E6-whitelist-first) 로 attribution 가능성 극대화.

> 본 Verdict 는 어느 한 Agent 의 승리 판정이 아니다. Attack 의 실증적 공격 (DAG / 파편화 / 20% 근거) 이 VALID 였고, Rebuttal 이 이를 구조 수정으로 흡수했으며, 양측 VALID/PARTIAL 논점을 조립한 결과가 위 합의안이다. 에이전트별 점수 산출 금지 원칙 준수.
