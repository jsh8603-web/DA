// ~/.claude/scripts/da-vector/mcp_server.ts — DA Vector Store MCP Server

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as yaml from "js-yaml";
import { z } from "zod";
import {
  fetchBgeEmbedding,
  ingestDA,
  openTable,
  searchDA,
  type DARow,
} from "./lancedb-client.js";

// ── MCP 서버 초기화 ──────────────────────────────────────────────────────────
const server = new McpServer(
  { name: "da-vector-store", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool 1: search_da ────────────────────────────────────────────────────────
// filter 파라미터는 SQL injection 위험으로 제거 — "status = 'active'" 고정
server.tool(
  "search_da",
  "Perform semantic vector search over DA rules using a natural-language query.",
  {
    query: z.string().describe("Natural-language search query"),
    k: z.number().optional().describe("Number of results to return (default 5)"),
  },
  async (args) => {
    const { query, k = 5 } = args;
    const FIXED_FILTER = "status = 'active'";

    let vec: number[];
    try {
      vec = await fetchBgeEmbedding(query);
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "embed service not running at :8787" }),
          },
        ],
      };
    }

    const rows = await searchDA(vec, k, FIXED_FILTER);
    const results = rows.map((row: DARow & { _distance?: number }) => {
      let da: Record<string, unknown> = {};
      try {
        da = JSON.parse(row.payload);
      } catch {
        // payload 파싱 실패 시 기본값
      }
      return {
        id: row.id,
        kind: row.kind,
        priority: row.priority,
        signal_to_action: (da.then as string) ?? "",
        score: row._distance != null ? 1 - row._distance : null,
      };
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ results }),
        },
      ],
    };
  }
);

// ── Tool 2: list_da_by_trigger ───────────────────────────────────────────────
server.tool(
  "list_da_by_trigger",
  "List DA rules filtered by kind and/or priority.",
  {
    kind: z
      .string()
      .optional()
      .describe("DA kind: guard | heuristic | constraint | pattern"),
    priority: z
      .string()
      .optional()
      .describe("DA priority: critical | high | medium"),
  },
  async (args) => {
    const { kind, priority } = args;

    let table;
    try {
      table = await openTable();
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ das: [], error: "table not found — run rebuild first" }),
          },
        ],
      };
    }

    // allowlist 검증 (SQL injection 방어)
    const VALID_KINDS = new Set(["guard", "heuristic", "constraint", "pattern"]);
    const VALID_PRIORITIES = new Set(["critical", "high", "medium"]);

    if (kind && !VALID_KINDS.has(kind)) {
      return {
        content: [{ type: "text", text: JSON.stringify({ das: [], error: `Invalid kind: ${kind}. Valid: guard|heuristic|constraint|pattern` }) }],
      };
    }
    if (priority && !VALID_PRIORITIES.has(priority)) {
      return {
        content: [{ type: "text", text: JSON.stringify({ das: [], error: `Invalid priority: ${priority}. Valid: critical|high|medium` }) }],
      };
    }

    // where 절 조합 (allowlist 통과한 값만 사용)
    const clauses: string[] = [];
    if (kind) clauses.push(`kind = '${kind}'`);
    if (priority) clauses.push(`priority = '${priority}'`);

    let query = table.query();
    if (clauses.length > 0) {
      query = query.where(clauses.join(" AND "));
    }

    const rows = (await query.toArray()) as DARow[];
    const das = rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      priority: row.priority,
      status: row.status,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ das }),
        },
      ],
    };
  }
);

// ── Tool 3: audit_ingest ─────────────────────────────────────────────────────
server.tool(
  "audit_ingest",
  "Ingest a DA rule from YAML text into the vector store.",
  {
    da_yaml: z.string().describe("Full DA rule in YAML format"),
  },
  async (args) => {
    const { da_yaml } = args;

    let da: Record<string, unknown>;
    try {
      da = yaml.load(da_yaml) as Record<string, unknown>;
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: false, error: `YAML parse error: ${err}` }),
          },
        ],
      };
    }

    if (!da || !da.id) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: false, error: "Missing 'id' field in DA YAML" }),
          },
        ],
      };
    }

    let vec: number[];
    try {
      const embedText = [da.id ?? "", da.when ?? "", da.then ?? ""]
        .filter(Boolean)
        .join(" ");
      vec = await fetchBgeEmbedding(String(embedText));
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: false, error: "embed service not running at :8787" }),
          },
        ],
      };
    }

    await ingestDA(da, vec);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, id: da.id }),
        },
      ],
    };
  }
);

// ── Tool 4: stats ────────────────────────────────────────────────────────────
server.tool(
  "stats",
  "Return statistics about the DA vector store (total count, by kind, by status).",
  {},
  async () => {
    let table;
    try {
      table = await openTable();
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: 0, by_kind: {}, by_status: {}, error: "table not found" }),
          },
        ],
      };
    }

    const total = await table.countRows();
    const rows = (await table.query().toArray()) as DARow[];

    const by_kind: Record<string, number> = {};
    const by_status: Record<string, number> = {};

    for (const row of rows) {
      by_kind[row.kind] = (by_kind[row.kind] ?? 0) + 1;
      by_status[row.status] = (by_status[row.status] ?? 0) + 1;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ total, by_kind, by_status }),
        },
      ],
    };
  }
);

// ── 서버 시작 (stdio transport) ──────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr 로 로그 (stdout 은 MCP 프로토콜 전용)
  process.stderr.write("DA Vector Store MCP Server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
