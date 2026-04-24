# PROJECT DA — T2 한국어 매칭률 개선 (ULTRA PLAN 대상)

이 repo 는 **DA (Decision Asset) 시스템의 T2 매칭률을 80% plateau → 90%+** 로 끌어올리는 작업에 집중한다.
ULTRA PLAN 이 본 CLAUDE.md + `plan.md` 만 읽고도 실제 구현에 필요한 맥락을 확보할 수 있도록 자기완결성을 유지한다.
전체 DA 시스템의 설계 철학 / 4-state 생명주기 / Projection Tier / Profile / Role Weighting 등은 본 작업 범위 밖이며, 관련 논의는 원본 환경 (`~/.claude/` + `D:/projects/Obsidian/plan-da-lifecycle.md`) 에 보존된다.

---

## 0. 핵심 목표 (한 줄)

**6 개 확장안을 Agent 시뮬레이션 dry-run (1 일 내) 으로 검증 후 편입**. L12.2 파탄 (hit rate 0% 사건) 재발 없이 매칭률을 끌어올리며, 사용자가 완성된 경험을 즉시 받을 수 있도록 실행 기간을 1-2 주 → 1 일로 압축한다.

## 1. 이 프로젝트에서 이해해야 하는 최소 맥락

본 CLAUDE.md 작성 Agent (Opus) 가 실제 debate verdict 를 거쳐 이해한 범위만 기재한다. 전체 DA 시스템 숙지 요구하지 않는다.

### 1.1 T2 매칭 파이프라인 (개선 대상)

현재 파이프라인:

```
[사용자 한국어 프롬프트]
      │
      ▼
[Haiku 번역기] — 영어 토큰 후보 추출 (~300-1100 ms)
      │
      ▼
[T2 키워드 매칭] — 300 DA 사전과 Jaccard 매칭 (< 100 ms 목표)
      │  top score 기반 상위 5 개 DA 선택
      ▼
[Opus 컨텍스트 주입] — 선택된 DA 를 프롬프트에 앞에 붙임
      │
      ▼
[Opus 답변 생성]
```

T2 hit rate 가 80% 에서 정체. 20% 실패 중 대표 원인은 **DA 사전의 키워드 공백**.

구체 예시:
- 사용자 질문: "grandfather 적용 안 해도 돼?"
- file-standards-frontmatter DA 가 정답이지만, 이 DA 의 `trigger.keywords` 에 `grandfather` 단어가 없다
- Haiku 가 "grandfather" 로 번역해도 DA 키워드 사전에 없어서 Jaccard = 0 → 매칭 실패
- 현재 시스템은 여기서 끝. 사용자가 직접 file-standards.md 를 열어봐야 사후 학습 가능

### 1.2 과거 실패 복기 — L12.2 파탄 (2026-04-24)

**시도**: 가벼운 LLM 에게 DA body 전체 (YAML + 설명문) 를 주고 "이 규칙에 매칭될 영어 키워드를 생성하라" 요청. 303 개 DA 전체에 auto-keywords 필드를 일괄 주입.

**결과**: 15-dogfood 측정에서 hit rate 80% → 0% 로 파탄.

**원인 메커니즘 (반드시 복기)**:

1. LLM 은 DA body 만 보면 **"안전하고 보편적인 단어"** 로 수렴하려는 훈련 편향이 있다
2. 결과적으로 "session", "workflow", "rule", "check", "config" 같은 **제네릭 토큰이 50 개 이상 DA 에 공통으로** 생성됨
3. Jaccard 매칭 시 사용자 쿼리가 이 제네릭 토큰 1 개만 포함해도 50+ DA 가 동점 hit
4. 정답 DA 의 **특이 토큰 (grandfather 등) 이 제네릭 바다에 묻혀** top-K 밖으로 밀림
5. hit rate 붕괴

**롤백**: `build-t2-keyword-index.ts` 에서 auto-keywords 필드를 인덱스 제외 1 줄 수정. 기존 manual `trigger.keywords` 1790 개만 index 재구축. 3/3 smoke PASS 로 80% 복귀.

**교훈**: LLM 이 DA body 에서 "상상한" 키워드 ≠ 실제 사용자 query 변형. 두 공간이 괴리.

