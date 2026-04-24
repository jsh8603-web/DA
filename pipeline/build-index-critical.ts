// ~/.claude/scripts/da-vector/build-index-critical.ts
// L10.6 — INDEX-critical.md 자동 재생성 (rebuild.ts post-hook)
//
// 입력: decisions/DA-*.yaml 전체
// 필터: priority:critical AND NOT trigger-based (WF/search/remote/self-wake/SC)
// 분류: modality → must-block(must-not) / must-do(must) / consent-required(-consent)
// 출력: decisions/INDEX-critical.md (da-loader.js SessionStart inject 대상)

import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";

const HOME = process.env.HOME ?? "C:/Users/jsh86";
const DECISIONS_DIR = path.join(HOME, ".claude", "decisions");
const OUT = path.join(DECISIONS_DIR, "INDEX-critical.md");

// Trigger-based = T2 활성화 대상, T1 inject 제외
const TRIGGER_BASED_PREFIXES = [
  "enhanced-coding-wf-",
  "enhanced-planning-wf-",
  "harness-wf-",
  "lightweight-wf-",
  "search-engine-",
  "remote-session-",
  "self-wake-",
  "SC-",
];

const DOMAIN_PREFIXES: Array<{ prefix: string; domain: string }> = [
  { prefix: "file-standards-", domain: "FS/system" },
  { prefix: "reliability-", domain: "Reliability" },
  { prefix: "model-switch-", domain: "Routing" },
  { prefix: "haiku-delegation-", domain: "Routing" },
  { prefix: "psmux-", domain: "psmux" },
  { prefix: "guard-forced-", domain: "Global" },
  { prefix: "resource-consume-", domain: "Global" },
  { prefix: "global-rule-", domain: "Global" },
];

const DOMAIN_KEYWORDS: Record<string, string> = {
  "FS/system": "frontmatter, YAML 헤더, 인덱스, 규칙 위반",
  "Reliability": "pwd, cwd, home dir, registry, `.session-registry`",
  "Routing": "`/model`, 모델 전환, haiku 위임",
  "psmux": "`send-keys`, `-p` 플래그, `kill-session`",
  "Global": "Guard 차단, 자원 소모, 전역 규칙 편집",
};

type Category = "must-block" | "must-do" | "consent-required";

interface DA {
  id: string;
  slug: string;
  domain: string;
  category: Category;
  signal: string;
}

function extractSignalToAction(raw: string): string {
  const re = /^## Signal-to-Action\s*\r?\n+([\s\S]*?)(?=^## |$)/m;
  const m = raw.match(re);
  if (!m) return "";
  // first paragraph only (줄단위 공백 앞까지)
  return m[1].trim().split(/\r?\n\r?\n/)[0].trim();
}

function classify(modality: string | undefined, slug: string): Category {
  if (modality === "must-not") return "must-block";
  if (slug.endsWith("-consent")) return "consent-required";
  if (modality === "must") return "must-do";
  return "must-do";
}

function getDomain(slug: string): string {
  for (const { prefix, domain } of DOMAIN_PREFIXES) {
    if (slug.startsWith(prefix)) return domain;
  }
  return "Other";
}

function isTriggerBased(slug: string): boolean {
  return TRIGGER_BASED_PREFIXES.some((p) => slug.startsWith(p));
}

