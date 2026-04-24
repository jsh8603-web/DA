# Round 1 — Steelman: DA 시스템 T2 매칭 확장안 6건

> 역할: 제안자의 관점에서 E1~E6 각각을 가장 강한 버전으로 재진술한다. 공격 금지. 기 확정된 L12.4 (miss log + Read correlation) 는 debate 범위 밖이며 본 문서에서 전제로만 사용.
>
> 평가축: P1 L12.2 재발 방지 / P2 ROI 정당화 / P3 복잡도 관리 / P4 유지보수 0 / P5 단일 사용자 제약.
> 각 확장마다 **새로 발견한 방어 논리는 굵게**. 기존 Gemini 2라운드 합의분은 요약만.

---

## 공통 전제 — 6 확장안이 공유하는 안전 설계

1. **모든 확장은 L12.4 (확정안) 의 증거 파이프를 재사용하거나 그 출력물에 의존**한다. 즉 L12.4 의 **DF 상한 / N 누적 / manual 불가침 / 롤백 1줄 / 10%p 감소 롤백** 6 원칙의 아래에 얹혀 있으며, 이 게이트를 우회하는 신규 keyword 생산 경로는 어느 확장에도 없다.
2. **LLM 을 "keyword 생산자" 가 아닌 "관측 이벤트 생산자" 로 제한**한다. L12.2 의 근본 실패는 Haiku 를 생산자로 세운 구조였다. 본 확장안 전체에서 LLM 의 역할은 (a) 번역 (기존 T2), (b) 충분성 판정 (E4), (c) fallback 호출 (E3) — 어느 것도 keyword 를 상상하지 않는다.
3. **이벤트 기반 — 신규 cron/nightly 0**. 모든 승격·재색인은 `rebuild.ts` post-hook + 사용자 tool call 시점에 발동한다 (P4 보장).
4. **Profile gating** 이 Tier 세션 수 팽창을 흡수한다. E4 verifier 등 고비용 경로는 `coder / harness-worker / auditor` 3 프로필에서만 활성화되어, 평소 대화 세션은 영향 0.
5. **롤백 경로는 각 확장마다 단일 flag/threshold/파일 삭제 1줄로 복귀**한다.

---

## E1. L12.4 증거원 삼중화 (Read + T3 + Verifier, N 차등)

### 왜 (L12.2 불변 원칙 매핑)

- **원칙 1 (증거 없는 확장 금지)**: 세 증거원 모두 **관측 이벤트**. Read = 사용자가 실제로 MD 를 열었다. T3 = BGE-M3 가 학습된 근거로 근접 판정. Verifier = 실전 주입 후 "부족" 라벨. 어느 것도 LLM 의 즉흥 상상 아님.
- **원칙 2 (DF 상한 ≤15)**: 기존 L12.4 필터 그대로 통과. 증거원이 늘어도 최종 keyword 승격은 단일 DF 필터 일원화.
- **원칙 3 (N 누적)**: 증거원별 noise 수준에 따라 **N 차등** — Read within-session=3, Read across-session=2, Verifier=3, Vector=5. Vector 가 가장 높은 이유는 의미 근접만으로는 실사용 의도를 증명하지 못하기 때문.
- **원칙 4 (manual 불가침)**: 기존과 동일 — Levenshtein ≤2 manual keyword 와 merge 차단.
- **원칙 5 (롤백 1줄)**: 증거원별 `enableSource: {read, t3, verifier}` flag 세 개 중 하나씩 toggle 가능.
- **원칙 6 (10%p 감소 롤백)**: 15-dogfood 측정 축은 단일 유지.

### 어떻게

- 기존 `.t2-miss.jsonl` + `read-logger.js` 에 **두 파이프 추가**: `.t3-fallback-hit.jsonl` (E3 이 자동 append) + `.verifier-missing.jsonl` (E4 가 자동 append).
- Correlation script (`build-auto-learn-promote.ts`) 는 입력을 세 jsonl 의 합집합으로 확장. miss 엔트리마다 어느 증거원에서 왔는지 `evidence_source` 필드 부착.
- `original_korean_query` 필드 추가 — 추후 한국어 토큰 확장 / 오역 진단 용도. 기록만, 현 파이프는 영어 토큰 사용.
- 트리거는 **rebuild post-hook 단일** — T3 hit · verifier signal 은 이벤트 시점에 jsonl append, 집계는 rebuild 시에만.

### 효과