### 1.3 불변 원칙 6 개 (위반 시 즉시 롤백 트리거)

본 plan 의 모든 확장은 이 원칙 위에 얹혀야 한다. 하나라도 우회 경로가 발견되면 해당 확장은 편입 반려.

1. **증거 없는 확장 금지** — LLM 이 상상한 결과는 auto-keywords 에 들어갈 수 없음. 반드시 관측 이벤트 (사용자 Read · T3 벡터 hit · Verifier 판정) 증거가 있어야 함
2. **DF 상한** — 1 개 token 이 15 개 DA 초과에서 매칭되면 generic 으로 간주해 자동 제외
3. **N 회 누적** — 단일 관측으로 승격 금지. 최소 N 회 (증거원별 차등) 관측 후 승격
4. **Manual keyword 불가침** — DA yaml 의 `trigger.keywords` 필드는 사람이 수동으로 적은 것으로, 자동화가 절대 수정/삭제 안 함. Auto 승격분은 별도 `auto-keywords` 필드에만 쓰기
5. **롤백 1 줄 보장** — 모든 자동 기능은 flag 또는 threshold 1 줄 수정으로 완전 비활성화 가능해야 함. enable flag 독립 유지
6. **15-dogfood hit rate 10%p 감소 시 즉시 롤백** — 어떤 변경이든 측정 지표가 -10%p 이상 하락하면 enable flag off 로 자동 복구

### 1.4 기 확정 복구안 (L12.4 Auto-Learn, debate 대상 아님)

본 작업은 이 복구안을 **토대로만** 삼는다. 복구안 자체는 재논의 안 함.

**동작 흐름**:

```
[사용자 query] → [T2 매칭 실패]
                        │
                        ▼
                [.t2-miss.jsonl 에 기록]  ← {ts, query, english_kw, session}
                        │
                        │ 같은 세션 내 60 초 내
                        ▼
              [read-logger.js audit-log]  ← {ts, type:"file_read", file_path}
                        │
                        ▼
[build-auto-learn-promote.ts — correlation script]
  1. miss 이후 60 초 내 같은 session Read 탐지
  2. query token ∩ MD token = 교집합 추출 (token length ≥3)
  3. MD path → DA ID 역참조 (DA yaml sources.canonical 로)
  4. 같은 (DA, token) pair 가 N=3 회+ 관측 → auto-keywords 승격
  5. DF 상한 ≤15 필터 + manual Levenshtein ≤2 중복 제외
                        │
                        ▼
[DA yaml 의 auto-keywords 필드에 append]
                        │
                        ▼
[rebuild.ts post-hook → .t2-keyword-index.json 재생성]
                        │
                        ▼
[다음 동일 쿼리는 T2 에서 즉시 매칭]
```

### 1.5 보유 인프라 (본 작업 범위 밖, 그대로 사용)

- **LanceDB + BGE-M3 다국어 임베딩** — T3 벡터 fallback 경로. BGE-M3 는 `embed_service.py` FastAPI (포트 8787) 로 구동 중
- **Node.js post-hook 이벤트 기반 rebuild** — DA 파일 Write/Edit 시 `rebuild.ts` 자동 실행. 신규 cron/nightly 금지 철학
- **psmux 세션 오케스트레이션** — Agent 병렬 실행 (debate / harness-wf / 시뮬레이션)
- **MCP server** (`mcp_server.ts`) — searchDA tool 제공

### 1.6 작업 제약 (절대 조건)

- 단일 사용자 (1 인 규모) — 통계 유의성 확보 거의 불가, 정성 평가 비중 높음
- 로컬 처리 우선 — 외부 서비스 의존 최소 (Gemini 리서치는 예외적 1회용)
- 유지보수 0 — 주기적 cron/nightly 신규 도입 금지. 모든 자동화는 이벤트 기반 (rebuild post-hook · tool call · 사용자 행동)
- 한국어 쿼리 중심 — 영어 쿼리는 보조. 한국어 agglutinative 특성 (조사·어미 변형) 이 설계 전반에 영향

---

## 2. 6 확장안 4 분류 상세

### 2.1 즉시 편입 2 건

