import { Telegraf } from 'telegraf';
import fs from 'fs/promises';
import path from 'path';
import { getAllSessions, getSessionById, searchSessions, upsertSession, type SessionRow } from './db.js';
import { appendLog, getVaultDir } from './vault.js';

const OLLAMA_URL = 'http://127.0.0.1:11434';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export interface TelegramConfig {
  token: string;
  allowedUserIds: string;
  notifyChatId: string;
  provider: 'ollama' | 'openai' | 'google' | 'anthropic';
  model: string;
  apiKey?: string;
}

function getConfigPath(): string {
  return path.join(getVaultDir(), 'telegram-config.json');
}

export async function loadTelegramConfig(): Promise<TelegramConfig> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8');
    return JSON.parse(raw) as TelegramConfig;
  } catch {
    return {
      token: process.env.TELEGRAM_BOT_TOKEN || '',
      allowedUserIds: process.env.TELEGRAM_ALLOWED_USER_IDS || process.env.TELEGRAM_ALLOWED_CHAT_IDS || '',
      notifyChatId: process.env.TELEGRAM_NOTIFY_CHAT_ID || '',
      provider: (process.env.CHARBOT_PROVIDER || 'ollama') as TelegramConfig['provider'],
      model: process.env.CHARBOT_DEFAULT_MODEL || 'llama3.2',
    };
  }
}

