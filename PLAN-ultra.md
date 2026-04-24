# ULTRA PLAN — E3→E1→E4→E6 구현 플랜

## Context

T2 매칭률이 80% plateau. 원인은 DA trigger.keywords 공백 (예: "grandfather" 쿼리 → file-standards-frontmatter 정답이지만 키워드 없어서 Jaccard=0).  
L12.2 파탄 교훈(LLM 키워드 일괄 생성→generic 토큰 폭발→hit rate 0%)에 따라 **관측 이벤트 기반 점진적 승격** 전략.  
plan.md §12 Quick Start 기준으로 E3→E1→E4→E6 순서로 구현.

---

## 현재 코드 상태 (탐색 결과)

| 파일 | 상태 | 비고 |
|---|---|---|
| `hooks/prompt/da-context.js` | 존재 (421L) | T2 JACCARD_THRESHOLD=0.7, T3 이미 존재하지만 t2Unmatched 보완 용도 / 코사인≥0.7 / top-5 |
| `pipeline/build-t2-keyword-index.ts` | 존재 (112L) | auto-keywords 의도적 제외 (L12.2 롤백 주석) |
| `pipeline/rebuild.ts` | 존재 (332L) | post-hook: enrich-cross-ref → build-index-critical → build-t2-keyword-index |
| `pipeline/lancedb-client.ts` | 존재 | `fetchBgeEmbedding`, `searchDA` 제공 |
| `hooks/tool/verifier.js` | **없음** | E4 신규 |
| `hooks/prompt/chain-bundling.js` | **없음** | E6 신규 |
| `pipeline/build-auto-learn-promote.ts` | **없음** | E1 신규 |
| `config/` 디렉터리 | **없음** | E6 whitelist, E4 prompt 신규 |
| `.simulation-data/` 디렉터리 | **없음** | Phase 0 신규 |

**중요 관찰**: `examples/heuristic-example.yaml`에 이미 `auto-keywords` 필드 존재 (LLM 생성분, L12.2로 index 제외 상태). E1 이후 `build-t2-keyword-index.ts`가 DF≤15 필터로 auto-keywords를 다시 포함해야 함.

---

## 구현 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                     da-context.js (수정)                             │
│                                                                     │
│  UserPromptSubmit                                                   │
│       │                                                             │
│       ▼                                                             │
│  Haiku 번역 → combinedQuery                                          │
│       │                                                             │
│       ▼                                                             │
│  T2 Jaccard (threshold=0.7)                                         │
│       │                                                             │
│  t2Matched.length === 0?                                            │
│       │                                                             │
│  YES──┤ ① miss log append (.t2-miss.jsonl) ← 추가: original_korean  │
│       │ ② enableT3Fallback=true? → T3 호출 (top-2, 임계 없음)       │ E3
│       │    → .t3-fallback-hit.jsonl append                         │
│       │    → t3FallbackMatched                                      │
│       │                                                             │
│  NO───┤ ③ enableChainBundling? → chain-bundling.js 호출             │ E6
│       │    → whitelist 쌍 동반 주입                                  │
│       │                                                             │
│       ▼                                                             │
│  allMatched 조합 → 컨텍스트 주입                                      │
│       │                                                             │
│       ▼ (UserPromptSubmit only, auditor profile)                    │
│  ④ enableVerifier? → verifier.js 호출 (Anthropic tool-use)          │ E4
│       → is_sufficient=false → missing_da_ids 추가 주입               │
│       → .verifier-missing.jsonl append                             │
└─────────────────────────────────────────────────────────────────────┘
        │ 로그 파일 3종
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│          build-auto-learn-promote.ts (신규)                          │ E1
│                                                                     │
│  .t2-miss.jsonl ──────────────────────────────┐                    │
│  audit-log Read 이벤트 (60s window) ────────────┤→ 증거원 1 (Read)  │
│  .t3-fallback-hit.jsonl ────────────────────────┤→ 증거원 2 (T3)   │
│  .verifier-missing.jsonl ───────────────────────┘→ 증거원 3 (Verif)│
│                                                                     │
│  (DA, token) pair 누적 카운트 × 증거원별 N 차등                        │
│  DF ≤ 15 필터 + manual Levenshtein ≤ 2 중복 제외                     │
│       │                                                             │
│       ▼                                                             │
│  DA yaml auto-keywords append                                       │
│       │                                                             │
│       ▼                                                             │
│  build-t2-keyword-index.ts (수정: DF≤15 필터로 auto-keywords 포함)   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Simulation Data 셋업

