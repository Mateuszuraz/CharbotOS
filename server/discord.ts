import { Client, GatewayIntentBits, Events, type Message as DiscordMessage, type TextChannel } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { getAllSessions, getSessionById, searchSessions, upsertSession, type SessionRow } from './db.js';
import { appendLog, getVaultDir } from './vault.js';

const PREFIX = '!cb ';
const OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = () => process.env.CHARBOT_DEFAULT_MODEL || 'llama3.2';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function getAllowedGuilds(): Set<string> {
  const raw = process.env.DISCORD_ALLOWED_GUILD_IDS || '';
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

function isAllowed(guildId: string | null): boolean {
  const allowed = getAllowedGuilds();
  if (allowed.size === 0) return true;
  return guildId ? allowed.has(guildId) : false;
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
  return `**${s.title}**\n\`${s.id}\` · ${msgs.length} msgs · ${relTime(s.updatedAt)}`;
}

function sessionTranscript(s: SessionRow): string {
  const msgs = JSON.parse(s.messages) as any[];
  const lines = msgs.map((m: any) => `[${m.role.toUpperCase()}]\n${m.content}`);
  return (
    `# ${s.title}\nExported: ${new Date().toLocaleString()}\nMessages: ${msgs.length}\n\n` +
    lines.join('\n\n---\n\n')
  );
}

function ollamaError(err: any): string {
  if (err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed')) {
    return '⚠️ Ollama is not running. Start it with: `ollama serve`';
  }
  if (err.name === 'TimeoutError') return '⚠️ Ollama timed out — model may still be loading.';
  return `⚠️ ${err.message}`;
}

// Discord has a 2000-char message limit
async function discordReply(message: DiscordMessage, text: string): Promise<void> {
  if (text.length <= 1900) {
    await message.reply(text);
  } else {
    await message.reply({
      content: '_(response too long — attached as file)_',
      files: [{ attachment: Buffer.from(text, 'utf-8'), name: 'response.txt' }],
    });
  }
}

// ---------------------------------------------------------------------------
// Ollama
// ---------------------------------------------------------------------------
async function ollamaGenerate(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: DEFAULT_MODEL(), prompt, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { response: string };
  return data.response.trim();
}

async function ollamaChat(messages: Array<{ role: string; content: string }>): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: DEFAULT_MODEL(), messages, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { message: { content: string } };
  return data.message.content.trim();
}

// ---------------------------------------------------------------------------
// Last photo from vault/uploads (#36)
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
// Push notifications (#35)
// ---------------------------------------------------------------------------
let _client: Client | null = null;

