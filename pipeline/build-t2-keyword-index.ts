// ~/.claude/scripts/da-vector/build-t2-keyword-index.ts
// L11.2 — T2 keyword 역인덱스 pre-build (rebuild.ts post-hook)
//
// 입력: decisions/DA-*.yaml 전체 (active/dormant)
// 출력: decisions/.t2-keyword-index.json
//   { keywords: { kw(lower) → DA id[] }, toolNames: { tn(lower) → DA id[] }, total, ... }
// 용도: da-context.js (L11.3) 가 linear scan 대신 O(K) lookup

import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";

const HOME = process.env.HOME ?? "C:/Users/jsh86";
const DECISIONS_DIR = path.join(HOME, ".claude", "decisions");
const OUT = path.join(DECISIONS_DIR, ".t2-keyword-index.json");

interface T2Index {
  version: string;
  generated: string;
  total: number;
  keywords: Record<string, string[]>;
  toolNames: Record<string, string[]>;
}

export async function buildT2KeywordIndex(): Promise<{
  total: number;
  kwCount: number;
  toolCount: number;
  path: string;
}> {
  const entries = await fs.readdir(DECISIONS_DIR);
  const yamls = entries.filter((f) => f.startsWith("DA-") && f.endsWith(".yaml"));

  const idx: T2Index = {
    version: "1",
    generated: new Date().toISOString(),
    total: 0,
    keywords: {},
    toolNames: {},
  };

  for (const fname of yamls) {
    const raw = await fs.readFile(path.join(DECISIONS_DIR, fname), "utf-8");
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;
    let fm: Record<string, unknown> | undefined;
    try {
      fm = yaml.load(fmMatch[1]) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!fm || typeof fm !== "object" || !fm.id) continue;

    const status = (fm.status as string) ?? "active";
    if (status !== "active" && status !== "dormant") continue;

    const id = fm.id as string;
    const trigger = (fm.trigger ?? {}) as Record<string, unknown>;
    const keywords = Array.isArray(trigger.keywords) ? (trigger.keywords as unknown[]) : [];
    const toolNames = Array.isArray(trigger["tool-names"])
      ? (trigger["tool-names"] as unknown[])
      : [];

    // L12.2 롤백: auto-keywords 는 index 제외 (noise 폭발 — 별도 weighted index 설계 필요).
    // manual trigger.keywords 만 인덱싱.
    for (const kw of keywords) {
      const key = String(kw).toLowerCase().trim();
      if (!key) continue;
      (idx.keywords[key] ||= []).push(id);
    }
    for (const tn of toolNames) {
      const key = String(tn).toLowerCase().trim();
      if (!key) continue;
      (idx.toolNames[key] ||= []).push(id);
    }
    idx.total++;
  }

  // de-dup (같은 DA 가 같은 keyword 중복 등록되는 경우 대비)
  for (const key of Object.keys(idx.keywords)) {
    idx.keywords[key] = Array.from(new Set(idx.keywords[key]));
  }
  for (const key of Object.keys(idx.toolNames)) {
    idx.toolNames[key] = Array.from(new Set(idx.toolNames[key]));
  }

  await fs.writeFile(OUT, JSON.stringify(idx, null, 2), "utf-8");
  return {
    total: idx.total,
    kwCount: Object.keys(idx.keywords).length,
    toolCount: Object.keys(idx.toolNames).length,
    path: OUT,
  };
}

const isCliEntry =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("build-t2-keyword-index.ts");

if (isCliEntry) {
  buildT2KeywordIndex()
    .then((r) => {
      console.log(
        `[build-t2-keyword-index] ${r.path} — ${r.total} DAs, ${r.kwCount} unique keywords, ${r.toolCount} unique tool-names`
      );
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
