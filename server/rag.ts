import { getDb } from './db.js';

const OLLAMA_URL = 'http://127.0.0.1:11434';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
export function initRagSchema(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS rag_embeddings (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rag_session ON rag_embeddings(sessionId);
  `);
}

// ---------------------------------------------------------------------------
// Embed text via Ollama
// ---------------------------------------------------------------------------
export async function embedText(text: string, model: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Ollama embeddings error: ${await res.text()}`);
  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Store chunks (upsert by id)
// ---------------------------------------------------------------------------
export interface RagChunk {
  id: string;
  sessionId: string;
  content: string;
  embedding: number[];
}

export function storeChunks(chunks: RagChunk[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO rag_embeddings (id, sessionId, content, embedding, createdAt)
    VALUES (@id, @sessionId, @content, @embedding, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      embedding = excluded.embedding,
      createdAt = excluded.createdAt
  `);
  const now = new Date().toISOString();
  const insert = db.transaction((items: RagChunk[]) => {
    for (const c of items) {
      stmt.run({ id: c.id, sessionId: c.sessionId, content: c.content, embedding: JSON.stringify(c.embedding), createdAt: now });
    }
  });
  insert(chunks);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export interface RagResult {
  id: string;
  sessionId: string;
  content: string;
  similarity: number;
}

export function searchEmbeddings(queryEmbedding: number[], topK: number, sessionId?: string): RagResult[] {
  const db = getDb();
  const rows = sessionId
    ? db.prepare(`SELECT id, sessionId, content, embedding FROM rag_embeddings WHERE sessionId = ?`).all(sessionId) as any[]
    : db.prepare(`SELECT id, sessionId, content, embedding FROM rag_embeddings`).all() as any[];

  const scored = rows.map(row => ({
    id: row.id as string,
    sessionId: row.sessionId as string,
    content: row.content as string,
    similarity: cosineSim(queryEmbedding, JSON.parse(row.embedding as string)),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
export function getRagStats(): { totalChunks: number; sessions: number } {
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) as n FROM rag_embeddings`).get() as any).n as number;
  const sessions = (db.prepare(`SELECT COUNT(DISTINCT sessionId) as n FROM rag_embeddings`).get() as any).n as number;
  return { totalChunks: total, sessions };
}

// ---------------------------------------------------------------------------
// List chunks grouped by sessionId
// ---------------------------------------------------------------------------
export interface RagListEntry {
  sessionId: string;
  count: number;
}

export function listRagSessions(): RagListEntry[] {
  const db = getDb();
  return db.prepare(
    `SELECT sessionId, COUNT(*) as count FROM rag_embeddings GROUP BY sessionId ORDER BY sessionId`
  ).all() as RagListEntry[];
}

// ---------------------------------------------------------------------------
// Clear index (per-session or all)
// ---------------------------------------------------------------------------
export function clearRagIndex(sessionId?: string): number {
  const db = getDb();
  if (sessionId) {
    const info = db.prepare(`DELETE FROM rag_embeddings WHERE sessionId = ?`).run(sessionId);
    return info.changes;
  }
  const info = db.prepare(`DELETE FROM rag_embeddings`).run();
  return info.changes;
}