#### E1 — 증거원 삼중화 (Evidence Source Triangulation)

**개요**: L12.4 Auto-Learn 의 Read 이벤트 단일 증거원을 3 증거원으로 확장한다.

**Before (L12.4 단일 경로)**:
```
Read 이벤트만 증거로 수집 → 같은 (DA, token) 3 회 관측 → 승격
```

**After (E1 삼중화)**:
```
증거원 1. Read 이벤트         → .t2-miss.jsonl  (기존 유지)
증거원 2. T3 벡터 fallback hit → .t3-fallback-hit.jsonl  (E3 가 append)
증거원 3. Verifier missing     → .verifier-missing.jsonl (E4 가 append)
              │
              ▼
[correlation script]
  evidence_source 필드로 증거원 구분
  증거원별 N 차등 적용:
    Read within-session = 3
    Read across-session = 2
    Verifier           = 3
    Vector             = 5
              │
              ▼
[DA yaml auto-keywords 승격]
```

**스키마 변경**: `.t2-miss.jsonl` 엔트리에 `original_korean_query` 필드 추가 — 추후 Few-shot seed (E2) 소스 + 한국어 토큰 확장 진단용.

**안전장치**:
- DF 상한 ≤15 (L12.2 방지)
- manual keyword Levenshtein ≤2 제외
- 증거원별 enable flag 독립 (`enableSource.{read, t3, verifier}`)
- 승격 keyword 가 특정 증거원 80% 이상 편중 시 warning (single-source collapse 조기 탐지)

**기대 효과**: 사용자가 MD 를 안 열어도 벡터/Verifier 가 학습 신호 공급 → 승격 속도 1.5-2배 예상 (empirical 미검증, 시뮬레이션에서 확인).

**롤백 경로**: 증거원별 flag 독립 → 특정 증거원만 off 가능. 전체 off 시 L12.4 단일 경로로 복귀.

#### E3 — T2→T3 즉시 Fallback

**개요**: T2 키워드 매칭이 약할 때 자동으로 T3 벡터 검색을 호출한다.

**Before**: T2 miss 는 그냥 빈 결과 반환. T3 는 별도 MCP tool 호출에서만 사용.

**After**:
```
T2 Jaccard 매칭
  │
  ├─ top score ≥ 0.3 AND top-K 비어있지 않음 → 정상 hit
  │
  └─ 미충족
       │ 즉시 fallback
       ▼
     [T3 BGE-M3 호출] — query embedding ↔ DA description embedding 코사인
       │ top-2 반환
       ▼
     [결과 DA 컨텍스트 주입]
       │
       ▼
     [.t2-miss.jsonl 에 append: {fallback:"t3", hit_das:[...]}]
       │
       ▼
     [E1 correlation 이 증거원으로 소비]
```

**Threshold**: `0.3` 초기값. 시뮬레이션 dry-run 에서 0.2/0.3/0.4 3 값 비교 후 확정.

**Latency 영향**: T2 는 평균 <100 ms 유지 (매칭 성공 시 T3 호출 없음). T2 miss 시 (약 20%) T3 추가 호출 ~500-1000 ms. 이는 기존 "매칭 실패 후 사용자 재쿼리" 비용보다 훨씬 낮음.

**부작용 효과**: 현재 silent miss (T2 실패 후 아무것도 안 보임) 가 loud miss (T3 가 뭔가 찾아서 반환 + 로그) 로 전환 → 학습 증거 가시화.

**롤백**: threshold 를 1.0 으로 상향 → fallback 사실상 off.

### 2.2 구조 수정 편입 2 건

#### E4 — Verifier (enum-MVP 형태)

**개요**: DA 주입 완료 후 Coder LLM 호출 직전에 경량 Verifier 가 충분성을 판정한다. 부족하면 추가 DA 로드.

**원안 (debate 에서 탈락)**: `{is_sufficient: bool, missing_context: string}` — 자연어 missing_context. 한국어 파편화로 폐기.

