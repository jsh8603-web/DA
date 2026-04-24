#!/usr/bin/env node
'use strict';
// md-grammar-lint.js — PostToolUse(Write|Edit|MultiEdit, *.md) 에서 rule-check 실행.
// rules/*.md 또는 docs/**/*.md 에 대해 `md-to-da.ts --rule-check` 를 spawn 해 unmatched 감지.
// unmatched 있으면 stderr + sendkey 로 agent 에 교정 요청.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const HOME = process.env.USERPROFILE || os.homedir();
const MD_TO_DA = path.join(HOME, '.claude', 'scripts', 'da-vector', 'md-to-da.ts').replace(/\\/g, '/');
const PSMUX_SEND = path.join(HOME, '.claude', 'scripts', 'lib', 'psmux-send.sh').replace(/\\/g, '/');
const NPX = 'C:/Program Files/nodejs/npx.cmd';

let fire = () => {};
try { ({ fire } = require('./lib/log-event')); } catch {}
let isProcessable = () => true;
try { ({ isProcessable } = require('./lib/session-filter')); } catch {}

const HOOK_ID = 'md-grammar-lint';

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
  // rules/ 또는 docs/ 하위만. memory/, plan-*.md, progress-*.md 등 제외
  return /\/\.claude\/(rules|docs)\//.test(norm);
}

function runRuleCheck(mdPath) {
  try {
    // Windows .cmd 파일은 execFileSync 로 직접 실행 불가 (CVE-2024-27980 이후 EINVAL). shell quote 로 우회.
    const cmd = `"${NPX}" tsx "${MD_TO_DA}" "${mdPath}" --rule-check`;
    const out = execSync(cmd, {
      timeout: 15000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(MD_TO_DA),
    });
    return { ok: true, output: out };
  } catch (e) {
    // exit 1 (unmatched) 도 여기로 옴
    return { ok: false, output: (e.stdout || '') + (e.stderr || ''), code: e.status };
  }
}

function runAutoWrite(mdPath) {
  try {
    const cmd = `"${NPX}" tsx "${MD_TO_DA}" "${mdPath}"`;
    const out = execSync(cmd, {
      timeout: 30000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(MD_TO_DA),
    });
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, output: (e.stdout || '') + (e.stderr || ''), code: e.status };
  }
}

function parseUnmatched(output) {
  // "[rule-check] slug: N/M unmatched" 패턴 집계
  const unmatched = [];
  const lines = output.split(/\r?\n/);
  let currentSlug = null;
  for (const line of lines) {
    const m = line.match(/\[rule-check\]\s+([a-z0-9-]+):\s+(\d+)\/(\d+)\s+unmatched/);
    if (m) {
      currentSlug = m[1];
      continue;
    }
    const um = line.match(/^\s+\[([A-Z][a-z-]+)\]\s+(.+)$/);
    if (um && currentSlug) {
      unmatched.push({ slug: currentSlug, marker: um[1], sentence: um[2] });
    }
  }
  const totalMatch = output.match(/total:\s+\d+\s+sentences,\s+(\d+)\s+unmatched/);
  const totalUnmatched = totalMatch ? parseInt(totalMatch[1], 10) : unmatched.length;
  return { unmatched, totalUnmatched };
}

function sendkeySync(sess, body) {
  try {
    execFileSync('bash', [PSMUX_SEND, 'message', sess, body], {
      timeout: 5000,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch { return false; }
}

function buildFeedback(mdPath, result) {
  const rel = mdPath.replace(/\\/g, '/').replace(/^.*\/\.claude\//, '');
  const summary = result.unmatched.slice(0, 3).map((u) => `  [${u.slug}/${u.marker}] ${u.sentence.slice(0, 80)}`).join('\n');
  const more = result.unmatched.length > 3 ? `\n  ... +${result.unmatched.length - 3} more` : '';
  return [
    `🔍 md-grammar-lint: ${rel} → ${result.totalUnmatched} 문장 unmatched`,
    summary + more,
    `교정: (1) narrative 블록 이동 (기본) (2) T1 어휘로 재작성 (3) lexicon 추가 = 사용자 승인 필요.`,
    `참조: rules/md-grammar.md + scripts/da-vector/llm-free/SCHEMA.md`,
  ].join('\n');
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

    const sess = process.env.PSMUX_TARGET_SESSION || process.env.PSMUX_SESSION || '';
    if (!sess || /^__/.test(sess)) return exitNoop();
    if (!isProcessable(sess, process.cwd())) return exitNoop();

    const result = runRuleCheck(fp);
    if (result.ok) {
      // rule-check 성공 (exit 0) — unmatched 0, auto-yaml write 실행
      const writeResult = runAutoWrite(fp);
      if (writeResult.ok) {
        fire(HOOK_ID, 'auto_yaml_done', { sess, file: fp });
      } else {
        fire(HOOK_ID, 'auto_yaml_error', { sess, file: fp, code: writeResult.code });
      }
      return exitNoop();
    }

    const parsed = parseUnmatched(result.output);
    if (parsed.totalUnmatched === 0) {
      // execFile 실패인데 unmatched 없음 — rule-check 이외 오류 (tsx 미설치, 파일 없음 등)
      fire(HOOK_ID, 'rule_check_error', { sess, file: fp, code: result.code });
      return exitNoop();
    }

    const body = buildFeedback(fp, parsed);
    sendkeySync(sess, body);
    fire(HOOK_ID, 'rule_check_unmatched', { sess, file: fp, count: parsed.totalUnmatched });
    process.stderr.write(`[${HOOK_ID}] FIRE file=${fp} unmatched=${parsed.totalUnmatched}\n`);
    return exitNoop();
  } catch {
    return exitNoop();
  }
})();
