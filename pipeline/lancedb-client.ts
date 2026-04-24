// ~/.claude/scripts/da-vector/lancedb-client.ts

import * as lancedb from "@lancedb/lancedb";
import type { Connection, Table } from "@lancedb/lancedb";

// ── 설정 ────────────────────────────────────────────────────────────────────
const HOME = process.env.HOME ?? "C:/Users/jsh86";
const DB_URI = `${HOME}/.claude/decisions/.lancedb`;
const TABLE = "da_v1";
const EMBED_URL = "http://127.0.0.1:8787/embed";

// ── 타입 ────────────────────────────────────────────────────────────────────
export interface DARow {
  id: string;
  vector: number[];
  payload: string;   // JSON.stringify(DA)
  status: string;
  version: number;
  kind: string;
  priority: string;
  last_hit: string;
}

// ── 헬퍼: BGE 임베딩 ────────────────────────────────────────────────────────
// embed_service.py 계약: POST { texts: string[] } → { vectors: number[][] }
export async function fetchBgeEmbedding(text: string): Promise<number[]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: [text] }),
  });
  if (!res.ok) {
    throw new Error(
      `embed service error: HTTP ${res.status}. Start with: python embed_service.py`
    );
  }
  const json = (await res.json()) as { vectors: number[][] };
  return json.vectors[0];
}

// ── LanceDB 연결 ─────────────────────────────────────────────────────────────
export async function connect(): Promise<Connection> {
  return lancedb.connect(DB_URI);
}

// ── 테이블 열기 (없으면 throw) ───────────────────────────────────────────────
export async function openTable(): Promise<Table> {
  const db = await connect();
  return db.openTable(TABLE);
}

// ── DA 삽입 (upsert: id 중복 시 delete 후 add) ───────────────────────────────
export async function ingestDA(da: Record<string, unknown>, vector: number[]): Promise<void> {
  const row: DARow = {
    id: da.id as string,
    vector,
    payload: JSON.stringify(da),
    status: (da.status as string) ?? "active",
    version: (da.version as number) ?? 1,
    kind: (da.kind as string) ?? "heuristic",
    priority: (da.priority as string) ?? "medium",
    last_hit: (da["last-hit"] as string) ?? new Date().toISOString(),
  };

  const db = await connect();
  let table: Table;

  try {
    table = await db.openTable(TABLE);
    // id 형식 검증 (SQL injection 방어: DA-YYYYMMDD-slug 패턴만 허용)
    if (!/^DA-\d{8}-[a-zA-Z0-9-]+$/.test(row.id)) {
      throw new Error(`Invalid DA id format (expected DA-YYYYMMDD-slug): ${row.id}`);
    }
    // 기존 id 삭제 후 재추가 (upsert)
    await table.delete(`id = '${row.id}'`);
    await table.add([row]);
  } catch (err: unknown) {
    // 테이블이 없으면 새로 생성
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("does not exist") || msg.includes("No such")) {
      table = await db.createTable(TABLE, [row]);
    } else {
      throw err;
    }
  }
}

// ── upsertDA: ingestDA 의 alias ──────────────────────────────────────────────
export async function upsertDA(da: Record<string, unknown>, vector: number[]): Promise<void> {
  return ingestDA(da, vector);
}

// ── 벡터 검색 ────────────────────────────────────────────────────────────────
export async function searchDA(
  queryVec: number[],
  k: number = 5,
  filter: string = "status = 'active'"
): Promise<DARow[]> {
  const table = await openTable();
  let q = table.search(queryVec).limit(k);
  if (filter) {
    q = q.where(filter);
  }
  return (await q.toArray()) as DARow[];
}
