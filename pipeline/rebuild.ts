// ~/.claude/scripts/da-vector/rebuild.ts — 전량 재색인

import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";
import * as crypto from "crypto";
import { connect, ingestDA, fetchBgeEmbedding } from "./lancedb-client.js";

const HOME = process.env.HOME ?? "C:/Users/jsh86";
const DECISIONS_DIR = path.join(HOME, ".claude", "decisions");
const LEXICON_PATH = path.join(HOME, ".claude", "scripts", "da-vector", "lexicon.yaml");
const TABLE = "da_v1";

// 4-state lifecycle 최소 훅 — 색인 대상 status. archived/deprecated 는 YAML 보존하되 검색 제외.
const ACTIVE_STATUSES = new Set(["active", "dormant"]);

// Lexicon domain-synonyms 로드 — rebuild 시 1 DA 의 어휘 공간 확장
interface DomainSynonym {
  concept: string;
  canonical: string;
  synonyms: string[];
}
let DOMAIN_SYNONYMS: DomainSynonym[] = [];

async function loadLexiconSynonyms(): Promise<void> {
  try {
    const raw = await fs.readFile(LEXICON_PATH, "utf-8");
    const lex = yaml.load(raw) as { "domain-synonyms"?: DomainSynonym[] };
    DOMAIN_SYNONYMS = lex["domain-synonyms"] ?? [];
    console.log(`[rebuild] Lexicon loaded: ${DOMAIN_SYNONYMS.length} domain concepts`);
  } catch (e) {
    console.warn(`[rebuild] Lexicon load failed, continuing without synonyms:`, e);
  }
}

// DA 텍스트에서 canonical 을 매칭해 synonym 들을 concat
// 효과: 1 DA 가 여러 자연어 variant 로 embed 됨 → 쿼리 어휘 커버리지 상승
function expandWithSynonyms(text: string): string {
  const variants: string[] = [];
  const lower = text.toLowerCase();
  for (const { canonical, synonyms } of DOMAIN_SYNONYMS) {
    // canonical 또는 synonym 중 하나라도 text 에 등장하면 전체 synonym 를 추가
    const allTerms = [canonical, ...synonyms];
    const matched = allTerms.some((t) => lower.includes(t.toLowerCase()));
    if (matched) {
      variants.push(...synonyms);
    }
  }
  if (variants.length === 0) return "";
  // 중복 제거
  return Array.from(new Set(variants)).join(" ");
}

// ============================================================
// B.6-γ: chain kind sequence-sha256 drift 체크
// ============================================================

/**
 * canonical path 에서 해당 섹션의 Sequence 블록을 추출해 sha256 계산
 * canonical 형식: "~/.claude/rules/file-standards.md §slug"
 */
