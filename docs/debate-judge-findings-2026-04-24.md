# Self-Verification Findings — Judge Step 3

> 독립 검증 결과. Judge 본인이 원 사실 → 자료 대조로 확인한 항목.
> Verdict §1 에 요약 반영.

---

## F1. L12.2 불변 원칙 준수 검증

**검증 경로**: `D:/projects/Obsidian/plan-da-lifecycle.md` §L12.4 블록 + promotion-log 2026-04-24 엔트리.

**실제 원칙 (plan-da-lifecycle.md L373-386 §안전장치 + §재발 감지)**:

1. **DF 상한**: 1 token >15 DA 매칭 시 generic → 제외 (L12.2 "session 62 DA" 재발 방지)
2. **N회 누적**: 같은 (DA, token) 3회+ 관찰 필요
3. **Token 길이 ≥ 3**: short noise 제거
4. **Manual 중복 제외**: Levenshtein ≤ 2 manual keyword 와 merge 안 함
5. **Manual keyword 불가침**: `trigger.keywords` 수정 금지
6. **Rollback 경로**: `build-t2-keyword-index.ts` 에서 auto-keywords 제외 1줄로 복귀

**재발 감지 trigger**:
- 15-dogfood hit rate 10%p 이상 **감소** 시 즉시 롤백
- 인덱스 총 keyword 수가 manual baseline (~1790) 의 2배 초과 시 경고
- 특정 token 이 >20 DA 매칭 시 DF 상한 낮춰 재시도

**debate-context.md §3 과의 정합성**: 6 원칙 문언은 일치 (증거 없는 확장 금지 = 안전장치 전체 기조 + N 누적 + DF 상한 + manual 불가침 + 롤백 1줄 + 10%p 감소 롤백).

**6 확장안의 원칙 1 우회 여부 검증**:
- E1: 3 증거원 모두 **관측 이벤트** — LLM 상상 경로 없음. PASS.
- E2-hybrid: L12.4 통과 산출물 재사용 + Phase 1 manual seed = 사용자 직접 기입. PASS.
- E3: BGE-M3 외부 학습 모델 = 고정 근거. PASS.
- E4-enum-MVP: Verifier = 판정자 (enum 선택), **생산자 아님**. L12.2 구조와 역할 분리. PASS.
- E5-trigger-gated: decay 공식은 관측된 hit 이력 사용. LLM 미접촉. PASS.
- E6-whitelist-first: Phase 1 = 사용자 수동 3-5 쌍. PASS.

**판정**: **6 확장안은 모두 원칙 1 을 우회하지 않는다.** LLM 이 keyword 생산자로 돌아가는 경로는 어디에도 없음. 단, 원칙 적용을 **관측→DF/N 게이트→승격** 공통 관문을 통과시켜야 하는 전제가 유지되어야 함.

---

## F2. DAG 의존성 검증 (Attack §0)

**Attack 주장 (debate-R1-attack.md L11-18)**: "6 확장 = 의존성 DAG 로 엮인 6 단계 빌드 — E2/E4/E6 이 L12.4/E1/E4 에 의존".

**debate-context.md §5 원 사실 대조**:
- **E2 (Few-shot)**: "데이터: L12.4 promote 성공분 중 최근 7일 상위 5건" (L58-59). → **L12.4 하류 명백.**
- **E4 (Verifier)**: 자체 파이프라인은 독립. 단 출력물(`.verifier-missing.jsonl`)이 E1 삼중화의 증거원 1종으로 feed (E1 §L33-36). → **E1 이 E4 의 하류, E4 는 독립.**
- **E6 (Chain bundling)**: "Verifier missing_context 가 applies-with 이웃 DA 를 반복 지목하는 비율이 임계 초과 시 자동 활성화" (L81-84). → **E6 은 E4 상류 의존 명백.**

**정확한 DAG**:
```
L12.4 (확정) ──┬→ E1 삼중화 ─── (E3, E4 signal 이 E1 증거원 1/3 을 차지)
               └→ E2 Few-shot (L12.4 promote 산출물 직접 소비)
E4 Verifier ──┬→ E1 증거원 (1/3)
              └→ E6 (verifier missing_context 비율 임계 활성화)
E3 T3 fallback ─→ E1 증거원 (1/3)
E5 Decay: 독립 (session hit 이력만 사용, LLM/다른 확장 미접촉)
```

