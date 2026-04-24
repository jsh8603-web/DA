# Plan — DA 시스템 T2 한국어 매칭률 개선 (80% → 90%+)

> **범위**: T2 키워드 매칭 단계의 hit rate 개선 전용. 전체 DA 시스템 설계 (4-state 생명주기 / Projection Tier / Profile / Role Weighting 등) 는 본 plan 의 범위 밖이며 원본 환경에 보존됨.
> **SSOT seed**: `D:/projects/Obsidian/plan-da-lifecycle.md` §L12 블록 (원본)
> **Debate verdict**: `docs/debate-verdict-2026-04-24.md` (Judge 판정 원문)
> **작성 Agent 이해 수준**: debate Steelman/Attack/Rebuttal/Judge 4 단계 검증 완료. 외부 Gemini 리서치 1 라운드 반영.

---

## 0. Executive Summary

본 plan 은 **6 개 확장안** 을 4 분류로 편성해 T2 매칭률 plateau 를 해소한다:

- **즉시 편입 (2 건)**: E1 증거원 삼중화 + E3 T2→T3 즉시 fallback
- **구조 수정 편입 (2 건)**: E4 Verifier-enum-MVP + E6 Chain Bundling Whitelist-first
- **Deferred (1 건)**: E2 Few-shot Hybrid (Manual seed + 자동 활성화 임계)
- **Trigger-gated 보류 (1 건)**: E5 Decay (관측 조건 충족 시 자동 발동)

**실행 전략**: Agent 시뮬레이션으로 원 설계의 1-2 주 실측을 **1 일 내로 압축**. 사용자가 완성된 경험을 즉시 받는다.

**재발 방지 절대 원칙**: L12.2 파탄 (hit rate 0% 사건) 의 6 불변 원칙 (§1.3) 을 모든 확장이 준수한다. LLM 을 키워드 생산자로 세우지 않고 **관측 이벤트 생산자 / 판정자 / fallback 호출자** 로만 사용한다.

**Tier 재매핑**: Tier 2 = 4.5 → 5.0 (즉시 E1+E3) → 5.3 (Phase 1 E4+E6). 2 개월 후 uplift <+3%p + 정성 4 축 중 2/4 미달 시 Tier 2 원복 검토.

**핵심 미해결 리스크 (CRITICAL)**: 1 인 사용자 통계 유의성 불가. uplift-commit 수치는 정량 threshold 가 아닌 **정성적 방향성 지표** 로 재해석. 정량 + 정성 4 축 병행 평가 필수.

---

## 1. 배경 & L12.2 파탄 복기

### 1.1 현재 T2 파이프라인

```
[한국어 사용자 프롬프트]
        │
        ▼
[Haiku 번역기]  OAuth Bearer 기반 Claude Haiku 4.5 호출
  입력: 한국어 query
  출력: 영어 keyword 토큰 후보 (smartTokenize)
  latency: ~300-1100 ms (file-body 방식)
  실패 시: graceful fail (영어 키워드 추출 없이 다음 단계)
        │
        ▼
[T2 키워드 매칭]  Jaccard 유사도
  입력: 영어 토큰 ∩ DA trigger.keywords
  비교 대상: .t2-keyword-index.json (305 DA × manual keywords)
  threshold: 0.5 (multi-token keyword 기준)
  출력: 상위 5 DA (cap T2_MAX_DA)
  목표 latency: < 100 ms
        │
        ▼
[T3 BGE-M3 벡터]  (현재는 별도 경로에서만 호출)
  입력: query 원문
  비교 대상: LanceDB 의 DA description embedding
  출력: 상위 3 DA (cap T3_MAX_DA)
        │
        ▼
[MAX_INJECT_CHARS 6000 cap]  컨텍스트 주입 상한
        │
        ▼
[Opus Coder 답변 생성]
```

### 1.2 현재 plateau 원인

15-dogfood 측정 (2026-04-24) 기준 hit rate 80%. 3 건 MISS 중 1 건은 **manual keyword 공백** 패턴:

```
예시 — Q2 grandfather:
  사용자 query: "grandfather 적용 안 해도 돼?"
  정답 DA: file-standards-frontmatter (신규 파일 vs 기존 파일 grandfather 적용 규칙)
  file-standards-frontmatter.yaml 의 trigger.keywords: ["frontmatter", "yaml", ".md 생성", ...]
  "grandfather" 는 없음 → Jaccard = 0 → 매칭 실패
  사용자는 직접 file-standards.md 를 Read 해서 답을 찾거나 포기

자연 학습 경로:
  만약 사용자가 실제로 file-standards.md 를 Read 했다면
  → `.t2-miss.jsonl` (query) 와 read-logger (file 접근) 상관관계에서
  → "grandfather" 를 file-standards-frontmatter 의 auto-keywords 로 승격 가능
  → 다음 동일 query 는 즉시 매칭
```

### 1.3 L12.2 파탄 (2026-04-24 오전)

**시도한 것**: Haiku 에게 각 DA 의 body (YAML + 설명문) 를 주고 "이 규칙이 호출될 법한 영어 키워드 여러 개 생성" 요청. 303 DA 전수 auto-keywords 일괄 주입.

**파탄 메커니즘**:

1. LLM 이 DA body 만 보고 키워드 생성 시 **"안전·보편적" 단어 편향** 발현
2. "session", "workflow", "rule", "check", "config", "guard", "context" 같은 **제네릭 토큰이 50+ DA 에 공통 주입**
3. Jaccard 매칭 공식상 사용자 query 가 제네릭 토큰 1 개만 포함해도 50+ DA 가 **동점 hit**
4. 정답 DA 의 **특이 토큰 (grandfather 등) 은 제네릭 바다에 묻혀 top-K 밖으로 밀림**
5. 15-dogfood hit rate 80% → 0% 로 파탄

**롤백**: `build-t2-keyword-index.ts` 에서 auto-keywords 필드를 인덱스 제외 1 줄 수정. manual `trigger.keywords` 1790 개만 재인덱싱. 3/3 smoke PASS. 80% 회복.

**교훈**:

- LLM 이 DA body 에서 "상상한" 키워드 ≠ 실제 사용자 query 변형. 두 공간이 괴리
- **증거 없는 확장 금지** (불변 원칙 1)
- **DF 상한 필수** — 1 token 이 15 DA 초과에서 매칭되면 generic 으로 제외
- **승격은 N 회 누적 관측** 후에만. 단일 관측 승격 금지

### 1.4 불변 원칙 6 개

모든 확장은 아래 원칙을 위배하지 않아야 한다. 위배 감지 시 해당 확장 자동 rollback.

