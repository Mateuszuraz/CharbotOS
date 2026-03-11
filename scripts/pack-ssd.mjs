/**
 * Prepares a portable CharBotDrive package in ./CharBotDrive-release/
 *
 * Structure:
 *   CharBotDrive/
 *   ├── app/               ← Charbot OS (compiled)
 *   │   ├── dist/          ← Vite frontend build
 *   │   ├── dist-server/   ← Bundled server.mjs
 *   │   ├── node_modules/  ← Runtime deps (no devDeps)
 *   │   └── package.json
 *   ├── ollama/
 *   │   └── models/        ← Pre-pulled Ollama models (populated by setup)
 *   ├── Vault/             ← User data (created on first run)
 *   ├── START.bat          ← Windows launcher
 *   ├── start.sh           ← Linux/Mac launcher
 *   ├── SETUP.bat          ← Windows first-time setup
 *   ├── setup.sh           ← Linux/Mac first-time setup
 *   └── README_DRIVE.md
 *
 * Run: node scripts/pack-ssd.mjs
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const OUT = path.join(ROOT, 'CharBotDrive-release', 'CharBotDrive');

const SKIP_DIRS = new Set([
  'CharBotDrive-release', 'node_modules', '.git', '.claude',
  'Vault', 'CharBotVault', 'dist', 'dist-server',
]);

function copyDir(src, dest, skip = new Set()) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
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
console.log('\n[3/5] Creating CharBotDrive folder structure…');
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

// Copy package.json (stripped to essentials)
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  type: 'module',           // dist-server/server.mjs is ESM
  scripts: { start: 'node dist-server/server.mjs' },
  dependencies: Object.fromEntries(
    Object.entries(pkg.dependencies).filter(([k]) =>
      ['better-sqlite3', 'discord.js', 'telegraf', 'multer', 'express', 'dotenv'].includes(k)
    )
  ),
};
fs.writeFileSync(path.join(APP, 'package.json'), JSON.stringify(prodPkg, null, 2));

// Copy scripts (launchers)
const SCRIPTS_SRC = path.join(ROOT, 'scripts');
for (const f of ['START.bat', 'start.sh', 'SETUP.bat', 'setup.sh']) {
  const src = path.join(SCRIPTS_SRC, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
}

// ── 3. Install prod deps in app/ ───────────────────────────────────────────
console.log('\n[4/5] Installing production dependencies…');
execSync('npm install --omit=dev --no-audit', { cwd: APP, stdio: 'inherit' });

// ── 4. Write README ────────────────────────────────────────────────────────
console.log('\n[5/5] Writing README_DRIVE.md…');
fs.writeFileSync(path.join(OUT, 'README_DRIVE.md'), `# CharBot Drive

## First time setup
Run SETUP.bat (Windows) or ./setup.sh (Linux/Mac).
This will install Ollama and pull the bundled AI models.

## Daily use
Run START.bat (Windows) or ./start.sh (Linux/Mac).
The browser opens automatically at http://localhost:3000.

## Vault
All your data (sessions, uploads, mobile portal) is stored in ./Vault/
on this drive — never on the host machine.

## Offline Mode
The app starts in OFFLINE mode by default when launched from this drive.
To allow cloud providers, edit ./app/.env.local and set CHARBOT_OFFLINE=false.
`);

console.log(`\n✅ CharBotDrive ready at: ${OUT}`);
console.log('Copy the CharBotDrive/ folder to your SSD and you\'re set.\n');