**채택안 — enum-MVP**:
```
DA 주입 완료
      │
      ▼
[Verifier Haiku 호출]
  입력: query + 주입된 DA 의 summary (body 전체 아닌 요약)
  출력: {is_sufficient: bool, missing_da_ids: string[]}
  missing_da_ids = 기존 DA ID 목록에서 enum 선택
      │
      ├─ is_sufficient = true → 그대로 Coder LLM 진행
      │
      └─ is_sufficient = false
           │
           ├─ missing_da_ids 에 해당하는 DA 를 강제 추가 로드
           ├─ .verifier-missing.jsonl 에 append: {query, missing_da_ids, session}
           └─ E1 correlation 이 증거원으로 소비
```

**왜 enum 인가**:
- 자연어 missing_context 는 한국어 조사 변형 (예: "frontmatter date 필드 필요" / "YAML 헤더 date 누락" / "파일 생성 날짜 규칙") 으로 같은 의미가 다른 문자열 3 개로 파편화 → N=3 누적 불가
- enum 은 기존 DA ID 를 고르는 분류 문제 → 파편화 구조적 불가 + JSON schema 엄격 준수 가능

**JSON 준수율 요구**: **Anthropic SDK tool-use 또는 schema-enforced JSON mode 필수** (프롬프트 기반은 80-95%, SDK mode 는 >99.5%). 구현 spec 에 명시 필요.

**Profile gating**: 처음에는 `auditor` 세션에서만 활성화. 비용 부담 완화 + JSON 준수율 실측. 성공하면 `coder` / `harness-worker` 로 단계 확장.

**실시간 복구**: missing_da_ids 에 지목된 DA 를 **즉시 현 세션에 추가 로드** → 사용자는 학습 완료까지 기다릴 필요 없이 당장 품질 개선된 답변 받음.

**롤백**: profile gating 에서 auditor 제거 → 전체 off.

#### E6 — Chain Bundling Whitelist-first

**개요**: 특정 DA 쌍을 번들로 묶어 한쪽 매칭 시 짝도 자동 동반 주입한다.

**원안 (debate 에서 탈락)**: "Verifier signal 비율 ≥20% 관측 시 자동 활성화" — 20% 근거 없음 + E4 파편화 전염으로 폐기.

**채택안 — Whitelist-first 3 Phase**:

**Phase 1 (즉시 — 수동 Whitelist)**:
```
사용자가 applies-with 쌍 3-5 개를 .t2-whitelist.json 에 수동 등록
  예: file-standards ↔ pc-tools
      reliability-drift ↔ hook-guard-review
      file-standards-frontmatter ↔ file-standards-violation-3step
      ...
  
T2 매칭 시 whitelist 에 등록된 DA 가 top-K 에 있으면 짝도 자동 동반

안전장치:
  - 최대 1-hop (다단 번들 금지)
  - Visited Set (순환 참조 차단)
  - 토큰 예산 8k 상한
  - 쌍 단위 활성화 (전역 토글 아님)
```

**Phase 2 (1-2 개월 — 관측 축적)**:
```
whitelist 쌍의 verifier signal (E4) 관측 데이터 축적
- 해당 쌍이 실제로 함께 필요했던 사례 빈도
- 번들 주입 후 hit rate 개선 폭
- 토큰 예산 실소비
```

**Phase 3 (조건 충족 시 — 자동 임계 upgrade)**:
```
관측 ≥20 건 + 임계 dry-run 데이터 충분
→ 임계 기반 자동 활성화 로직 도입
→ 새 쌍이 관측 누적으로 자동 whitelist 등록
```

**Whitelist 초기 seed 선정 기준** (Judge Action Item):
- `applies-with` 링크 수 상위
- 감사 wf 에서 "쌍으로 필요" 유의미 관찰된 기록
- 사용자가 자주 같이 Read 하는 MD 파일 pair

**롤백**: `.t2-whitelist.json` 파일 삭제 (1 줄).

### 2.3 Deferred 1 건

#### E2 — Few-shot 자동 주입 (Hybrid)

**개요**: T2 의 한국어→영어 번역 LLM (Haiku) 프롬프트에 최근 성공 매칭 pair 3-5 개를 inject.

**왜 Deferred 인가**: E2 는 L12.4 promote 결과물을 소비. 즉 **L12.4 가 충분한 데이터를 생산해야 E2 가 작동**. Cold start 21-28 일 구간 ROI 0 → 비활성 유지 + 조건 충족 시 자동 활성.