| # | 원칙 | 구현 방식 |
|---|---|---|
| 1 | 증거 없는 확장 금지 | LLM 이 생성한 키워드는 auto-keywords 에 바로 쓰지 않음. 관측 이벤트 (Read/T3 hit/Verifier) 증거 필수 |
| 2 | DF 상한 | `.t2-keyword-index.json` 빌드 시 token document-frequency ≤ 15 필터 |
| 3 | N 회 누적 | 같은 (DA, token) pair 가 N 회+ 관측 후 승격. 증거원별 N 차등 |
| 4 | Manual 불가침 | `trigger.keywords` 필드는 자동화가 수정/삭제 불가. Auto 승격은 별도 `auto-keywords` 필드에 |
| 5 | 롤백 1 줄 | 모든 자동 기능은 flag or threshold 1 줄 수정으로 off |
| 6 | 15-dogfood -10%p 즉시 rollback | 15 건 hit rate 가 baseline 대비 -10%p 하락 시 enable flag 자동 off |

### 1.5 기 확정 복구안 — L12.4 Auto-Learn (debate 대상 아님)

본 plan 은 L12.4 를 기본 토대로 삼는다. 재논의 금지.

```
[사용자 query A] → [T2 매칭 실패]
                        │
                        ▼
                [.t2-miss.jsonl append]
                  {ts, query: "A", english_kw: [...], session: "..."}
                        │
                        │ 같은 세션 내 60 초 내
                        ▼
                [Agent 가 관련 MD B 를 Read]
                        │
                        ▼
                [read-logger audit-log append]
                  {ts, type:"file_read", file_path: "B.md", session: "..."}
                        │
                        ▼
[build-auto-learn-promote.ts — 주기적 batch 또는 rebuild post-hook]
  1. miss 엔트리 roll-up (최근 30 일)
  2. 각 miss 에 대해 같은 session 60 초 내 Read 이벤트 매칭
  3. query token ∩ MD body token = 교집합 (token length ≥ 3)
  4. MD path → DA ID 역참조 (sources.canonical 필드)
  5. 같은 (DA, token) pair N=3 회+ 관측 → 승격 candidate
  6. DF 상한 ≤ 15 필터 (generic 제외)
  7. manual Levenshtein ≤ 2 중복 제외
                        │
                        ▼
[DA yaml 의 auto-keywords 필드에 append (manual 불변)]
                        │
                        ▼
[rebuild.ts post-hook → .t2-keyword-index.json 재생성]
                        │
                        ▼
[다음 동일 query 는 T2 에서 즉시 매칭]
```

---

## 2. 6 확장안 상세

### 2.1 [즉시 편입] E1 — 증거원 삼중화

**목표**: L12.4 의 Read 이벤트 단일 증거원을 3 증거원으로 확장해 데이터 축적 속도를 1.5-2 배로 올리고 사용자 행동 의존도를 완화한다.

**Before (L12.4 단일 경로)**:
```
Read 이벤트만 증거로 수집 → N=3 관측 → 승격
```

**After (E1 삼중화)**:
```
증거원 1. Read 이벤트          → .t2-miss.jsonl 내부 correlation  (기존)
증거원 2. T3 벡터 fallback hit → .t3-fallback-hit.jsonl  (E3 이 append)
증거원 3. Verifier missing     → .verifier-missing.jsonl (E4 가 append)
              │
              │ 3 증거원 union 입력
              ▼
[build-auto-learn-promote.ts]
  각 증거 엔트리에 evidence_source 필드 부착
  증거원별 N 차등:
    Read within-session = 3  (같은 세션 내 관측 → 노이즈 낮음)
    Read across-session = 2  (다른 세션 반복 관측 → 의도 명확)
    Verifier            = 3  (LLM 판정이지만 schema 제한)
    Vector              = 5  (알고리즘 근접만 → 가장 보수적)
  DF 상한 ≤ 15 + manual Levenshtein ≤ 2 제외
              │
              ▼
[DA auto-keywords append + rebuild index]
```

**데이터 스키마 확장**:
- `.t2-miss.jsonl` 각 엔트리에 `original_korean_query` 필드 추가 (E2 Few-shot seed 소스)
- `.t3-fallback-hit.jsonl` 신규 파일 — `{ts, query, korean, hit_das: [top-2], session}`
- `.verifier-missing.jsonl` 신규 파일 — `{ts, query, missing_da_ids, session}`

**안전장치**:
- `enableSource.{read, t3, verifier}` 3 개 flag 독립 → 한 증거원만 선택적 off 가능
- 승격 keyword 가 특정 증거원에 80% 이상 편중 시 warning 경보 (single-source collapse 조기 감지)
- Read 이벤트 within-session 은 60 초 window, across-session 은 24 시간 window

**구현 진입점**:
- 신규: `pipeline/build-auto-learn-promote.ts` (correlation 로직)
- 수정: `hooks/prompt/da-context.js` (miss log 에 `original_korean_query` 추가)
- 수정: `hooks/prompt/da-context.js` (E3 fallback 시 .t3-fallback-hit.jsonl append — E3 의존)
- 신규: `hooks/tool/verifier.js` (E4 활성화 시 .verifier-missing.jsonl append — E4 의존)

**Uplift-commit**: 1 개월 누적 승격 DA ≥ 5 건. 시뮬레이션 1 일 기준 ≥ 3 건.

**롤백 경로**: 각 `enableSource.*` flag off → L12.4 단일 경로 복귀 (1 줄).

---

### 2.2 [즉시 편입] E3 — T2→T3 즉시 Fallback

**목표**: T2 키워드 매칭이 약할 때 (top score <0.3 OR top-K 공집합) 자동으로 T3 벡터 검색을 호출해 silent miss 를 loud miss 로 전환하고 E1 증거 공급원을 확보한다.

**Before**:
```
T2 Jaccard 매칭
   │
   ├─ top score ≥ threshold → hit
   └─ miss → 빈 결과 반환 (silent miss)

T3 는 별도 MCP tool 에서만 호출
```

**After**:
```
T2 Jaccard 매칭
   │
   ├─ top score ≥ 0.3 AND top-K 비어있지 않음 → 정상 hit
   │
   └─ 조건 미충족
        │
        ▼
      [T3 BGE-M3 호출]  embed_service:8787
        query embedding ↔ DA description embedding 코사인 유사도
        top-2 반환
        │
        ▼
      [결과 DA 컨텍스트 주입]
        │
        ▼
      [.t2-miss.jsonl 에 append]
        {ts, query, english_kw, fallback:"t3", hit_das:[top-2], session}
        │
        ▼
      [.t3-fallback-hit.jsonl 에 append]
        {ts, query, hit_das, session}
        → E1 증거원으로 소비
```

**Threshold 결정**:
- 초기값: 0.3
- 시뮬레이션 dry-run 에서 0.2 / 0.3 / 0.4 3 값 비교 → 15-dogfood hit rate 최대 값으로 확정
- 너무 낮으면 (0.2): T3 호출 남발 → latency 부담 + hit 결과 신뢰도 낮음
- 너무 높으면 (0.4): T3 호출 부족 → 기존과 차이 적음

