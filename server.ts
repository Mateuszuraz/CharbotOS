import express from 'express';
// vite is only imported dynamically in dev mode (not needed in packaged builds)
import { exec } from 'child_process';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import crypto from 'crypto';
import os from 'os';
import rateLimit from 'express-rate-limit';
import { createServer as createHttpServer, request as httpRequest } from 'http';
import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

export const buddyEmitter = new EventEmitter();
buddyEmitter.setMaxListeners(20);

import { ensureVaultDirs, getVaultDir, getMobileDir, appendLog } from './server/vault.js';
import { getDb, upsertSession, getAllSessions } from './server/db.js';
import { generateMobilePortal } from './server/mobile.js';
import { startTelegramBot, sendTelegramNotification, getTelegramStatus, getTelegramConfig, sendTelegramSession, configureTelegramBot, loadTelegramConfig } from './server/telegram.js';
import { startDiscordBot, sendDiscordNotification } from './server/discord.js';
import { initRagSchema, embedText, storeChunks, searchEmbeddings, getRagStats, listRagSessions, clearRagIndex } from './server/rag.js';
import { initScheduler, refreshTask, removeTask, runTaskNow, type ScheduledTask } from './server/scheduler.js';
import { loadPlugins, getLoadedPlugins, reloadPlugins, execPlugin, saveWebhookTool, deleteWebhookTool } from './server/pluginLoader.js';
import { saveDocument, listDocuments, deleteDocument, getDocPath } from './server/documents.js';
import { listDir, searchFiles, readFile, writeFile, appendCsv, DEFAULT_ALLOWED_DIRS } from './server/osAgent.js';
import { loadAiKeys, saveAiKeys, getMaskedKeys } from './server/aiKeys.js';
import {
  type Room, type RoomParticipant, type RoomMessage,
  broadcast, sendTo, registerConnection, removeConnection, getOnlineIds,
  pickColor, dispatchAI,
} from './server/rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read version from package.json
// Dev: import.meta.url = server.ts in root → './package.json' resolves to root/package.json
// Packaged: import.meta.url = dist-server/server.mjs → '../package.json' resolves to app/package.json
const _require = createRequire(import.meta.url);
let APP_VERSION = '2.0.0';
try {
  APP_VERSION = (_require('./package.json') as any).version ?? '2.0.0';
} catch {
  try { APP_VERSION = (_require('../package.json') as any).version ?? '2.0.0'; } catch {}
}

const GITHUB_RELEASES_URL = process.env.UPDATE_CHECK_URL
  ?? 'https://api.github.com/repos/Mateuszuraz/CharbotOS/releases/latest';

// P0-11: APP_SECRET — local auth token (generated once, stored in Vault)
let APP_SECRET = '';

async function getOrCreateAppSecret(): Promise<string> {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  const secretPath = path.join(getVaultDir(), 'app-secret.txt');
  try {
    const existing = (await fs.readFile(secretPath, 'utf-8')).trim();
    if (existing) return existing;
  } catch { /* doesn't exist yet */ }
  const secret = crypto.randomBytes(32).toString('hex');
  await fs.writeFile(secretPath, secret, 'utf-8');
  return secret;
}

// Scheduler config factory — reads live settings each run
function getSchedulerConfig() {
  return {
    sendTelegram: (text: string) => sendTelegramNotification(text),
    generatePortal: (sessionId: string) => {
      const session = getAllSessions().find(s => s.id === sessionId);
      if (!session) return Promise.resolve(sessionId);
      return generateMobilePortal(session as any).then(() => sessionId);
    },
    ollamaEndpoint: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
  };
}