**Hybrid 3 Phase**:

**Phase 1 (Day 0 — Manual Seed)**:
```
사용자가 .t2-fewshot-seed.json 에 3 pair 수동 기입

예시 구조:
  [
    {"ko": "grandfather 적용 안 해도 돼?",
     "en": ["grandfather", "frontmatter", "date", "Edit"],
     "target_da": "file-standards-frontmatter"},
    {"ko": "비서 self-match 오탐",
     "en": ["secretary", "self-match", "scrollback", "WORKING_RE"],
     "target_da": "secretary-self-echo-avoidance"},
    {"ko": "psmux 메시지 폭주",
     "en": ["psmux", "message", "flood", "pkill"],
     "target_da": "psmux-send-ssot-helper"}
  ]

번역 LLM 프롬프트 헤더에 이 3 pair 가 <example> 태그로 inject
```

**Phase 2 (Day 1-30 — Observation)**:
```
L12.4 가 miss log + Read correlation 으로 승격 데이터 축적
.t2-fewshot-seed.json 은 변함없이 주입
승격된 pair 는 .t2-fewshot.json (자동 생성 파일) 에 별도 누적
```

**Phase 3 (Day 30+ — 자동 활성화)**:
```
조건: L12.4 누적 promote ≥ 30 건 AND 고유 DA ≥ 10 개

조건 충족 시:
  .t2-fewshot.json 의 최근 7 일 promote 성공 pair 중 다양성 상위 5 건 자동 선별
  선별 기준 (우선순위):
    1. 서로 다른 target_da (다양성)
    2. cnt 빈도
    3. Jaccard 유사도 낮은 것 (의미 분산)
  cap = 5 고정
  매 rebuild post-hook 시 재생성
  
Manual seed 는 자동 수확분에 덮어써짐 (cap=3)
```

**안전장치**:
- `enableFewshot` flag 로 전체 off 가능
- 5 건 cap 초과 시 분수적 선택 금지 (cap 엄격 준수)
- Few-shot 소스는 **promote 성공분만** (미검증 miss 직접 inject 금지 → L12.2 재발 경로)

### 2.4 Trigger-gated 보류 1 건

#### E5 — Decay 연속 감쇠

**개요**: 오래 사용 안 된 DA 를 effective_score 에서 점진적으로 감점.

**왜 보류 인가**: 현재 T2 80% plateau 의 원인은 "낡은 DA 가 밀어냄" 이 아니라 "키워드 공백". Decay 는 premature optimization. 미래 DA 수가 500+ 로 늘어나면 필요해질 수 있으니 **트리거 조건** 설정 후 자동 발동 경로만 보존.

**Trigger 설계**:

```
기록 파일: ~/.claude/.e5-trigger-log.jsonl (매 세션 종료 시 append)

엔트리 스키마:
  {
    "session": "...",
    "ts": "...",
    "injected_das": ["DA-xxx", "DA-yyy", ...],
    "hit_das": ["DA-xxx", ...],        # 세션 중 실제 사용된 DA
    "hit_ratio": 0.xx,                 # hit_das / injected_das
    "flagged": true|false              # hit_ratio ≤ 0.5
  }

세션 경계 정의:
  - compact 후 리셋 (같은 세션이어도 새 카운트)
  - WF 세션 (supervisor/worker/verifier/healer) 제외
  - 일반 대화 세션만 카운트

Trigger 판정:
  최근 3 세션 연속 flagged=true → E5-micro 자동 발동

E5-micro 설계:
  τ 2 값 (30 일, 60 일) × hit rate 1 지표 × 1 반복 = 1-2 주
  결과로 τ 고정 후 effective_score 공식 확정
```

**Decay 공식 (활성화 시)**:
```
effective_score(DA) = base_score - decay_penalty(age_days, τ)
  decay_penalty = 1 - exp(-age_days / τ)
  base_score = Jaccard + (기타 boost)
```