**Latency 영향**:
- T2 hit (80%) 시: 기존과 동일 (<100ms)
- T2 miss (20%) 시: T3 호출 추가 → +500-1000ms
- 평균 영향: 20% × 800ms = +160ms 증가 (허용 범위)
- 사용자 체감: "매칭 실패 후 재쿼리" 비용 수초 > T3 자동 호출 1초

**부작용 효과**:
- Silent miss → Loud miss 전환: 현재 T2 실패 시 사용자가 "매칭 안 됨" 을 모르고 넘어감. T3 가 관련 DA 를 찾아 반환하면 명시적 이벤트 발생 → 증거 축적
- 사용자 재쿼리 횟수 감소 → UX 개선

**안전장치**:
- `enableT3Fallback` flag off → 기존 동작 복귀
- threshold 를 1.0 으로 상향 → fallback 사실상 off (1 줄)
- T3 호출 실패 시 graceful degrade (fallback 없이 원래 T2 결과 반환)

**구현 진입점**:
- 수정: `hooks/prompt/da-context.js` — T2 매칭 함수 말미에 fallback 분기 추가
- 재사용: `pipeline/lancedb-client.ts` — 기존 BGE-M3 호출 로직

**Uplift-commit**: T3 fallback 트리거 ≥ 10 건/월 AND 그중 E1 승격 기여 ≥ 1 건.

**롤백**: `threshold=1.0` 설정 (1 줄).

---

### 2.3 [구조 수정 편입] E4 — Verifier (enum-MVP)

**목표**: DA 주입 완료 후 Coder LLM 호출 직전에 경량 Verifier 가 충분성을 판정. 부족하면 추가 DA 를 즉시 로드해 실시간 품질 보장 + E1 증거원 공급.

**원안 (debate 에서 탈락)**:
```
schema: {is_sufficient: bool, missing_context: string}
missing_context: 자연어 (예: "frontmatter date 필드 규칙 필요")
```

**왜 원안 탈락했는가** — 한국어 agglutinative 파편화:
```
같은 개념의 3 가지 자연어 표현 (한국어 조사 변형):
  Obs 1: "frontmatter date 필드 필요"
  Obs 2: "YAML 헤더 date 누락 시 처리"
  Obs 3: "파일 생성 날짜 규칙"

정규화 수준 "조사 제거 + 경량 stemming" 적용 후 토큰 집합:
  Obs 1 → {frontmatter, date, 필드, 필요}
  Obs 2 → {YAML, 헤더, date, 누락, 처리}
  Obs 3 → {파일, 생성, 날짜, 규칙}

교집합 (공통 token) = {date}  ← 최대 1 개
N=3 누적 문턱 도달 불가 → 파편화 → 승격 0
```

**채택안 — enum-MVP**:

```
schema: {is_sufficient: bool, missing_da_ids: string[]}
missing_da_ids: 기존 DA ID 목록 중 enum 선택 (자연어 생성 없음)

구현 전제:
  - Anthropic SDK tool-use 또는 JSON schema-enforced mode 필수
  - 프롬프트 기반 JSON 은 80-95% 준수, schema-enforced 는 >99.5%
  - profile gating: auditor 만 우선 활성. coder/harness-worker 는 Future Activation
```

**동작 흐름**:
```
[T2/T3 매칭 결과 → DA 주입 완료]
        │
        ▼
[Verifier Haiku 호출]  Anthropic SDK schema-enforced mode
  입력:
    - query (원본 한국어)
    - 주입된 DA 의 summary 만 (body 전체 아닌 핵심 요약, 토큰 절약)
    - 가능한 missing_da_ids 후보 목록 (top-20 유사도 DA)
  출력:
    {is_sufficient: bool, missing_da_ids: string[]}
  latency: ~300-800ms (profile gated 세션만)
        │
        ├─ is_sufficient = true → 그대로 Coder LLM 진행
        │
        └─ is_sufficient = false
             │
             ├─ missing_da_ids 에 해당하는 DA 를 즉시 현 세션에 추가 주입
             │     (실시간 복구 — 학습 대기 불필요)
             │
             └─ [.verifier-missing.jsonl append]
                  {ts, query, original_korean, missing_da_ids, session}
                  → E1 삼중화 증거원 3 공급
```

**Profile Gating**:
- 초기 활성 프로파일: `auditor` (감사 wf 세션)
- 이유: 감사 wf 는 정밀도 중요 + Haiku 추가 호출 비용 허용 + 본 작업 외 다른 세션 영향 0
- Future Activation (§Future Gates):
  - `coder` — auditor 에서 JSON 준수율 ≥ 95% 검증 완료 시
  - `harness-worker` — coder 확장 후 안정 관찰 시
- 일반 대화 / lightweight-wf: 영구 비활성 (비용 대비 가치 낮음)

**JSON 준수율 보장**:
- **Anthropic SDK tool-use mode** 사용 (강제 구조)
  - 참고: `claude-api` skill 의 tool-use 패턴
  - schema 정의를 Claude SDK 의 `tools` 파라미터로 전달 → 출력 구조 강제
- 실패 시 fallback: `is_sufficient = true` 로 간주 (blocking 방지)
- JSON violation log → `docs/verifier-violations.log` (알림용)

**N 누적 (enum 덕분에 단순)**:
- DA ID 별 카운팅 (자연어 파편화 없음)
- N = 3 회 누적 시 해당 (원쿼리 token, DA) pair 를 L12.4 correlation 입력으로 공급

**구현 진입점**:
- 신규: `hooks/tool/verifier.js` (Haiku 호출 + JSON parse + missing_da_ids 처리)
- 신규: `config/verifier-prompt.txt` (시스템 프롬프트 + schema 정의)
- 수정: `hooks/prompt/da-context.js` (DA 주입 완료 후 verifier hook 호출)
- 수정: settings.json (`auditor` profile 에 verifier hook 등록)

**Uplift-commit**: JSON schema 준수율 ≥ 95% AND 승격 기여 ≥ 1 건/월.

**롤백**: profile gating 에서 auditor 제거 (1 줄) → Verifier 전체 off.

---

### 2.4 [구조 수정 편입] E6 — Chain Bundling Whitelist-first

**목표**: 특정 DA 쌍 (applies-with edge 기반) 을 번들로 묶어 한쪽 매칭 시 짝도 자동 동반 주입. Phase 3 Phase 진화 구조로 초기 수동 → 최종 자동 임계 기반.

**원안 (debate 에서 탈락)**:
```
Verifier signal 비율 ≥ 20% 관측 시 자동 활성화
```

**왜 원안 탈락했는가**:
- "20%" 근거 empirical/이론 없음 (Steelman §E6 도 placeholder 로 기재)
- E4 원안의 naked string 파편화가 E6 트리거 감지 불가능하게 만듦 (E4-enum-MVP 로 해결되지만 의존 체인 위험)

**채택안 — Whitelist-first 3 Phase**:

**Phase 1 (즉시 — 수동 Whitelist)**:
```
파일: config/t2-whitelist.json
형식:
  [
    {"a": "file-standards-frontmatter", "b": "file-standards-violation-3step"},
    {"a": "file-standards-folder-placement", "b": "pc-tools-inventory-on-demand-read"},
    {"a": "reliability-cwd-drift", "b": "reliability-registry-drift"},
    ...
  ]

동작:
  T2/T3 매칭 시 top-K 에 whitelist 쌍 일부가 포함되면
  → 나머지 짝도 자동 동반 주입 (단 token 예산 8k cap 내)

안전장치:
  - 최대 1-hop (다단 번들 금지)
  - Visited Set (순환 참조 차단)
  - 토큰 예산 8k 상한
  - 쌍 단위 활성화 (전역 토글 아님, 필요 쌍만)
```

**Whitelist 초기 seed 선정 기준** (Judge Action Item):
1. `applies-with` 링크 수 상위 (데이터 주도)
2. 감사 wf 에서 "쌍으로 함께 필요" 유의미 관찰된 쌍 (역사 주도)
3. 사용자가 자주 같이 Read 하는 MD 파일 pair (행동 주도)

3-5 쌍 선정 예시:
- `file-standards-frontmatter ↔ file-standards-violation-3step` (규칙 + 위반 처리)
- `file-standards-folder-placement ↔ pc-tools-inventory-on-demand-read` (위치 + 도구)
- `reliability-cwd-drift ↔ reliability-registry-drift` (드리프트 쌍)
- `harness-wf-fail-escalation-flow ↔ harness-wf-healer-fix-scope-rules` (실패 → 치유)
- `enhanced-coding-wf-guardian-keyword-match ↔ code-quality-replace-not-deprecate` (가디언 → 품질)

**Phase 2 (1-2 개월 — 관측 축적)**:
```
whitelist 쌍의 verifier signal (E4-enum-MVP) 관측 데이터 축적
- 해당 쌍이 실제로 함께 필요했던 사례 빈도
- 번들 주입 후 hit rate 개선 폭
- 토큰 예산 실소비
- 각 쌍별 bundling uplift (쌍 hit rate - singleton hit rate)

로깅: config/t2-whitelist-stats.jsonl
```

**Phase 3 (조건 충족 시 — 자동 임계 upgrade)**:
```
조건:
  - 관측 ≥ 20 건 (각 쌍별 실제 필요 관측 누적)
  - 임계 dry-run 데이터 충분 (verifier signal 비율 측정 가능)

자동 활성화 로직:
  새 쌍 X ↔ Y 에 대해
  "X 주입 시 Y 에 대한 verifier missing_da_ids 지목 빈도 ≥ N%"
  충족 시 자동으로 whitelist 등록 + 알림

여전히 안전장치 유지: 1-hop, visited set, token cap
```

**안전장치**:
- `enableChainBundling` flag off → whitelist 동반 주입 전체 off (1 줄)
- `config/t2-whitelist.json` 파일 삭제 → 모든 번들 해제
- 토큰 예산 8k cap 은 hard limit — 초과 시 우선순위 낮은 쌍 drop

**구현 진입점**:
- 신규: `config/t2-whitelist.json` (수동 관리 seed)
- 신규: `hooks/prompt/chain-bundling.js` (da-context.js 다음 단계)
- 수정: `pipeline/rebuild.ts` (Phase 2 통계 축적 훅 추가)

**Uplift-commit**: bundling 활성화 쌍의 hit rate ≥ 비활성 대비 +5%p (Phase 1 2 개월 관측 후).

**롤백**: `enableChainBundling=false` (1 줄).

---

### 2.5 [Deferred] E2 — Few-shot 자동 주입 (Hybrid)

**목표**: T2 Haiku 번역기 프롬프트에 최근 성공 매칭 pair 3-5 개를 inject 해 번역 정확도 상승. Cold start 3 주를 manual seed 로 구조적 해결.

**왜 Deferred 인가**:
- E2 는 L12.4 promote 결과물을 소비 → L12.4 가 충분한 데이터 생산해야 E2 작동
- L12.4 자체가 1-2 주 누적 필요 + E2 추가 7 일 window = 21-28 일 cold start
- 이 기간 ROI = 0 ⇒ manual seed 로 cold start 구간 해소 + 임계 충족 시 자동 활성

**Hybrid 3 Phase**:

**Phase 1 (Day 0 — Manual Seed)**:
```
파일: config/t2-fewshot-seed.json
형식:
  [
    {
      "korean": "grandfather 적용 안 해도 돼?",
      "english_keywords": ["grandfather", "frontmatter", "date", "Edit"],
      "target_da": "file-standards-frontmatter"
    },
    {
      "korean": "비서 self-match 오탐",
      "english_keywords": ["secretary", "self-match", "scrollback", "WORKING_RE"],
      "target_da": "secretary-self-echo-avoidance"
    },
    {
      "korean": "psmux 메시지 폭주",
      "english_keywords": ["psmux", "message", "flood", "pkill"],
      "target_da": "psmux-send-ssot-helper"
    }
  ]

Haiku 번역 프롬프트 헤더에 <example> 태그로 inject:
  <example>
  KO: "grandfather 적용 안 해도 돼?"
  EN: ["grandfather", "frontmatter", "date", "Edit"]
  </example>
  ... (3 pair)
  
번역 LLM 이 이 패턴 보고 "특이 단어" 를 영어 토큰으로 유지하는 경향 획득
```

**Phase 2 (Day 1-30 — Observation)**:
```
L12.4 가 miss log + Read correlation 으로 승격 데이터 축적
.t2-fewshot-seed.json 은 변함없이 주입 (manual)
승격된 pair 는 별도로 .t2-fewshot-auto.json 에 누적 (자동 생성)
  → 초기에는 0-3 건 수준
```

**Phase 3 (Day 30+ — 자동 활성화)**:
```
조건:
  L12.4 누적 promote ≥ 30 건 AND 고유 DA ≥ 10 개

활성화 시:
  .t2-fewshot-auto.json 에서 최근 7 일 promote 성공분 중 상위 5 건 자동 선별
  선별 기준 (우선순위):
    1. 서로 다른 target_da (다양성 — 특정 도메인 과적합 방지)
    2. cnt 빈도 (신뢰도)
    3. Jaccard 유사도 낮은 것끼리 (의미 분산)
  cap = 5 고정

Manual seed 는 auto 수확분에 덮어써짐:
  → auto ≥ 5 건 되면 seed 미사용
  → auto < 5 건이면 seed + auto 섞어서 5 건 맞춤
```

**매 rebuild 시 자동 재생성**: rebuild.ts post-hook 에서 `build-t2-fewshot.ts` 호출.

**안전장치**:
- `enableFewshot` flag off → 주입 전체 중단
- 5 건 cap 엄격 준수 (분수 선택 금지)
- Few-shot 소스는 **promote 성공분만** (미검증 miss 직접 inject 금지 → L12.2 재발 경로)
- manual seed 는 **삭제 불가**, 자동 수확분과 독립 관리

