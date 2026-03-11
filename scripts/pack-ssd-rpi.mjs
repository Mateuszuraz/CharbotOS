/**
 * Prepares a portable CharBotDrive-RPi package in ./CharBotDrive-RPi/
 * for Raspberry Pi 5 (ARM64) — plug & play SSD edition.
 *
 * KEY DIFFERENCE vs pack-ssd.mjs:
 *   - NO npm install here (better-sqlite3 must compile on RPi ARM64)
 *   - Copies RPi-specific scripts (.sh only, no .bat)
 *   - Generates .env.local.example with RPi defaults
 *   - Sets chmod 755 on all .sh files
 *
 * Structure:
 *   CharBotDrive-RPi/
 *   ├── app/               ← Charbot OS (compiled JS, no node_modules)
 *   │   ├── dist/          ← Vite frontend build
 *   │   ├── dist-server/   ← Bundled server.mjs
 *   │   └── package.json   ← prod deps only (npm install runs on RPi)
 *   ├── ollama/
 *   │   └── models/        ← Populated by setup-rpi.sh on RPi
 *   ├── Vault/             ← User data
 *   ├── setup-rpi.sh       ← Run ONCE on RPi
 *   ├── start-rpi.sh       ← Daily launcher
 *   ├── stop-rpi.sh        ← Stop server
 *   ├── charbot-os.service ← systemd unit template
 *   ├── ngrok.service      ← systemd unit for ngrok tunnel
 *   ├── get-url.sh         ← Show current ngrok public URL
 *   ├── .env.local.example ← Config template
 *   └── README_RPi.md      ← Polish instructions
 *
 * Run: npm run pack:ssd-rpi
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const OUT = path.join(ROOT, 'CharBotDrive-RPi');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ── 1. Build frontend + server ─────────────────────────────────────────────
console.log('\n[1/5] Building Vite frontend…');
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

console.log('\n[2/5] Bundling server…');
execSync('node scripts/build-server.mjs', { cwd: ROOT, stdio: 'inherit' });

// ── 2. Create output structure ─────────────────────────────────────────────
console.log('\n[3/5] Creating CharBotDrive-RPi folder structure…');
fs.rmSync(OUT, { recursive: true, force: true });

const APP = path.join(OUT, 'app');
fs.mkdirSync(path.join(OUT, 'ollama', 'models'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'Vault', 'uploads'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'Vault', 'logs'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'Vault', 'MOBILE'), { recursive: true });
fs.mkdirSync(APP, { recursive: true });

// Copy compiled assets
copyDir(path.join(ROOT, 'dist'), path.join(APP, 'dist'));
copyDir(path.join(ROOT, 'dist-server'), path.join(APP, 'dist-server'));

// Write stripped package.json (prod deps only — node_modules built on RPi)
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  type: 'module',
  scripts: { start: 'node dist-server/server.mjs' },
  dependencies: Object.fromEntries(
    Object.entries(pkg.dependencies).filter(([k]) =>
      ['better-sqlite3', 'discord.js', 'telegraf', 'multer', 'express', 'dotenv', 'express-rate-limit'].includes(k)
    )
  ),
};
fs.writeFileSync(path.join(APP, 'package.json'), JSON.stringify(prodPkg, null, 2));

// ── 3. Copy RPi scripts ────────────────────────────────────────────────────
console.log('\n[4/5] Copying RPi scripts…');
const SCRIPTS_SRC = path.join(ROOT, 'scripts');
const rpiFiles = ['setup-rpi.sh', 'start-rpi.sh', 'stop-rpi.sh', 'get-url.sh', 'charbot-os.service', 'ngrok.service'];
for (const f of rpiFiles) {
  const src = path.join(SCRIPTS_SRC, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(OUT, f));
  } else {
    console.warn(`  [WARN] Missing: scripts/${f}`);
  }
}

// Set executable bit on .sh files (effective on Linux/Mac, no-op on Windows)
for (const f of rpiFiles.filter(f => f.endsWith('.sh'))) {
  try { fs.chmodSync(path.join(OUT, f), 0o755); } catch { /* Windows — OK */ }
}

// ── 4. Write .env.local.example ────────────────────────────────────────────
fs.writeFileSync(path.join(OUT, '.env.local.example'), `# Charbot OS — RPi configuration
# Copy this file to app/.env.local and adjust values

# ── Security ──────────────────────────────────────────────────────────────
# APP_SECRET is auto-generated on first run (Vault/app-secret.txt)
# Set manually only if you need a fixed token across restores

# ── Network ───────────────────────────────────────────────────────────────
BIND_HOST=0.0.0.0          # Listen on all interfaces (LAN + localhost)
PORT=3000

# ── Cloud providers ───────────────────────────────────────────────────────
CHARBOT_OFFLINE=true       # Set to false to enable OpenAI/Anthropic/Google

# ── Features (disabled by default) ────────────────────────────────────────
# ENABLE_EXEC=true          # Allow terminal exec via API
# ENABLE_FINE_TUNE=true     # Allow Ollama fine-tuning
# CHARBOT_UNCENSORED=true   # Enable restriction level "none"

# ── Telegram bot ──────────────────────────────────────────────────────────
# TELEGRAM_BOT_TOKEN=your_token_here
# TELEGRAM_WHITELIST=123456789,987654321

# ── Discord bot ───────────────────────────────────────────────────────────
# DISCORD_BOT_TOKEN=your_token_here
# DISCORD_GUILD_WHITELIST=guild_id_1,guild_id_2
`);

