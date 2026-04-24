// enrich-cross-ref.ts — embedding cosine 기반 자동 applies-with backfill
// 용도: 기존 DA 의 `applies-with` 필드가 비어있을 때 embedding 유사도로 자동 링크
// 사용: npx tsx enrich-cross-ref.ts [--scope=harness-wf] [--threshold=0.82] [--dry-run]
// 기본: threshold 0.82, 한 DA 당 최대 8개 applies-with

import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";
import { connect } from "./lancedb-client.js";

const HOME = process.env.HOME ?? "C:/Users/jsh86";
const DECISIONS_DIR = path.join(HOME, ".claude", "decisions");
const TABLE = "da_v1";

const DEFAULT_THRESHOLD = 0.82;
const MAX_APPLIES_WITH_PER_DA = 8;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

interface Row {
  id: string;
  vector: number[];
}

export interface EnrichOptions {
  scope?: string | null;
  threshold?: number;
  dryRun?: boolean;
  maxPerDa?: number;
}

export interface EnrichResult {
  updated: number;
  linksAdded: number;
}

export async function enrichCrossRef(opts: EnrichOptions = {}): Promise<EnrichResult> {
  const scope = opts.scope ?? null;
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const dryRun = opts.dryRun ?? false;
  const maxPerDa = opts.maxPerDa ?? MAX_APPLIES_WITH_PER_DA;

  const db = await connect();
  const table = await db.openTable(TABLE);
  const allRowsAny = (await table.query().toArray()) as Record<string, unknown>[];
  const rows: Row[] = allRowsAny.map((r) => {
    // LanceDB 가 Apache Arrow Vector 로 반환 — Array.from 으로 변환
    const vec = Array.from(r.vector as ArrayLike<number>);
    return { id: r.id as string, vector: vec };
  });

  console.log(`[enrich] Total rows in LanceDB: ${rows.length}`);

  const filtered = scope ? rows.filter((r) => r.id.includes(scope)) : rows;
  console.log(`[enrich] After scope filter: ${filtered.length}`);

  if (filtered.length < 2) {
    console.log("[enrich] Not enough DAs for cross-ref.");
    return { updated: 0, linksAdded: 0 };
  }

  // Pairwise cosine (within scope)
  const suggestions = new Map<string, Array<{ otherId: string; score: number }>>();
  for (let i = 0; i < filtered.length; i++) {
    for (let j = i + 1; j < filtered.length; j++) {
      const a = filtered[i];
      const b = filtered[j];
      const score = cosine(a.vector, b.vector);
      if (score >= threshold) {
        if (!suggestions.has(a.id)) suggestions.set(a.id, []);
        if (!suggestions.has(b.id)) suggestions.set(b.id, []);
        suggestions.get(a.id)!.push({ otherId: b.id, score });
        suggestions.get(b.id)!.push({ otherId: a.id, score });
      }
    }
  }

  console.log(`[enrich] DAs with new cross-ref candidates: ${suggestions.size}`);

  // Trim to top N
  for (const [id, candidates] of suggestions) {
    candidates.sort((x, y) => y.score - x.score);
    if (candidates.length > maxPerDa) {
      suggestions.set(id, candidates.slice(0, maxPerDa));
    }
  }

  // Update yaml files
  let updatedCount = 0;
  let totalAdded = 0;
  for (const [id, candidates] of suggestions) {
    const filePath = path.join(DECISIONS_DIR, `${id}.yaml`);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf-8");
    } catch {
      console.warn(`[enrich] SKIP ${id}: yaml file not found`);
      continue;
    }

    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) {
      console.warn(`[enrich] SKIP ${id}: no frontmatter`);
      continue;
    }

    const fm = yaml.load(m[1]) as Record<string, unknown>;
    const existing = new Set<string>((fm["applies-with"] as string[]) ?? []);
    const newCandidates = candidates.map((c) => c.otherId);
    const merged = Array.from(new Set<string>([...existing, ...newCandidates]));
    const added = merged.length - existing.size;

    if (added === 0) continue;

    fm["applies-with"] = merged;
    const newFm = yaml.dump(fm, { lineWidth: -1, noRefs: true });
    const newRaw = `---\n${newFm}---\n${m[2]}`;

    if (!dryRun) {
      await fs.writeFile(filePath, newRaw, "utf-8");
    }
    const scoreSummary = candidates
      .slice(0, 3)
      .map((c) => `${c.otherId.replace("DA-20260422-", "")}@${c.score.toFixed(2)}`)
      .join(", ");
    console.log(
      `[enrich] ${id}: +${added} applies-with (total ${merged.length}) [${scoreSummary}${candidates.length > 3 ? ", ..." : ""}]`
    );
    updatedCount++;
    totalAdded += added;
  }

  return { updated: updatedCount, linksAdded: totalAdded };
}

async function cliMain(): Promise<void> {
  const args = process.argv.slice(2);
  const scopeArg = args.find((a) => a.startsWith("--scope="));
  const scope = scopeArg ? scopeArg.split("=")[1] : null;
  const thresholdArg = args.find((a) => a.startsWith("--threshold="));
  const threshold = thresholdArg ? parseFloat(thresholdArg.split("=")[1]) : DEFAULT_THRESHOLD;
  const dryRun = args.includes("--dry-run");

  console.log(
    `[enrich] scope=${scope ?? "all"} threshold=${threshold} dry-run=${dryRun}`
  );
  const result = await enrichCrossRef({ scope, threshold, dryRun });
  console.log(`\n[enrich] Summary:`);
  console.log(`  yaml files updated: ${result.updated}`);
  console.log(`  total applies-with links added: ${result.linksAdded}`);
  console.log(
    `  ${dryRun ? "DRY-RUN — no writes performed" : "DONE. Run `npx tsx rebuild.ts` to re-index."}`
  );
}

// CLI 진입 시에만 cliMain 실행
const isCliEntry = process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("enrich-cross-ref");
if (isCliEntry) {
  cliMain().catch((e) => {
    console.error("[enrich] ERROR:", e);
    process.exit(1);
  });
}