**구현 진입점**:
- 신규: `config/t2-fewshot-seed.json` (사용자 수동)
- 신규: `pipeline/build-t2-fewshot.ts` (Phase 3 자동화)
- 수정: `hooks/prompt/da-context.js` (Haiku 번역기 프롬프트 헤더에 inject)

**Uplift-commit**: 활성화 후 2 주 +2%p (manual seed phase 제외).

**롤백**: `enableFewshot=false` (1 줄).

---

### 2.6 [Trigger-gated 보류] E5 — Decay 연속 감쇠

**목표**: 오래 사용 안 된 DA 를 effective_score 에서 점진적으로 감점해 최근 활성 DA 가 우선 주입되도록. 미래 주입 공간 경쟁 발생 시 대비.

**왜 Trigger-gated 보류인가**:
- 현재 T2 80% plateau 원인은 "낡은 DA 끼어듦" 이 아니라 "키워드 공백"
- Decay 는 현재 pain 과 무관한 **premature optimization**
- 그러나 DA 수가 500+ 로 확장되면 필요해질 수 있어 자동 발동 경로만 보존

**Trigger 설계**:

```
기록: ~/.claude/.e5-trigger-log.jsonl
  매 세션 종료 시 append:
  {
    "session": "...",
    "ts": "...",
    "injected_das": ["DA-xxx", "DA-yyy", ...],
    "hit_das": ["DA-xxx", ...],       # 세션 중 실제 사용된 DA
    "hit_ratio": 0.xx,                # hit_das / injected_das
    "flagged": true|false             # hit_ratio ≤ 0.5
  }

세션 경계 정의:
  - compact 후 리셋 (같은 세션이어도 새 카운트)
  - WF 세션 (supervisor/worker/verifier/healer) 제외
  - 일반 대화 세션만 카운트

Trigger 판정:
  최근 3 세션 연속 flagged=true → E5-micro 자동 발동

기록 실패 안전장치:
  .e5-trigger-log.jsonl 쓰기 실패 시 E5 영구 보류
  (조용히 skip, 알림 없음 — 삭제/일회성 실패에 대한 최대 관대함)
```

**E5-micro Dry-run (Trigger 발동 시)**:
```
설계:
  τ 2 값 (30 일, 60 일) × hit rate 1 지표 × 1 반복 = 1-2 주

비교:
  τ=30: 빠른 감쇠, 활성 DA 중심
  τ=60: 느린 감쇠, 안정적 접근

결정: τ 최적값 확정 후 effective_score 공식 배포
```

**Decay 공식 (활성화 시)**:
```
effective_score(DA) = base_score - decay_penalty(age_days, τ)
  decay_penalty = 1 - exp(-age_days / τ)
  base_score = Jaccard(T2) 또는 cosine(T3) + 기타 boost
```

**안전장치**:
- `enableDecay` flag off → 기본 binary 동작 (flag 1 줄 롤백)
- `τ = ∞` 설정 시 decay_penalty = 0 (사실상 off)
- Trigger 조건 ("3 세션 연속 flagged") 엄격 적용 — 2/3 만 flagged 는 발동 안 함

**구현 진입점**:
- 신규: `hooks/session/e5-trigger-monitor.js` (세션 종료 시 .e5-trigger-log 기록)
- 신규: `pipeline/e5-trigger-check.ts` (3 세션 연속 판정)
- 수정: `pipeline/lancedb-client.ts` — effective_score 공식 (활성화 시)

**Uplift-commit**: τ fit 지표가 유의 범위 내 (Trigger 발동 시에만 평가).

**롤백**: `enableDecay=false` (1 줄) — 보류 상태 복귀.

---

## 3. Debate Verdict 요약 (Judge 판정)

**원본**: `docs/debate-verdict-2026-04-24.md`

**핵심 결정**:
- **Assembled Conclusion (§5.Synthesis)**: 6 확장 4 분류 최종 합의. 위 §2 전체에 반영됨.
- **Accepted Facts** 중 UNVERIFIED 1 건: [A2] E1 삼중화 1.5-2배 가속 추정치 — 시뮬레이션으로 검증 필요.
- **숨은 리스크 6 건** (§C):
  1. 1 인 사용자 통계 유의성 불가 (CRITICAL) → 정성 4 축 병행 (§6)
  2. E4 JSON 95% → Anthropic SDK tool-use/schema-enforced mode 필수
  3. E1 N 차등 (3/2/3/5) empirical 근거 없음 → 초기 배포 후 재조정 경로
  4. E3 threshold 0.3 dry-run 축 부재 → 시뮬레이션에서 0.2/0.3/0.4 비교
  5. A/B enable 순서 미명시 → E3→E1→E4→E6 (상류→하류)
  6. L12.2 6 원칙 2 리스트 정합성 감사 필요 → `docs/invariant-principles-unified.md`

**Tier 재매핑**: 4.5 → 5.0 (즉시) → 5.3 (Phase 1) → 2 개월 sunset 후 원복 검토.

**에이전트 단위 점수 비교 없음**: Argument-Level Synthesis 원칙 준수.

---

## 4. 해결책 R1-R5 — Judge 의 "불가" 판정을 행동 계획으로 전환

Judge Verdict §E (dry-run 이관 9 항목) 과 §C (숨은 리스크 6 건) 를 모두 구체 측정 가능한 행동 계획으로 편입. "못하겠습니다" 상태 0 건.

### R1 — E1 가속 추정치 검증 (A2 UNVERIFIED → 초기 배포 1 주 측정)

**문제**: Steelman §E1 의 "승격 DA 수 5-10 → 10-20" 1.5-2 배 가속 주장이 empirical 없음.

**해결**:
```
측정 메트릭:
  (a) 증거원별 일일 append 건수 (Read/T3/Verifier)
  (b) correlation script promote 건수 (N=3 통과)
  (c) 15-dogfood hit rate 7 일 이동 평균

측정 시점:
  E1 enable Day 1 ~ Day 7 (시뮬레이션 기준 Day 1 = 시뮬레이션 Step 3 후)

재판정 조건:
  Day 7 promote ≥ 3 건 AND hit rate ≥ baseline 유지 → 정상
  promote < 3 건 → N 차등 재조정 (Read within 3→2 완화)
  hit rate 하락 → 즉시 enable flag off (원칙 6)
```

### R2 — E3 fallback baseline (Day 1-7 Observation-only 모드)

**문제**: T3 호출 빈도 1 인 사용자 기준 월간 기대치 없음.

