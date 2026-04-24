---
tags:
  - type/doc
  - domain/rag-rules
  - load/on-demand
date: 2026-04-23
---

(root: file-standards.md → 운영 SSOT · OPERATIONS_INDEX 등재)

# LLM-free DA Pipeline — Operations SSOT

> **상위 아키텍처 (허브 SSOT)**: [`~/.claude/docs/operations/da-system-architecture.md`](~/.claude/docs/operations/da-system-architecture.md) — 본 파이프라인은 DA 시스템 전체 3-layer 중 **SOURCE → CANONICAL 변환 구간** 을 담당. 3축 semantic graph / 훅 / DA 화 coverage 전반은 허브 SSOT 참조.
>
> **배경**: `rules/*.md` 와 `docs/**/*.md` 의 `## {slug}` 섹션을 **결정론적 rule-based parser** 로 Decision Asset (YAML) 로 변환하고, BGE-M3 임베딩 → LanceDB 색인 → MCP RAG 주입까지 연결하는 엔드투엔드 파이프라인. LLM 재작성 없이 `md` 한 번 수정하면 편집 사이클 안에서 YAML 자동 갱신. llm-free-da-rollout (2026-04-22~23) 완료 산출물 SSOT.
>
> **본 문서 수정 시 함께 갱신할 파일**:
> | # | 파일 | 갱신 내용 |
> |---|------|----------|
> | 1 | `~/.claude/docs/operations/OPERATIONS_INDEX.md` | 본 파일 포인터 (등재 여부) |
> | 2 | `~/.claude/docs/verification/audit-system.md` §md-grammar drift 주기 스윕 | 감사 wf 의 스윕 주기·판정 기준 |
> | 3 | `~/.claude/docs/operations/hook-guard-review.md` | md-grammar-lint / md-edit-preflight 등록 상태 |

## 1. 구성 요소

| # | 파일 | 역할 |
|---|---|---|
| S1 | `scripts/da-vector/md-to-da.ts` | **결정론적 parser** — MD 섹션 → DA YAML. `--rule-check` 모드로 unmatched 감지 |
| S2 | `scripts/da-vector/llm-free/lexicon-nl-grammar.yaml` | **T1 lexicon** (endings 7 / connectives 33 / verbs 34). 매칭 기준 |
| S3 | `scripts/da-vector/llm-free/SCHEMA.md` | DA YAML 스키마 명세 (kind / trigger / when / if / then / because / sources / status / last-verified 등) |
| S4 | `rules/md-grammar.md` | T1 인젝트 대상. 작성자 (agent) 에게 T1 어휘 안내 |
| S5 | `scripts/da-vector/rebuild.ts` | DA YAML → BGE-M3 임베딩 → LanceDB 색인. `ACTIVE_STATUSES={active,dormant}` filter 적용 |
| S6 | `scripts/da-vector/rebuild-batch.sh` | 수동/cron 재색인 래퍼. `_rebuild.log` 기록 |
| S7 | `scripts/da-vector/rollout-sweep.sh` | 37 파일 rule-check 스윕. `_rollout_unmatched_baseline.json` 생성 |
| H1 | `hooks/md-edit-preflight.js` | **PreToolUse** (Write/Edit/MultiEdit, rules/docs 하위 .md) — 편집 전 T1 어휘 리마인더 inject |
| H2 | `hooks/md-grammar-lint.js` | **PostToolUse** — rule-check 통과 시 auto-yaml write (`runAutoWrite`), 실패 시 unmatched sendkey 피드백 |

## 2. 편집 사이클 흐름

```
사용자 (또는 agent) 가 rules/*.md 또는 docs/**/*.md 섹션 Edit
  │
  ├─ PreToolUse (md-edit-preflight)
  │    → T1 어휘 리마인더 additionalContext inject
  │
  ├─ Edit/Write 수행
  │
  ├─ PostToolUse (md-grammar-lint)
  │    ├─ runRuleCheck → npx tsx md-to-da.ts --rule-check
  │    │    ├─ PASS (0 unmatched) → runAutoWrite → decisions/DA-*.yaml 자동 갱신
  │    │    └─ FAIL (unmatched > 0) → buildFeedback + psmux sendkey warn
  │    └─ audit-log 이벤트: auto_yaml_done / auto_yaml_error / rule_check_unmatched
  │
  └─ (수동) bash rebuild-batch.sh → BGE-M3 임베딩 → LanceDB 재색인
```