- **Q2 유형 (grandfather 같은 keyword 공백) 회수 속도 1.5-2배 가속**. 단일 Read 증거원은 "사용자가 MD 를 열어야만" 학습 — 사용자가 안 열고 넘어가면 학습 불가. Verifier / T3 는 사용자 행동 없이도 증거 축적.
- 1-2주 기간 내 승격 DA 수 (추정) 단일 증거원 5-10건 → 삼중화 10-20건.
- **[새 강점] 증거원 간 교차 확인 (AND) 으로 N 단축 옵션**: 같은 (DA, token) 이 Read + Verifier 두 증거원에서 관측되면 N 을 절반으로 단축해도 false positive 위험 낮음. 향후 dry-run 축으로 활용 가능 — 단 초기 배포에선 각 증거원 독립 누적만으로 보수 운영.
- **[새 강점] L12.2 파탄 재발 조기 탐지**: `evidence_source` 필드 덕에 승격 keyword 가 특정 증거원에 몰리면 (예: verifier 만 80%) 경고 가능 — single-source collapse 사전 감지.

### P-grid

- P1 PASS (6 원칙 모두 매핑). P2 WARN (1.5-2배는 추정치, 1-2주 실측 필요). P3 PASS (correlation script 단일, 입력만 확장). P4 PASS (이벤트 + rebuild post-hook). P5 PASS (N 차등으로 데이터 희소성 적극 반영).

---

## E2. L11.6+ Few-shot 자동 주입 (Haiku 번역 프롬프트 헤더)

### 왜

- **원칙 1**: few-shot 예시는 **L12.4 가 이미 승격 처리한 pair (query → DA → 승격 keyword)** 만 사용. 즉 DF/N/manual 3 게이트를 통과한 검증된 데이터. LLM 상상 경로 없음.
- **원칙 2**: DF 는 T2 색인 측 제약 — few-shot 은 색인을 수정하지 않으므로 독립.
- **원칙 3**: few-shot 에 들어가는 pair 자체가 이미 N 누적을 통과한 산출물.
- **원칙 4**: 프롬프트 헤더 수정은 manual `trigger.keywords` 와 물리적으로 분리된 경로 — 절대 불가침 유지.
- **원칙 5**: 롤백 = `.t2-fewshot.json` 삭제 1줄 (rebuild 시 재생성 되므로 `enableFewshot: false` flag 권장).
- **원칙 6**: 15-dogfood 측정 축 유지.

### 어떻게

- `.t2-fewshot.json` — L12.4 promote 성공분 중 **최근 7일 + 다양성 우선** 상위 5건 자동 선별.
  - 다양성 기준 (우선순위): (1) 서로 다른 DA, (2) cnt 빈도, (3) DA 의미 분산 (kind × domain 교차).
- 매 `rebuild.ts` post-hook 시 자동 재생성, **cap=5 고정** (프롬프트 토큰 예산 유지).
- Haiku 번역 LLM 프롬프트 헤더에 `<example>한국어 … → 영어 … </example>` × 5 형태로 inject.
- 생성 트리거: rebuild 단일 — 신규 cron 없음.

### 효과

- 한국어→영어 번역 단계의 **약어/조어/의역 실패 감소**. Jaccard 매칭은 token 일치에 민감 → 번역 품질이 hit rate 에 직접 반영됨.
- 기대 지표: 80% → 82-84% (번역 edge case 회수분).
- **[새 강점] Amplifier 구조 — L12.4 검증 게이트를 재사용하는 2차 활용**: few-shot 의 "증거 기반" 성질은 L12.4 파이프 자체가 보장. 즉 few-shot 은 L12.4 의 성공분을 **다시 학습 신호로 순환**시키는 피드백 루프 — 별도 검증 층이 필요 없다.
- **[새 강점] L12.2 회귀 경로 물리 차단**: L12.2 는 "DA body 를 보여주고 keyword 생성" 이었다. E2 는 "검증된 query 쌍을 보여주고 번역 일관성 유도" — 출력 공간이 "DA 색인 keyword" 가 아니라 "영어 번역 token" 이라 DA 색인 오염 경로가 애초에 없다.

### P-grid

- P1 PASS. P2 WARN (2-4%p 는 추정). P3 PASS (파일 1개 + flag). P4 PASS (rebuild 단일). P5 WARN (7일 데이터가 없는 초기 기간엔 cap 미달 → few-shot 주입 없이 정상 동작).

