<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

**Part of the [Charbot](https://charbot.org) ecosystem — local-first AI tools built for real work.**

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat&logo=electron&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=flat&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)
</div>

# Charbot OS

A local-first AI workspace for teams and individuals who care about data privacy. Multi-provider chat (Ollama, OpenAI, Google, Anthropic), automation flows, session management, file attachments, Charbot Buddy companion, mobile export, and remote control via Telegram/Discord.

Runs fully offline with Ollama — no cloud required, no subscription, no data leaving your machine.

---

## Quick Start

**Prerequisites:** Node.js 18+

```bash
npm install
cp .env.example .env.local
# Edit .env.local — at minimum set your AI provider key
npm run dev
```

App runs at `http://localhost:3000`.

---

## Configuration

Copy `.env.example` to `.env.local` and fill in the values you need.

### AI Providers

Configure your provider and API key in the **Settings panel** inside the app (gear icon). Supported providers:
- **Ollama** (default) — local models, no key required. Default endpoint: `http://localhost:11434`
- **OpenAI** — GPT-4o and others. Requires `OPENAI_API_KEY` (set in app settings)
- **Google** — Gemini models. Requires `GEMINI_API_KEY`
- **Anthropic** — Claude models. Requires `ANTHROPIC_API_KEY`

### Vault (SSD Storage)

All persistent data is stored in the **Vault directory**:

```
CharbotVault/
├── charbot.db          # SQLite session store (used by bots)
├── uploads/            # Uploaded files, organized by session ID
│   └── <sessionId>/
├── logs/               # Activity logs
│   ├── remote.log      # Telegram/Discord command log
│   ├── uploads.log
│   └── mobile.log
└── mobile/             # Generated mobile portal
    ├── index.html
    ├── style.css
    └── sessions/
        └── <id>.html
```

**Default location:** `~/CharbotVault`

**To use an external SSD**, set in `.env.local`:
```
CHARBOT_VAULT_DIR=/Volumes/MySSD/CharbotVault
```
The directory is created automatically on first run.

---

## Charbot Buddy

Charbot OS includes a floating 3D AI companion window that lives on your desktop — always on top, proactive, and context-aware. Buddy reacts to what you're working on, sends scheduled motivational messages, and responds to voice or text input.

The Buddy window runs separately from the main chat interface and communicates via IPC.

---

## Mobile Portal

Export all your sessions as a static offline-ready website you can open on any phone.

1. Click **"Export to Phone"** in the Sessions sidebar
2. The server generates HTML files in `$CHARBOT_VAULT_DIR/mobile/`
3. Serve it locally: `npx serve "$CHARBOT_VAULT_DIR/mobile"`
4. Open the printed URL on your phone (same WiFi network)

Or just copy the `mobile/` folder to your phone and open `index.html` directly.

---

## Telegram Bot

Remote-control Charbot OS from your Telegram app.

**Setup:**
1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token
2. Add to `.env.local`:
   ```
   TELEGRAM_BOT_TOKEN=123456789:AABBCCDDaabbccdd...
   TELEGRAM_ALLOWED_CHAT_IDS=YOUR_CHAT_ID
   ```
3. Find your chat ID by messaging [@userinfobot](https://t.me/userinfobot)
4. Restart the server — the bot activates automatically

**Commands:**
| Command | Description |
|---|---|
| `/status` | Session count and last activity |
| `/last` | Last 5 sessions |
| `/search <query>` | Search session titles and content |
| `/export <id\|last>` | Download a session transcript as `.txt` |

---

## Discord Bot

Remote-control Charbot OS from a Discord server.

**Setup:**
1. Go to [discord.com/developers](https://discord.com/developers/applications) → New Application → Bot
2. Enable **Message Content Intent** under Bot → Privileged Gateway Intents
3. Copy the bot token and add to `.env.local`:
   ```
   DISCORD_BOT_TOKEN=MTIz.abc.xyz...
   DISCORD_ALLOWED_GUILD_IDS=YOUR_GUILD_ID
   ```
4. Invite bot to your server with scopes: `bot` + permissions: `Read Messages`, `Send Messages`, `Attach Files`
5. Restart the server

**Commands** (prefix: `!cb `):
| Command | Description |
|---|---|
| `!cb help` | Show commands |
| `!cb status` | Session count and last activity |
| `!cb last` | Last 5 sessions |
| `!cb search <query>` | Search sessions |
| `!cb export <id\|last>` | Download session transcript |

---

## Automation Flows

Build node-based AI pipelines in the **Flows** tab:
- **Prompt** → send text to the AI
- **Transform** → process/reformat AI output
- **JavaScript** → run custom JS (`input` variable = previous output)
- **Condition** → branch on true/false expression
- **Shell** → run terminal commands (via local server)
- **Output** → display final result

Workflows are saved to `localStorage` and can be named and loaded.

---

## Raspberry Pi 5 Deployment

Run Charbot OS as a headless server on a Raspberry Pi 5 (or any Linux machine), accessible over your local network or remotely via ngrok.

```bash
# On your dev machine — pack everything for RPi
npm run pack:ssd-rpi

# On the RPi — first-time setup
bash setup-rpi.sh

# Start / stop
bash start-rpi.sh
bash stop-rpi.sh

# Or run as a systemd service
sudo systemctl enable charbot-os
sudo systemctl start charbot-os
```

Remote access URL (ngrok): `bash get-url.sh`

---

## Architecture

```
charbot-os/
├── src/
│   ├── components/       # React UI components
│   │   └── automation/   # Flow editor nodes
│   ├── context/          # React context (Sessions, Settings)
│   ├── hooks/            # useLocalChat (multi-provider streaming)
│   └── types/            # TypeScript interfaces
├── server/
│   ├── vault.ts          # Vault directory helpers
│   ├── db.ts             # SQLite session store (better-sqlite3)
│   ├── mobile.ts         # Static HTML portal generator
│   ├── telegram.ts       # Telegram bot (telegraf)
│   └── discord.ts        # Discord bot (discord.js)
├── electron/
│   └── main.ts           # Electron entry, Buddy window
├── CharBotDrive-RPi/     # RPi 5 deployment scripts
└── server.ts             # Express server + Vite dev middleware
```

---

## Charbot Ecosystem

| Project | Description |
|---------|-------------|
| **Charbot OS** | This repo — enterprise AI platform |
| **DeskBuddy** | Proactive desktop AI companion with voice |
| **LocalMind** | Private ChatGPT alternative, no cloud |

More at **[charbot.org](https://charbot.org)**

---

*Built by [Mateusz Uraz](https://github.com/Mateuszuraz) · Poland · Local-first AI*
