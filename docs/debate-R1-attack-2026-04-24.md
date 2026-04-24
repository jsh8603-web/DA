# Round 1 — Attack: Steelman 반박

> 대상: `debate-R1-steelman.md` (이하 S)
> 전제: 기 확정 L12.4 는 debate 범위 밖. Attack 은 E1~E6 확장안에 한정.
> 형식: Evaluation Grid P1-P5 로 **PASS/WARN/FAIL** 판정 + Evidence 인용 + WEAK 5건별 대안 ≥1.

---

## 0. Opening — Steelman 재프레이밍에 대한 1차 반박

S 는 `§공통 전제 §1` 에서 **"6 확장이 하나의 관측 파이프라인의 생성 (E3/E4) · 수렴 (E1) · 활용 (E2/E5/E6) 3단계 분할"** 이라고 통합했다. 이 통합은 **공격 회피용 framing** 이다.

실제로:
- **생성 (E3/E4)** 은 **E1 없이는 사용 불가** — E1 이 증거원 수집을 떠맡지 않으면 E3/E4 의 이벤트는 그냥 로그에 쌓인 채 버려짐.
- **활용 (E2/E5/E6)** 는 **E1/E4 의 하류** — E2 는 L12.4 누적 7일 + cap 5, E5 는 독립적이나 현재 pain 과 무관, E6 은 E4 관측 의존.
- 즉 **6 확장 = 의존성 DAG 로 엮인 6 단계 빌드**, 동시 편입 시 모든 단계가 cold start 를 합산 대기해야 함.

**치명적 약점**: S 가 P2 전원 WARN 을 self-admission 한 것은 "empirical 근거 없음" 자백이고, P2 WARN 이 모두 해소되려면 6 확장 모두 1-2주씩 실측 필요 — 그런데 E2/E4/E5/E6 은 E1 의 누적 데이터에 의존하므로 **순차 대기** → 6 확장 편입 정당화 종료 시점이 이르면 **3개월 단위**. Tier 팽창 +22-33% 는 **선지불**, 정당화는 **후지불**.

---

## 1. WEAK 5건 집중 공격

### WEAK-1. E2 P5 cold start — "정상 동작" 이라는 수사학

**Evidence 인용** (S §E2 Line 79): *"7일 데이터가 없는 초기 기간엔 cap 미달 → few-shot 주입 없이 정상 동작"*

**Attack**:
- "정상 동작" 은 저자 framing. 실질은 **E2 uplift = 0 인 구간이 최소 3주**. L12.4 자체가 1-2주 누적 필요 (debate-context.md §6), 그 출력을 E2 가 소비 → **L12.4 (1-2주) + E2 활성화 대기 (7일) = 21-28일** cold start.
- 21-28일 동안 Tier 2 세션 수는 이미 4.5 → 5.5-6 (+22-33%) 로 상향된 상태. **리소스 선지불, 이득 후지불**.
- 7일 window + "다양성 우선 cap 5" 는 서로 충돌: 초기 promote 가 동일 domain (예: file-standards 계열) 에 몰리면 다양성 기준 충족 못함 → cap 3-4 로 축소 → few-shot 품질 저하.
- S §E2 Line 74-75 "Amplifier 구조" 논거는 L12.4 가 의미 있는 산출을 낼 때만 성립. 산출이 0 이면 amplifier 는 amplify 할 대상이 없음.

**P-grid 재판정**: P5 **FAIL** (cold start 기간 ROI 0 가 설계 내재). P2 **FAIL** (후지불 정당화 증거 전무).

**Concrete Alternative — E2-deferred**:
```
활성화 조건: L12.4 전역 누적 promote ≥ 30건 AND 고유 DA ≥ 10개
cap:        5 → 3 (프롬프트 토큰 추가 절감)
cold start: 1-2주 데이터 축적 + 임계 충족 → 자동 활성화
롤백:       .t2-fewshot.json 삭제 (1줄)
```
**또는 E2-manual-seed**: 1인 사용자 특성 활용 — `.t2-fewshot-seed.json` 에 사용자가 3-5 pair 수동 기입 → 자동 파이프 대신 수동 seed 로 cold start 해결 → 7일 대기 불요, 품질 사용자 직접 통제.

---

### WEAK-2. E4 P3 복잡도 — naked string 정규화의 한국어 파편화

**Evidence 인용** (S §E4 Line 131): *"정규화: 조사 제거 + 경량 stemming (기존 T2 tokenize 재사용)"*

**Attack**:
- Verifier missing_context 는 **자연어 문장**. 한국어 agglutinative 특성상 같은 의미의 표현이 수십 가지로 파편화:
  - Obs 1: "frontmatter date 필드 필요"
  - Obs 2: "YAML 헤더 date 누락 시 처리"
  - Obs 3: "파일 생성 날짜 규칙"
