// ~/.claude/scripts/da-vector/enrich-da-keywords.ts
// L12.2 — 기존 303 DA 전수 keyword 보강 (Opus batch 대체, OAuth Haiku 로컬 호출)
//
// 각 DA yaml 을 Read → frontmatter 의 when/if/then/because/example-queries/signal-to-action
// 을 Haiku 에 넘겨 field-weighted keyword 추출 → auto-keywords 필드 추가 (기존 trigger.keywords
// 와 Levenshtein ≤ 2 중복 제거) → yaml 저장.
//
// CLI:
//   npx tsx enrich-da-keywords.ts [--dry-run] [--limit N] [--only DA-slug]

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import * as yaml from "js-yaml";

const HOME = process.env.HOME ?? "C:/Users/jsh86";
const DECISIONS_DIR = path.join(HOME, ".claude", "decisions");

function loadOAuthToken(): string | null {
  try {
    const c = JSON.parse(
      fs.readFileSync("C:/Users/jsh86/.claude/.credentials.json", "utf8")
    );
    const t = c.claudeAiOauth?.accessToken;
    const exp = c.claudeAiOauth?.expiresAt;
    if (!t || (exp && Date.now() >= exp)) return null;
    return t;
  } catch {
    return null;
  }
}

interface DAYaml {
  id: string;
  trigger?: { keywords?: string[] };
  when?: string;
  if?: string;
  then?: string;
  because?: string;
  "example-queries"?: string[];
  "signal-to-action"?: string;
  "auto-keywords"?: string[];
  [k: string]: unknown;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
    }
  }
  return dp[m][n];
}

function callHaiku(token: string, prompt: string): string {
  const body = JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });
  const tmpPath = path.join(os.tmpdir(), `haiku-enrich-${Date.now()}-${process.pid}.json`);
  try {
    fs.writeFileSync(tmpPath, body, "utf8");
    const r = spawnSync(
      "curl",
      [
        "-s",
        "-m",
        "8",
        "-X",
        "POST",
        "https://api.anthropic.com/v1/messages",
        "-H",
        "Content-Type: application/json; charset=utf-8",
        "-H",
        "Authorization: Bearer " + token,
        "-H",
        "anthropic-version: 2023-06-01",
        "-H",
        "anthropic-beta: oauth-2025-04-20",
        "--data-binary",
        "@" + tmpPath,
      ],
      { encoding: "utf8", timeout: 10000 }
    );
    if (r.status !== 0 || !r.stdout) return "";
    const resp = JSON.parse(r.stdout);
    if (resp.error) return "";
    return (resp.content?.[0]?.text?.trim() || "").toLowerCase();
  } catch {
    return "";
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

function buildPrompt(da: DAYaml): string {
  const eq = Array.isArray(da["example-queries"]) ? da["example-queries"].join(" | ") : "";
  const fields = [
    `id: ${da.id}`,
    da.when ? `when: ${da.when}` : "",
    da.if ? `if: ${da.if}` : "",
    da.then ? `then: ${da.then}` : "",
    da.because ? `because: ${da.because}` : "",
    eq ? `example-queries: ${eq}` : "",
    da["signal-to-action"] ? `signal-to-action: ${da["signal-to-action"]}` : "",
  ].filter(Boolean).join("\n");

  return `Extract 10-20 search keywords for this Decision Asset. Focus on terms a user might search for (both Korean and English). Include synonyms, function names, tool names, concepts. Weight: example-queries 1.0, signal-to-action 0.9, when/if/then 0.7, because 0.5. Return ONLY space-separated lowercase keywords, nothing else.

${fields.slice(0, 2000)}

Keywords:`;
}

function mergeKeywords(existing: string[], extracted: string[]): string[] {
  const result: string[] = [];
  const all = [...existing.map((k) => k.toLowerCase()), ...extracted];
  const seen: string[] = [];
  for (const raw of all) {
    const k = raw.trim();
    if (!k || k.length < 2) continue;
    // Levenshtein ≤ 2 중복 filter
    let dup = false;
    for (const s of seen) {
      if (levenshtein(k, s) <= 2) { dup = true; break; }
    }
    if (!dup) { seen.push(k); result.push(k); }
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitI = args.indexOf("--limit");
  const limit = limitI !== -1 ? Number(args[limitI + 1]) : Infinity;
  const onlyI = args.indexOf("--only");
  const only = onlyI !== -1 ? args[onlyI + 1] : "";

  const token = loadOAuthToken();
  if (!token) {
    console.error("[enrich] No OAuth token. Abort.");
    process.exit(1);
  }

  const files = fs
    .readdirSync(DECISIONS_DIR)
    .filter((f) => f.startsWith("DA-") && f.endsWith(".yaml"))
    .filter((f) => !only || f.includes(only));

  console.log(`[enrich] target=${files.length} DAs (dryRun=${dryRun}, limit=${limit === Infinity ? "all" : limit})`);

  let processed = 0, ok = 0, skip = 0, fail = 0;
  const t0 = Date.now();

  for (const f of files) {
    if (processed >= limit) break;
    processed++;
    const fpath = path.join(DECISIONS_DIR, f);
    try {
      const raw = fs.readFileSync(fpath, "utf8");
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/);
      if (!m) { skip++; continue; }
      const fm = yaml.load(m[1]) as DAYaml;
      if (!fm || !fm.id) { skip++; continue; }

      const manual = Array.isArray(fm.trigger?.keywords) ? fm.trigger!.keywords : [];
      const prompt = buildPrompt(fm);
      const haikuOut = callHaiku(token, prompt);
      if (!haikuOut) { fail++; console.error(`  ${processed}. FAIL ${fm.id}`); continue; }

      const extracted = haikuOut.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 25);
      const merged = mergeKeywords(manual, extracted);
      const autoKw = merged.filter((k) => !manual.some((mk) => mk.toLowerCase() === k));

      fm["auto-keywords"] = autoKw.slice(0, 20);

      if (!dryRun) {
        const newFm = yaml.dump(fm, { lineWidth: -1, noRefs: true });
        const newRaw = `---\n${newFm}---${m[2]}`;
        fs.writeFileSync(fpath, newRaw, "utf8");
      }

      ok++;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      if (processed % 20 === 0 || processed === files.length) {
        console.log(`  ${processed}/${files.length} OK=${ok} FAIL=${fail} SKIP=${skip} elapsed=${elapsed}s`);
      }
    } catch (e: any) {
      fail++;
      console.error(`  ${processed}. ERROR ${f}: ${e?.message || e}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n[enrich] done — ${ok} enriched, ${fail} failed, ${skip} skipped, ${elapsed}s total`);
}

main().catch((e) => { console.error(e); process.exit(1); });