**안전장치**:
- `e5-trigger-log.jsonl` 쓰기 실패 시 E5 영구 보류 (조용히 skip, 알람 없음)
- τ = ∞ 로 설정 시 decay_penalty 항 0 → 기존 binary 동작과 동치 (1 줄 롤백)
- Trigger 조건에 "하드 임계 3 세션 연속" 엄격 적용

**정상 미발동 상태**: 본 시스템은 대부분의 사용 기간 동안 Trigger 발동 없이 운영될 것으로 예상. E5 는 "안전하게 보존된 미래 카드".

---

## 3. A/B Enable 순서 (Debate 권고)

6 확장 전체 동시 편입 반려. **상류 → 하류 순차 enable** 로 attribution 가능성 확보.

권고 순서:

```
Day 0:  E3 enable (T2→T3 fallback)     — 상류, 즉각적 사용자 경험 개선
Day 7:  E1 enable (증거원 삼중화)       — E3 의 신호 수집 완료 후 삼중화
Day 14: E4-enum-MVP enable (auditor only) — 증거 파이프 운영 중 Verifier 추가
Day 21: E6-whitelist-first enable      — 수동 whitelist 3-5 쌍 등록 후 활성화
```

**각 enable 단계에서**:
- 시뮬레이션 또는 실사용 1 주 관측
- 15-dogfood + 정성 4 축 측정
- uplift-commit 수치 (§5 R3 표) 달성 여부 확인
- 미달 시 해당 enable 단독 off (다른 확장 영향 없음)

**E2 / E5 는 위 시퀀스 무관**:
- E2: Manual seed Day 0 에 사용자 수동 입력 가능. 자동 활성화는 조건 충족 시.
- E5: Trigger 조건 충족 시만 발동. 평소는 비활성.

---

## 4. 시뮬레이션 Dry-run 설계 (기간 압축 핵심)

원 설계의 "1-2 주 실측" 을 Agent 시뮬레이션으로 1 일 내 대체한다. 사용자가 완성된 경험을 빠르게 받는 것이 최우선.

### 4.1 4 단계

**Step 1 — 쿼리 생성 (1-2 시간)**:
```
Opus Agent 에게 작업:
  "300 DA 중 100 개 샘플 → 각 DA 에 대해 그 규칙을 실제로 호출할
   한국어 사용자 질의 3-5 개 생성. 오타·동의어·불완전 표현·구어체 포함"

결과: ~300-500 query 한국어 샘플 → pipeline/simulation-queries.jsonl
```

**Step 2 — 자동 매칭 실행 (2-3 시간)**:
```
각 query 를 T2 에 주입 → 매칭 로깅
실패 건에 대해 Agent 가 "관련 MD Read" 자동 수행:
  - 해당 query 의 target_da (Step 1 에서 알고 있음) → DA yaml 의 sources.canonical MD path
  - Agent 가 그 MD 를 Read → read-logger 에 이벤트 자동 기록

결과: 
  - .t2-miss.jsonl (매칭 실패 증거)
  - audit-log (가상 Read 이벤트)
  - .t3-fallback-hit.jsonl (E3 활성 시)
  - .verifier-missing.jsonl (E4 활성 시)
```

**Step 3 — 증거 축적 + 승격 실행 (30 분)**:
```
build-auto-learn-promote.ts 실행 → correlation
DF 상한 + N 차등 적용
auto-keywords 승격 수 집계
rebuild.ts 로 .t2-keyword-index.json 재생성
```

**Step 4 — 판정 (30 분)**:
```
15-dogfood 재실행 → hit rate 확인
확장별 기대치 (§5 R3) 충족 여부 체크
미달 시:
  - N 차등 조정 (Read within 3→2 완화)
  - threshold 조정 (E3 0.3→0.2 하향)
  - 재시도
```

**총 소요 1 일 미만**.

### 4.2 시뮬레이션 한계 인지

- 실제 사용자의 "맥락 있는 연속 쿼리" 는 재현 불가 → 실제 운영 초기 1-2 주 동안 추가 미세 조정 필요
- Agent 생성 쿼리의 품질은 Opus 능력에 의존 → 너무 규칙적이면 실사용 노이즈 미반영
- 시뮬레이션은 **확신 확보용** 이지 "실측 완료" 는 아님. Sunset clause 2 개월 재평가는 실제 운영 기준 유지.