**해결**:
```
Phase 0 (Day 1-7):
  threshold 고정 0.3 + metric 수집만
  승격 파이프 비연결 (E1 증거원 feed 만, correlation 은 동작)

수집 metric:
  - T3 호출 월간 환산 건수
  - top-2 결과 DA 분포 (shape 분석)
  - T3-only 히트가 기존 T2 수동 키워드와 겹치는 비율
  - T3 hit 의 실제 사용 (주입 후 Coder LLM 이 인용했는지)

Day 8 판정:
  월간 환산 ≥ 10 건 → threshold 0.3 유지
  < 10 건 → threshold 0.4 상향 후 재측정 1 주
  > 100 건 (과호출) → threshold 0.2 하향 또는 T3 cap 축소
```

### R3 — §E 9 항목 dry-run 이관 테이블 (명시 측정 계획)

**문제**: Judge §E "dry-run 이관 9 항목" 이 추상 라벨로 끝날 위험.

**해결**:
```
항목별 (측정 시점 / 메트릭 / 재판정 조건) 3 필드 고정:

항목                         시점       메트릭                       재판정 조건
─────────────────────────────────────────────────────────────────────────────────
E1 가속 (R1)                 Day 7     promote+hit rate             ≥3건 AND 저하 없음
Tier sunset 판정             Day 60    hit rate + 정성 4축          정량 ≥+3%p OR 정성 2/4+
E3 baseline (R2)             Day 7     T3 호출 빈도                  ≥10건/월 환산
E4 JSON 준수율               Day 7     schema compliance %          ≥95% (SDK mode)
E1 N 차등 empirical          Day 14    증거원별 promote 분포         편중 ≤60%
E5 τ (발동 시)               Day 14    hit rate 2값 비교            유의 차이 ≥+1%p
E6 Phase 3 임계              Day 60    whitelist bundling uplift    쌍당 평균 ≥+5%p
coder profile 확장           Day 14    auditor JSON ≥80% 검증 완료  검증 PASS
SDK schema-enforced 실측     Day 7     violation rate               <1%

저장 위치: docs/dry-run-measurement-plan.md
```

### R4 — §C.1 1 인 사용자 통계 유의성 → 정성 4 축 루브릭

**문제**: uplift-commit 수치가 1 인 환경에서 noise 와 구별 불가.

**해결**:
```
정성 평가 4 축 (정량과 AND 조건):

1. 사용자 불만 로그
   audit-log/*.jsonl 에 type="user_complaint" 이벤트 추가
   주간 집계
   주당 ≤ 2 건 = 정상, ≥ 5 건 = 미달

2. 승격 DA 실사용 추적
   auto-keywords 로 승격된 DA 가 14 일 window 내 실제 T2 hit 비율
   ≥ 50% = 정당한 승격
   < 30% = noise 가능

3. 감사 wf 유의미 관찰
   감사 wf 결과 "이 확장 덕에 발견된 문제" 로 태깅된 건수
   월 ≥ 1 건 = 정상

4. Noise 대조
   비활성 세션 (lightweight-wf) 의 동일 기간 hit rate 변동과 비교
   절대 변동 ≤ 2%p 면 noise level 허용

Sunset 판정 (2 개월):
  rollback 조건 = (정량 hit rate < +3%p) AND (정성 4 축 중 2 축+ 미달)
  둘 다 충족해야 rollback. 하나만은 회색 지대 유지.

저장: docs/qualitative-metrics-rubric.md
```

### R5 — E5 Trigger 측정 메트릭 + 기록 위치 (불가 상태 제거)

**문제**: E5 trigger 조건 "3 세션 연속 hit_ratio ≤0.5" 가 측정 메커니즘 없으면 영원히 발동 안 함.

**해결**:
```
구체 구현:
  1. 세션 종료 hook: ~/.claude/hooks/session/e5-trigger-monitor.js
  2. 기록: ~/.claude/.e5-trigger-log.jsonl
  3. 형식: 위 §2.6 Trigger 설계 블록 참조
  4. 판정 batch: rebuild.ts post-hook 이 실행 시 최근 3 세션 체크
  5. flagged=true 3 세션 연속 감지 시 ~/.claude/.e5-activation-proposed 파일 생성
  6. 사용자에게 "E5-micro dry-run 실행 승인" 프롬프트 주입
  7. 승인 시 E5-micro 자동 시작

안전장치:
  .e5-trigger-log.jsonl 쓰기 실패 시 → 조용히 skip, 보류 유지
  false positive 방지: 3 세션 중 1 세션이라도 flagged=false 면 누적 리셋
```

---

## 5. 시뮬레이션 Dry-run 설계 (1 일 내 측정)

**원 설계**: 각 확장 enable 후 1-2 주 실측 → 본 설계의 원 가정은 3-6 주 누적.

**실제 실행**: Agent 시뮬레이션으로 1 일 내 핵심 검증 완료. 사용자가 완성 경험 즉시 수령.

### 5.1 4 단계 설계

**Step 1 — 쿼리 확장 (1-2 시간)**:
```
Input:
  .simulation-data/queries-initial.jsonl (60 건 seed)

Process:
  Opus Agent 에게 "각 seed query 에 대해 조사 변형 · 오타 · 구어체 · 영어 혼재 5 개 추가 생성"
  total 300 query 세트 구축

Output:
  .simulation-data/queries-expanded.jsonl
```

**Step 2 — 자동 매칭 실행 (2-3 시간)**:
```
Input:
  .simulation-data/das/*.yaml (51 DA) 를 pipeline/build-t2-keyword-index.ts 로 인덱싱
  .simulation-data/queries-expanded.jsonl

Process (query 당):
  1. hooks/prompt/da-context.js 의 T2 매칭 로직 호출
  2. T2 성공 → 결과 기록
  3. T2 실패 → E3 fallback 활성 시 T3 호출, 결과 기록
  4. E4 auditor 프로파일 활성 시 Verifier 호출, missing_da_ids 로깅
  5. "Agent 가 관련 MD Read" 가상 수행 (query 의 target_da 알고 있으므로 해당 DA 의 sources.canonical MD 를 Read)

Output:
  .simulation-data/simulation-run-{timestamp}/
    ├── matching-log.jsonl
    ├── t2-miss.jsonl (진짜 miss)
    ├── t3-fallback-hit.jsonl (E3 활성)
    ├── verifier-missing.jsonl (E4 활성)
    └── virtual-read-events.jsonl (Agent 가상 Read)
```

**Step 3 — 증거 축적 + 승격 실행 (30 분)**:
```
Input:
  simulation-run-{timestamp}/ 의 모든 로그

Process:
  build-auto-learn-promote.ts 실행 (correlation)
  DF 상한 + N 차등 적용
  auto-keywords 승격 계산

Output:
  .simulation-data/das/*.yaml 의 auto-keywords 필드 업데이트
  .t2-keyword-index.json 재생성
  promote-report-{timestamp}.md
```