- 위 3 observation 은 모두 동일 개념을 가리키지만, 조사 제거 + stemming 수준으로는 **세 개의 서로 다른 naked string** 으로 저장됨. N=3 문턱 도달 전에 파편화.
- 결과: **signal-to-noise ratio 낮아서 실질 작동 안 함**. 승격 건수 0 → E4 는 계산 자원만 태우고 miss log 만 늘리는 dead weight.
- 또한 S §E4 Line 129 "JSON schema 강제" 는 Haiku 가 준수 보장 없음. Haiku 의 schema violation 률 실측 없음 — 위반 시 파싱 실패 → 해당 observation 전량 drop → 파편화를 넘어 **관측 자체 유실**.
- L12.2 논리와 대칭: L12.2 는 "LLM 이 generic term 으로 수렴" 이었고, E4 는 "LLM 이 다양한 term 으로 발산" — 양 극단 모두 N 누적 실패.

**P-grid 재판정**: P3 **FAIL** (자연어 정규화는 "조사 제거 + 경량 stemming" 수준으로 커버 불가). P2 **FAIL** (FP rate + schema 준수율 실측 없음).

**Concrete Alternative — E4-DA-ID-enum**:
```
Verifier JSON schema 변경:
  before: {is_sufficient:bool, missing_context:str}
  after:  {is_sufficient:bool, missing_da_ids:string[]}  # 기존 DA ID 목록에서 선택
동작: verifier 가 DA ID 를 enum 으로 선택 (자연어 생성 X)
누적: DA ID 별 카운팅만 → 파편화 구조적 불가능
손실: 신규 DA 발견 경로 상실 → 그러나 E1 Read 증거원이 이미 이 역할 담당 (보완 불필요)
```
**또는 E4-MVP**: profile gating 3개 → **1개 (`auditor` only)**. 관측 데이터 축적으로 정규화 정책 정비 후 확장. 복잡도 1/3 축소, FP rate 측정 가능한 공간 확보.

---

### WEAK-3. E5 dry-run 세션 소모 — priority 자체가 낮음

**Evidence 인용** (S §E5 Line 163): *"τ 초기값 dry-run: 14 / 30 / 60일 비교"* + score.md 지시 3: *"τ 3값 × 4지표 × 1-2주 × 3회 = 3-6주"*

**Attack**:
- Tier 3 전체 예상 세션 = 1.5. E5 dry-run 만 3-6주 세션 소요 → **Tier 3 단일 Phase 의 리소스 집중**.
- 더 근본적 문제: E5 는 "binary → continuous" 전환. ROI 는 *"이미 binary 로 작동하는 시스템을 smooth 하게"*. **현재 pain (T2 80% plateau, keyword 공백) 과 직접 관련 없음**.
- S §E5 Line 172 "주입 공간 경쟁의 quantification" 은 **관측되지 않은 병목**. 주입된 DA 중 hit 되지 않은 비율이 구체 측정된 적 없음. **premature optimization**.
- 1-2주 실측 × 3회 = τ 판정용 데이터는 1인 사용자 불규칙 근무 패턴상 **signal 잡히기 어려운 구간** (S §E5 P5 self-admission).

**P-grid 재판정**: P2 **FAIL**. P5 **FAIL** (1인 사용자 데이터 밀도 × τ 3값 판별 불가 가능성 높음).

**Concrete Alternative — E5-trigger-gated**:
```
E5 활성화 트리거: "주입된 DA 중 세션 내 hit 안 된 비율 ≥ 50% 가 3 세션 연속 관측"
관측 방법: verifier signal (E4) 또는 hit rate 지표 재사용 — 신규 측정축 없음
미관측 시: E5 영구 보류 (사문화 아님, 필요 없는 상태)
```
**또는 E5-micro**: dry-run τ 3→**2값 (30/60)** × 지표 4→**1 (hit rate only)** × 반복 3→**1** → 총 기간 3-6주 → **1-2주**. 나머지 지표는 E5 편입 후 실운영 로그에서 획득.

---

### WEAK-4. E6 임계 20% — 근거 전무 + E4 의존 전염

**Evidence 인용** (S §E6 Line 194): *"임계 초과 (예: 20%) → 해당 DA 쌍에 대해서만 bundling 자동 활성화"*

**Attack**:
- **"예: 20%" = 근거 0**. 이 임계가 E6 의 on/off 를 결정하는데 dry-run 축이 설계에 없다.
- **이중 실패 모드**:
  - 임계 낮음 (20% 낮음): 관측 noise 만으로 bundling 남발 → **token 예산 8k cap 매번 hit** → 주입 공간 압박 → 다른 정상 DA 밀림.
  - 임계 높음: 활성화 영원히 안 됨 → E6 사문화.