---

## E3. L11.7 T2→T3 즉시 Fallback (조건부 phase)

### 왜

- **원칙 1**: fallback 동작의 산출물 = BGE-M3 벡터 근접 결과. BGE-M3 는 **사전 학습된 외부 모델** — LLM 즉흥 생성이 아니라 고정된 근거.
- **원칙 2**: DF 무관 (색인 확장 없음). 단, T3 결과를 .jsonl 로 남겨 E1 파이프가 소비.
- **원칙 3**: 관측만 기록. 승격은 E1 경로에서 N 누적 통과해야 함.
- **원칙 4**: manual 경로 미접촉.
- **원칙 5**: threshold 0.3 → 1.0 으로 상향 시 fallback 사실상 off (1줄).
- **원칙 6**: 15-dogfood 측정 축 유지.

### 어떻게

- T2 Jaccard top score < 0.3 OR top-K 공집합 → T3 BGE-M3 호출, top-2 반환.
- fallback 사실을 `.t2-miss.jsonl` 에 `fallback: "t3"` 필드로 append (추가 파일 없음, 기존 인프라 재사용).
- threshold (0.3) 는 dry-run 으로 조정 가능 — 초기 배포 후 로그 분석.
- 호출 경로: T2 매칭 함수 말미 조건 분기 — 별도 daemon 불필요.

### 효과

- T2 plateau 의 나머지 20% 중 keyword 공백 유형 회수. Q2 같은 실 사용 miss 의 일부가 실시간 해결됨 (사용자 재쿼리 불요).
- Latency: T2 miss (전체의 20%) 에만 추가 T3 호출 → 평균 latency 증가 제한적. 단 실측 필요 (<100ms 목표 대비).
- **[새 강점] T3 를 단발 도구에서 "T2 sharpening 피드백 엔진" 으로 승격**: fallback 결과가 E1 증거원으로 수렴 → 동일 query 가 반복 관찰되면 T2 keyword 로 자동 승격 → 다음부터는 T3 호출 없이 T2 에서 해결. 즉 T3 fallback 은 **해결이 아니라 학습 트리거**.
- **[새 강점] "Silent miss → Loud miss" 전환**: 현재 T3 는 별도 경로에서만 호출되어 T2 실패가 보이지 않음. 즉시 fallback 은 T2 실패를 관측 가능한 이벤트로 바꿔, 증거 파이프 자체를 가시화.

### P-grid

- P1 PASS. P2 WARN (회수분 구체 수치 미확정). P3 PASS (분기 1곳 + threshold 1개). P4 PASS (이벤트 분기). P5 PASS (1인 사용자는 T3 호출 빈도 자체가 낮음 → 비용 impact 미미).

---

## E4. Phase L-V Verifier (Haiku 충분성 판정)

### 왜

- **원칙 1**: verifier 출력은 `{is_sufficient:bool, missing_context:str}` **JSON 2필드 고정**. missing_context 는 **naked string 그대로 N 회 누적 카운팅** 만 하며, LLM 이 재추출하거나 keyword 로 변환하지 않는다. 즉 LLM 은 **판정자** 이지 **생산자** 가 아님 — L12.2 구조와 역할이 근본적으로 다름.
- **원칙 2**: missing_context 가 E1 파이프에 들어갈 때 DF/N/manual 게이트 그대로 통과 필요.
- **원칙 3**: 같은 DA 에 대해 missing_context token 이 N=3 누적되어야 E1 승격 candidate.
- **원칙 4**: manual 접촉 없음.
- **원칙 5**: profile gating 에서 3 역할 제거하면 verifier off (1줄).
- **원칙 6**: 기존 측정 축 + verifier FP rate 측정 축 1개 추가 (대시보드만, 롤백 기준 변경 없음).

### 어떻게

- 위치: DA 주입 완료 후, Coder LLM 호출 **직전** 의 얇은 관문.
- 입력: (query + 주입된 DA 의 summary 만 — body 전체가 아니라 요약, 토큰 절약).
- 출력: `{is_sufficient:bool, missing_context:str}` JSON, schema 강제.
- is_sufficient=false 시: (a) missing_context 를 `.verifier-missing.jsonl` 에 append, (b) DA `sources[0].canonical` MD hint 있으면 **즉시 강제 Read** (실시간 복구 경로), (c) N 누적은 E1 파이프에서 판정.
- 정규화: 조사 제거 + 경량 stemming (기존 T2 tokenize 재사용).
- Profile gating: `coder / harness-worker / auditor` 만 활성. 일반 대화 / lightweight-wf 영향 0.