**Step 4 — 판정 (30 분)**:
```
Input:
  .simulation-data/queries-initial.jsonl 중 15 개 (기존 15-dogfood)
  promote 완료된 인덱스

Process:
  15 개 query 재실행 → hit rate 측정
  확장별 uplift-commit 수치 (§R3) 체크
  미달 시:
    - E1 N 차등 재조정 (Read within 3→2 완화)
    - E3 threshold 재조정 (0.3→0.2 하향)
    - Step 2 재실행 (증거 재생성)

Output:
  simulation-verdict-{timestamp}.md
  GO/NO-GO 판정
```

**총 소요 1 일 미만**.

### 5.2 시뮬레이션 vs 실측 차이 처리

- 시뮬레이션 측정치가 좋아도 (예: +15%p) 실측 보장 아님
- 실제 배포 후 2 주 추가 모니터링 필수
- 정성 4 축 (§R4) 은 시뮬레이션에서 불완전 (사용자 불만 재현 불가) → 실사용 필수
- **Sunset 판정은 실사용 2 개월 기준 유지** (시뮬레이션 대체 불가)

### 5.3 ULTRA PLAN Agent 실행 Checklist

ULTRA PLAN 이 본 repo clone 후 실행 순서:

```
Phase 0 (Setup):
  [ ] .simulation-data/ 무결성 확인 (51 DA / 60 query / sanitize 확인)
  [ ] pipeline/build-t2-keyword-index.ts 로 인덱스 생성
  [ ] embed_service.py 구동 (포트 8787) — T3 fallback 테스트용

Phase 1 (즉시 편입):
  [ ] E3 구현 (hooks/prompt/da-context.js)
  [ ] E1 구현 (pipeline/build-auto-learn-promote.ts + 관련 hooks)
  [ ] 시뮬레이션 Step 1-4 실행
  [ ] uplift-commit (R1/R2) 달성 확인

Phase 2 (구조 수정 편입):
  [ ] E4-enum-MVP 구현 (hooks/tool/verifier.js)
  [ ] Anthropic SDK schema-enforced mode 적용 확인
  [ ] E6-whitelist-first Phase 1 구현 (hooks/prompt/chain-bundling.js)
  [ ] 시뮬레이션 재실행

Phase 3 (deferred/trigger-gated 준비):
  [ ] E2 manual seed (config/t2-fewshot-seed.json) 초기 3 pair 사용자 입력
  [ ] E5 trigger monitor (hooks/session/e5-trigger-monitor.js) 배포

Phase 4 (운영 준비):
  [ ] Future Activation Gate 모니터링 (§8)
  [ ] 정성 4 축 루브릭 배포 (docs/qualitative-metrics-rubric.md)
  [ ] Tier sunset 2 개월 판정 프로토콜 (docs/sunset-clause-protocol.md)
```

---

## 6. A/B Enable 순서 (Judge 권고)

**동시 편입 반려 이유** (Verdict §Conflict A1 vs B1):
- E2→L12.4, E6→E4, E4→E1 의존성 DAG
- 동시 편입 시 ROI attribution 불가 → 어느 확장이 uplift 기여했는지 분해 불가
- Tier 팽창 선지불 + 정당화 후지불 비대칭

**권고 순서 — 상류 → 하류**:

```
Day 0:  E3 enable (T2→T3 fallback)
          ├─ 상류 확장, 즉각적 사용자 경험 개선
          └─ E1 을 위한 증거원 2 (t3-fallback-hit) 공급 개시

Day 7:  E1 enable (증거원 삼중화)
          ├─ E3 가 7 일간 증거 공급 완료 후 삼중화 활성
          └─ E4 를 위한 증거원 3 (verifier-missing) 수집 준비

Day 14: E4-enum-MVP enable (auditor only)
          ├─ E1 이 Read + T3 로 운영 중 Verifier 추가
          ├─ Anthropic SDK schema-enforced mode 배포
          └─ E4 의 missing_da_ids 가 E1 증거원 3 으로 feed

Day 21: E6-whitelist-first Phase 1 enable
          ├─ E4 운영 데이터 1 주 확보 후 whitelist 3-5 쌍 배포
          └─ Phase 2 관측 시작 (1-2 개월 후 Phase 3 upgrade 판정)
```

**각 Enable 단계에서**:
- 시뮬레이션 또는 실사용 1 주 관측
- 15-dogfood + 정성 4 축 측정
- R3 uplift-commit 수치 달성 확인
- 미달 시 해당 enable 단독 off (다른 확장 영향 없음 — 불변 원칙 5)

**E2 / E5 는 위 시퀀스 무관**:
- E2: Day 0 manual seed 사용자 수동 입력 가능 (Phase 1 즉시 활성). 자동 활성화 (Phase 3) 는 조건 충족 시 무관
- E5: 트리거 조건 충족 시만 발동. 평소 비활성 유지

---

## 7. 판정 메트릭 — 정량 + 정성 병행

**1 인 사용자 통계 유의성 불가** (Gemini 리서치, Judge §F5.4):
- 15-dogfood 기준 1-3 query 차이 범주 = 무작위 noise 와 구별 불가
- 수치만으로 자동 롤백 금지 → 정성 4 축 (§R4) 병행 필수

**정량 지표**:
- 15-dogfood hit rate (기존 축, baseline 80%)
- 확장별 uplift-commit 수치 (§R3)
- Latency (T2 평균 <100ms 유지 확인)
- Promote 건수 / 일 / DA 별

**정성 4 축** (§R4 루브릭):
1. 사용자 불만 로그 (user_complaint 이벤트)
2. 승격 DA 실사용 추적 (14 일 window)
3. 감사 wf 유의미 관찰 (월간 태그)
4. Noise 대조 (비활성 세션과 비교)

**Sunset 판정 공식** (2 개월 후):
```
rollback_trigger = (hit rate 증가 < +3%p) AND (정성 4 축 중 2/4+ 미달)

→ 두 조건 모두 충족: Tier 2 원복 검토 착수
→ 하나만: 회색 지대 유지 (추가 1 개월 관찰)
→ 둘 다 충족 실패 (정상): 지속 운영
```

---

## 8. Future Activation Gates (세션 종료 후 자동 모니터링)

본 plan 의 **현재 비활성** 확장이 **조건 충족 시 자동 또는 사용자 알림 기반 활성화** 되는 경로. ULTRA PLAN 이 이 조건을 모니터링하는 hook 을 배포해야 한다.

| 항목 | 현재 상태 | 활성화 조건 | 알림 경로 |
|---|---|---|---|
| E2 Phase 2 자동 few-shot | Manual seed | L12.4 누적 promote ≥ 30 건 AND 고유 DA ≥ 10 개 | `~/.claude/.e2-activation-proposed` 생성 + 사용자 알림 |
| E4 coder profile 확장 | auditor only | auditor 에서 JSON 준수율 ≥ 95% × 2 주 | `~/.claude/.e4-coder-ready` 생성 |
| E4 harness-worker 확장 | auditor only | coder 확장 후 안정 관찰 4 주 | `~/.claude/.e4-harness-ready` 생성 |
| E5 Decay 활성화 | 보류 | `.e5-trigger-log` hit_ratio ≤ 0.5 × 3 세션 연속 | `~/.claude/.e5-activation-proposed` 생성 |
| E6 Phase 3 임계 자동화 | Whitelist 수동 | whitelist 쌍 관측 1-2 개월 + 임계 dry-run 데이터 ≥ 20 건 | `~/.claude/.e6-phase3-ready` 생성 |
| SDK schema-enforced mode | 미확정 | E4 활성화 시 즉시 | 구현 체크리스트 |

