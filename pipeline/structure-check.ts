// structure-check.ts — DA YAML 스키마 구조 검증 (S5 chain + S7 keyword)
// 기존 S1-S4 는 md-to-da.ts 내 runStructureCheck() 에서 처리.
// S5 = chain kind 완결성 / S7 = keyword 최소 3자 + 최대 10개 (L11.5)
//
// CLI: npx tsx ~/.claude/scripts/da-vector/structure-check.ts --file {yaml-path}
//      npx tsx ~/.claude/scripts/da-vector/structure-check.ts --dir {decisions-dir}

import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";

// ============================================================
// 타입 정의
// ============================================================

export interface Violation {
  code: "S5" | "S7" | "S8" | "S9";
  detail: string;
}

// backward compat alias
export type S5Violation = Violation;

const ACTOR_ENUM = new Set<string>([
  "Worker", "Verifier", "Healer", "SR", "Supervisor", "System",
]);

// ============================================================
// S5 검증 — chain kind 완결성
// ============================================================

export function checkS5(daId: string, da: Record<string, unknown>): Violation[] {
  const violations: Violation[] = [];
  const kind = da.kind as string | undefined;

  if (kind !== "chain") return [];

  const sequence = da.sequence as unknown[] | undefined;

  // S5-1: sequence 필드 필수 (빈 배열 금지)
  if (!sequence || !Array.isArray(sequence) || sequence.length === 0) {
    violations.push({
      code: "S5",
      detail: `S5: chain kind requires 'sequence' field (non-empty) — DA: ${daId}`,
    });
    return violations; // 이후 검증 불가
  }

  // S5-2: sequence.length >= 3
  if (sequence.length < 3) {
    violations.push({
      code: "S5",
      detail: `S5: chain sequence must have >= 3 steps (current: ${sequence.length}) — DA: ${daId}`,
    });
  }

  const lastIdx = sequence.length - 1;

  sequence.forEach((stepRaw, i) => {
    const step = stepRaw as Record<string, unknown>;
    const stepId = step.step ?? i + 1;

    // S5-3: 각 step 의 action 필드 필수
    if (!step.action || (step.action as string).trim() === "") {
      violations.push({
        code: "S5",
        detail: `S5: chain sequence step ${stepId} missing 'action' — DA: ${daId}`,
      });
    }

    // S5-4: actor enum 검증 (actor 가 있을 때만)
    if (step.actor !== undefined && step.actor !== null) {
      const actor = step.actor as string;
      if (!ACTOR_ENUM.has(actor)) {
        violations.push({
          code: "S5",
          detail: `S5: chain sequence step ${stepId} actor '${actor}' not in enum {Worker,Verifier,Healer,SR,Supervisor,System} — DA: ${daId}`,
        });
      }
    }

    // S5-5: Terminal step 규칙 (A) — 마지막 step 으로의 goto 참조 금지
    // step.next 또는 condition.goto-step 이 마지막 index 를 참조하면 에러
    if (i < lastIdx) {
      const nextRef = (step as any)["next"];
      if (nextRef === lastIdx || nextRef === lastIdx + 1) {
        violations.push({
          code: "S5",
          detail: `S5: terminal rule (A) violation — step ${stepId} references last index ${lastIdx} via 'next' — DA: ${daId}`,
        });
      }
      const gotoStep = (step as any)["goto-step"];
      if (gotoStep === lastIdx || gotoStep === lastIdx + 1) {
        violations.push({
          code: "S5",
          detail: `S5: terminal rule (A) violation — step ${stepId} references last index ${lastIdx} via 'goto-step' — DA: ${daId}`,
        });
      }
    }
  });

  return violations;
}

// ============================================================
// S7 검증 — trigger.keywords 최소 3자 + 최대 10개 (L11.5)
// ============================================================

const S7_MIN_KW_LEN = 3;
const S7_MAX_KW_COUNT = 10;

export function checkS7(daId: string, da: Record<string, unknown>): Violation[] {
  const violations: Violation[] = [];
  const trigger = (da.trigger ?? {}) as Record<string, unknown>;
  const keywords = trigger.keywords;

  if (!Array.isArray(keywords)) return []; // keywords 는 선택적

  // S7-1: 각 keyword 길이 >= 3 자
  keywords.forEach((kw, i) => {
    const s = String(kw).trim();
    if (s.length > 0 && s.length < S7_MIN_KW_LEN) {
      violations.push({
        code: "S7",
        detail: `S7: keyword[${i}] '${s}' length ${s.length} < ${S7_MIN_KW_LEN} — DA: ${daId}`,
      });
    }
  });

  // S7-2: keywords 배열 길이 <= 10
  if (keywords.length > S7_MAX_KW_COUNT) {
    violations.push({
      code: "S7",
      detail: `S7: keywords count ${keywords.length} > ${S7_MAX_KW_COUNT} (max) — DA: ${daId}`,
    });
  }

  return violations;
}

