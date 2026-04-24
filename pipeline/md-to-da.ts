// md-to-da.ts — DA-friendly md → DA YAML 변환기
// 입력: rules/*.md (plan-md-da-rewrite §2 포맷)
// 출력: decisions/DA-YYYYMMDD-{slug}.yaml (기존 YAML의 관계 필드 보존)
// 사용: npx tsx md-to-da.ts <md-path> [--dry-run]

import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";
import * as crypto from "crypto";

const HOME = process.env.HOME ?? "C:/Users/jsh86";
const DECISIONS_DIR = path.join(HOME, ".claude", "decisions");
const LEXICON_PATH = path.join(HOME, ".claude", "scripts", "da-vector", "lexicon.yaml");
const NL_LEXICON_PATH = path.join(
  HOME,
  ".claude",
  "scripts",
  "da-vector",
  "llm-free",
  "lexicon-nl-grammar.yaml"
);

// ============================================================
// Lexicon 로드
// ============================================================
interface Marker {
  marker: string;
  "maps-to": string;
  type: string;
  values?: string[];
  "sub-fields"?: { label: string; "maps-to": string; type: string }[];
  reverse?: boolean;
  "include-in-embed"?: boolean;
}

interface Lexicon {
  markers: Marker[];
  options: {
    "section-header-regex": string;
    "da-id-prefix": string;
    "preserve-existing-relations": boolean;
    "new-version": number;
  };
}

async function loadLexicon(): Promise<Lexicon> {
  const raw = await fs.readFile(LEXICON_PATH, "utf-8");
  return yaml.load(raw) as Lexicon;
}

// ============================================================
// md 파싱 — 섹션 추출
// ============================================================
interface MdSection {
  slug: string;
  raw: string; // 헤더 다음 본문 전체 (다음 ## 전까지)
}

