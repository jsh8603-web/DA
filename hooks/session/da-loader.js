/**
 * da-loader.js — T1 DA SessionStart injector
 * Event: SessionStart
 * Role: decisions/INDEX-critical.md 읽어 additionalContext 로 주입 (T1 always-on)
 * Empty-safe: INDEX-critical.md 없으면 빈 문자열 반환 (Step B 이후 채워짐)
 */
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE || 'C:/Users/jsh86';
const INDEX_PATH = path.join(HOME, '.claude/decisions/INDEX-critical.md');

// Empty-safe: INDEX-critical.md 없으면 skip (Step B 이후 생성됨)
if (!fs.existsSync(INDEX_PATH)) {
  process.exit(0);
}

try {
  const content = fs.readFileSync(INDEX_PATH, 'utf8').trim();
  if (!content) process.exit(0);

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `## DA T1 상시 활성 규칙\n\n${content}\n`
    }
  };
  console.log(JSON.stringify(output));
  process.exit(0);
} catch (e) {
  // silent fail
  process.exit(0);
}