**구현 배포 필수**:
- `hooks/session/e5-trigger-monitor.js` — 세션 종료 시 .e5-trigger-log 기록 (§R5)
- `pipeline/future-activation-check.ts` — rebuild post-hook 에서 조건 판정
- `hooks/session/future-activation-notify.js` — 조건 충족 시 사용자 알림 파일 생성

**사용자 역할**:
- `~/.claude/.e*-proposed` 파일 생성 시 수동 승인 후 Phase 2/3 착수
- 승인 시 해당 확장 enable flag on + plan.md 해당 Phase 체크리스트 실행

---

## 9. 미결 Action Items (Judge Action Items + 추가)

Judge Verdict 의 8 건 + 추가 2 건 = 10 건. ULTRA PLAN 이 진행 중 issue 로 tracking.

1. [ ] **E4-enum-MVP 구현 spec 에 Anthropic SDK tool-use 또는 JSON schema-enforced mode 명시** → `docs/verifier-implementation-spec.md`
2. [ ] **Uplift-commit 재정의 문서 작성** — "정량 threshold 아님 + 최소 50-100 query 후 평가 + 정성 병행" → `docs/uplift-commit-interpretation.md`
3. [ ] **E6-whitelist-first Phase 1 초기 3-5 쌍 선정** (사용자와 합의) → `config/t2-whitelist.json` 초안
4. [ ] **E5 trigger 세션 경계 규칙 명시** (§2.6 참조) → `docs/e5-trigger-protocol.md`
5. [ ] **A/B enable 순서 고정** — §6 문서화 완료 → 본 plan §6 에 반영됨
6. [ ] **L12.2 불변 원칙 2 리스트 정합성 감사** → `docs/invariant-principles-unified.md`
7. [ ] **Dry-run 이관 9 항목 plan §4 R3 에 명문화** → 본 plan §4 R3 에 완료
8. [ ] **Tier sunset 2 개월 판정 프로토콜** → `docs/sunset-clause-protocol.md`
9. [ ] **시뮬레이션 쿼리 확장** — `queries-initial.jsonl` 60 건을 Opus 확장으로 300 건으로 → Phase 0 Setup 에 포함
10. [ ] **Future Activation Gates 모니터링 hook 배포** — §8 참조 → `hooks/session/e5-trigger-monitor.js` 외 3 개 hook

---

## 10. Out of Scope (본 plan 범위 밖)

- 전체 DA 시스템의 4-state 생명주기 (active/dormant/archived/deprecated) — 원본 plan-da-lifecycle.md §L1-L10 유지
- Projection Tier (minimal/standard/rich) 구현 — 원본 §L4, L5
- Profile (agent × domain × mode) 매핑 — 원본 §L6
- Role Weighting (T2 score 에 agent role × DA role-scope boost) — 원본 §L9
- Cross-project DA 공유 — 별도 plan
- DA 양방향 drift audit — Phase G (이미 운영 중)
- LanceDB / BGE-M3 인프라 변경 — 변경 없음

---

## 11. Risks (잔존)

| # | Risk | Mitigation |
|---|---|---|
| R-01 | 시뮬레이션 쿼리 품질이 실사용 대비 편향 | Phase 0 에서 Opus 확장으로 다양성 보완 + 실사용 2 주 추가 모니터링 |
| R-02 | 1 인 통계 유의성 불가 → 잘못된 rollback | 정성 4 축 병행 + AND 조건 |
| R-03 | E4 JSON 준수율 SDK 미사용 시 80% 하한 | 구현 spec 에 SDK mode 강제, 미준수 시 구현 반려 |
| R-04 | E6 Whitelist 수동 관리 부담 누적 (DA 증가) | Phase 3 자동 upgrade 로 전환 예정 |
| R-05 | E2 manual seed 품질 편향 (사용자 개인 관점) | 자동 수확분이 seed 를 대체 (Day 30+) |
| R-06 | E5 Trigger 조건 영원히 충족 안 됨 | 정상 — 현재 pain 과 무관하므로 보류 상태 유지가 정답 |
| R-07 | Future Activation Gate hook 미배포 → 조건 충족해도 알림 없음 | Action Item 10 우선순위 상향 |
| R-08 | Anthropic API 비용 증가 (Verifier profile 확장 시) | coder/harness-worker 확장은 auditor 성공 후만 단계 진행 |

---

## 12. Quick Start for ULTRA PLAN Agent

본 plan 을 읽은 agent 가 바로 실행할 수 있도록:

```
Step 1: 본 plan.md + CLAUDE.md 전체 Read
Step 2: docs/debate-verdict-2026-04-24.md 확인 (핵심 결정 배경)
Step 3: .simulation-data/ 무결성 확인
        → 51 DA / 60 query / logs 존재 확인
        → sanitize 검증 (grep -rE "jsh86|jsh8603" 0 hits 제외 스크립트 자체)
Step 4: 불변 원칙 6 개 (§1.4) 숙지 — 위반 금지
Step 5: A/B Enable 순서 (§6) 에 따라 E3 부터 구현
Step 6: 각 확장 구현 완료 시 시뮬레이션 Step 1-4 (§5) 수행
Step 7: uplift-commit (§R3) 달성 확인 후 다음 확장 진행
Step 8: Action Items 10 건 (§9) 을 issue tracking
Step 9: Future Activation Gate hook 배포 (§8)
```

**금기 사항** (위반 시 즉시 rollback):
- LLM 에게 DA body 보고 키워드 생성 요청 (L12.2 재발)
- manual `trigger.keywords` 필드 수정
- 주기적 cron/nightly 신규 도입
- 자동 기능을 flag 없이 배포
- 확장 동시 편입 (A/B 순서 위반)

---

## 참조

- `docs/debate-verdict-2026-04-24.md` — Clean Room Judge 원문
- `docs/debate-R1-steelman-2026-04-24.md` — 제안자 방어 논리
- `docs/debate-R1-attack-2026-04-24.md` — 공격 논리 (한국어 파편화 실증 등)
- `docs/debate-R1-rebuttal-2026-04-24.md` — 방어자 concede/compromise 판정
- `docs/debate-research-findings-2026-04-24.md` — Gemini 외부 empirical 리서치
- `docs/debate-keypoints-2026-04-24.md` — 진행 중 쟁점 누적 기록
- `.simulation-data/README.md` — 로컬 샘플 데이터 세트
- 원본 SSOT: `D:/projects/Obsidian/plan-da-lifecycle.md` §L12 블록