**목적**: 구현 검증용 데이터 환경 구성. 실제 `~/.claude/decisions/` 대신 repo 내 샘플 사용.

**생성 파일**:
- `.simulation-data/README.md` — 구조 설명, 경로 매핑
- `.simulation-data/das/` — **51개 DA** (`~/.claude/decisions/` 에서 sanitized 서브셋)  
  **[GAP 6] 선정 기준**: `applies-with` 링크 수 ≥2 AND 실제 `.t2-miss.jsonl` 기록 보유 AND 6 kind 유형 균형 (heuristic/chain/constraint/pattern/flow/enum 각 8-9개). `examples/` 6개 샘플만으로는 miss 재현 불충분 → 실 결정사항 파일에서 추출 필수. DA 본문 내 개인정보/사업 민감 필드는 익명화.
- `.simulation-data/queries-initial.jsonl` — 각 DA당 3-5개 한국어 query, target_da 포함 (60건 이상, progress.md 기준)
- `.simulation-data/logs/` — 빈 로그 파일 자리 (`.t2-miss.jsonl`, `.t3-fallback-hit.jsonl`, `.verifier-missing.jsonl`)

---

## Phase 1: E3 — T2→T3 즉시 Fallback

**수정 파일**: `hooks/prompt/da-context.js`

### 변경 사항

**1. 상수 추가** (line 104 근처, 기존 JACCARD_THRESHOLD 다음):
```javascript
const enableT3Fallback = true; // 불변 원칙 5: false로 off 가능
const T3_FALLBACK_CAP = 2;    // E3: top-2 (기존 T3_MAX_DA=3과 별도)
```

**2. miss log 이동 + 스키마 확장** (현재 line 370-381):
- `allMatched.length === 0` 조건 → `t2Matched.length === 0` 으로 변경 (T2 miss 기준)
- `original_korean_query` 필드 추가 (prompt의 원본, lowercase 전 값)
- E3 fallback 여부와 무관하게 T2 miss 기록 (T3가 찾아도 T2 miss는 기록)

**3. T3 블록 재구성** (현재 line 327-352):
- 기존 T3 보완 로직 유지 (T2가 뭔가 찾았을 때 t2Unmatched에서 추가 탐색)
- E3 fallback 분기 추가: `t2Matched.length === 0 && enableT3Fallback` 시
  - 기존 배치 임베딩 재사용 (`getEmbeddingBatch` 기존 함수 그대로)
  - 코사인 threshold 없이 상위 2개 추출 (`T3_FALLBACK_CAP = 2`)
  - `.t3-fallback-hit.jsonl` append:
    ```json
    {"ts":"...","query":"...","original_korean_query":"...","hit_das":["DA-id1","DA-id2"],"session":"..."}
    ```
  - 이 결과가 `allMatched` 구성에 포함됨

**핵심**: `getEmbedding`, `getEmbeddingBatch`, `cosine` — 기존 함수 재사용, 신규 코드 최소화.

---

## Phase 2: E1 — 증거원 삼중화 + 자동 승격

### 2a. 신규: `pipeline/build-auto-learn-promote.ts`

**imports**: `fs/promises`, `path`, `js-yaml` (기존 pipeline 파일 패턴 참조)