## 3. 작동 검증 방법

### 3-1. 교정기 (md-grammar-lint) 작동 확인

```bash
# 1. rule-check 직접 실행 (전체 37 파일)
bash ~/.claude/scripts/da-vector/rollout-sweep.sh
# 기대: SUMMARY files=37 total_unmatched=0

# 2. 단일 파일 확인
cd ~/.claude/scripts/da-vector
npx tsx ./md-to-da.ts ~/.claude/rules/file-standards.md --rule-check
# 기대: total: N sentences, 0 unmatched

# 3. audit-log 최근 이벤트 확인
grep -E "auto_yaml|rule_check" ~/.claude/audit-log/$(date -I).jsonl | tail -10
# 기대: auto_yaml_done / rule_check_pass 가 최신 쓰기 직후 기록
```

### 3-2. DA 생성 감지

```bash
# 1. decisions 디렉토리 파일 수
ls ~/.claude/decisions/DA-*.yaml | wc -l
# 2. 특정 slug 의 YAML 존재 확인
ls ~/.claude/decisions/DA-20260422-{slug}.yaml
# 3. YAML 내용 검증 (when/if/then/because 필드 존재)
head -40 ~/.claude/decisions/DA-20260422-{slug}.yaml
```

### 3-3. E2E 검증 (hook → YAML → rebuild → search)

```bash
# 1. 테스트 MD 작성
cat > ~/.claude/rules/_test.md <<EOF
# Test
## test-slug
**Kind**: guard
**When**: 테스트할 때
**If**: 검증이 필요한 경우
**Then**: 반드시 확인한다
**Because**: 파이프라인이 동작한다
EOF

# 2. 2-3초 대기 → YAML 생성 확인
ls ~/.claude/decisions/DA-20260422-test-slug.yaml

# 3. rebuild 후 search
bash ~/.claude/scripts/da-vector/rebuild-batch.sh
# 직접 tsx 실행 스크립트로 searchDA 조회

# 4. Cleanup
rm ~/.claude/rules/_test.md ~/.claude/decisions/DA-20260422-test-slug.yaml
bash ~/.claude/scripts/da-vector/rebuild-batch.sh
```

## 4. 감사 wf 연동

- **주 2회 (월/목)** `audit-system.md §md-grammar drift 주기 스윕` 에 따라 `rollout-sweep.sh` 실행
- 이전 baseline 대비 unmatched 증가 → md-DA drift 발생 판정 → 해당 파일 교정 또는 lexicon 확장

## 5. Lexicon 확장 정책 (incident-driven)

- T1 (74 endings+connectives+verbs) 는 고정. 변경 금지
- T2/T3 확장은 **사용자 승인 게이트** 필수
- 확장 기준: (a) 실제 incident 발생 (unmatched 사고) (b) 의미 drift 없음 (c) 기존 어휘로 대체 불가
- 확장 시 `lexicon-nl-grammar.yaml` version bump + promotion-log K entry

## 6. 4-state Lifecycle (최소 훅)

현재 구현: `rebuild.ts` 의 `ACTIVE_STATUSES = {active, dormant}` filter 만.

| status | 색인 | 사용 시점 |
|---|---|---|
| active | ✅ | 기본 값. 일반 운영 |
| dormant | ✅ | 장기 미사용 (hit 0, N일 경과). 복귀 가능 |
| archived | ❌ | 더 이상 안 쓰는 규칙. YAML 보존, 검색 제외 |
| deprecated | ❌ | 잘못된/무효 규칙. YAML 보존 (감사 기록), 검색 제외 |