export async function sendDiscordNotification(text: string): Promise<void> {
  if (!_client) return;
  const channelId = process.env.DISCORD_NOTIFY_CHANNEL_ID;
  if (!channelId) return;
  try {
    const channel = await _client.channels.fetch(channelId) as TextChannel | null;
    await channel?.send(text);
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------
async function handleCommand(message: DiscordMessage, cmd: string, args: string): Promise<void> {
  await appendLog('remote', `Discord: "${cmd}" from ${message.author.tag} (guild: ${message.guildId})`);

  switch (cmd) {

    case 'help':
      await message.reply(
        '**Charbot OS Remote**\n\n' +
        '`!cb status` — vault & session stats\n' +
        '`!cb last` — last 5 sessions\n' +
        '`!cb search <query>` — search sessions\n' +
        '`!cb export <id|last>` — export transcript as .txt\n' +
        '`!cb chat <message>` — one-shot AI reply\n' +
        '`!cb ask <message>` — conversational AI (remembers history)\n' +
        '`!cb reset` — clear your conversation history\n' +
        '`!cb photo last` — send last uploaded photo'
      );
      break;

    case 'status': {
      const sessions = getAllSessions();
      await message.reply(
        `**Charbot OS Status**\n` +
        `Sessions: \`${sessions.length}\`\n` +
        `Last active: ${sessions[0] ? relTime(sessions[0].updatedAt) : 'N/A'}\n` +
        `Model: \`${DEFAULT_MODEL()}\``
      );
      break;
    }

    case 'last': {
      const sessions = getAllSessions().slice(0, 5);
      if (!sessions.length) { await message.reply('No sessions found.'); break; }
      await message.reply(sessions.map(sessionSummary).join('\n\n'));
      break;
    }

    case 'search': {
      if (!args) { await message.reply('Usage: `!cb search <query>`'); break; }
      const results = searchSessions(args).slice(0, 5);
      if (!results.length) { await message.reply(`No sessions matching "${args}"`); break; }
      await message.reply(results.map(sessionSummary).join('\n\n'));
      break;
    }

    case 'export': {
      if (!args) { await message.reply('Usage: `!cb export <session-id|last>`'); break; }
      const session = args === 'last' ? getAllSessions()[0] : getSessionById(args);
      if (!session) { await message.reply('Session not found.'); break; }

      // P1-8: attach uploaded files as file links, not base64
      const uploadFiles: string[] = [];
      try {
        const uploadDir = path.join(getVaultDir(), 'uploads', session.id);
        const entries = await fs.readdir(uploadDir);
        uploadFiles.push(...entries.map(f => path.join(uploadDir, f)));
      } catch { /* no uploads for this session */ }

      const MAX_DISCORD_FILES = 8; // Discord limit per message
      const filesToSend = uploadFiles.slice(0, MAX_DISCORD_FILES).map(p => ({ attachment: p, name: path.basename(p) }));

      await message.reply({
        content: `**${session.title}**${uploadFiles.length > MAX_DISCORD_FILES ? ` _(${uploadFiles.length - MAX_DISCORD_FILES} more files not shown)_` : ''}`,
        files: [
          { attachment: Buffer.from(sessionTranscript(session), 'utf-8'), name: `${session.id}.txt` },
          ...filesToSend,
        ],
      });
      break;
    }

    // !cb chat <message> — single-turn, stateless (#34)
    case 'chat': {
      if (!args) { await message.reply('Usage: `!cb chat <message>`'); break; }
      await message.channel.sendTyping();
      try {
        const response = await ollamaGenerate(args);
        await discordReply(message, response);
      } catch (err: any) {
        await message.reply(ollamaError(err));
      }
      break;
    }

    // !cb ask <message> — multi-turn, persistent per-user session (#38)
    case 'ask': {
      if (!args) { await message.reply('Usage: `!cb ask <message>`'); break; }
      const userId = message.author.id;
      const sessionId = `dc_${userId}`;
      const now = new Date().toISOString();
      const existing = getSessionById(sessionId);
      const messages: Array<{ role: string; content: string }> = existing
        ? JSON.parse(existing.messages)
        : [];
      messages.push({ role: 'user', content: args });
      await message.channel.sendTyping();
      try {
        const response = await ollamaChat(messages);
        messages.push({ role: 'assistant', content: response });
        upsertSession({
          id: sessionId,
          title: `Discord — ${message.author.tag}`,
          messages: JSON.stringify(messages.slice(-40)),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
        await discordReply(message, response);
      } catch (err: any) {
        await message.reply(ollamaError(err));
      }
      break;
    }

    // !cb reset — clear conversation history
    case 'reset': {
      const now = new Date().toISOString();
      upsertSession({
        id: `dc_${message.author.id}`,
        title: `Discord — ${message.author.tag}`,
        messages: '[]',
        createdAt: now,
        updatedAt: now,
      });
      await message.reply('✅ Conversation history cleared.');
      break;
    }

    // !cb photo last (#36)
    case 'photo': {
      if (args !== 'last') { await message.reply('Usage: `!cb photo last`'); break; }
      const photoPath = await getLastPhoto();
      if (!photoPath) { await message.reply('No photos found in Vault uploads.'); break; }
      await message.reply({
        content: `📷 \`${path.basename(photoPath)}\``,
        files: [photoPath],
      });
      break;
    }

    default:
      await message.reply(`Unknown command. Try \`!cb help\``);
  }
}

// ---------------------------------------------------------------------------
// Bot startup
// ---------------------------------------------------------------------------
export function startDiscordBot(): void {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) { console.log('[Discord] DISCORD_BOT_TOKEN not set — bot disabled'); return; }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });
  _client = client;

  client.once(Events.ClientReady, () => {
    console.log(`[Discord] Bot ready as ${client.user?.tag}`);
  });

  client.on(Events.MessageCreate, async (message: DiscordMessage) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (!isAllowed(message.guildId)) {
      await message.reply('⛔ Access denied');
      await appendLog('remote', `Discord: blocked guild ${message.guildId}`);
      return;
    }
    const rest = message.content.slice(PREFIX.length).trim();
    const spaceIdx = rest.indexOf(' ');
    const cmd = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
    const args = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();
    await handleCommand(message, cmd, args).catch(err => {
      console.error('[Discord] Command error:', err);
      message.reply('An error occurred.').catch(() => {});
    });
  });

  client.login(token).catch(err => {
    console.error('[Discord] Login failed:', err.message);
  });
}