**핵심 로직**:
```typescript
// 1. 로그 3종 파싱 (30일 window)
const misses = loadMissLog(decisionsDir)       // .t2-miss.jsonl
const t3Hits = loadT3FallbackLog(decisionsDir) // .t3-fallback-hit.jsonl  
const verifierMissing = loadVerifierLog(decisionsDir) // .verifier-missing.jsonl
const readEvents = loadReadLog(auditLogDir)    // audit-log Read events

// 2. 증거 수집 (DA, token) 카운터
const counter = new Map<string, {count: number, sources: string[]}>()
// key: "DA-id::token"

// 증거원 1: Read within-session (60s window) → N=3
// miss.english_kw 토큰 ∩ MD content 토큰 (length≥3)
// MD path → DA id (sources.canonical 역참조)

// 증거원 2: T3 fallback hit → N=5  
// t3Hits[i].hit_das × miss의 english_kw 토큰 교집합
// [GAP 2] token 소스 = english_kw 필드만. original_korean_query 절대 사용 금지.
//   이유: 한국어 교착어 형태소 파편화 ("적용안해도돼" → 무의미 분절) →
//         english_kw 는 Haiku 가 이미 정규화한 영어 토큰이므로 noise 없음.

// 증거원 3: Verifier missing_da_ids → N=3
// verifierMissing[i].missing_da_ids × 원본 query 토큰 (english_kw)

// 3. DF 상한 계산 (모든 DA의 current keywords 기반)
const tokenDF = computeDocumentFrequency(allDAs) // token → DA 개수
// DF > 15 인 토큰 제외

// 4. Manual keyword Levenshtein 중복 제거
// editDistance(candidate, existingKw) <= 2 이면 skip

// 5. N 임계 통과 시 DA yaml에 auto-keywords append
//
// [GAP 1] 증거원별 N 초기값 근거:
//   Read within-session = 3: L12.4 baseline 동일 유지 (검증된 기준)
//   Read across-session = 2:  세션 간 맥락 단절이지만 반복 = 명확한 의도 → 1단계 완화
//   Verifier            = 3:  enum 출력으로 파편화 없음 → Read 신뢰도 동등
//   Vector (T3 fallback)= 5:  false-positive 위험 최대 (임계 없이 top-2 반환) → 가장 보수적
//
// [GAP 7] 교차 증거원 가중 합산 허용:
//   weight = 1 / N_threshold (증거원별 정규화). 합계 ≥ 1.0 → 승격.
//   예: Read within 1회(=1/3) + T3 1회(=1/5) + Verifier 1회(=1/3) = 0.87 → 미달
//       Read within 2회(=2/3) + Verifier 1회(=1/3) = 1.0 → 승격
//   단일 증거원 80% 이상 편중 시 WARNING 로그 (single-source collapse 조기 탐지)
```

**안전장치**:
- `enableSource = { read: true, t3: true, verifier: true }` — 증거원별 flag
- 기존 `auto-keywords` 필드 보존 (append only, 삭제 없음)
- `trigger.keywords` (manual) 절대 수정 불가

### 2b. 수정: `pipeline/build-t2-keyword-index.ts`

**변경**: L12.2 롤백 주석 제거 + auto-keywords 포함 (단, DF≤15 filter 적용)

**[GAP 3] 처리 방식 결정**: auto-keywords는 **별도 weighted index 불필요** — `idx.keywords` 동일 슬롯에 2-pass DF 필터로 통합. 이유: L12.2 "별도 weighted index 설계 필요" 주석은 DF 상한 필터가 없었을 때의 우려. DF≤15 필터 자체가 generic 토큰 차단 역할을 함.