### 효과

- Latency: +300-800ms (profile gated 세션만). 비활성 세션은 0ms.
- **[새 강점] Silent miss 의 Observability 자동화**: 현재 DA 주입 품질 판정은 사용자 피드백 의존. verifier 는 **run-time 라벨** 을 생성 → "DA 가 부족했다" 가 관측 가능 이벤트가 됨. 이는 자기개선 루프의 결측 신호를 메움.
- **[새 강점] 실시간 복구 경로**: MD hint 강제 Read 는 **학습 외 실시간 해결** 제공 — verifier false 판정이 E1 승격까지 대기할 필요 없이 즉시 사용자 쿼리에 반영.
- **[새 강점] L12.2 역사 상 구조 차별**: L12.2 = LLM 에게 "규칙 보고 키워드 만들어" (생산). E4 = LLM 에게 "이 규칙이 이 query 에 충분한가" (판정). 판정 출력은 bool + 자연어 증거 — keyword 공간에 직접 쓰지 않음. 증거 파이프 통과 후에만 keyword 로 전환.
- 기대 지표: Q3-type (regex/frontmatter 특수 맥락) miss 감소, WF 세션에서 주입 정밀도 상승.

### P-grid

- P1 PASS (역할 분리가 L12.2 회귀 방지의 핵심). P2 WARN (Haiku FP rate 실측 필요). P3 WARN (복잡도 증가 최대 — JSON schema + profile gating + MD 강제 Read 3 분기). P4 PASS (이벤트). P5 PASS (profile gating 으로 데이터 수집 집중).

---

## E5. L3.7 Decay 확장 (effective_score 연속 감쇠)

### 왜

- **원칙 1**: decay 공식은 세션 hit 이력 (관측) 만 입력. LLM 미접촉.
- **원칙 2**: DF 무관.
- **원칙 3**: 무관 (keyword promotion 경로 아님).
- **원칙 4**: manual 불변.
- **원칙 5**: τ=∞ 로 설정 시 penalty 항 0 → 기존 binary (active/dormant) 동작과 동치 (1줄).
- **원칙 6**: 15-dogfood 측정 축 유지.

### 어떻게

- effective_score = base_score − decay_penalty(age_days, τ). 예: `penalty = 1 − exp(−age/τ)` 또는 linear.
- τ 초기값 dry-run: **14 / 30 / 60일 비교** — 실 로그 재생해 hit rate / 부활률 / latency / 컨텍스트 밀도 4 축 측정.
- dormant 강등 기준에 effective_score threshold 추가 (기존 "N일 + M세션" 2중 조건과 AND 결합 → 보수적).
- 실행 시점: 감사 wf 스윕 (기존 orphan 감지 경로 재사용) — 신규 cron 없음.

### 효과

- **[새 강점] Hard-edge → Smooth**: binary 는 hit 없던 DA 가 어느 순간 갑자기 dormant 됨. decay 는 점진적 우선순위 하락 → 주입 후보 순위에 자연 반영, 사용자가 복귀 의도 보이면 (hit) 즉시 회복.
- **[새 강점] 주입 공간 경쟁의 quantification**: effective_score 는 T2/T3 score 비교 시에도 그대로 적용 가능 → 동률 tie-break 에서 "최근 hit 이력" 이 자연 신호로 작용. 주입 공간이 유한한 세션에서 주입 경쟁 질서가 생김.
- dry-run 축 명확: τ 3 값 × 4 지표 비교 → 결과로 τ 고정 가능. 1-2주 실측 후 판정.

### P-grid

- P1 PASS (관측 기반). P2 WARN (dry-run 전 ROI 불명확). P3 PASS (공식 1개 + τ 1개 + threshold 1개). P4 PASS (감사 wf 재사용). P5 WARN (1인 사용자 불규칙 근무는 τ 실측 신뢰성에 영향 — dry-run 결과를 신중히 해석해야 함).

---

## E6. L9.8 Chain Bundling Trigger 확장 (Verifier signal 기반 자동 활성화)

### 왜

