# Progress — DA T2 매칭률 개선 구현 트래커

> SSOT plan: `plan.md` (6 확장 × 4 분류 + 해결책 R1-R5 + 시뮬레이션 설계)
> 규칙 seed: `CLAUDE.md` §불변 원칙 6 개 준수
> 각 step 은 `model: X` 또는 `wf: Y` 중 정확히 하나. 순서는 plan §6 A/B enable 순서 (상류→하류).

---

## Phase 0 — Setup

### Step 0.1 — 시뮬레이션 기반 무결성 확인
- [ ] `.simulation-data/{das, logs, queries-initial.jsonl}` 존재 확인
- [ ] sanitize 검증 (`grep -rE "jsh86|jsh8603"` 실행, 규칙 스크립트 제외 0 hits)
- [ ] `embed_service.py` 구동 (포트 8787, T3 준비)
- [ ] `pipeline/build-t2-keyword-index.ts` 로 51 DA 인덱싱
- **model: haiku** (기계적 검증 + 인덱스 빌드 명령 실행)

### Step 0.2 — 시뮬레이션 쿼리 확장
- [ ] `.simulation-data/queries-initial.jsonl` 60 건을 Opus Agent 로 300 건 확장 (조사 변형·오타·구어체 포함)
- [ ] `.simulation-data/queries-expanded.jsonl` 저장
- **wf: lightweight** (Supervisor + Sonnet Worker 쿼리 생성)

---

## Phase 1 — 즉시 편입 (E3 → E1)

### Step 1 — E3 T2→T3 즉시 Fallback
- 파일: `hooks/prompt/da-context.js` — T2 매칭 말미 조건 분기 추가
- Before→After: plan §2.2 참조
- 판정 기준: T3 호출 시 `.t3-fallback-hit.jsonl` append + 사용자 응답 200ms 이내 반환
- 경계: threshold 0.3 고정 (Day 1-7 Observation-only, R2 참조)
- **model: sonnet** (Sonnet-executable 5 항목 충족)

### Step 2 — E1 증거원 삼중화
- 파일: `pipeline/build-auto-learn-promote.ts` 신규 + `hooks/prompt/da-context.js` 수정
- Before→After: plan §2.1 참조
- 판정 기준: evidence_source 필드 부착 + 증거원별 N 차등 (3/2/3/5) 적용 + DF ≤15 필터
- **model: opus** (설계 판단 포함 — N 차등 근거, DF 상한 로직)

### Step 1+2 검증 — 시뮬레이션 1 회전
- [ ] 시뮬레이션 Step 1-4 (plan §5) 실행
- [ ] 15-dogfood 재측정 → baseline 80% 이상 유지 확인
- [ ] R1 uplift-commit: promote ≥3 건 (시뮬레이션 기준)
- [ ] R2 T3 baseline: 호출 ≥10 건/월 환산
- **model: sonnet** (측정 스크립트 실행 + 결과 파싱)

---

## Phase 2 — 구조 수정 편입 (E4 → E6)

### Step 3 — E4-enum-MVP Verifier
- 파일: `hooks/tool/verifier.js` 신규 + `config/verifier-prompt.txt` + settings.json `auditor` profile 등록
- Before→After: plan §2.3 참조
- **구현 제약 (Judge Action Item 1)**: Anthropic SDK tool-use 또는 JSON schema-enforced mode 필수. 프롬프트 기반 금지
- 판정 기준: JSON schema 준수율 ≥95% (R3 E4 측정 시점 Day 7)
- 경계: profile=auditor only 우선, coder/harness-worker 는 Future Gate
- **model: opus** (SDK integration + schema 설계 판단)

### Step 4 — E6-whitelist-first Phase 1
- 파일: `config/t2-whitelist.json` 신규 (사용자 수동 3-5 쌍 입력) + `hooks/prompt/chain-bundling.js` 신규
- Before→After: plan §2.4 참조
- 안전장치: 1-hop / Visited Set / 토큰 8k cap
- 판정 기준: whitelist 쌍 번들 주입 시 토큰 8k 미만 유지
- **model: sonnet** (구조 명확, Sonnet-executable 5 항목 충족)

### Step 3+4 검증 — 시뮬레이션 2 회전
- [ ] 시뮬레이션 재실행 (E3+E1+E4+E6 모두 활성)
- [ ] R3 표의 Day 7/14 메트릭 달성 확인
- [ ] Tier 5.0 → 5.3 전환 판정
- **wf: harness** (Worker 구현 + Verifier 측정 + Healer 미달 시 N 차등/threshold 조정)

---

## Phase 3 — Deferred / Trigger-gated 준비

