/**
 * chain-kind-guard.js — PreToolUse Write|Edit hook (B.6-α)
 *
 * chain kind DA 편집 시 Sequence 블록 완결성 검증:
 * 1. 대상 파일 패턴: ~/.claude/rules/*.md / ~/.claude/docs/**\/*.md / ~/.claude/skills/**\/*.md
 * 2. Kind=chain 선언 섹션에 Sequence 블록이 없거나 step < 3 또는 actor enum 위반이면 exit=2 block
 *
 * actor enum: Worker | Verifier | Healer | SR | Supervisor | System
 */

"use strict";

const ACTOR_ENUM = new Set(["Worker", "Verifier", "Healer", "SR", "Supervisor", "System"]);

// 대상 파일 패턴 (정규식)
const TARGET_PATTERNS = [
  /[/\\]\.claude[/\\]rules[/\\][^/\\]+\.md$/,
  /[/\\]\.claude[/\\]docs[/\\].*\.md$/,
  /[/\\]\.claude[/\\]skills[/\\].*\.md$/,
];

function isTargetFile(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, "/");
  return TARGET_PATTERNS.some((re) => re.test(normalized));
}

/**
 * md 섹션 분할 (## {slug} ~ 다음 ## 또는 EOF)
 */
function parseSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^## ([a-z][a-z0-9-]*)$/);
    if (m) {
      if (current) sections.push(current);
      current = { slug: m[1], body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}

/**
 * 섹션 body 에서 **Kind**: 값 추출
 */
function extractKind(body) {
  const m = body.match(/^\*\*Kind\*\*:\s*(.+?)$/mi);
  return m ? m[1].trim() : null;
}

/**
 * 섹션 body 에서 **Sequence**: 블록의 step 목록 파싱
 * 반환: step 배열 (각 { step, action?, actor? })
 */
function parseSequenceSteps(body) {
  // Note: '$' in multiline ('mi') matches end-of-line causing lazy match to stop too early.
  const re = /\*\*Sequence\*\*:\s*\n([\s\S]*?)(?=\n\*\*[A-Z][^*]*\*\*:|(?:\r?\n){2,}---|\n\n\n|$)/i;
  const m = body.match(re);
  if (!m) return null; // Sequence 블록 없음

  const block = m[1];
  const stepRe = /^- step:\s*([^\n]+)\n((?:[ \t]{2,}[^\n]+\n?)*)/gm;
  const steps = [];
  let sm;
  while ((sm = stepRe.exec(block)) !== null) {
    const stepId = sm[1].trim();
    const stepBody = sm[2];
    const step = { step: stepId, action: null, actor: null };

    const fieldRe = /^[ \t]{2,}([\w-]+):\s*(.+?)$/gm;
    let fm;
    while ((fm = fieldRe.exec(stepBody)) !== null) {
      const key = fm[1];
      const val = fm[2].trim().replace(/^["']|["']$/g, "");
      if (key === "action") step.action = val;
      if (key === "actor") step.actor = val;
    }
    steps.push(step);
  }
  return steps;
}

/**
 * chain kind 섹션 검증 → 위반 메시지 배열 반환
 */
function validateChainSection(slug, body) {
  const errors = [];

  const steps = parseSequenceSteps(body);

  // (1) Sequence 블록 없음
  if (steps === null) {
    errors.push(
      `chain DA 편집 시 Sequence 블록 필수 (섹션: ${slug}). 현재 Sequence 블록 없음.`
    );
    return errors;
  }

  // (2) step >= 3
  if (steps.length < 3) {
    errors.push(
      `chain DA Sequence 는 >=3 step 필요 (섹션: ${slug}, 현재: ${steps.length} step).`
    );
  }

  // (3) 각 step action 필수, (4) actor enum 검증
  steps.forEach((s, i) => {
    if (!s.action || s.action.trim() === "") {
      errors.push(
        `chain DA Sequence step ${s.step ?? i + 1} 에 'action' 필드 누락 (섹션: ${slug}).`
      );
    }
    if (s.actor && !ACTOR_ENUM.has(s.actor)) {
      errors.push(
        `chain DA Sequence step ${s.step ?? i + 1} actor '${s.actor}' 가 enum {Worker,Verifier,Healer,SR,Supervisor,System} 밖 (섹션: ${slug}).`
      );
    }
  });

  return errors;
}

// ============================================================
// Main — stdin 에서 hook input 읽기
// ============================================================

let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = input.tool_name ?? "";
  if (!/^(Write|Edit)$/.test(toolName)) process.exit(0);

  // 파일 경로 추출
  const params = input.tool_input ?? {};
  const filePath = params.file_path ?? "";

  if (!isTargetFile(filePath)) process.exit(0);

  // 내용 추출 (Write: content, Edit: new_string)
  const content = params.content ?? params.new_string ?? "";
  if (!content) process.exit(0);

  // 섹션 파싱 + chain kind 검증
  const sections = parseSections(content);
  const allErrors = [];

  for (const sec of sections) {
    const kind = extractKind(sec.body);
    if (kind === "chain") {
      const errs = validateChainSection(sec.slug, sec.body);
      allErrors.push(...errs);
    }
  }

  if (allErrors.length === 0) {
    process.exit(0);
  }

  // 블록 출력 (hookSpecificOutput exit=2)
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "[chain-kind-guard] chain DA 구조 위반:\n" + allErrors.map((e) => `  • ${e}`).join("\n"),
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(2);
});