function extractSections(md: string, headerRegex: RegExp): MdSection[] {
  const lines = md.split(/\r?\n/);
  const sections: MdSection[] = [];
  let current: MdSection | null = null;

  for (const line of lines) {
    const m = line.match(headerRegex);
    if (m) {
      if (current) sections.push(current);
      current = { slug: m[1], raw: "" };
    } else if (current) {
      current.raw += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}

// ============================================================
// Bold-marker 값 추출
// ============================================================

// "**Marker**: {value}" 한 줄 형식
function extractScalarMarker(body: string, marker: string): string | null {
  const re = new RegExp(`^\\*\\*${escapeRegex(marker)}\\*\\*:\\s*(.+?)$`, "mi");
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

// "**Marker**: ...\n{다단 문단 (다음 bold-marker or --- 전까지)}" 형식 (paragraph)
function extractParagraphMarker(body: string, marker: string): string | null {
  const re = new RegExp(
    `^\\*\\*${escapeRegex(marker)}\\*\\*:\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Z][^*]*\\*\\*:|\\n---|$)`,
    "mi"
  );
  const m = body.match(re);
  if (!m) return null;
  return m[1].trim();
}

// "**Marker**:\n- "line1"\n- "line2"" bullet list (quoted)
function extractBulletQuoted(body: string, marker: string): string[] {
  const re = new RegExp(
    `^\\*\\*${escapeRegex(marker)}\\*\\*:\\s*\\n((?:\\s*-\\s+.+\\n?)+)`,
    "mi"
  );
  const m = body.match(re);
  if (!m) return [];
  const bullets = m[1]
    .split(/\r?\n/)
    .filter((l) => /^\s*-\s/.test(l))
    .map((l) => {
      const t = l.replace(/^\s*-\s+/, "").trim();
      // strip surrounding quotes
      return t.replace(/^["']|["']$/g, "");
    })
    .filter((s) => s.length > 0);
  return bullets;
}

// ============================================================
// chain kind 전용 파서
// ============================================================

// "**Sequence**:\n- step: 1\n  stage: ...\n  action: ...\n- step: 2\n  ..." 파싱
interface SequenceStep {
  step: number | string;
  stage?: string;
  trigger?: string;
  condition?: string;
  action: string;
  actor?: string;
  "da-ref"?: string;
  "fields-written"?: string[];
}

function extractSequence(body: string): SequenceStep[] {
  // Note: '$' in multiline mode matches end-of-line causing lazy match to stop too early.
  // Solution: use explicit lookahead without '$', let it run to the next bold marker or EOF.
  const re = /\*\*Sequence\*\*:\s*\n([\s\S]*?)(?=\n\*\*[A-Z][^*]*\*\*:|(?:\r?\n){2,}---|\n\n\n|$)/i;
  const m = body.match(re);
  if (!m) return [];
  const block = m[1];
  // step 블록 분리 (top-level "- step:" 기준)
  const stepRe = /^- step:\s*([^\n]+)\n((?:[ \t]{2,}[^\n]+\n?)*)/gm;
  const steps: SequenceStep[] = [];
  let sm;
  while ((sm = stepRe.exec(block)) !== null) {
    const stepId = sm[1].trim();
    const stepBody = sm[2];
    const s: SequenceStep = {
      step: /^\d+$/.test(stepId) ? parseInt(stepId, 10) : stepId,
      action: "",
    };
    // sub-field 파싱 (indent 2+ space)
    const fieldRe = /^[ \t]{2,}([\w-]+):\s*(.+?)$/gm;
    let fm;
    while ((fm = fieldRe.exec(stepBody)) !== null) {
      const key = fm[1];
      const val = fm[2].trim().replace(/^["']|["']$/g, "");
      if (key === "fields-written") {
        (s as any)[key] = val.split(",").map((v: string) => v.trim());
      } else {
        (s as any)[key] = val;
      }
    }
    steps.push(s);
  }
  return steps;
}

// "**Numeric-bounds**:\n- key: value (unit, description)" 파싱
interface NumericBound {
  key: string;
  value: number | string;
  unit?: string;
  description: string;
}

function extractNumericBounds(body: string): NumericBound[] {
  const re = /^\*\*Numeric-bounds\*\*:\s*\n((?:\s*-\s+.+\n?)+)/mi;
  const m = body.match(re);
  if (!m) return [];
  const bullets = m[1].split(/\r?\n/).filter((l) => /^\s*-\s/.test(l));
  const bounds: NumericBound[] = [];
  for (const line of bullets) {
    // "- key: value (unit, description)" or "- key: \"string-value\" (description)"
    const bulletRe = /^\s*-\s+([\w-]+):\s+(?:"([^"]+)"|(\S+))\s*(?:\(([^)]+)\))?/;
    const bm = line.match(bulletRe);
    if (!bm) continue;
    const key = bm[1];
    const strVal = bm[2];
    const numOrBare = bm[3];
    const parenContent = (bm[4] ?? "").trim();
    let value: number | string;
    let unit: string | undefined;
    let description = "";
    if (strVal !== undefined) {
      value = strVal;
      description = parenContent;
    } else {
      const numVal = parseFloat(numOrBare!);
      value = isNaN(numVal) ? numOrBare! : numVal;
      const parts = parenContent.split(",").map((s) => s.trim());
      if (parts.length >= 2) {
        unit = parts[0];
        description = parts.slice(1).join(", ");
      } else {
        description = parenContent;
      }
    }
    const bound: NumericBound = { key, value, description };
    if (unit) bound.unit = unit;
    bounds.push(bound);
  }
  return bounds;
}

// deriveChainMarkers: Sequence primary 원칙 — input/output/actors 는 sequence 에서 자동 파생
interface ChainDerivedMarkers {
  "input-role": string | null;
  "output-role": string | null;
  "output-condition": string | null;
  actors: string[];
}

function deriveChainMarkers(sequence: SequenceStep[]): ChainDerivedMarkers {
  if (sequence.length === 0) {
    return { "input-role": null, "output-role": null, "output-condition": null, actors: [] };
  }
  const first = sequence[0];
  const last = sequence[sequence.length - 1];
  const actorSet = new Set<string>();
  for (const s of sequence) {
    if (s.actor) actorSet.add(s.actor);
  }
  return {
    "input-role": first.actor ?? null,
    "output-role": last.actor ?? null,
    "output-condition": last.condition ?? null,
    actors: Array.from(actorSet),
  };
}

// Trigger 블록 파서 — sub-fields 분해
interface TriggerBlock {
  keywords?: string[];
  "tool-names"?: string[];
  "file-globs"?: string[];
  "context-hints"?: string[];
}

function extractTriggerBlock(body: string): TriggerBlock {
  const triggerRe = /^\*\*Trigger\*\*:\s*\n([\s\S]*?)(?=\n\*\*[A-Z][^*]*\*\*:|\n---|$)/mi;
  const m = body.match(triggerRe);
  if (!m) return {};
  const block = m[1];
  const out: TriggerBlock = {};

  const keywordsLine = block.match(/^\s*-\s*Keywords:\s*(.+)$/mi);
  if (keywordsLine) out.keywords = extractBacktickList(keywordsLine[1]);

  const toolsLine = block.match(/^\s*-\s*Tools:\s*(.+)$/mi);
  if (toolsLine) out["tool-names"] = extractBacktickList(toolsLine[1]);

  const globsLine = block.match(/^\s*-\s*File globs:\s*(.+)$/mi);
  if (globsLine) out["file-globs"] = extractBacktickList(globsLine[1]);

  const contextLine = block.match(/^\s*-\s*Context:\s*(.+)$/mi);
  if (contextLine) {
    out["context-hints"] = contextLine[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return out;
}

function extractBacktickList(s: string): string[] {
  const items: string[] = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(s)) !== null) items.push(m[1]);
  if (items.length > 0) return items;
  // fallback: comma-separated without backticks
  return s.split(",").map((t) => t.trim()).filter(Boolean);
}

function extractRelationList(body: string, marker: string): string[] {
  const raw = extractScalarMarker(body, marker);
  if (!raw) return [];
  // "(없음)" 또는 "(없음 — ...)" 같은 placeholder 감지
  if (/^\(/.test(raw.trim())) return [];
  // "DA-20260422-foo, DA-20260422-bar" or "foo, bar" (slug 만 있으면 prefix 자동)
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(s));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================
// 기존 YAML 관계 필드 머지
// ============================================================
interface ExistingDa {
  "depends-on"?: string[];
  "applies-with"?: string[];
  "meta-of"?: string[];
  sources?: unknown[];
  status?: string;
  "effective-from"?: string;
  utility?: number;
  "last-hit"?: string;
  "hit-count"?: number;
  supersedes?: string;
  superseded?: boolean;
  "detail-table"?: unknown[];
}

async function loadExistingDa(daId: string): Promise<ExistingDa | null> {
  const filePath = path.join(DECISIONS_DIR, `${daId}.yaml`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    return yaml.load(m[1]) as ExistingDa;
  } catch {
    return null;
  }
}

// ============================================================
// 섹션 → DA YAML 변환
// ============================================================
interface SectionResult {
  yaml: Record<string, unknown>;
  signalToAction: string | null;
}

async function sectionToDa(
  section: MdSection,
  lex: Lexicon,
  mdRelPath: string
): Promise<SectionResult | null> {
  const body = section.raw;
  const daId = `${lex.options["da-id-prefix"]}${section.slug}`;
  const existing = await loadExistingDa(daId);

  // --- 필드 추출 ---
  const kind = extractScalarMarker(body, "Kind");
  const priority = extractScalarMarker(body, "Priority");
  const modality = extractScalarMarker(body, "Modality");
  const severity = extractScalarMarker(body, "Severity");

  const trigger = extractTriggerBlock(body);

  const when = extractParagraphMarker(body, "When");
  const ifField = extractParagraphMarker(body, "If");
  const then = extractParagraphMarker(body, "Then");
  const because = extractParagraphMarker(body, "Because");

  const exampleQueries = extractBulletQuoted(body, "Examples");
  const counterExample = extractParagraphMarker(body, "Counter-example");
  const antiPattern = extractParagraphMarker(body, "Anti-pattern");
  const signalToAction = extractParagraphMarker(body, "Signal-to-Action");
  const narrative = extractParagraphMarker(body, "Narrative");
  const evidence = extractParagraphMarker(body, "Evidence");

  // 관계 필드 (md 에서 새로 선언된 것 + 기존 보존)
  const mdDependsOn = extractRelationList(body, "Precondition");
  const mdAppliesWith = extractRelationList(body, "Co-applies");
  const mdMetaOf = extractRelationList(body, "Parent-rule");

  // slug-only 는 DA prefix 자동 추가
  const expandRelation = (r: string): string =>
    r.startsWith("DA-") ? r : `${lex.options["da-id-prefix"]}${r}`;

  const mergedDependsOn = Array.from(
    new Set([
      ...(existing?.["depends-on"] ?? []),
      ...mdDependsOn.map(expandRelation),
    ])
  );
  const mergedAppliesWith = Array.from(
    new Set([
      ...(existing?.["applies-with"] ?? []),
      ...mdAppliesWith.map(expandRelation),
    ])
  );
  const mergedMetaOf = Array.from(
    new Set([
      ...(existing?.["meta-of"] ?? []),
      ...mdMetaOf.map(expandRelation),
    ])
  );

  // sources: 기존 유지하되 canonical path 는 새 md 섹션으로 갱신
  const newCanonical = `~/.claude/${mdRelPath} §${section.slug}`;
  const existingSources = (existing?.sources as Record<string, unknown>[]) ?? [];
  const updatedSources = existingSources.length > 0
    ? existingSources.map((s) =>
        s && typeof s === "object" && "canonical" in s
          ? { ...s, canonical: newCanonical, "last-verified": "2026-04-22" }
          : s
      )
    : [
        {
          canonical: newCanonical,
          "section-sha256": "PLACEHOLDER_RUN_MIGRATE",
          "last-verified": "2026-04-22",
        },
      ];

  // chain kind 전용 필드 추출
  const sequence = kind === "chain" ? extractSequence(body) : [];
  const entryConditions = kind === "chain" ? extractParagraphMarker(body, "Entry-conditions") : null;
  const exitConditions = kind === "chain" ? extractParagraphMarker(body, "Exit-conditions") : null;
  const numericBounds = extractNumericBounds(body); // 모든 kind 허용

  // agent 가 chain derived marker 를 실수로 작성한 경우 경고 + 무시
  if (kind === "chain") {
    const deprecatedMarkers = ["Input-role", "Output-role", "Output-condition", "Actors"];
    for (const dm of deprecatedMarkers) {
      if (extractScalarMarker(body, dm) !== null) {
        console.warn(
          `[md-to-da] WARN ${section.slug}: '**${dm}**:' is a derived marker for chain kind — auto-derived from Sequence, agent value ignored.`
        );
      }
    }
  }

  // 필수 필드 검증
  if (kind === "chain") {
    // chain 은 when 선택, sequence 필수 (최소 3 step) + because 필수
    if (!because || sequence.length < 3) {
      console.warn(
        `[md-to-da] SKIP ${section.slug}: chain kind requires because + sequence (>=3 steps). Got sequence=${sequence.length}`
      );
      return null;
    }
    // 각 step 의 action 필드 필수
    const missingAction = sequence.find((s) => !s.action || s.action.trim() === "");
    if (missingAction) {
      console.warn(
        `[md-to-da] SKIP ${section.slug}: chain step ${missingAction.step} missing action`
      );
      return null;
    }
  } else {
    // 기존 kind: when/then/because 필수
    if (!kind || !when || !then || !because) {
      console.warn(
        `[md-to-da] SKIP ${section.slug}: missing required field (kind/when/then/because)`
      );
      return null;
    }
  }

  const da: Record<string, unknown> = {
    id: daId,
    kind,
    priority: priority ?? "medium",
  };
  if (modality) da.modality = modality;
  if (severity) da.severity = severity;

  da.trigger = trigger;

  if (kind === "chain") {
    // chain: when/if/then 선택적
    if (when) da.when = when;
    if (ifField) da.if = ifField;
    if (then) da.then = then;
  } else {
    da.when = when;
    if (ifField) da.if = ifField;
    da.then = then;
  }
  da.because = because;

  da.sources = updatedSources;

  // chain kind 전용 필드
  if (kind === "chain") {
    da.sequence = sequence;
    if (entryConditions) da["entry-conditions"] = entryConditions;
    if (exitConditions) da["exit-conditions"] = exitConditions;

    // Derived markers (agent 작성 금지, Sequence 에서 자동 파생)
    const derived = deriveChainMarkers(sequence);
    da["input-role"] = derived["input-role"];
    da["output-role"] = derived["output-role"];
    da["output-condition"] = derived["output-condition"];
    da.actors = derived.actors;

    // B.6-γ: sequence-sha256 — sources[] 에 추가 (drift 감지용)
    const sequenceHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(sequence))
      .digest("hex");
    const sourcesArr = da.sources as Record<string, unknown>[];
    if (sourcesArr && sourcesArr.length > 0) {
      // canonical source 에 sequence-sha256 추가
      da.sources = sourcesArr.map((s, i) =>
        i === 0 ? { ...s, "sequence-sha256": sequenceHash } : s
      );
    }
  }

  // numeric-bounds: 모든 kind 허용
  if (numericBounds.length > 0) {
    da["numeric-bounds"] = numericBounds;
  }

  if (counterExample) da["counter-example"] = counterExample;
  if (antiPattern) da["anti-pattern"] = antiPattern;

  // v2 관계 필드
  da["depends-on"] = mergedDependsOn;
  da["applies-with"] = mergedAppliesWith;
  da["meta-of"] = mergedMetaOf;

  // v3 신규 필드
  if (exampleQueries.length > 0) da["example-queries"] = exampleQueries;
  if (narrative) da.narrative = narrative;
  if (evidence) da.evidence = evidence;

  // detail-table 은 기존 유지 (md 재작성 시 별도 Detail 블록 파싱 불필요 — 보존)
  if (existing?.["detail-table"]) da["detail-table"] = existing["detail-table"];

  // 메타
  da.version = lex.options["new-version"];
  da.status = existing?.status ?? "active";
  da["effective-from"] =
    existing?.["effective-from"] ?? "2026-04-22T00:00:00.000Z";
  da["last-verified"] = "2026-04-22T00:00:00.000Z";
  da.utility = existing?.utility ?? 0.7;
  if (existing?.["last-hit"]) da["last-hit"] = existing["last-hit"];
  da["hit-count"] = existing?.["hit-count"] ?? 0;
  if (existing?.supersedes) da.supersedes = existing.supersedes;
  if (existing?.superseded) da.superseded = existing.superseded;

  return { yaml: da, signalToAction };
}

// ============================================================
// YAML → 파일 쓰기 (기존 헤더 포맷 유지)
// ============================================================
function renderYamlFile(da: Record<string, unknown>, signalToAction: string | null): string {
  const yamlBody = yaml.dump(da, {
    lineWidth: 200,
    quotingType: '"',
    forceQuotes: false,
    noRefs: true,
  });
  const daId = da.id as string;
  const title = (da.then as string)?.split(".")[0] ?? daId;

  return `---
${yamlBody}---

# ${daId}

## Signal-to-Action

${signalToAction ?? (da.then as string) ?? ""}

## 적용 사례 (retrospective 연계)

- (md-rewrite 변환 시점 — retrospective 누적 예정)
`;
}

// ============================================================
// L2 NL Grammar Lexicon (본문 어휘 — llm-free DA generation)
// ============================================================
interface NlEntry {
  tier: number;
  stem?: string;       // verbs
  forms?: string[];    // verbs
  text?: string;       // endings / connectives
  modality?: string;   // endings
  da_field?: string;   // connectives
  occurrences?: number;
  file_coverage?: number;
}

interface NlLexicon {
  verbs: NlEntry[];
  endings: NlEntry[];
  connectives: NlEntry[];
}

async function loadNlLexicon(): Promise<NlLexicon> {
  const raw = await fs.readFile(NL_LEXICON_PATH, "utf-8");
  return yaml.load(raw) as NlLexicon;
}

// placeholder 변환: {X}/{Y}/{Z} → .+? , ~ → .*?
function patternToRegex(text: string): RegExp {
  let s = text.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  s = s.replace(/\\\{[XYZ]\\\}/g, ".+?");
  s = s.replace(/~/g, ".*?");
  if (s.startsWith("-")) s = s.slice(1); // "-해야 한다" → "해야 한다"
  return new RegExp(s);
}

interface Matchers {
  verbStems: string[];
  endingRes: RegExp[];
  connectiveRes: RegExp[];
}

function buildMatchers(lex: NlLexicon, maxTier: number = 2): Matchers {
  const filter = <T extends { tier: number }>(items: T[]) => items.filter((x) => x.tier <= maxTier);
  return {
    verbStems: filter(lex.verbs).map((v) => v.stem!).filter(Boolean),
    endingRes: filter(lex.endings).map((e) => patternToRegex(e.text!)),
    connectiveRes: filter(lex.connectives).map((c) => patternToRegex(c.text!)),
  };
}

function sentenceMatches(s: string, m: Matchers): boolean {
  if (m.verbStems.some((v) => s.includes(v))) return true;
  if (m.endingRes.some((r) => r.test(s))) return true;
  if (m.connectiveRes.some((r) => r.test(s))) return true;
  return false;
}

// 섹션 body 를 문장 단위 분해 → lexicon 매칭 → unmatched 리포트
interface RuleCheckResult {
  slug: string;
  totalSentences: number;
  unmatched: { marker: string; sentence: string }[];
}

function rulePass(section: MdSection, m: Matchers): RuleCheckResult {
  const MARKERS = ["When", "If", "Then", "Because", "Counter-example", "Anti-pattern", "Signal-to-Action"];
  const unmatched: { marker: string; sentence: string }[] = [];
  let total = 0;
  for (const marker of MARKERS) {
    const para = extractParagraphMarker(section.raw, marker);
    if (!para) continue;
    // 줄 단위 + 문장 구두점 분해
    const sentences = para
      .split(/\n+|\.(?=\s+[가-힣A-Z])/)
      .map((s) => s.trim())
      .filter((s) => {
        if (s.length <= 5) return false;
        if (s.startsWith("**")) return false;
        if (s.startsWith("-")) return false;
        if (s.startsWith("예: ") || s.startsWith("예) ") || s.startsWith("예)")) return false;
        // 한글 2자 미만이면 자연어 문장 아님 (파일경로·코드샘플·단독 식별자 등)
        const koreanCount = (s.match(/[가-힣]/g) || []).length;
        if (koreanCount < 2) return false;
        return true;
      });
    for (const s of sentences) {
      total++;
      if (!sentenceMatches(s, m)) {
        unmatched.push({ marker, sentence: s });
      }
    }
  }
  return { slug: section.slug, totalSentences: total, unmatched };
}

async function runRuleCheck(sections: MdSection[]): Promise<number> {
  const nlLex = await loadNlLexicon();
  // SCHEMA §6: rule parser 는 전체 T1+T2+T3 load (maxTier=3)
  const matchers = buildMatchers(nlLex, 3);
  let totalUnmatched = 0;
  let totalSentences = 0;
  for (const sec of sections) {
    const r = rulePass(sec, matchers);
    totalSentences += r.totalSentences;
    if (r.unmatched.length > 0) {
      console.log(`[rule-check] ${r.slug}: ${r.unmatched.length}/${r.totalSentences} unmatched`);
      for (const u of r.unmatched) {
        console.log(`  [${u.marker}] ${u.sentence.slice(0, 100)}${u.sentence.length > 100 ? "..." : ""}`);
      }
    } else if (r.totalSentences > 0) {
      console.log(`[rule-check] ${r.slug}: ✓ ${r.totalSentences} sentences all matched`);
    }
    totalUnmatched += r.unmatched.length;
  }
  console.log(`\n[rule-check] total: ${totalSentences} sentences, ${totalUnmatched} unmatched`);
  return totalUnmatched;
}

// ============================================================
// Structure-check: DA 스키마 구조 검증 (S1-S4)
// ============================================================
interface StructureViolation {
  code: "S1" | "S2" | "S3" | "S4";
  slug?: string;
  detail: string;
}

interface StructureCheckResult {
  file: string;
  totalBytes: number;
  daBytes: number;
  daRatio: number;
  sectionCount: number;
  violations: StructureViolation[];
  totalViolations: number;
}

// S3 판정 임계값: DA 섹션이 차지하는 byte 비율의 하한 (0.6 → narrative 40%+ 초과 시 violation)
const DA_RATIO_THRESHOLD = 0.6;

function runStructureCheck(
  mdPath: string,
  md: string,
  sections: MdSection[]
): StructureCheckResult {
  const violations: StructureViolation[] = [];
  const totalBytes = Buffer.byteLength(md, "utf-8");

  // S1: No-DA-Section
  if (sections.length === 0) {
    violations.push({
      code: "S1",
      detail: "No DA section (## {kebab-slug}) found in file",
    });
  }

  // S2 + S4 per-section
  let daBytes = 0;
  for (const sec of sections) {
    const secBytes = Buffer.byteLength(sec.raw, "utf-8");
    const kind = extractScalarMarker(sec.raw, "Kind");
    const when = extractParagraphMarker(sec.raw, "When");
    const then = extractParagraphMarker(sec.raw, "Then");
    const because = extractParagraphMarker(sec.raw, "Because");

    if (!kind) {
      // S4: heading exists but no Kind bold-marker (free narrative under kebab heading)
      violations.push({
        code: "S4",
        slug: sec.slug,
        detail: `## ${sec.slug}: heading exists but **Kind**: marker missing (free narrative, not DA schema)`,
      });
      // S4 섹션은 DA bytes 로 집계하지 않음 (narrative 로 취급)
      continue;
    }

    // S2: Incomplete-DA (필수 필드 누락; If 는 optional)
    const missing: string[] = [];
    if (!when) missing.push("When");
    if (!then) missing.push("Then");
    if (!because) missing.push("Because");
    if (missing.length > 0) {
      violations.push({
        code: "S2",
        slug: sec.slug,
        detail: `## ${sec.slug}: missing required fields: ${missing.join(", ")}`,
      });
    }

    daBytes += secBytes;
  }

  // S3: Narrative-Overflow (DA ratio < threshold → narrative 비율 과다)
  const daRatio = totalBytes > 0 ? daBytes / totalBytes : 0;
  if (sections.length > 0 && daRatio < DA_RATIO_THRESHOLD) {
    const narrativePct = Math.round((1 - daRatio) * 100);
    violations.push({
      code: "S3",
      detail: `Narrative overflow: DA=${daBytes}/${totalBytes} bytes (${Math.round(
        daRatio * 100
      )}%), narrative=${narrativePct}% > ${Math.round((1 - DA_RATIO_THRESHOLD) * 100)}%`,
    });
  }

  return {
    file: mdPath,
    totalBytes,
    daBytes,
    daRatio: Number(daRatio.toFixed(4)),
    sectionCount: sections.length,
    violations,
    totalViolations: violations.length,
  };
}

// ============================================================
// Main
// ============================================================
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const ruleCheck = args.includes("--rule-check");
  const structureCheck = args.includes("--structure-check");
  const mdPath = args.find((a) => !a.startsWith("--"));
  if (!mdPath) {
    console.error(
      "Usage: npx tsx md-to-da.ts <md-path> [--dry-run|--rule-check|--structure-check]"
    );
    process.exit(1);
  }

  const lex = await loadLexicon();
  const md = await fs.readFile(mdPath, "utf-8");

  // md relative path: C:/Users/jsh86/.claude/rules/remote-session.md → rules/remote-session.md
  const mdRelPath = mdPath
    .replace(/\\/g, "/")
    .replace(/^.*\.claude\//, "");

  const headerRegex = new RegExp(lex.options["section-header-regex"], "m");
  const sections = extractSections(md, headerRegex);

  // --structure-check: DA 스키마 구조 검증만 (섹션 헤더 로그 억제, JSON 출력)
  if (structureCheck) {
    const result = runStructureCheck(mdPath, md, sections);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.totalViolations > 0 ? 1 : 0);
  }

  console.log(`[md-to-da] ${mdPath} — ${sections.length} sections detected`);

  // --rule-check: L2 lexicon compliance only (no YAML write)
  if (ruleCheck) {
    const unmatchedCount = await runRuleCheck(sections);
    process.exit(unmatchedCount > 0 ? 1 : 0);
  }

  let succeeded = 0;
  let skipped = 0;
  for (const section of sections) {
    const result = await sectionToDa(section, lex, mdRelPath);
    if (!result) {
      skipped++;
      continue;
    }
    const { yaml: da, signalToAction } = result;
    const outPath = path.join(DECISIONS_DIR, `${da.id}.yaml`);
    const content = renderYamlFile(da, signalToAction);

    if (dryRun) {
      console.log(`[dry-run] would write ${outPath}`);
      console.log(content.slice(0, 500) + "...\n");
    } else {
      await fs.writeFile(outPath, content, "utf-8");
      console.log(`[md-to-da]   ✓ ${da.id}`);
    }
    succeeded++;
  }

  console.log(
    `\n[md-to-da] Done. sections=${sections.length}, succeeded=${succeeded}, skipped=${skipped}`
  );
}

main().catch((err) => {
  console.error("[md-to-da] FATAL:", err);
  process.exit(1);
});