### Step 5 — E2 Manual Seed + Phase 2 자동화 준비
- 파일: `config/t2-fewshot-seed.json` (사용자 수동 3 pair 입력) + `pipeline/build-t2-fewshot.ts` 신규 (Phase 3 자동화)
- 동작: Manual seed 는 즉시 활성, 자동 활성화는 L12.4 누적 promote ≥30 건 AND 고유 DA ≥10 개 조건 충족 시
- **wf: lightweight** (사용자 seed 입력 합의 + Sonnet Worker 스크립트 구현)

### Step 6 — E5 Trigger Monitor 배포
- 파일: `hooks/session/e5-trigger-monitor.js` 신규 + `pipeline/e5-trigger-check.ts` 신규
- 동작: 세션 종료 시 `.e5-trigger-log.jsonl` append, 3 세션 연속 flagged 감지 시 `~/.claude/.e5-activation-proposed` 생성
- **model: sonnet** (hook 구현 명확)

---

## Phase 4 — 운영 준비

### Step 7 — Future Activation Gate hooks
- 파일: `pipeline/future-activation-check.ts` 신규 + `hooks/session/future-activation-notify.js` 신규
- 동작: plan §8 표의 6 개 gate 조건 주기 점검 + 충족 시 알림 파일 생성
- **model: sonnet** (조건 판정 로직 명확)

### Step 8 — 정성 평가 + sunset 프로토콜 문서화
- 파일: `docs/qualitative-metrics-rubric.md` + `docs/sunset-clause-protocol.md` + `docs/uplift-commit-interpretation.md`
- R4 4 축 루브릭 + R1~R5 측정 계획 + 2 개월 판정 공식 명문화
- **model: sonnet** (plan 내용 문서화, 신규 설계 없음)

### Step 9 — L12.2 원칙 정합성 감사 + verifier spec
- 파일: `docs/invariant-principles-unified.md` + `docs/verifier-implementation-spec.md` + `docs/e5-trigger-protocol.md` + `docs/dry-run-measurement-plan.md`
- Judge Action Items 1, 2, 4, 6, 7 을 문서 산출물로 명문화
- **model: sonnet** (문서화 작업)

---

## Working Notes

> [ckpt-202604241225:Obsidian] DA project push 완료, ultraplan-ultrareview skill DA 문법 위반 감사 중
> - 마지막 결정: commit 285c8c4 push 완료 (plan.md + progress.md + CLAUDE.md + docs/debate-*-2026-04-24.md 7 + memory/MEMORY.md + .gitignore). promotion-log 에 K(Judge+Gemini 삼중화) + ERROR(Windows 백슬래시 sanitize Python str.replace) 2 건 prepend. 웹 agent 가 작성한 `~/.claude/skills/ultraplan-ultrareview/skill.md` 확인 결과 **DA slug heading 0 / Kind 필드 0** — DA 문법 위반으로 md-to-da 변환 불가 + guard 미발동 상태. enhanced-planning-wf/skill.md 의 phase2a DA 는 정상 (Related 에 ultraplan 스킬 포인터 ✓).
> - 다음 의도: compact 후 ultraplan-ultrareview/skill.md 를 DA 구조 (3 DA: ultraplan-execution-paths-and-status / ultraplan-escalation-judgment / ultrareview-cost-and-severity) 로 재작성. Kind/Priority/Modality/Trigger/When/If/Then/Because 필드 보강 + 기존 표·코드블록은 Detail 로 보존.
> - 동기화 필요: 재작성 후 `~/.claude/scripts/da-vector/structure-check.ts` 로 검증 + md-to-da.ts 재실행해 DA yaml 자동 생성 확인. 실패 시 enhanced-planning-wf/skill.md 의 DA 양식을 템플릿으로 재참조.

> [ckpt-202604241212:Obsidian] Plan seed 완료, 구현 미착수
> - 마지막 결정: D:/projects/DA 에 CLAUDE.md + plan.md + docs/debate-*-2026-04-24.md 7 개 + .simulation-data/ 전량 작성. debate verdict 6 확장 4 분류 반영.
> - 다음 의도: 본 progress.md 생성 후 commit + push → ULTRA PLAN agent 가 Phase 0.1 부터 실행
> - 동기화 필요: CLAUDE.md §Future Gates 표와 본 progress.md Phase 3/4 의 활성화 조건 일치 여부 재확인

---

## 참조

- `CLAUDE.md` — 프로젝트 컨텍스트 (ULTRA PLAN 진입점)
- `plan.md` — 6 확장 상세 + 시뮬레이션 + Action Items
- `docs/debate-verdict-2026-04-24.md` — 본 4 분류의 판정 원문
- `.simulation-data/` — 로컬 샘플 (51 DA + queries 60 건)
