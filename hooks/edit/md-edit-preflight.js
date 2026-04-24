#!/usr/bin/env node
'use strict';
// md-edit-preflight.js — PreToolUse(Write|Edit|MultiEdit, rules/ or docs/ *.md)
// 편집 전 T1 문법 리마인더를 additionalContext 로 주입한다. 항상 allow.

const fs = require('fs');
const os = require('os');

function readStdinSync() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function exitNoop() {
  try { process.stdout.write(''); } catch {}
  process.exit(0);
}

function isTarget(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const norm = filePath.replace(/\\/g, '/');
  if (!norm.endsWith('.md')) return false;
  return /\/\.claude\/(rules|docs)\//.test(norm);
}

(function main() {
  try {
    const raw = readStdinSync();
    if (!raw) return exitNoop();
    let input;
    try { input = JSON.parse(raw); } catch { return exitNoop(); }

    const tool = input.tool_name;
    if (!['Write', 'Edit', 'MultiEdit'].includes(tool)) return exitNoop();
    const fp = input.tool_input && input.tool_input.file_path;
    if (!isTarget(fp)) return exitNoop();

    const rel = fp.replace(/\\/g, '/').replace(/^.*\/\.claude\//, '');
    const ctx = [
      `📝 md-edit-preflight: ${rel} 편집 감지.`,
      `이 md 는 rule-based DA 변환 대상. T1 어휘 준수 필요:`,
      `- 참조: ~/.claude/rules/md-grammar.md + scripts/da-vector/llm-free/lexicon-nl-grammar.yaml (T1 74항목)`,
      `- 판정 필드 (When/If/Then/Because/Trigger keywords/Detail/Co-applies/Example-queries) 는 의미 변경 금지`,
      `- 벗어나는 자유 서술은 \`**Narrative**:\` 블록으로 격리`,
      `편집 후 PostToolUse md-grammar-lint 가 unmatched 자동 감지.`,
    ].join('\n');

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        permissionDecision: 'allow',
        additionalContext: ctx,
      },
    }));
    process.exit(0);
  } catch {
    return exitNoop();
  }
})();
