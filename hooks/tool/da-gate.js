/**
 * da-gate.js — Inhibitory Gating (Meta-cognition Monitoring-Control)
 * Event: PreToolUse
 * Role: 현재 tool context 가 DA counter-example 에 해당하면 경고 (deny는 아님, warn only)
 *
 * 동작:
 * 1. T2/T3 가 매칭한 DA 중 counter-example 필드 있는 것 추출
 * 2. counter-example 텍스트가 현재 file_path/tool_name 에 해당하면 → suppress 권고
 * 3. Suppress 조건 (ANY):
 *    - file_path 에 "G:\\내 드라이브\\" 포함 (볼트 경로 — DA 규칙 scope 밖)
 *    - file_path 에 "D:\\projects\\" 포함 (프로젝트 로컬 — scope 밖)
 *    - counter-example 텍스트에 실제 file_path 의 디렉토리 일부가 명시됨
 * 4. Suppress 시: additionalContext 로 "[DA Gate] {da.id} counter-example 적용됨 — 본 규칙 비적용 범위" 주입
 * 5. Suppress 안 하면: process.exit(0)
 *
 * NOTE: deny 가 아닌 inform. Agent 가 최종 판단.
 */
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE || 'C:/Users/jsh86';

// js-yaml CommonJS 로드
let yaml;
try {
  yaml = require(path.join(HOME, '.claude/node_modules/js-yaml'));
} catch {
  process.exit(0);
}

// stdin JSON 파싱
let d;
try {
  d = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

// PreToolUse 만 처리
const hookEvent = d.hook_event_name || d.hookEventName || '';
if (hookEvent && hookEvent !== 'PreToolUse') process.exit(0);
// tool_name 없으면 PreToolUse 아님
if (!d.tool_name) process.exit(0);

const toolInput = d.tool_input || {};
const filePath = (toolInput.file_path || '').replace(/\\/g, '/');
const toolName = (d.tool_name || '').toLowerCase();

// DA 파일 목록 로드 (최대 20개 — guard + critical 우선)
const decisionsDir = path.join(HOME, '.claude/decisions');
let daFiles = [];
try {
  const all = fs.readdirSync(decisionsDir)
    .filter(f => f.startsWith('DA-') && f.endsWith('.yaml'));

  // guard + critical 우선 정렬 (파일명에 'guard' 또는 'critical' 포함 먼저)
  const priority = all.filter(f => /guard|critical/i.test(f));
  const rest = all.filter(f => !/guard|critical/i.test(f));
  daFiles = [...priority, ...rest]
    .slice(0, 20)
    .map(f => path.join(decisionsDir, f));
} catch {
  process.exit(0);
}

if (daFiles.length === 0) process.exit(0);

// DA 파싱 (counter-example 있는 것만)
const das = [];
for (const fp of daFiles) {
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const da = yaml.load(raw);
    if (da && da.status === 'active' && da['counter-example']) {
      das.push(da);
    }
  } catch {
    // skip malformed
  }
}

if (das.length === 0) process.exit(0);

// Suppress 판단 헬퍼
function shouldSuppress(da, filePath) {
  // 볼트 경로: G:/내 드라이브/
  if (filePath && /G:[\/\\]내 드라이브/i.test(filePath)) return true;
  // 프로젝트 로컬: D:/projects/
  if (filePath && /D:[\/\\]projects/i.test(filePath)) return true;

  // counter-example 텍스트에 file_path 디렉토리 일부 명시
  if (filePath && da['counter-example']) {
    const ce = da['counter-example'].toLowerCase();
    // 경로의 각 세그먼트를 추출해 counter-example 텍스트에 포함되는지 확인
    const segments = filePath.split('/').filter(s => s.length > 3);
    for (const seg of segments) {
      if (ce.includes(seg.toLowerCase())) return true;
    }
  }

  return false;
}

// 매칭 및 suppress 판단
const suppressedDAs = [];
for (const da of das) {
  if (shouldSuppress(da, filePath)) {
    suppressedDAs.push(da);
  }
}

if (suppressedDAs.length === 0) process.exit(0);

// additionalContext 경고 메시지 생성
const warnLines = suppressedDAs.map(da =>
  `[DA Gate] ${da.id} counter-example 적용됨 — 본 규칙 비적용 범위\n  counter-example: ${da['counter-example']}`
);

const output = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: `## DA Gate 억제 알림\n\n${warnLines.join('\n\n')}\n`
  }
};
console.log(JSON.stringify(output));
process.exit(0);