async function startServer() {
  // --- Init vault dirs & DB ---
  await ensureVaultDirs();
  APP_SECRET = await getOrCreateAppSecret();
  const db = getDb(); // initialise DB schema
  initRagSchema(); // initialise RAG embeddings table

  // --- Sprint 5A: scheduled_tasks table ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      cronExpr TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      lastRunAt TEXT,
      lastResult TEXT,
      createdAt TEXT NOT NULL
    )
  `);

  // --- Sprint 6: Multiroom tables ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'own_model',
      password TEXT,
      debateTopicPro TEXT,
      debateTopicCon TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS room_participants (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      username TEXT NOT NULL,
      color TEXT NOT NULL,
      model TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      joinedAt TEXT NOT NULL,
      lastSeenAt TEXT
    );
    CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      authorId TEXT NOT NULL,
      authorName TEXT NOT NULL,
      authorType TEXT NOT NULL,
      model TEXT,
      content TEXT NOT NULL,
      replyToId TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  const app = express();
  const PORT = 3000;
  const BIND_HOST = process.env.BIND_HOST ?? '127.0.0.1'; // P0-8

  app.use(express.json({ limit: '50mb' }));

  // P0-6 / P0-10 — Offline middleware: block /api/ai/* when CHARBOT_OFFLINE=true
  app.use('/api/ai', (_req, res, next) => {
    if (process.env.CHARBOT_OFFLINE === 'true') {
      res.status(403).json({ error: 'Offline mode — cloud AI is disabled. Unset CHARBOT_OFFLINE to use cloud providers.' });
      return;
    }
    next();
  });

  // P0-11: /api/init — unprotected; returns APP_SECRET to the local browser
  app.get('/api/init', (_req, res) => {
    // Detect LAN IP so the room invite link works from other devices
    const nets = os.networkInterfaces();
    let lanIp: string | null = null;
    for (const iface of Object.values(nets)) {
      for (const addr of iface ?? []) {
        if (addr.family === 'IPv4' && !addr.internal) { lanIp = addr.address; break; }
      }
      if (lanIp) break;
    }
    res.json({ appSecret: APP_SECRET, lanIp, vaultPath: getVaultDir() });
  });

  // P0-11: APP_SECRET middleware — all /api/* except /init and /config require X-App-Secret
  app.use('/api', (req, res, next) => {
    if (req.path === '/init' || req.path === '/config' || req.path === '/rooms/models' || req.path.startsWith('/ollama')) return next();
    if (APP_SECRET && req.headers['x-app-secret'] !== APP_SECRET) {
      res.status(401).json({ error: 'Unauthorized — missing or invalid X-App-Secret header' });
      return;
    }
    next();
  });

  // P2: Rate limiting
  const aiRateLimit = rateLimit({ windowMs: 60_000, max: 40, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many AI requests — please wait a moment.' } });
  const uploadRateLimit = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many uploads — please slow down.' } });
  app.use('/api/ai/chat', aiRateLimit);
  app.use('/api/ai/vision', aiRateLimit);

  const apiRateLimit = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests — please slow down.' },
    skip: (req) => req.path === '/init' || req.path === '/config',
  });
  app.use('/api', apiRateLimit);

  // P2: MIME allowlist for uploads
  const ALLOWED_UPLOAD_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/csv', 'text/markdown',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.oasis.opendocument.spreadsheet',
  ]);
  const HEIC_MIMES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

  // --- Multer for file uploads ---
  const storage = multer.diskStorage({
    destination: async (req, _file, cb) => {
      const sessionId = ((req.query.sessionId as string) || 'misc').replace(/[^a-zA-Z0-9_-]/g, '');
      const uploadDir = path.join(getVaultDir(), 'uploads', sessionId || 'misc');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      cb(null, safeName);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (HEIC_MIMES.has(file.mimetype)) {
        cb(new Error('HEIC/HEIF format is not supported — please convert to JPEG or PNG first.'));
        return;
      }
      if (!ALLOWED_UPLOAD_MIMES.has(file.mimetype)) {
        cb(new Error(`File type "${file.mimetype}" is not allowed.`));
        return;
      }
      cb(null, true);
    },
  });

  // =============================================================
  // API ROUTES
  // =============================================================

  // =============================================================
  // AI PROXY — P0-5: all cloud AI goes through backend
  // =============================================================

  // GET /api/ai/keys — returns masked saved keys
  app.get('/api/ai/keys', async (_req, res) => {
    try { res.json(await getMaskedKeys()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/ai/keys — save keys to Vault (never stored in browser)
  app.post('/api/ai/keys', async (req, res) => {
    const { openai, google, anthropic } = req.body as Partial<{ openai: string; google: string; anthropic: string }>;
    try {
      await saveAiKeys({ openai: openai ?? '', google: google ?? '', anthropic: anthropic ?? '' });
      res.json({ ok: true, ...(await getMaskedKeys()) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/ai/models?provider=openai|google|anthropic — fetch available models via backend
  app.get('/api/ai/models', async (req, res) => {
    const provider = req.query.provider as string;
    const keys = await loadAiKeys();
    try {
      let models: string[] = [];
      if (provider === 'openai') {
        if (!keys.openai) { res.json({ models: [] }); return; }
        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${keys.openai}` },
          signal: AbortSignal.timeout(10_000),
        });
        const d = await r.json() as { data?: { id: string }[] };
        models = (d.data ?? []).map(m => m.id).filter(id => /^(gpt-|o1|o3|o4)/.test(id)).sort();
      } else if (provider === 'google') {
        if (!keys.google) { res.json({ models: [] }); return; }
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${keys.google}&pageSize=100`,
          { signal: AbortSignal.timeout(10_000) },
        );
        const d = await r.json() as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
        models = (d.models ?? [])
          .filter(m => (m.supportedGenerationMethods ?? []).includes('generateContent'))
          .map(m => m.name.replace('models/', '')).sort();
      } else if (provider === 'anthropic') {
        if (!keys.anthropic) { res.json({ models: [] }); return; }
        const r = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': keys.anthropic, 'anthropic-version': '2023-06-01' },
          signal: AbortSignal.timeout(10_000),
        });
        const d = await r.json() as { data?: { id: string }[] };
        models = (d.data ?? []).map(m => m.id).sort();
      }
      res.json({ models });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  // /api/ollama/* — transparent proxy to local Ollama (fixes Private Network Access when using ngrok/HTTPS)
  app.all('/api/ollama/*', (req, res) => {
    const ollamaPath = req.path.replace('/api/ollama', '') || '/';
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const bodyStr = req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : '';
    const proxy = httpRequest(
      {
        hostname: '127.0.0.1', port: 11434,
        path: ollamaPath + qs, method: req.method,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(bodyStr) },
      },
      (upstream) => {
        res.writeHead(upstream.statusCode ?? 200, { 'content-type': upstream.headers['content-type'] ?? 'application/json' });
        upstream.pipe(res, { end: true });
      }
    );
    proxy.on('error', () => res.status(502).json({ error: 'Ollama not reachable' }));
    proxy.end(bodyStr);
  });

  // POST /api/ai/chat — streaming proxy for cloud providers
  app.post('/api/ai/chat', async (req, res) => {
    const { provider, model, messages, systemPrompt, temperature, topP, maxTokens } = req.body as {
      provider: string;
      model: string;
      messages: Array<{ role: string; content: string; attachments?: any[] }>;
      systemPrompt?: string;
      temperature?: number;
      topP?: number;
      maxTokens?: number;
    };

    if (!provider || !model || !Array.isArray(messages)) {
      res.status(400).json({ error: 'provider, model, and messages are required' });
      return;
    }

    const keys = await loadAiKeys();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendDelta = (text: string) => {
      res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
      buddyEmitter.emit('message_chunk', { text });
    };
    const sendError = (msg: string) => res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    const sendDone = () => {
      res.write('data: [DONE]\n\n');
      res.end();
      buddyEmitter.emit('talking', { value: false });
      buddyEmitter.emit('message_done');
    };
    buddyEmitter.emit('talking', { value: true });

    // Helper to build content array with optional image attachments
    const openAiContent = (msg: { content: string; attachments?: any[] }) => {
      if (!msg.attachments?.length) return msg.content;
      const parts: any[] = [];
      if (msg.content) parts.push({ type: 'text', text: msg.content });
      for (const a of msg.attachments) {
        if (a.mimeType?.startsWith('image/') && a.base64)
          parts.push({ type: 'image_url', image_url: { url: `data:${a.mimeType};base64,${a.base64}` } });
        else if (a.text)
          parts.push({ type: 'text', text: `<file name="${a.name}">\n${a.text}\n</file>` });
      }
      return parts.length ? parts : msg.content;
    };

    try {
      if (provider === 'openai') {
        if (!keys.openai) { sendError('OpenAI API key not configured. Save it in Settings → Model.'); sendDone(); return; }
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.openai}` },
          body: JSON.stringify({
            model,
            stream: true,
            temperature: temperature ?? 0.7,
            top_p: topP ?? 0.9,
            max_tokens: maxTokens ?? 2048,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              ...messages.map(m => ({ role: m.role, content: openAiContent(m) })),
            ],
          }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!r.ok) { sendError(`OpenAI error: ${await r.text()}`); sendDone(); return; }
        const reader = r.body!.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n'); buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
            try {
              const j = JSON.parse(line.slice(6));
              const t = j.choices?.[0]?.delta?.content;
              if (t) sendDelta(t);
            } catch { /* skip */ }
          }
        }

      } else if (provider === 'google') {
        if (!keys.google) { sendError('Google API key not configured. Save it in Settings → Model.'); sendDone(); return; }
        const contents = messages
          .filter(m => m.role !== 'system')
          .map(m => {
            const parts: any[] = [];
            if (m.content) parts.push({ text: m.content });
            for (const a of (m.attachments ?? [])) {
              if (a.mimeType?.startsWith('image/') && a.base64)
                parts.push({ inlineData: { mimeType: a.mimeType, data: a.base64 } });
              else if (a.text)
                parts.push({ text: `<file name="${a.name}">\n${a.text}\n</file>` });
            }
            return { role: m.role === 'assistant' ? 'model' : 'user', parts };
          });
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${keys.google}&alt=sse`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
              generationConfig: { temperature: temperature ?? 0.7, topP: topP ?? 0.9, maxOutputTokens: maxTokens ?? 2048 },
            }),
            signal: AbortSignal.timeout(120_000),
          },
        );
        if (!r.ok) { sendError(`Google error: ${await r.text()}`); sendDone(); return; }
        const reader = r.body!.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n'); buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const j = JSON.parse(line.slice(6));
              const t = j.candidates?.[0]?.content?.parts?.[0]?.text;
              if (t) sendDelta(t);
            } catch { /* skip */ }
          }
        }

      } else if (provider === 'anthropic') {
        if (!keys.anthropic) { sendError('Anthropic API key not configured. Save it in Settings → Model.'); sendDone(); return; }
        const anthropicMsgs = messages.filter(m => m.role !== 'system').map(m => {
          const parts: any[] = [];
          if (m.content) parts.push({ type: 'text', text: m.content });
          for (const a of (m.attachments ?? [])) {
            if (a.mimeType?.startsWith('image/') && a.base64)
              parts.push({ type: 'image', source: { type: 'base64', media_type: a.mimeType, data: a.base64 } });
            else if (a.text)
              parts.push({ type: 'text', text: `<file name="${a.name}">\n${a.text}\n</file>` });
          }
          return { role: m.role, content: parts.length ? parts : m.content };
        });
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': keys.anthropic,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model, stream: true,
            max_tokens: maxTokens ?? 2048,
            temperature: temperature ?? 0.7,
            top_p: topP ?? 0.9,
            ...(systemPrompt ? { system: systemPrompt } : {}),
            messages: anthropicMsgs,
          }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!r.ok) { sendError(`Anthropic error: ${await r.text()}`); sendDone(); return; }
        const reader = r.body!.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n'); buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const j = JSON.parse(line.slice(6));
              if (j.type === 'content_block_delta' && j.delta?.text) sendDelta(j.delta.text);
            } catch { /* skip */ }
          }
        }

      } else {
        sendError(`Unknown provider: ${provider}`);
      }
    } catch (e: any) {
      sendError(e.name === 'TimeoutError' ? 'Request timed out (>2 min)' : e.message);
    }
    sendDone();
  });

  // --- Vault status ---
  // --- App config (offline mode, vault info) ---
  app.get('/api/config', (_req, res) => {
    res.json({
      offline: process.env.CHARBOT_OFFLINE === 'true',
      uncensored: process.env.CHARBOT_UNCENSORED === 'true',
      vaultDir: getVaultDir(),
      mobileDir: getMobileDir(),
      version: APP_VERSION,
    });
  });

  app.get('/api/update/check', async (_req, res) => {
    try {
      const r = await fetch(GITHUB_RELEASES_URL, {
        headers: { 'User-Agent': 'Charbot-OS-Updater' },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: any = await r.json();
      const latest = (data.tag_name ?? '').replace(/^v/, '') || APP_VERSION;
      res.json({ current: APP_VERSION, latest, hasUpdate: latest !== APP_VERSION });
    } catch {
      res.json({ current: APP_VERSION, latest: APP_VERSION, hasUpdate: false });
    }
  });

  app.get('/api/vault/status', async (_req, res) => {
    try {
      const vaultDir = getVaultDir();
      const mobileDir = getMobileDir();
      const sessions = getAllSessions();
      // Best-effort disk usage of vault uploads dir
      let uploadsBytes = 0;
      try {
        const uploadsDir = path.join(vaultDir, 'uploads');
        const walkDir = async (dir: string): Promise<number> => {
          let total = 0;
          const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
          for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) total += await walkDir(p);
            else total += (await fs.stat(p)).size;
          }
          return total;
        };
        uploadsBytes = await walkDir(uploadsDir);
      } catch { /* ignore */ }
      res.json({
        vaultDir,
        mobileDir,
        sessionCount: sessions.length,
        uploadsBytes,
        offline: process.env.CHARBOT_OFFLINE === 'true',
        ok: true,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Vision: analyze image with local Ollama VLM ---
  app.post('/api/vision/analyze', async (req, res) => {
    const {
      base64,
      mime,
      prompt,
      model = process.env.CHARBOT_VISION_MODEL || 'qwen2.5vl',
    } = req.body as { base64: string; mime: string; prompt?: string; model?: string };

    // P1-6: validate vision model against allowlist
    const ALLOWED_VISION_PREFIXES = ['qwen2.5vl', 'llava', 'moondream', 'llava-phi3', 'minicpm-v', 'bakllava', 'llava-llama3'];
    const isAllowedVisionModel = ALLOWED_VISION_PREFIXES.some(p => model === p || model.startsWith(p + ':'));
    if (!isAllowedVisionModel) {
      res.status(400).json({ error: `Vision model "${model}" is not allowed. Allowed: ${ALLOWED_VISION_PREFIXES.join(', ')}` });
      return;
    }

    // Validate mime
    const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!base64 || !mime) {
      res.status(400).json({ error: 'base64 and mime are required.' });
      return;
    }
    if (mime === 'image/heic' || mime === 'image/heif') {
      res.status(400).json({ error: 'HEIC/HEIF format is not supported by the vision engine. Please convert to JPG or PNG first (e.g. use Photos app on iPhone → Share → Save as JPG).' });
      return;
    }
    if (!ALLOWED_MIME.includes(mime)) {
      res.status(400).json({ error: `Unsupported format: ${mime}. Accepted: JPG, PNG, WebP.` });
      return;
    }

    const OLLAMA_URL = 'http://127.0.0.1:11434';
    const DEFAULT_PROMPT =
      '1) Przepisz CAŁY widoczny tekst dokładnie, zachowaj łamania linii.\n' +
      '2) Jeśli niepewne oznacz [??].\n' +
      '3) Potem streść obraz w 2–3 zdaniach.\n' +
      '4) Jeśli widzisz pola typu data/partia/kod/produkt, zwróć je jako JSON.\n' +
      'Zwróć w sekcjach: TRANSCRIPT, SUMMARY, FIELDS_JSON.';

    const effectivePrompt = (prompt && prompt.trim()) ? prompt.trim() : DEFAULT_PROMPT;

    // Check Ollama availability
    try {
      const ping = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(2500) });
      if (!ping.ok) throw new Error('not ok');
    } catch {
      res.status(503).json({ error: 'Ollama is not running. Start it with: ollama serve\nThen ensure the model is available: ollama pull ' + model });
      return;
    }

    // Call Ollama vision
    try {
      const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: effectivePrompt, images: [base64], stream: false }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        if (errText.includes('model') && errText.includes('not found')) {
          res.status(502).json({ error: `Model "${model}" not found in Ollama. Run: ollama pull ${model}` });
          return;
        }
        if (errText.includes('unknown image format') || errText.includes('format')) {
          res.status(502).json({ error: 'Unknown image format returned by vision model. Try re-saving the image as JPG/PNG.' });
          return;
        }
        res.status(502).json({ error: `Ollama error: ${errText}` });
        return;
      }

      const data = await ollamaRes.json() as { response: string; [k: string]: any };
      await appendLog('vision', `Analyzed ${mime} with ${model} — ${data.response?.length ?? 0} chars`);
      res.json({ ok: true, model, response: data.response });
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        res.status(504).json({ error: 'Vision analysis timed out (>2 min). The image may be too large or the model is still loading.' });
        return;
      }
      res.status(500).json({ error: err.message });
    }
  });

  // --- File upload ---
  app.post('/api/upload', uploadRateLimit, upload.single('file'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    // P2: MIME allowlist — reject HEIC with helpful message; reject unknown types
    if (HEIC_MIMES.has(req.file.mimetype)) {
      await fs.unlink(req.file.path).catch(() => {});
      res.status(400).json({ error: 'HEIC/HEIF images are not supported. Please convert to JPEG or PNG first.' });
      return;
    }
    if (!ALLOWED_UPLOAD_MIMES.has(req.file.mimetype)) {
      await fs.unlink(req.file.path).catch(() => {});
      res.status(400).json({ error: `File type not allowed: ${req.file.mimetype}. Allowed: images (JPEG/PNG/GIF/WebP), PDF, text, CSV, JSON, Excel.` });
      return;
    }
    const sessionId = (req.query.sessionId as string) || 'misc';
    appendLog('uploads', `Uploaded: ${req.file.originalname} (${req.file.mimetype}) → session ${sessionId}`);
    res.json({
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: req.file.path,
      sessionId,
    });
  });

  // --- Session sync from browser ---
  app.post('/api/sessions/sync', (req, res) => {
    try {
      const { sessions } = req.body as { sessions: any[] };
      if (!Array.isArray(sessions)) {
        res.status(400).json({ error: 'sessions must be array' });
        return;
      }
      for (const s of sessions) {
        // P0-7: strip binary data from attachments before storing in DB
        // A4: Limit to 500 messages to prevent DoS via unbounded session growth
        const limitedMessages = (s.messages || []).slice(-500);
        const cleanMessages = limitedMessages.map((m: any) => ({
          ...m,
          attachments: m.attachments?.map((a: any) => ({
            id: a.id,
            name: a.name,
            mimeType: a.mimeType,
            size: a.size,
            // omit: dataUrl, base64, text (large data — stored in Vault uploads instead)
          })),
        }));
        upsertSession({
          id: s.id,
          title: s.title,
          messages: JSON.stringify(cleanMessages),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        });
      }
      res.json({ synced: sessions.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Mobile portal generation ---
  app.post('/api/mobile/generate', async (_req, res) => {
    try {
      const sessions = getAllSessions();
      if (sessions.length === 0) {
        res.status(400).json({ error: 'No sessions synced yet. Chat first, then export.' });
        return;
      }
      const outDir = await generateMobilePortal(sessions);
      appendLog('mobile', `Portal generated at ${outDir} (${sessions.length} sessions)`);
      res.json({ outDir, sessionCount: sessions.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Shell execution (P0-1: disabled by default, enable via ENABLE_EXEC=true) ---
  app.post('/api/terminal/exec', async (req, res) => {
    if (process.env.ENABLE_EXEC !== 'true') {
      res.status(403).json({ error: 'Shell execution is disabled. Set ENABLE_EXEC=true in .env to enable.' });
      return;
    }
    const { command, cwd } = req.body;
    if (!command) {
      res.status(400).json({ error: 'Command is required' });
      return;
    }
    const workingDir = cwd ? path.resolve(cwd) : process.cwd();
    exec(command, { cwd: workingDir, shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash' }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ output: stdout, error: stderr || error.message, exitCode: error.code });
      }
      res.json({ output: stdout, error: stderr, exitCode: 0 });
    });
  });

  // P0-2: /api/fs/* removed — all file access goes through /api/os/* (osAgent sandbox)
  // FlowEditor uses /api/os/list-dir, /api/os/read-file, /api/os/write-file instead.

  // --- Telegram status ---
  app.get('/api/telegram/status', (_req, res) => {
    res.json(getTelegramStatus());
  });

  // --- Telegram config (masked token) ---
  app.get('/api/telegram/config', async (_req, res) => {
    res.json(await getTelegramConfig());
  });

  // --- Telegram configure & restart bot ---
  app.post('/api/telegram/configure', async (req, res) => {
    const { token, allowedUserIds, notifyChatId, provider, model, apiKey } = req.body as {
      token?: string; allowedUserIds?: string; notifyChatId?: string;
      provider?: string; model?: string; apiKey?: string;
    };
    const result = await configureTelegramBot({
      token: token ?? '',
      allowedUserIds: allowedUserIds ?? '',
      notifyChatId: notifyChatId ?? '',
      provider: (provider ?? 'ollama') as any,
      model: model ?? 'llama3.2',
      apiKey: apiKey ?? '',
    });
    if (!result.ok) { res.status(400).json(result); return; }
    res.json({ ok: true, ...getTelegramStatus() });
  });

  // --- Telegram: update only provider/model/apiKey (preserves token+registration) ---
  app.post('/api/telegram/set-provider', async (req, res) => {
    const { provider, model, apiKey } = req.body as { provider?: string; model?: string; apiKey?: string };
    const existing = await loadTelegramConfig();
    const result = await configureTelegramBot({
      ...existing,
      provider: (provider ?? existing.provider) as any,
      model: model || existing.model,
      apiKey: apiKey ?? existing.apiKey ?? '',
    });
    if (!result.ok) { res.status(400).json(result); return; }
    res.json({ ok: true, ...getTelegramStatus() });
  });

  // --- Telegram: disconnect bot ---
  app.post('/api/telegram/disconnect', async (_req, res) => {
    await configureTelegramBot({ token: '', allowedUserIds: '', notifyChatId: '', provider: 'ollama', model: 'llama3.2' });
    res.json({ ok: true });
  });

  // --- Telegram: send session transcript as document ---
  app.post('/api/telegram/send-session', async (req, res) => {
    const { title, transcript } = req.body as { title: string; transcript: string };
    if (!title || !transcript) { res.status(400).json({ error: 'title and transcript are required' }); return; }
    const ok = await sendTelegramSession(title, transcript);
    if (!ok) {
      res.status(503).json({ error: 'Telegram bot not active or Notify Chat ID not set' });
      return;
    }
    res.json({ ok: true });
  });

  // --- Documents ---
  app.post('/api/docs/save', async (req, res) => {
    const { filename, content } = req.body as { filename?: string; content?: string };
    if (!filename || content === undefined) { res.status(400).json({ error: 'filename and content are required' }); return; }
    try {
      const result = await saveDocument(filename, content);
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/docs', async (_req, res) => {
    try { res.json(await listDocuments()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/docs/download/:filename', (req, res) => {
    const filePath = getDocPath(req.params.filename);
    res.download(filePath, req.params.filename, err => {
      if (err && !res.headersSent) res.status(404).json({ error: 'File not found' });
    });
  });

  app.delete('/api/docs/:filename', async (req, res) => {
    try {
      await deleteDocument(req.params.filename);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  });

  // --- OS Agent endpoints ---

  function getAllowedDirs(req: express.Request): string[] {
    return (req.body.allowedDirs && Array.isArray(req.body.allowedDirs))
      ? req.body.allowedDirs
      : DEFAULT_ALLOWED_DIRS;
  }

  app.post('/api/os/list-dir', async (req, res) => {
    const { dir } = req.body as { dir: string };
    if (!dir) { res.status(400).json({ error: 'dir is required' }); return; }
    try {
      const entries = await listDir(dir, getAllowedDirs(req));
      res.json({ ok: true, entries });
    } catch (e: any) {
      res.status(e.message.includes('Access denied') ? 403 : 400).json({ error: e.message });
    }
  });

  app.post('/api/os/search-files', async (req, res) => {
    const { query, dir } = req.body as { query: string; dir: string };
    if (!query || !dir) { res.status(400).json({ error: 'query and dir are required' }); return; }
    try {
      const results = await searchFiles(query, dir, getAllowedDirs(req));
      res.json({ ok: true, results });
    } catch (e: any) {
      res.status(e.message.includes('Access denied') ? 403 : 400).json({ error: e.message });
    }
  });

  app.post('/api/os/read-file', async (req, res) => {
    const { path: filePath } = req.body as { path: string };
    if (!filePath) { res.status(400).json({ error: 'path is required' }); return; }
    try {
      const result = await readFile(filePath, getAllowedDirs(req));
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(e.message.includes('Access denied') ? 403 : 400).json({ error: e.message });
    }
  });

  app.post('/api/os/write-file', async (req, res) => {
    const { path: filePath, content } = req.body as { path: string; content: string };
    if (!filePath || content === undefined) { res.status(400).json({ error: 'path and content are required' }); return; }
    try {
      const result = await writeFile(filePath, content, getAllowedDirs(req));
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(e.message.includes('Access denied') ? 403 : 400).json({ error: e.message });
    }
  });

  app.post('/api/os/append-csv', async (req, res) => {
    const { path: filePath, row_data } = req.body as { path: string; row_data: Record<string, string | number> };
    if (!filePath || !row_data) { res.status(400).json({ error: 'path and row_data are required' }); return; }
    try {
      const result = await appendCsv(filePath, row_data, getAllowedDirs(req));
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(e.message.includes('Access denied') ? 403 : 400).json({ error: e.message });
    }
  });

  // --- Ollama: create custom model (P0-9: disabled by default) ---
  app.post('/api/ollama/create-model', async (req, res) => {
    if (process.env.ENABLE_FINE_TUNE !== 'true') {
      res.status(403).json({ error: 'Fine-tuning is disabled. Set ENABLE_FINE_TUNE=true in .env to enable.' });
      return;
    }
    const { endpoint = 'http://localhost:11434', baseModel, modelName, systemPrompt, parameters } = req.body as {
      endpoint?: string;
      baseModel: string;
      modelName: string;
      systemPrompt?: string;
      parameters?: { temperature?: number };
    };
    if (!baseModel || !modelName) {
      res.status(400).json({ error: 'baseModel and modelName are required' });
      return;
    }

    // Build Modelfile content
    let modelfile = `FROM ${baseModel}\n`;
    if (systemPrompt?.trim()) {
      modelfile += `SYSTEM """\n${systemPrompt.trim()}\n"""\n`;
    }
    if (parameters?.temperature !== undefined) {
      modelfile += `PARAMETER temperature ${parameters.temperature}\n`;
    }

    try {
      const ollamaRes = await fetch(`${endpoint}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, modelfile }),
      });

      if (!ollamaRes.ok || !ollamaRes.body) {
        const errText = await ollamaRes.text();
        res.status(502).json({ error: `Ollama error: ${errText}` });
        return;
      }

      // Stream NDJSON progress back to client
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');

      const reader = ollamaRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) res.write(line + '\n');
        }
      }
      if (buf.trim()) res.write(buf + '\n');
      res.end();
    } catch (e: any) {
      if (!res.headersSent) res.status(500).json({ error: e.message });
      else res.end();
    }
  });

  // --- Push notifications (#35) ---
  app.post('/api/notify', async (req, res) => {
    const { message } = req.body as { message: string };
    if (!message) { res.status(400).json({ error: 'message is required' }); return; }
    await Promise.allSettled([
      sendTelegramNotification(message),
      sendDiscordNotification(message),
    ]);
    res.json({ ok: true });
  });

  // --- RAG: index session messages ---
  app.post('/api/rag/index', async (req, res) => {
    const { sessionId, messages, model = 'nomic-embed-text' } = req.body as {
      sessionId: string;
      messages: Array<{ role: string; content: string }>;
      model?: string;
    };
    if (!sessionId || !Array.isArray(messages)) {
      res.status(400).json({ error: 'sessionId and messages are required' });
      return;
    }
    try {
      const chunks = messages
        .filter(m => m.role !== 'system' && typeof m.content === 'string' && m.content.trim().length > 20)
        .map((m, i) => ({ role: m.role, content: m.content.trim(), idx: i }));

      if (chunks.length === 0) {
        res.json({ indexed: 0 });
        return;
      }

      const results: Array<{ id: string; sessionId: string; content: string; embedding: number[] }> = [];
      for (const chunk of chunks) {
        try {
          const embedding = await embedText(chunk.content, model);
          results.push({
            id: `${sessionId}_${chunk.idx}`,
            sessionId,
            content: chunk.content,
            embedding,
          });
        } catch { /* skip failed chunks */ }
      }

      storeChunks(results);
      res.json({ indexed: results.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- RAG: semantic search ---
  app.post('/api/rag/search', async (req, res) => {
    const { query, sessionId, model = 'nomic-embed-text', topK = 4 } = req.body as {
      query: string;
      sessionId?: string;
      model?: string;
      topK?: number;
    };
    if (!query) {
      res.status(400).json({ error: 'query is required' });
      return;
    }
    try {
      const queryEmbedding = await embedText(query, model);
      const results = searchEmbeddings(queryEmbedding, topK, sessionId);
      res.json({ results });
    } catch (err: any) {
      res.status(503).json({ error: `RAG search failed: ${err.message}` });
    }
  });

  // --- RAG: status ---
  app.get('/api/rag/status', (_req, res) => {
    try {
      res.json({ ok: true, ...getRagStats() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- RAG: list sessions with chunk counts (5C) ---
  app.get('/api/rag/list', (_req, res) => {
    try { res.json({ entries: listRagSessions() }); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // --- RAG: clear index (5C) ---
  app.post('/api/rag/clear', (req, res) => {
    const { sessionId } = req.body as { sessionId?: string };
    try {
      const deleted = clearRagIndex(sessionId);
      res.json({ ok: true, deleted });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // --- RAG: index a file from Vault/uploads (5C) ---
  app.post('/api/rag/index-file', async (req, res) => {
    const { filePath, sourceId, model = 'nomic-embed-text' } = req.body as {
      filePath: string; sourceId: string; model?: string;
    };
    if (!filePath || !sourceId) { res.status(400).json({ error: 'filePath and sourceId are required' }); return; }
    // A1: Restrict to Vault/uploads only — prevent path traversal
    const safePath = path.resolve(filePath);
    const allowedBase = path.resolve(path.join(getVaultDir(), 'uploads'));
    const rel = path.relative(allowedBase, safePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      res.status(403).json({ error: 'Access denied: only Vault/uploads files allowed' });
      return;
    }
    try {
      const raw = await fs.readFile(safePath, 'utf-8');
      const lines = raw.split('\n').filter(l => l.trim().length > 20);
      const results: Array<{ id: string; sessionId: string; content: string; embedding: number[] }> = [];
      for (let i = 0; i < lines.length; i++) {
        try {
          const embedding = await embedText(lines[i].trim(), model);
          results.push({ id: `${sourceId}_line_${i}`, sessionId: sourceId, content: lines[i].trim(), embedding });
        } catch { /* skip line */ }
      }
      storeChunks(results);
      res.json({ indexed: results.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // =============================================================
  // SCHEDULER (5A)
  // =============================================================

  app.get('/api/scheduler/tasks', (_req, res) => {
    try {
      const tasks = db.prepare(`SELECT * FROM scheduled_tasks ORDER BY createdAt DESC`).all();
      res.json({ tasks });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/scheduler/tasks', (req, res) => {
    const { name, type, cronExpr, config = '{}', enabled = 1 } = req.body as Partial<ScheduledTask>;
    if (!name || !type || !cronExpr) { res.status(400).json({ error: 'name, type, cronExpr required' }); return; }
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    try {
      db.prepare(`INSERT INTO scheduled_tasks (id,name,type,cronExpr,config,enabled,createdAt) VALUES (?,?,?,?,?,?,?)`)
        .run(id, name, type, cronExpr, config, enabled ? 1 : 0, createdAt);
      if (enabled) refreshTask(id, db, getSchedulerConfig);
      res.json({ ok: true, id });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/scheduler/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { name, type, cronExpr, config, enabled } = req.body as Partial<ScheduledTask>;
    try {
      const existing = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`).get(id) as ScheduledTask | undefined;
      if (!existing) { res.status(404).json({ error: 'Task not found' }); return; }
      db.prepare(`UPDATE scheduled_tasks SET name=COALESCE(?,name), type=COALESCE(?,type), cronExpr=COALESCE(?,cronExpr), config=COALESCE(?,config), enabled=COALESCE(?,enabled) WHERE id=?`)
        .run(name ?? null, type ?? null, cronExpr ?? null, config ?? null, enabled != null ? (enabled ? 1 : 0) : null, id);
      refreshTask(id, db, getSchedulerConfig);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/scheduler/tasks/:id', (req, res) => {
    const { id } = req.params;
    try {
      removeTask(id);
      db.prepare(`DELETE FROM scheduled_tasks WHERE id = ?`).run(id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/scheduler/tasks/:id/run', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await runTaskNow(id, db, getSchedulerConfig);
      res.json({ ok: true, result });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // =============================================================
  // PLUGINS (5B)
  // =============================================================

  app.get('/api/plugins', (_req, res) => {
    const plugins = getLoadedPlugins().map(p => ({
      name: p.name,
      description: p.description,
      parameters: p.parameters,
      source: p.source,
    }));
    res.json({ plugins });
  });

  app.post('/api/plugins/reload', async (_req, res) => {
    try {
      await reloadPlugins(getVaultDir());
      res.json({ ok: true, count: getLoadedPlugins().length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/plugins/exec/:name', async (req, res) => {
    const { name } = req.params;
    const { args = {} } = req.body as { args?: Record<string, any> };
    try {
      const result = await execPlugin(name, args, { vaultDir: getVaultDir(), allowedDirs: DEFAULT_ALLOWED_DIRS });
      res.json({ ok: true, result });
    } catch (err: any) { res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message }); }
  });

  app.post('/api/plugins/webhook', async (req, res) => {
    const { name, description = '', parameters = {}, url, method = 'GET' } = req.body as {
      name: string; description?: string; parameters?: Record<string, string>; url: string; method?: 'GET' | 'POST';
    };
    if (!name || !url) { res.status(400).json({ error: 'name and url are required' }); return; }
    try {
      await saveWebhookTool(getVaultDir(), { name, description, parameters, url, method });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/plugins/webhook/:name', async (req, res) => {
    try {
      await deleteWebhookTool(getVaultDir(), req.params.name);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Buddy SSE ────────────────────────────────────────────────────────────
  app.get('/api/buddy/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onTalking      = (d: unknown) => res.write(`event: talking\ndata: ${JSON.stringify(d)}\n\n`);
    const onEmotion      = (d: unknown) => res.write(`event: emotion\ndata: ${JSON.stringify(d)}\n\n`);
    const onMsgChunk     = (d: unknown) => res.write(`event: message_chunk\ndata: ${JSON.stringify(d)}\n\n`);
    const onMsgDone      = ()           => res.write(`event: message_done\ndata: ${JSON.stringify({})}\n\n`);

    buddyEmitter.on('talking', onTalking);
    buddyEmitter.on('emotion', onEmotion);
    buddyEmitter.on('message_chunk', onMsgChunk);
    buddyEmitter.on('message_done', onMsgDone);

    // Heartbeat
    const hb = setInterval(() => res.write(': ping\n\n'), 15000);

    req.on('close', () => {
      clearInterval(hb);
      buddyEmitter.off('talking', onTalking);
      buddyEmitter.off('emotion', onEmotion);
      buddyEmitter.off('message_chunk', onMsgChunk);
      buddyEmitter.off('message_done', onMsgDone);
    });
  });


  // --- Serve vault mobile portal and uploads (for mobile/USB-C access) ---
  app.use('/mobile', express.static(getMobileDir()));
  app.use('/uploads', express.static(path.join(getVaultDir(), 'uploads')));

  // --- Vite middleware (dev) / static (prod) ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
      root: process.cwd(),
    });
    app.use(vite.middlewares);
  } else {
    // In dev: __dirname = project root → dist/ is here
    // In packaged bundle: __dirname = dist-server/ → dist/ is one level up
    const distPath = existsSync(path.join(__dirname, 'dist'))
      ? path.join(__dirname, 'dist')
      : path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // --- Sprint 6: Multiroom REST endpoints ---

  // GET /api/rooms — list active rooms
  app.get('/api/rooms', (_req, res) => {
    const rooms = db.prepare(`SELECT * FROM rooms ORDER BY createdAt DESC`).all() as Room[];
    const result = rooms.map(r => {
      const participants = db.prepare(`SELECT * FROM room_participants WHERE roomId = ? AND isActive = 1`).all(r.id) as RoomParticipant[];
      const onlineIds = getOnlineIds(r.id);
      return {
        ...r,
        password: r.password ? true : false, // mask actual password
        participants: participants.map(p => ({ ...p, online: onlineIds.includes(p.id) })),
      };
    });
    res.json(result);
  });

  // POST /api/rooms — create room
  app.post('/api/rooms', (req, res) => {
    const { name, mode = 'own_model', password, debateTopicPro, debateTopicCon } = req.body as Partial<Room>;
    if (!name) { res.status(400).json({ error: 'name required' }); return; }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO rooms (id, name, mode, password, debateTopicPro, debateTopicCon, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, mode, password ?? null, debateTopicPro ?? null, debateTopicCon ?? null, now);
    res.json({ id, name, mode });
  });

  // GET /api/rooms/:id — room info
  app.get('/api/rooms/:id', (req, res) => {
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(req.params.id) as Room | undefined;
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
    const participants = db.prepare(`SELECT * FROM room_participants WHERE roomId = ? AND isActive = 1`).all(room.id) as RoomParticipant[];
    const onlineIds = getOnlineIds(room.id);
    res.json({
      ...room,
      password: room.password ? true : false,
      participants: participants.map(p => ({ ...p, online: onlineIds.includes(p.id) })),
    });
  });

  // POST /api/rooms/:id/join — join room, returns participant record
  app.post('/api/rooms/:id/join', (req, res) => {
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(req.params.id) as Room | undefined;
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
    const { username, model, password } = req.body as { username: string; model: string; password?: string };
    if (!username || !model) { res.status(400).json({ error: 'username and model required' }); return; }
    if (room.password && room.password !== password) {
      res.status(403).json({ error: 'Wrong password' }); return;
    }
    // Reuse existing participant if same username in this room
    const existing = db.prepare(`SELECT * FROM room_participants WHERE roomId = ? AND username = ?`).get(room.id, username) as RoomParticipant | undefined;
    if (existing) {
      db.prepare(`UPDATE room_participants SET model = ?, isActive = 1, lastSeenAt = ? WHERE id = ?`).run(model, new Date().toISOString(), existing.id);
      res.json({ ...existing, model });
      return;
    }
    const count = (db.prepare(`SELECT COUNT(*) as c FROM room_participants WHERE roomId = ?`).get(room.id) as { c: number }).c;
    const id = crypto.randomUUID();
    const color = pickColor(count);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO room_participants (id, roomId, username, color, model, isActive, joinedAt, lastSeenAt)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, room.id, username, color, model, now, now);
    res.json({ id, roomId: room.id, username, color, model, isActive: 1, joinedAt: now });
  });

  // GET /api/rooms/:id/messages — message history
  app.get('/api/rooms/:id/messages', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const msgs = db.prepare(`SELECT * FROM room_messages WHERE roomId = ? ORDER BY createdAt DESC LIMIT ?`).all(req.params.id, limit) as RoomMessage[];
    res.json(msgs.reverse());
  });

  // DELETE /api/rooms/:id — delete room
  app.delete('/api/rooms/:id', (req, res) => {
    db.prepare(`DELETE FROM room_messages WHERE roomId = ?`).run(req.params.id);
    db.prepare(`DELETE FROM room_participants WHERE roomId = ?`).run(req.params.id);
    db.prepare(`DELETE FROM rooms WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  });

  // GET /api/rooms/models — server-side proxy for Ollama model list
  // Used by room join forms so all clients (Windows, phone, RPi) see the server's models
  app.get('/api/rooms/models', async (_req, res) => {
    const ollamaEndpoint = process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434';
    try {
      const r = await fetch(`${ollamaEndpoint}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) { res.status(502).json({ error: `Ollama ${r.status}` }); return; }
      const data = await r.json() as { models?: { name: string }[] };
      const models = (data.models ?? []).map((m: { name: string }) => m.name).sort();
      res.json({ models });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  // --- Sprint 6: HTTP server + WebSocket ---
  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const m = req.url?.match(/^\/ws\/room\/([^/?]+)/);
    if (!m) { socket.destroy(); return; }
    // Validate APP_SECRET via query param
    const url = new URL(req.url!, `http://localhost`);
    const secret = url.searchParams.get('secret') ?? '';
    if (APP_SECRET && secret !== APP_SECRET) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      _handleRoomWS(ws, m[1], url.searchParams.get('participantId') ?? '', db);
    });
  });

  function _handleRoomWS(ws: import('ws').WebSocket, roomId: string, participantId: string, db: import('better-sqlite3').Database) {
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(roomId) as Room | undefined;
    const participant = db.prepare(`SELECT * FROM room_participants WHERE id = ?`).get(participantId) as RoomParticipant | undefined;
    if (!room || !participant) { ws.close(4004, 'Room or participant not found'); return; }

    registerConnection(roomId, participantId, ws);

    // A3: Server-side heartbeat — terminate dead connections (e.g. power loss without TCP close)
    let isAlive = true;
    ws.on('pong', () => { isAlive = true; });
    const heartbeat = setInterval(() => {
      if (!isAlive) { clearInterval(heartbeat); ws.terminate(); return; }
      isAlive = false;
      ws.ping();
    }, 30_000);

    // Send initial presence to new joiner
    const participants = db.prepare(`SELECT * FROM room_participants WHERE roomId = ? AND isActive = 1`).all(roomId) as RoomParticipant[];
    const onlineIds = getOnlineIds(roomId);
    sendTo(roomId, participantId, {
      type: 'presence',
      participants: participants.map(p => ({ ...p, online: onlineIds.includes(p.id) })),
    });

    // Announce join to others
    broadcast(roomId, {
      type: 'join',
      participant: { ...participant, online: true },
    }, participantId);

    ws.on('message', async (raw) => {
      let data: any;
      try { data = JSON.parse(raw.toString()); } catch { return; }

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        db.prepare(`UPDATE room_participants SET lastSeenAt = ? WHERE id = ?`).run(new Date().toISOString(), participantId);
        return;
      }

      if (data.type === 'message') {
        const content: string = String(data.content ?? '').trim().slice(0, 8000);
        if (!content) return;
        const msgId = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO room_messages (id, roomId, authorId, authorName, authorType, model, content, replyToId, createdAt)
          VALUES (?, ?, ?, ?, 'human', NULL, ?, ?, ?)
        `).run(msgId, roomId, participantId, participant.username, content, data.replyToId ?? null, now);

        const msg: RoomMessage = {
          id: msgId, roomId, authorId: participantId, authorName: participant.username,
          authorType: 'human', model: null, content, replyToId: data.replyToId ?? null, createdAt: now,
        };
        // Broadcast human message to everyone including sender
        const allConns = getOnlineIds(roomId);
        for (const pid of allConns) {
          sendTo(roomId, pid, { type: 'message', message: msg });
        }
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeat);
      removeConnection(roomId, participantId);
      db.prepare(`UPDATE room_participants SET lastSeenAt = ? WHERE id = ?`).run(new Date().toISOString(), participantId);
      broadcast(roomId, { type: 'leave', participantId });
    });

    ws.on('error', () => { clearInterval(heartbeat); removeConnection(roomId, participantId); });
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(PORT, BIND_HOST, () => {
      console.log(`\nCharbot OS server → http://${BIND_HOST}:${PORT}`);
      console.log(`Vault dir: ${getVaultDir()}`);
      console.log(`Mobile dir: ${getMobileDir()}`);
      console.log(`Offline mode: ${process.env.CHARBOT_OFFLINE === 'true' ? 'ON' : 'off'}`);
      console.log(`Shell exec: ${process.env.ENABLE_EXEC === 'true' ? 'ENABLED' : 'disabled (ENABLE_EXEC not set)'}`);
      console.log(`OS: ${process.platform}\n`);
      resolve();
    });
  });

  // Start bots (non-blocking — they only activate if tokens are set)
  startTelegramBot();
  startDiscordBot();

  // Sprint 5A: start scheduler (after bots so Telegram send is available)
  initScheduler(db, getSchedulerConfig);

  // Sprint 5B: load plugins
  loadPlugins(getVaultDir()).catch(e => console.error('[plugins]', e));
}

// Top-level await: import() in Electron main.ts resolves only after server is listening.
// Any startup failure (DB, port conflict, missing module) surfaces as a thrown error
// which is caught by the "błąd startu serwera" dialog in main.ts.
await startServer();