현재 line 60-75 (keywords 루프) 다음에:
```typescript
// [GAP 3] auto-keywords: 별도 슬롯 불필요. 2-pass DF≤15 필터로 idx.keywords에 통합.
// pass 1: 모든 DA의 auto-keywords 수집 → tokenDF 계산
// pass 2: DF≤15인 것만 idx.keywords에 추가 (manual keywords와 동일 슬롯)
const autoKeywords = Array.isArray(trigger['auto-keywords'])
  ? (trigger['auto-keywords'] as unknown[])
  : [];
for (const kw of autoKeywords) {
  const key = String(kw).toLowerCase().trim();
  if (!key) continue;
  (autoKwAccum[key] ||= []).push(id); // pass 1 누적
}
// pass 2는 모든 DA 순회 완료 후: DF≤15인 autoKwAccum 항목 → idx.keywords에 merge
```

파일 스코프 변수 `const autoKwAccum: Record<string, string[]> = {};` 추가. 파일 끝에서 merge loop 실행.

### 2c. 수정: `pipeline/rebuild.ts`

**[GAP 4] post-hook 실행 순서 (기존 순서 잘못됨 — 반드시 아래 순서 준수)**:
```
enrich-cross-ref → build-auto-learn-promote → build-t2-keyword-index → build-index-critical
```
이유: build-auto-learn-promote가 DA yaml의 auto-keywords를 업데이트 → build-t2-keyword-index가 그 결과를 포함하여 index 재생성 → build-index-critical이 최신 index 기반으로 critical DA 목록 생성. 순서 역전 시 auto-keywords가 index에 미반영됨.

기존 코드 (line 314 이후, `build-index-critical` 앞에) 에 삽입:
```typescript
// Post-hook: auto-learn promote (E1) — build-t2-keyword-index 반드시 앞에 위치
const skipAutoLearn = process.argv.includes('--skip-auto-learn');
if (!skipAutoLearn) {
  const { runAutoLearnPromote } = await import('./build-auto-learn-promote.js');
  await runAutoLearnPromote();
}
```

---

## Phase 3: E4 — Verifier enum-MVP

### 신규: `hooks/tool/verifier.js`

CommonJS 모듈 (da-context.js에서 require로 호출).  
Haiku 호출 방식은 기존 `extractEnglishKeywords`의 curl/spawnSync 패턴 재사용.

**API 호출**: Anthropic tool-use (`tools` 파라미터):
```json
{
  "tools": [{
    "name": "assess_sufficiency",
    "description": "Assess if injected DA context is sufficient",
    "input_schema": {
      "type": "object",
      "properties": {
        "is_sufficient": {"type": "boolean"},
        "missing_da_ids": {"type": "array", "items": {"type": "string"}}
      },
      "required": ["is_sufficient", "missing_da_ids"]
    }
  }],
  "tool_choice": {"type": "any"}
}
```

**입력**: query + 주입된 DA summary (body 전체 아닌 `then` 필드만) + 후보 DA ID 목록 (top-20 cosine 유사도)  
**출력**: `{is_sufficient: bool, missing_da_ids: string[]}`  
**실패 시**: `is_sufficient = true`로 간주 (blocking 방지)

**[GAP 5] top-20 후보 DA 확보 방법**:
- **별도 embed 호출 불필요** — T3 fallback (E3)이 이미 cosine 유사도를 계산함. 그 결과에서 상위 20개를 `candidateDaIds`로 재활용.
- 순서: E3 T3 호출 → cosine 정렬 결과 유지 (기존 top-2만 allMatched에 넣되, 전체 cosine 결과는 변수에 보존) → E4 Verifier에 top-20 ID 전달.
- **embed 서비스 down 시**: `candidateDaIds = []` → `runVerifier` 전체 skip (`is_sufficient = true` fallback). Verifier가 T3 결과에 의존하므로 T3 실패 = Verifier 실행 불가. 별도 embed 재호출 시도 금지.
```javascript
// da-context.js: T3 cosine 결과 보존
let t3CosineResults = []; // [{da, score}] 전체 저장 (top-2만 allMatched에 넣음)
// E4 분기에서: candidateDaIds = t3CosineResults.slice(0, 20).map(r => r.da.id)
```

