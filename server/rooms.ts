import type { Database } from 'better-sqlite3';
import type { WebSocket } from 'ws';
import crypto from 'crypto';
import { appendLog } from './vault.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  mode: 'own_model' | 'panel' | 'mention' | 'debate';
  password: string | null;
  debateTopicPro: string | null;
  debateTopicCon: string | null;
  createdAt: string;
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  username: string;
  color: string;
  model: string;
  isActive: number;
  joinedAt: string;
  lastSeenAt: string | null;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  authorType: 'human' | 'ai';
  model: string | null;
  content: string;
  replyToId: string | null;
  createdAt: string;
}

export interface DispatchConfig {
  ollamaEndpoint: string;
  db: Database;
}

// ─── Connection registry ─────────────────────────────────────────────────────

// roomId → Map<participantId, WebSocket>
const roomConnections = new Map<string, Map<string, WebSocket>>();

const PARTICIPANT_COLORS = [
  '#e63946', '#2a9d8f', '#f4a261', '#457b9d',
  '#e9c46a', '#6a4c93', '#f77f00', '#a8dadc',
];

export function pickColor(index: number): string {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}

export function registerConnection(roomId: string, participantId: string, ws: WebSocket): void {
  if (!roomConnections.has(roomId)) roomConnections.set(roomId, new Map());
  roomConnections.get(roomId)!.set(participantId, ws);
}

export function removeConnection(roomId: string, participantId: string): void {
  const room = roomConnections.get(roomId);
  if (!room) return;
  room.delete(participantId);
  if (room.size === 0) roomConnections.delete(roomId);
}

export function getOnlineIds(roomId: string): string[] {
  return Array.from(roomConnections.get(roomId)?.keys() ?? []);
}

export function broadcast(roomId: string, data: object, excludeId?: string): void {
  const conns = roomConnections.get(roomId);
  if (!conns) return;
  const json = JSON.stringify(data);
  for (const [id, ws] of conns) {
    if (id !== excludeId && ws.readyState === 1 /* OPEN */) {
      try { ws.send(json); } catch { /* ignore */ }
    }
  }
}

export function sendTo(roomId: string, participantId: string, data: object): void {
  const ws = roomConnections.get(roomId)?.get(participantId);
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(data)); } catch { /* ignore */ }
  }
}

// ─── AI dispatch ─────────────────────────────────────────────────────────────

export async function dispatchAI(
  room: Room,
  humanMessage: RoomMessage,
  participants: RoomParticipant[],
  config: DispatchConfig,
): Promise<void> {
  if (humanMessage.authorType !== 'human') return;
  const active = participants.filter(p => p.isActive);

  if (room.mode === 'own_model') {
    const author = active.find(p => p.id === humanMessage.authorId);
    if (author) await _streamAI(room, author.model, humanMessage, config);

  } else if (room.mode === 'panel') {
    const models = [...new Set(active.map(p => p.model))];
    // Sequential to avoid spamming — each model gets a turn
    for (const model of models) {
      await _streamAI(room, model, humanMessage, config);
    }

  } else if (room.mode === 'mention') {
    // @modelAlias rest of message
    const m = humanMessage.content.match(/^@(\S+)\s+([\s\S]+)/s);
    if (!m) return; // no mention = no AI response
    const [, alias, body] = m;
    const matched = active.find(p =>
      p.model.toLowerCase().includes(alias.toLowerCase())
    );
    if (!matched) {
      broadcast(room.id, {
        type: 'system',
        content: `Model "@${alias}" nie jest w pokoju. Dostępne: ${active.map(p => p.model).join(', ')}`,
      });
      return;
    }
    await _streamAI(room, matched.model, { ...humanMessage, content: body }, config);

  } else if (room.mode === 'debate') {
    const models = [...new Set(active.map(p => p.model))];
    const proModel = models[0];
    const conModel = models[1] ?? models[0];
    const pro = room.debateTopicPro ?? 'Przedstaw argumenty ZA następującą tezą';
    const con = room.debateTopicCon ?? 'Przedstaw argumenty PRZECIW następującej tezie';
    await _streamAI(room, proModel, { ...humanMessage, content: `${pro}: "${humanMessage.content}"` }, config);
    await _streamAI(room, conModel, { ...humanMessage, content: `${con}: "${humanMessage.content}"` }, config);
  }
}

async function _streamAI(
  room: Room,
  model: string,
  trigger: RoomMessage,
  { ollamaEndpoint, db }: DispatchConfig,
): Promise<void> {
  broadcast(room.id, { type: 'ai_start', model });

  // Build context from last 20 room messages
  const history = (db.prepare(
    `SELECT * FROM room_messages WHERE roomId = ? ORDER BY createdAt DESC LIMIT 20`
  ).all(room.id) as RoomMessage[]).reverse();

  const ollamaMessages = history.map(m => ({
    role: m.authorType === 'human' ? 'user' : 'assistant',
    content: m.authorType === 'ai'
      ? `[${m.model}]: ${m.content}`
      : `[${m.authorName}]: ${m.content}`,
  }));
  // Append trigger if not already in history
  if (!history.find(h => h.id === trigger.id)) {
    ollamaMessages.push({ role: 'user', content: `[${trigger.authorName}]: ${trigger.content}` });
  }

  let fullContent = '';

  try {
    const res = await fetch(`${ollamaEndpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: ollamaMessages, stream: true }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok || !res.body) throw new Error(`Ollama ${res.status}: ${await res.text()}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const token: string = json.message?.content ?? '';
          if (token) {
            fullContent += token;
            broadcast(room.id, { type: 'ai_token', model, token });
          }
        } catch { /* partial JSON */ }
      }
    }
  } catch (e: any) {
    fullContent = `[Błąd modelu: ${e.message}]`;
    broadcast(room.id, { type: 'ai_token', model, token: fullContent });
  }

  // Persist AI message
  const msgId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO room_messages (id, roomId, authorId, authorName, authorType, model, content, replyToId, createdAt)
    VALUES (?, ?, ?, ?, 'ai', ?, ?, NULL, ?)
  `).run(msgId, room.id, `ai:${model}`, model, model, fullContent, now);

  broadcast(room.id, {
    type: 'ai_done',
    model,
    message: {
      id: msgId, roomId: room.id,
      authorId: `ai:${model}`, authorName: model,
      authorType: 'ai', model, content: fullContent,
      replyToId: null, createdAt: now,
    },
  });

  appendLog('rooms', `[${room.name}/${model}] ${fullContent.length} chars`).catch(() => {});
}