// ── 5. Write README_RPi.md ─────────────────────────────────────────────────
console.log('\n[5/5] Writing README_RPi.md…');
fs.writeFileSync(path.join(OUT, 'README_RPi.md'), `# Charbot OS — Raspberry Pi 5 (SSD Edition)

## Wymagania
- Raspberry Pi 5 (4 GB RAM lub więcej)
- SSD podłączony przez USB 3 lub PCIe (zalecane NVMe)
- Dostęp do internetu podczas pierwszej konfiguracji

---

## Instalacja (jednorazowo)

1. Skopiuj cały folder \`CharBotDrive-RPi/\` na SSD.
2. Zamontuj SSD na RPi (np. \`/media/pi/CharBot\`).
3. Otwórz terminal i uruchom:

\`\`\`bash
cd /media/pi/CharBot
chmod +x setup-rpi.sh && ./setup-rpi.sh
\`\`\`

Skrypt:
- Instaluje Node.js 20 LTS (via NodeSource)
- Instaluje Ollama (ARM64)
- Kompiluje \`better-sqlite3\` dla ARM64 (\`npm install\` w \`app/\`)
- Pobiera modele: \`llama3.2\` i \`nomic-embed-text\`
- (Opcjonalnie) konfiguruje autostart przy każdym uruchomieniu RPi
- (Opcjonalnie) instaluje ngrok i konfiguruje publiczny tunel HTTPS

---

## Codzienne użycie

### Ręcznie:
\`\`\`bash
./start-rpi.sh      # uruchom serwer
./stop-rpi.sh       # zatrzymaj serwer
\`\`\`

### Dostęp:
- **Na RPi:** \`http://localhost:3000\`
- **Z laptopa/telefonu w sieci LAN:** \`http://192.168.x.x:3000\`
  (IP wyświetla się w bannerze przy starcie)

### Autostart (systemd):
Jeśli wybrałeś autostart w trakcie \`setup-rpi.sh\`:
\`\`\`bash
sudo systemctl status charbot-os   # sprawdź status
sudo systemctl restart charbot-os  # restart
sudo systemctl stop charbot-os     # zatrzymaj
sudo journalctl -u charbot-os -f   # logi na żywo
\`\`\`

---

## Zdalny dostęp przez ngrok (24/7)

ngrok tworzy publiczny adres HTTPS dla twojego Charbota — dostępny z dowolnego miejsca na świecie.

### Wymagania
- Darmowe konto na https://ngrok.com
- Authtoken z https://dashboard.ngrok.com/get-started/your-authtoken

### Konfiguracja (setup-rpi.sh pyta o to automatycznie)
\`\`\`bash
ngrok config add-authtoken TWÓJ_TOKEN
\`\`\`

### Sprawdzenie publicznego URL
\`\`\`bash
./get-url.sh
\`\`\`

### Status usługi ngrok
\`\`\`bash
sudo systemctl status ngrok          # sprawdź status
sudo systemctl restart ngrok         # restart
sudo journalctl -u ngrok -f          # logi na żywo
\`\`\`

### Ręczne uruchomienie (bez autostartu)
\`\`\`bash
ngrok start charbot                  # uruchom tunel
./get-url.sh                         # sprawdź URL
\`\`\`

---

## Konfiguracja

Skopiuj \`.env.local.example\` do \`app/.env.local\`:
\`\`\`bash
cp .env.local.example app/.env.local
nano app/.env.local
\`\`\`

Kluczowe opcje:
- \`CHARBOT_OFFLINE=false\` — włącza dostawców chmurowych (OpenAI, Anthropic, Google)
- \`BIND_HOST=0.0.0.0\` — serwer dostępny z sieci LAN (domyślnie włączone)

---

## Dane użytkownika (Vault)

Wszystkie dane zapisywane są w \`./Vault/\`:
- \`Vault/uploads/\` — przesłane pliki i obrazy
- \`Vault/logs/\` — logi aplikacji (rotacja po 5 MB)
- \`Vault/MOBILE/\` — mobilny portal
- \`Vault/app-secret.txt\` — token bezpieczeństwa (auto-generowany)
- \`Vault/ai-keys.json\` — klucze API dostawców chmurowych

---

## Modele Ollama

Modele przechowywane są w \`./ollama/models/\` — bezpośrednio na SSD.
Aby pobrać dodatkowy model:
\`\`\`bash
OLLAMA_MODELS=/media/pi/CharBot/ollama/models ollama pull mistral
\`\`\`

---

## Rozwiązywanie problemów

**Serwer nie startuje:**
\`\`\`bash
node --version        # musi być >= 20
ollama --version      # musi być dostępne
ls app/node_modules   # musi istnieć — jeśli nie: cd app && npm install
\`\`\`

**Nie można połączyć z LAN:**
- Sprawdź IP: \`hostname -I | awk '{print \$1}'\`
- Upewnij się że \`BIND_HOST=0.0.0.0\` w \`app/.env.local\`
- Sprawdź firewall: \`sudo ufw allow 3000/tcp\`

**Reset danych:**
\`\`\`bash
rm -rf Vault/          # usuwa wszystkie dane — nieodwracalne!
mkdir -p Vault/{uploads,logs,MOBILE}
\`\`\`
`);

console.log(`\n✅ CharBotDrive-RPi gotowy: ${OUT}`);
console.log('Skopiuj folder CharBotDrive-RPi/ na SSD, podłącz do RPi i uruchom setup-rpi.sh');
console.log('ngrok: setup-rpi.sh zapyta o authtoken i skonfiguruje tunel automatycznie\n');
