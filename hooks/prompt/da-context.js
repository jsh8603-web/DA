/**
 * da-context.js — T2+T3 DA context injector
 * Events: UserPromptSubmit, PreToolUse
 * T2: keyword/glob/tool 매칭 (rule-based, no cost)
 * T3: embedding similarity fallback (via embed_service :8787)
 *
 * Confidence 임계값:
 *   score < 0.7  → skip
 *   score 0.7~0.85 → "Maybe-Trigger" 코멘트 프리픽스
 *   score >= 0.85 → 정식 context 블록 주입
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE || 'C:/Users/jsh86';

// === L11.6 Haiku 번역 (OAuth Bearer, Max 구독 한도 내) ===
function loadOAuthToken() {
  try {
    const credPath = 'C:/Users/jsh86/.claude/.credentials.json';
    const c = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const token = c.claudeAiOauth?.accessToken;
    const expiresAt = c.claudeAiOauth?.expiresAt;
    if (!token || (expiresAt && Date.now() >= expiresAt)) return null;
    return token;
  } catch {
    return null;
  }
}

function extractEnglishKeywords(queryText) {
  // 영어 전용 query 도 호출 (영→한 alias 확보). 완전 숫자/기호만인 경우 skip.
  if (!/[a-zA-Z가-힣]/.test(queryText)) return '';
  const token = loadOAuthToken();
  if (!token) return '';

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    temperature: 0,
    messages: [{
      role: 'user',
      content: `Extract technical keywords in BOTH Korean and English from this text. Return ONLY space-separated keywords (lowercase), nothing else. If text is Korean add English translations; if English add Korean transliterations. Focus on technical terms, function names, tool names, concepts:\n${queryText.slice(0, 200)}`
    }]
  });
  const tmpPath = path.join(os.tmpdir(), `haiku-body-${Date.now()}-${process.pid}.json`);
  try {
    fs.writeFileSync(tmpPath, body, { encoding: 'utf8' });
    const r = spawnSync('curl', [
      '-s', '-m', '2',
      '-X', 'POST', 'https://api.anthropic.com/v1/messages',
      '-H', 'Content-Type: application/json; charset=utf-8',
      '-H', 'Authorization: Bearer ' + token,
      '-H', 'anthropic-version: 2023-06-01',
      '-H', 'anthropic-beta: oauth-2025-04-20',
      '--data-binary', '@' + tmpPath
    ], { encoding: 'utf8', timeout: 3000 });
    if (r.status !== 0 || !r.stdout) return '';
    const resp = JSON.parse(r.stdout);
    if (resp.error) return '';
    return (resp.content?.[0]?.text?.trim() || '').toLowerCase();
  } catch {
    return '';
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

// === L11.6 Smart 토크나이저 (한영 경계 분리) + Jaccard 매칭 ===
// min length 2: 1자 토큰 ("의", "가" 등) false positive 제거
function smartTokenize(text) {
  if (!text) return [];
  return String(text)
    .split(/[\s\-_,.:;!?()[\]{}]+|(?<=[가-힣])(?=[a-zA-Z0-9])|(?<=[a-zA-Z0-9])(?=[가-힣])/)
    .filter(t => t && t.length >= 2)
    .map(t => t.toLowerCase());
}

function tokenJaccardScore(queryText, keyword) {
  const kwLower = String(keyword).toLowerCase();
  const kTokens = smartTokenize(keyword);
  // single-token 또는 단문 keyword → 기존 substring 유지 (빠름, false positive 방지)
  if (kTokens.length <= 1) {
    return queryText.toLowerCase().includes(kwLower) ? 1.0 : 0.0;
  }
  // multi-token keyword → Jaccard (keyword token 중 query 에 등장하는 비율)
  const qTokens = new Set(smartTokenize(queryText));
  let hits = 0;
  for (const kt of kTokens) {
    // 엄격: exact match 또는 qt 가 kt 를 포함 (qt="frontmatter를" ⊃ kt="frontmatter")
    // kt.includes(qt) 는 제거 — 짧은 qt 가 긴 kt 안에 우연 포함되는 false positive 원인
    for (const qt of qTokens) {
      if (qt === kt || qt.includes(kt)) {
        hits++;
        break;
      }
    }
  }
  return hits / kTokens.length;
}

// L11.6 threshold: 0.7 (2/3 토큰 이상 매칭, precision 중시)
const JACCARD_THRESHOLD = 0.7;

// 토큰 예산 상한 (TASK 6: Profile L6 없어도 동작하는 안전장치)
const T2_MAX_DA = 5;    // T2 inject 최대 개수 (L11.6 v4 best 80%, v5 cap8 regression)
const T3_MAX_DA = 3;    // T3 inject 최대 개수
const MAX_INJECT_CHARS = 6000; // inject 글자 총량 상한 (~2000 토큰)

// js-yaml CommonJS 로드
let yaml;
try {
  yaml = require(path.join(HOME, '.claude/node_modules/js-yaml'));
} catch {
  process.exit(0);
}

// audit-log fire (TASK 0: DA inject 기록)
let logFire;
try {
  logFire = require(path.join(HOME, '.claude/hooks/lib/log-event')).fire;
} catch {
  logFire = () => {}; // fallback: 로깅 실패해도 inject는 동작
}

// === FOK Signal (D-5: 메타인지 촉진) ===
const FOK_TRIGGERS = [
  { pattern: /[/\\]rules[/\\]/i, msg: '이 파일 경로에 관련 DA 규칙이 있을 수 있습니다. search_da MCP 도구로 확인을 권장합니다.' },
  { pattern: /[/\\]skills[/\\].*[/\\]skill\.md/i, msg: '이 skill 관련 guard/constraint DA를 search_da MCP 도구로 확인하세요.' },
  { pattern: /[/\\]hooks[/\\](?!lib[/\\])/i, msg: '이 hook 관련 DA가 있을 수 있습니다. search_da MCP 도구로 확인하세요.' },
];

function getFokSignal(input) {
  const filePath = input?.file_path || input?.path || input?.command || '';
  if (!filePath) return null;
  for (const trigger of FOK_TRIGGERS) {
    if (trigger.pattern.test(filePath)) return trigger.msg;
  }
  return null;
}

// stdin JSON 파싱
let d;
try {
  d = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const hookEvent = d.hook_event_name || d.hookEventName || '';
const prompt = (d.prompt || '').toLowerCase();
const toolName = (d.tool_name || '').toLowerCase();
const toolInput = d.tool_input || {};
const toolContext = [toolName, JSON.stringify(toolInput)].join(' ').toLowerCase();
const queryText = hookEvent === 'UserPromptSubmit' ? prompt : toolContext;

// DA 파일 목록 로드 (L11.3: slice 제거, 303 전체 스캔 대상)
const decisionsDir = path.join(HOME, '.claude/decisions');
let daFiles = [];
try {
  daFiles = fs.readdirSync(decisionsDir)
    .filter(f => f.startsWith('DA-') && f.endsWith('.yaml'))
    .map(f => path.join(decisionsDir, f));
} catch {
  process.exit(0);
}

if (daFiles.length === 0) process.exit(0);

// T2 keyword 역인덱스 로드 (L11.2, fallback=linear scan)
let t2Index = null;
try {
  const idxPath = path.join(decisionsDir, '.t2-keyword-index.json');
  t2Index = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
} catch {
  t2Index = null;
}

// DA 파싱 (front matter 추출: --- yaml --- markdown 구조 대응)
const das = [];
for (const fp of daFiles) {
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    // DA yaml 파일은 --- frontmatter --- markdown 구조 → front matter 만 파싱
    const parts = raw.split(/^---$/m);
    const fmText = parts.length >= 2 ? parts[1] : raw;
    const da = yaml.load(fmText);
    if (da && da.status === 'active') das.push(da);
  } catch {
    // skip malformed
  }
}

if (das.length === 0) process.exit(0);

// cosine similarity 헬퍼
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return na && nb ? dot / (na * nb) : 0;
}

// embed 서비스 단건 호출 (query용, sync via curl)
function getEmbedding(text) {
  try {
    const r = spawnSync('curl', [
      '-s', '-m', '1',
      '-X', 'POST', 'http://127.0.0.1:8787/embed',
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({ texts: [text] })
    ], { encoding: 'utf8', timeout: 1500 });
    if (r.status !== 0 || !r.stdout) return null;
    return JSON.parse(r.stdout).vectors[0];
  } catch {
    return null;
  }
}

// embed 서비스 배치 호출 (DA 텍스트 일괄 처리, curl 1회)
function getEmbeddingBatch(texts) {
  if (!texts || texts.length === 0) return null;
  try {
    const r = spawnSync('curl', [
      '-s', '-m', '5',
      '-X', 'POST', 'http://127.0.0.1:8787/embed',
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({ texts })
    ], { encoding: 'utf8', timeout: 10000 });
    if (r.status !== 0 || !r.stdout) return null;
    return JSON.parse(r.stdout).vectors;  // number[][] 반환
  } catch {
    return null;
  }
}

// embed 서비스 health check
function embedServiceAvailable() {
  try {
    const r = spawnSync('curl', ['-s', '-m', '0.2', 'http://127.0.0.1:8787/health'],
      { encoding: 'utf8', timeout: 500 });
    return r.status === 0 && r.stdout && r.stdout.length > 0;
  } catch {
    return false;
  }
}

// T2 Rule-based 매칭 (L11.6: Haiku 번역 + Smart Jaccard + 실제 score + Miss log)
// Map<da.id, maxScore>: 각 DA 의 최고 매칭 점수 기록 (여러 keyword 중 max)
const t2MatchedScores = new Map();

// L11.6 ①: 한국어 query → Haiku 번역 → combined query (한+영)
const englishKw = hookEvent === 'UserPromptSubmit' ? extractEnglishKeywords(queryText) : '';
const combinedQuery = englishKw ? (queryText + ' ' + englishKw) : queryText;

if (t2Index && t2Index.keywords) {
  // L11.6 ②: smart Jaccard score + substring (single-token)
  for (const kw of Object.keys(t2Index.keywords)) {
    const score = tokenJaccardScore(combinedQuery, kw);
    if (score >= JACCARD_THRESHOLD) {
      for (const id of t2Index.keywords[kw]) {
        const existing = t2MatchedScores.get(id) || 0;
        if (score > existing) t2MatchedScores.set(id, score);
      }
    }
  }
  // tool-name 매칭 (PreToolUse) — confidence 1.0 (exact match)
  if (hookEvent === 'PreToolUse' && t2Index.toolNames) {
    const tnLower = String(toolName || '').toLowerCase();
    const origLower = String(d.tool_name || '').toLowerCase();
    const ids = t2Index.toolNames[tnLower] || t2Index.toolNames[origLower];
    if (ids) for (const id of ids) t2MatchedScores.set(id, Math.max(t2MatchedScores.get(id) || 0, 1.0));
  }
} else {
  // fallback: 기존 linear scan (index 부재 시)
  for (const da of das) {
    const trigger = da.trigger || {};
    const keywords = trigger.keywords || [];
    const toolNames = trigger['tool-names'] || [];
    let maxScore = 0;
    for (const kw of keywords) {
      const s = tokenJaccardScore(combinedQuery, String(kw));
      if (s > maxScore) maxScore = s;
    }
    if (maxScore < JACCARD_THRESHOLD && hookEvent === 'PreToolUse') {
      for (const tn of toolNames) {
        if (toolName === String(tn).toLowerCase() || d.tool_name === tn) { maxScore = 1.0; break; }
      }
    }
    if (maxScore >= JACCARD_THRESHOLD) t2MatchedScores.set(da.id, maxScore);
  }
}

// L11.6 v7: DA id slug 자체도 keyword 로 매칭 (예: "psmux-send-ssot-helper" 직접)
// query 에 tool/domain slug 가 등장하면 해당 DA 우선 매칭
for (const da of das) {
  const slug = String(da.id || '').replace(/^DA-\d{8}-/, '');
  if (!slug || slug.length < 5) continue;
  const slugScore = tokenJaccardScore(combinedQuery, slug);
  if (slugScore >= JACCARD_THRESHOLD) {
    const existing = t2MatchedScores.get(da.id) || 0;
    // slug match 는 더 specific → bonus 0.05
    const boosted = Math.min(slugScore + 0.05, 1.0);
    if (boosted > existing) t2MatchedScores.set(da.id, boosted);
  }
}

// legacy t2MatchedIds 호환 (다른 코드에서 참조)
const t2MatchedIds = new Set(t2MatchedScores.keys());

// das 에서 T2 matched / unmatched 분리 (기존 확장 구조 유지)
const t2Matched = [];
const t2Unmatched = [];
for (const da of das) {
  const score = t2MatchedScores.get(da.id);
  if (score !== undefined) {
    // L11.6: 실제 Jaccard score 사용 (top-K 정렬이 의미 있게 작동)
    t2Matched.push({ da, confidence: score });
  } else {
    t2Unmatched.push(da);
  }
}

// T3 Embedding fallback (T2 미매칭 DA 대상 — 배치 curl 1회로 단축)
const t3Matched = [];
if (t2Unmatched.length > 0) {
  const available = embedServiceAvailable();
  if (available) {
    const queryVec = getEmbedding(queryText);  // query: 1회
    if (queryVec) {
      // DA 텍스트 배치 임베딩 (curl 1회, N→1)
      const daTexts = t2Unmatched.map(da =>
        [da.when || '', da.if || '', da.then || '', (da.trigger?.keywords || []).join(' ')].join(' ')
      );
      const daVecs = getEmbeddingBatch(daTexts);  // number[][] or null

      if (daVecs && daVecs.length === t2Unmatched.length) {
        const scored = [];
        for (let i = 0; i < t2Unmatched.length; i++) {
          const score = cosine(queryVec, daVecs[i]);
          if (score >= 0.7) scored.push({ da: t2Unmatched[i], confidence: score });
        }
        // top-5
        scored.sort((a, b) => b.confidence - a.confidence);
        t3Matched.push(...scored.slice(0, 5));
      }
    }
  }
}

// 주입 결정 — 토큰 예산 적용 (TASK 6)
const t2Capped = t2Matched.sort((a, b) => b.confidence - a.confidence).slice(0, T2_MAX_DA);
const t3Capped = t3Matched.sort((a, b) => b.confidence - a.confidence).slice(0, T3_MAX_DA);
let allMatched = [...t2Capped, ...t3Capped];

// 글자 수 상한 적용
let charTotal = 0;
allMatched = allMatched.filter(({ da }) => {
  const len = (da.then || da.because || '').length;
  if (charTotal + len > MAX_INJECT_CHARS) return false;
  charTotal += len;
  return true;
});
const fokMsgEarly = getFokSignal(toolInput);

// L11.6 ④: miss log 자동 기록 (T2+T3 모두 0 매칭 시)
if (allMatched.length === 0 && hookEvent === 'UserPromptSubmit' && queryText.length > 10) {
  try {
    const missPath = path.join(decisionsDir, '.t2-miss.jsonl');
    const entry = {
      ts: new Date().toISOString(),
      query: queryText.slice(0, 300),
      english_kw: englishKw.slice(0, 200),
      session: process.env.PSMUX_SESSION || process.env.PSMUX_TARGET_SESSION || 'unknown',
    };
    fs.appendFileSync(missPath, JSON.stringify(entry) + '\n');
  } catch {}
}

if (allMatched.length === 0 && !fokMsgEarly) process.exit(0);
// DA 매칭 0건이지만 FOK가 있으면 FOK만 inject
if (allMatched.length === 0 && fokMsgEarly) {
  const fokOnly = `## DA 관련 규칙\n\n🔍 [FOK] ${fokMsgEarly}\n`;
  let eventName;
  if (hookEvent === 'UserPromptSubmit') eventName = 'UserPromptSubmit';
  else if (hookEvent === 'PreToolUse') eventName = 'PreToolUse';
  else eventName = d.tool_name ? 'PreToolUse' : 'UserPromptSubmit';
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext: fokOnly } }));
  process.exit(0);
}

const contextLines = [];
for (const { da, confidence } of allMatched) {
  const thenText = da.then || da.because || '';
  if (!thenText) continue;

  // audit-log에 DA inject 기록 (TASK 0)
  logFire('da-context', 'da_inject', {
    da_id: da.id,
    score: confidence.toFixed(2),
    tier: confidence >= 0.85 ? 'T2' : 'T3',
  });

  if (confidence >= 0.85) {
    contextLines.push(`**${da.id}**: ${thenText}`);
  } else {
    // 0.7 ~ 0.85: Maybe-Trigger 코멘트 (HTML comment 탈출 방어: --> 제거)
    const safeThenText = thenText.replace(/-->/g, '- >');
    contextLines.push(`<!-- Maybe-Trigger: ${da.id} — ${safeThenText} -->`);
  }
}

if (contextLines.length === 0) process.exit(0);

// FOK Signal: DA 매칭이 0건이어도 파일 경로 패턴에 따라 search_da 권장
const fokMsg = getFokSignal(toolInput);
const fokLine = fokMsg ? `\n🔍 [FOK] ${fokMsg}` : '';
const additionalContext = `## DA 관련 규칙\n\n${contextLines.join('\n')}${fokLine}\n`;

// hookEventName 결정
let eventName;
if (hookEvent === 'UserPromptSubmit') {
  eventName = 'UserPromptSubmit';
} else if (hookEvent === 'PreToolUse') {
  eventName = 'PreToolUse';
} else {
  // fallback: stdin 구조로 추측
  eventName = d.tool_name ? 'PreToolUse' : 'UserPromptSubmit';
}

const output = {
  hookSpecificOutput: {
    hookEventName: eventName,
    additionalContext
  }
};
console.log(JSON.stringify(output));
process.exit(0);
