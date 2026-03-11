import Database from 'better-sqlite3';
import path from 'path';
import { getVaultDir } from './vault.js';

let db: Database.Database;

export interface SessionRow {
  id: string;
  title: string;
  messages: string; // JSON string
  createdAt: string;
  updatedAt: string;
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(getVaultDir(), 'charbot.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        messages TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  }
  return db;
}

export function upsertSession(session: SessionRow): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO sessions (id, title, messages, createdAt, updatedAt)
    VALUES (@id, @title, @messages, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      messages = excluded.messages,
      updatedAt = excluded.updatedAt
  `).run(session);
}

export function getAllSessions(): SessionRow[] {
  // P0-3: cap at 50 most recent sessions everywhere (UI, API, mobile, Telegram)
  return getDb().prepare(`SELECT * FROM sessions ORDER BY updatedAt DESC LIMIT 50`).all() as SessionRow[];
}

export function getSessionById(id: string): SessionRow | undefined {
  return getDb().prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRow | undefined;
}

export function searchSessions(query: string): SessionRow[] {
  const like = `%${query}%`;
  return getDb().prepare(`
    SELECT * FROM sessions WHERE title LIKE ? OR messages LIKE ? ORDER BY updatedAt DESC LIMIT 20
  `).all(like, like) as SessionRow[];
}
