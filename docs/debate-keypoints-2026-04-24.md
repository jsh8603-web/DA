# Debate Keypoints — Progressive Summarization

> 매 라운드 주요 충돌점 + 합의점 + 미해결 누적.
> Supervisor (Obsidian) 관리.

## Round 1 — Steelman vs Attack

### 공통 합의점 (양측 동의)

1. **P1 (L12.2 재발 방지) 전 확장 PASS** — Attack 도 §4 P1 PASS 유지. Steelman 의 핵심 방어 논거 (LLM 을 관측 이벤트 생산자 / 판정자 / fallback 호출자로 제한) 는 공격 대상 아님
2. **P4 (유지보수 0) 전 확장 PASS** — rebuild post-hook + tool call 이벤트 구조로 신규 cron 0
3. **E1 + E3 즉시 편입 적격** — 양측 모두 WARN 유지, FAIL 없음
4. **P2 empirical 공백은 전 확장 공통 약점** — Steelman self-admission, Attack 강화 공격

### 핵심 충돌점 (미해결)

| # | 쟁점 | Steelman 입장 | Attack 입장 | Judge 결정 요함 |
|---|---|---|---|---|
| K1 | E2 cold start 해석 | "cap 미달 → 정상 동작" | "21-28일 ROI 0 + Tier 선지불" | deferred 조건 채택 여부 |
| K2 | E4 naked string 정규화 | "조사 제거 + 경량 stemming 충분" | "한국어 파편화로 N 누적 실패" + DA-ID-enum 대안 | schema 변경 여부 |
| K3 | E5 ROI 정당성 | "주입 공간 경쟁 quantification" | "현재 pain 과 무관, premature" | trigger-gated 축소 여부 |
| K4 | E6 임계 근거 | "20% 예시" | "근거 0 + E4 의존 전염, whitelist 대안" | 폐기 또는 whitelist |
| K5 | 독립 토글 주장 | "6개 1줄 롤백 가능" | "DAG 의존으로 표면적, attribution 불가" | A/B uplift-commit 채택 여부 |
| K6 | Tier 팽창 정당화 | "+1-1.5 세션 수용" | "+22-33%, 기대 미달 롤백 부재" | 회복 조항 추가 여부 |

### 신규 논점 (Round 1 에서 처음 등장)

- **E4 schema 변경안**: `{missing_context:str}` → `{missing_da_ids:string[]}` enum — 자연어 생성 완전 제거, 파편화 구조적 불가
- **E6-whitelist**: 사용자 수동 3-5쌍 지정 — 임계 의존성·E4 의존성 동시 제거, 1인 규모 최적화
- **A/B + uplift-commit + 회복 조항**: 6 확장 순차 enable + 확장별 사전 기대치 + 2개월 후 <+3%p 시 Tier 원복 검토
- **최소 시나리오**: E1+E3 (즉시) / E4-MVP (조건부, DA-ID-enum + auditor only) / E2 deferred / E5 trigger-gated / E6 whitelist or 폐기

### Attack 이 제공한 Concrete Alternative 6건

1. **E2-deferred**: L12.4 누적 promote ≥30 AND 고유 DA ≥10 시 자동 활성화
2. **E2-manual-seed**: 사용자 수동 3-5 pair seed 로 cold start 해결
3. **E4-DA-ID-enum**: Verifier 가 DA ID 목록에서 선택 (자연어 생성 X)
4. **E4-MVP**: profile gating 3개 → auditor only 1개로 복잡도 1/3 축소
5. **E5-trigger-gated**: "주입 DA hit 안 된 비율 ≥50% 3 세션 연속" 관측 시만 활성화
6. **E5-micro**: dry-run 3값→2값 × 4지표→1지표 × 3반복→1반복 (3-6주 → 1-2주)
7. **E6-whitelist**: 사용자 명시 3-5 쌍만 bundling
8. **A/B-attribution + uplift-commit + 회복 조항**: ROI attribution + 기대 미달 롤백 체계

### 수렴 판정 예비 평가 (Rebuttal 수신 후 확정)

- **신규 논점 0개?**: Round 1 에서 충분히 발생. Round 2 에서 새 논점 나올지 Rebuttal 보고 판정
- **미해결 항목 "데이터/실험 필요" 유형?**: K1~K6 대부분이 실측 의존 → 토론 수렴 후 dry-run 으로 이관 가능
- **핵심 충돌 해소?**: Rebuttal 에서 schema 변경 수용 / 보류 분류 수용 여부가 관건

예상: Rebuttal 이 대안 다수를 수용하면 Round 2 없이 Judge 직행 가능.

## Round 1 Rebuttal 결과

### Rebuttal 판정 요약
- **E1, E3**: 방어 유지 → 즉시 편입 (원안)
- **E4**: Concede → E4-enum-MVP (DA-ID-enum + auditor only). P3 FAIL→PASS
- **E5**: Concede → E5-trigger-gated (관측 조건 충족 시만)
- **E2**: Compromise → E2-hybrid (manual seed Day 0-30 + 자동 Day 30+)
- **E6**: Compromise → E6-whitelist-first (사용자 3-5쌍 수동 + upgrade path)
- **공통**: A/B enable + uplift-commit + Tier 회복 조항 전면 수용

### 3 수렴 조건 체크

1. **신규 논점 0개** ✓ — Rebuttal 의 hybrid/whitelist-first 는 Attack 대안의 조합, 신규 논점 아님
2. **미해결 항목 "데이터/실험 필요" 유형** ✓ — 전 확장 P2 WARN 은 1-2주 실측으로 해소 가능
3. **핵심 충돌 해소** ✓ — K1~K6 모든 쟁점이 concede/compromise 로 정리됨

**판정: 수렴 달성. Round 2 불필요. Step 4 Judge 직행.**

### Judge 에게 전달할 핵심 질문

1. Rebuttal 의 **최종 합의안 4 분류** (즉시 / 구조 수정 편입 / deferred / trigger-gated) 가 타당한가?
2. **Tier 재매핑** (4.5 → 5.0 + Phase 1 확장 +0.5 = 5.3 최대) 이 정당한가?
3. Rebuttal 이 놓친 **숨은 리스크** 가 있는가?
4. **uplift-commit 수치** (E1=5/month, E2=+2%p 등) 가 적정한가?