- **원칙 1**: bundling 활성화 조건 자체가 **verifier missing_context 의 applies-with 이웃 지목 비율** — 관측 이벤트 누적. LLM 즉흥 확장 아님.
- **원칙 2**: bundling 은 색인 수정이 아니라 **주입 시 동반 DA 선택** — DF 무관. 단 token 예산 cap 이 동반 주입 양 상한.
- **원칙 3**: "반복 지목" 이 N 누적 역할 (비율 임계).
- **원칙 4**: manual 불변 (bundling 은 기존 `applies-with` 메타를 소비, 생성 안 함).
- **원칙 5**: enable flag off = bundling 전량 해제 (1줄).
- **원칙 6**: 측정 유지 + bundling 활성화된 DA 의 hit rate 별도 관찰.

### 어떻게

- 모니터: verifier 의 missing_context 가 현재 DA 의 `applies-with` 이웃 DA 를 가리키는 비율.
- 임계 초과 (예: 20%) → 해당 DA 쌍에 대해서만 bundling **자동 활성화** (전역 활성화 아님, 쌍 단위).
- 안전장치:
  - **1-hop cap** (multi-hop 확장 금지)
  - **Visited Set** (순환 참조 차단)
  - **토큰 예산 8k 상한** (주입 공간 폭주 방지)
  - **쌍 단위 활성화** (전역 토글 아닌 관측된 필요 케이스만)
- 실행 시점: rebuild post-hook 재사용.

### 효과

- chain DA 누락으로 인한 miss 감소. 현재 `applies-with` 는 enrich-cross-ref.ts 가 자동 생성하지만 주입 시 동반되지 않음.
- **[새 강점] 관측 기반 조건부 활성화 — "항상 bundle" 아닌 "필요가 증명된 쌍만 bundle"**: 이 설계는 bundling 의 전형적 위험 (context bloat, noise amplification) 을 관측 이벤트로 게이팅한다. 1-hop + token cap 은 최대 확장 상한이지, 활성화 자체는 증거가 결정.
- **[새 강점] Debt 없음**: 활성화된 쌍은 관측 기반이므로, 관측이 멈추면 자연스럽게 stale 감지 가능 (verifier missing_context 지목이 더 이상 발생하지 않으면 자동 비활성화 후보).

### P-grid

- P1 PASS (증거 게이트). P2 WARN (기대 회수 건수 실측 필요). P3 PASS (안전장치 4중). P4 PASS (rebuild 재사용). P5 PASS (쌍 단위 활성화는 데이터 희소 환경에 유리).

---

## 종합 방어 논리 (Clean Room Judge 용 요약)

1. **6 확장은 하나의 관측 파이프라인을 공유한다**: Read (E1 기존) + T3 fallback (E3) + Verifier signal (E4) → E1 삼중 증거원 → E2 few-shot amplifier → E5 decay 우선순위 조정 → E6 chain bundling 조건 활성화. 즉 독립 6 개가 아니라 **단일 증거 파이프의 생성 (E3/E4) · 수렴 (E1) · 활용 (E2/E5/E6) 3 단계 분할**.
2. **L12.2 회귀 경로는 구조적으로 차단**: LLM 은 어느 확장에서도 keyword 를 직접 색인에 쓸 수 없다. 모든 확장은 관측 → DF/N 게이트 → 승격의 동일 관문을 통과해야 한다.
3. **Profile gating + 이벤트 기반** 으로 유지보수 0 및 비 WF 세션 영향 0 을 동시에 보장.
4. **각 확장 단위로 1줄 롤백 가능** — 6 확장을 단일 원자 트랜잭션이 아니라 6 독립 토글로 운영 가능하므로, 1개가 실패해도 나머지 5개가 작동.

## P-grid 집계 (Self-Steelman)

| 확장 | P1 | P2 | P3 | P4 | P5 |
|---|:---:|:---:|:---:|:---:|:---:|
| E1 | PASS | WARN | PASS | PASS | PASS |
| E2 | PASS | WARN | PASS | PASS | WARN |
| E3 | PASS | WARN | PASS | PASS | PASS |
| E4 | PASS | WARN | WARN | PASS | PASS |
| E5 | PASS | WARN | PASS | PASS | WARN |
| E6 | PASS | WARN | PASS | PASS | PASS |

**전 확장 공통**: P1 (L12.2 재발 방지) PASS, P4 (유지보수 0) PASS. P2 (ROI) 는 모두 WARN — 1-2주 실측이 정당화의 핵심 근거가 된다. 즉시 plan 편입 vs dry-run 후 편입의 주된 변수는 P2 측정 데이터 축적 가능성이다.