- **E4 WEAK-2 에서의 naked string 파편화가 E6 에 전염**: verifier 가 applies-with 이웃을 지목해도 그 언급이 누적으로 집계 안 되면 E6 트리거 아예 발생 불가. 즉 E6 은 E4-DA-ID-enum 대안이 선행되지 않으면 작동 불가능.
- S §E6 의 4중 안전장치 (1-hop cap / visited set / token cap / 쌍 단위) 는 **확장 시 상한** 만 제어. 활성화 조건 자체의 건전성은 방어 안 됨.

**P-grid 재판정**: P2 **FAIL**. 임계 산정 근거 + E4 의존성 이중으로 작동 불확실.

**Concrete Alternative — E6-whitelist**:
```
구현: applies-with 쌍 중 사용자가 명시한 3-5 쌍만 bundling 활성화
      (예: file-standards ↔ pc-tools, reliability-drift ↔ hook-guard-review)
임계 의존성: 제거
E4 의존성: 제거 (verifier signal 불요)
1인 사용자 특성: whitelist 수동 관리 부담 거의 없음
확장 여지: 관측 데이터가 충분히 쌓이면 E6-original 로 승격 가능
```
**또는 E6 폐기**: plan.md L493 의 기존 판단 유지 — *"searchDA top-K 에 cross-ref 가 자연 bundling 가능, L9.6 에서 누락 관찰될 때만 구현 착수"*. **현재 누락 관찰 없음** → E6 premature.

---

### WEAK-5. P2 전 확장 empirical 공백 — 80%→X 의 X 가 어느 확장에도 없음

**Evidence 인용** (S §P-grid 집계): *"전 확장 공통 P2 WARN — 1-2주 실측이 정당화의 핵심 근거"*

**Attack**:
- **"80% → X%" 의 X 가 6 확장 어디에도 수치 없음**. 모두 "추정" / "실측 필요" / "dry-run 전 불명".
- Tier 2 세션 수 4.5 → 5.5-6 = **+22-33% 증가**. 이 정당화가 1-2주 실측 후 약속 위에 서있는데, 약속이 깨지면 (hit rate 미상승) **Tier 팽창만 남음**.
- **롤백 기준의 비대칭**: S 는 L12.2 원칙 6 (10%p 감소 시 롤백) 만 언급 — 즉 **악화 방어만 있고, "기대 미달 롤백" 은 설계에 없음**. 80% → 81% 애매한 상승은 Tier 팽창을 정당화하지 못하지만 롤백도 되지 않는 회색 지대.
- **ROI attribution 불가**: 6 확장은 입력-출력 의존성 (S §공통 §1 "생성→수렴→활용"). 실측 평가는 파이프라인 말단 hit rate 로만 가능 → **어느 확장이 기여했는지 분해 불가** → 롤백 대상 식별 불가.
- S 는 "독립 토글 6개로 운영" (§공통 §4) 을 선전하지만, E2/E4/E6 이 L12.4/E1/E4 에 의존하므로 **독립 토글은 표면적** — 하류 확장만 끄는 것은 의미 없음.

**P-grid 재판정**: **전 확장 P2 FAIL** (empirical 공백 + 기대 미달 롤백 부재 + attribution 불가 3중).

**Concrete Alternative — A/B-attribution + uplift-commit**:
```
1. A/B 프레임워크:
   각 확장마다 enable flag 독립, 1주 단위로 순차 enable.
   enable 전/후 15-dogfood 재측정 → 해당 확장의 uplift 단독 측정.

2. 확장별 최소 기대치 사전 commit (미달 시 롤백):
   E1:  1개월 누적 승격 DA ≥ 5
   E2:  15-dogfood +2%p (활성화 후 2주)
   E3:  T3 fallback 트리거 ≥ 10건/월 AND 그 중 E1 승격 기여 ≥ 1건
   E4:  verifier JSON schema 준수율 ≥ 80% AND 승격 기여 ≥ 1건/월
   E5:  τ fit 지표 변동이 유의 범위 내 (dry-run 중 측정)
   E6:  bundling 활성화 쌍의 hit rate ≥ 비활성화 대비 +5%p

3. "Tier 팽창 회복 조항" 추가:
   2개월 후 전체 uplift < +3%p 시 Tier 2 원복 (4.5 세션) 강제 검토.
```

---

## 2. 최소 시나리오 — 6 확장 중 2-3건 우선

우선순위 산정 = **pain-point 직결도 × 증거 강도 × 복잡도 역수**:

| 확장 | pain 직결 | 증거 | 복잡도 | 우선 | 처리 |
|---|:---:|:---:|:---:|:---:|---|
| **E1 삼중화** | 高 (keyword 공백 직접 해결) | 관측 3종 | 低 (correlation 입력만 확장) | **1** | **즉시 plan 편입** |
| **E3 T3 fallback** | 中 (Q2 유형 일부 회수) | BGE-M3 학습근거 | 低 (분기 1곳) | **2** | **즉시 plan 편입** |
| E4-MVP (auditor only) | 中 (silent miss observability) | JSON 2필드 | 中 (1 profile 로 축소) | 3 | **조건부** — WEAK-2 대안 적용 시만 |
| E2 | 低 (cold start 3주) | L12.4 하류 | 低 | 보류 | **deferred** (L12.4 누적 30건 돌파 후) |
| E5 | 低 (현재 pain 아님) | τ dry-run 의존 | 中 | 보류 | **trigger-gated** (관측 조건 충족 시) |
| E6 | 中 (chain DA 누락) | E4 의존 | 中 | 보류 | **whitelist 또는 폐기** |

**최종 권장**:
- **즉시 편입 (2건)**: E1 + E3.
- **조건부 편입 (1건)**: E4-DA-ID-enum + profile=auditor only MVP. WEAK-2 대안 채택 시만.
- **보류 / 축소 / 폐기 (3건)**: E2 (deferred), E5 (trigger-gated), E6 (whitelist 또는 폐기).

**Tier 영향**: 6 확장 전원 편입 시 +1-1.5 세션 → 2-3건 편입 시 **+0.5 세션** 수준. ROI 대비 리소스 절감 명확.

---

## 3. Dry-run 압축 시나리오

| 항목 | Before | After | 근거 |
|---|---|---|---|
| E5 τ | 3값 (14/30/60) × 4 지표 × 3 반복 | **2값 (30/60) × 1 지표 (hit rate) × 1 반복** | 나머지 지표는 실운영 로그 확보 |
| E4 profile | coder/harness-worker/auditor | **auditor only** | MVP, 복잡도 1/3 |
| E6 임계 | 20% (근거 없음) | **whitelist 3-5 쌍 고정** | 임계 산정 불요 |
| E2 cold start | 7일 window | **전역 누적 30건 돌파 기준** | 시간 의존 → 데이터량 의존 |
| 전역 | 동시 편입 | **1주 간격 순차 enable + A/B** | ROI attribution 가능 |

**총 기간 추정**: 원안 3-6주 dry-run → 압축안 **1-2주** (순차 enable 로 누적 효과 측정).

---

## 4. P-grid 공격 관점 재집계

| 확장 | P1 | P2 | P3 | P4 | P5 | 종합 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **E1** | PASS | **WARN** | PASS | PASS | PASS | 즉시 편입 |
| E2 | PASS | **FAIL** | PASS | PASS | **FAIL** | **deferred** |
| **E3** | PASS | **WARN** | PASS | PASS | PASS | 즉시 편입 |
| E4 | PASS | **FAIL** | **FAIL** | PASS | WARN | MVP-축소 조건부 |
| E5 | PASS | **FAIL** | PASS | PASS | **FAIL** | **trigger-gated** |
| E6 | PASS | **FAIL** | PASS | PASS | WARN | whitelist 또는 폐기 |

**변동 요약 (Steelman self-score 대비)**:
- **E1/E3**: WARN 유지 (변동 없음) → 즉시 편입 적격.
- **E2**: P2/P5 WARN → **FAIL** (cold start 3주 ROI 0).
- **E4**: P2/P3 WARN → **FAIL** (naked string 파편화 + FP 실측 없음).
- **E5**: P2 WARN → **FAIL**, P5 WARN → **FAIL** (premature + 1인 신호 밀도 부족).
- **E6**: P2 WARN → **FAIL** (임계 근거 + E4 의존 전염).

**P1 (L12.2 재발 방지) 전원 PASS 유지** — Steelman 의 핵심 방어 (LLM 을 관측 이벤트 생산자/판정자로 제한) 는 공격 대상 아님. 이 부분은 인정.

---

## 5. 공격 결론 — Clean Room Judge 제안 방향

1. **즉시 편입 (2건)**: **E1 + E3** — 구조·증거·복잡도 3축 모두 통과.
2. **조건부 편입 (1건)**: **E4-MVP** — WEAK-2 의 DA-ID-enum 대안 + profile=auditor only 적용 시만.
3. **보류 / 탈락 (3건)**: **E2 deferred / E5 trigger-gated / E6 whitelist**.
4. **공통 편입 조건**:
   - A/B enable 프레임워크 + 확장별 사전 commit 기대치 + "Tier 팽창 회복 조항" (2개월 후 uplift < +3%p 시 Tier 2 원복 검토).
   - 6 확장 동시 편입은 ROI attribution 불가로 반려.
5. **Tier 재매핑 권장**: Tier 2 = 4.5 → **5.0** (+0.5 세션, E1+E3 반영). Tier 3 = 1.5 → **1.0** (E5 보류). 나머지는 조건부.