### 4.3 시뮬레이션 ≠ 실측 차이 처리

- 시뮬레이션 측정 결과가 매우 좋아도 (예: +15%p) 그대로 신뢰하지 말고 실제 배포 후 2 주 추가 모니터링
- 정성 4 축 (§6) 은 시뮬레이션에서는 불완전 (사용자 불만 / 감사 wf 관찰 대체 불가) → 실사용 필수

---

## 5. Action Items (ULTRA PLAN 이 구현할 항목)

Judge Verdict 의 Action Items 8 건을 그대로 보존.

1. **E4-enum-MVP 구현 spec 에 Anthropic SDK tool-use 또는 JSON schema-enforced mode 명시** (JSON 준수율 ≥95% 달성 수단)
2. **Uplift-commit 재정의 문서 작성**: "정량 threshold 아님 + 최소 50-100 query 후 평가 + 정성 병행" 명시 → `docs/uplift-commit-interpretation.md`
3. **E6-whitelist-first Phase 1 초기 3-5 쌍 선정 기준 명시** — applies-with 링크 수 상위 + 감사 wf 유의미 관찰 쌍 (구체 쌍은 Phase 1 착수 시 사용자와 합의)
4. **E5-trigger 조건 "3 세션 연속" 세션 경계 규칙 명시** — compact 후 리셋, WF 세션 제외 (본 CLAUDE.md §2.4 Trigger 설계 블록 참조)
5. **A/B enable 순서 고정** — E3 → E1 → E4-enum-MVP → E6-whitelist-first (본 CLAUDE.md §3 참조)
6. **L12.2 불변 원칙 2 리스트 정합성 감사** — debate-context 6 원칙 vs plan-da-lifecycle §안전장치 6 원칙 필드 매핑 통일 문서화 → `docs/invariant-principles-unified.md`
7. **Dry-run 이관 9 항목을 plan §L12.7 신규 섹션에 명문화** (본 `plan.md` §8 에 완료)
8. **Tier sunset 2 개월 후 판정 프로토콜 작성** — 수치 미달 + 정성 신호 AND 조건 명시 → `docs/sunset-clause-protocol.md`

---

## 6. 판정 메트릭 — 정량 + 정성 병행

1 인 사용자 통계 유의성 불가 (Gemini 리서치 확인) → 수치만으로 자동 롤백 금지. 정성 4 축 병행 필수.

**정량 지표**:
- 15-dogfood hit rate (기존 축)
- 확장별 uplift-commit 수치 (§5 R3 표)

**정성 4 축** (Judge §D 권고):

1. **사용자 불만 로그** — `audit-log/*.jsonl` 에 `type="user_complaint"` 이벤트 추가. 주간 집계. 구현: 사용자가 "이거 제대로 못 찾네" 유형 피드백 시 Supervisor 가 tag 기록
2. **승격 DA 실사용 추적** — auto-keywords 로 승격된 DA 가 14 일 window 내 실제 T2 hit 잡히는 비율. 50% 이상 = 정당한 승격, 미만 = noise 가능
3. **감사 wf 유의미 관찰** — 감사 wf 수행 시 "이 확장 덕에 발견된 문제" 로 태그된 건수
4. **Noise 대조** — 확장 비활성 세션 (lightweight-wf 등) 의 동일 기간 hit rate 변동과 비교

**Sunset clause 판정 공식** (2 개월 후):
```
rollback 조건 = (hit rate < +3%p) AND (정성 4 축 중 2 축 미달)
  AND 조건: 둘 다 충족해야 rollback. 하나만은 회색 지대.
```

---

## 7. 미래 편입 항목 보존 (세션 종료 후 절대 잊지 말 것)

다음 표는 **현재 비활성이지만 조건 충족 시 자동 또는 수동 활성화** 경로가 설계된 항목. ULTRA PLAN 은 이 조건을 모니터링하는 hook 을 구현해야 한다.