// ============================================================
// S8 검증 — example-queries 최소 1개 (L12.3, DA 작성자 실측 의도 노출 강제)
// ============================================================

export function checkS8(daId: string, da: Record<string, unknown>): Violation[] {
  const eq = da["example-queries"];
  if (!Array.isArray(eq) || eq.length < 1) {
    return [{
      code: "S8",
      detail: `S8: 'example-queries' 최소 1개 필수 (현재: ${Array.isArray(eq) ? eq.length : "missing"}) — DA: ${daId}`,
    }];
  }
  return [];
}

// ============================================================
// S9 검증 — keyword 총합 최소 3 (L12.3, trigger.keywords + auto-keywords)
// ============================================================

const S9_MIN_KW_TOTAL = 3;

export function checkS9(daId: string, da: Record<string, unknown>): Violation[] {
  const trigger = (da.trigger ?? {}) as Record<string, unknown>;
  const manual = Array.isArray(trigger.keywords) ? trigger.keywords.length : 0;
  const auto = Array.isArray(da["auto-keywords"]) ? (da["auto-keywords"] as unknown[]).length : 0;
  const total = manual + auto;
  if (total < S9_MIN_KW_TOTAL) {
    return [{
      code: "S9",
      detail: `S9: keyword 총합 ${total} < ${S9_MIN_KW_TOTAL} (manual=${manual}, auto=${auto}) — DA: ${daId}`,
    }];
  }
  return [];
}

// ============================================================
// 단일 YAML 파일 검사
// ============================================================

async function checkFile(filePath: string): Promise<{ daId: string; violations: Violation[] }> {
  const raw = await fs.readFile(filePath, "utf-8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { daId: path.basename(filePath, ".yaml"), violations: [] };
  }
  const da = yaml.load(match[1]) as Record<string, unknown>;
  const daId = (da.id as string) ?? path.basename(filePath, ".yaml");
  const violations = [
    ...checkS5(daId, da),
    ...checkS7(daId, da),
    ...checkS8(daId, da),
    ...checkS9(daId, da),
  ];
  return { daId, violations };
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const dirIdx = args.indexOf("--dir");

  if (fileIdx !== -1 && args[fileIdx + 1]) {
    // 단일 파일 모드
    const filePath = args[fileIdx + 1];
    const { daId, violations } = await checkFile(filePath);
    if (violations.length === 0) {
      console.log(`✓ ${daId}: S5 PASS`);
    } else {
      for (const v of violations) {
        console.error(`✗ ${v.detail}`);
      }
      process.exit(1);
    }
    return;
  }

  if (dirIdx !== -1 && args[dirIdx + 1]) {
    // 디렉토리 모드
    const dir = args[dirIdx + 1];
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".yaml"));
    let totalS5 = 0;
    let totalS7 = 0;
    let totalS8 = 0;
    let totalS9 = 0;
    let totalChain = 0;
    for (const f of files) {
      const { violations } = await checkFile(path.join(dir, f));
      if (violations.length > 0) {
        for (const v of violations) {
          if (v.code === "S5") totalS5++;
          else if (v.code === "S7") totalS7++;
          else if (v.code === "S8") totalS8++;
          else if (v.code === "S9") totalS9++;
          console.error(`✗ ${v.detail}`);
        }
      }
      // chain kind 건수 집계
      const raw = await fs.readFile(path.join(dir, f), "utf-8");
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (m) {
        const da = yaml.load(m[1]) as Record<string, unknown>;
        if (da.kind === "chain") totalChain++;
      }
    }
    const totalViolations = totalS5 + totalS7 + totalS8 + totalS9;
    console.log(
      `\n[structure-check] ${files.length} yamls scanned, ${totalChain} chain DAs — S5 ${totalS5} / S7 ${totalS7} / S8 ${totalS8} / S9 ${totalS9} violations (total ${totalViolations})`
    );
    process.exit(totalViolations > 0 ? 1 : 0);
    return;
  }

  console.error(
    "Usage:\n" +
    "  npx tsx structure-check.ts --file <yaml-path>     # 단일 DA 검사\n" +
    "  npx tsx structure-check.ts --dir <decisions-dir>   # 디렉토리 전체 S5 검사"
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("[structure-check] FATAL:", err);
  process.exit(1);
});