**강등 신호 4종** (감지 경로 — MD Read 불필요):
1. **Hit 부재** — MCP search 이벤트 누적 + `last-hit` N일 경과 (미구현)
2. **ERROR link** — `promotion-log` ERROR 엔트리에 DA ID 태그 집계 (미구현)
3. **Orphan** — `sources.canonical` resolve 실패 (파일/섹션 없음 or section-sha256 불일치). rebuild 시점 감지 가능
4. **User explicit** — 사용자 명시 요청 또는 MD frontmatter `status: deprecated` 표기

완전한 lifecycle 구현 (자동 강등 판정) 은 별도 `plan-da-lifecycle.md` 에서 처리.

## 7. 운영 통계 (2026-04-23 기준)

- **DA 총 수**: 53 (succeeded=44 / failed=7 / skipped=2 archived)
- **Corpus**: 37 파일 (rules/ + docs/operations/ + docs/verification/)
- **Match rate**: 560 sentences / 0 unmatched (100%)
- **T1 lexicon**: 331 entries (endings 7 + connectives 33 + verbs 34 + 기타 T2/T3)

## 8. 관련 자료

- archive plan: `D:/projects/Obsidian/.plan-archive/plan-2026-04-22-llm-free-da-rollout.md`
- archive progress: `D:/projects/Obsidian/.plan-archive/progress-2026-04-22-llm-free-da-rollout.md`
- 리서치 SSOT: `~/.claude/memory/research/cnl-md-to-da.md` (Blue Ocean 판정 + 선행 연구 7개 비교)
- promotion-log K entry: `~/.claude/memory/promotion-log.md §K-20260422-llm-free-da-rollout`

## 9. 재작성 원칙 (narrative → DA 구조화)

> 본 섹션은 **DA Coverage Extension plan** (2026-04-23~, `D:/projects/Obsidian/plan-da-coverage-extension.md`) Phase A.4 산출. rules/*.md narrative, docs/ 긴 가이드, skills/**/skill.md 를 DA 스키마로 재작성할 때 agent (Opus 직접 또는 wf: coding sub-agent) 가 따르는 원칙.
>
> **2026-04-23 A.5 실측 반영**: 9 파일 샘플 평균 T1+T2+T3 매칭률 93% → lexicon 확장이 아니라 **bold-marker 구조화** 에 집중.

### 9.1 Bold-marker 구조화 (핵심 작업)

재작성 절차:

1. `## {kebab-slug}` 섹션 헤더 확보 (없으면 신설, slug 는 kebab-case)
2. 섹션 본문을 **필수 bold-marker** 로 분해:
   - `**Kind**:` — `guard` / `heuristic` / `constraint` / `pattern` / `scenario` 중 택일
   - `**When**:` — 발동 조건 (시점 기반)
   - `**If**:` — 활성 조건 (상태 기반, 선택)
   - `**Then**:` — 해야 할 행동
   - `**Because**:` — 근거 / 이유
   - `**Signal-to-Action**:` — 1-2 문장 요약 (의미 drift 검증용)
3. 원본 narrative 요소를 아래 3 종 중 하나로 라우팅:
   - **§ 배경 / 왜 중요한가** → DA `**Because**:` 블록으로 분해
   - **표 / 리스트 / 코드 샘플** → DA `**Examples**:` bullet list 또는 `**Detail**:` 표
   - **자유 서술 / 일화 / 주의** → `**Narrative**:` 블록으로 격리 (rule parser 가 skip)

### 9.2 Meaning Drift 방지

- 재작성 **전**에 원본 narrative 의 핵심 주장 3-5개를 bullet 로 추출 → 재작성 **후** 이 bullet 이 DA 섹션에 모두 포섭됐는지 셀프 체크
- `**Signal-to-Action**:` 블록이 원본 narrative 의 요지를 1-2 문장으로 압축. 이 요약이 원본과 의미 동치 아니면 재작성
- 의심 케이스는 agent 단독 판정 금지 → supervisor (Opus) 승인

### 9.3 Skill / 절차성 문서의 처리

skill.md 와 일부 긴 가이드는 **procedural** 성격이라 단순 if-then DA 에 어색하다. 해결:

- **Parent-rule + Children** 구조
  - Parent = "절차 전체의 트리거 / 경계 / 완료 조건" (Kind: `pattern`)
  - Children = 각 step 을 독립 DA (Kind: `constraint` 또는 `scenario`)
  - 관계 선언: Children DA 의 `**Parent-rule**:` 필드 / Parent DA 는 포인터 목록