**exports**:
```javascript
module.exports = { runVerifier }
// runVerifier(query, injectedDAs, candidateDaIds, config) → {is_sufficient, missing_da_ids}
```

### 신규: `config/verifier-prompt.txt`

시스템 프롬프트 텍스트 파일.

### 수정: `hooks/prompt/da-context.js`

contextLines 빌드 완료 후, E4 분기 추가:
```javascript
const enableVerifier = (process.env.CLAUDE_PROFILE === 'auditor'); // profile gating
if (enableVerifier && hookEvent === 'UserPromptSubmit' && allMatched.length > 0) {
  const { runVerifier } = require(path.join(__dirname, '../tool/verifier'));
  const result = runVerifier(queryText, allMatched, candidateDaIds, {token});
  if (!result.is_sufficient && result.missing_da_ids.length > 0) {
    // missing DAs 강제 추가 주입
    // .verifier-missing.jsonl append
  }
}
```

---

## Phase 4: E6 — Chain Bundling Whitelist-first

### 신규: `config/t2-whitelist.json`

초기 3-5쌍 (plan.md §2.4 예시 기반):
```json
[
  {"a": "DA-YYYYMMDD-file-standards-frontmatter", "b": "DA-YYYYMMDD-file-standards-violation-3step"},
  {"a": "DA-YYYYMMDD-reliability-cwd-drift", "b": "DA-YYYYMMDD-reliability-registry-drift"}
]
```
※ 실제 DA ID는 사용자가 applies-with 링크 상위 쌍으로 확정

### 신규: `hooks/prompt/chain-bundling.js`

```javascript
// 입력: t2Capped (이미 선택된 DA 목록), whitelist, das (전체), tokenBudget
// 출력: bundled DA 추가분

function applyChainBundling(matchedDaIds, allDas, whitelist, charBudget) {
  const visited = new Set(matchedDaIds);
  const extra = [];
  for (const pair of whitelist) {
    const hit = matchedDaIds.includes(pair.a) || matchedDaIds.includes(pair.b);
    if (!hit) continue;
    const partner = matchedDaIds.includes(pair.a) ? pair.b : pair.a;
    if (visited.has(partner)) continue; // 순환 차단
    visited.add(partner);
    const da = allDas.find(d => d.id === partner);
    if (da) extra.push(da);
  }
  return extra; // 토큰 예산 체크는 da-context.js charTotal 로직 재사용
}

module.exports = { applyChainBundling };
```

### 수정: `hooks/prompt/da-context.js`

t2Capped 선택 직후, 컨텍스트 주입 전에 추가:
```javascript
const enableChainBundling = true; // false로 off 가능
if (enableChainBundling) {
  const whitelistPath = path.join(__dirname, '../../config/t2-whitelist.json');
  const whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
  const { applyChainBundling } = require('./chain-bundling');
  const extraDas = applyChainBundling(t2Capped.map(m => m.da.id), das, whitelist, charTotal);
  for (const da of extraDas) allMatched.push({ da, confidence: 0.85 });
}
```

---

## 검증 방법

### 단계별 smoke test

**E3**:
```bash
# da-context.js에서 T2 miss 유발 쿼리 (grandfather 예시)
echo '{"hook_event_name":"UserPromptSubmit","prompt":"grandfather 적용 안 해도 돼?"}' \
  | node hooks/prompt/da-context.js
# 기대: .t2-miss.jsonl에 original_korean_query 포함, .t3-fallback-hit.jsonl 생성
```

**E1**:
```bash
# 시뮬레이션 데이터로 promote 실행
npx tsx pipeline/build-auto-learn-promote.ts --input .simulation-data/
# 기대: promote-report.md 생성, DA yaml auto-keywords 업데이트
```

**E4**:
```bash
# auditor profile에서 da-context.js 실행
CLAUDE_PROFILE=auditor echo '{"hook_event_name":"UserPromptSubmit","prompt":"..."}' \
  | node hooks/prompt/da-context.js
# 기대: Verifier Haiku 호출, JSON schema 준수 확인
```