```
항목                      현재 상태     활성화 조건
─────────────────────────────────────────────────────────────
E2 Phase 2 자동 few-shot  Manual seed   L12.4 누적 promote ≥30 건 AND 고유 DA ≥10 개
E4 coder profile 확장     auditor only  auditor 에서 JSON 준수율 ≥80% 검증 완료
E4 harness-worker 확장    auditor only  coder 확장 후 auditor+coder 안정 확인
E5 Decay 활성화           보류          .e5-trigger-log 에서 hit_ratio ≤0.5 3 세션 연속 flagged
E6 Phase 3 임계 자동화    Whitelist 수동 whitelist 쌍 1-2 개월 관측 + 임계 dry-run 데이터 축적
SDK schema-enforced mode  미확정        E4 활성화 시 Anthropic SDK 명시 (즉시)
```

**보존 메커니즘**:
- 본 CLAUDE.md §7 (이 섹션) 에 영구 기록
- `plan.md` §Future Activation Gates 에 중복 기록
- `memory/future-activation-gate.md` 로 이관 권장 (MEMORY.md 에 한 줄 포인터 추가)

---

## 8. ULTRA PLAN Agent 를 위한 Quick Start

본 CLAUDE.md 를 읽은 agent 가 바로 실행할 수 있도록 진입점 명확화.

### 권장 워크플로우

```
1. 본 CLAUDE.md + plan.md 전체 Read
2. 불변 원칙 6 개 (§1.3) + L12.2 복기 (§1.2) 숙지
3. A/B enable 순서 (§3) 에 따라 E3 부터 구현
4. 각 확장 구현 후 시뮬레이션 dry-run (§4) 1 회 수행
5. Action Items 8 건 (§5) 을 진행 중 issue 로 tracking
6. 완료 후 CLAUDE.md §7 미래 편입 조건 모니터링 hook 배포
```

### 구현 진입 파일 (순서)

- `pipeline/simulation.ts` 신규 — 쿼리 생성 + 자동 매칭 + 측정 통합
- `hooks/prompt/da-context.js` 확장 — T3 즉시 fallback (E3) + miss log 필드 확장 (E1 `original_korean_query`)
- `pipeline/build-auto-learn-promote.ts` 신규 — correlation script (L12.4 +  E1 삼중화)
- `hooks/tool/verifier.js` 신규 — E4-enum-MVP Verifier
- `hooks/prompt/chain-bundling.js` 신규 — E6 Whitelist
- `pipeline/build-t2-fewshot.ts` 신규 — E2 Few-shot (deferred 활성화 시)
- `hooks/session/e5-trigger-monitor.js` 신규 — E5 Trigger 모니터

### 금기 사항

- LLM 에게 DA body 보고 키워드 생성 요청 (L12.2 재발)
- manual `trigger.keywords` 필드 수정 (불가침)
- 주기적 cron/nightly 신규 도입 (유지보수 0 원칙)
- 자동 기능을 flag 없이 배포 (롤백 1 줄 불가)
- 확장 동시 편입 (attribution 불가, A/B 순서 위반)

---

## 9. 참조

- **본 plan 상세**: `plan.md` (모든 확장안 + 해결책 R1-R5 + 시뮬레이션 설계 + Debate verdict)
- **Debate verdict 원문** (보존): `docs/debate-verdict-2026-04-24.md`
- **원본 Plan seed** (Obsidian 프로젝트): `D:/projects/Obsidian/plan-da-lifecycle.md` §L12 블록
- **DA 시스템 아키텍처**: repo 내 `README.md` + `docs/architecture.md` (전체 시스템 이해 필요 시만 참조, 본 작업 범위 밖)

---

## 10. Past — Repo Push 작업 (완료, 2026-04-24)

본 repo 는 `~/.claude/` 분산 DA 시스템 코드를 외부 공개용으로 재배치한 staging 공간이었다.

- 옵션 C (기능 중심 재배치) 채택
- DA YAML 305 개 전량 제외 (examples/ 에 kind 별 3-6 샘플만 포함)
- `.lancedb/`, `.archive/`, runtime 상태 파일 등 gitignore 추가
- GitHub push 완료 → `https://github.com/jsh8603-web/web/DA`

본 Phase 는 종료되었고 이제 T2 매칭률 개선이 주 작업이다.
상세 이력 필요 시 `git log` 참조 또는 `README.md` 의 원본 경로 매핑표 확인.