**Attack 정확도 평가**:
- "E2 → L12.4": **완전 정확.**
- "E6 → E4": **완전 정확.**
- "E4 → L12.4" 은 Attack 문구에 직접 없음. Attack 이 쓴 것은 "생성(E3/E4)은 E1 없이는 사용 불가" — 즉 E4 생성물이 E1 에서 소비되는 방향. **역방향 의존 (E1↓E4) 이지만 "사용 불가" 판단은 타당** (E4 signal 이 E1 파이프 없이 버려짐).
- 그러나 Steelman §공통 §1 의 "3단계 분할" framing 도 사실 기반 — 생성(E3/E4) → 수렴(E1) → 활용(E2/E5/E6). Attack 의 DAG 주장과 Steelman 의 3단계 분할은 **동일한 구조의 다른 재해석** (실질적 충돌 아님).

**판정**: **Attack 의 DAG 의존성 주장은 VALID.** E2, E6 의 하류 의존성은 debate-context 와 정확히 정합. 단 Attack 이 이것을 "선지불/후지불 비대칭" 으로 확장한 결론은 순차 enable 시 약화된다 (Rebuttal 의 compromise 경로).

---

## F3. 한국어 파편화 예시 검증 (Attack §WEAK-2)

**Attack 예시 3 개**:
- Obs 1: "frontmatter date 필드 필요"
- Obs 2: "YAML 헤더 date 누락 시 처리"
- Obs 3: "파일 생성 날짜 규칙"

**Steelman §E4 정규화 정의**: *"조사 제거 + 경량 stemming (기존 T2 tokenize 재사용)"*.

**"조사 제거 + 경량 stemming" 적용 시 토큰 집합 (추정)**:
- Obs 1: {frontmatter, date, 필드, 필요}
- Obs 2: {YAML, 헤더, date, 누락, 처리}
- Obs 3: {파일, 생성, 날짜, 규칙}

**집합 교차**:
- Obs 1 ∩ Obs 2 = {date} (1 token)
- Obs 1 ∩ Obs 3 = ∅
- Obs 2 ∩ Obs 3 = ∅

**N=3 문턱 도달 가능성**:
- `date` 만 2/3 observation 에서 관찰 → N=3 도달 **불가**.
- 나머지 토큰 전부 단일 observation → N=3 도달 **불가**.
- "frontmatter" ≈ "YAML 헤더" / "date" ≈ "날짜" 의미 동일성은 정규화 범위 밖 (stemming 은 어간 추출만, synonym 매핑 아님).

**판정**: **Attack 의 한국어 파편화 주장은 VALID.** 실질적으로 3 개 observation 모두 동일 개념("frontmatter date 규칙")을 가리키지만, "조사 제거 + 경량 stemming" 은 synonym 매핑을 포함하지 않으므로 N 누적 실패 → E4 원안 (naked string)은 의미 있는 signal 축적 불가. Rebuttal 의 `E4-enum-MVP` (DA-ID-enum) 수용이 이 결함의 구조적 해결.

---

## F4. E6 "임계 20%" 근거 검증 (Attack §WEAK-4)

**Steelman §E6 L193 원문**: *"임계 초과 (**예: 20%**) → 해당 DA 쌍에 대해서만 bundling 자동 활성화"*.

**"예: 20%" 의 근거 탐색**:
- Steelman §E6 본문: 20% 값에 대한 derivation 없음. "예:" prefix 는 **예시값** 임을 명시.
- Steelman §E6 어디에도 empirical (관측 로그/dry-run) 또는 이론적 (공식/rationale) 근거 없음.
- debate-context.md §5 §E6 원 설명: "임계 초과 시 자동 활성화" 만 기재, 수치 값 명시 없음 — "20%" 는 Steelman 가 예시로 도입한 값.

**판정**: **Attack 의 "근거 0" 주장은 VALID.** 20% 는 placeholder 예시값이며 dry-run 설계 축으로 승격되지 않음. Rebuttal 의 `E6-whitelist-first` 는 임계 자체를 제거하고 사용자 수동 3-5 쌍으로 시작 — 이 compromise 는 임계 근거 공백을 구조적으로 우회.

---

## F5. Empirical 리서치 정합성 (Rebuttal 의 수치 commit)

**공개 RAG 관행 대조 (debate-research-findings.md)**:

### 5.1 Few-shot cap=3 (E2-hybrid) vs 권고 3-5
- 연구 권고: **3-5 개** 주요 범위, 5-8 이상은 diminishing return.
- Rebuttal cap=3: **보수적 하단.** 실시간 보조 태스크 latency 민감성 + 단일 도메인 과적합 위험을 고려하면 3 은 합리적 하단.
- **판정**: VALID — 권고 범위 내.

### 5.2 JSON 준수율 ≥95% (E4-enum-MVP)
- 연구: schema-enforced API 기능 사용 시 >99.5%, 프롬프트 기반 80-95%.
- Rebuttal 목표 ≥95%: **달성 가능** (API schema-enforced 모드 사용 시), **달성 어려움** (프롬프트만 사용 시 상단 경계).
- **판정**: PARTIAL — 목표 수치는 실행 방식에 따라 달성도 갈림. Anthropic SDK 의 tool-use / JSON mode 활용 전제면 VALID, 자유 프롬프트면 상향 달성 불확실.

### 5.3 Sunset clause 2개월 <+3%p vs 업계 1-3개월 <+2-5%p
- 연구: "보통 1-3개월간 주요 지표 uplift <+2-5%p 시 원복 또는 재검토".
- Rebuttal: 2개월 <+3%p → Tier 2 원복 검토.
- **판정**: VALID — 업계 관행 정상 범위 중간값.

### 5.4 1인 사용자 통계 유의성 불가 vs uplift-commit 수치 목표
- 연구: *"1인 사용자의 경우 통계적 유의성(p-value) 확보는 거의 불가능. 대신 추세 분석을 위해 최소 50-100건 이상 수집 후 정성적/정량적 평가 권장"*.
- Rebuttal 제안 수치: E1=1개월 누적 승격 ≥ 5건 / E2=+2%p / E3=10건/월 / E4=JSON ≥95% / E6=+5%p.
- **핵심 결함**: 이 수치들이 통계적 threshold 로 작동할 수 없음. "80% → 82%" 는 15-dogfood 기준 1-3 query 차이 범주 — noise 와 구별 불가.
- **판정**: CRITICAL WARNING — 숫자 자체는 업계 벤치마크 정합하지만, **1인 사용자 환경에서 이 수치는 "정량적 threshold" 가 아니라 "정성적 방향성 신호"** 로 해석해야 함. Rebuttal 이 이것을 "미달 시 자동 롤백 기준" 으로 사용하면 noise 기반 오판 위험.
- **미반영 insight**: 연구의 "사용자 피드백 등 정성적 평가의 중요성이 훨씬 큽니다" 가 Rebuttal 에 명시적으로 반영 안 됨. Uplift-commit 수치 + 정성 평가 channel 병행 필요.

---

## F6. 종합 검증 요약

| ID | 검증 대상 | 결과 |
|---|---|:---:|
| F1 | L12.2 6 원칙 매핑 | 6 확장 모두 **통과** |
| F2 | Attack DAG 주장 | **VALID** (E2→L12.4, E6→E4 정합) |
| F3 | 한국어 파편화 3 예시 | **VALID** (N=3 도달 불가 입증) |
| F4 | E6 임계 20% 근거 | **VALID** (근거 공백 확인) |
| F5.1 | Few-shot cap=3 | **VALID** (권고 범위) |
| F5.2 | JSON ≥95% | **PARTIAL** (실행 방식 의존) |
| F5.3 | Sunset 2개월 <+3%p | **VALID** (업계 관행) |
| F5.4 | 1인 통계 유의성 | **CRITICAL WARNING** — 수치 commit 의 의미 재해석 필요 |

**Verdict 로 가져갈 핵심 메시지**:
1. Attack 의 **3 개 핵심 공격 (DAG / 파편화 / 20% 근거)** 모두 실증으로 VALID → Rebuttal 의 구조 수정 수용이 정당.
2. Rebuttal 의 **4 분류 합의안** 은 Attack 의 대안을 대부분 흡수 — 신규 논점 없음.
3. **숨은 리스크**: F5.4 — 1인 사용자 환경의 통계적 한계가 uplift-commit 수치를 "정성적 방향성" 으로 재해석하도록 강제. Rebuttal 이 이것을 명시적으로 구분하지 않음.
4. **JSON ≥95%** 는 Anthropic SDK 의 tool-use/schema 기능 명시 전제 필요 (없으면 95% 도달 불확실).