- **Branches 필드** (Kind: `scenario` 한정)
  - `**Branches**:` 블록에 `- [if] {조건} → [then] {행동}` bullet
  - 예: `decisions/DA-20260422-ckpt-route-by-progress.yaml` 참조

### 9.4 T1 어휘 (기존 `md-grammar.md` 와 일치)

- 문장 ending 은 `-한다 / -해야 한다 / -이다 / -됨 / 반드시 / -금지 / - [ ]` 중 하나 사용
- `-된다` 는 T1 미등록 → `-됨` / `-이다` / `-한다` 중 문맥 맞는 것으로 교체
- `**Narrative**:` 블록 본문은 lexicon 매칭에서 제외되므로 자유 문체 허용 (일화·긴 설명·구어체 등은 이쪽으로)

### 9.5 구조 lint 통과 조건 (완료 판정)

각 파일 재작성 완료 = 아래 2 명령 모두 PASS:

```bash
cd ~/.claude/scripts/da-vector
# (a) 구조 검증 — S1-S4 0 violation
npx tsx ./md-to-da.ts <file> --structure-check
# → totalViolations: 0

# (b) 문법 검증 — unmatched 0
npx tsx ./md-to-da.ts <file> --rule-check
# → total: N sentences, 0 unmatched
```

### 9.6 Sub-agent 배정 가이드 (Opus-only 파일)

다음 파일은 **Opus 직접** 처리 권장 — self-reference skill 을 sub-agent 가 Edit 하는 중 self-stall 위험이 있다.

- `~/.claude/skills/enhanced-coding-wf/skill.md`
- `~/.claude/skills/lightweight-wf/skill.md`
- `~/.claude/skills/harness-wf/**/*.md`
- `~/.claude/skills/handoff-plan-wf/skill.md`
- `~/.claude/skills/search-engine/skill.md`
- `~/.claude/skills/audit-wf/skill.md`

### 9.7 Lexicon 확장 정책 (incident-driven, §5 와 정합)

재작성 중 unmatched 문장 발견 시 해결 순서:

1. **1차**: narrative 블록으로 이동 (rule parser 가 skip 하므로 자유 문체 가능)
2. **2차**: 기존 T1 어휘로 문장 재구성 (lexicon 에 있는 동의 동사·어미 활용)
3. **3차 (incident 경로)**: 두 경로 모두 적절치 않으면 supervisor Opus 에 승인 요청 → `lexicon-nl-grammar.yaml` version bump + promotion-log K entry. sub-agent 는 supervisor 복귀 후 처리.

### 9.8 자주 보이는 narrative 패턴 → DA 구조 변환 템플릿

재작성 시 자주 마주치는 narrative 유형을 DA 로 옮기는 방법. 원본을 **없애는 것이 아니라 DA 스키마로 옮겨서 자동 색인 대상에 편입**시키는 것이 목적.

#### 템플릿 T-1: 배경 / 역사 / 왜 이 규칙이 있는가 → `**Because**:` + 선택적 `**Narrative**:`

**Before**:
```
> 배경: 2026-04 에 X 사고가 발생했다. 그래서 이 규칙을 도입했다.
> 이 규칙 없이는 Y 가 재발할 수 있다.
```

**After**:
```
**Because**: 과거 X 사고 (2026-04 promotion-log 참조) 로 도입됐다. 이 규칙 없으면 Y 재발 위험.

**Narrative**: (긴 회고·일화는 이 블록에 — 자유 문체, rule parser skip)
```

#### 템플릿 T-2: "X 할 때는 Y 하라" 류 조건부 지침 → `**When**:` + `**If**:` + `**Then**:`

**Before**:
```
사용자가 A 를 요청하면, B 상태인 경우에만 C 를 수행한다.
```

**After**:
```
**When**: 사용자가 A 를 요청하는 시점
**If**: 대상이 B 상태인 경우
**Then**: 반드시 C 를 수행한다
```

#### 템플릿 T-3: 상황별 분기 표 → `**Branches**:` (Kind: scenario)