async function computeSequenceSha256FromCanonical(
  canonical: string
): Promise<string | null> {
  try {
    // "~/.claude/..." → 절대경로 변환
    const HOME_DIR = HOME.replace(/\\/g, "/");
    const filePart = canonical.split(" §")[0];
    const slug = canonical.split(" §")[1];
    if (!slug) return null;
    const absPath = filePart.replace(/^~\/\.claude\//, `${HOME_DIR}/.claude/`);
    const md = await fs.readFile(absPath, "utf-8");

    // 해당 slug 섹션 추출
    const sectionRe = new RegExp(
      `^## ${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$([\\s\\S]*?)(?=^## [a-z]|$)`,
      "m"
    );
    const m = md.match(sectionRe);
    if (!m) return null;
    const sectionBody = m[1];

    // Sequence 블록 파싱 (md-to-da.ts extractSequence 와 동일 로직)
    const seqRe = /^\*\*Sequence\*\*:\s*\n([\s\S]*?)(?=\n\*\*[A-Z][^*]*\*\*:|\n---|$)/mi;
    const seqM = sectionBody.match(seqRe);
    if (!seqM) return null;
    const block = seqM[1];
    const stepRe = /^- step:\s*([^\n]+)\n((?:[ \t]{2,}[^\n]+\n?)*)/gm;
    const steps: Record<string, unknown>[] = [];
    let sm;
    while ((sm = stepRe.exec(block)) !== null) {
      const stepId = sm[1].trim();
      const stepBody = sm[2];
      const s: Record<string, unknown> = {
        step: /^\d+$/.test(stepId) ? parseInt(stepId, 10) : stepId,
        action: "",
      };
      const fieldRe = /^[ \t]{2,}([\w-]+):\s*(.+?)$/gm;
      let fm;
      while ((fm = fieldRe.exec(stepBody)) !== null) {
        s[fm[1]] = fm[2].trim().replace(/^["']|["']$/g, "");
      }
      steps.push(s);
    }
    if (steps.length === 0) return null;

    return crypto.createHash("sha256").update(JSON.stringify(steps)).digest("hex");
  } catch {
    return null; // 파일 없거나 파싱 실패 → drift 체크 생략
  }
}

/**
 * chain kind DA 의 sequence drift 체크
 * 반환: { drifted: boolean, message?: string }
 */
async function checkChainSequenceDrift(
  da: Record<string, unknown>,
  filePath: string
): Promise<{ drifted: boolean; message?: string }> {
  const sources = da.sources as Record<string, unknown>[] | undefined;
  if (!sources || sources.length === 0) return { drifted: false };

  const primarySource = sources[0];
  const storedHash = primarySource["sequence-sha256"] as string | undefined;
  const canonical = primarySource["canonical"] as string | undefined;

  if (!storedHash || !canonical) return { drifted: false };

  const currentHash = await computeSequenceSha256FromCanonical(canonical);
  if (!currentHash) return { drifted: false }; // 파싱 실패 → 체크 생략

  if (currentHash !== storedHash) {
    return {
      drifted: true,
      message:
        `sequence drift detected: ${path.basename(filePath)}\n` +
        `md body modified but yaml sequence field not updated.\n` +
        `run: npx tsx ~/.claude/scripts/da-vector/md-to-da.ts --file <md-path>\n` +
        `or use --force-rebuild to regenerate yaml.`,
    };
  }
  return { drifted: false };
}

async function main(): Promise<void> {
  // CLI flags
  const args = process.argv.slice(2);
  const forceRebuild = args.includes("--force-rebuild");
  const dryRun = args.includes("--dry-run");
  if (forceRebuild) {
    console.log("[rebuild] --force-rebuild: sequence drift check bypassed.");
  }

  // 0. Lexicon 로드 (synonym expansion 용)
  await loadLexiconSynonyms();

  // 1. embed 서비스 연결 확인
  try {
    await fetchBgeEmbedding("ping");
  } catch {
    console.error(
      "[rebuild] ERROR: embed service not running at :8787. Start with: python embed_service.py"
    );
    process.exit(1);
  }

  // 2. DA-*.yaml 파일 목록 수집
  let files: string[];
  try {
    const entries = await fs.readdir(DECISIONS_DIR);
    files = entries
      .filter((f) => f.startsWith("DA-") && f.endsWith(".yaml"))
      .map((f) => path.join(DECISIONS_DIR, f));
  } catch (err) {
    console.error(`[rebuild] ERROR: Cannot read decisions dir: ${DECISIONS_DIR}`, err);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("[rebuild] No DA-*.yaml files found. Nothing to do.");
    return;
  }

  // 3. 기존 테이블 삭제 (drop → rebuild)
  try {
    const db = await connect();
    const tableNames = await db.tableNames();
    if (tableNames.includes(TABLE)) {
      await db.dropTable(TABLE);
      console.log(`[rebuild] Dropped existing table '${TABLE}'.`);
    }
  } catch (err) {
    console.warn("[rebuild] WARN: Could not drop table (may not exist):", err);
  }

  const total = files.length;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  // 4. 각 DA 파일 처리
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = path.basename(filePath);

    console.log(`[rebuild] Processing ${fileName} ... (${i + 1}/${total})`);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) {
        console.warn(`[rebuild] SKIP: ${fileName} — no YAML frontmatter found.`);
        failed++;
        continue;
      }
      const da = yaml.load(fmMatch[1]) as Record<string, unknown>;

      if (!da || typeof da !== "object" || !da.id) {
        console.warn(`[rebuild] SKIP: ${fileName} — missing 'id' field.`);
        failed++;
        continue;
      }

      // status filter — active/dormant 만 색인. archived/deprecated 는 YAML 보존하되 검색 제외.
      // status 필드 없으면 backward compat 으로 active 간주.
      const status = (da.status as string) ?? "active";
      if (!ACTIVE_STATUSES.has(status)) {
        console.log(`[rebuild] SKIP: ${da.id} status=${status}`);
        skipped++;
        continue;
      }

      // B.6-γ: chain kind sequence drift 체크 (--force-rebuild 로 우회 가능)
      if (da.kind === "chain" && !forceRebuild) {
        const driftResult = await checkChainSequenceDrift(da, filePath);
        if (driftResult.drifted) {
          console.error(`[rebuild] ERROR: ${driftResult.message}`);
          process.exit(2);
        }
      }

      // 임베딩 텍스트 = sharp signal only (v4 실험 — noise 제거)
      // v3 대비 제거: Modality/Severity/Narrative/Variants (discrimination 희박 or broad noise)
      // 유지: id/kind/keywords/context/when/if/then/because/example-queries (sharp signal)
      const trigger = (da.trigger as Record<string, unknown>) ?? {};
      const keywords = Array.isArray(trigger.keywords) ? (trigger.keywords as string[]).join(", ") : "";
      const contextHints = Array.isArray(trigger["context-hints"]) ? (trigger["context-hints"] as string[]).join(", ") : "";
      const exampleQueries = Array.isArray(da["example-queries"])
        ? (da["example-queries"] as string[]).map((q) => `"${q}"`).join(" ")
        : "";

      const embedText = [
        `Rule: ${da.id ?? ""}`,
        da.kind ? `Type: ${da.kind}.` : "",
        da.priority ? `Priority: ${da.priority}.` : "",
        keywords ? `Keywords: ${keywords}.` : "",
        contextHints ? `Context: ${contextHints}.` : "",
        da.when ? `When: ${da.when}` : "",
        da.if ? `If: ${da.if}` : "",
        da.then ? `Then: ${da.then}` : "",
        da.because ? `Because: ${da.because}` : "",
        exampleQueries ? `Examples: ${exampleQueries}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const vector = await fetchBgeEmbedding(embedText);
      await ingestDA(da, vector);

      console.log(`[rebuild]   ✓ ${da.id}`);
      succeeded++;
    } catch (err) {
      console.error(`[rebuild] ERROR: ${fileName}`, err);
      failed++;
    }
  }

  // 5. 결과 요약
  console.log(
    `\n[rebuild] Done. total=${total}, succeeded=${succeeded}, failed=${failed}, skipped=${skipped}`
  );

  // Post-hook: enrich-cross-ref 자동 호출 (--skip-enrich 로 우회)
  const skipEnrich = process.argv.includes("--skip-enrich");
  if (!skipEnrich) {
    console.log("[rebuild] Starting post-hook: enrich-cross-ref (scope=all, threshold=0.75)");
    try {
      const { enrichCrossRef } = await import("./enrich-cross-ref.js");
      const result = await enrichCrossRef({ scope: null, threshold: 0.75 });
      console.log(`[rebuild] enrich=auto applied=${result.updated} links=${result.linksAdded}`);
    } catch (e) {
      console.warn(`[rebuild] enrich post-hook failed (non-fatal):`, e);
    }
  } else {
    console.log("[rebuild] enrich post-hook skipped (--skip-enrich)");
  }

  // Post-hook: INDEX-critical.md 자동 재생성 (L10.6, --skip-index 로 우회)
  const skipIndex = process.argv.includes("--skip-index");
  if (!skipIndex) {
    console.log("[rebuild] Starting post-hook: build-index-critical");
    try {
      const { buildIndexCritical } = await import("./build-index-critical.js");
      const r = await buildIndexCritical();
      console.log(`[rebuild] INDEX-critical.md regenerated — ${r.count} DAs → ${r.path}`);
    } catch (e) {
      console.warn(`[rebuild] build-index-critical post-hook failed (non-fatal):`, e);
    }
  } else {
    console.log("[rebuild] build-index-critical post-hook skipped (--skip-index)");
  }

  // Post-hook: T2 keyword 역인덱스 재생성 (L11.2, --skip-kw-index 로 우회)
  const skipKwIndex = process.argv.includes("--skip-kw-index");
  if (!skipKwIndex) {
    console.log("[rebuild] Starting post-hook: build-t2-keyword-index");
    try {
      const { buildT2KeywordIndex } = await import("./build-t2-keyword-index.js");
      const r = await buildT2KeywordIndex();
      console.log(
        `[rebuild] t2-keyword-index regenerated — ${r.total} DAs, ${r.kwCount} unique keywords, ${r.toolCount} tool-names → ${r.path}`
      );
    } catch (e) {
      console.warn(`[rebuild] build-t2-keyword-index post-hook failed (non-fatal):`, e);
    }
  } else {
    console.log("[rebuild] build-t2-keyword-index post-hook skipped (--skip-kw-index)");
  }
}

main().catch(console.error);