export async function buildIndexCritical(): Promise<{ count: number; path: string }> {
  const entries = await fs.readdir(DECISIONS_DIR);
  const yamls = entries.filter((f) => f.startsWith("DA-") && f.endsWith(".yaml"));
  const das: DA[] = [];

  for (const fname of yamls) {
    const fullPath = path.join(DECISIONS_DIR, fname);
    const raw = await fs.readFile(fullPath, "utf-8");
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;
    let fm: Record<string, unknown> | undefined;
    try {
      fm = yaml.load(fmMatch[1]) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!fm || typeof fm !== "object") continue;

    if ((fm.priority as string) !== "critical") continue;

    const status = (fm.status as string) ?? "active";
    if (status !== "active" && status !== "dormant") continue;

    const id = fm.id as string;
    if (!id) continue;
    const slug = id.replace(/^DA-\d{8}-/, "");

    if (isTriggerBased(slug)) continue;

    const signal = extractSignalToAction(raw);
    if (!signal) continue;

    const modality = fm.modality as string | undefined;
    das.push({
      id,
      slug,
      domain: getDomain(slug),
      category: classify(modality, slug),
      signal,
    });
  }

  const catOrder: Record<Category, number> = {
    "must-block": 0,
    "must-do": 1,
    "consent-required": 2,
  };
  das.sort((a, b) => {
    if (catOrder[a.category] !== catOrder[b.category])
      return catOrder[a.category] - catOrder[b.category];
    return a.slug.localeCompare(b.slug);
  });

  const byDomain: Record<string, DA[]> = {};
  for (const d of das) {
    byDomain[d.domain] = byDomain[d.domain] || [];
    byDomain[d.domain].push(d);
  }
  const domainOrder = ["FS/system", "Reliability", "Routing", "psmux", "Global"];
  const topology = domainOrder
    .filter((d) => byDomain[d])
    .map((d) => `| **${d}** | ${byDomain[d].length} | ${DOMAIN_KEYWORDS[d] ?? ""} |`)
    .join("\n");

  const byCat: Record<Category, DA[]> = {
    "must-block": [],
    "must-do": [],
    "consent-required": [],
  };
  for (const d of das) byCat[d.category].push(d);

  const renderSection = (cat: Category, icon: string, label: string): string => {
    const list = byCat[cat];
    if (list.length === 0) return "";
    const header = `## ${icon} ${cat} (${list.length}) — ${label}\n\n`;
    const body = list.map((d) => `### ${d.slug}\n${d.signal}\n`).join("\n");
    return header + body;
  };

  const today = new Date().toISOString().slice(0, 10);

  const content = `---
name: INDEX-critical — T1 Always-On ${das.length} DAs
description: SessionStart inject 용 critical+invariant DA 요약. plan-da-lifecycle Tier 1 L10 산출물. rebuild post-hook 자동 갱신.
type: reference
tags:
  - type/index
  - domain/da-system
  - tier/1
  - load/always-on
date: ${today}
generator: rebuild.ts post-hook (build-index-critical.ts)
token-budget: "3-5k (상한 7k)"
consumer: "~/.claude/scripts/da-vector/hooks/da-loader.js SessionStart"
---

# INDEX-critical.md — T1 Always-On Decision Assets

> **Injected by**: \`~/.claude/scripts/da-vector/hooks/da-loader.js\` (SessionStart).
> **수동 편집 금지** — \`rebuild.ts\` post-hook 이 자동 재생성.
> **내용**: priority:critical + invariant ${das.length} DA 의 Signal-to-Action 요약. 전체 body 는 각 \`decisions/DA-20260422-*.yaml\` 참조.

## 📍 지형도 (도메인별 분포)

| 영역 | DA 수 | 대표 키워드 |
|------|:---:|---|
${topology}

**제외 (T2 trigger-based)**: WF entry-gate + search-engine + remote + self-wake + SC 계열 — 각 키워드 매칭 시 T2 에서 활성화됨.

${renderSection("must-block", "🔴", "금지/차단")}
${renderSection("must-do", "🟢", "강제 수행")}
${renderSection("consent-required", "🟡", "사전 동의")}
---

## 생성 메타

- **총 DA**: ${das.length}
- **필터**: \`priority: critical\` AND invariant (제외 prefix: ${TRIGGER_BASED_PREFIXES.map((p) => `\`${p}\``).join(", ")})
- **생성**: rebuild.ts post-hook (build-index-critical.ts) 자동
- **갱신 시각**: ${today}
- **예산**: 3-5k tokens 목표, 상한 7k (Lost in the Middle 회피)
`;

  await fs.writeFile(OUT, content, "utf-8");
  return { count: das.length, path: OUT };
}

// CLI entry — rebuild.ts 또는 수동 호출
const isCliEntry =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("build-index-critical.ts");

if (isCliEntry) {
  buildIndexCritical()
    .then((r) => {
      console.log(`[build-index-critical] Wrote ${r.path} — ${r.count} DAs`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