**Before**:
```
| 상황 | 행동 |
|---|---|
| 케이스 A | 1 을 실행 |
| 케이스 B | 2 를 실행 |
```

**After**:
```
**Branches**:
- [if] 케이스 A → [then] 1 을 실행한다
- [if] 케이스 B → [then] 2 를 실행한다
```

예: `decisions/DA-20260422-ckpt-route-by-progress.yaml` 참조.

#### 템플릿 T-4: 속성 / 설정 / 체크리스트 표 → `**Detail**:` 보존

**Before / After 동일** (표 구조 유지). rule parser 는 표를 skip 하지만 DA YAML 의 `detail-table` 필드로 보존되고 RAG embedding 시 `include-in-embed: true` 마커로 포함된다.

```
**Detail**:
| key | value | example |
|---|---|---|
| ... | ... | ... |
```

#### 템플릿 T-5: 예시 문구 list → `**Examples**:` bullet (quoted)

**Before**:
```
예를 들어:
- "이거 어떻게 써?"
- "ERROR 났을 때 어떻게 해?"
```

**After**:
```
**Examples**:
- "이거 어떻게 써?"
- "ERROR 났을 때 어떻게 해?"
```

사용자 발화 관점 예시는 RAG 매칭 (query → DA) 에 직접 기여하므로 적극 활용.

#### 템플릿 T-6: "주의 / 하지 말 것" 류 경고 → `**Anti-pattern**:` + `**Counter-example**:`

**Before**:
```
⛔ 주의: X 하면 Y 가 깨진다.
```

**After**:
```
**Anti-pattern**: X 를 하면 Y 가 깨진다. 대신 Z 를 수행한다.
**Counter-example**: 단, {예외 케이스} 에서는 X 허용.
```

#### 템플릿 T-7: 다단계 절차 (1→2→3) → Parent-rule + Children DA

skill.md 같은 절차성 문서 전용.

**Before**: `## 단계 1 ...`, `## 단계 2 ...`, `## 단계 3 ...` 평탄하게 나열

**After**:
- Parent DA: `## {wf}-overview` (Kind: pattern) — 절차 전체 트리거·경계·완료 조건
- Child DA: `## {wf}-step-1` (Kind: constraint/scenario) — 각 step 독립. `**Parent-rule**: {wf}-overview` 필드로 선언

#### 템플릿 T-8: 파일 / 경로 나열 → `**Trigger**: file-globs` + `**Examples**:`

**Before**:
```
대상 파일: `~/.claude/rules/foo.md`, `~/.claude/docs/bar.md`
```

**After**:
```
**Trigger**:
- File globs: `~/.claude/rules/foo.md`, `~/.claude/docs/bar.md`

**Examples**:
- "foo.md 편집 시 주의사항"
- "bar.md 의 X 섹션이 뭐야"
```

#### 템플릿 T-9: 자연어 일화 / 긴 설명 / 구어체 → `**Narrative**:` 블록으로 격리

Lexicon 매칭을 시도하지 않는 유일한 블록. 의미가 중요해서 보존하고 싶지만 T1 규격화가 부자연스러운 서술은 여기로.

```
**Narrative**: 
2026-04 에 있었던 일: 사용자가 A 를 요청했는데 내가 B 로 오인해서 C 로 Write 함.
그 결과 D 가 발생했고... (자유 문체)
```

#### 템플릿 T-10: "이거 쓰지 마 / 이건 금지" 류 → 긍정 서술 + `**Anti-pattern**:`

금지만 쓰면 대안이 불명확해 agent 가 재발 → 긍정 템플릿으로 변환.

**Before**: "이 파일을 직접 Write 하지 마"

**After**:
```
**Then**: `registry-cli.js` 경유로만 수정한다
**Anti-pattern**: `fs.writeFile(registryPath, ...)` 직접 호출 → race condition + hook miss
```

---

## 10. rules 자동로드 스코핑 및 복원 절차

> 공식 로드 규칙·3 경로 비교·판정 SSOT = `rules/file-standards.md §rules-autoload-exclusion`. 본 섹션은 **실제 적용·복원 절차** 만 담는다.