**E6**:
```bash
# whitelist 쌍의 한쪽이 매칭되는 쿼리
echo '{"hook_event_name":"UserPromptSubmit","prompt":"..."}' \
  | node hooks/prompt/da-context.js
# 기대: 짝 DA도 additionalContext에 포함됨
```

### 시뮬레이션 dry-run (plan.md §5)

```bash
# Phase 0
npx tsx pipeline/build-t2-keyword-index.ts  # .simulation-data/das/ 기준
# Step 2: 쿼리 × DA 매칭
# Step 3: promote 실행
npx tsx pipeline/build-auto-learn-promote.ts
# Step 4: 15-dogfood 재실행
```

---

## 파일 변경 요약

| 파일 | 작업 | 의존 |
|---|---|---|
| `hooks/prompt/da-context.js` | 수정 (E3+E4+E6 호출) | 공통 |
| `pipeline/build-auto-learn-promote.ts` | **신규** | E1 |
| `pipeline/build-t2-keyword-index.ts` | 수정 (auto-keywords DF≤15 포함) | E1 |
| `pipeline/rebuild.ts` | 수정 (auto-learn post-hook 추가) | E1 |
| `hooks/tool/verifier.js` | **신규** (모듈) | E4 |
| `config/verifier-prompt.txt` | **신규** | E4 |
| `hooks/prompt/chain-bundling.js` | **신규** (모듈) | E6 |
| `config/t2-whitelist.json` | **신규** | E6 |
| `.simulation-data/` | **신규** (디렉터리+파일) | Phase 0 |

---

## GAP 해소 결정 사항 (2026-04-24 리뷰 반영)

이전 plan에서 미결이었던 7개 GAP의 확정 결정. 각 Phase 섹션 내 `[GAP N]` 주석으로도 반영됨.

| GAP | 위치 | 결정 |
|---|---|---|
| GAP 1 | Phase 2 E1 (N threshold) | Read within=3 / across=2 / Verifier=3 / Vector=5. 근거: 각 증거원 FP 위험도 비례 |
| GAP 2 | Phase 2 E1 (T3 token 소스) | `english_kw` 필드만 사용. `original_korean_query` 금지 (교착어 파편화 위험) |
| GAP 3 | Phase 2 E1b (auto-keywords 슬롯) | 별도 weighted index 불필요. `idx.keywords` 동일 슬롯에 2-pass DF≤15 필터로 통합 |
| GAP 4 | Phase 2 E1c (rebuild 순서) | enrich-cross-ref → **build-auto-learn-promote** → build-t2-keyword-index → build-index-critical |
| GAP 5 | Phase 3 E4 (top-20 후보) | T3 cosine 결과 재활용. 별도 embed 호출 금지. embed down → Verifier skip |
| GAP 6 | Phase 0 (simulation DA 선정) | 51개, 기준: applies-with≥2 + 실 miss 기록 + 6 kind 균형. `~/.claude/decisions/` sanitized |
| GAP 7 | Phase 2 E1 (교차 증거원) | 가중 합산 허용 (weight=1/N, 합계≥1.0=승격). 단일 소스 80% 이상 편중 시 warning |

---

## 불변 원칙 준수 체크

- ✅ 원칙 1: build-auto-learn-promote.ts는 관측 이벤트만 승격 소스로 사용
- ✅ 원칙 2: build-t2-keyword-index.ts에서 DF≤15 필터 적용
- ✅ 원칙 3: N 차등 (Read within=3, Read across=2, Verifier=3, Vector=5)
- ✅ 원칙 4: trigger.keywords 필드 수정 코드 없음, auto-keywords 필드에만 append
- ✅ 원칙 5: enableT3Fallback, enableVerifier, enableChainBundling 각각 1줄 off 가능
- ✅ 원칙 6: 각 flag는 da-context.js 상단에 독립 상수로 위치