async function saveConfig(config: TelegramConfig): Promise<void> {
  await fs.writeFile(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

let _cfg: TelegramConfig = { token: '', allowedUserIds: '', notifyChatId: '', provider: 'ollama', model: 'llama3.2', apiKey: '' };
let _botUsername: string = '';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function isAllowed(userId: number): boolean {
  const raw = _cfg.allowedUserIds.trim();
  if (!raw) return false; // P0-4: empty whitelist = deny all
  const allowed = new Set(raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)));
  return allowed.has(userId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h ago`;
  return `${Math.floor(diff / 60000)}m ago`;
}

function sessionSummary(s: SessionRow): string {
  const msgs = JSON.parse(s.messages) as any[];
  return `📝 *${s.title}*\n\`${s.id}\` · ${msgs.length} msgs · ${relTime(s.updatedAt)}`;
}

function sessionTranscript(s: SessionRow): string {
  const msgs = JSON.parse(s.messages) as any[];
  const lines = msgs.map((m: any) => `[${m.role.toUpperCase()}]\n${m.content}`);
  return `# ${s.title}\nExported: ${new Date().toLocaleString()}\nMessages: ${msgs.length}\n\n` +
    lines.join('\n\n---\n\n');
}

// ---------------------------------------------------------------------------
// Multi-provider AI
// ---------------------------------------------------------------------------
function resolveKey(envVar: string): string {
  return _cfg.apiKey || process.env[envVar] || '';
}

async function aiGenerate(prompt: string): Promise<string> {
  const { provider, model } = _cfg;

  if (provider === 'openai') {
    const key = resolveKey('OPENAI_API_KEY');
    if (!key) throw new Error('OpenAI API key not set. Configure it in the Telegram settings.');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content.trim();
  }

  if (provider === 'google') {
    const key = resolveKey('GEMINI_API_KEY');
    if (!key) throw new Error('Google API key not set. Configure it in the Telegram settings.');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
    return data.candidates[0].content.parts[0].text.trim();
  }

  if (provider === 'anthropic') {
    const key = resolveKey('ANTHROPIC_API_KEY');
    if (!key) throw new Error('Anthropic API key not set. Configure it in the Telegram settings.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { content: { type: string; text: string }[] };
    return data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  }

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { response: string };
  return data.response.trim();
}

async function aiChat(messages: Array<{ role: string; content: string }>): Promise<string> {
  const { provider, model } = _cfg;

  if (provider === 'openai') {
    const key = resolveKey('OPENAI_API_KEY');
    if (!key) throw new Error('OpenAI API key not set. Configure it in the Telegram settings.');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content.trim();
  }

  if (provider === 'google') {
    const key = resolveKey('GEMINI_API_KEY');
    if (!key) throw new Error('Google API key not set. Configure it in the Telegram settings.');
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
    return data.candidates[0].content.parts[0].text.trim();
  }

  if (provider === 'anthropic') {
    const key = resolveKey('ANTHROPIC_API_KEY');
    if (!key) throw new Error('Anthropic API key not set. Configure it in the Telegram settings.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 2048, messages }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { content: { type: string; text: string }[] };
    return data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  }

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { message: { content: string } };
  return data.message.content.trim();
}

function aiError(err: any): string {
  if (err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed'))
    return `⚠️ Cannot connect to ${_cfg.provider}. Check your service is running.`;
  if (err.name === 'TimeoutError') return '⚠️ AI timed out — model may still be loading.';
  return `⚠️ ${err.message}`;
}

// ---------------------------------------------------------------------------
// Last photo
// ---------------------------------------------------------------------------
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

async function getLastPhoto(): Promise<string | null> {
  const uploadsDir = path.join(getVaultDir(), 'uploads');
  let newest: { path: string; mtime: number } | null = null;
  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(p); }
      else if (IMAGE_EXTS.has(path.extname(e.name).toLowerCase())) {
        const stat = await fs.stat(p);
        if (!newest || stat.mtimeMs > newest.mtime) newest = { path: p, mtime: stat.mtimeMs };
      }
    }
  };
  try { await walk(uploadsDir); } catch { return null; }
  return newest?.path ?? null;
}

// ---------------------------------------------------------------------------
// Push helpers
// ---------------------------------------------------------------------------
let _bot: Telegraf | null = null;

export async function sendTelegramNotification(text: string): Promise<void> {
  if (!_bot || !_cfg.notifyChatId) return;
  try {
    await (_bot as any).telegram.sendMessage(_cfg.notifyChatId, text, { parse_mode: 'Markdown' });
  } catch { /* non-fatal */ }
}

export async function sendTelegramSession(title: string, transcript: string): Promise<boolean> {
  if (!_bot || !_cfg.notifyChatId) return false;
  try {
    const safeTitle = title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'session';
    await (_bot as any).telegram.sendDocument(
      _cfg.notifyChatId,
      { source: Buffer.from(transcript, 'utf-8'), filename: `${safeTitle}.txt` },
      { caption: `📤 *${title}*`, parse_mode: 'Markdown' },
    );
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Status & config API
// ---------------------------------------------------------------------------
export function getTelegramStatus(): {
  active: boolean;
  registered: boolean;
  botUsername: string;
  provider: string;
  model: string;
} {
  return {
    active: _bot !== null,
    registered: !!_cfg.notifyChatId,
    botUsername: _botUsername,
    provider: _cfg.provider,
    model: _cfg.model,
  };
}

export async function getTelegramConfig(): Promise<{
  tokenMasked: string;
  allowedUserIds: string;
  notifyChatId: string;
  provider: string;
  model: string;
}> {
  const cfg = await loadTelegramConfig();
  const t = cfg.token;
  const tokenMasked = t.length > 10
    ? `${t.slice(0, 6)}${'•'.repeat(t.length - 10)}${t.slice(-4)}`
    : t ? '••••••' : '';
  return { tokenMasked, allowedUserIds: cfg.allowedUserIds, notifyChatId: cfg.notifyChatId, provider: cfg.provider, model: cfg.model };
}

// ---------------------------------------------------------------------------
// Configure & restart
// ---------------------------------------------------------------------------
export async function configureTelegramBot(config: TelegramConfig): Promise<{ ok: boolean; error?: string }> {
  if (_bot) {
    try { _bot.stop('reconfigure'); } catch { /* ignore */ }
    _bot = null;
    _botUsername = '';
  }

  if (!config.token.trim()) {
    const existing = await loadTelegramConfig();
    config.token = existing.token;
  }

  await saveConfig(config);
  return startBotWithConfig(config);
}

// ---------------------------------------------------------------------------
// Internal: start bot
// ---------------------------------------------------------------------------
function startBotWithConfig(config: TelegramConfig): { ok: boolean; error?: string } {
  if (!config.token) {
    console.log('[Telegram] No token — bot disabled');
    return { ok: false, error: 'No token provided' };
  }

  _cfg = config;
  const bot = new Telegraf(config.token);
  _bot = bot;

  // Fetch bot username for deep link
  bot.telegram.getMe()
    .then(me => { _botUsername = me.username ?? ''; })
    .catch(() => {});

  // Auth middleware — /register is always open
  bot.use(async (ctx, next) => {
    const cmd = (ctx.message as any)?.text?.split(' ')[0];
    if (cmd === '/register') return next();

    const userId = ctx.from?.id;
    if (!userId || !isAllowed(userId)) {
      await ctx.reply('⛔ Access denied. Send /register to set up access.');
      await appendLog('remote', `Telegram: blocked user ${userId}`);
      return;
    }
    await appendLog('remote', `Telegram: ${ctx.from?.username ?? userId}: ${(ctx.message as any)?.text ?? '?'}`);
    return next();
  });

  // /register — self-service setup (no auth required)
  bot.command('register', async ctx => {
    const userId = String(ctx.from!.id);
    const chatId = String(ctx.chat!.id);
    const username = ctx.from?.username ? `@${ctx.from.username}` : `ID ${userId}`;

    // Add to allowed list if not already there
    const existingIds = _cfg.allowedUserIds
      ? _cfg.allowedUserIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    if (!existingIds.includes(userId)) existingIds.push(userId);

    const updated: TelegramConfig = {
      ..._cfg,
      allowedUserIds: existingIds.join(', '),
      notifyChatId: chatId,
    };
    _cfg = updated;
    await saveConfig(updated);

    await ctx.replyWithMarkdown(
      `✅ *Registered!* You're all set, ${username}.\n\n` +
      `Charbot will now send notifications to this chat.\n\n` +
      `*Commands:*\n` +
      `\`/chat <msg>\` — one-shot AI\n` +
      `\`/ask <msg>\` — conversational AI\n` +
      `\`/status\` — system status\n` +
      `\`/last\` — last sessions\n` +
      `\`/help\` — all commands`,
    );
    await appendLog('remote', `Telegram: registered user ${username} (${userId}), chat ${chatId}`);
  });

  // /start
  bot.command('start', ctx => {
    const isReg = !!_cfg.notifyChatId;
    ctx.replyWithMarkdown(
      isReg
        ? `*Charbot OS Remote* ✅\n\nProvider: \`${_cfg.provider}\` · Model: \`${_cfg.model}\`\n\nSend /help for commands.`
        : `*Charbot OS Remote*\n\nTo complete setup, send:\n\`/register\``,
    );
  });

  // /help
  bot.command('help', ctx =>
    ctx.replyWithMarkdown(
      `*Commands*\n\n` +
      `\`/chat <msg>\` — one-shot AI reply\n` +
      `\`/ask <msg>\` — conversational AI \\(history\\)\n` +
      `\`/reset\` — clear conversation\n` +
      `\`/status\` — vault & session stats\n` +
      `\`/last\` — last 5 sessions\n` +
      `\`/search <q>\` — search sessions\n` +
      `\`/export <id|last>\` — download transcript\n` +
      `\`/photo last\` — last uploaded photo`,
    )
  );

  // /status
  bot.command('status', ctx => {
    const sessions = getAllSessions();
    ctx.replyWithMarkdown(
      `*Charbot OS Status*\n\n` +
      `Sessions: \`${sessions.length}\`\n` +
      `Last active: ${sessions[0] ? relTime(sessions[0].updatedAt) : 'N/A'}\n` +
      `Provider: \`${_cfg.provider}\`\n` +
      `Model: \`${_cfg.model}\``,
    );
  });

  // /last
  bot.command('last', ctx => {
    const sessions = getAllSessions().slice(0, 5);
    if (!sessions.length) return ctx.reply('No sessions found.');
    ctx.replyWithMarkdown(sessions.map(sessionSummary).join('\n\n'));
  });

  // /search
  bot.command('search', ctx => {
    const query = (ctx.message as any).text?.replace('/search', '').trim();
    if (!query) return ctx.reply('Usage: /search <query>');
    const results = searchSessions(query).slice(0, 5);
    if (!results.length) return ctx.reply(`No sessions matching "${query}"`);
    ctx.replyWithMarkdown(results.map(sessionSummary).join('\n\n'));
  });

  // /export
  bot.command('export', async ctx => {
    const arg = (ctx.message as any).text?.replace('/export', '').trim();
    if (!arg) return ctx.reply('Usage: /export <session-id|last>');
    const session = arg === 'last' ? getAllSessions()[0] : getSessionById(arg);
    if (!session) return ctx.reply('Session not found.');
    await ctx.replyWithDocument(
      { source: Buffer.from(sessionTranscript(session), 'utf-8'), filename: `${session.id}.txt` },
      { caption: session.title },
    );
  });

  // /ping — quick connectivity test (no AI)
  bot.command('ping', ctx => ctx.reply('🏓 pong — bot is alive'));

  // /chat
  bot.command('chat', async ctx => {
    const text = cmdArg(ctx, 'chat');
    if (!text) return ctx.reply('Usage: /chat <message>');
    try { await ctx.sendChatAction('typing'); } catch { /* non-critical */ }
    try {
      const response = await aiGenerate(text);
      await ctx.reply(response.slice(0, 4000));
    } catch (err: any) {
      await ctx.reply(aiError(err));
    }
  });

  // /ask — conversational with history
  bot.command('ask', async ctx => {
    const text = cmdArg(ctx, 'ask');
    if (!text) return ctx.reply('Usage: /ask <message>');
    const userId = ctx.from!.id;
    const sessionId = `tg_${userId}`;
    const now = new Date().toISOString();
    const existing = getSessionById(sessionId);
    const messages: Array<{ role: string; content: string }> = existing ? JSON.parse(existing.messages) : [];
    messages.push({ role: 'user', content: text });
    try { await ctx.sendChatAction('typing'); } catch { /* non-critical */ }
    try {
      const response = await aiChat(messages);
      messages.push({ role: 'assistant', content: response });
      upsertSession({
        id: sessionId,
        title: `Telegram — @${ctx.from?.username ?? userId}`,
        messages: JSON.stringify(messages.slice(-40)),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      await ctx.reply(response.slice(0, 4000));
    } catch (err: any) {
      await ctx.reply(aiError(err));
    }
  });

  // /reset
  bot.command('reset', ctx => {
    const userId = ctx.from!.id;
    const now = new Date().toISOString();
    upsertSession({
      id: `tg_${userId}`,
      title: `Telegram — @${ctx.from?.username ?? userId}`,
      messages: '[]',
      createdAt: now,
      updatedAt: now,
    });
    ctx.reply('✅ Conversation history cleared.');
  });

  // /photo last
  bot.command('photo', async ctx => {
    const arg = cmdArg(ctx, 'photo');
    if (arg !== 'last') return ctx.reply('Usage: /photo last');
    try { await ctx.sendChatAction('upload_photo'); } catch { /* non-critical */ }
    const photoPath = await getLastPhoto();
    if (!photoPath) return ctx.reply('No photos found in Vault uploads.');
    await ctx.replyWithPhoto(
      { source: photoPath },
      { caption: `📷 ${path.basename(photoPath)}` },
    );
  });

  // Global error handler — ensures ALL unhandled errors get logged + replied
  bot.catch(async (err: any, ctx) => {
    console.error(`[Telegram] Unhandled error for ${ctx.updateType}:`, err?.message ?? err);
    try { await ctx.reply(`⚠️ Internal error: ${err?.message ?? 'unknown'}`); } catch { /* ignore */ }
  });

  // Launch with explicit webhook deletion first
  bot.telegram.deleteWebhook({ drop_pending_updates: false })
    .then(() => bot.launch())
    .then(() => console.log(`[Telegram] Bot @${_botUsername} started OK (${_cfg.provider}/${_cfg.model})`))
    .catch((err: any) => {
      console.error('[Telegram] Launch failed:', err.message);
      _bot = null;
    });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Command arg helper — strips "/cmd" or "/cmd@botname" prefix
// ---------------------------------------------------------------------------
function cmdArg(ctx: any, cmd: string): string {
  const text: string = ctx.message?.text ?? '';
  // Strip "/cmd" or "/cmd@BotUsername" (case-insensitive for command part)
  return text.replace(new RegExp(`^\\/${cmd}(?:@\\S+)?\\s*`, 'i'), '').trim();
}

// ---------------------------------------------------------------------------
// Public startup
// ---------------------------------------------------------------------------
export async function startTelegramBot(): Promise<void> {
  const config = await loadTelegramConfig();
  if (!config.token) {
    console.log('[Telegram] TELEGRAM_BOT_TOKEN not set — bot disabled');
    _cfg = config;
    return;
  }
  startBotWithConfig(config);
  process.once('SIGINT', () => _bot?.stop('SIGINT'));
  process.once('SIGTERM', () => _bot?.stop('SIGTERM'));
}