### 10.1 적용 절차 (자동로드 해제)

**A. `paths:` frontmatter 추가** (자연 path 매칭 가능 rules):
```bash
# 대상 파일의 frontmatter 에 paths 배열 추가
# 예시: vaultvoice.md
```
```yaml
---
tags: [규칙, VaultVoice]
paths:
  - "**/99_vaultvoice/**"
  - "**/vaultvoice/**"
date: 2026-04-10
---
```
- ⚠️ universal glob (`**/` 시작) 만 사용한다. tilde(`~/`)·절대경로는 공식 docs 미명시.
- 예시 대상: `vaultvoice.md` (VaultVoice 파일 편집 맥락), `md-grammar.md` (rules/docs/skills md 편집 맥락)

**B. `claudeMdExcludes` 배열 추가** (path 매칭 불가 rules):
```json
// ~/.claude/settings.local.json
{
  "outputStyle": "Teaching (비개발자용)",
  "claudeMdExcludes": [
    "C:/Users/jsh86/.claude/rules/file-standards.md",
    "C:/Users/jsh86/.claude/rules/pc-tools.md",
    "C:/Users/jsh86/.claude/rules/reliability-drift.md",
    "C:/Users/jsh86/.claude/rules/remote-session.md"
  ]
}
```
- ⚠️ absolute path + glob 만 유효. 상대경로 매칭 실패.
- 예시 대상: `file-standards.md` (전역), `pc-tools.md` (tool 맥락), `reliability-drift.md` (cwd/registry 맥락), `remote-session.md` (환경변수 맥락)

**C. 검증**:
```bash
# 새 session spawn → /memory 로 로드 파일 확인
# 또는 InstructionsLoaded hook 활성화 (디버그 시)
```

### 10.2 복원 절차 (자동로드 재개)

**A. `paths:` 제거** (전체 자동로드 재개):
- 대상 파일의 frontmatter 에서 `paths:` 필드 + 하위 배열 행 삭제
- 복원 즉시 unconditionally 로드로 전환

**B. `claudeMdExcludes` 제거**:
```bash
# settings.local.json 에서 해당 경로 삭제 또는 배열 비우기
```
- `claudeMdExcludes` 가 빈 배열이면 exclude 효과 없음
- 일부만 복원 시: 해당 경로 항목만 삭제

**C. 전체 원복**:
```bash
# settings.local.json claudeMdExcludes 키 자체 제거
# + rules/*.md paths 필드 제거
# 검증: 새 session 에서 /memory 에 모든 rules 재등장 확인
```

### 10.3 Phase F 검증 체크리스트

| # | 확인 | 기준 |
|---|---|---|
| F.1 | 자동로드 해제 확인 | 새 session `/memory` 에 exclude 된 rules 미표시 |
| F.2 | DA RAG precision 재측정 | baseline (42 DA / 0.467) 대비 240 DA 에서 precision 유지 또는 향상 |
| F.3 | Dogfooding agent drift | 3~5 session 실사용 후 "file-standards 내용 재회수 실패" ERROR 집계. 3 회+ 발생 시 exclude 일부 되돌림 |
| F.4 | 원복 경로 동작 | `claudeMdExcludes` 키 제거 후 `/memory` 에 모든 rules 재등장 |

### 10.4 Lessons Learned

| # | 교훈 | 근거 |
|---|---|---|
| L1 | `load/always` tag 등 로컬 frontmatter 필드는 공식 로드 제어 아님 | 공식 docs code.claude.com/docs/en/memory 검증 (2026-04-24) |
| L2 | `paths:` 에 tilde·절대경로 사용 금지, universal glob `**/` 시작만 안전 | 공식 docs 예시 전수 상대 glob 만, User-level rules 해석 미명시 |
| L3 | exclude 해제 시 DA RAG 가 실제로 회수하는지 Dogfooding 필수 | precision 46.7% baseline — 특정 주제는 retrieval miss 가능 |
| L4 | managed policy CLAUDE.md 는 exclude 불가 | 공식 docs 명시. 개인 설정으로 차단 불가능한 정책 하드코딩 |
